// 排序服务：加权分 + 偏好匹配加分 + 新品加权
const { PREF_BONUS, NEW_BOOST } = require('../../config/thresholds');

// userProfile: { preferences: {taste:[]}, allergens: [], diet_restrictions: [] }
function rankScore(dish, userProfile) {
  let score = dish.weighted;
  // 偏好匹配度：用户口味与菜品 taste_tags 的命中计数，每个 +0.15
  const prefTastes = (userProfile && userProfile.preferences && userProfile.preferences.taste) || [];
  const matches = prefTastes.filter(t => dish.taste_tags.includes(t)).length;
  score += matches * PREF_BONUS;
  // 新品加权 ×1.15
  if (dish.is_new) score *= NEW_BOOST;
  return score;
}

// 排序并返回带 final_score 的列表（降序）
function rank(dishList, userProfile) {
  return dishList
    .map(d => ({ ...d, final_score: rankScore(d, userProfile) }))
    .sort((a, b) => b.final_score - a.final_score);
}

module.exports = { rank, rankScore };
