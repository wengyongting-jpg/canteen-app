// F1 推荐流程：意图解析 → 硬过滤 → 排序 → LLM 理由 → 校验/降级 → 响应
const express = require('express');
const { getDb } = require('../src/db');
const { computeStats, getReviewsByDish } = require('../src/services/stats');
const { applyFilters, passesSafety, passesDiet } = require('../src/services/filter');
const { rank } = require('../src/services/ranking');
const { parseIntent } = require('../src/services/intent');
const llm = require('../src/services/llm');
const { validateRecommendation } = require('../src/services/validator');
const profileSvc = require('../src/services/profile');
const { RECOMMEND_CANDIDATES } = require('../config/thresholds');
const { ah } = require('../src/util');

const router = express.Router();

// 固定兜底文案
const FALLBACK_TEXT = '根据当前食堂数据，无法找到相关信息，请尝试其他菜品，或补充评价。';

function round2(n) { return Number(Number(n).toFixed(2)); }

// 菜品摘要（用于候选与响应组装）
function dishBrief(d) {
  return {
    id: d.id, name: d.name, price: d.price,
    window_name: d.window_name, canteen_name: d.canteen_name,
    taste_tags: d.taste_tags, diet_tags: d.diet_tags, allergens: d.allergens
  };
}

// 兜底响应：固定文案 + 相近选项（安全菜里按加权分取热门）
function fallbackResponse(db, parsed, profile) {
  const { list } = computeStats(db);
  const safe = list.filter(d => passesSafety(d, profile.allergens) && passesDiet(d, profile.diet_restrictions || []));
  const ranked = rank(safe, profile).slice(0, 5);
  return {
    fallback: true,
    message: FALLBACK_TEXT,
    suggestions: ranked.map(d => ({
      dish_id: d.id, name: d.name, window_name: d.window_name, canteen_name: d.canteen_name,
      price: d.price, weighted_score: round2(d.weighted), is_new: d.is_new
    })),
    items: [], relaxed: [], degraded: false, parsed
  };
}

// 降级 Top3：按规则排序，理由用固定模板，引用取该菜评分最高一条评价
function ruleTop3(ranked, reviewsByDish) {
  return ranked.slice(0, 3).map(d => {
    const revs = (reviewsByDish.get(d.id) || []).filter(r => r.comment);
    let best = null;
    for (const r of revs) {
      const mean = (r.score_taste + r.score_value + r.score_portion) / 3;
      if (!best || mean > (best.score_taste + best.score_value + best.score_portion) / 3) best = r;
    }
    return {
      dish_id: d.id,
      reason: '按你的条件与加权评分排序',
      evidence: best ? [{ review_id: best.id, quote: best.comment }] : []
    };
  });
}

// LLM 生成 Top3 理由：候选数据含菜概要 + 每菜 1-2 条真实评价摘录
async function llmReasons(query, parsed, candidates, reviewsByDish) {
  const cands = candidates.map(d => {
    const revs = (reviewsByDish.get(d.id) || [])
      .sort((a, b) => (b.score_taste + b.score_value + b.score_portion) - (a.score_taste + a.score_value + a.score_portion))
      .filter(r => r.comment)
      .slice(0, 2)
      .map(r => ({ review_id: r.id, score: (r.score_taste + r.score_value + r.score_portion) / 3, comment: r.comment }));
    return {
      dish_id: d.id, name: d.name, window: d.window_name, canteen: d.canteen_name,
      price: d.price, taste_tags: d.taste_tags, weighted_score: round2(d.weighted),
      review_count: d.v, reviews: revs
    };
  });
  return llm.chat([
    { role: 'system', content: llm.SYSTEM_GUARD },
    { role: 'user', content: `基于以下候选菜品，为学生生成 Top3 推荐及理由。

学生需求: ${JSON.stringify(String(query))}
解析条件: ${JSON.stringify({ max_price: parsed.max_price, min_price: parsed.min_price, taste: parsed.taste, diet: parsed.diet, taste_new: parsed.taste_new, allergens: parsed.allergens || [] })}
候选菜品（只能从中选择，评价为真实评价，quote 必须是 comment 的原文连续片段）:
${JSON.stringify(cands)}

输出 JSON: {"items":[{"dish_id":数字,"reason":"50字以内中文推荐理由，结合口味/价格/评价","evidence":[{"review_id":数字,"quote":"评价原文片段"}]}],"fallback":false}
要求：恰好 3 个 items，按推荐度排序；evidence 0-2 条且只能引用该菜自己的评价。` }
  ]);
}

router.post('/recommend', ah(async (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const query = String(body.query || '').slice(0, 200);
  const filters = body.filters && typeof body.filters === 'object' ? body.filters : {};
  const userId = String(body.user_id || 'guest');
  const profile = profileSvc.getProfile(db, userId);

  // 1. 意图解析（LLM 优先，关键词兜底）
  const parsed = await parseIntent(query, filters, db);

  // 2. 查询指向不存在的食堂/窗口/菜品 → 兜底
  if (parsed.invalid_canteen || parsed.invalid_dish) return res.json(fallbackResponse(db, parsed, profile));

  const { list } = computeStats(db);
  const reviewsByDish = getReviewsByDish(db);

  // 3. 硬过滤（合并用户过敏原/饮食限制，永不放宽）
  const { items: filtered, relaxed } = applyFilters(list, parsed, profile);
  if (filtered.length === 0) return res.json(fallbackResponse(db, parsed, profile));

  // 4. 排序取候选前 8
  const candidates = rank(filtered, profile).slice(0, RECOMMEND_CANDIDATES);

  // 5. LLM 理由 + 校验（失败重试 1 次），仍失败则规则降级
  let final = null, degraded = false;
  if (llm.isAvailable() && query.trim()) {
    for (let i = 0; i < 2 && !final; i++) {
      try {
        const out = await llmReasons(query, parsed, candidates, reviewsByDish);
        const v = validateRecommendation(out, candidates);
        if (v.ok) final = v.items;
      } catch { /* 静默重试 */ }
    }
  }
  if (!final) { degraded = true; final = ruleTop3(candidates, reviewsByDish); }

  // 6. 组装响应
  const byId = new Map(candidates.map(c => [c.id, c]));
  const items = final.map(it => {
    const d = byId.get(it.dish_id);
    return {
      dish: dishBrief(d),
      reason: it.reason,
      evidence: it.evidence,
      allergen_status: d.allergen_status,
      is_new: d.is_new,
      weighted_score: round2(d.weighted)
    };
  });

  res.json({ items, relaxed, degraded, parsed, fallback: false });
}));

module.exports = { router, FALLBACK_TEXT };
