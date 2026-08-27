(() => {
  'use strict';


  // ==================================================
  // 画面状態
  // ==================================================
  //
  // weekStart:
  //   今表示している週の月曜日
  //
  // scope:
  //   all  = 全体
  //   mine = 自分
  //
  // employee:
  //   ログイン中の従業員情報
  //
  // day:
  //   0=月 ～ 6=日
  //
  // data:
  //   request.week で取得した1週間分
  //
  // masters:
  //   利用者M・従業員M
  // ==================================================

  const S = {

    weekStart:
      monday(new Date()),

    scope:
      'all',

    employee:
      user(),

    day:
      todayIndex(),

    data:
      null,

    masters: {
      clients: [],
      staffs: []
    }

  };


  // ==================================================
  // DOM取得
  // ==================================================

  const $ =
    id =>
      document.getElementById(id);


  const E = {

    // ------------------------------
    // 一覧画面
    // ------------------------------

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


    // ------------------------------
    // 全体 / 自分
    // ------------------------------

    scope: [
      ...document.querySelectorAll(
        '.scope-btn'
      )
    ],


    // ------------------------------
    // 登録ダイアログ
    // ------------------------------

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


    // ------------------------------
    // 基本入力
    // ------------------------------

    type:
      $('requestType'),

    targetField:
      $('targetShiftField'),

    targetId:
      $('targetShiftId'),


    // ------------------------------
    // 複数日
    // ------------------------------

    dateList:
      $('requestDateList'),

    addDate:
      $('addRequestDate'),


    // ------------------------------
    // 利用者
    // ------------------------------

    client:
      $('clientName'),


    // ------------------------------
    // 制度・サービス
    // ------------------------------

    system:
      $('system'),

    service:
      $('service'),


    // ------------------------------
    // 時間
    // ------------------------------

    start:
      $('startTime'),

    end:
      $('endTime'),


    // ------------------------------
    // 支援内容
    // ------------------------------

    support:
      $('supportContent'),


    // ------------------------------
    // 担当
    // ------------------------------

    main:
      $('mainStaffName'),

    staff2:
      $('staff2Name'),

    staff3:
      $('staff3Name'),


    // ------------------------------
    // 担当変更
    // ------------------------------

    staffFields:
      $('staffChangeFields'),

    oldStaff:
      $('oldStaffName'),

    newStaff:
      $('newStaffName'),


    // ------------------------------
    // その他変更
    // ------------------------------

    changeField:
      $('changeContentField'),

    change:
      $('changeContent'),

    reason:
      $('changeReason'),


    // ------------------------------
    // 外出・通院
    // ------------------------------

    dest:
      $('destination'),

    appt:
      $('appointmentTime'),

    meet:
      $('meetingPlace'),


    // ------------------------------
    // 備考
    // ------------------------------

    note:
      $('note'),


    // ------------------------------
    // 登録結果
    // ------------------------------

    saveMsg:
      $('saveMessage'),

    save:
      $('saveRequest')

  };


  // ==================================================
  // イベント
  // ==================================================


  // --------------------------------------------------
  // 全体 / 自分
  //
  // ここではGASへ再通信しません。
  // 最初に取得した「全体」の1週間分から、
  // ブラウザ側で自分だけを絞り込みます。
  // --------------------------------------------------

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


          // 通信せず再描画
          render();

        }
      );

    }
  );


  // --------------------------------------------------
  // ＋登録
  // --------------------------------------------------

  E.open.addEventListener(
    'click',
    () => {

      // フォーム初期化
      resetForm();


      // 現在選択中の曜日の日付を
      // 1つ目の対象日に入れる
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

    }
  );


  // --------------------------------------------------
  // 閉じる
  // --------------------------------------------------

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


  // --------------------------------------------------
  // 依頼区分変更
  // --------------------------------------------------

  E.type.addEventListener(
    'change',
    formMode
  );


  // --------------------------------------------------
  // 登録
  // --------------------------------------------------

  E.form.addEventListener(
    'submit',
    saveRequest
  );


  // --------------------------------------------------
  // 対象日追加
  // --------------------------------------------------

  E.addDate.addEventListener(
    'click',
    addRequestDateRow
  );


  // ==================================================
  // 初期処理
  // ==================================================

  formMode();

  start();


  async function start() {

    try {

      // 利用者・従業員マスタ
      await loadMasters();


      // 依頼情報
      await load();

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
      !url.endsWith('/exec')
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


    // プルダウン反映
    setClientOptions();

    setStaffOptions();

  }


  // --------------------------------------------------
  // 利用者プルダウン
  // --------------------------------------------------

  function setClientOptions() {

    const html =
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


    E.client.innerHTML =
      html;

  }


  // --------------------------------------------------
  // 従業員プルダウン
  //
  // 同じ従業員Mを
  // 主担当・担当2・担当3
  // 変更前担当・変更後担当
  // に使用します。
  // --------------------------------------------------

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


  // --------------------------------------------------
  // 選択されたマスタの
  // ID + 氏名を取得
  // --------------------------------------------------

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
  // 週間依頼情報読み込み
  // ==================================================

  async function load() {

    message(
      '依頼情報を取得しています...'
    );


    // 常に全体を1回取得
    const result =
      await api({

        action:
          'request.week',

        weekStart:
          S.weekStart,

        scope:
          'all',

        employeeId:
          ''

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


    render();

  }


  // ==================================================
  // 依頼登録
  // ==================================================

  async function saveRequest(
    event
  ) {

    event.preventDefault();


    const type =
      E.type.value;


    // ------------------------------------------------
    // 追加以外は対象シフトID必須
    // ------------------------------------------------

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


    // ------------------------------------------------
    // 担当変更チェック
    // ------------------------------------------------

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


    // ------------------------------------------------
    // プルダウン値
    // ------------------------------------------------

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


    // ------------------------------------------------
    // 複数日
    // ------------------------------------------------

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


    // ------------------------------------------------
    // 登録開始
    // ------------------------------------------------

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


          // ============================
          // 依頼区分
          // ============================

          requestType:
            type,


          // ============================
          // 対象シフト
          // ============================

          targetShiftId:
            E.targetId.value.trim(),


          // ============================
          // 報告者
          // ============================

          reporterId:
            S.employee.id,

          reporterName:
            S.employee.name,


          // ============================
          // 利用者
          // ============================

          clientId:
            client.id,

          clientName:
            client.name,


          // ============================
          // 制度・サービス
          // ============================

          system:
            E.system.value,

          service:
            E.service.value.trim(),


          // ============================
          // 複数日
          // ============================

          targetDates:
            targetDates,


          // ============================
          // 時間
          // ============================

          startTime:
            E.start.value,

          endTime:
            E.end.value,


          // ============================
          // 主担当
          // ============================

          mainStaffId:
            mainStaff.id,

          mainStaffName:
            mainStaff.name,


          // ============================
          // 担当2
          // ============================

          staff2Id:
            staff2.id,

          staff2Name:
            staff2.name,


          // ============================
          // 担当3
          // ============================

          staff3Id:
            staff3.id,

          staff3Name:
            staff3.name,


          // ============================
          // 担当変更
          // ============================

          oldStaffId:
            oldStaff.id,

          oldStaffName:
            oldStaff.name,

          newStaffId:
            newStaff.id,

          newStaffName:
            newStaff.name,


          // ============================
          // 行先
          // ============================

          destination:
            E.dest.value.trim(),

          appointmentTime:
            E.appt.value,

          meetingPlace:
            E.meet.value.trim(),


          // ============================
          // 支援内容
          // ============================

          supportContent:
            E.support.value.trim(),


          // ============================
          // 変更内容
          // ============================

          changeContent:
            E.change.value.trim(),

          changeReason:
            E.reason.value.trim(),


          // ============================
          // 備考
          // ============================

          note:
            E.note.value.trim(),


          // ============================
          // 登録方法
          // ============================

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


      // ------------------------------------------------
      // 登録成功
      // ------------------------------------------------

      let resultText =
        result.message ||
        '登録しました。';


      // 複数IDが返っている場合
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


      // 登録後だけ最新情報を再読込
      await load();


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
  // 画面描画
  // ==================================================

  function render() {

    const days =
      S.data?.days || [];


    if (
      !days.length
    ) {

      message(
        '対象週のデータがありません。'
      );

      return;

    }


    // ------------------------------------------------
    // 週表示
    // ------------------------------------------------

    E.week.textContent =
      `${label(days[0].date)}〜${label(days[6].date)}`;


    // ------------------------------------------------
    // 曜日ボタン
    // ------------------------------------------------

    E.nav.innerHTML =
      days
        .map(
          (
            day,
            index
          ) => {

            const classes =
              ['day-btn'];


            if (
              index === S.day
            ) {

              classes.push(
                'active'
              );

            }


            if (
              index === 5
            ) {

              classes.push(
                'saturday'
              );

            }


            if (
              index === 6
            ) {

              classes.push(
                'sunday'
              );

            }


            if (
              day.date ===
              dateString(
                new Date()
              )
            ) {

              classes.push(
                'today'
              );

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

          }
        )
        .join('');


    // ------------------------------------------------
    // 曜日選択
    // ------------------------------------------------

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


    // ------------------------------------------------
    // 選択日
    // ------------------------------------------------

    const day =
      days[S.day];


    if (!day) {
      return;
    }


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


    // ------------------------------------------------
    // 全体 / 自分
    // ------------------------------------------------

    const items =
      S.scope === 'mine'
        ? day.items.filter(
            isMineRequest
          )
        : day.items;


    // ------------------------------------------------
    // 件数
    // ------------------------------------------------

    E.count.textContent =
      `${items.length}件`;


    E.msg.hidden =
      true;


    // ------------------------------------------------
    // カード
    // ------------------------------------------------

    if (
      items.length
    ) {

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


  // ==================================================
  // 自分に関係する依頼
  // ==================================================

  function isMineRequest(
    item
  ) {

    const employeeId =
      String(
        S.employee.id || ''
      ).trim();


    if (
      !employeeId
    ) {

      return false;

    }


    // 主担当だけでなく
    // 担当2・担当3も含める
    const relatedIds = [

      item.reporterId,

      item.mainStaffId,

      item.staff2Id,

      item.staff3Id,

      item.oldStaffId,

      item.newStaffId

    ];


    return relatedIds.some(
      id =>
        String(
          id || ''
        ).trim() ===
        employeeId
    );

  }


  // ==================================================
  // 依頼カード
  // ==================================================

  function card(
    item
  ) {

    const rows =
      [];


    // ------------------------------------------------
    // 担当変更
    // ------------------------------------------------

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


    // ------------------------------------------------
    // その他変更
    // ------------------------------------------------

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


    // ------------------------------------------------
    // 通常担当
    //
    // 主担当・担当2・担当3を
    // 1行に表示
    // ------------------------------------------------

    else {

      const staffNames =
        [
          item.mainStaffName,
          item.staff2Name,
          item.staff3Name
        ]
          .filter(Boolean);


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


    // ------------------------------------------------
    // 行先
    // ------------------------------------------------

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


    // ------------------------------------------------
    // 待合せ
    // ------------------------------------------------

    if (
      item.meetingPlace
    ) {

      rows.push([
        '待合せ',
        item.meetingPlace
      ]);

    }


    // ------------------------------------------------
    // 理由
    // ------------------------------------------------

    if (
      item.changeReason
    ) {

      rows.push([
        '理由',
        item.changeReason
      ]);

    }


    // ------------------------------------------------
    // 詳細行
    // ------------------------------------------------

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
                        ${esc(row[0])}
                      </span>

                      <span class="value">
                        ${esc(row[1])}
                      </span>

                    </div>
                  `
                )
                .join('')
            }

          </div>
        `
        : '';


    // ------------------------------------------------
    // カードHTML
    // ------------------------------------------------

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
  // フォーム表示制御
  // ==================================================

  function formMode() {

    const type =
      E.type.value;


    // 追加では対象シフトID不要
    E.targetField.hidden =
      type === '追加';


    // 担当変更だけ表示
    E.staffFields.hidden =
      type !== '担当変更';


    // 変更だけ表示
    E.changeField.hidden =
      type !== '変更';

  }


  // ==================================================
  // フォーム初期化
  // ==================================================

  function resetForm() {

    E.form.reset();


    E.type.value =
      '追加';


    E.saveMsg.hidden =
      true;


    // 追加された日付欄を
    // 1行だけに戻す
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
  // 複数日追加
  // ==================================================

  function addRequestDateRow() {

    const rows =
      E.dateList.querySelectorAll(
        '.request-date-row'
      );


    // 最大5日
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


    // 削除
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


  // ==================================================
  // 複数日取得
  // ==================================================

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
      .filter(Boolean);

  }


  // ==================================================
  // 登録メッセージ
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


  // ==================================================
  // 一覧メッセージ
  // ==================================================

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


  // ==================================================
  // バッジ
  // ==================================================

  function badge(
    type
  ) {

    if (
      type === '追加'
    ) {

      return 'add';

    }


    if (
      type === 'キャンセル'
    ) {

      return 'cancel';

    }


    if (
      type === '担当変更'
    ) {

      return 'staff';

    }


    return 'change';

  }


  // ==================================================
  // 時間表示
  // ==================================================

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


  // ==================================================
  // ログインユーザー
  // ==================================================

  function user() {

    const params =
      new URLSearchParams(
        location.search
      );


    // URL指定があれば優先
    if (
      params.get(
        'employeeId'
      )
    ) {

      return {

        id:
          params.get(
            'employeeId'
          ) || '',

        name:
          params.get(
            'employeeName'
          ) || ''

      };

    }


    // PORTALのcurrentUser
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
  // 今週月曜日
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


  // ==================================================
  // 今日の曜日index
  // ==================================================

  function todayIndex() {

    const day =
      new Date().getDay();


    return (
      day === 0
        ? 6
        : day - 1
    );

  }


  // ==================================================
  // yyyy-mm-dd
  // ==================================================

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


  // ==================================================
  // M/D表示
  // ==================================================

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
      value ?? ''
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