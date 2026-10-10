// 结果页：Top3 推荐 / 放宽提示 / 降级提示 / 兜底建议
(function () {
  const q = new URLSearchParams(location.search).get('q') || '';

  function parseChip(k, v) {
    const names = { canteen_id: '指定食堂', window_id: '指定窗口', max_price: v => `≤${v}元`, min_price: v => `≥${v}元`, taste: '口味', diet: '饮食', taste_new: '只看新品', allergens: '规避过敏原' };
    if (v == null || v === false || v === '' || (Array.isArray(v) && !v.length)) return null;
    const label = typeof names[k] === 'function' ? names[k](v) : names[k];
    if (!label) return null;
    if (k === 'taste' || k === 'diet') return `${label}：${v}`;
    if (k === 'allergens') return `规避：${v.join('、')}`;
    if (k === 'canteen_id') return `食堂 #${v}`;
    if (k === 'window_id') return `窗口 #${v}`;
    return label;
  }

  function evidenceBtn(item, idx) {
    if (!item.evidence || !item.evidence.length) return '';
    const ev = item.evidence[0];
    return `<button class="quote-btn" data-ev="${idx}">查看同学评价</button>`;
  }

  function render(data) {
    document.getElementById('recap').innerHTML = `<b>“${escapeHtml(q)}”</b> 的推荐结果`;
    const chips = Object.entries(data.parsed || {})
      .map(([k, v]) => parseChip(k, v)).filter(Boolean)
      .map(t => `<span class="chip on">${escapeHtml(t)}</span>`).join('');
    document.getElementById('parsed-chips').innerHTML = chips + `<span class="chip">${data.parsed && data.parsed.source === 'llm' ? 'AI 理解' : '关键词理解'}</span>`;

    const notices = [];
    if (data.relaxed && data.relaxed.length) notices.push(`<div class="banner relax">为找到更多选择：${escapeHtml(data.relaxed.join('；'))}</div>`);
    if (data.degraded) notices.push('<div class="degraded-note">AI 暂不可用，已按规则推荐</div>');
    document.getElementById('notices').innerHTML = notices.join('');

    const list = document.getElementById('result-list');

    // 兜底态
    if (data.fallback) {
      list.innerHTML = `<div class="card"><div class="empty">${escapeHtml(data.message || '根据当前食堂数据，无法找到相关信息，请尝试其他菜品，或补充评价。')}</div></div>`
        + (data.suggestions && data.suggestions.length ? `<div class="sec-head"><h2>换个试试</h2></div>` + data.suggestions.map(d => dishRowHtml(d)).join('') : '');
      return;
    }

    // Top3 推荐卡
    list.innerHTML = (data.items || []).map((it, idx) => {
      const d = it.dish;
      const where = [d.canteen_name, d.window_name].filter(Boolean).join(' · ');
      const evQuote = it.evidence && it.evidence.length ? `“${escapeHtml(it.evidence[0].quote)}”` : '';
      return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:10px">
          <div style="flex:1;min-width:0" onclick="location.href='detail.html?id=${d.id}'">
            <div class="dish-name">${escapeHtml(d.name)} ${d.is_new ? '<span class="tag new">新品</span>' : ''} ${allergenBadge(it.allergen_status)}</div>
            <div class="dish-meta">${escapeHtml(where)} · ¥${d.price}</div>
            <div class="tags">${(d.taste_tags || []).map(t => `<span class="tag hot">${escapeHtml(t)}</span>`).join('')}</div>
          </div>
          <span class="score-badge">${Number(it.weighted_score).toFixed(1)}分</span>
        </div>
        <div class="reason">${escapeHtml(it.reason)}</div>
        ${evQuote ? `<div class="dish-meta" style="margin-top:6px">${evQuote}</div>` : ''}
        ${evidenceBtn(it, idx)}
      </div>`;
    }).join('') || '<div class="empty">没有找到合适的菜</div>';

    // 评价引用弹层
    const allEv = (data.items || []).flatMap(it => it.evidence || []);
    list.querySelectorAll('[data-ev]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ev = allEv[Number(btn.dataset.ev)];
        if (ev) showDialog('评价原文', `<div style="font-size:14px;line-height:1.7">${escapeHtml(ev.quote)}</div><div class="dish-meta" style="margin-top:8px">来自同学真实评价（#${ev.review_id}）</div>`);
      });
    });
  }

  (async function run() {
    if (!q.trim()) { document.getElementById('result-list').innerHTML = '<div class="empty">想吃什么？回首页告诉我</div>'; return; }
    const { ok, data } = await api('/recommend', { method: 'POST', body: { query: q, user_id: getUserId() } });
    if (!ok) { document.getElementById('result-list').innerHTML = '<div class="empty">推荐服务开小差了，请重试</div>'; return; }
    render(data);
  })();
})();
