(() => {
  'use strict';


  // ==================================================
  // 状態
  // ==================================================

  const S = {

    // 現在表示週の月曜日
    currentWeekStart:
      monday(new Date()),

    scope:
      'all',

    employee:
      user(),

    day:
      todayIndex(),

    // request.range で取得したデータ
    data:
      null,

    // 読込済み期間
    rangeStart:
      '',

    rangeEnd:
      '',

    // 週切替可能範囲
    minWeekStart:
      '',

    maxWeekStart:
      '',

    masters: {
      clients: [],
      staffs: []
    }

  };


  const $ =
    id =>
      document.getElementById(id);


  const E = {

    week:
      $('weekLabel'),

    nav:
      $('daysNav'),

    title:
      $('dayTitle'),

    count:
      $('dayCount'),

    msg:
      $('message'),

    list:
      $('requestList'),


    scope: [
      ...document.querySelectorAll(
        '.scope-btn'
      )
    ],


    prevWeek:
      $('prevWeek'),

    nextWeek:
      $('nextWeek'),


    open:
      $('openRegister'),

    dialog:
      $('requestDialog'),

    form:
      $('requestForm'),

    close:
      $('closeDialog'),

    cancel:
      $('cancelRegister'),


    type:
      $('requestType'),

    targetField:
      $('targetShiftField'),

    targetId:
      $('targetShiftId'),


    dateList:
      $('requestDateList'),

    addDate:
      $('addRequestDate'),


    client:
      $('clientName'),

    system:
      $('system'),

    service:
      $('service'),


    start:
      $('startTime'),

    end:
      $('endTime'),


    support:
      $('supportContent'),


    main:
      $('mainStaffName'),

    staff2:
      $('staff2Name'),

    staff3:
      $('staff3Name'),


    staffFields:
      $('staffChangeFields'),

    oldStaff:
      $('oldStaffName'),

    newStaff:
      $('newStaffName'),


    changeField:
      $('changeContentField'),

    change:
      $('changeContent'),

    reason:
      $('changeReason'),


    dest:
      $('destination'),

    appt:
      $('appointmentTime'),

    meet:
      $('meetingPlace'),

    note:
      $('note'),


    saveMsg:
      $('saveMessage'),

    save:
      $('saveRequest')

  };


  bindEvents();

  formMode();

  start();


  // ==================================================
  // イベント
  // ==================================================

  function bindEvents() {


    // ------------------------------------------
    // 全体 / 自分
    // 再通信なし
    // ------------------------------------------

    E.scope.forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            if (
              button.dataset.scope ===
                'mine' &&
              !S.employee.id
            ) {

              alert(
                'ログイン中の従業員IDが必要です。'
              );

              return;

            }


            S.scope =
              button.dataset.scope;


            E.scope.forEach(
              x => {

                x.classList.toggle(
                  'active',
                  x === button
                );

              }
            );


            render();

          }
        );

      }
    );


    // ------------------------------------------
    // 前週
    // ------------------------------------------

    E.prevWeek.addEventListener(
      'click',
      () => {
        moveWeek(-1);
      }
    );


    // ------------------------------------------
    // 翌週
    // ------------------------------------------

    E.nextWeek.addEventListener(
      'click',
      () => {
        moveWeek(1);
      }
    );


    // ------------------------------------------
    // ＋登録
    // ------------------------------------------

    E.open.addEventListener(
      'click',
      () => {

        // 過去日は登録禁止
        const selectedDate =
          addDaysString(
            S.currentWeekStart,
            S.day
          );


        if (
          isPastDate(
            selectedDate
          )
        ) {

          alert(
            '昨日以前の日付には依頼を登録できません。'
          );

          return;

        }


        resetForm();


        // 選択中の日付を
        // 最初の対象日に設定
        const firstDate =
          E.dateList.querySelector(
            '.request-date'
          );


        if (firstDate) {

          firstDate.value =
            selectedDate;

        }


        E.dialog.showModal();

      }
    );


    E.close.addEventListener(
      'click',
      () =>
        E.dialog.close()
    );


    E.cancel.addEventListener(
      'click',
      () =>
        E.dialog.close()
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


    // ------------------------------------------
    // 曜日ボタン
    // ------------------------------------------

    [
      ...E.nav.querySelectorAll(
        '.day-btn'
      )
    ]
      .forEach(
        button => {

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

        }
      );

  }


  // ==================================================
  // 初期処理
  // ==================================================

  async function start() {

    try {

      await loadMasters();

      await loadRange();

    }
    catch (err) {

      message(
        '依頼情報を取得できませんでした。\n' +
        (
          err?.message ||
          err
        )
      );

    }

  }


  // ==================================================
  // GAS通信
  // ==================================================

  async function api(
    payload
  ) {

    const url =
      String(
        window.REQUEST_APP?.GAS_URL ||
        ''
      ).trim();


    if (
      !url.endsWith(
        '/exec'
      )
    ) {

      throw new Error(
        'request-view-config.js のGAS_URLを確認してください。'
      );

    }


    const response =
      await fetch(
        url,
        {

          method:
            'POST',

          headers: {
            'Content-Type':
              'text/plain;charset=utf-8'
          },

          body:
            JSON.stringify(
              payload
            ),

          redirect:
            'follow'

        }
      );


    if (
      !response.ok
    ) {

      throw new Error(
        'HTTP ' +
        response.status
      );

    }


    return response.json();

  }


  // ==================================================
  // 利用者・従業員マスタ
  // ==================================================

  async function loadMasters() {

    const result =
      await api({
        action:
          'request.masters'
      });


    if (
      !result?.ok
    ) {

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

    E.client.innerHTML =
      `
        <option value="">
          選択してください
        </option>
      ` +
      S.masters.clients
        .map(
          item => `
            <option
              value="${esc(item.id)}"
              data-name="${esc(item.name)}"
            >
              ${esc(item.name)}
            </option>
          `
        )
        .join('');

  }


  function setStaffOptions() {

    const html =
      `
        <option value="">
          選択してください
        </option>
      ` +
      S.masters.staffs
        .map(
          item => `
            <option
              value="${esc(item.id)}"
              data-name="${esc(item.name)}"
            >
              ${esc(item.name)}
            </option>
          `
        )
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


  function selectedMaster(
    select
  ) {

    const option =
      select.options[
        select.selectedIndex
      ];


    if (!option) {

      return {
        id: '',
        name: ''
      };

    }


    return {

      id:
        String(
          option.value || ''
        ).trim(),

      name:
        String(
          option.dataset.name || ''
        ).trim()

    };

  }


  // ==================================================
  // 依頼情報
  // 現在週の前週 ～ 約3か月先を1回取得
  // ==================================================

  async function loadRange() {

    message(
      '依頼情報を取得しています...'
    );


    const todayWeek =
      monday(
        new Date()
      );


    // 前週から
    S.rangeStart =
      addDaysString(
        todayWeek,
        -7
      );


    // 3か月先の日が属する週の日曜日まで
    const threeMonthsLater =
      addMonthsString(
        todayWeek,
        3
      );


    S.rangeEnd =
      addDaysString(
        monday(
          parseDateString(
            threeMonthsLater
          )
        ),
        6
      );


    const result =
      await api({

        action:
          'request.range',

        startDate:
          S.rangeStart,

        endDate:
          S.rangeEnd

      });


    if (
      !result?.ok
    ) {

      throw new Error(
        result?.message ||
        result?.error ||
        'GASエラー'
      );

    }


    S.data =
      result;


    S.minWeekStart =
      monday(
        parseDateString(
          S.rangeStart
        )
      );


    S.maxWeekStart =
      monday(
        parseDateString(
          S.rangeEnd
        )
      );


    render();

  }


  // ==================================================
  // 前週 / 翌週
  // 読込済み範囲なら再通信なし
  // ==================================================

  function moveWeek(
    offset
  ) {

    const next =
      addDaysString(
        S.currentWeekStart,
        offset * 7
      );


    if (
      next <
        S.minWeekStart ||
      next >
        S.maxWeekStart
    ) {

      return;

    }


    S.currentWeekStart =
      next;


    render();

  }


  // ==================================================
  // 現在表示週
  // ==================================================

  function getCurrentWeekDays() {

    const weekdays = [
      '月',
      '火',
      '水',
      '木',
      '金',
      '土',
      '日'
    ];


    return weekdays.map(
      (
        weekday,
        index
      ) => {

        const date =
          addDaysString(
            S.currentWeekStart,
            index
          );


        const items =
          (
            S.data?.items ||
            []
          )
            .filter(
              item =>
                item.date ===
                date
            )
            .sort(
              (
                a,
                b
              ) => {

                const ta =
                  timeSortValue(
                    a.startTime
                  );


                const tb =
                  timeSortValue(
                    b.startTime
                  );


                if (
                  ta !== tb
                ) {

                  return (
                    ta - tb
                  );

                }


                return String(
                  a.clientName || ''
                )
                  .localeCompare(
                    String(
                      b.clientName || ''
                    ),
                    'ja'
                  );

              }
            );


        return {

          weekday:
            weekday,

          date:
            date,

          dateLabel:
            label(
              date
            ),

          items:
            items

        };

      }
    );

  }


  // ==================================================
  // 描画
  // ==================================================

  function render() {

    if (!S.data) {
      return;
    }


    const weekDays =
      getCurrentWeekDays();


    E.week.textContent =
      `${label(
        weekDays[0].date
      )}〜${label(
        weekDays[6].date
      )}`;


    const dayButtons =
      [
        ...E.nav.querySelectorAll(
          '.day-btn'
        )
      ];


    dayButtons.forEach(
      (
        button,
        index
      ) => {

        const day =
          weekDays[index];


        button.classList.toggle(
          'active',
          index === S.day
        );


        button.classList.toggle(
          'saturday',
          index === 5
        );


        button.classList.toggle(
          'sunday',
          index === 6
        );


        button.classList.toggle(
          'today',
          day.date ===
            todayString()
        );


        // 昨日以前はグレー
        button.classList.toggle(
          'past',
          isPastDate(
            day.date
          )
        );


        button.innerHTML =
          `
            ${esc(
              day.weekday
            )}

            <span class="date">
              ${esc(
                day.dateLabel
              )}
            </span>
          `;

      }
    );


    E.prevWeek.disabled =
      S.currentWeekStart <=
      S.minWeekStart;


    E.nextWeek.disabled =
      S.currentWeekStart >=
      S.maxWeekStart;


    const day =
      weekDays[
        S.day
      ];


    if (!day) {
      return;
    }


    const isPastDay =
      isPastDate(
        day.date
      );


    // 過去日表示中は登録不可
    E.open.disabled =
      isPastDay;


    E.title.textContent =
      [
        '月曜日',
        '火曜日',
        '水曜日',
        '木曜日',
        '金曜日',
        '土曜日',
        '日曜日'
      ][
        S.day
      ];


    const items =
      S.scope ===
        'mine'
        ? day.items.filter(
            isMineRequest
          )
        : day.items;


    E.count.textContent =
      `${items.length}件`;


    E.msg.hidden =
      true;


    if (
      items.length
    ) {

      E.list.innerHTML =
        items
          .map(
            item =>
              card(
                item,
                isPastDay
              )
          )
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


  // ==================================================
  // 自分の依頼
  // ==================================================

  function isMineRequest(
    item
  ) {

    const employeeId =
      String(
        S.employee.id ||
        ''
      ).trim();


    if (!employeeId) {

      return false;

    }


    return [

      item.reporterId,

      item.mainStaffId,

      item.staff2Id,

      item.staff3Id,

      item.oldStaffId,

      item.newStaffId

    ]
      .some(
        id =>
          String(
            id || ''
          ).trim() ===
          employeeId
      );

  }


  // ==================================================
  // カード
  // ==================================================

  function card(
    item,
    isPastDay
  ) {

    const rows =
      [];


    if (
      item.requestType ===
      '担当変更'
    ) {

      const staffChange =
        [
          item.oldStaffName ||
            '',

          item.newStaffName ||
            ''
        ]
          .filter(
            Boolean
          )
          .join(
            ' → '
          );


      if (
        staffChange
      ) {

        rows.push([
          '担当変更',
          staffChange
        ]);

      }

    }

    else if (
      item.requestType ===
      '変更'
    ) {

      if (
        item.changeContent
      ) {

        rows.push([
          '変更内容',
          item.changeContent
        ]);

      }

    }

    else {

      // 主担当・担当2・担当3を横並び
      const staffNames =
        [
          item.mainStaffName,
          item.staff2Name,
          item.staff3Name
        ]
          .filter(
            Boolean
          );


      if (
        staffNames.length
      ) {

        rows.push([
          '担当',
          staffNames.join(
            '　'
          )
        ]);

      }

    }


    if (
      item.destination
    ) {

      const destination =
        item.appointmentTime
          ? `${item.destination}　予約 ${item.appointmentTime}`
          : item.destination;


      rows.push([
        '行先',
        destination
      ]);

    }


    if (
      item.meetingPlace
    ) {

      rows.push([
        '待合せ',
        item.meetingPlace
      ]);

    }


    if (
      item.changeReason
    ) {

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
              rows
                .map(
                  row => `
                    <div class="meta-row">

                      <span class="label">
                        ${esc(
                          row[0]
                        )}
                      </span>

                      <span class="value">
                        ${esc(
                          row[1]
                        )}
                      </span>

                    </div>
                  `
                )
                .join('')
            }

          </div>
        `
        : '';


    return `
      <article
        class="card${isPastDay ? ' past' : ''}"
      >

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
              item.clientName ||
              ''
            )}

          </div>


          <div
            class="badge ${badge(
              item.requestType
            )}"
          >

            ${esc(
              item.requestType ||
              ''
            )}

          </div>

        </div>


        <div class="service">

          <b>
            ${esc(
              item.service ||
              ''
            )}
          </b>

          ${esc(
            item.supportContent ||
            ''
          )}

        </div>


        <div class="report">

          <span>
            報告者
          </span>

          <b>
            ${esc(
              item.reporterName ||
              ''
            )}
          </b>

        </div>


        ${metaHtml}


        ${
          item.note
            ? `
              <div class="memo">
                ${esc(
                  item.note
                )}
              </div>
            `
            : ''
        }

      </article>
    `;

  }


  // ==================================================
  // 登録処理
  // ==================================================

  async function saveRequest(
    event
  ) {

    event.preventDefault();


    const type =
      E.type.value;


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


    if (
      type ===
        '担当変更' &&
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


    const client =
      selectedMaster(
        E.client
      );


    const mainStaff =
      selectedMaster(
        E.main
      );


    const staff2 =
      selectedMaster(
        E.staff2
      );


    const staff3 =
      selectedMaster(
        E.staff3
      );


    const oldStaff =
      selectedMaster(
        E.oldStaff
      );


    const newStaff =
      selectedMaster(
        E.newStaff
      );


    const targetDates =
      getRequestDates();


    if (
      !targetDates.length
    ) {

      saveMsg(
        '対象日を入力してください。',
        true
      );

      return;

    }


    // 念のため、登録対象に過去日が含まれていないか確認
    if (
      targetDates.some(
        isPastDate
      )
    ) {

      saveMsg(
        '昨日以前の日付には依頼を登録できません。',
        true
      );

      return;

    }


    E.save.disabled =
      true;


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
            E.note.value.trim(),

          registerMethod:
            'WEB'

        });


      if (
        !result?.ok
      ) {

        throw new Error(
          result?.message ||
          result?.error ||
          '登録失敗'
        );

      }


      let resultText =
        result.message ||
        '登録しました。';


      if (
        Array.isArray(
          result.requestIds
        ) &&
        result.requestIds.length
      ) {

        resultText +=
          '\n' +
          result.requestIds.join(
            ' / '
          );

      }
      else if (
        result.requestId
      ) {

        resultText +=
          '\n' +
          result.requestId;

      }


      saveMsg(
        resultText,
        false
      );


      // 登録後だけ最新範囲を再取得
      await loadRange();


      setTimeout(
        () =>
          E.dialog.close(),
        700
      );

    }
    catch (err) {

      saveMsg(
        '登録できませんでした。\n' +
        (
          err?.message ||
          err
        ),
        true
      );

    }
    finally {

      E.save.disabled =
        false;

    }

  }


  // ==================================================
  // 登録フォーム表示制御
  // ==================================================

  function formMode() {

    const type =
      E.type.value;


    E.targetField.hidden =
      type === '追加';


    E.staffFields.hidden =
      type !==
      '担当変更';


    E.changeField.hidden =
      type !==
      '変更';

  }


  function resetForm() {

    E.form.reset();


    E.type.value =
      '追加';


    E.saveMsg.hidden =
      true;


    const rows =
      [
        ...E.dateList.querySelectorAll(
          '.request-date-row'
        )
      ];


    rows.forEach(
      (
        row,
        index
      ) => {

        if (
          index === 0
        ) {

          const input =
            row.querySelector(
              '.request-date'
            );


          if (input) {

            input.value =
              '';

          }

        }
        else {

          row.remove();

        }

      }
    );


    formMode();

  }


  // ==================================================
  // 複数日
  // ==================================================

  function addRequestDateRow() {

    const rows =
      E.dateList.querySelectorAll(
        '.request-date-row'
      );


    if (
      rows.length >= 5
    ) {

      alert(
        '一度に登録できる日付は5日までです。'
      );

      return;

    }


    const row =
      document.createElement(
        'div'
      );


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
        () =>
          row.remove()
      );


    E.dateList.appendChild(
      row
    );

  }


  function getRequestDates() {

    return [
      ...E.dateList.querySelectorAll(
        '.request-date'
      )
    ]
      .map(
        input =>
          input.value
      )
      .filter(
        Boolean
      );

  }


  // ==================================================
  // 表示補助
  // ==================================================

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


  function message(
    text
  ) {

    E.list.innerHTML =
      '';


    E.msg.hidden =
      false;


    E.msg.textContent =
      text;

  }


  function badge(
    type
  ) {

    if (
      type === '追加'
    ) {

      return 'add';

    }


    if (
      type ===
      'キャンセル'
    ) {

      return 'cancel';

    }


    if (
      type ===
      '担当変更'
    ) {

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

      return (
        `${start}–${end}`
      );

    }


    return (
      start ||
      end ||
      '時間未定'
    );

  }


  function timeSortValue(
    value
  ) {

    const match =
      String(
        value || ''
      )
        .match(
          /^(\d{1,2}):(\d{2})$/
        );


    if (!match) {

      return 99999;

    }


    return (
      Number(
        match[1]
      ) * 60 +
      Number(
        match[2]
      )
    );

  }


  // ==================================================
  // ログインユーザー
  // ==================================================

  function user() {

    const params =
      new URLSearchParams(
        location.search
      );


    if (
      params.get(
        'employeeId'
      )
    ) {

      return {

        id:
          params.get(
            'employeeId'
          ) ||
          '',

        name:
          params.get(
            'employeeName'
          ) ||
          ''

      };

    }


    try {

      const currentUser =
        JSON.parse(
          localStorage.getItem(
            'currentUser'
          ) ||
          'null'
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


  // ==================================================
  // 日付
  // ==================================================

  function monday(
    date
  ) {

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


    return dateString(
      d
    );

  }


  function todayIndex() {

    const day =
      new Date()
        .getDay();


    return (
      day === 0
        ? 6
        : day - 1
    );

  }


  function todayString() {

    return dateString(
      new Date()
    );

  }


  function isPastDate(
    value
  ) {

    return (
      String(
        value || ''
      ) <
      todayString()
    );

  }


  function dateString(
    date
  ) {

    return (
      `${date.getFullYear()}-` +
      `${String(
        date.getMonth() + 1
      ).padStart(
        2,
        '0'
      )}-` +
      `${String(
        date.getDate()
      ).padStart(
        2,
        '0'
      )}`
    );

  }


  function parseDateString(
    value
  ) {

    const match =
      String(
        value || ''
      )
        .match(
          /^(\d{4})-(\d{2})-(\d{2})$/
        );


    if (!match) {

      throw new Error(
        '日付形式が正しくありません: ' +
        value
      );

    }


    return new Date(
      Number(
        match[1]
      ),
      Number(
        match[2]
      ) - 1,
      Number(
        match[3]
      )
    );

  }


  function addDaysString(
    value,
    days
  ) {

    const date =
      parseDateString(
        value
      );


    date.setDate(
      date.getDate() +
      days
    );


    return dateString(
      date
    );

  }


  function addMonthsString(
    value,
    months
  ) {

    const date =
      parseDateString(
        value
      );


    date.setMonth(
      date.getMonth() +
      months
    );


    return dateString(
      date
    );

  }


  function label(
    value
  ) {

    const match =
      String(
        value || ''
      )
        .match(
          /^\d{4}-(\d{2})-(\d{2})$/
        );


    if (!match) {

      return (
        value || ''
      );

    }


    return (
      `${Number(
        match[1]
      )}/` +
      `${Number(
        match[2]
      )}`
    );

  }


  // ==================================================
  // HTMLエスケープ
  // ==================================================

  function esc(
    value
  ) {

    return String(
      value ??
      ''
    )
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

})();
