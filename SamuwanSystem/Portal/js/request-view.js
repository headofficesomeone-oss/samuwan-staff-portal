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
    },

    cancelTargets: [],

    actionMap: {},

    staffChangeShift:
      null,

    latestItems:
      []

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

    cancelPicker:
      $('cancelTargetPicker'),

    loadCancelTargets:
      $('loadCancelTargets'),

    cancelTargetStatus:
      $('cancelTargetStatus'),

    cancelTargetList:
      $('cancelTargetList'),


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


    people:
      $('people'),

    main:
      $('mainStaffName'),

    staff2:
      $('staff2Name'),

    staff3:
      $('staff3Name'),

    outDriver:
      $('outDriverName'),

    backDriver:
      $('backDriverName'),


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
      $('saveRequest'),


    staffChangeDialog:
      $('staffChangeDialog'),

    staffChangeForm:
      $('staffChangeForm'),

    closeStaffChangeDialog:
      $('closeStaffChangeDialog'),

    cancelStaffChange:
      $('cancelStaffChange'),

    staffChangeMsg:
      $('staffChangeMessage'),

    currentPeople:
      $('currentPeople'),

    currentMainStaff:
      $('currentMainStaff'),

    currentStaff2:
      $('currentStaff2'),

    currentStaff3:
      $('currentStaff3'),

    currentOutDriver:
      $('currentOutDriver'),

    currentBackDriver:
      $('currentBackDriver'),

    staffChangeFieldSelect:
      $('staffChangeField'),

    staffChangeOldValue:
      $('staffChangeOldValue'),

    staffChangeNewStaff:
      $('staffChangeNewStaff'),

    staffChangeReason:
      $('staffChangeReason'),

    saveStaffChange:
      $('saveStaffChange'),


    historyDialog:
      $('historyDialog'),

    closeHistoryDialog:
      $('closeHistoryDialog'),

    historySummary:
      $('historySummary'),

    historyList:
      $('historyList')

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
      () => {

        formMode();

        clearCancelTargets_();

      }
    );


    E.loadCancelTargets.addEventListener(
      'click',
      loadCancelTargets_
    );


    E.client.addEventListener(
      'change',
      () => {

        if (
          E.type.value === 'キャンセル' ||
          E.type.value === '依頼取消'
        ) {

          clearCancelTargets_();

        }

      }
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
    // 一覧カード操作
    // ------------------------------------------

    E.list.addEventListener(
      'click',
      event => {

        const button =
          event.target.closest(
            '.card-action-btn'
          );


        if (!button) {
          return;
        }


        const action =
          button.dataset.action;


        const requestId =
          button.dataset.requestId ||
          '';


        const shiftId =
          button.dataset.shiftId ||
          '';


        if (
          action === 'withdraw'
        ) {

          withdrawFromList_(
            requestId
          );

        }
        else if (
          action === 'cancel'
        ) {

          cancelFromList_(
            shiftId
          );

        }
        else if (
          action === 'staffchange'
        ) {

          openStaffChangeFromList_(
            shiftId
          );

        }
        else if (
          action === 'detail'
        ) {

          openHistoryFromList_(
            requestId
          );

        }

      }
    );


    E.closeHistoryDialog.addEventListener(
      'click',
      () =>
        E.historyDialog.close()
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


    E.staffChangeFieldSelect.addEventListener(
      'change',
      refreshStaffChangeOldValue_
    );


    E.staffChangeForm.addEventListener(
      'submit',
      saveStaffChangeFromList_
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

      await Promise.all([
        loadMasters(),
        loadRange()
      ]);

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


    const result =
      await response.json();

    const action =
      String(
        payload?.action || ''
      ).trim();

    if (
      result?.ok &&
      (
        action.includes('.save') ||
        action.includes('.apply') ||
        action.includes('.multi') ||
        action.includes('.confirm')
      )
    ) {
      if (
        action.startsWith('request.')
      ) {
        window.SamuwanLocalData
          ?.removePrefix(
            'request-range:'
          );
      }

      if (
        action.startsWith('shift.') ||
        action.startsWith('week.')
      ) {
        window.SamuwanLocalData
          ?.removePrefix(
            'shift-week:'
          );
      }
    }

    return result;

  }


  // ==================================================
  // 利用者・従業員マスタ
  // ==================================================

  async function loadMasters() {

    const cache =
      window.SamuwanLocalData
        ?.get('masters');

    if (cache?.ok) {
      S.masters.clients =
        cache.clients || [];

      S.masters.staffs =
        cache.staffs || [];

      setClientOptions();
      setStaffOptions();
    }

    const result =
      await api({
        action:
          'request.masters'
      });

    if (!result?.ok) {
      if (cache?.ok) {
        return;
      }

      throw new Error(
        result?.message ||
        result?.error ||
        'マスタ取得エラー'
      );
    }

    window.SamuwanLocalData
      ?.setIfChanged(
        'masters',
        result
      );

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

    E.outDriver.innerHTML =
      html;

    E.backDriver.innerHTML =
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

    const todayWeek =
      monday(
        new Date()
      );

    S.rangeStart =
      addDaysString(
        todayWeek,
        -7
      );

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

    const cacheKey =
      window.SamuwanLocalData
        ?.requestRangeKey(
          S.rangeStart,
          S.rangeEnd
        ) ||
      (
        'request-range:' +
        S.rangeStart +
        ':' +
        S.rangeEnd
      );

    const cached =
      window.SamuwanLocalData
        ?.get(
          cacheKey
        );

    if (cached?.ok) {
      S.data =
        cached;

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

      /*
       * 保存済み一覧を即表示。
       * 「取得しています...」を出さない。
       */
      render();
    } else {
      message(
        '依頼情報を取得しています...'
      );
    }

    const result =
      await api({
        action:
          'request.range',

        startDate:
          S.rangeStart,

        endDate:
          S.rangeEnd
      });

    if (!result?.ok) {
      if (cached?.ok) {
        return;
      }

      throw new Error(
        result?.message ||
        result?.error ||
        'GASエラー'
      );
    }

    const cacheResult =
      window.SamuwanLocalData
        ?.setIfChanged(
          cacheKey,
          result
        );

    S.data =
      result;

    try {
      await loadActionability_();
    }
    catch (actionErr) {
      console.warn(
        '一覧操作判定を取得できませんでした。',
        actionErr
      );

      S.actionMap =
        {};
    }

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

    /*
     * 変更があった時だけ実データの差し替えが発生。
     * 操作可否は毎回最新化するためrenderは行う。
     */
    render();

  }

  // ==================================================
  // 一覧カード操作可否
  // ==================================================

  async function loadActionability_() {

    const requestIds =
      [
        ...new Set(
          (
            S.data?.items ||
            []
          )
            .map(
              item =>
                String(
                  item.requestId ||
                  ''
                ).trim()
            )
            .filter(
              Boolean
            )
        )
      ];


    if (
      !requestIds.length
    ) {

      S.actionMap =
        {};

      return;

    }


    const result =
      await api({

        action:
          'request.actions.resolve',

        requestIds:
          requestIds

      });


    if (
      !result?.ok
    ) {

      throw new Error(
        result?.message ||
        result?.error ||
        '操作対象の判定に失敗しました。'
      );

    }


    S.actionMap =
      result.actions ||
      {};

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

  // ==================================================
  // 一覧は「最新状態」だけ表示
  // ==================================================

  function requestSequence_(
    item
  ) {

    const match =
      String(
        item?.requestId ||
        ''
      )
        .match(
          /(\d+)$/
        );


    return match
      ? Number(
          match[1]
        )
      : 0;

  }


  function groupKeyForItem_(
    item
  ) {

    const requestId =
      String(
        item?.requestId ||
        ''
      ).trim();


    const action =
      S.actionMap[
        requestId
      ] ||
      {};


    return (
      action.groupKey ||
      (
        requestId
          ? 'request:' +
            requestId
          : ''
      )
    );

  }


  function latestRequestItems_() {

    const grouped =
      new Map();


    (
      S.data?.items ||
      []
    )
      .forEach(
        item => {

          const key =
            groupKeyForItem_(
              item
            );


          if (!key) {
            return;
          }


          const current =
            grouped.get(
              key
            );


          if (
            !current ||
            requestSequence_(
              item
            ) >
            requestSequence_(
              current
            )
          ) {

            grouped.set(
              key,
              item
            );

          }

        }
      );


    return [
      ...grouped.values()
    ];

  }


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
          latestRequestItems_()
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

    const requestId =
      String(
        item.requestId ||
        ''
      ).trim();


    const action =
      S.actionMap[
        requestId
      ] ||
      {};


    const rows =
      [];


    // ------------------------------------------
    // 現在の担当
    // ------------------------------------------

    const staffNames =
      [
        Object.prototype.hasOwnProperty.call(
          action,
          'currentMainStaffName'
        )
          ? action.currentMainStaffName
          : item.mainStaffName,

        Object.prototype.hasOwnProperty.call(
          action,
          'currentStaff2Name'
        )
          ? action.currentStaff2Name
          : item.staff2Name,

        Object.prototype.hasOwnProperty.call(
          action,
          'currentStaff3Name'
        )
          ? action.currentStaff3Name
          : item.staff3Name
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


    // ------------------------------------------
    // 現在のドライバー
    //
    // 行だけ → ドライバ
    // 帰だけ → ドライバ
    // 両方   → 行ドライバ / 帰ドライバ
    // ------------------------------------------

    const outDriverName =
      String(
        Object.prototype.hasOwnProperty.call(
          action,
          'currentOutDriverName'
        )
          ? action.currentOutDriverName
          : (
              item.outDriverName ||
              ''
            )
      ).trim();


    const backDriverName =
      String(
        Object.prototype.hasOwnProperty.call(
          action,
          'currentBackDriverName'
        )
          ? action.currentBackDriverName
          : (
              item.backDriverName ||
              ''
            )
      ).trim();


    if (
      outDriverName &&
      backDriverName
    ) {

      rows.push([
        '行ドライバ',
        outDriverName
      ]);


      rows.push([
        '帰ドライバ',
        backDriverName
      ]);

    }
    else if (
      outDriverName
    ) {

      // 行きだけなら「ドライバ」
      rows.push([
        'ドライバ',
        outDriverName
      ]);

    }
    else if (
      backDriverName
    ) {

      // 帰りだけ残っている場合は
      // 行きドライバーと誤認しないよう「帰ドライバ」
      rows.push([
        '帰ドライバ',
        backDriverName
      ]);

    }


    // ------------------------------------------
    // 行先
    // ------------------------------------------

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


    // 待合せ
    if (
      item.meetingPlace
    ) {

      rows.push([
        '待合せ',
        item.meetingPlace
      ]);

    }


    // ------------------------------------------
    // 通常の現在情報
    // ------------------------------------------

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


    // ------------------------------------------
    // 変更情報
    //
    // 「担当変更　行ドライバ　大野 → 塩田」
    // を1行で表示し、理由とまとめて別背景で囲む。
    // ------------------------------------------

    let changeInfoHtml =
      '';


    if (
      item.requestType ===
      '担当変更'
    ) {

      const changeContent =
        String(
          item.changeContent ||
          ''
        ).trim();


      let targetLabel =
        '';


      let changeValue =
        '';


      const colonIndex =
        changeContent.indexOf(
          '：'
        );


      if (
        colonIndex >= 0
      ) {

        targetLabel =
          changeContent
            .slice(
              0,
              colonIndex
            )
            .trim();


        changeValue =
          changeContent
            .slice(
              colonIndex + 1
            )
            .trim();

      }
      else {

        changeValue =
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

      }


      changeInfoHtml = `
        <div class="change-info-box">

          <div class="change-info-row">

            <span class="change-info-label">
              担当変更
              ${
                targetLabel
                  ? '　' +
                    esc(
                      targetLabel
                    )
                  : ''
              }
            </span>

            ${
              changeValue
                ? `
                  <span class="change-info-value">
                    ${esc(
                      changeValue
                    )}
                  </span>
                `
                : ''
            }

          </div>

          ${
            item.changeReason
              ? `
                <div class="change-info-row">

                  <span class="change-info-label">
                    理由
                  </span>

                  <span class="change-info-value">
                    ${esc(
                      item.changeReason
                    )}
                  </span>

                </div>
              `
              : ''
          }

        </div>
      `;

    }
    else if (
      item.requestType ===
      '変更'
    ) {

      changeInfoHtml = `
        <div class="change-info-box">

          ${
            item.changeContent
              ? `
                <div class="change-info-row">

                  <span class="change-info-label">
                    変更内容
                  </span>

                  <span class="change-info-value">
                    ${esc(
                      item.changeContent
                    )}
                  </span>

                </div>
              `
              : ''
          }

          ${
            item.changeReason
              ? `
                <div class="change-info-row">

                  <span class="change-info-label">
                    理由
                  </span>

                  <span class="change-info-value">
                    ${esc(
                      item.changeReason
                    )}
                  </span>

                </div>
              `
              : ''
          }

        </div>
      `;

    }
    else if (
      item.changeReason
    ) {

      changeInfoHtml = `
        <div class="change-info-box">

          <div class="change-info-row">

            <span class="change-info-label">
              理由
            </span>

            <span class="change-info-value">
              ${esc(
                item.changeReason
              )}
            </span>

          </div>

        </div>
      `;

    }


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
              item.status === '取消'
                ? '取消'
                : item.requestType
            )}"
          >

            ${esc(
              item.status === '取消'
                ? '取消'
                : (
                    item.requestType ||
                    ''
                  )
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


        ${changeInfoHtml}


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


        ${cardActionsHtml_(
          item,
          isPastDay
        )}

      </article>
    `;

  }


  // ==================================================
  // 一覧カード操作ボタン
  // ==================================================

  function cardActionsHtml_(
    item,
    isPastDay
  ) {

    if (
      isPastDay
    ) {

      return '';

    }


    const requestId =
      String(
        item.requestId ||
        ''
      ).trim();


    if (!requestId) {
      return '';
    }


    const action =
      S.actionMap[
        requestId
      ] ||
      {};


    const buttons =
      [];


    buttons.push(`
      <button
        type="button"
        class="card-action-btn detail"
        data-action="detail"
        data-request-id="${esc(
          requestId
        )}"
      >
        詳細
      </button>
    `);


    if (
      action.canWithdraw
    ) {

      buttons.push(`
        <button
          type="button"
          class="card-action-btn"
          data-action="withdraw"
          data-request-id="${esc(
            requestId
          )}"
        >
          依頼取消
        </button>
      `);

    }


    if (
      action.canStaffChange &&
      action.shiftId
    ) {

      buttons.push(`
        <button
          type="button"
          class="card-action-btn"
          data-action="staffchange"
          data-request-id="${esc(
            requestId
          )}"
          data-shift-id="${esc(
            action.shiftId
          )}"
        >
          担当変更
        </button>
      `);

    }


    if (
      action.canCancel &&
      action.shiftId
    ) {

      buttons.push(`
        <button
          type="button"
          class="card-action-btn"
          data-action="cancel"
          data-request-id="${esc(
            requestId
          )}"
          data-shift-id="${esc(
            action.shiftId
          )}"
        >
          キャンセル
        </button>
      `);

    }


    if (
      !buttons.length
    ) {
      return '';
    }


    return `
      <div class="card-actions">
        ${buttons.join('')}
      </div>
    `;

  }


  function openHistoryFromList_(
    requestId
  ) {

    const sourceItem =
      (
        S.data?.items ||
        []
      )
        .find(
          item =>
            String(
              item.requestId ||
              ''
            ) ===
            String(
              requestId ||
              ''
            )
        );


    if (!sourceItem) {
      return;
    }


    const groupKey =
      groupKeyForItem_(
        sourceItem
      );


    const items =
      (
        S.data?.items ||
        []
      )
        .filter(
          item =>
            groupKeyForItem_(
              item
            ) ===
            groupKey
        )
        .sort(
          (
            a,
            b
          ) =>
            requestSequence_(
              b
            ) -
            requestSequence_(
              a
            )
        );


    E.historySummary.textContent =
      (
        sourceItem.clientName ||
        ''
      ) +
      '　' +
      (
        sourceItem.date ||
        ''
      ) +
      '　' +
      range(
        sourceItem.startTime,
        sourceItem.endTime
      );


    E.historyList.innerHTML =
      items
        .map(
          historyItemHtml_
        )
        .join('');


    E.historyDialog.showModal();

  }


  function historyItemHtml_(
    item
  ) {

    const displayType =
      item.status === '取消'
        ? '取消'
        : (
            item.requestType ||
            ''
          );


    const changeText =
      item.requestType === '担当変更'
        ? [
            item.oldStaffName ||
              '未設定',
            item.newStaffName ||
              ''
          ]
            .filter(
              Boolean
            )
            .join(
              ' → '
            )
        : (
            item.changeContent ||
            ''
          );


    const sub =
      [
        item.service,
        item.supportContent,
        changeText
      ]
        .filter(
          Boolean
        )
        .join(
          '　'
        );


    const reason =
      item.changeReason ||
      '';


    return `
      <div class="history-item">

        <div class="history-item-head">

          <span class="history-item-type">
            ${esc(
              displayType
            )}
          </span>

          <span class="history-item-id">
            ${esc(
              item.requestId ||
              ''
            )}
          </span>

        </div>

        <div class="history-item-main">
          ${esc(
            range(
              item.startTime,
              item.endTime
            )
          )}
         　
          ${esc(
            item.clientName ||
            ''
          )}
        </div>

        ${
          sub
            ? `
              <div class="history-item-sub">
                ${esc(
                  sub
                )}
              </div>
            `
            : ''
        }

        ${
          reason
            ? `
              <div class="history-item-reason">
                理由：${esc(
                  reason
                )}
              </div>
            `
            : ''
        }

      </div>
    `;

  }


  async function withdrawFromList_(
    requestId
  ) {

    if (!requestId) {
      return;
    }


    const reason =
      window.prompt(
        '依頼取消の理由を入力してください（任意）',
        ''
      );


    if (
      reason === null
    ) {
      return;
    }


    if (
      !window.confirm(
        'この依頼を取り消しますか？'
      )
    ) {
      return;
    }


    try {

      const result =
        await api({

          action:
            'request.withdraw.multi',

          requestIds: [
            requestId
          ],

          cancelerId:
            S.employee.id,

          cancelerName:
            S.employee.name,

          reason:
            String(
              reason || ''
            ).trim()

        });


      if (
        !result?.ok
      ) {

        throw new Error(
          result?.message ||
          result?.error ||
          '依頼取消に失敗しました。'
        );

      }


      await loadRange();

    }
    catch (err) {

      alert(
        '依頼取消できませんでした。\n' +
        (
          err?.message ||
          err
        )
      );

    }

  }


  async function cancelFromList_(
    shiftId
  ) {

    if (!shiftId) {
      return;
    }


    const reason =
      window.prompt(
        'キャンセル理由を入力してください（任意）',
        ''
      );


    if (
      reason === null
    ) {
      return;
    }


    if (
      !window.confirm(
        'この支援をキャンセルしますか？'
      )
    ) {
      return;
    }


    try {

      const result =
        await api({

          action:
            'request.cancel.multi',

          shiftIds: [
            shiftId
          ],

          reporterId:
            S.employee.id,

          reporterName:
            S.employee.name,

          reason:
            String(
              reason || ''
            ).trim(),

          note:
            '',

          registerMethod:
            'WEB_LIST'

        });


      if (
        !result?.ok
      ) {

        throw new Error(
          result?.message ||
          result?.error ||
          'キャンセルに失敗しました。'
        );

      }


      await loadRange();

    }
    catch (err) {

      alert(
        'キャンセルできませんでした。\n' +
        (
          err?.message ||
          err
        )
      );

    }

  }


  async function openStaffChangeFromList_(
    shiftId
  ) {

    if (!shiftId) {
      return;
    }


    try {

      const result =
        await api({

          action:
            'request.shift.detail',

          shiftId:
            shiftId

        });


      if (
        !result?.ok
      ) {

        throw new Error(
          result?.message ||
          result?.error ||
          'シフト情報を取得できません。'
        );

      }


      S.staffChangeShift =
        result.shift;


      const shift =
        result.shift;


      E.currentPeople.textContent =
        shift.people ||
        '1';


      E.currentMainStaff.textContent =
        shift.mainStaffName ||
        '－';


      E.currentStaff2.textContent =
        shift.staff2Name ||
        '－';


      E.currentStaff3.textContent =
        shift.staff3Name ||
        '－';


      E.currentOutDriver.textContent =
        shift.outDriverName ||
        '－';


      E.currentBackDriver.textContent =
        shift.backDriverName ||
        '－';


      E.staffChangeFieldSelect.value =
        '';


      refreshStaffChangeNewOptions_(
        ''
      );


      E.staffChangeReason.value =
        '';


      E.staffChangeMsg.hidden =
        true;


      E.staffChangeOldValue.textContent =
        '－';


      E.staffChangeDialog.showModal();

    }
    catch (err) {

      alert(
        '担当変更画面を開けませんでした。\n' +
        (
          err?.message ||
          err
        )
      );

    }

  }


  function currentStaffByField_(
    fieldKey
  ) {

    const shift =
      S.staffChangeShift ||
      {};


    const map = {

      main: {
        id:
          shift.mainStaffId ||
          '',
        name:
          shift.mainStaffName ||
          ''
      },

      staff2: {
        id:
          shift.staff2Id ||
          '',
        name:
          shift.staff2Name ||
          ''
      },

      staff3: {
        id:
          shift.staff3Id ||
          '',
        name:
          shift.staff3Name ||
          ''
      },

      outDriver: {
        id:
          shift.outDriverId ||
          '',
        name:
          shift.outDriverName ||
          ''
      },

      backDriver: {
        id:
          shift.backDriverId ||
          '',
        name:
          shift.backDriverName ||
          ''
      }

    };


    return (
      map[
        fieldKey
      ] ||
      {
        id: '',
        name: ''
      }
    );

  }


  function refreshStaffChangeOldValue_() {

    const fieldKey =
      E.staffChangeFieldSelect.value;


    const current =
      currentStaffByField_(
        fieldKey
      );


    E.staffChangeOldValue.textContent =
      current.name ||
      '未設定';


    refreshStaffChangeNewOptions_(
      fieldKey
    );

  }


  function refreshStaffChangeNewOptions_(
    fieldKey
  ) {

    // 従業員一覧を毎回作り直す。
    // 「空欄にする」はHTMLに固定で置き、ここで表示可否だけ制御する。
    E.staffChangeNewStaff.innerHTML =
      E.main.innerHTML;


    const clearOption =
      document.createElement(
        'option'
      );


    clearOption.value =
      '__CLEAR__';


    clearOption.dataset.clearOption =
      'true';


    clearOption.dataset.name =
      '';


    clearOption.textContent =
      '空欄にする';


    clearOption.disabled =
      fieldKey ===
      'main';


    // 「選択してください」の直後に入れる
    E.staffChangeNewStaff.insertBefore(
      clearOption,
      E.staffChangeNewStaff.options[1] ||
      null
    );


    E.staffChangeNewStaff.value =
      '';

  }


  function calculatedPeopleAfterStaffChange_(
    fieldKey,
    newStaffId
  ) {

    const shift =
      S.staffChangeShift ||
      {};


    let staff2Id =
      shift.staff2Id ||
      '';


    if (
      fieldKey ===
      'staff2'
    ) {

      staff2Id =
        newStaffId ||
        '';

    }


    return staff2Id
      ? 2
      : 1;

  }


  function currentPeopleValue_() {

    const shift =
      S.staffChangeShift ||
      {};


    const raw =
      String(
        shift.people ??
        ''
      ).trim();


    return raw
      ? (
          Number(
            raw
          ) ||
          1
        )
      : 1;

  }


  async function saveStaffChangeFromList_(
    event
  ) {

    event.preventDefault();


    const shift =
      S.staffChangeShift;


    if (!shift?.shiftId) {

      staffChangeMessage_(
        '対象シフトがありません。',
        true
      );

      return;

    }


    const fieldKey =
      E.staffChangeFieldSelect.value;


    if (!fieldKey) {

      staffChangeMessage_(
        '変更する項目を選択してください。',
        true
      );

      return;

    }


    const selectedValue =
      String(
        E.staffChangeNewStaff.value ||
        ''
      ).trim();


    const clearRequested =
      selectedValue ===
      '__CLEAR__';


    const newStaff =
      clearRequested
        ? {
            id: '',
            name: ''
          }
        : selectedMaster(
            E.staffChangeNewStaff
          );


    if (
      fieldKey === 'main' &&
      (
        clearRequested ||
        !newStaff.id
      )
    ) {

      staffChangeMessage_(
        '主担当は空欄にできません。',
        true
      );

      return;

    }


    if (
      fieldKey !== 'main' &&
      !clearRequested &&
      !newStaff.id
    ) {

      staffChangeMessage_(
        '変更後の従業員、または「空欄にする」を選択してください。',
        true
      );

      return;

    }


    const current =
      currentStaffByField_(
        fieldKey
      );


    if (
      (
        current.id &&
        current.id ===
        newStaff.id
      ) ||
      (
        !current.id &&
        clearRequested
      )
    ) {

      staffChangeMessage_(
        clearRequested
          ? 'この項目はすでに空欄です。'
          : '現在と同じ従業員が選択されています。',
        true
      );

      return;

    }


    const labels = {
      main:
        '主担当',
      staff2:
        '担当2',
      staff3:
        '担当3',
      outDriver:
        '行ドライバ',
      backDriver:
        '帰ドライバ'
    };


    const currentPeople =
      currentPeopleValue_();


    const nextPeople =
      calculatedPeopleAfterStaffChange_(
        fieldKey,
        newStaff.id
      );


    const confirmLines = [
      '担当変更しますか？',
      '',
      '項目：' +
        labels[
          fieldKey
        ],
      '変更前：' +
        (
          current.name ||
          '未設定'
        ),
      '変更後：' +
        (
          clearRequested
            ? '空欄'
            : newStaff.name
        )
    ];


    if (
      currentPeople !==
      nextPeople
    ) {

      confirmLines.push(
        '',
        '人数も変更されます：' +
          currentPeople +
          ' → ' +
          nextPeople,
        '',
        '担当変更と同時に人数も変更してよろしいですか？'
      );

    }


    if (
      !window.confirm(
        confirmLines.join(
          '\n'
        )
      )
    ) {
      return;
    }


    E.saveStaffChange.disabled =
      true;


    staffChangeMessage_(
      '担当変更しています...',
      false
    );


    try {

      const result =
        await api({

          action:
            'request.staffchange.apply',

          shiftId:
            shift.shiftId,

          fieldKey:
            fieldKey,

          newStaffId:
            newStaff.id,

          newStaffName:
            newStaff.name,

          clearStaff:
            clearRequested,

          reporterId:
            S.employee.id,

          reporterName:
            S.employee.name,

          reason:
            E.staffChangeReason.value.trim(),

          registerMethod:
            'WEB_LIST'

        });


      if (
        !result?.ok
      ) {

        throw new Error(
          result?.message ||
          result?.error ||
          '担当変更に失敗しました。'
        );

      }


      E.staffChangeDialog.close();


      await loadRange();

    }
    catch (err) {

      staffChangeMessage_(
        '担当変更できませんでした。\n' +
        (
          err?.message ||
          err
        ),
        true
      );

    }
    finally {

      E.saveStaffChange.disabled =
        false;

    }

  }


  function staffChangeMessage_(
    text,
    isError
  ) {

    E.staffChangeMsg.hidden =
      false;


    E.staffChangeMsg.textContent =
      text;


    E.staffChangeMsg.style.color =
      isError
        ? '#c62828'
        : '#1f2933';

  }


  // ==================================================
  // 登録処理
  // ==================================================

  // ==================================================
  // キャンセル対象予定
  // ==================================================

  function clearCancelTargets_() {

    S.cancelTargets =
      [];


    if (
      E.cancelTargetStatus
    ) {

      E.cancelTargetStatus.textContent =
        '';

    }


    if (
      E.cancelTargetList
    ) {

      E.cancelTargetList.innerHTML =
        '';

    }

  }


  async function loadCancelTargets_() {

    const client =
      selectedMaster(
        E.client
      );


    const targetDates =
      [
        ...new Set(
          getRequestDates()
        )
      ];


    if (
      !client.id
    ) {

      saveMsg(
        '利用者を選択してください。',
        true
      );

      return;

    }


    if (
      !targetDates.length
    ) {

      saveMsg(
        '対象日を入力してください。',
        true
      );

      return;

    }


    E.loadCancelTargets.disabled =
      true;


    E.cancelTargetStatus.textContent =
      E.type.value === '依頼取消'
        ? '取消可能な依頼を取得しています...'
        : 'キャンセル可能な予定を取得しています...';


    E.cancelTargetList.innerHTML =
      '';


    try {

      const type =
        E.type.value;


      const action =
        type === '依頼取消'
          ? 'request.withdraw.targets'
          : 'request.cancel.targets';


      const result =
        await api({

          action:
            action,

          clientId:
            client.id,

          targetDates:
            targetDates

        });


      if (
        !result?.ok
      ) {

        throw new Error(
          result?.message ||
          result?.error ||
          '対象予定を取得できませんでした。'
        );

      }


      S.cancelTargets =
        result.items ||
        [];


      renderCancelTargets_(
        result
      );

    }
    catch (err) {

      E.cancelTargetStatus.textContent =
        '';


      saveMsg(
        '対象予定を取得できませんでした。\n' +
        (
          err?.message ||
          err
        ),
        true
      );

    }
    finally {

      E.loadCancelTargets.disabled =
        false;

    }

  }


  function renderCancelTargets_(
    result
  ) {

    const items =
      S.cancelTargets ||
      [];


    const notes =
      result?.notes ||
      [];


    const isWithdraw =
      E.type.value ===
      '依頼取消';


    E.cancelTargetStatus.textContent =
      items.length
        ? (
            items.length +
            (
              isWithdraw
                ? '件あります。取り消す依頼を選択してください。'
                : '件あります。キャンセルする予定を選択してください。'
            )
          )
        : (
            isWithdraw
              ? '取消できる依頼はありません。'
              : 'キャンセルできる予定はありません。'
          );


    if (
      notes.length
    ) {

      E.cancelTargetStatus.textContent +=
        '\n' +
        notes.join(
          '\n'
        );

    }


    if (
      !items.length
    ) {

      E.cancelTargetList.innerHTML =
        '';

      return;

    }


    E.cancelTargetList.innerHTML =
      items
        .map(
          item => {

            const staff =
              [
                item.mainStaffName,
                item.staff2Name,
                item.staff3Name
              ]
                .filter(
                  Boolean
                )
                .join(
                  ' / '
                );


            const details =
              [
                item.system,
                item.service,
                staff
                  ? '担当 ' + staff
                  : '',
                item.supportContent
              ]
                .filter(
                  Boolean
                )
                .join(
                  '　'
                );


            return `
              <label class="cancel-target-card">

                <input
                  type="checkbox"
                  class="cancel-target-check"
                  value="${esc(
                    isWithdraw
                      ? item.requestId
                      : item.shiftId
                  )}"
                >

                <div class="cancel-target-main">

                  <div class="cancel-target-date">
                    ${esc(
                      item.date
                    )}
                  </div>

                  <div class="cancel-target-title">
                    ${
                      isWithdraw
                        ? esc(
                            (
                              item.requestType ||
                              '依頼'
                            ) +
                            '　' +
                            range(
                              item.startTime,
                              item.endTime
                            )
                          )
                        : (
                            esc(
                              range(
                                item.startTime,
                                item.endTime
                              )
                            ) +
                            '　' +
                            esc(
                              item.service ||
                              'サービス未設定'
                            )
                          )
                    }
                  </div>

                  <div class="cancel-target-sub">
                    ${esc(
                      isWithdraw
                        ? [
                            item.requestId,
                            item.system,
                            item.service,
                            item.supportContent
                          ]
                            .filter(
                              Boolean
                            )
                            .join(
                              '　'
                            )
                        : details
                    )}
                  </div>

                </div>

              </label>
            `;

          }
        )
        .join('');

  }


  function selectedTargetIds_() {

    return [
      ...E.cancelTargetList.querySelectorAll(
        '.cancel-target-check:checked'
      )
    ]
      .map(
        input =>
          String(
            input.value ||
            ''
          ).trim()
      )
      .filter(
        Boolean
      );

  }


  function selectedTargetItems_() {

    const ids =
      new Set(
        selectedTargetIds_()
      );


    const isWithdraw =
      E.type.value ===
      '依頼取消';


    return (
      S.cancelTargets ||
      []
    )
      .filter(
        item =>
          ids.has(
            String(
              isWithdraw
                ? item.requestId
                : item.shiftId
            )
          )
      );

  }


  async function saveRequest(
    event
  ) {

    event.preventDefault();


    const type =
      E.type.value;


    // 「キャンセル」は予定選択式なので、
    // 対象シフトIDの手入力チェックは行いません。
    //
    // 変更・担当変更など、従来の対象シフトID方式だけ
    // 手入力を必須にします。
    if (
      type !== '追加' &&
      type !== 'キャンセル' &&
      type !== '依頼取消' &&
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


    const outDriver =
      selectedMaster(
        E.outDriver
      );


    const backDriver =
      selectedMaster(
        E.backDriver
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


    // ==================================================
    // 依頼取消
    // まだ実シフトへ反映されていない依頼だけを
    // 複数選択して取り消します。
    // ==================================================

    if (
      type ===
      '依頼取消'
    ) {

      if (
        !client.id
      ) {

        saveMsg(
          '利用者を選択してください。',
          true
        );

        return;

      }


      const requestIds =
        selectedTargetIds_();


      if (
        !requestIds.length
      ) {

        saveMsg(
          '取り消す依頼を1件以上選択してください。',
          true
        );

        return;

      }


      const selectedItems =
        selectedTargetItems_();


      const lines = [
        '選択した依頼を取り消しますか？',
        '',
        '利用者：' +
          client.name,
        '件数：' +
          requestIds.length
      ];


      selectedItems.forEach(
        item => {

          lines.push(
            (
              item.date ||
              ''
            ) +
            ' ' +
            (
              item.requestType ||
              ''
            ) +
            ' ' +
            range(
              item.startTime,
              item.endTime
            ) +
            ' ' +
            (
              item.service ||
              ''
            )
          );

        }
      );


      if (
        E.reason.value.trim()
      ) {

        lines.push(
          '',
          '取消理由：' +
          E.reason.value.trim()
        );

      }


      const confirmed =
        window.confirm(
          lines.join(
            '\n'
          )
        );


      if (
        !confirmed
      ) {

        saveMsg(
          '依頼取消をキャンセルしました。',
          false,
          3000
        );

        return;

      }


      E.save.disabled =
        true;


      saveMsg(
        '依頼を取り消しています...',
        false
      );


      try {

        const result =
          await api({

            action:
              'request.withdraw.multi',

            requestIds:
              requestIds,

            cancelerId:
              S.employee.id,

            cancelerName:
              S.employee.name,

            reason:
              E.reason.value.trim()

          });


        if (
          !result?.ok
        ) {

          throw new Error(
            result?.message ||
            result?.error ||
            '依頼取消に失敗しました。'
          );

        }


        saveMsg(
          result.message ||
          (
            requestIds.length +
            '件の依頼を取り消しました。'
          ),
          false
        );


        await loadRange();


        setTimeout(
          () =>
            E.dialog.close(),
          700
        );

      }
      catch (err) {

        saveMsg(
          '依頼を取り消せませんでした。\n' +
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


      return;

    }


    // ==================================================
    // キャンセルは対象シフトを複数選択して登録
    // ==================================================

    if (
      type ===
      'キャンセル'
    ) {

      if (
        !client.id
      ) {

        saveMsg(
          '利用者を選択してください。',
          true
        );

        return;

      }


      const shiftIds =
        selectedTargetIds_();


      if (
        !shiftIds.length
      ) {

        saveMsg(
          'キャンセルする予定を1件以上選択してください。',
          true
        );

        return;

      }


      const selectedItems =
        selectedTargetItems_();


      const lines = [
        '選択した予定をキャンセルしますか？',
        '',
        '利用者：' +
          client.name,
        '件数：' +
          shiftIds.length
      ];


      selectedItems.forEach(
        item => {

          lines.push(
            (
              item.date ||
              ''
            ) +
            ' ' +
            range(
              item.startTime,
              item.endTime
            ) +
            ' ' +
            (
              item.service ||
              ''
            )
          );

        }
      );


      if (
        E.reason.value.trim()
      ) {

        lines.push(
          '',
          '理由：' +
          E.reason.value.trim()
        );

      }


      const confirmed =
        window.confirm(
          lines.join(
            '\n'
          )
        );


      if (
        !confirmed
      ) {

        saveMsg(
          '登録をキャンセルしました。',
          false,
          3000
        );

        return;

      }


      E.save.disabled =
        true;


      saveMsg(
        'キャンセルを登録しています...',
        false
      );


      try {

        const result =
          await api({

            action:
              'request.cancel.multi',

            shiftIds:
              shiftIds,

            reporterId:
              S.employee.id,

            reporterName:
              S.employee.name,

            reason:
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
            'キャンセル登録に失敗しました。'
          );

        }


        saveMsg(
          result.message ||
          (
            shiftIds.length +
            '件をキャンセルしました。'
          ),
          false
        );


        await loadRange();


        setTimeout(
          () =>
            E.dialog.close(),
          700
        );

      }
      catch (err) {

        saveMsg(
          'キャンセル登録できませんでした。\n' +
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


    // ==================================================
    // 入力途中での誤登録防止
    //
    // Enterキーでsubmitされても、ここを必ず通るため
    // 不足項目があれば登録せずに止めます。
    // ==================================================

    const validationMessage =
      validateRequestBeforeSave_({

        type:
          type,

        client:
          client,

        targetDates:
          targetDates

      });


    if (
      validationMessage
    ) {

      saveMsg(
        validationMessage,
        true
      );

      return;

    }


    // ==================================================
    // 最終確認
    //
    // 登録ボタンでもEnterでも、GASへ送る前に
    // 必ず「この内容で登録しますか？」を表示します。
    // ==================================================

    const confirmed =
      window.confirm(
        buildRequestConfirmText_({

          type:
            type,

          client:
            client,

          targetDates:
            targetDates,

          mainStaff:
            mainStaff,

          staff2:
            staff2,

          staff3:
            staff3,

          outDriver:
            outDriver,

          backDriver:
            backDriver

        })
      );


    if (
      !confirmed
    ) {

      saveMsg(
        '登録をキャンセルしました。',
        false,
        3000
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

          people:
            (
              E.people.value ||
              '1'
            ),

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

          outDriverId:
            outDriver.id,

          outDriverName:
            outDriver.name,

          backDriverId:
            backDriver.id,

          backDriverName:
            backDriver.name,

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
  // 登録前入力チェック
  // ==================================================

  function validateRequestBeforeSave_(
    data
  ) {

    const type =
      data.type;


    // ------------------------------------------
    // 共通必須
    // ------------------------------------------

    if (
      !data.client?.id ||
      !data.client?.name
    ) {

      return (
        '利用者を選択してください。'
      );

    }


    if (
      !Array.isArray(
        data.targetDates
      ) ||
      !data.targetDates.length
    ) {

      return (
        '対象日を入力してください。'
      );

    }


    // ------------------------------------------
    // 「追加」は予定そのものを新しく作るため、
    // 入力途中の登録を防ぐ目的で
    // サービス・開始を必須にします。
    // 終了時刻は任意、人数は空欄なら1名扱いです。
    // ------------------------------------------

    if (
      type === '追加'
    ) {

      if (
        !E.service.value.trim()
      ) {

        return (
          'サービスを入力してください。'
        );

      }


      if (
        !E.start.value
      ) {

        return (
          '開始時刻を入力してください。'
        );

      }


    }


    return '';

  }


  // ==================================================
  // 登録確認メッセージ
  // ==================================================

  function buildRequestConfirmText_(
    data
  ) {

    const lines = [];


    lines.push(
      'この内容で登録しますか？'
    );


    lines.push(
      ''
    );


    lines.push(
      '依頼区分：' +
      (
        data.type ||
        ''
      )
    );


    lines.push(
      '利用者：' +
      (
        data.client?.name ||
        ''
      )
    );


    lines.push(
      '対象日：' +
      data.targetDates.join(
        ' / '
      )
    );


    const timeText =
      E.start.value &&
      E.end.value
        ? E.start.value +
          '～' +
          E.end.value
        : (
            E.start.value ||
            E.end.value ||
            '未入力'
          );


    lines.push(
      '時間：' +
      timeText
    );


    if (
      E.service.value.trim()
    ) {

      lines.push(
        'サービス：' +
        E.service.value.trim()
      );

    }


    lines.push(
      '人数：' +
      (
        E.people.value ||
        '1'
      )
    );


    const staffNames =
      [
        data.mainStaff?.name,
        data.staff2?.name,
        data.staff3?.name
      ]
        .filter(
          Boolean
        );


    if (
      staffNames.length
    ) {

      lines.push(
        '担当：' +
        staffNames.join(
          ' / '
        )
      );

    }


    if (
      data.outDriver?.name
    ) {

      lines.push(
        '行ドライバ：' +
        data.outDriver.name
      );

    }


    if (
      data.backDriver?.name
    ) {

      lines.push(
        '帰ドライバ：' +
        data.backDriver.name
      );

    }


    if (
      E.support.value.trim()
    ) {

      lines.push(
        '支援内容：' +
        E.support.value.trim()
      );

    }


    if (
      E.dest.value.trim()
    ) {

      lines.push(
        '行先：' +
        E.dest.value.trim()
      );

    }


    lines.push(
      ''
    );


    lines.push(
      '「OK」で登録します。'
    );


    return lines.join(
      '\\n'
    );

  }


  // ==================================================
  // 登録フォーム表示制御
  // ==================================================

  function formMode() {

    const type =
      E.type.value;


    // キャンセルは対象予定選択式。
    // 手入力の対象シフトIDは使いません。
    E.targetField.hidden =
      (
        type === '追加' ||
        type === 'キャンセル' ||
        type === '依頼取消'
      );


    E.cancelPicker.hidden =
      !(
        type === 'キャンセル' ||
        type === '依頼取消'
      );


    E.loadCancelTargets.textContent =
      type === '依頼取消'
        ? '取消可能な依頼を表示'
        : 'キャンセル可能な予定を表示';


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


    clearCancelTargets_();


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

  let saveMessageTimer_ =
    null;


  function saveMsg(
    text,
    isError,
    autoHideMs
  ) {

    if (
      saveMessageTimer_
    ) {

      clearTimeout(
        saveMessageTimer_
      );

      saveMessageTimer_ =
        null;

    }


    E.saveMsg.hidden =
      false;


    E.saveMsg.textContent =
      text;


    E.saveMsg.style.color =
      isError
        ? '#c62828'
        : '#1f2933';


    // メッセージはフォーム上部にあるため、
    // 入力途中でも見える位置まで戻します。
    E.dialog.scrollTo({
      top: 0,
      behavior: 'smooth'
    });


    if (
      autoHideMs &&
      autoHideMs > 0
    ) {

      saveMessageTimer_ =
        setTimeout(
          () => {

            E.saveMsg.hidden =
              true;

            E.saveMsg.textContent =
              '';

            saveMessageTimer_ =
              null;

          },
          autoHideMs
        );

    }

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
      '取消' ||
      type ===
      '依頼取消'
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
