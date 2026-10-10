// 校验服务：验证 LLM 推荐结果与摘要的引用真实性，防幻觉
const { parseJsonSafe } = require('../util');

// 校验推荐输出：dish_id 在候选集、review_id 属于该菜且存在、quote 是评价原文子串、硬条件复检
// 返回 { ok, items }；ok=false 时上层重试一次后降级
function validateRecommendation(out, candidates, matchFn) {
  if (!out || !Array.isArray(out.items) || out.items.length < 1) return { ok: false, items: [] };
  const candMap = new Map(candidates.map(c => [c.id, c]));
  const items = [];
  for (const it of out.items.slice(0, 3)) {
    const dishId = Number(it && it.dish_id);
    const dish = candMap.get(dishId);
    if (!dish) return { ok: false, items: [] };               // 必须在候选集内
    if (typeof it.reason !== 'string' || !it.reason.trim()) return { ok: false, items: [] };
    if (matchFn && !matchFn(dish)) return { ok: false, items: [] }; // 硬条件复检
    const evidence = [];
    if (Array.isArray(it.evidence)) {
      for (const ev of it.evidence) {
        const rid = Number(ev && ev.review_id);
        const rv = reviewMap.get(rid);
        if (!rv || rv.dish_id !== dishId) return { ok: false, items: [] }; // 引用必须存在且属于该菜
        const quote = String(ev.quote || '').trim();
        if (!quote || !normalize(rv.comment).includes(normalize(quote))) return { ok: false, items: [] };
        evidence.push({ review_id: rid, quote: rv.comment });
      }
    }
    items.push({ dish_id: dishId, reason: it.reason.trim().slice(0, 120), evidence });
  }
  return { ok: true, items };
}

// 摘要校验：review_id 存在且属于该菜；无有效引用的句子丢弃
function validateSummary(sentences, reviews) {
  const byId = new Map(reviews.map(r => [r.id, r]));
  const valid = [];
  for (const s of sentences || []) {
    if (!s || typeof s.text !== 'string' || !s.text.trim()) continue;
    const ids = (Array.isArray(s.review_ids) ? s.review_ids : [])
      .map(Number).filter(id => byId.has(id));
    if (ids.length === 0) continue; // 无引用 → 丢弃该句
    valid.push({ text: s.text.trim().slice(0, 160), review_ids: ids });
  }
  return valid;
}

// 归一化：去空白差异，避免 LLM 引用时格式导致误判
function normalize(s) {
  return String(s || '').replace(/\s+/g, '');
}

// 惰性注入 reviewMap（避免循环依赖，由路由层设置）
let reviewMap = new Map();
function setReviewMap(db) {
  const rows = db.prepare('SELECT id, dish_id, comment FROM reviews WHERE status = \'normal\'').all();
  reviewMap = new Map(rows.map(r => [r.id, r]));
}

module.exports = { validateRecommendation, validateSummary, normalize, setReviewMap };
