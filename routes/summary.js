// F3 摘要：LLM 从该菜真实评价生成 3-5 句摘要，每句必须挂 review_ids；无 LLM 时规则摘要
const express = require('express');
const { getDb } = require('../src/db');
const { computeStats } = require('../src/services/stats');
const llm = require('../src/services/llm');
const { validateSummary } = require('../src/services/validator');
const { SUMMARY_MIN_REVIEWS } = require('../config/thresholds');
const { anonName, ah } = require('../src/util');

const router = express.Router();

// 规则摘要：好评率 + 高频观点，每句挂来源评价 id
function ruleSummary(dish, reviews) {
  const mean = r => (r.score_taste + r.score_value + r.score_portion) / 3;
  const sorted = [...reviews].sort((a, b) => mean(b) - mean(a));
  const good = sorted.filter(r => mean(r) >= 4);
  const bad = sorted.filter(r => mean(r) <= 2.5);
  const sentences = [];
  sentences.push({
    text: `这道菜共有 ${reviews.length} 条评价，当前加权评分 ${dish.weighted.toFixed(1)} 分。`,
    review_ids: sorted.slice(0, 3).map(r => r.id)
  });
  if (good.length > 0) {
    sentences.push({
      text: `好评观点：${good.slice(0, 2).map(r => `「${r.comment}」`).join('；')}`,
      review_ids: good.slice(0, 2).map(r => r.id)
    });
  }
  if (bad.length > 0) {
    sentences.push({
      text: `需要留意：${bad.slice(0, 2).map(r => `「${r.comment}」`).join('；')}`,
      review_ids: bad.slice(0, 2).map(r => r.id)
    });
  }
  if (sentences.length < 2) {
    sentences.push({ text: '整体口碑中等，欢迎你来补充第一手评价。', review_ids: [sorted[0].id] });
  }
  return sentences;
}

router.get('/dishes/:id/summary', ah(async (req, res) => {
  const db = getDb();
  const dishId = Number(req.params.id);
  const stats = computeStats(db);
  const dish = stats.byId.get(dishId);
  if (!dish) return res.status(404).json({ error: '菜品不存在' });

  const reviews = db.prepare(`
    SELECT id, user_id, score_taste, score_value, score_portion, comment, created_at
    FROM reviews WHERE dish_id = ? AND status = 'normal'
    ORDER BY created_at DESC
  `).all(dishId);

  // 评价不足 → 不生成摘要，只返回原评价
  if (reviews.length < SUMMARY_MIN_REVIEWS) {
    return res.json({
      available: false,
      review_count: reviews.length,
      message: '评价较少，暂无摘要',
      reviews: reviews.map(r => ({
        id: r.id, user_display: anonName(r.user_id),
        scores: { taste: r.score_taste, value: r.score_value, portion: r.score_portion },
        comment: r.comment, created_at: r.created_at
      }))
    });
  }

  const feed = reviews.map(r => ({
    review_id: r.id,
    scores: { taste: r.score_taste, value: r.score_value, portion: r.score_portion },
    comment: r.comment
  }));

  // LLM 摘要（失败降级规则摘要）
  let sentences = null, source = 'rule';
  if (llm.isAvailable()) {
    try {
      const out = await llm.chat([
        { role: 'system', content: llm.SYSTEM_GUARD },
        { role: 'user', content: `基于这道菜的真实评价生成 3-5 句中文摘要。

菜品: ${JSON.stringify({ name: dish.name, window: dish.window_name, price: dish.price, taste_tags: dish.taste_tags })}
评价列表（review_id 必须来自这里，不得虚构）:
${JSON.stringify(feed)}

输出 JSON: {"summary":[{"text":"一句不超过60字的总结","review_ids":[支撑该句的评价id]}]}
要求：每句的 review_ids 非空且真实存在；没有评价支撑的观点不要写。` }
      ]);
      const valid = validateSummary(out && out.summary, reviews);
      if (valid.length >= 2) { sentences = valid; source = 'llm'; }
    } catch { /* 降级 */ }
  }
  if (!sentences) sentences = ruleSummary(dish, reviews);

  res.json({
    available: true,
    review_count: reviews.length,
    source,
    summary: sentences,
    reviews: reviews.map(r => ({
      id: r.id, user_display: anonName(r.user_id),
      scores: { taste: r.score_taste, value: r.score_value, portion: r.score_portion },
      comment: r.comment, created_at: r.created_at
    }))
  });
}));

module.exports = router;
