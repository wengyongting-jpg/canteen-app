// 菜品详情 + 安全替代
const express = require('express');
const { getDb } = require('../src/db');
const { computeStats } = require('../src/services/stats');
const { assessDish } = require('../src/services/minefield');
const { rank } = require('../src/services/ranking');
const profileSvc = require('../src/services/profile');
const { anonName, parseJsonSafe, ah } = require('../src/util');

const router = express.Router();

router.get('/dishes/:id', (req, res) => {
  const db = getDb();
  const dishId = Number(req.params.id);
  const stats = computeStats(db);
  const d = stats.byId.get(dishId);
  if (!d) return res.status(404).json({ error: '菜品不存在' });

  const reviews = db.prepare(`
    SELECT * FROM reviews WHERE dish_id = ? AND status = 'normal' ORDER BY created_at DESC
  `).all(dishId);

  const minefield = assessDish(d, reviews);
  const latest = reviews.slice(0, 5).map(r => ({
    id: r.id, user_display: anonName(r.user_id),
    scores: { taste: r.score_taste, value: r.score_value, portion: r.score_portion },
    comment: r.comment, created_at: r.created_at
  }));

  res.json({
    dish: {
      id: d.id, name: d.name, price: d.price,
      taste_tags: d.taste_tags, diet_tags: d.diet_tags,
      allergens: d.allergens, allergen_status: d.allergen_status,
      listed_at: d.listed_at, is_new: d.is_new
    },
    canteen: { id: d.canteen_id, name: d.canteen_name },
    window: { id: d.window_id, name: d.window_name },
    stats: {
      review_count: d.v,
      avg_overall: d.R != null ? Number(d.R.toFixed(2)) : null,
      weighted_score: Number(d.weighted.toFixed(2))
    },
    minefield: {
      is_minefield: minefield.is_minefield,
      low_ratio: Number(minefield.low_ratio.toFixed(2)),
      reasons: minefield.reasons,
      representatives: minefield.representatives
    },
    notice: minefield.notice,
    reviews: latest
  });
});

// 安全替代：同窗口/同类 confirmed_free 且不含用户过敏原，top3
router.get('/dishes/:id/safe-alternatives', (req, res) => {
  const db = getDb();
  const dishId = Number(req.params.id);
  const profile = profileSvc.getProfile(db, req.query.user_id || 'guest');
  const stats = computeStats(db);
  const cur = stats.byId.get(dishId);
  if (!cur) return res.status(404).json({ error: '菜品不存在' });

  const safe = stats.list.filter(x =>
    x.id !== cur.id &&
    x.allergen_status === 'confirmed_free' &&
    !x.allergens.some(a => profile.allergens.includes(a))
  );
  // 优先同窗口，再按口味同类补足
  const sameWindow = safe.filter(x => x.window_id === cur.window_id);
  const sameTaste = safe.filter(x => x.window_id !== cur.window_id && x.taste_tags.some(t => cur.taste_tags.includes(t)));
  const items = rank([...sameWindow, ...sameTaste], profile).slice(0, 3).map(x => ({
    dish_id: x.id, name: x.name, price: x.price,
    window_name: x.window_name, canteen_name: x.canteen_name,
    weighted_score: Number(x.weighted.toFixed(2)), taste_tags: x.taste_tags
  }));
  res.json({ items });
});

module.exports = router;
