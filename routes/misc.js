// 个人档案 + 食堂列表 + 健康检查
const express = require('express');
const { getDb } = require('../src/db');
const profileSvc = require('../src/services/profile');
const { ah } = require('../src/util');

const router = express.Router();

router.get('/profile/:user_id', (req, res) => {
  res.json(profileSvc.getProfile(getDb(), req.params.user_id));
});

router.put('/profile/:user_id', ah(async (req, res) => {
  const body = req.body || {};
  const saved = profileSvc.upsertProfile(getDb(), req.params.user_id, body);
  res.json({ ok: true, profile: saved });
}));

router.get('/canteens', (req, res) => {
  const db = getDb();
  const canteens = db.prepare('SELECT * FROM canteens ORDER BY id').all();
  const windows = db.prepare(`
    SELECT w.*, COUNT(d.id) AS dish_count FROM windows w
    LEFT JOIN dishes d ON d.window_id = w.id AND d.is_active = 1
    GROUP BY w.id ORDER BY w.id
  `).all();
  res.json({
    items: canteens.map(c => ({
      id: c.id, name: c.name, location: c.location,
      windows: windows.filter(w => w.canteen_id === c.id)
        .map(w => ({ id: w.id, name: w.name, dish_count: w.dish_count }))
    }))
  });
});

router.get('/health', (req, res) => {
  const db = getDb();
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    canteens: db.prepare('SELECT COUNT(*) n FROM canteens').get().n,
    dishes: db.prepare('SELECT COUNT(*) n FROM dishes WHERE is_active=1').get().n
  });
});

module.exports = router;
