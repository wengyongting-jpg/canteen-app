// 硬过滤服务：过敏原/diet 永不放宽；价格/口味/食堂/窗口无结果时可按档放宽
const { PRICE_RELAX_STEP } = require('../../config/thresholds');

// 安全硬规则：剔除 unconfirmed 与命中用户过敏原(contains)的菜
function passesSafety(dish, userAllergens) {
  if (dish.allergen_status === 'unconfirmed') return false; // 成分未确认一律剔除
  if (dish.allergen_status === 'contains' &&
      dish.allergens.some(a => userAllergens.includes(a))) return false;
  return true;
}

// diet 强制匹配：要求集合里的每个标签都必须出现在 dish.diet_tags
function passesDiet(dish, requiredDiets) {
  return requiredDiets.every(d => dish.diet_tags.includes(d));
}

// 软条件匹配（可放宽的部分）
function matchSoft(dish, cond) {
  if (cond.canteen_id && dish.canteen_id !== cond.canteen_id) return false;
  if (cond.window_id && dish.window_id !== cond.window_id) return false;
  if (cond.min_price != null && dish.price < cond.min_price) return false;
  if (cond.max_price != null && dish.price > cond.max_price) return false;
  if (cond.taste && !dish.taste_tags.includes(cond.taste)) return false;
  if (cond.taste_new && !dish.is_new) return false;
  return true;
}

// 主入口：dishList(computeStats 输出)、cond 结构化条件、profile 用户档案
// cond.allergens（查询中提到的过敏原）与 profile.allergens（用户档案）合并为排除依据
// 返回 { items, relaxed: string[] }
function applyFilters(dishList, cond, profile) {
  const userAllergens = [...new Set([...((profile && profile.allergens) || []), ...(cond.allergens || [])])];
  const requiredDiets = [...(cond.diet ? [cond.diet] : []), ...((profile && profile.diet_restrictions) || [])];

  // 第一步：安全与 diet 硬规则（永不放宽）
  const safe = dishList.filter(d => passesSafety(d, userAllergens) && passesDiet(d, requiredDiets));

  // 第二步：软条件
  let items = safe.filter(d => matchSoft(d, cond));
  const relaxed = [];
  if (items.length > 0) return { items, relaxed };

  // 第三步：按序放宽——价格上调一档 → 忽略口味 → 组合 → 放宽窗口/食堂
  const attempts = [];
  if (cond.max_price != null) attempts.push({
    note: `已将价格上限放宽到 ${cond.max_price + PRICE_RELAX_STEP} 元以内`,
    cond: { ...cond, max_price: cond.max_price + PRICE_RELAX_STEP }
  });
  if (cond.taste) attempts.push({ note: '已忽略口味条件', cond: { ...cond, taste: null } });
  if (cond.max_price != null && cond.taste) attempts.push({
    note: `已将价格上限放宽到 ${cond.max_price + PRICE_RELAX_STEP} 元以内，并忽略口味条件`,
    cond: { ...cond, max_price: cond.max_price + PRICE_RELAX_STEP, taste: null }
  });
  if (cond.window_id) attempts.push({ note: '已放宽窗口范围', cond: { ...cond, window_id: null } });
  if (cond.canteen_id) attempts.push({ note: '已放宽食堂范围', cond: { ...cond, canteen_id: null } });

  for (const at of attempts) {
    const r = safe.filter(d => matchSoft(d, at.cond));
    if (r.length > 0) return { items: r, relaxed: [at.note] };
  }
  // 全部放宽仍无结果：过敏原与 diet 保持不放宽，返回空交由上层兜底
  return { items: [], relaxed };
}

module.exports = { applyFilters, passesSafety, passesDiet };
