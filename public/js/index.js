// 首页：推荐 / 新品榜 / 踩雷榜 + 搜索入口
(function () {
  renderTabbar('home');

  function goSearch(q) {
    if (!q.trim()) { toast('想吃什么，写下来告诉我'); return; }
    location.href = 'result.html?q=' + encodeURIComponent(q.trim());
  }

  document.getElementById('ask').addEventListener('click', () => goSearch(document.getElementById('q').value));
  document.getElementById('q').addEventListener('keydown', e => { if (e.key === 'Enter') goSearch(e.target.value); });
  document.querySelectorAll('#quick-chips .chip').forEach(c => {
    c.addEventListener('click', () => { c.classList.toggle('on'); goSearch(c.dataset.q); });
  });

  // 「查看全部」切换显示前 5 / 前 10
  document.querySelectorAll('.more[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = document.getElementById(btn.dataset.toggle);
      el._full = !el._full;
      btn.textContent = el._full ? '收起' : '查看全部 10';
      renderList(el, el._data || [], el._kind);
    });
  });

  function renderList(el, list, kind) {
    if (!list.length) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    const n = el._full ? 10 : 5;
    el.innerHTML = list.slice(0, n).map(d => dishRowHtml(d, { bad: kind === 'mine', reason: kind === 'mine' ? d.reason : '' })).join('');
  }

  (async function load() {
    const { ok, data } = await api('/home');
    if (!ok) { toast('加载失败，请刷新'); return; }

    const reco = document.getElementById('reco-list');
    reco.innerHTML = data.recommended.length
      ? data.recommended.map(d => dishRowHtml(d)).join('')
      : '<div class="empty">暂无推荐</div>';

    const nl = document.getElementById('new-list');
    nl._data = data.new_dishes; nl._kind = 'new';
    renderList(nl, data.new_dishes, 'new');

    const ml = document.getElementById('mine-list');
    ml._data = data.minefield; ml._kind = 'mine';
    renderList(ml, data.minefield, 'mine');
  })();
})();
