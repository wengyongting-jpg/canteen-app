// 集中管理全部阈值参数，规则服务统一从这里读取
module.exports = {
  M_BAYES: 5,                 // 贝叶斯加权先验强度
  MINEFIELD_MIN_REVIEWS: 5,   // 踩雷判定最少评价数
  MINEFIELD_SCORE: 3.0,       // 踩雷加权分阈值
  MINEFIELD_LOW_RATIO: 0.4,   // 1-2 星占比阈值
  NEW_DAYS: 14,               // 新品判定天数
  SUMMARY_MIN_REVIEWS: 3,     // 生成摘要最少评价数
  REVIEW_DAILY_LIMIT: 1,      // 同用户同菜品每日评价上限
  RATE_LIMIT: { WINDOW_MS: 60000, MAX_COUNT: 3 }, // 60 秒内最多 3 条，超过返回 429
  PREF_BONUS: 0.15,           // 偏好口味每命中一个标签的加权加分
  NEW_BOOST: 1.15,            // 新品加权倍率
  PRICE_RELAX_STEP: 2,        // 价格放宽一档的步长（元）
  RECOMMEND_CANDIDATES: 8,    // 送入 LLM 的候选菜品数
  TOP_NEW: 10,                // 新品榜数量
  TOP_MINEFIELD: 10,          // 踩雷榜数量
  TOP_RECOMMENDED: 6          // 首页推荐菜数量
};
