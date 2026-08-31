(() => {
  'use strict';

  const DOW = ['月','火','水','木','金','土','日'];

  const S = {
    todayMonday: monday(new Date()),
    weekOffset: 0,
    selectedDay: todayDayIndex(),
    weekData: null,
    cache: {},
    masters: {
      staffs: []
    },
    selectedShift: null,
    detailShift: null,
    viewMode: 'time'
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
    timeViewButton: $('timeViewButton'),
    staffViewButton: $('staffViewButton'),
    message: $('message'),
    list: $('shiftList'),

    staffChangeDialog: $('staffChangeDialog'),
    staffChangeForm: $('staffChangeForm'),
    closeStaffChangeDialog: $('closeStaffChangeDialog'),
    cancelStaffChange: $('cancelStaffChange'),
    staffChangeSummary: $('staffChangeSummary'),
    currentPeople: $('currentPeople'),
    currentMain: $('currentMain'),
    currentStaff2: $('currentStaff2'),
    currentStaff3: $('currentStaff3'),
    currentOutDriver: $('currentOutDriver'),
    currentBackDriver: $('currentBackDriver'),
    staffChangeField: $('staffChangeField'),
    staffChangeOld: $('staffChangeOld'),
    staffChangeNew: $('staffChangeNew'),
    staffConflictArea: $('staffConflictArea'),
    staffConflictTitle: $('staffConflictTitle'),
    staffConflictList: $('staffConflictList'),
    staffChangeReason: $('staffChangeReason'),

    shiftCancelDialog: $('shiftCancelDialog'),
    shiftCancelForm: $('shiftCancelForm'),
    closeShiftCancelDialog: $('closeShiftCancelDialog'),
    cancelShiftCancel: $('cancelShiftCancel'),
    shiftCancelSummary: $('shiftCancelSummary'),
    shiftCancelReason: $('shiftCancelReason'),

    shiftDetailDialog: $('shiftDetailDialog'),
    closeShiftDetailDialog: $('closeShiftDetailDialog'),
    closeShiftDetailBottom: $('closeShiftDetailBottom'),
    shiftDetailTitle: $('shiftDetailTitle'),
    shiftDetailBody: $('shiftDetailBody'),
    openShiftHistory: $('openShiftHistory'),

    shiftHistoryDialog: $('shiftHistoryDialog'),
    closeShiftHistoryDialog: $('closeShiftHistoryDialog'),
    backToShiftDetail: $('backToShiftDetail'),
    shiftHistorySummary: $('shiftHistorySummary'),
    shiftHistoryList: $('shiftHistoryList'),

    confirmWeekButton: $('confirmWeekButton'),
    weekConfirmDialog: $('weekConfirmDialog'),
    weekConfirmForm: $('weekConfirmForm'),
    closeWeekConfirmDialog: $('closeWeekConfirmDialog'),
    cancelWeekConfirm: $('cancelWeekConfirm'),
    submitWeekConfirm: $('submitWeekConfirm'),
    weekConfirmSummary: $('weekConfirmSummary')
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

  function currentUser() {
    const params = new URLSearchParams(location.search);

    if (params.get('employeeId')) {
      return {
        id: params.get('employeeId') || '',
        name: params.get('employeeName') || ''
      };
    }

    try {
      const user = JSON.parse(
        localStorage.getItem('currentUser') ||
        'null'
      );

      return {
        id: String(user?.employeeId || user?.id || ''),
        name: String(user?.name || user?.employeeName || '')
      };
    }
    catch (_) {
      return {
        id: '',
        name: ''
      };
    }
  }


  async function loadMasters() {
    const result = await api({
      action:'request.masters'
    });

    if (!result?.ok) {
      throw new Error(
        result?.message ||
        result?.error ||
        '従業員マスタ取得エラー'
      );
    }

    S.masters.staffs =
      result.staffs ||
      result.employees ||
      [];

    renderStaffOptions();
  }


  function staffId(staff) {
    return String(
      staff?.employeeId ||
      staff?.staffId ||
      staff?.id ||
      ''
    ).trim();
  }


  function staffName(staff) {
    return String(
      staff?.employeeName ||
      staff?.staffName ||
      staff?.name ||
      ''
    ).trim();
  }


  function renderStaffOptions(
    fieldKey
  ) {

    const clearDisabled =
      fieldKey ===
      'main';


    E.staffChangeNew.innerHTML =
      '<option value="">選択してください</option>' +
      '<option value="__CLEAR__" data-name=""' +
      (
        clearDisabled
          ? ' disabled'
          : ''
      ) +
      '>空欄にする</option>' +
      S.masters.staffs
        .map(staff => {
          const id = staffId(staff);
          const name = staffName(staff);

          return `
            <option
              value="${esc(id)}"
              data-name="${esc(name)}"
            >
              ${esc(name)}
            </option>
          `;
        })
        .join('');

  }


  function refreshShiftStaffChangeOptions_(
    fieldKey
  ) {

    renderStaffOptions(
      fieldKey
    );


    E.staffChangeNew.value =
      '';

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

    // テスト中はログイン有無に関係なく、
    // 作成中 / 確認中 の週なら確定ボタンを表示する。
    E.confirmWeekButton.hidden =
      ![
        '作成中',
        '確認中'
      ].includes(
        data.status
      );

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
        i === S.selectedDay ? 'active' : '',
        i === 5 ? 'saturday' : '',
        i === 6 ? 'sunday' : ''
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

    E.timeViewButton.classList.toggle('active',S.viewMode === 'time');
    E.staffViewButton.classList.toggle('active',S.viewMode === 'staff');

    E.dayCount.textContent =
      S.viewMode === 'staff'
        ? employeeCompactRows_(items).length + '枠'
        : items.length + '件';

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

    if (S.viewMode === 'staff') {
      E.list.innerHTML = employeeCompactHtml_(items);
      return;
    }

    E.list.innerHTML = items.map(cardHtml).join('');
  }


  function employeeCompactRows_(items) {
    const rows = [];

    items.forEach(item => {
      const assigned = [
        {id:item.mainStaffId,name:item.mainStaffName},
        {id:item.staff2Id,name:item.staff2Name},
        {id:item.staff3Id,name:item.staff3Name}
      ].filter(x => String(x.id || x.name || '').trim());

      const seen = new Set();

      assigned.forEach(staff => {
        const key = String(staff.id || staff.name || '').trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        rows.push({
          staffId:String(staff.id || ''),
          staffName:String(staff.name || ''),
          item:item
        });
      });
    });

    rows.sort((a,b) => {
      const n = a.staffName.localeCompare(b.staffName,'ja');
      if (n !== 0) return n;
      return String(a.item.startTime||'').localeCompare(String(b.item.startTime||''));
    });

    return rows;
  }


  function timeMinutes_(value) {
    const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1])*60 + Number(m[2]) : null;
  }


  function timeOverlap_(s1,e1,s2,e2) {
    const a=timeMinutes_(s1), b=timeMinutes_(e1), c=timeMinutes_(s2), d=timeMinutes_(e2);
    if ([a,b,c,d].some(x => x === null)) return false;
    return a < d && b > c;
  }


  function employeeConflictKeys_(rows) {
    const keys = new Set();
    const groups = new Map();

    rows.forEach(row => {
      const key = row.staffId || row.staffName;
      if (!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(row);
    });

    groups.forEach(group => {
      for (let i=0;i<group.length;i++) {
        for (let j=i+1;j<group.length;j++) {
          if (timeOverlap_(
            group[i].item.startTime,group[i].item.endTime,
            group[j].item.startTime,group[j].item.endTime
          )) {
            keys.add((group[i].staffId || group[i].staffName) + '|' + group[i].item.shiftId);
            keys.add((group[j].staffId || group[j].staffName) + '|' + group[j].item.shiftId);
          }
        }
      }
    });

    return keys;
  }


  function employeeCompactHtml_(items) {
    const rows = employeeCompactRows_(items);

    if (!rows.length) {
      return '<div class="message">担当者が登録されているシフトはありません。</div>';
    }

    const conflicts = employeeConflictKeys_(rows);

    return `<div class="employee-compact-list">${
      rows.map(row => {
        const item = row.item;
        const allStaff = [
          item.mainStaffName,item.staff2Name,item.staff3Name
        ].filter(Boolean).join('・');

        const conflict = conflicts.has(
          (row.staffId || row.staffName) + '|' + item.shiftId
        );

        return `
          <div class="employee-compact-row${conflict ? ' conflict' : ''}">
            <span class="employee-compact-cell employee-compact-name">${conflict ? '<span class="employee-compact-conflict">⚠</span>' : ''}${esc(row.staffName)}</span>
            <span class="employee-compact-cell employee-compact-time">${esc(item.startTime||'')}${item.endTime ? '～'+esc(item.endTime) : ''}</span>
            <span class="employee-compact-cell">${esc(item.service||'')}</span>
            <span class="employee-compact-cell">${esc(item.supportContent||'')}</span>
            <span class="employee-compact-cell">担当:${esc(allStaff)}</span>
          </div>`;
      }).join('')
    }</div>`;
  }



  function canOperateShift_(
    item
  ) {

    if (
      !item?.isActual ||
      [
        'キャンセル',
        '無効',
        '変更前'
      ].includes(
        item.state
      )
    ) {
      return false;
    }


    const weekStatus =
      S.weekData?.status ||
      '';


    if (
      [
        '作成中',
        '確認中'
      ].includes(
        weekStatus
      )
    ) {
      return true;
    }


    if (
      weekStatus !==
      '確定'
    ) {
      return false;
    }


    const today =
      ymd(
        new Date()
      );


    // 確定後は当日以降の正式シフトを変更可能とする。
    return String(
      item.date ||
      ''
    ) >= today;

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
    } else if (out) {
      // 行きだけなら「ドライバ」
      rows.push(['ドライバ',out]);
    } else if (back) {
      // 帰りだけなら「帰ドライバ」
      rows.push(['帰ドライバ',back]);
    }

    if (item.destination) rows.push(['行先',item.destination]);
    if (item.meetingPlace) rows.push(['待合せ',item.meetingPlace]);

    // 人数は通常は表示しない。
    // 空白は1人として扱い、担当枠との不一致時だけ注意表示する。
    const storedPeopleRaw =
      String(
        item.people ??
        ''
      ).trim();


    const storedPeople =
      storedPeopleRaw
        ? Number(
            storedPeopleRaw
          ) || 1
        : 1;


    let expectedPeople =
      item.staff2Name
        ? 2
        : 1;


    const peopleMismatch =
      storedPeople !==
      expectedPeople;


    const meta = rows.map(r => `
      <div class="meta-row">
        <span class="label">${esc(r[0])}</span>
        <span class="value">${esc(r[1])}</span>
      </div>
    `).join('');

    const cls = [
      'card',
      item.isActual ? '' : 'shift-expected',
      ['キャンセル','無効','変更前'].includes(item.state) ? 'shift-cancelled' : ''
    ].filter(Boolean).join(' ');

    return `
      <article class="${cls}">
        <div class="top">
          <div class="time">${esc(item.startTime || '')}${item.endTime ? '–' + esc(item.endTime) : ''}</div>
          <div class="name">${esc(item.clientName || '')}</div>
          <div class="badge shift-plan-badge">${esc(item.state || (item.isActual ? '予定' : '予定候補'))}</div>
        </div>

        <div class="service">
          <b>${esc(item.service || '')}</b>
          ${item.supportContent ? '　' + esc(item.supportContent) : ''}
        </div>

        ${meta ? `<div class="meta">${meta}</div>` : ''}

        ${
          peopleMismatch
            ? `
              <div class="people-mismatch">
                人数 ${esc(storedPeople)}
                <small>
                  担当状況では ${esc(expectedPeople)}人
                </small>
              </div>
            `
            : ''
        }

        ${!item.isActual ? `
          <div class="expected-note">
            規定値Mから表示している予定候補です。まだシフトIDはありません。
          </div>
        ` : ''}

        ${
          item.isActual
            ? `
              <div class="card-actions">

                <button
                  type="button"
                  class="card-action-btn detail"
                  data-action="detail"
                  data-shift-id="${esc(item.shiftId)}"
                >
                  詳細
                </button>

                ${
                  canOperateShift_(
                    item
                  )
                    ? `
                      <button
                        type="button"
                        class="card-action-btn"
                        data-action="staffchange"
                        data-shift-id="${esc(item.shiftId)}"
                      >
                        担当変更
                      </button>

                      <button
                        type="button"
                        class="card-action-btn"
                        data-action="cancel"
                        data-shift-id="${esc(item.shiftId)}"
                      >
                        キャンセル
                      </button>
                    `
                    : ''
                }

              </div>
            `
            : ''
        }
      </article>
    `;
  }

  function findShift(shiftId) {
    return (S.weekData?.items || [])
      .find(
        item =>
          String(item.shiftId || '') ===
          String(shiftId || '')
      ) || null;
  }


  function shiftSummary(item) {
    return [
      item.date || '',
      item.startTime || '',
      item.endTime ? '〜' + item.endTime : '',
      item.clientName || '',
      item.service || ''
    ]
      .filter(Boolean)
      .join('　');
  }


  function openWeekConfirm_() {

    const data =
      S.weekData ||
      {};


    if (
      ![
        '作成中',
        '確認中'
      ].includes(
        data.status
      )
    ) {

      alert(
        'この週は現在確定できません。'
      );

      return;

    }


    const activeCount =
      (
        data.items ||
        []
      )
        .filter(
          item =>
            ![
              'キャンセル',
              '無効',
              '変更前'
            ].includes(
              item.state
            )
        )
        .length;


    E.weekConfirmSummary.textContent =
      `${data.weekStart || ''}〜${data.weekEnd || ''}　${activeCount}件`;


    E.weekConfirmDialog.showModal();

  }


  async function confirmWeek_(
    event
  ) {

    event.preventDefault();


    const data =
      S.weekData ||
      {};


    if (
      !data.weekStart
    ) {
      return;
    }


    if (
      !window.confirm(
        'この週を正式に確定しますか？'
      )
    ) {
      return;
    }


    E.submitWeekConfirm.disabled =
      true;

    E.submitWeekConfirm.textContent =
      '確定処理中…';


    try {

      // 現在は未ログインでのテストを許可。
      // 本番認証導入後は currentUser() の値をそのまま使用する。
      const reporter =
        typeof currentUser ===
        'function'
          ? (
              currentUser() ||
              {}
            )
          : {};


      const result =
        await api({
          action:
            'week.confirm',

          weekStart:
            data.weekStart,

          reporterId:
            reporter.id ||
            'TEST',

          reporterName:
            reporter.name ||
            'TEST'
        });


      if (
        !result?.ok
      ) {

        throw new Error(
          result?.message ||
          result?.error ||
          '週確定に失敗しました。'
        );

      }


      E.weekConfirmDialog.close();


      S.cache =
        {};


      await loadWeek();


      alert(
        `週を確定しました。${result.confirmedCount || 0}件を基本表Mへ登録しました。`
      );

    }
    finally {

      E.submitWeekConfirm.disabled =
        false;

      E.submitWeekConfirm.textContent =
        '確定する';

    }

  }


  function openShiftDetail(
    item
  ) {

    S.detailShift =
      item;


    E.shiftDetailTitle.textContent =
      shiftSummary(
        item
      );


    E.shiftDetailBody.innerHTML =
      shiftDetailHtml_(
        item
      );


    E.shiftDetailDialog.showModal();

  }


  function shiftDetailHtml_(
    item
  ) {

    const empty =
      '<span class="shift-detail-empty">－</span>';


    const row = (
      label,
      value
    ) => `
      <div class="shift-detail-row">
        <div class="shift-detail-label">
          ${esc(label)}
        </div>
        <div class="shift-detail-value">
          ${
            value
              ? esc(value)
              : empty
          }
        </div>
      </div>
    `;


    const staffValue =
      [
        item.mainStaffName,
        item.staff2Name,
        item.staff3Name
      ]
        .filter(
          Boolean
        )
        .join(
          '　'
        );


    let driverValue =
      '';


    const out =
      String(
        item.outDriverName ||
        ''
      ).trim();


    const back =
      String(
        item.backDriverName ||
        ''
      ).trim();


    if (
      out &&
      back
    ) {
      driverValue =
        '行：' +
        out +
        '　帰：' +
        back;
    }
    else if (
      out
    ) {
      driverValue =
        out;
    }
    else if (
      back
    ) {
      driverValue =
        '帰：' +
        back;
    }


    return `
      <section class="shift-detail-section">

        <div class="shift-detail-section-title">
          基本情報
        </div>

        <div class="shift-detail-rows">
          ${row('利用者', item.clientName || '')}
          ${row('日付', item.date || '')}
          ${row(
            '時間',
            [
              item.startTime || '',
              item.endTime || ''
            ]
              .filter(Boolean)
              .join('〜')
          )}
          ${row('制度', item.system || '')}
          ${row('サービス', item.service || '')}
        </div>

      </section>


      <section class="shift-detail-section">

        <div class="shift-detail-section-title">
          支援内容・指示
        </div>

        <div class="shift-detail-rows">
          ${row('支援内容', item.supportContent || '')}
          ${row('行先', item.destination || '')}
          ${row('予約時間', item.appointmentTime || '')}
          ${row('待合せ', item.meetingPlace || '')}
          ${row('移動手段', item.transportMethod || '')}
          ${row('送迎補足', item.transportNote || '')}
          ${row('備考・指示', item.note || '')}
        </div>

      </section>


      <section class="shift-detail-section">

        <div class="shift-detail-section-title">
          担当
        </div>

        <div class="shift-detail-rows">
          ${row('担当', staffValue)}
          ${row('ドライバ', driverValue)}
        </div>

      </section>
    `;

  }


  async function openShiftHistoryPage_() {

    const item =
      S.detailShift;


    if (
      !item?.shiftId
    ) {
      return;
    }


    E.shiftDetailDialog.close();


    E.shiftHistorySummary.textContent =
      shiftSummary(
        item
      );


    E.shiftHistoryList.innerHTML =
      '<div class="shift-history-empty">履歴を取得しています...</div>';


    E.shiftHistoryDialog.showModal();


    try {

      const result =
        await api({
          action:
            'shift.history',

          shiftId:
            item.shiftId
        });


      if (
        !result?.ok
      ) {

        throw new Error(
          result?.message ||
          result?.error ||
          '履歴取得エラー'
        );

      }


      const history =
        result.history ||
        [];


      E.shiftHistoryList.innerHTML =
        history.length
          ? history
              .map(
                shiftHistoryHtml_
              )
              .join('')
          : '<div class="shift-history-empty">変更履歴はありません。</div>';

    }
    catch (
      err
    ) {

      E.shiftHistoryList.innerHTML =
        `
          <div class="shift-history-empty">
            履歴を取得できませんでした：${esc(
              err?.message ||
              err
            )}
          </div>
        `;

    }

  }


  function shiftHistoryHtml_(
    item
  ) {

    const displayType =
      item.status ===
      '取消'
        ? '依頼取消'
        : (
            item.requestType ||
            ''
          );


    return `
      <div class="history-item">

        <div class="history-item-head">
          <span class="history-item-type">
            ${esc(displayType)}
          </span>

          <span class="history-item-date">
            ${esc(
              item.registeredAt ||
              ''
            )}
          </span>
        </div>

        ${
          item.changeContent
            ? `
              <div class="history-item-change">
                ${esc(
                  item.changeContent
                )}
              </div>
            `
            : ''
        }

        ${
          item.changeReason
            ? `
              <div class="history-item-reason">
                理由　${esc(
                  item.changeReason
                )}
              </div>
            `
            : ''
        }

        ${
          item.reporterName
            ? `
              <div class="history-item-reporter">
                報告者　${esc(
                  item.reporterName
                )}
              </div>
            `
            : ''
        }

      </div>
    `;

  }


  function updateStaffConflict_() {
    const item = S.selectedShift;
    const fieldKey = E.staffChangeField.value;
    const selectedId = String(E.staffChangeNew.value || '').trim();
    const option = E.staffChangeNew.selectedOptions[0];
    const selectedName = String(option?.dataset?.name || option?.textContent || '').trim();

    const shouldCheck =
      ['main','staff2','staff3'].includes(fieldKey) &&
      selectedId &&
      selectedId !== '__CLEAR__';

    if (!item || !shouldCheck) {
      E.staffConflictArea.hidden = true;
      E.staffConflictList.innerHTML = '';
      return;
    }

    const schedules = (S.weekData?.items || [])
      .filter(other => {
        if (other.shiftId === item.shiftId) return false;
        if (other.date !== item.date) return false;
        if (['キャンセル','無効','変更前'].includes(other.state)) return false;

        const ids = [other.mainStaffId,other.staff2Id,other.staff3Id]
          .map(x => String(x || '').trim());
        const names = [other.mainStaffName,other.staff2Name,other.staff3Name]
          .map(x => String(x || '').trim());

        return ids.includes(selectedId) || (selectedName && names.includes(selectedName));
      })
      .sort((a,b) => String(a.startTime||'').localeCompare(String(b.startTime||'')));

    const overlaps = schedules.filter(other =>
      timeOverlap_(item.startTime,item.endTime,other.startTime,other.endTime)
    );

    E.staffConflictArea.hidden = false;
    E.staffConflictTitle.textContent =
      overlaps.length
        ? `⚠ ${selectedName}さんは ${overlaps.length}件 時間が重複しています`
        : `${selectedName}さんの当日予定`;

    if (!schedules.length) {
      E.staffConflictList.innerHTML =
        '<div class="staff-conflict-empty">同日の他の担当予定はありません。</div>';
      return;
    }

    E.staffConflictList.innerHTML = schedules.map(other => {
      const overlap = timeOverlap_(
        item.startTime,item.endTime,other.startTime,other.endTime
      );
      const staff = [
        other.mainStaffName,other.staff2Name,other.staff3Name
      ].filter(Boolean).join('・');

      return `
        <div class="staff-conflict-row${overlap ? ' overlap' : ''}">
          <span class="staff-conflict-time">${overlap ? '<span class="staff-conflict-warning">⚠</span>' : ''}${esc(other.startTime||'')}${other.endTime ? '～'+esc(other.endTime) : ''}</span>
          <span>${esc(other.service||'')}</span>
          <span>${esc(other.supportContent||'')}</span>
          <span>担当:${esc(staff)}</span>
        </div>`;
    }).join('');
  }


  function openStaffChange(item) {
    S.selectedShift = item;

    E.staffChangeSummary.textContent =
      shiftSummary(item);

    E.currentPeople.textContent =
      String(
        item.people ||
        '1'
      );

    E.currentMain.textContent =
      item.mainStaffName ||
      '－';

    E.currentStaff2.textContent =
      item.staff2Name ||
      '－';

    E.currentStaff3.textContent =
      item.staff3Name ||
      '－';

    E.currentOutDriver.textContent =
      item.outDriverName ||
      '－';

    E.currentBackDriver.textContent =
      item.backDriverName ||
      '－';

    E.staffChangeField.value = '';
    E.staffChangeOld.textContent = '－';
    refreshShiftStaffChangeOptions_('');
    E.staffChangeReason.value = '';
    E.staffConflictArea.hidden = true;
    E.staffConflictList.innerHTML = '';

    E.staffChangeDialog.showModal();
  }


  function fieldCurrent(item, fieldKey) {
    const map = {
      main: {
        id: item.mainStaffId || '',
        name: item.mainStaffName || '－'
      },
      staff2: {
        id: item.staff2Id || '',
        name: item.staff2Name || '－'
      },
      staff3: {
        id: item.staff3Id || '',
        name: item.staff3Name || '－'
      },
      outDriver: {
        id: item.outDriverId || '',
        name: item.outDriverName || '－'
      },
      backDriver: {
        id: item.backDriverId || '',
        name: item.backDriverName || '－'
      }
    };

    return map[fieldKey] || {
      id: '',
      name: '－'
    };
  }


  function updateOldStaff() {
    const item = S.selectedShift;
    const fieldKey = E.staffChangeField.value;

    if (!item || !fieldKey) {
      E.staffChangeOld.textContent = '－';
      E.staffConflictArea.hidden = true;
      return;
    }

    E.staffChangeOld.textContent =
      fieldCurrent(item,fieldKey).name;

    refreshShiftStaffChangeOptions_(fieldKey);
    updateStaffConflict_();
  }



  function currentPeople(item) {
    const raw = String(
      item?.people ??
      ''
    ).trim();

    return raw
      ? Number(raw) || 1
      : 1;
  }


  function peopleAfterChange(
    item,
    fieldKey,
    newStaffId
  ) {
    // 介助人数は最大2人。
    // 担当3は人数判定に使用しない。
    let mainId =
      item.mainStaffId ||
      '';

    let staff2Id =
      item.staff2Id ||
      '';

    if (fieldKey === 'main') {
      mainId = newStaffId || '';
    }

    if (fieldKey === 'staff2') {
      staff2Id = newStaffId || '';
    }

    return staff2Id
      ? 2
      : 1;
  }


  async function saveStaffChange(event) {
    event.preventDefault();

    const item = S.selectedShift;
    const fieldKey = E.staffChangeField.value;

    const selectedValue =
      String(
        E.staffChangeNew.value ||
        ''
      ).trim();

    const clearRequested =
      selectedValue ===
      '__CLEAR__';

    const newStaffId =
      clearRequested
        ? ''
        : selectedValue;

    const option =
      E.staffChangeNew.selectedOptions[0];

    const newStaffName =
      clearRequested
        ? ''
        : (
            option?.dataset?.name ||
            option?.textContent?.trim() ||
            ''
          );

    if (!item || !fieldKey) {
      alert('変更する項目を選択してください。');
      return;
    }

    if (
      fieldKey === 'main' &&
      (
        clearRequested ||
        !newStaffId
      )
    ) {
      alert('主担当は空欄にできません。');
      return;
    }

    if (
      fieldKey !== 'main' &&
      !clearRequested &&
      !newStaffId
    ) {
      alert('変更後の担当者、または「空欄にする」を選択してください。');
      return;
    }

    const old =
      fieldCurrent(
        item,
        fieldKey
      );

    if (
      (
        old.id &&
        old.id === newStaffId
      ) ||
      (
        !old.id &&
        clearRequested
      )
    ) {
      alert(
        clearRequested
          ? 'この項目はすでに空欄です。'
          : '現在と同じ従業員です。'
      );
      return;
    }

    const labels = {
      main:'主担当',
      staff2:'担当2',
      staff3:'担当3（見習）',
      outDriver:'行ドライバ',
      backDriver:'帰ドライバ'
    };

    const oldPeople =
      currentPeople(
        item
      );

    const newPeople =
      peopleAfterChange(
        item,
        fieldKey,
        newStaffId
      );

    const lines = [
      '担当変更しますか？',
      '',
      '項目：' + labels[fieldKey],
      '変更前：' + old.name,
      '変更後：' +
        (
          clearRequested
            ? '空欄'
            : newStaffName
        )
    ];

    if (
      oldPeople !==
      newPeople
    ) {
      lines.push(
        '',
        '人数も変更されます：' +
        oldPeople +
        ' → ' +
        newPeople,
        '',
        '担当変更と同時に人数も変更してよろしいですか？'
      );
    }

    if (!confirm(lines.join('\n'))) {
      return;
    }

    const reporter =
      currentUser();

    const result =
      await api({
        action:'shift.staffchange.apply',
        shiftId:item.shiftId,
        fieldKey:fieldKey,
        newStaffId:newStaffId,
        newStaffName:newStaffName,
        clearStaff:clearRequested,
        reporterId:reporter.id,
        reporterName:reporter.name,
        reason:E.staffChangeReason.value.trim(),
        registerMethod:'WEB_SHIFT_LIST'
      });

    if (!result?.ok) {
      throw new Error(
        result?.message ||
        result?.error ||
        '担当変更に失敗しました。'
      );
    }

    E.staffChangeDialog.close();

    const key = ymd(weekStart());
    delete S.cache[key];

    await loadWeek();

    alert('担当変更を登録しました。');
  }


  function openCancel(item) {
    S.selectedShift = item;

    E.shiftCancelSummary.textContent =
      shiftSummary(item);

    E.shiftCancelReason.value = '';

    E.shiftCancelDialog.showModal();
  }


  async function saveCancel(event) {
    event.preventDefault();

    const item = S.selectedShift;

    if (!item?.shiftId) {
      return;
    }

    if (
      !confirm(
        'このシフトをキャンセルしますか？'
      )
    ) {
      return;
    }

    const reporter =
      currentUser();

    const result =
      await api({
        action:'shift.cancel.apply',
        shiftIds:[
          item.shiftId
        ],
        reporterId:reporter.id,
        reporterName:reporter.name,
        reason:E.shiftCancelReason.value.trim(),
        registerMethod:'WEB_SHIFT_LIST'
      });

    if (!result?.ok) {
      throw new Error(
        result?.message ||
        result?.error ||
        'キャンセルに失敗しました。'
      );
    }

    E.shiftCancelDialog.close();

    const key = ymd(weekStart());
    delete S.cache[key];

    await loadWeek();

    alert('キャンセルを登録しました。');
  }


  E.timeViewButton.addEventListener('click',() => {
    S.viewMode = 'time';
    renderDay();
  });

  E.staffViewButton.addEventListener('click',() => {
    S.viewMode = 'staff';
    renderDay();
  });

  E.staffChangeNew.addEventListener('change',updateStaffConflict_);


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

  E.list.addEventListener(
    'click',
    event => {
      const button =
        event.target.closest(
          '[data-action][data-shift-id]'
        );

      if (!button) {
        return;
      }

      const item =
        findShift(
          button.dataset.shiftId
        );

      if (!item) {
        return;
      }

      if (
        button.dataset.action ===
        'detail'
      ) {
        openShiftDetail(item);
      }

      if (
        button.dataset.action ===
        'staffchange'
      ) {
        openStaffChange(item);
      }

      if (
        button.dataset.action ===
        'cancel'
      ) {
        openCancel(item);
      }
    }
  );


  E.staffChangeField.addEventListener(
    'change',
    updateOldStaff
  );


  E.staffChangeForm.addEventListener(
    'submit',
    event => {
      saveStaffChange(event)
        .catch(
          err =>
            alert(
              err?.message ||
              err
            )
        );
    }
  );


  E.closeStaffChangeDialog.addEventListener(
    'click',
    () =>
      E.staffChangeDialog.close()
  );


  E.cancelStaffChange.addEventListener(
    'click',
    () =>
      E.staffChangeDialog.close()
  );


  E.shiftCancelForm.addEventListener(
    'submit',
    event => {
      saveCancel(event)
        .catch(
          err =>
            alert(
              err?.message ||
              err
            )
        );
    }
  );


  E.closeShiftCancelDialog.addEventListener(
    'click',
    () =>
      E.shiftCancelDialog.close()
  );


  E.cancelShiftCancel.addEventListener(
    'click',
    () =>
      E.shiftCancelDialog.close()
  );


  E.closeShiftDetailDialog.addEventListener(
    'click',
    () =>
      E.shiftDetailDialog.close()
  );


  E.closeShiftDetailBottom.addEventListener(
    'click',
    () =>
      E.shiftDetailDialog.close()
  );


  E.openShiftHistory.addEventListener(
    'click',
    () => {
      openShiftHistoryPage_();
    }
  );


  E.closeShiftHistoryDialog.addEventListener(
    'click',
    () =>
      E.shiftHistoryDialog.close()
  );


  E.backToShiftDetail.addEventListener(
    'click',
    () => {
      E.shiftHistoryDialog.close();

      if (
        S.detailShift
      ) {
        E.shiftDetailDialog.showModal();
      }
    }
  );


  E.confirmWeekButton.addEventListener(
    'click',
    openWeekConfirm_
  );


  E.weekConfirmForm.addEventListener(
    'submit',
    event => {

      confirmWeek_(
        event
      )
        .catch(
          err =>
            alert(
              err?.message ||
              err
            )
        );

    }
  );


  E.closeWeekConfirmDialog.addEventListener(
    'click',
    () =>
      E.weekConfirmDialog.close()
  );


  E.cancelWeekConfirm.addEventListener(
    'click',
    () =>
      E.weekConfirmDialog.close()
  );


  Promise.all([
    loadMasters(),
    loadWeek()
  ])
    .catch(
      err => {
        E.message.textContent =
          '取得できませんでした：' +
          (
            err?.message ||
            err
          );
      }
    );
})();
