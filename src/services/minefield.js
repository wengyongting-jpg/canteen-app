// 踩雷预警服务：阈值全部读 config/thresholds
const { MINEFIELD_MIN_REVIEWS, MINEFIELD_SCORE, MINEFIELD_LOW_RATIO, TOP_MINEFIELD } = require('../../config/thresholds');

// 低分评价关键词字典：从差评短评提取主要踩雷原因
const KEYWORDS = [
  ['分量少', /分量|量少|太少|不够吃|吃不饱/],
  ['太咸', /咸|齁/],
  ['太油', /油|腻/],
  ['出餐慢', /等了|慢|久|迟到|排队/],
  ['不新鲜', /凉|剩菜|不新鲜|腥|馊|坨/],
  ['口感差', /糊|苦|硬|夹生|怪/],
  ['不值', /贵|不值|涨价/],
  ['卫生问题', /头发|异物|脏/]
];

// 单菜踩雷评估；lowReviews 为该菜 1-2 星（均值≤2.5）评价
function assessDish(dishStat, reviews) {
  const v = dishStat.v;
  if (v === 0) return { is_minefield: false, low_ratio: 0, reasons: [], representatives: [], notice: null };
  if (v < MINEFIELD_MIN_REVIEWS) {
    return { is_minefield: false, low_ratio: dishStat.low_ratio, reasons: [], representatives: [], notice: '评价较少，暂不判断' };
  }
  const lowReviews = reviews.filter(r => (r.score_taste + r.score_value + r.score_portion) / 3 <= 2.5);
  const lowRatio = lowReviews.length / v;
  const isMinefield = dishStat.weighted < MINEFIELD_SCORE || lowRatio >= MINEFIELD_LOW_RATIO;
  if (!isMinefield) return { is_minefield: false, low_ratio: lowRatio, reasons: [], representatives: [], notice: null };

  // 提取高频差评关键词（取前 2 个）
  const counts = [];
  for (const [label, re] of KEYWORDS) {
    const hit = lowReviews.filter(r => re.test(r.comment || '')).length;
    if (hit > 0) counts.push({ label, hit });
  }
  counts.sort((a, b) => b.hit - a.hit);
  const reasons = counts.slice(0, 2).map(c => c.label);
  // 代表性差评 2 条（均值最低且有短评的）
  const representatives = [...lowReviews]
    .sort((a, b) => (a.score_taste + a.score_value + a.score_portion) - (b.score_taste + b.score_value + b.score_portion))
    .filter(r => r.comment)
    .slice(0, 2)
    .map(r => ({ review_id: r.id, comment: r.comment }));

  const reasonText = reasons.length
    ? `主要差评原因：${reasons.join('、')}`
    : '主要差评原因：整体评分过低';
  return { is_minefield: true, low_ratio: lowRatio, reasons: [reasonText], representatives, notice: null };
}

// 踩雷榜：评价数 ≥ MINEFIELD_MIN_REVIEWS 且判定为踩雷的菜，按加权分升序取前 N
function minefieldBoard(dishStatsList, reviewsByDish) {
  return dishStatsList
    .filter(d => d.v >= MINEFIELD_MIN_REVIEWS)
    .map(d => ({ d, info: assessDish(d, reviewsByDish.get(d.id) || []) }))
    .filter(x => x.info.is_minefield)
    .sort((a, b) => a.d.weighted - b.d.weighted)
    .slice(0, TOP_MINEFIELD)
    .map(({ d, info }) => ({
      dish_id: d.id, name: d.name, window_name: d.window_name, canteen_name: d.canteen_name,
      price: d.price, weighted_score: Number(d.weighted.toFixed(2)),
      review_count: d.v, low_ratio: Number(info.low_ratio.toFixed(2)),
      reason: info.reasons[0] || '', representatives: info.representatives
    }));
}

module.exports = { assessDish, minefieldBoard };
