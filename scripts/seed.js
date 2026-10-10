// 种子数据：3 食堂 / 15 窗口 / 120 菜 / 约 200 评价，幂等（重复运行先清空重建）
const { getDb } = require('../src/db');

// 固定随机种子，保证每次生成结果一致
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261010);
const pick = arr => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));

// 15 个窗口，每窗口 8 道菜（共 120），price ∈ [5,18]
const CANTEENS = [
  { name: '第一食堂', location: '东区宿舍楼北侧', windows: [
    { name: '大众菜窗口', dishes: [['红烧肉',12],['糖醋里脊',10],['番茄炒蛋',6],['土豆炖牛腩',12],['香菇滑鸡',9],['可乐鸡翅',10],['地三鲜',7],['冬瓜排骨汤',5]] },
    { name: '面食窗口', dishes: [['牛肉拉面',9],['西红柿鸡蛋面',7],['炸酱面',8],['刀削面',9],['鲜肉馄饨',8],['葱油饼',5],['酱香饼',5],['疙瘩汤',6]] },
    { name: '麻辣窗口', dishes: [['麻婆豆腐',7],['辣子鸡丁',11],['水煮肉片',12],['宫保鸡丁',10],['干煸四季豆',8],['麻辣香锅',15],['酸辣土豆丝',5],['虎皮青椒',6]] },
    { name: '轻食窗口', dishes: [['蔬菜沙拉',8],['鸡胸肉沙拉',12],['蒸红薯',5],['水煮蛋',5],['全麦三明治',9],['凉拌黄瓜',5],['清炒西兰花',7],['核桃菠菜',6]] },
    { name: '烧腊窗口', dishes: [['蜜汁叉烧',14],['台式卤肉饭',12],['港式烧鸭',15],['猪脚饭',13],['白切鸡',11],['油鸡饭',10],['卤水拼盘',14],['烧鹅饭',16]] }
  ]},
  { name: '第二食堂', location: '教学楼中区一层', windows: [
    { name: '川湘窗口', dishes: [['回锅肉',11],['鱼香肉丝',9],['尖椒肉丝',8],['剁椒鱼头',16],['湘西外婆菜',7],['麻辣鱼片',12],['水煮鱼',15],['小炒黄牛肉',14]] },
    { name: '家常小炒窗口', dishes: [['青椒肉丝',8],['韭菜炒蛋',6],['木须肉',9],['蒜蓉油麦菜',6],['醋溜白菜',5],['肉末茄子',8],['松仁玉米',7],['尖椒土豆片',6]] },
    { name: '面点窗口', dishes: [['小笼包',6],['生煎包',7],['锅贴',7],['烧麦',6],['肉夹馍',8],['煎饼果子',6],['糯米鸡',5],['奶黄包',5]] },
    { name: '西式简餐窗口', dishes: [['芝士焗饭',15],['奶油蘑菇汤',9],['黑椒牛柳意面',15],['葡式蛋挞',6],['芝士热狗棒',8],['火腿芝士三明治',11],['香煎薯饼',6],['玉米浓汤',7]] },
    { name: '铁板窗口', dishes: [['铁板鱿鱼',15],['铁板鸡排',12],['铁板牛柳',16],['香辣虾',14],['照烧鸡排饭',13],['咖喱鸡排饭',12],['黑椒猪排饭',13],['奥尔良烤翅',10]] }
  ]},
  { name: '第三食堂', location: '西区操场东侧', windows: [
    { name: '风味窗口', dishes: [['黄焖鸡米饭',13],['螺蛳粉',11],['桂林米粉',10],['砂锅米线',11],['石锅拌饭',14],['部队锅',16],['酸汤肥牛',15],['泡菜炒饭',9]] },
    { name: '粥粉窗口', dishes: [['皮蛋瘦肉粥',6],['南瓜粥',5],['小米粥',5],['茶叶蛋',5],['红豆粥',5],['八宝粥',5],['肠粉',7],['鱼片粥',8]] },
    { name: '卤味窗口', dishes: [['卤鸡腿',7],['卤牛肉',15],['凉拌木耳',6],['口水鸡',12],['椒麻鸡',12],['卤豆干',5],['凉拌毛豆',5],['酱鸭',13]] },
    { name: '沙拉轻食窗口', dishes: [['藜麦鸡胸沙拉',14],['玉米杯',6],['无糖酸奶',6],['水果拼盘',8],['荞麦冷面',9],['冬瓜汤',5],['凉拌海藻',7],['牛油果沙拉',13]] },
    { name: '早餐窗口', dishes: [['现磨豆浆',5],['热干面',7],['韭菜盒子',5],['南瓜饼',5],['黑芝麻糊',5],['杏仁豆腐',5],['鲜肉包',6],['白粥',5]] }
  ]}
];

// 新品名单（listed_at 距今 ≤14 天），共 15 道
const NEW_DISH_NAMES = new Set(['奥尔良烤翅','芝士热狗棒','藜麦鸡胸沙拉','酸汤肥牛','泡菜炒饭','牛油果沙拉','芝士焗饭','部队锅','铁板鸡排','玉米杯','无糖酸奶','水果拼盘','麻辣鱼片','湘西外婆菜','杏仁豆腐']);

// 口味标签推断
function guessTaste(name) {
  if (/麻辣/.test(name)) return ['麻辣', '辣'];
  if (/麻婆|辣子|水煮|剁椒|虎皮|干煸|香辣|口水|椒麻|酸辣|尖椒|回锅|泡菜|湘|辣/.test(name)) return ['辣'];
  if (/糖醋|醋溜|番茄|西红柿/.test(name)) return ['酸甜'];
  if (/粥|汤|蒸|白切|沙拉|蔬菜|豆浆|豆腐|凉|豆腐/.test(name)) return ['清淡'];
  if (/面|饭|卤|烧|包|饼|饺|馄饨|锅贴|鸡|鸭|肉/.test(name)) return ['咸香'];
  return ['鲜香'];
}

// 饮食标签（素食/清真/低卡）
const VEGETARIAN = new Set(['蔬菜沙拉','蒸红薯','凉拌黄瓜','清炒西兰花','核桃菠菜','酸辣土豆丝','虎皮青椒','醋溜白菜','蒜蓉油麦菜','松仁玉米','尖椒土豆片','凉拌木耳','凉拌毛豆','卤豆干','凉拌海藻','玉米杯','水果拼盘','白粥','小米粥','南瓜粥','红豆粥','八宝粥','黑芝麻糊','现磨豆浆','南瓜饼','冬瓜汤','杏仁豆腐','麻婆豆腐','番茄炒蛋','地三鲜']);
const HALAL = new Set(['卤牛肉','小炒黄牛肉','土豆炖牛腩']);
const LOWCAL = new Set(['鸡胸肉沙拉','藜麦鸡胸沙拉','蔬菜沙拉','凉拌黄瓜','清炒西兰花','蒸红薯','水煮蛋','冬瓜汤','凉拌海藻','玉米杯']);

// 过敏原推断（按菜名关键词）
function guessAllergens(name) {
  const a = [];
  if (!/鱼香/.test(name) && /虾|鱿鱼|鱼|海鲜|蟹/.test(name)) a.push('海鲜');
  if (/芝士|奶油|奶黄|酸奶|蛋挞/.test(name)) a.push('乳制品');
  if (/核桃|腰果|松仁|花生|杏仁/.test(name)) a.push('坚果');
  if (/宫保|鱼香|麻辣香锅/.test(name)) a.push('花生');
  if (!/荞麦/.test(name) && /面|饼|包|饺|馍|三明治|烧麦|锅贴|蛋挞|意面|冷面|热干面|疙瘩|馄饨|热狗/.test(name)) a.push('麸质');
  return [...new Set(a)];
}

// 成分未确认名单（allergens 为空但状态 unconfirmed）
const UNCONFIRMED = new Set(['香菇滑鸡','可乐鸡翅','油鸡饭','玉米浓汤','肠粉','泡菜炒饭','糯米鸡','卤豆干']);

// 评价文案池（校园口吻，短评 ≤200 字）
const GOOD_COMMENTS = ['分量足，味道很正','阿姨手不抖，肉给得多','辣得过瘾，特别下饭','汤底浓郁，面条很劲道','性价比超高，一周吃三次','现炒出锅，热乎乎的','鸡肉很嫩，米饭管够','出餐快，味道一直很稳','清淡不油腻，减脂友好','今天多给了一勺菜，开心','汤很鲜，连汤都喝完了','皮脆肉嫩，绝了','素菜做得很入味','咸淡刚好，像家里的味道','热乎又实惠，强烈推荐','面汤喝到底，酣畅淋漓'];
const BAD_COMMENTS = ['分量少一半，男生根本吃不饱','咸到发苦，喝了三瓶水','等了40分钟才端上来，面都坨了','油多得吓人，吃完胃里烧得慌','是凉的，感觉像剩菜加热的','全是肥肉，瘦的没几块','涨价了两块还减了量','汤跟白开水一样，没味道','米饭夹生，菜叶也蔫了','就三块肉，剩下全是土豆','今天吃出一根头发，无语','齁咸，晚上狂喝水','排队太久，差点迟到','有点腥，没处理干净','糊了，发苦','给的量越来越少，不值这个价'];
const MID_COMMENTS = ['中规中矩，偶尔吃吃','还行，不难吃','一般般，凑合','味道可以，量一般','时好时坏，看阿姨心情'];

// 评价分布计划：好评窗口 2 个 / 踩雷菜 3 个 / 弱窗口 1 个 / 中等 / 零评价
const GOOD_WINDOW_PLAN = {
  '川湘窗口': { '回锅肉': 10, '鱼香肉丝': 8, '尖椒肉丝': 5, '剁椒鱼头': 4, '湘西外婆菜': 3, '麻辣鱼片': 2, '水煮鱼': 2, '小炒黄牛肉': 2 },
  '面食窗口': { '牛肉拉面': 8, '西红柿鸡蛋面': 6, '炸酱面': 5, '刀削面': 4, '鲜肉馄饨': 3, '葱油饼': 2, '酱香饼': 1, '疙瘩汤': 1 }
};
const BAD_DISH_PLAN = { '麻婆豆腐': 6, '地三鲜': 6, '铁板鱿鱼': 6 };
const WEAK_WINDOW_PLAN = { '黄焖鸡米饭': 4, '部队锅': 4, '砂锅米线': 4, '石锅拌饭': 4 };
const ZERO_REVIEW_NAMES = new Set(['蔬菜沙拉','水煮蛋','卤水拼盘','烧鹅饭','木须肉','蒜蓉油麦菜','小笼包','黑椒牛柳意面','桂林米粉','卤鸡腿','凉拌海藻','现磨豆浆','南瓜饼','玉米杯','无糖酸奶','水果拼盘','蜜汁叉烧','肉末茄子']);
// 中等热度：其余菜随机 0-3 条，凑总评价数约 200

function makeScores(kind) {
  if (kind === 'good') { const b = rand() < 0.8 ? 5 : 4; return [b, b, rand() < 0.5 ? b : Math.max(3, b - 1)]; }
  if (kind === 'bad') { const b = rand() < 0.75 ? 1 : 2; return [b, b, rand() < 0.5 ? b : b + 1]; }
  const b = randInt(3, 4); return [b, b, randInt(3, b + 1)];
}

function main() {
  const db = getDb();
  // 幂等：先清空重建
  db.exec('DELETE FROM reviews; DELETE FROM dishes; DELETE FROM windows; DELETE FROM canteens; DELETE FROM users;');

  const insCanteen = db.prepare('INSERT INTO canteens (id, name, location) VALUES (?, ?, ?)');
  const insWindow = db.prepare('INSERT INTO windows (id, canteen_id, name) VALUES (?, ?, ?)');
  const insDish = db.prepare('INSERT INTO dishes (id, window_id, name, price, taste_tags, allergens, allergen_status, diet_tags, listed_at, is_active, is_synthetic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)');
  const insReview = db.prepare('INSERT INTO reviews (dish_id, user_id, score_taste, score_value, score_portion, comment, created_at, status, is_synthetic) VALUES (?, ?, ?, ?, ?, ?, ?, \'normal\', 1)');
  const insUser = db.prepare('INSERT INTO users (id, preferences, allergens, diet_restrictions) VALUES (?, ?, ?, ?)');

  let cid = 0, wid = 0, did = 0;
  const dishByName = new Map();     // 菜名 → {id, window_id, window_name, canteen_name}
  const dishWindow = new Map();     // 菜 id → window_name

  const now = Date.now();
  for (const c of CANTEENS) {
    cid += 1; insCanteen.run(cid, c.name, c.location);
    for (const w of c.windows) {
      wid += 1; insWindow.run(wid, cid, w.name);
      for (const [name, price] of w.dishes) {
        did += 1;
        const taste = guessTaste(name);
        const allergens = guessAllergens(name);
        const status = allergens.length ? 'contains' : (UNCONFIRMED.has(name) ? 'unconfirmed' : 'confirmed_free');
        const diet = [
          ...(VEGETARIAN.has(name) ? ['素食'] : []),
          ...(HALAL.has(name) ? ['清真'] : []),
          ...(LOWCAL.has(name) ? ['低卡'] : [])
        ];
        const isNew = NEW_DISH_NAMES.has(name);
        const daysAgo = isNew ? randInt(0, 13) : randInt(30, 300);
        const listedAt = new Date(now - daysAgo * 86400e3).toISOString().slice(0, 10);
        insDish.run(did, wid, name, price, JSON.stringify(taste), JSON.stringify(allergens), status, JSON.stringify(diet), listedAt);
        dishByName.set(name, { id: did, window_id: wid, window_name: w.name, canteen_name: c.name });
      }
    }
  }

  // 用户：1 个默认 profile 用户 + 30 个评价用合成用户
  insUser.run('u_default', JSON.stringify({ taste: ['辣', '鲜香'] }), '[]', '[]');
  for (let i = 1; i <= 30; i++) {
    insUser.run('u_synth_' + i, JSON.stringify({ taste: [pick(['辣', '清淡', '咸香', '鲜香', '酸甜'])] }), '[]', '[]');
  }

  const synthUsers = Array.from({ length: 30 }, (_, i) => 'u_synth_' + (i + 1));
  const daysAgoIso = d => new Date(now - d * 86400e3 - randInt(0, 20) * 3600e3).toISOString();

  let reviewCount = 0;
  function addReviews(dishName, kind, count) {
    const d = dishByName.get(dishName);
    if (!d) return 0;
    for (let i = 0; i < count; i++) {
      const [t, v, p] = makeScores(kind);
      const comment = kind === 'good' ? pick(GOOD_COMMENTS) : kind === 'bad' ? pick(BAD_COMMENTS) : pick(MID_COMMENTS);
      insReview.run(d.id, pick(synthUsers), t, v, p, comment, daysAgoIso(randInt(1, 60)));
      reviewCount += 1;
    }
    return count;
  }

  // 好评窗口（均分 4.5+、评价数 15+）
  for (const [winName, plan] of Object.entries(GOOD_WINDOW_PLAN)) {
    for (const [dishName, n] of Object.entries(plan)) addReviews(dishName, 'good', n);
  }
  // 踩雷菜（均分 <2.8、1-2 星占比 >50%）
  for (const [dishName, n] of Object.entries(BAD_DISH_PLAN)) addReviews(dishName, 'bad', n);
  // 弱窗口（整体低分）
  for (const [dishName, n] of Object.entries(WEAK_WINDOW_PLAN)) addReviews(dishName, 'bad', n);
  // 中等热度：非零评价名单、非重点计划的菜，每个 1-2 条
  let medium = 0;
  for (const [name, info] of dishByName) {
    if (ZERO_REVIEW_NAMES.has(name)) continue;
    if (GOOD_WINDOW_PLAN[info.window_name] && GOOD_WINDOW_PLAN[info.window_name][name]) continue;
    if (BAD_DISH_PLAN[name] || WEAK_WINDOW_PLAN[name]) continue;
    medium += addReviews(name, rand() < 0.5 ? 'mid' : 'good', randInt(1, 2));
  }

  // ---- 统计输出 ----
  const totalReviews = db.prepare('SELECT COUNT(*) n FROM reviews').get().n;
  const totalDishes = db.prepare('SELECT COUNT(*) n FROM dishes').get().n;
  const zeroReview = db.prepare(`
    SELECT COUNT(*) n FROM dishes d WHERE NOT EXISTS
      (SELECT 1 FROM reviews r WHERE r.dish_id = d.id AND r.status = 'normal')
  `).get().n;
  const newCount = db.prepare(`
    SELECT COUNT(*) n FROM dishes WHERE is_active = 1 AND listed_at >= date('now', '-14 days')
  `).get().n;
  const counts = db.prepare(`
    SELECT allergen_status, COUNT(*) n FROM dishes GROUP BY allergen_status
  `).all();
  const lowRatio = db.prepare(`
    SELECT COUNT(*) n FROM reviews WHERE status='normal' AND (score_taste+score_value+score_portion)/3.0 <= 2.5
  `).get().n;
  const windowsAvg = db.prepare(`
    SELECT w.name, c.name canteen, COUNT(r.id) rc, AVG((r.score_taste+r.score_value+r.score_portion)/3.0) avg
    FROM windows w JOIN canteens c ON c.id=w.canteen_id
    JOIN dishes d ON d.window_id=w.id JOIN reviews r ON r.dish_id=d.id AND r.status='normal'
    GROUP BY w.id HAVING rc >= 10 ORDER BY avg DESC
  `).all();

  console.log('=== 种子数据生成完成（幂等重建） ===');
  console.log(`食堂: ${db.prepare('SELECT COUNT(*) n FROM canteens').get().n} | 窗口: ${db.prepare('SELECT COUNT(*) n FROM windows').get().n} | 菜品: ${totalDishes} | 评价: ${totalReviews} | 用户: ${db.prepare('SELECT COUNT(*) n FROM users').get().n}`);
  console.log(`新品(≤14天): ${newCount} | 0 评价菜: ${zeroReview} | 低分(1-2星)评价: ${lowRatio}`);
  for (const c of counts) console.log(`  allergen_status=${c.status || c.allergen_status}: ${c.n}`);
  console.log('窗口口碑样本:');
  for (const w of windowsAvg) console.log(`  ${w.canteen}-${w.name}: ${w.rc} 条评价, 均分 ${Number(w.avg).toFixed(2)}`);
  console.log(`踩雷样本: ${Object.entries(BAD_DISH_PLAN).map(([k, v]) => `${k}(${v}条)`).join(', ')} + 弱窗口: 风味窗口`);
  console.log(`好评分: ${totalReviews - medium - Object.values(BAD_DISH_PLAN).reduce((a, b) => a + b, 0) - Object.values(WEAK_WINDOW_PLAN).reduce((a, b) => a + b, 0)} | 中等: ${medium}`);
}

main();
