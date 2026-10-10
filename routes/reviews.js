// F2 评价：校验 → 限流 → 每日 1 条 → 审核 → 入库
const express = require('express');
const { getDb } = require('../src/db');
const { checkText, checkRateLimit, recordReview } = require('../src/services/moderation');
const { localDate, anonName, ah } = require('../src/util');

const router = express.Router();

router.post('/dishes/:id/reviews', ah(async (req, res) => {
  const db = getDb();
  const dishId = Number(req.params.id);
  const dish = db.prepare('SELECT id FROM dishes WHERE id = ? AND is_active = 1').get(dishId);
  if (!dish) return res.status(404).json({ error: '菜品不存在' });

  const { user_id, score_taste, score_value, score_portion, comment = '' } = req.body || {};
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  // 三项评分必须为 1-5 整数
  for (const s of [score_taste, score_value, score_portion]) {
    if (!Number.isInteger(s) || s < 1 || s > 5) {
      return res.status(400).json({ error: '评分必须为 1-5 的整数' });
    }
  }
  const text = String(comment || '');
  if (text.length > 200) return res.status(400).json({ error: '短评不能超过 200 字' });

  // 用户级限流：60 秒内超过 3 条 → 429
  const rl = checkRateLimit(user_id);
  if (rl.limited) return res.status(429).json({ error: '操作太频繁，请稍后再试' });

  // 同一用户对同一菜每自然天 1 条
  const today = localDate();
  const prev = db.prepare('SELECT created_at FROM reviews WHERE user_id = ? AND dish_id = ?').all(user_id, dishId);
  if (prev.some(r => localDate(new Date(r.created_at)) === today)) {
    return res.status(409).json({ error: '今天已经评价过这道菜啦，明天再来吧' });
  }

  // 审核：命中敏感词/广告 → 仍入库但 blocked（后台可见）
  const mod = checkText(text);
  const status = mod.blocked ? 'blocked' : 'normal';

  const info = db.prepare(`
    INSERT INTO reviews (dish_id, user_id, score_taste, score_value, score_portion, comment, created_at, status, is_synthetic)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(dishId, String(user_id), score_taste, score_value, score_portion, text, new Date().toISOString(), status);

  recordReview(user_id); // 仅成功入库后计数
  res.status(201).json({
    id: info.lastInsertRowid,
    status,
    message: status === 'blocked' ? '评价已提交，但包含违规内容，进入后台审核' : '评价成功，感谢分享'
  });
}));

// 某菜评价列表（匿名展示，供前端刷新）
router.get('/dishes/:id/reviews', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, user_id, score_taste, score_value, score_portion, comment, created_at, status
    FROM reviews WHERE dish_id = ? AND status = 'normal'
    ORDER BY created_at DESC LIMIT 20
  `).all(Number(req.params.id));
  res.json({
    items: rows.map(r => ({
      id: r.id,
      user_display: anonName(r.user_id),
      scores: { taste: r.score_taste, value: r.score_value, portion: r.score_portion },
      comment: r.comment,
      created_at: r.created_at
    }))
  });
});

module.exports = router;
