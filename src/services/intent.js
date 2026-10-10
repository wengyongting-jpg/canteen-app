// 意图解析：LLM 优先，失败/无 Key 时关键词兜底；无论来源都返回 parsed
const llm = require('./llm');
const { parseJsonSafe } = require('../util');

// 关键词兜底解析：便宜/数字块/口味词/素食清真/新品/过敏原提及/食堂窗口名匹配
function keywordParse(query, db) {
  const q = String(query || '');
  const cond = { taste_new: false, allergens: [] };

  // 价格：X 块/元 以内|以下|以内；X 块/元 以上；便宜 → 默认 8 元
  let m = q.match(/(\d+(?:\.\d+)?)\s*(?:块|元)\s*(?:钱)?\s*(?:以内|以下|之内)/) || q.match(/(?:不超过|不超过了|低于)\s*(\d+(?:\.\d+)?)/);
  if (m) cond.max_price = Number(m[1]);
  m = q.match(/(\d+(?:\.\d+)?)\s*(?:块|元)\s*(?:钱)?\s*(?:以上|往上)/);
  if (m) cond.min_price = Number(m[1]);
  if (/便宜|实惠|经济|划算/.test(q) && cond.max_price == null) cond.max_price = 8;

  // 口味（否定表达优先：「不辣」是排除辣，不能命中下面的 /辣/）
  if (/不辣|不要辣|别太辣|不能吃辣|忌辣/.test(q)) cond.taste = '清淡';
  else if (/麻辣/.test(q)) cond.taste = '麻辣';
  else if (/辣/.test(q)) cond.taste = '辣';
  else if (/清淡/.test(q)) cond.taste = '清淡';
  else if (/酸甜|糖醋/.test(q)) cond.taste = '酸甜';
  else if (/咸香/.test(q)) cond.taste = '咸香';
  else if (/鲜/.test(q)) cond.taste = '鲜香';

  // 饮食限制 / 新品
  if (/素食|素菜|吃素|不要肉|没肉/.test(q)) cond.diet = '素食';
  else if (/清真/.test(q)) cond.diet = '清真';
  if (/新品|新菜|尝新|尝鲜|新上|上新/.test(q)) cond.taste_new = true;

  // 过敏原提及：无论「含X」还是「不要X」，安全优先一律转为排除条件
  const ALLERGEN_WORDS = { '花生': '花生', '海鲜': '海鲜', '虾': '海鲜', '蟹': '海鲜', '鱼': '海鲜', '乳': '乳制品', '牛奶': '乳制品', '奶': '乳制品', '坚果': '坚果', '麸质': '麸质', '面筋': '麸质' };
  for (const [w, norm] of Object.entries(ALLERGEN_WORDS)) {
    if (q.includes(w) && !cond.allergens.includes(norm)) cond.allergens.push(norm);
  }

  // 食堂/窗口匹配：提到「X食堂」但库里不存在 → invalid_canteen，触发兜底
  const canteens = db.prepare('SELECT id, name FROM canteens').all();
  const windows = db.prepare('SELECT id, name, canteen_id FROM windows').all();
  const canteenMention = q.match(/[\u4e00-\u9fa5]{0,2}[\u4e00-\u9fa5]+食堂/);
  if (canteenMention) {
    const hit = canteens.find(c => canteenMention[0].includes(c.name) || c.name.includes(canteenMention[0]));
    if (hit) cond.canteen_id = hit.id;
    else cond.invalid_canteen = canteenMention[0];
  }
  const win = windows.find(w => w.name && q.includes(w.name));
  if (win) { cond.window_id = win.id; if (!cond.canteen_id) cond.canteen_id = win.canteen_id; }

  // 纯找菜名查询：没解析出任何条件时，剥离口语填充词，若剩余核心词不是库内菜品/窗口 → 触发兜底
  const hasCond = cond.canteen_id != null || cond.window_id != null || cond.max_price != null ||
    cond.min_price != null || cond.taste || cond.diet || cond.taste_new ||
    (cond.allergens && cond.allergens.length > 0) || cond.invalid_canteen;
  if (!hasCond) {
    const core = q
      .replace(/我想|我想要|推荐|来点|来个|来份|给点|给个|找一个|找个|找|想吃|想|吃点|吃|点个|点|有什么|有啥|有没有|哪个|什么|啥|帮忙|请问|一下|现在|今天|中午|晚上|饿|好吃|好喝|随便|热门|人气|招牌|特色|管饱|饭点|几个|一些|一个|东西|的|了|吗|呢|吧|呀|啊/g, '')
      .replace(/[喝吃来]$/, '')
      .trim();
    // 类别词=泛需求，正常走推荐，不触发兜底
    const CATEGORY_SET = ['汤', '面', '饭', '粥', '粉', '面条', '米饭', '米粉', '主食', '晚饭', '午饭', '早餐', '晚餐', '夜宵', '下饭菜', '下饭', '荤菜', '素菜', '热菜', '凉菜', '汤羹', '小炒', '炒菜', '食堂', '饭菜'];
    const isCategory = core.length < 2 || CATEGORY_SET.includes(core);
    if (!isCategory && core.length <= 8) {
      const dishHit = db.prepare('SELECT name FROM dishes WHERE is_active=1').all()
        .some(d => d.name.includes(core) || core.includes(d.name));
      const winHit = windows.some(w => w.name && (w.name.includes(core) || core.includes(w.name)));
      if (!dishHit && !winHit) cond.invalid_dish = core;
    }
  }

  return cond;
}

// LLM 意图解析：喂入食堂/窗口/标签词表，要求输出结构化 JSON
async function llmParse(query, db) {
  const canteens = db.prepare('SELECT id, name FROM canteens').all();
  const windows = db.prepare('SELECT id, name, canteen_id FROM windows').all();
  const dishNames = db.prepare('SELECT name FROM dishes WHERE is_active=1').all().map(d => d.name);
  const out = await llm.chat([
    { role: 'system', content: llm.SYSTEM_GUARD },
    { role: 'user', content: `任务：把学生的找菜需求解析为结构化查询条件。

食堂列表: ${JSON.stringify(canteens)}
窗口列表: ${JSON.stringify(windows)}
菜品列表（节选）: ${JSON.stringify(dishNames.slice(0, 60))}
口味标签: ["辣","清淡","咸香","酸甜","麻辣","鲜香"]
饮食标签: ["素食","清真","低卡"]
过敏原词表: ["花生","海鲜","乳制品","坚果","麸质"]

用户查询: ${JSON.stringify(String(query))}

输出 JSON（无对应信息填 null，taste_new 无则为 false）:
{"canteen_id": 数字或null, "window_id": 数字或null, "max_price": 数字或null, "min_price": 数字或null, "taste": 字符串或null, "diet": 字符串或null, "taste_new": 布尔, "allergens": [字符串数组], "canteen_matched": 布尔, "dish_matched": 布尔}

规则：查询提到的食堂不在列表中则 canteen_matched=false 且 canteen_id=null；查询是明确找一个具体菜品名但菜品列表中没有 → dish_matched=false；用户提到过敏原或表示不想吃某种东西（含"含X的菜"，X 为过敏原，安全优先）→ 放入 allergens；"8块以下"→ max_price=8，"8块钱以上"→ min_price=8；"便宜"→ max_price=8；"不辣/不要辣"→ taste="清淡"。` }
  ]);
  const c = out || {};
  const num = v => (v == null || v === '' || Number.isNaN(Number(v))) ? null : Number(v);
  return {
    canteen_id: num(c.canteen_id),
    window_id: num(c.window_id),
    max_price: num(c.max_price),
    min_price: num(c.min_price),
    taste: typeof c.taste === 'string' && c.taste !== 'null' ? c.taste : null,
    diet: typeof c.diet === 'string' && c.diet !== 'null' ? c.diet : null,
    taste_new: !!c.taste_new,
    allergens: Array.isArray(c.allergens) ? c.allergens.filter(x => typeof x === 'string') : [],
    canteen_matched: c.canteen_matched !== false,
    dish_matched: c.dish_matched !== false,
    source: 'llm'
  };
}

// 合并策略：关键词兜底打底，LLM 非空字段覆盖，请求 filters 优先级最高
async function parseIntent(query, filters, db) {
  const fallback = keywordParse(query, db);
  let parsed = { ...fallback, source: 'keyword' };
  if (llm.isAvailable()) {
    try {
      const lp = await llmParse(query, db);
      const merged = { ...parsed };
      for (const k of ['canteen_id', 'window_id', 'max_price', 'min_price', 'taste', 'diet']) {
        if (lp[k] != null) merged[k] = lp[k];
      }
      merged.taste_new = lp.taste_new || parsed.taste_new;
      merged.allergens = [...new Set([...(lp.allergens || []), ...(parsed.allergens || [])])];
      // LLM 明确说食堂没匹配上 → 标记无效食堂触发兜底
      if (lp.canteen_matched === false && merged.canteen_id == null && !merged.invalid_canteen) {
        merged.invalid_canteen = String(query).slice(0, 20);
      }
      if (parsed.invalid_canteen && lp.canteen_id != null) delete merged.invalid_canteen;
      // LLM 认为是找库中不存在的具体菜名，且没解析出其他条件 → 兜底
      const lpHasCond = lp.canteen_id != null || lp.window_id != null || lp.max_price != null ||
        lp.min_price != null || lp.taste || lp.diet || lp.taste_new || (lp.allergens || []).length > 0;
      if (lp.dish_matched === false && !lpHasCond && !merged.invalid_canteen && !merged.invalid_dish) {
        merged.invalid_dish = String(query).slice(0, 20);
      }
      if (parsed.invalid_dish && lpHasCond) delete merged.invalid_dish;
      merged.source = 'llm';
      parsed = merged;
    } catch { /* LLM 失败静默降级到关键词结果 */ }
  }
  // 显式 filters 优先
  if (filters && typeof filters === 'object') {
    for (const k of ['canteen_id', 'window_id', 'max_price', 'min_price', 'taste', 'diet']) {
      if (filters[k] != null) parsed[k] = filters[k];
    }
    if (filters.allergens) parsed.allergens = [...new Set([...(parsed.allergens || []), ...filters.allergens])];
    if (filters.taste_new != null) parsed.taste_new = !!filters.taste_new;
  }
  return parsed;
}

module.exports = { parseIntent, keywordParse };
