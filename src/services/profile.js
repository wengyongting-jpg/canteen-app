// 用户档案：preferences{taste[]}/allergens[]/diet_restrictions[]，无登录体系，user_id 即设备标识
const { parseJsonSafe } = require('../util');

function getProfile(db, userId) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(String(userId || 'guest'));
  if (!row) return { id: String(userId || 'guest'), preferences: { taste: [] }, allergens: [], diet_restrictions: [] };
  return {
    id: row.id,
    preferences: parseJsonSafe(row.preferences, { taste: [] }),
    allergens: parseJsonSafe(row.allergens, []),
    diet_restrictions: parseJsonSafe(row.diet_restrictions, [])
  };
}

function upsertProfile(db, userId, data) {
  const cur = getProfile(db, userId);
  const next = {
    preferences: {
      taste: Array.isArray(data.preferences && data.preferences.taste)
        ? data.preferences.taste.filter(x => typeof x === 'string').slice(0, 20)
        : cur.preferences.taste
    },
    allergens: Array.isArray(data.allergens) ? data.allergens.filter(x => typeof x === 'string').slice(0, 20) : cur.allergens,
    diet_restrictions: Array.isArray(data.diet_restrictions) ? data.diet_restrictions.filter(x => typeof x === 'string').slice(0, 20) : cur.diet_restrictions
  };
  db.prepare(`
    INSERT INTO users (id, preferences, allergens, diet_restrictions) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET preferences = excluded.preferences,
      allergens = excluded.allergens, diet_restrictions = excluded.diet_restrictions
  `).run(String(userId), JSON.stringify(next.preferences), JSON.stringify(next.allergens), JSON.stringify(next.diet_restrictions));
  return next;
}

module.exports = { getProfile, upsertProfile };
