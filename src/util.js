// 通用小工具：JSON 解析、匿名化、日期处理、异步路由包装
const crypto = require('crypto');

function parseJsonSafe(s, dft) {
  try { const v = JSON.parse(s); return v == null ? dft : v; } catch { return dft; }
}

// 用户展示名统一匿名：同学_xx（不暴露真实 user_id）
function anonName(userId) {
  const h = crypto.createHash('md5').update(String(userId)).digest('hex');
  return '同学_' + (parseInt(h.slice(0, 4), 16) % 90 + 10);
}

// 本地自然日 YYYY-MM-DD（用于每日限 1 条判断）
function localDate(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 是否新品：listed_at 距今 ≤ days 天（按日期判断，无需定时任务）
function isNewDish(listedAt, days) {
  if (!listedAt) return false;
  const t = Date.parse(listedAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= days * 86400e3;
}

// 异步路由包装：捕获 reject 交给 Express 错误中间件
function ah(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { parseJsonSafe, anonName, localDate, isNewDish, ah };
