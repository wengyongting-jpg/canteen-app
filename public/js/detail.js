// 详情页：评分 / 踩雷预警 / AI 摘要 / 过敏原警告与替代 / 发表评价 / 评价列表
(function () {
  const dishId = new URLSearchParams(location.search).get('id');
  const uid = getUserId();
  let summaryData = null; // 缓存摘要接口返回，用于引用弹层

  function renderHead(d) {
    document.getElementById('crumb').textContent = `${d.canteen.name} · ${d.window.name}`;
    document.getElementById('head').innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div>
            <div class="dish-name" style="font-size:19px">${escapeHtml(d.dish.name)} ${d.dish.is_new ? '<span class="tag new">新品</span>' : ''}</div>
            <div class="tags" style="margin-top:8px">
              ${d.dish.taste_tags.map(t => `<span class="tag hot">${escapeHtml(t)}</span>`).join('')}
              ${d.dish.diet_tags.map(t => `<span class="tag veg">${escapeHtml(t)}</span>`).join('')}
              <span class="tag">¥${d.dish.price}</span>
            </div>
          </div>
          <div style="text-align:center">
            <div class="score-big ${d.minefield.is_minefield ? 'bad' : ''}">${Number(d.stats.weighted_score).toFixed(1)}</div>
            <div class="score-side">加权评分 · ${d.stats.review_count}条评价</div>
          </div>
        </div>
      </div>`;
  }

  function renderAlert(d) {
    const el = document.getElementById('alert');
    if (d.minefield.is_minefield) {
      const reps = (d.minefield.representatives || []).map(r => `<span class="small">“${escapeHtml(r.comment)}”</span>`).join('');
      el.innerHTML = `<div class="banner minefield">踩雷预警${d.minefield.reasons && d.minefield.reasons.length ? '：' + escapeHtml(d.minefield.reasons.join('；')) : ''}${reps}</div>`;
    } else if (d.notice) {
      el.innerHTML = `<div class="banner gray">${escapeHtml(d.notice)}</div>`;
    } else { el.innerHTML = ''; }
  }

  function renderAllergen(d) {
    const el = document.getElementById('allergen');
    const st = d.dish.allergen_status;
    let html = '';
    if (st === 'contains') {
      html = `<div class="banner minefield">含过敏原：${escapeHtml((d.dish.allergens || []).join('、') || '未知成分')}，请谨慎选择</div>`;
      loadAlternatives();
    } else if (st === 'unconfirmed') {
      html = `<div class="banner gray">成分未确认，请向窗口工作人员咨询后再决定</div>`;
    } else {
      html = `<div class="card"><span class="tag allergen-ok">成分已确认</span><span class="dish-meta">　不含常见过敏原记录</span></div>`;
    }
    el.innerHTML = `<div class="sec-head"><h2>过敏原信息</h2></div>` + html + `<div id="alt-box"></div>`;
  }

  async function loadAlternatives() {
    const { ok, data } = await api(`/dishes/${dishId}/safe-alternatives?user_id=${encodeURIComponent(uid)}`);
    if (!ok || !data.items || !data.items.length) return;
    const box = document.getElementById('alt-box');
    if (box) box.innerHTML = `<div class="sec-head" style="padding:0;margin:12px 0 8px"><h2 style="font-size:15px">同类安全替代</h2></div>`
      + data.items.map(d => dishRowHtml(d)).join('');
  }

  function renderSummary(s) {
    const el = document.getElementById('summary-sec');
    if (!s.available) {
      el.innerHTML = `<div class="sec-head"><h2>AI 摘要</h2></div><div class="banner gray">${escapeHtml(s.message || '评价较少，暂无摘要')}</div>`;
      return;
    }
    summaryData = s;
    const srcNote = s.source === 'llm' ? 'AI 生成 · 引用真实评价' : '规则摘要 · 引用真实评价';
    el.innerHTML = `<div class="sec-head"><h2>AI 摘要</h2><span class="dish-meta">${srcNote}</span></div>
      <div class="card">${s.summary.map((line, i) => {
        const sups = line.review_ids.map((rid, j) => `<sup class="sum-sup" data-rid="${rid}" data-i="${i}">${j + 1}</sup>`).join('');
        return `<div class="sum-line">${escapeHtml(line.text)}${sups}</div>`;
      }).join('')}</div>`;
    el.querySelectorAll('.sum-sup').forEach(sup => {
      sup.addEventListener('click', () => {
        const rid = Number(sup.dataset.rid);
        const rv = (summaryData.reviews || []).find(r => r.id === rid);
        if (rv) showDialog('评价原文 #' + rid, `<div style="font-size:14px;line-height:1.7">${escapeHtml(rv.comment || '（未填写短评）')}</div><div class="dish-meta" style="margin-top:8px">${rv.user_display} · ${starsHtml((rv.scores.taste + rv.scores.value + rv.scores.portion) / 3)}</div>`);
      });
    });
  }

  // 发表评价表单
  function renderForm() {
    const el = document.getElementById('rate-sec');
    const dims = [['taste', '味道'], ['value', '性价比'], ['portion', '分量']];
    el.innerHTML = `<div class="sec-head"><h2>写下你的评价</h2></div>
      <div class="card">
        ${dims.map(([k, label]) => `<div class="rate-row"><label>${label}</label><div class="star-input" data-dim="${k}">${[1,2,3,4,5].map(n => `<b data-n="${n}">★</b>`).join('')}</div></div>`).join('')}
        <textarea id="comment" maxlength="200" placeholder="短评（选填，200 字以内）：比如分量、咸淡、排队情况"></textarea>
        <button class="btn-primary" id="submit-review">提交评价</button>
        <div class="dish-meta" style="margin-top:8px">同一道菜每天只能评价 1 条，恶意内容会被屏蔽</div>
      </div>`;
    const picked = { taste: 0, value: 0, portion: 0 };
    el.querySelectorAll('.star-input').forEach(box => {
      box.querySelectorAll('b').forEach(star => {
        star.addEventListener('click', () => {
          const n = Number(star.dataset.n);
          picked[box.dataset.dim] = n;
          box.querySelectorAll('b').forEach(s2 => s2.classList.toggle('on', Number(s2.dataset.n) <= n));
        });
      });
    });
    el.querySelector('#submit-review').addEventListener('click', async () => {
      if (!picked.taste || !picked.value || !picked.portion) { toast('请先给三项打分'); return; }
      const { ok, status, data } = await api(`/dishes/${dishId}/reviews`, {
        method: 'POST',
        body: { user_id: uid, score_taste: picked.taste, score_value: picked.value, score_portion: picked.portion, comment: document.getElementById('comment').value.trim() }
      });
      if (status === 409) { toast(data.error || '今天已评价过这道菜'); return; }
      if (status === 429) { toast(data.error || '操作太频繁，请稍后再试'); return; }
      if (status === 400) { toast(data.error || '评分无效'); return; }
      if (!ok) { toast('提交失败，请重试'); return; }
      toast(data.message || '评价成功');
      loadAll(); // 即时刷新统计
    });
  }

  function renderReviews(d) {
    const el = document.getElementById('reviews-sec');
    el.innerHTML = `<div class="sec-head"><h2>最新评价</h2><span class="dish-meta">展示 5 条</span></div>
      <div class="card">${d.reviews.length ? d.reviews.map(r => `
        <div class="dish-row" style="display:block">
          <div style="display:flex;justify-content:space-between">
            <b style="font-size:13px">${escapeHtml(r.user_display)}</b>
            ${starsHtml((r.scores.taste + r.scores.value + r.scores.portion) / 3)}
          </div>
          <div style="font-size:13px;margin-top:4px">${escapeHtml(r.comment || '未填写短评')}</div>
        </div>`).join('') : '<div class="empty">还没有评价，来做第一个</div>'}</div>`;
  }

  async function loadAll() {
    const { ok, data } = await api(`/dishes/${dishId}`);
    if (!ok) { document.getElementById('head').innerHTML = '<div class="empty">菜品不存在</div>'; return; }
    renderHead(data); renderAlert(data); renderAllergen(data);
    renderReviews(data); renderForm();
    const s = await api(`/dishes/${dishId}/summary`);
    if (s.ok) renderSummary(s.data);
    else { document.getElementById('summary-sec').innerHTML = '<div class="sec-head"><h2>AI 摘要</h2></div><div class="banner gray">评价较少，暂无摘要</div>'; }
  }

  loadAll();
})();
