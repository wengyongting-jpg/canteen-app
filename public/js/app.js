// 公共封装：user_id、fetch、匿名渲染、弹层、toast
(function () {
  const KEY = 'canteen_user_id';

  window.getUserId = function () {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : 'u_' + Date.now() + Math.random().toString(36).slice(2, 10));
      localStorage.setItem(KEY, id);
    }
    return id;
  };

  window.api = async function (path, opts = {}) {
    const res = await fetch('/api' + path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch { /* 空 body */ }
    return { ok: res.ok, status: res.status, data: data || {} };
  };

  window.escapeHtml = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  // 星星显示（只读）
  window.starsHtml = function (n) {
    const full = Math.round(n);
    let s = '';
    for (let i = 1; i <= 5; i++) s += `<span class="${i <= full ? '' : 'off'}">★</span>`;
    return `<span class="stars">${s}</span>`;
  };

  // 过敏原状态标记：contains 红 / unconfirmed 灰 / confirmed_free 仅「成分已确认」
  window.allergenBadge = function (status) {
    if (status === 'contains') return '<span class="tag allergen-red">含过敏原</span>';
    if (status === 'unconfirmed') return '<span class="tag allergen-gray">成分未确认</span>';
    return '<span class="tag allergen-ok">成分已确认</span>';
  };

  window.toast = function (msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.display = 'none'; }, 2200);
  };

  // 通用弹层：显示评价原文 / 摘要引用
  window.showDialog = function (title, html) {
    let d = document.getElementById('common-dialog');
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'common-dialog';
      d.innerHTML = '<h3 id="cd-title"></h3><div id="cd-body"></div><button class="btn-primary close" onclick="this.closest(\'dialog\').close()">关闭</button>';
      document.body.appendChild(d);
    }
    d.querySelector('#cd-title').textContent = title;
    d.querySelector('#cd-body').innerHTML = html;
    d.showModal();
  };

  // 底部 Tab 注入（active: home/rank/me）
  window.renderTabbar = function (active) {
    const bar = document.createElement('nav');
    bar.className = 'tabbar';
    bar.innerHTML = `
      <a href="index.html" class="${active === 'home' ? 'active' : ''}"><span class="ic"></span>首页</a>
      <a href="index.html#rankings" class="${active === 'rank' ? 'active' : ''}"><span class="ic"></span>榜单</a>
      <a href="profile.html" class="${active === 'me' ? 'active' : ''}"><span class="ic"></span>我的</a>`;
    document.body.appendChild(bar);
  };

  // 菜品行渲染（榜单/推荐通用）
  window.dishRowHtml = function (d, opts = {}) {
    const price = d.price != null ? `¥${d.price}` : '';
    const where = [d.canteen_name, d.window_name].filter(Boolean).join(' · ');
    const score = d.weighted_score != null ? `<span class="score-badge ${opts.bad ? 'bad' : ''}">${Number(d.weighted_score).toFixed(1)}分</span>` : '';
    const extra = d.pending_reviews ? '<span class="tag">评价较少</span>' : '';
    const reason = opts.reason ? `<div class="dish-meta">${escapeHtml(opts.reason)}</div>` : '';
    return `
      <div class="dish-row click" onclick="location.href='detail.html?id=${d.dish_id}'">
        <img class="dish-thumb" src="${dishImage(d.name)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
        <div style="flex:1;min-width:0">
          <div class="dish-name">${escapeHtml(d.name)} ${d.is_new ? '<span class="tag new">新品</span>' : ''} ${extra}</div>
          <div class="dish-meta">${escapeHtml(where)}${d.review_count != null ? ` · ${d.review_count}条评价` : ''}</div>
          ${reason}
        </div>
        <div style="text-align:right">
          <div class="dish-price">${price}</div>
          ${score}
        </div>
      </div>`;
  };
})();
