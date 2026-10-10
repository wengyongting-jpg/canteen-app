// 统计服务：运行时计算每个菜的加权评分（贝叶斯平滑），所有展示口径统一走这里
const { M_BAYES, NEW_DAYS } = require('../../config/thresholds');
const { parseJsonSafe, isNewDish } = require('../util');

// 加载全部活跃菜品 + 正常状态评价，聚合成带统计的列表
// 返回 { list, byId, globalAvg }，list 元素含窗口/食堂名、解析后的标签、v/R/weighted/low_ratio/is_new
function computeStats(db) {
  const dishes = db.prepare(`
    SELECT d.*, w.name AS window_name, w.canteen_id, c.name AS canteen_name
    FROM dishes d
    JOIN windows w ON w.id = d.window_id
    JOIN canteens c ON c.id = w.canteen_id
    WHERE d.is_active = 1
  `).all();

  const reviewRows = db.prepare(`
    SELECT dish_id, score_taste, score_value, score_portion
    FROM reviews WHERE status = 'normal'
  `).all();

  // 按菜聚合：v 评价数、R 三项均分的均值、low 1-2 星条数
  const agg = new Map();
  for (const r of reviewRows) {
    let a = agg.get(r.dish_id);
    if (!a) { a = { v: 0, sum: 0, low: 0 }; agg.set(r.dish_id, a); }
    const mean = (r.score_taste + r.score_value + r.score_portion) / 3;
    a.v += 1; a.sum += mean;
    if (mean <= 2.5) a.low += 1;
  }

  // C：全部有评价的活跃菜品的均分均值（全局基准分）
  let sumR = 0, cntR = 0;
  for (const a of agg.values()) { sumR += a.sum / a.v; cntR += 1; }
  const C = cntR > 0 ? sumR / cntR : 3.0;

  const list = dishes.map(d => {
    const a = agg.get(d.id) || { v: 0, sum: 0, low: 0 };
    const R = a.v > 0 ? a.sum / a.v : null;
    // 贝叶斯加权：(v*R + m*C) / (v + m)，无评价时退化为基准分 C
    const weighted = a.v > 0 ? (a.v * R + M_BAYES * C) / (a.v + M_BAYES) : C;
    return {
      ...d,
      taste_tags: parseJsonSafe(d.taste_tags, []),
      allergens: parseJsonSafe(d.allergens, []),
      diet_tags: parseJsonSafe(d.diet_tags, []),
      v: a.v,
      R,
      weighted,
      low_ratio: a.v > 0 ? a.low / a.v : 0,
      is_new: isNewDish(d.listed_at, NEW_DAYS)
    };
  });

  const byId = new Map(list.map(d => [d.id, d]));
  return { list, byId, globalAvg: C };
}

// 拉取全部正常状态评价（供踩雷原因提取与摘要使用）
function getNormalReviews(db) {
  return db.prepare(`
    SELECT id, dish_id, user_id, score_taste, score_value, score_portion, comment, created_at
    FROM reviews WHERE status = 'normal'
  `).all();
}

// 按 dish_id 分组
function getReviewsByDish(db) {
  const map = new Map();
  for (const r of getNormalReviews(db)) {
    if (!map.has(r.dish_id)) map.set(r.dish_id, []);
    map.get(r.dish_id).push(r);
  }
  return map;
}

module.exports = { computeStats, getNormalReviews, getReviewsByDish };
