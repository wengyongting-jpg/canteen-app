// 手写 .env 解析（无第三方依赖）：仅当变量未在环境中定义时才写入
const fs = require('fs');
const path = require('path');

(function load() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (k && !(k in process.env)) process.env[k] = v;
  }
})();
