// 后台管理：token 保护，查看被标记评价 + block/unblock/delete
const express = require('express');
const { getDb } = require('../src/db');
const { getRateEvents } = require('../src/services/moderation');

const router = express.Router();

function adminToken() { return process.env.ADMIN_TOKEN || 'change-me'; }

function requireAdmin(req, res, next) {
  const t = req.get('x-admin-token') || req.query.token;
  if (!t || t !== adminToken()) return res.status(401).json({ error: '无效的管理员令牌' });
  next();
}

// 被限流/屏蔽列表（含 is_synthetic 标记，仅后台可见）
router.get('/admin/flagged', requireAdmin, (req, res) => {
  const db = getDb();
  const blocked = db.prepare(`
    SELECT r.id, r.dish_id, d.name AS dish_name, r.user_id, r.comment,
           r.created_at, r.status, r.is_synthetic
    FROM reviews r JOIN dishes d ON d.id = r.dish_id
    WHERE r.status = 'blocked'
    ORDER BY r.created_at DESC LIMIT 100
  `).all();
  res.json({
    blocked_reviews: blocked.map(r => ({
      id: r.id, dish_id: r.dish_id, dish_name: r.dish_name,
      user_display: '同学_' + String(r.id).padStart(2, '0'),
      comment: r.comment, created_at: r.created_at,
      status: r.status, is_synthetic: !!r.is_synthetic
    })),
    rate_limited: getRateEvents()
  });
});

router.post('/admin/reviews/:id/block', requireAdmin, (req, res) => {
  const info = getDb().prepare("UPDATE reviews SET status = 'blocked' WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true, changed: info.changes });
});

router.post('/admin/reviews/:id/unblock', requireAdmin, (req, res) => {
  const info = getDb().prepare("UPDATE reviews SET status = 'normal' WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true, changed: info.changes });
});

router.post('/admin/reviews/:id/delete', requireAdmin, (req, res) => {
  const info = getDb().prepare('DELETE FROM reviews WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true, changed: info.changes });
});

module.exports = router;
