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
    detailShift: null
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
    shiftHistoryList: $('shiftHistoryList')
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
          item.isActual &&
          ['作成中','確認中'].includes(
            S.weekData?.status
          ) &&
          ![
            'キャンセル',
            '無効',
            '変更前'
          ].includes(
            item.state
          )
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
      return;
    }

    E.staffChangeOld.textContent =
      fieldCurrent(
        item,
        fieldKey
      ).name;


    refreshShiftStaffChangeOptions_(
      fieldKey
    );
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
        action:'request.staffchange.apply',
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
        action:'request.cancel.multi',
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
