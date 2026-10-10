// 内容审核服务：敏感词/广告识别 + 用户级发评限流（内存实现）
const { RATE_LIMIT } = require('../../config/thresholds');

// 敏感词表：辱骂/人身攻击类
const SENSITIVE_WORDS = [
  '傻逼', '煞笔', '傻b', '傻比', '白痴', '弱智', '脑残', '智障', '脑瘫',
  '废物', '垃圾人', '去死', '滚蛋', '滚吧', '贱人', '婊子', '畜生', '混蛋',
  '王八蛋', '有病吧', '全家', '狗东西', '低能', '蠢货', '猪狗不如', '该死'
];

// 广告规则：网址 / 手机号 / QQ号 / 微信引流 / 刷单兼职
const AD_PATTERNS = [
  { label: '网址', re: /https?:\/\/|www\.|[a-z0-9-]+\.(com|cn|net|org|top|xyz)/i },
  { label: '手机号', re: /1[3-9]\d{9}/ },
  { label: 'QQ号', re: /qq[号:：\s]*[1-9]\d{4,}/i },
  { label: '微信引流', re: /微信|加v|＋v|\+v|vx|wx|威信/ },
  { label: '刷单兼职', re: /代刷|刷单|刷赞|兼职|接单|优惠群|加群/ }
];

// 文本审核：命中敏感词或广告 → 建议屏蔽
function checkText(text) {
  const t = String(text || '');
  for (const w of SENSITIVE_WORDS) {
    if (t.toLowerCase().includes(w)) return { blocked: true, type: 'sensitive', matched: [w] };
  }
  for (const p of AD_PATTERNS) {
    if (p.re.test(t)) return { blocked: true, type: 'ad', matched: [p.label] };
  }
  return { blocked: false, type: null, matched: [] };
}

// ---- 用户级发评限流（60 秒窗口内最多 MAX_COUNT 条）----
const buckets = new Map();   // user_id -> 时间戳数组
const rateEvents = [];       // 被限流事件（供后台管理查看）

function checkRateLimit(userId, now = Date.now()) {
  const arr = (buckets.get(userId) || []).filter(t => now - t < RATE_LIMIT.WINDOW_MS);
  if (arr.length >= RATE_LIMIT.MAX_COUNT) {
    rateEvents.push({ type: 'rate_limited', user_id: userId, at: new Date(now).toISOString() });
    if (rateEvents.length > 500) rateEvents.shift();
    buckets.set(userId, arr);
    return { limited: true, count: arr.length };
  }
  return { limited: false, count: arr.length };
}

function recordReview(userId, now = Date.now()) {
  const arr = (buckets.get(userId) || []).filter(t => now - t < RATE_LIMIT.WINDOW_MS);
  arr.push(now);
  buckets.set(userId, arr);
}

function getRateEvents() { return rateEvents.slice(-100).reverse(); }

module.exports = { checkText, checkRateLimit, recordReview, getRateEvents, SENSITIVE_WORDS, AD_PATTERNS };
