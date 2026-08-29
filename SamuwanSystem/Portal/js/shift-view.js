(() => {
  'use strict';

  const DOW = ['月','火','水','木','金','土','日'];

  const S = {
    todayMonday: monday(new Date()),
    weekOffset: 0,
    selectedDay: todayDayIndex(),
    weekData: null,
    cache: {}
  };

  const $ = id => document.getElementById(id);

  const E = {
    weekLabel: $('weekLabel'),
    weekState: $('weekState'),
    weekSource: $('weekSource'),
    daysNav: $('daysNav'),
    prevWeek: $('prevWeek'),
    nextWeek: $('nextWeek'),
    dayTitle: $('dayTitle'),
    dayCount: $('dayCount'),
    message: $('message'),
    list: $('shiftList')
  };

  function monday(date) {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function todayDayIndex() {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }

  function ymd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  function md(date) {
    return `${date.getMonth()+1}/${date.getDate()}`;
  }

  function esc(v) {
    return String(v ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  async function api(payload) {
    const url = String(window.REQUEST_APP?.GAS_URL || '').trim();
    if (!url.endsWith('/exec')) {
      throw new Error('request-view-config.js のGAS_URLを確認してください。');
    }

    const response = await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify(payload),
      redirect:'follow'
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }

  function weekStart() {
    return addDays(S.todayMonday, S.weekOffset * 7);
  }

  async function loadWeek() {
    const start = weekStart();
    const key = ymd(start);

    E.message.textContent = 'シフトを取得しています...';
    E.list.innerHTML = '';

    try {
      let result = S.cache[key];

      if (!result) {
        result = await api({
          action:'shift.week.list',
          weekStart:key
        });

        if (!result?.ok) {
          throw new Error(result?.message || result?.error || 'シフト取得エラー');
        }
        S.cache[key] = result;
      }

      S.weekData = result;
      render();
    }
    catch(err) {
      E.message.textContent = '取得できませんでした：' + (err?.message || err);
      E.weekState.textContent = 'エラー';
      E.weekSource.textContent = '';
    }
  }

  function render() {
    const data = S.weekData || {};
    const start = weekStart();
    const end = addDays(start,6);

    E.weekLabel.textContent = `${md(start)}〜${md(end)}`;
    E.weekState.textContent = data.status || '未作成';
    E.weekSource.textContent = data.source ? `参照：${data.source}` : '';

    E.prevWeek.disabled = S.weekOffset <= -1;
    E.nextWeek.disabled = S.weekOffset >= 1;

    renderDays();
    renderDay();
  }

  function renderDays() {
    const start = weekStart();

    E.daysNav.innerHTML = DOW.map((dow,i) => {
      const d = addDays(start,i);
      const cls = [
        'day-btn',
        i === S.selectedDay ? 'selected' : '',
        i === 5 ? 'sat' : '',
        i === 6 ? 'sun' : ''
      ].filter(Boolean).join(' ');

      return `
        <button type="button" class="${cls}" data-day="${i}">
          <span class="dow">${dow}</span>
          <span class="date">${md(d)}</span>
        </button>
      `;
    }).join('');
  }

  function renderDay() {
    const start = weekStart();
    const date = addDays(start,S.selectedDay);
    const dateKey = ymd(date);

    E.dayTitle.textContent = DOW[S.selectedDay] + '曜日';

    const items = (S.weekData?.items || [])
      .filter(x => x.date === dateKey)
      .sort((a,b) => String(a.startTime||'').localeCompare(String(b.startTime||'')));

    E.dayCount.textContent = items.length + '件';

    if (S.weekData?.warning) {
      E.message.innerHTML = `<div class="warning">${esc(S.weekData.warning)}</div>`;
    } else {
      E.message.textContent = '';
    }

    if (!items.length) {
      E.list.innerHTML = '';
      if (!S.weekData?.warning) E.message.textContent = 'この日のシフトはありません。';
      return;
    }

    E.list.innerHTML = items.map(cardHtml).join('');
  }

  function cardHtml(item) {
    const staff = [
      item.mainStaffName,
      item.staff2Name,
      item.staff3Name
    ].filter(Boolean).join('　');

    const rows = [];

    if (staff) rows.push(['担当',staff]);

    const out = String(item.outDriverName || '').trim();
    const back = String(item.backDriverName || '').trim();

    if (out && back) {
      rows.push(['行ドライバ',out]);
      rows.push(['帰ドライバ',back]);
    } else if (out || back) {
      rows.push(['ドライバ',out || back]);
    }

    if (item.destination) rows.push(['行先',item.destination]);
    if (item.meetingPlace) rows.push(['待合せ',item.meetingPlace]);
    if (item.people) rows.push(['人数',item.people]);

    const meta = rows.map(r => `
      <div class="meta-row">
        <span class="meta-label">${esc(r[0])}</span>
        <span class="meta-value">${esc(r[1])}</span>
      </div>
    `).join('');

    const cls = [
      'shift-card',
      item.isActual ? '' : 'expected',
      ['キャンセル','無効','変更前'].includes(item.state) ? 'cancelled' : ''
    ].filter(Boolean).join(' ');

    return `
      <article class="${cls}">
        <div class="shift-top">
          <div class="shift-time">${esc(item.startTime || '')}${item.endTime ? '–' + esc(item.endTime) : ''}</div>
          <div class="shift-name">${esc(item.clientName || '')}</div>
          <div class="shift-state">${esc(item.state || (item.isActual ? '予定' : '予定候補'))}</div>
        </div>

        <div class="shift-service">
          <b>${esc(item.service || '')}</b>
          ${item.supportContent ? '　' + esc(item.supportContent) : ''}
        </div>

        ${meta ? `<div class="shift-meta">${meta}</div>` : ''}

        ${!item.isActual ? `
          <div class="expected-note">
            規定値Mから表示している予定候補です。まだシフトIDはありません。
          </div>
        ` : ''}
      </article>
    `;
  }

  E.prevWeek.addEventListener('click',() => {
    if (S.weekOffset <= -1) return;
    S.weekOffset -= 1;
    S.selectedDay = 0;
    loadWeek();
  });

  E.nextWeek.addEventListener('click',() => {
    if (S.weekOffset >= 1) return;
    S.weekOffset += 1;
    S.selectedDay = 0;
    loadWeek();
  });

  E.daysNav.addEventListener('click',event => {
    const btn = event.target.closest('[data-day]');
    if (!btn) return;
    S.selectedDay = Number(btn.dataset.day);
    renderDays();
    renderDay();
  });

  loadWeek();
})();
