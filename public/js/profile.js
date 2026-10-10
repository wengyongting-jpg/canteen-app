// 个人中心：口味 / 过敏原 / 饮食限制 + 后台管理（可选简化版）
(function () {
  renderTabbar('me');
  const uid = getUserId();
  document.getElementById('uid-line').textContent = '设备标识：' + uid.slice(0, 8) + '…';

  const TASTES = ['辣', '清淡', '咸香', '酸甜', '麻辣', '鲜香'];
  const ALLERGENS = ['花生', '海鲜', '乳制品', '坚果', '麸质'];
  const DIETS = ['素食', '清真'];
  const picked = { taste: new Set(), allergens: new Set(), diet: new Set() };

  function buildChips(elId, list, set) {
    const el = document.getElementById(elId);
    el.innerHTML = list.map(x => `<span class="chip" data-v="${x}">${x}</span>`).join('');
    el.querySelectorAll('.chip').forEach(c => {
      c.addEventListener('click', () => {
        const v = c.dataset.v;
        set.has(v) ? set.delete(v) : set.add(v);
        c.classList.toggle('on', set.has(v));
      });
    });
  }
  buildChips('taste-chips', TASTES, picked.taste);
  buildChips('allergen-chips', ALLERGENS, picked.allergens);
  buildChips('diet-chips', DIETS, picked.diet);

  // 回显已有档案
  (async function load() {
    const { ok, data } = await api('/profile/' + encodeURIComponent(uid));
    if (!ok) return;
    (data.preferences && data.preferences.taste || []).forEach(x => picked.taste.has(x) || picked.taste.add(x));
    (data.allergens || []).forEach(x => picked.allergens.has(x) || picked.allergens.add(x));
    (data.diet_restrictions || []).forEach(x => picked.diet.has(x) || picked.diet.add(x));
    document.querySelectorAll('#taste-chips .chip').forEach(c => c.classList.toggle('on', picked.taste.has(c.dataset.v)));
    document.querySelectorAll('#allergen-chips .chip').forEach(c => c.classList.toggle('on', picked.allergens.has(c.dataset.v)));
    document.querySelectorAll('#diet-chips .chip').forEach(c => c.classList.toggle('on', picked.diet.has(c.dataset.v)));
  })();

  document.getElementById('save').addEventListener('click', async () => {
    const { ok } = await api('/profile/' + encodeURIComponent(uid), {
      method: 'PUT',
      body: { preferences: { taste: [...picked.taste] }, allergens: [...picked.allergens], diet_restrictions: [...picked.diet] }
    });
    toast(ok ? '已保存，推荐会参考你的口味' : '保存失败，请重试');
  });

  // ---- 后台管理 ----
  let token = sessionStorage.getItem('admin_token') || '';
  document.getElementById('admin-token').value = token;

  async function loadFlagged() {
    token = document.getElementById('admin-token').value.trim();
    if (!token) { toast('请输入管理令牌'); return; }
    sessionStorage.setItem('admin_token', token);
    const { ok, status, data } = await api('/admin/flagged', { headers: { 'x-admin-token': token } });
    const box = document.getElementById('admin-list');
    if (status === 401) { box.innerHTML = '<div class="empty">令牌无效</div>'; return; }
    if (!ok) { box.innerHTML = '<div class="empty">加载失败</div>'; return; }
    const rows = data.blocked_reviews.map(r => `
      <div class="dish-row" style="display:block">
        <div style="font-size:13px">${escapeHtml(r.comment)} ${r.is_synthetic ? '<span class="tag">合成数据</span>' : ''}</div>
        <div class="dish-meta">#${r.id} · ${escapeHtml(r.dish_name)} · ${r.status}</div>
        <div style="margin-top:6px;display:flex;gap:6px">
          <button class="btn-mini" data-act="unblock" data-id="${r.id}">解除屏蔽</button>
          <button class="btn-mini danger" data-act="delete" data-id="${r.id}">删除</button>
        </div>
      </div>`).join('');
    const rl = data.rate_limited.length ? `<div class="dish-meta" style="margin:8px 0">最近限流事件：${data.rate_limited.length} 条（用户 ${escapeHtml(data.rate_limited[0].user_id.slice(0, 8))}… 等）</div>` : '';
    box.innerHTML = rows || rl || '<div class="empty">暂无被标记的评价</div>';
    box.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { status: st } = await api(`/admin/reviews/${btn.dataset.id}/${btn.dataset.act}`, { method: 'POST', headers: { 'x-admin-token': token } });
        if (st === 401) { toast('令牌无效'); return; }
        toast('已处理');
        loadFlagged();
      });
    });
  }
  document.getElementById('admin-load').addEventListener('click', loadFlagged);
})();
