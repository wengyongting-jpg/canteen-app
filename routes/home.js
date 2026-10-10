// 首页聚合：新品榜 top10、踩雷榜 top10、推荐菜 top6
const express = require('express');
const { getDb } = require('../src/db');
const { computeStats, getReviewsByDish } = require('../src/services/stats');
const { minefieldBoard } = require('../src/services/minefield');
const { TOP_NEW, TOP_RECOMMENDED } = require('../config/thresholds');

const router = express.Router();

router.get('/home', (req, res) => {
  const db = getDb();
  const stats = computeStats(db);
  const reviewsByDish = getReviewsByDish(db);

  // 新品榜：评价 <3 条标 pending_reviews 排后面；组内按加权分、评价数排序
  const newDishes = stats.list.filter(d => d.is_new)
    .sort((a, b) => {
      const pa = a.v >= 3 ? 0 : 1, pb = b.v >= 3 ? 0 : 1;
      if (pa !== pb) return pa - pb;
      if (b.weighted !== a.weighted) return b.weighted - a.weighted;
      return b.v - a.v;
    })
    .slice(0, TOP_NEW)
    .map(d => ({
      dish_id: d.id, name: d.name, price: d.price,
      window_name: d.window_name, canteen_name: d.canteen_name,
      weighted_score: Number(d.weighted.toFixed(2)),
      review_count: d.v, is_new: true,
      pending_reviews: d.v < 3
    }));

  const minefield = minefieldBoard(stats.list, reviewsByDish);

  const recommended = stats.list.filter(d => d.v >= 1)
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, TOP_RECOMMENDED)
    .map(d => ({
      dish_id: d.id, name: d.name, price: d.price,
      window_name: d.window_name, canteen_name: d.canteen_name,
      weighted_score: Number(d.weighted.toFixed(2)),
      review_count: d.v, taste_tags: d.taste_tags, is_new: d.is_new
    }));

  res.json({ new_dishes: newDishes, minefield, recommended });
});

module.exports = router;
