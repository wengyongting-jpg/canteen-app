// 菜品配图：按菜名关键词映射到食物图（文生图服务按类别生成，同类菜品共用一张）
// 规则按顺序首次命中生效，兜底为家常菜图
(function () {
  const SUFFIX = 'professional food photography, appetizing, soft warm lighting, shallow depth of field, clean composition, high detail food photo';
  const url = p => 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent(p + ', ' + SUFFIX) + '&image_size=square_hd';

  const RULES = [
    // 沙拉轻食
    [/沙拉|牛油果|藜麦/, url('Healthy grilled chicken salad bowl with quinoa, avocado, cherry tomatoes and fresh greens')],
    // 粥品
    [/粥/, url('Warm Chinese rice congee porridge in white ceramic bowl with small side dishes')],
    // 早餐饮品
    [/豆浆|芝麻糊/, url('Hot fresh soy milk and black sesame paste in ceramic bowls, Chinese breakfast drinks')],
    // 部队锅/火锅
    [/部队锅/, url('Korean army stew hotpot bubbling with ramen noodles, sausages, tofu and melted cheese')],
    // 铁板/烤/咖喱/照烧
    [/铁板|照烧|咖喱|烤/, url('Sizzling teppanyaki grilled chicken steak on hot iron plate with black pepper sauce and smoke')],
    // 西式简餐
    [/意面|芝士|奶油|三明治|蛋挞|热狗|薯饼|焗饭|酸奶/, url('Golden cheesy baked rice gratin with melted cheese, creamy western cafe dish')],
    // 麻辣川湘
    [/水煮|麻婆|辣|剁椒|干煸|虎皮|椒麻|口水|鱼香|回锅|酸汤|湘|麻辣/, url('Spicy Sichuan mapo tofu with red chili oil, dried chilies and Sichuan peppercorn')],
    // 面食粉面
    [/面|粉|米线|馄饨/, url('Chinese beef noodle soup in ceramic bowl with braised beef, greens and scallions')],
    // 包点小吃
    [/包|饺|烧麦|锅贴|馍|煎饼|盒子|糯米|饼/, url('Steamed soup dumplings and pan-fried buns in bamboo steamer basket')],
    // 红烧炖煮
    [/红烧|炖|黄焖|焖/, url('Chinese braised pork belly in glossy brown soy sauce over steamed rice')],
    // 烧腊卤味
    [/叉|烧鸭|烧鹅|白切|油鸡|卤|酱鸭|拼盘|猪脚/, url('Cantonese roast duck and char siu pork over rice with glistening glaze')],
    // 盖饭拌饭
    [/饭|炒饭|拌饭/, url('Rice bowl topped with grilled pork chop, fried egg and vegetables, Asian style')],
    // 汤羹
    [/汤/, url('Clear winter melon and pork rib soup in ceramic bowl with goji berries')],
    // 蛋豆腐
    [/蛋|豆腐/, url('Chinese scrambled eggs with tomatoes, home style egg dish')],
    // 时蔬凉菜
    [/凉拌|白菜|菠菜|油麦菜|茄子|土豆|玉米|黄瓜|木耳|海藻|毛豆|豆干|西兰花|韭菜|三鲜|红薯|南瓜/, url('Stir fried green vegetables and smashed cucumber salad, Chinese vegetable dishes')],
    // 水果甜品
    [/水果|杏仁/, url('Fresh cut fruit platter with yogurt and almond tofu dessert cups')]
  ];
  const DEFAULT = url('Chinese homestyle stir fried chicken with mushrooms and peppers over rice');

  window.dishImage = function (name) {
    const s = String(name || '');
    for (const [re, u] of RULES) if (re.test(s)) return u;
    return DEFAULT;
  };
})();
