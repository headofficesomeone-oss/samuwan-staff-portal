(() => {
  'use strict';

  const S = {
    weekStart: monday(new Date()),
    scope: 'all',
    employee: user(),
    day: todayIndex(),
    data: null,
    masters: { clients: [], staffs: [] }
  };

  const $ = id => document.getElementById(id);

  const E = {
    week: $('weekLabel'),
    nav: $('daysNav'),
    title: $('dayTitle'),
    count: $('dayCount'),
    msg: $('message'),
    list: $('requestList'),

    scope: [
      ...document.querySelectorAll('.scope-btn')
    ],

    open: $('openRegister'),
    dialog: $('requestDialog'),
    form: $('requestForm'),
    close: $('closeDialog'),
    cancel: $('cancelRegister'),

    type: $('requestType'),
    targetField: $('targetShiftField'),
    targetId: $('targetShiftId'),
    dateList: $('requestDateList'),
    addDate: $('addRequestDate'),
    client: $('clientName'),
    system: $('system'),
    service: $('service'),

    start: $('startTime'),
    end: $('endTime'),

    support: $('supportContent'),
    main: $('mainStaffName'),
    staff2: $('staff2Name'),
    staff3: $('staff3Name'),

    staffFields: $('staffChangeFields'),
    oldStaff: $('oldStaffName'),
    newStaff: $('newStaffName'),

    changeField: $('changeContentField'),
    change: $('changeContent'),
    reason: $('changeReason'),

    dest: $('destination'),
    appt: $('appointmentTime'),
    meet: $('meetingPlace'),
    note: $('note'),

    saveMsg: $('saveMessage'),
    save: $('saveRequest')
  };


  // ==============================
  // イベント
  // ==============================

  E.scope.forEach(button => {

    button.addEventListener('click', async () => {

      if (
        button.dataset.scope === 'mine' &&
        !S.employee.id
      ) {
        alert(
          'ログイン中の従業員IDが必要です。'
        );

        return;
      }

      S.scope =
        button.dataset.scope;

      E.scope.forEach(x => {

        x.classList.toggle(
          'active',
          x === button
        );

      });

      render();

    });

  });


  E.open.addEventListener('click', () => {

    resetForm();

  const day =
    S.data?.days?.[S.day];


  const firstDate =
    E.dateList.querySelector(
      '.request-date'
    );


  if (
    day?.date &&
    firstDate
  ) {

    firstDate.value =
      day.date;

  }

    E.dialog.showModal();

  });


  E.close.addEventListener(
    'click',
    () => E.dialog.close()
  );


  E.cancel.addEventListener(
    'click',
    () => E.dialog.close()
  );


  E.type.addEventListener(
    'change',
    formMode
  );


  E.form.addEventListener(
    'submit',
    saveRequest
  );


  E.addDate.addEventListener(
    'click',
    addRequestDateRow
  );


  // ==============================
  // 初期処理
  // ==============================

  formMode();

  start();

  async function start() {

    try {
      await loadMasters();
      await load();
    }
    catch (err) {
      message(
        '依頼情報を取得できませんでした。\n' +
        (err?.message || err)
      );
    }
  }

  // ==============================
  // GAS通信
  // ==============================

  async function api(payload) {

    const url =
      String(
        window.REQUEST_APP?.GAS_URL || ''
      ).trim();


    if (!url.endsWith('/exec')) {

      throw new Error(
        'request-view-config.js のGAS_URLを確認してください。'
      );

    }


    const response =
      await fetch(
        url,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'text/plain;charset=utf-8'
          },

          body:
            JSON.stringify(payload),

          redirect: 'follow'
        }
      );


    if (!response.ok) {

      throw new Error(
        'HTTP ' + response.status
      );

    }


    return response.json();

  }


// ==============================
// 利用者・従業員マスタ
// ==============================

async function loadMasters() {

  const result =
    await api({
      action:
        'request.masters'
    });


  if (!result?.ok) {

    throw new Error(
      result?.message ||
      result?.error ||
      'マスタ取得エラー'
    );

  }


  S.masters.clients =
    result.clients || [];

  S.masters.staffs =
    result.staffs || [];


  setClientOptions();

  setStaffOptions();

}

function setClientOptions() {

  const html =
    `
      <option value="">
        選択してください
      </option>
    ` +
    S.masters.clients
      .map(item => `
        <option
          value="${esc(item.id)}"
          data-name="${esc(item.name)}"
        >
          ${esc(item.name)}
        </option>
      `)
      .join('');


  E.client.innerHTML =
    html;

}

function setStaffOptions() {

  const html =
    `
      <option value="">
        選択してください
      </option>
    ` +
    S.masters.staffs
      .map(item => `
        <option
          value="${esc(item.id)}"
          data-name="${esc(item.name)}"
        >
          ${esc(item.name)}
        </option>
      `)
      .join('');


  E.main.innerHTML =
    html;

  E.staff2.innerHTML =
    html;

  E.staff3.innerHTML =
    html;

  E.oldStaff.innerHTML =
    html;

  E.newStaff.innerHTML =
    html;

}


  // ==============================
  // 週間依頼情報読み込み
  // ==============================

  async function load() {

    message(
      '依頼情報を取得しています...'
    );


    const result =
      await api({
        action: 'request.week',

        weekStart:
          S.weekStart,

				scope: 'all',

				employeeId: ''

      });


    if (!result?.ok) {

      throw new Error(
        result?.message ||
        result?.error ||
        'GASエラー'
      );

    }


    S.data = result;

    render();

  }


  // ==============================
  // 依頼登録
  // ==============================

  async function saveRequest(event) {

    event.preventDefault();

    const type =
      E.type.value;


    // 追加以外は対象シフトID必須
    if (
      type !== '追加' &&
      !E.targetId.value.trim()
    ) {

      saveMsg(
        '対象シフトIDを入力してください。',
        true
      );

      return;
    }


    // 担当変更
    if (
      type === '担当変更' &&
      (
        !E.oldStaff.value.trim() ||
        !E.newStaff.value.trim()
      )
    ) {

      saveMsg(
        '変更前担当・変更後担当を入力してください。',
        true
      );

      return;
    }

    const client = selectedMaster(E.client);
    const mainStaff = selectedMaster(E.main);
    const staff2 = selectedMaster(E.staff2);
    const staff3 = selectedMaster(E.staff3);
    const oldStaff = selectedMaster(E.oldStaff);
    const newStaff = selectedMaster(E.newStaff);

    const targetDates = getRequestDates();

    if (!targetDates.length) {
      saveMsg('対象日を入力してください。',true);
      return;
    }

    E.save.disabled = true;

    saveMsg(
      '登録しています...',
      false
    );


    try {

      const result =
        await api({

          action:
            'request.save',

          requestType:
            type,

          targetShiftId:
            E.targetId.value.trim(),

          reporterId:
            S.employee.id,

          reporterName:
            S.employee.name,

          clientId:
            client.id,

          clientName:
            client.name,

          system:
            E.system.value,

          service:
            E.service.value.trim(),

          targetDates:
            targetDates,

          startTime:
            E.start.value,

          endTime:
            E.end.value,

          mainStaffId:
            mainStaff.id,

          mainStaffName:
            mainStaff.name,

          staff2Id:
            staff2.id,

          staff2Name:
            staff2.name,
 
          staff3Id:
            staff3.id,

          staff3Name:
            staff3.name,
 
          oldStaffId:
            oldStaff.id,

          oldStaffName:
            oldStaff.name,

          newStaffId:
            newStaff.id,

          newStaffName:
            newStaff.name,

          destination:
            E.dest.value.trim(),

          appointmentTime:
            E.appt.value,

          meetingPlace:
            E.meet.value.trim(),

          supportContent:
            E.support.value.trim(),

          changeContent:
            E.change.value.trim(),

          changeReason:
            E.reason.value.trim(),

          note:
            E.note.value.trim()
        });


      if (!result?.ok) {

        throw new Error(
          result?.message ||
          result?.error ||
          '登録失敗'
        );

      }


      saveMsg(
        '登録しました。\n' +
        (result.requestId || ''),
        false
      );


      await load();


      setTimeout(
        () => E.dialog.close(),
        500
      );

    }
    catch (err) {

      saveMsg(
        '登録できませんでした。\n' +
        (err?.message || err),
        true
      );

    }
    finally {

      E.save.disabled = false;

    }

  }


  // ==============================
  // 画面描画
  // ==============================

  function render() {

    const days =
      S.data?.days || [];


    if (!days.length) {

      message(
        '対象週のデータがありません。'
      );

      return;
    }


    E.week.textContent =
      `${label(days[0].date)}〜${label(days[6].date)}`;


    // 曜日ボタン
    E.nav.innerHTML =
      days.map((day, index) => {

        const classes =
          ['day-btn'];


        if (index === S.day) {
          classes.push('active');
        }


        if (index === 5) {
          classes.push('saturday');
        }


        if (index === 6) {
          classes.push('sunday');
        }


        if (
          day.date ===
          dateString(new Date())
        ) {
          classes.push('today');
        }


        return `
          <button
            type="button"
            class="${classes.join(' ')}"
            data-i="${index}"
          >
            ${esc(day.weekday)}

            <span class="date">
              ${esc(day.dateLabel)}
            </span>
          </button>
        `;

      }).join('');


    // 曜日選択
    [
      ...E.nav.querySelectorAll('.day-btn')
    ].forEach(button => {

      button.addEventListener(
        'click',
        () => {

          S.day =
            Number(
              button.dataset.i
            );

          render();

        }
      );

    });


		const day =
		  days[S.day];


		E.title.textContent =
		  [
		    '月曜日',
		    '火曜日',
		    '水曜日',
		    '木曜日',
		    '金曜日',
		    '土曜日',
		    '日曜日'
		  ][S.day];


		// ------------------------------
		// 全体 / 自分 の表示切替
		// ------------------------------

		const items =
		  S.scope === 'mine'
		    ? day.items.filter(isMineRequest)
		    : day.items;


		// 件数
		E.count.textContent =
		  `${items.length}件`;


		E.msg.hidden = true;


		// カード表示
		if (items.length) {

		  E.list.innerHTML =
		    items
		      .map(card)
		      .join('');

		}
		else {

		  E.list.innerHTML =
		    `
		      <div class="empty">
		        ${
		          S.scope === 'mine'
		            ? 'この日の自分に関係する依頼はありません'
		            : 'この日の依頼情報はありません'
		        }
		      </div>
		    `;

		}

  }


	// ==============================
	// 自分に関係する依頼か判定
	// ==============================

	function isMineRequest(item) {

	  const employeeId =
	    String(
	      S.employee.id || ''
	    ).trim();


	  if (!employeeId) {
	    return false;
	  }


	  const relatedIds = [
	    item.reporterId,
	    item.mainStaffId,
	    item.oldStaffId,
	    item.newStaffId
	  ];


	  return relatedIds.some(id => {

	    return (
	      String(id || '').trim() ===
	      employeeId
	    );

	  });

	}

  // ==============================
  // 依頼カード
  // ==============================

  function card(item) {

    const rows = [];


    // 担当変更
    if (
      item.requestType ===
      '担当変更'
    ) {

      const staffChange =
        [
          item.oldStaffName || '',
          item.newStaffName || ''
        ]
        .filter(Boolean)
        .join(' → ');


      if (staffChange) {

        rows.push([
          '担当変更',
          staffChange
        ]);

      }

    }

    // その他変更
    else if (
      item.requestType ===
      '変更'
    ) {

      if (item.changeContent) {

        rows.push([
          '変更内容',
          item.changeContent
        ]);

      }

    }

    // 通常担当
    else if (
      item.mainStaffName
    ) {

      rows.push([
        '担当',
        item.mainStaffName
      ]);

    }


    // 行先
    if (item.destination) {

      const destination =
        item.appointmentTime
          ? `${item.destination}　予約 ${item.appointmentTime}`
          : item.destination;


      rows.push([
        '行先',
        destination
      ]);

    }


    // 待合せ
    if (item.meetingPlace) {

      rows.push([
        '待合せ',
        item.meetingPlace
      ]);

    }


    // 理由
    if (item.changeReason) {

      rows.push([
        '理由',
        item.changeReason
      ]);

    }


    const metaHtml =
      rows.length
        ? `
          <div class="meta">

            ${
              rows.map(row => `
                <div class="meta-row">

                  <span class="label">
                    ${esc(row[0])}
                  </span>

                  <span class="value">
                    ${esc(row[1])}
                  </span>

                </div>
              `).join('')
            }

          </div>
        `
        : '';


    return `
      <article class="card">

        <div class="top">

          <div class="time">
            ${esc(
              range(
                item.startTime,
                item.endTime
              )
            )}
          </div>

          <div class="name">
            ${esc(
              item.clientName || ''
            )}
          </div>

          <div
            class="badge ${badge(item.requestType)}"
          >
            ${esc(
              item.requestType || ''
            )}
          </div>

        </div>


        <div class="service">

          <b>
            ${esc(
              item.service || ''
            )}
          </b>

          ${esc(
            item.supportContent || ''
          )}

        </div>


        <div class="report">

          <span>
            報告者
          </span>

          <b>
            ${esc(
              item.reporterName || ''
            )}
          </b>

        </div>


        ${metaHtml}


        ${
          item.note
            ? `
              <div class="memo">
                ${esc(item.note)}
              </div>
            `
            : ''
        }

      </article>
    `;

  }


  // ==============================
  // 登録フォーム表示制御
  // ==============================

  function formMode() {

    const type =
      E.type.value;


    E.targetField.hidden =
      type === '追加';


    E.staffFields.hidden =
      type !== '担当変更';


    E.changeField.hidden =
      type !== '変更';

  }


  function resetForm() {

    E.form.reset();

    E.type.value =
      '追加';

    E.saveMsg.hidden =
      true;

    formMode();

  }


  // ==============================
  // メッセージ
  // ==============================

  function saveMsg(
    text,
    isError
  ) {

    E.saveMsg.hidden =
      false;

    E.saveMsg.textContent =
      text;

    E.saveMsg.style.color =
      isError
        ? '#c62828'
        : '#1f2933';

  }


  function message(text) {

    E.list.innerHTML =
      '';

    E.msg.hidden =
      false;

    E.msg.textContent =
      text;

  }


  // ==============================
  // 表示補助
  // ==============================

  function badge(type) {

    if (type === '追加') {
      return 'add';
    }

    if (type === 'キャンセル') {
      return 'cancel';
    }

    if (type === '担当変更') {
      return 'staff';
    }

    return 'change';

  }


  function range(
    start,
    end
  ) {

    if (
      start &&
      end
    ) {

      return `${start}–${end}`;

    }

    return (
      start ||
      end ||
      '時間未定'
    );

  }


  // ==============================
  // ログインユーザー
  // ==============================

  function user() {

    const params =
      new URLSearchParams(
        location.search
      );


    if (
      params.get('employeeId')
    ) {

      return {
        id:
          params.get('employeeId') || '',

        name:
          params.get('employeeName') || ''
      };

    }


    try {

      const currentUser =
        JSON.parse(
          localStorage.getItem(
            'currentUser'
          ) || 'null'
        );


      return {
        id:
          String(
            currentUser?.employeeId ||
            currentUser?.id ||
            ''
          ),

        name:
          String(
            currentUser?.name ||
            currentUser?.employeeName ||
            ''
          )
      };

    }
    catch (_) {

      return {
        id: '',
        name: ''
      };

    }

  }


  // ==============================
  // 日付処理
  // ==============================

  function monday(date) {

    const d =
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );


    const day =
      d.getDay();


    d.setDate(
      d.getDate() +
      (
        day === 0
          ? -6
          : 1 - day
      )
    );


    return dateString(d);

  }


  function todayIndex() {

    const day =
      new Date().getDay();


    return (
      day === 0
        ? 6
        : day - 1
    );

  }


  function dateString(date) {

    return (
      `${date.getFullYear()}-` +
      `${String(date.getMonth() + 1).padStart(2, '0')}-` +
      `${String(date.getDate()).padStart(2, '0')}`
    );

  }


  function label(value) {

    const match =
      String(value || '')
        .match(
          /^\d{4}-(\d{2})-(\d{2})$/
        );


    if (!match) {
      return value || '';
    }


    return (
      `${Number(match[1])}/` +
      `${Number(match[2])}`
    );

  }


  // ==============================
  // HTMLエスケープ
  // ==============================

  function esc(value) {

    return String(value ?? '')
      .replaceAll(
        '&',
        '&amp;'
      )
      .replaceAll(
        '<',
        '&lt;'
      )
      .replaceAll(
        '>',
        '&gt;'
      )
      .replaceAll(
        '"',
        '&quot;'
      )
      .replaceAll(
        "'",
        '&#039;'
      );

  }

  function addRequestDateRow() {

    const rows =
      E.dateList.querySelectorAll(
        '.request-date-row'
      );


    if (rows.length >= 5) {

      alert(
        '一度に登録できる日付は5日までです。'
      );

      return;
    }


    const row =
      document.createElement('div');


    row.className =
      'request-date-row';


    row.innerHTML =
    `
        <input
          type="date"
          class="request-date"
          required
        >

        <button
          type="button"
          class="date-remove-btn"
        >
          ×
        </button>
      `;


    row
      .querySelector(
        '.date-remove-btn'
      )
      .addEventListener(
        'click',
        () => row.remove()
      );


    E.dateList.appendChild(row);

  }

  function getRequestDates() {

    return [
      ...E.dateList.querySelectorAll(
        '.request-date'
      )
    ]
      .map(input =>
        input.value
      )
      .filter(Boolean);

  }

})();