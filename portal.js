let currentUser = null;
let currentLineProfile = null;


document.addEventListener(
  "DOMContentLoaded",
  async () => {
    try {
      const form =
        document.getElementById(
          "registerForm"
        );

      if (form) {
        form.addEventListener(
          "submit",
          handleRegister
        );
      }

      /*
       * Chromeに保存された本人情報を確認
       */
      currentUser =
        getSavedPortalUser();

			if (currentUser) {
			  try {
			    showPortalAreaDirect();

			  } catch (error) {
			    console.error(
			      "保存済み本人情報での表示エラー",
			      error
			    );

			    showRegisterArea();

			    setPageMessage(
			      "ポータル画面の表示中にエラーが発生しました。",
			      "error",
			      "registerForm"
			    );
			  }

			  return;
			}

      showLoadingArea();

      /*
       * LINE情報を取得
       */
      currentLineProfile =
        await initLiff();

      if (
        currentLineProfile &&
        currentLineProfile.lineId
      ) {
        const loginResult =
          await loginByLineId(
            currentLineProfile.lineId
          );

        if (loginResult.success) {
          currentUser = {
            employeeId:
              loginResult.employeeId,

            employeeName:
              loginResult.employeeName
          };

          savePortalUser(
            currentUser
          );

          showPortalAreaDirect();
          return;
        }
      }

      /*
       * 本人確認できなかった場合は
       * 初回登録画面を表示
       */
      showRegisterArea();

      await loadEmployeeList();

    } catch (error) {
      console.error(
        "ポータル初期化エラー:",
        error
      );

      /*
       * エラー時もくるくる画面から抜ける
       */
      showRegisterArea();

      setPageMessage(
        "本人確認を完了できませんでした。" +
        "LINEから開き直してください。",
        "error",
        "registerForm"
      );
    }
  }
);


function showLoadingArea() {
  document
    .getElementById("loadingArea")
    ?.classList.remove("hidden");

  document
    .getElementById("registerArea")
    ?.classList.add("hidden");

  document
    .getElementById("completeArea")
    ?.classList.add("hidden");

  document
    .getElementById("portalArea")
    ?.classList.add("hidden");
}


function showRegisterArea() {
  document
    .getElementById("loadingArea")
    ?.classList.add("hidden");

  document
    .getElementById("registerArea")
    ?.classList.remove("hidden");

  document
    .getElementById("completeArea")
    ?.classList.add("hidden");

  document
    .getElementById("portalArea")
    ?.classList.add("hidden");
}


async function handleRegister(event) {
  event.preventDefault();

  const employeeName =
    document.getElementById(
      "employeeName"
    ).value;

  const tempId =
    document.getElementById(
      "tempId"
    ).value;

  if (
    !currentLineProfile ||
    !currentLineProfile.lineId
  ) {
    alert(
      "LINE情報を取得できません。" +
      "LINEから開き直してください。"
    );

    return;
  }

  if (!employeeName || !tempId) {
    setPageMessage(
      "氏名と仮登録IDを入力してください。",
      "error",
      "registerForm"
    );

    return;
  }

  try {
    setPageMessage(
      "登録処理中です。",
      "success",
      "registerForm"
    );

    const result =
      await postGas({
        action: "registerLineId",
        employeeName: employeeName,
        tempId: tempId,
        lineId:
          currentLineProfile.lineId,
        lineName:
          currentLineProfile.lineName
      });

    if (result.success) {
      currentUser = {
        employeeId:
          result.employeeId,

        employeeName:
          result.employeeName
      };

      savePortalUser(currentUser);
      showCompleteArea(result.message);

    } else {
      setPageMessage(
        result.message,
        "error",
        "registerForm"
      );
    }

  } catch (error) {
    setPageMessage(
      "通信に失敗しました。",
      "error",
      "registerForm"
    );

    console.error(error);
  }
}


function showCompleteArea(message) {
  document
    .getElementById("loadingArea")
    ?.classList.add("hidden");

  document
    .getElementById("registerArea")
    ?.classList.add("hidden");

  document
    .getElementById("portalArea")
    ?.classList.add("hidden");

  document
    .getElementById("completeArea")
    ?.classList.remove("hidden");

  const messageArea =
    document.getElementById(
      "registerCompleteMessage"
    );

  if (messageArea) {
    messageArea.textContent =
      message ||
      "LINE IDの登録が完了しました。";
  }
}


function showPortalArea() {
  document
    .getElementById("completeArea")
    ?.classList.add("hidden");

  removePageMessage();
  showPortalAreaDirect();
}


function showPortalAreaDirect() {
  document
    .getElementById("loadingArea")
    ?.classList.add("hidden");

  document
    .getElementById("registerArea")
    ?.classList.add("hidden");

  document
    .getElementById("completeArea")
    ?.classList.add("hidden");

  document
    .getElementById("portalArea")
    ?.classList.remove("hidden");

	showPortalUserName();

	try {
	  setStaffActionButtonsByState("");
	  loadTodayStaffShifts();

	} catch (error) {
	  console.error(
	    "ポータル初期表示エラー",
	    error
	  );
	}

}


async function loadEmployeeList() {
  const select =
    document.getElementById(
      "employeeName"
    );

  if (!select) {
    return;
  }

  select.innerHTML =
    '<option value="">' +
    '氏名一覧を読み込んでいます…' +
    '</option>';

  select.disabled = true;

  try {
    const result =
      await postGas({
        action: "getEmployeeList"
      });

    select.innerHTML =
      '<option value="">' +
      '氏名を選択してください' +
      '</option>';

    if (!result.success) {
      setPageMessage(
        result.message ||
        "職員一覧の取得に失敗しました。",
        "error",
        "registerForm"
      );

      return;
    }

    (result.employees || [])
      .forEach(employee => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          employee.name;

        option.textContent =
          employee.name;

        select.appendChild(option);
      });

  } catch (error) {
    select.innerHTML =
      '<option value="">' +
      '取得に失敗しました' +
      '</option>';

    setPageMessage(
      "職員一覧の取得に失敗しました。" +
      error.message,
      "error",
      "registerForm"
    );

  } finally {
    select.disabled = false;
  }
}


function goShiftRequest() {
  location.href = "./irai.html";
}

function goOutingRoute() {
  location.href = "./outing.html";
}

function goOfficeWork() {
  if (!currentUser) {
    alert("職員情報を確認できません。");
    return;
  }

  const params = new URLSearchParams();
  params.set("employeeId", currentUser.employeeId || "");
  params.set("employeeName", currentUser.employeeName || "");

  location.href =
    "./office-work.html?" +
    params.toString();
}

function logoutPortal() {
  clearPortalUser();
  currentUser = null;
  location.reload();
}


function showPortalUserName() {
  const element =
    document.getElementById(
      "portalUserName"
    );

  if (element && currentUser) {
    element.textContent =
      currentUser.employeeName +
      " さん";
  }
}


async function initLiff() {
  try {
    /*
     * LIFFのJavaScript自体を読み込めていない場合
     */
    if (typeof liff === "undefined") {
      console.warn("LIFFを読み込めませんでした。");
      return null;
    }

    /*
     * LIFF初期化を最大8秒まで待ちます。
     * 通常Chromeなどで止まった場合は先へ進みます。
     */
    await Promise.race([
      liff.init({
        liffId: LIFF_ID
      }),

      new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              "LIFF初期化がタイムアウトしました。"
            )
          );
        }, 8000);
      })
    ]);

    if (liff.isLoggedIn()) {
      const profile =
        await liff.getProfile();

      return {
        lineId: profile.userId,
        lineName: profile.displayName
      };
    }

    /*
     * LINEアプリ内で開いている場合だけ
     * LINEログイン画面へ移動します。
     */
    if (liff.isInClient()) {
      liff.login();
    }

    /*
     * 通常Chromeでは自動ログインせず、
     * 初回登録画面へ進みます。
     */
    return null;

  } catch (error) {
    console.error(
      "LIFF初期化エラー:",
      error
    );

    return null;
  }
}


async function loginByLineId(lineId) {
  try {
    return await postGas({
      action: "loginByLineId",
      lineId: lineId
    });

  } catch (error) {
    console.error(
      "LINE IDログインエラー:",
      error
    );

    return {
      success: false,
      message:
        "ログイン確認に失敗しました。"
    };
  }
}


async function issueTempIdFromScreen() {
  const employeeName =
    document.getElementById(
      "employeeName"
    ).value;

  if (!employeeName) {
    alert("氏名を選択してください。");
    return;
  }

  if (
    !currentLineProfile ||
    !currentLineProfile.lineId
  ) {
    alert(
      "LINE情報を取得できません。" +
      "LINEから開き直してください。"
    );

    return;
  }

  try {
    const result =
      await postGas({
        action: "issueTempId",
        employeeName: employeeName,
        lineId:
          currentLineProfile.lineId
      });

    if (result.success) {
      alert(
        "LINEに仮登録IDを送信しました。" +
        "LINEのメッセージを確認してください。"
      );

      if (liff.isInClient()) {
        liff.closeWindow();
      }

    } else {
      alert(result.message);
    }

  } catch (error) {
    alert(
      "仮登録IDの発行に失敗しました：" +
      error.message
    );
  }
}

let todayStaffShifts = [];


const ACTION_RECORD_PENDING_KEY =
  "staffPortalPendingActionRecordSessionsV1";

const ACTION_RECORD_REVIEW_KEY =
  "staffPortalActionRecordReviewV1";

function readActionRecordReview_() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          ACTION_RECORD_REVIEW_KEY
        ) || "[]"
      );

    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch (error) {
    return [];
  }
}

function writeActionRecordReview_(list) {
  localStorage.setItem(
    ACTION_RECORD_REVIEW_KEY,
    JSON.stringify(
      Array.isArray(list)
        ? list.slice(-100)
        : []
    )
  );

  updateStaffActionSyncStatus_();
}

function moveActionRecordSessionToReview_(
  session,
  error
) {
  const list =
    readActionRecordReview_();

  const item = {
    ...(session || {}),
    reviewAt:
      new Date().toISOString(),
    reviewReason:
      error && error.message
        ? error.message
        : String(error || ""),
    reviewStatus:
      "要確認"
  };

  const key =
    String(
      item.sessionId ||
      item.shiftId ||
      ""
    );

  const filtered =
    list.filter(existing =>
      String(
        existing.sessionId ||
        existing.shiftId ||
        ""
      ) !== key
    );

  filtered.push(item);

  writeActionRecordReview_(
    filtered
  );
}

function isLegacyActionRecordStateError_(error) {
  const message =
    String(
      error && error.message
        ? error.message
        : error || ""
    );

  return (
    message.includes(
      "現在は待機中ではありません"
    ) ||
    message.includes(
      "終了または取消済み"
    ) ||
    message.includes(
      "組合せが一致しません"
    )
  );
}


const ACTION_RECORD_COMPLETED_KEY =
  "staffPortalCompletedActionRecordV1";

function getCompletedActionRecord_() {
  try {
    return JSON.parse(
      localStorage.getItem(
        ACTION_RECORD_COMPLETED_KEY
      ) || "null"
    );
  } catch (error) {
    return null;
  }
}

function isActionRecordCompletedForShift_(shift) {
  if (!shift) return false;

  const completed =
    getCompletedActionRecord_();

  return !!(
    completed &&
    completed.shiftId === shift.shiftId
  );
}

function clearCompletedActionRecord_() {
  localStorage.removeItem(
    ACTION_RECORD_COMPLETED_KEY
  );
}


const ACTION_RECORD_API_URL =
  "https://script.google.com/macros/s/AKfycbw0DoVUbEfvfrmKrgjYig2vmJRkzXmqKAOr9RJheB88xx0WEC-IyXYicYgmhYt_ko7A/exec";

let actionRecordQueueFlushing =
  false;

function readPendingActionRecordSessions_() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          ACTION_RECORD_PENDING_KEY
        ) || "[]"
      );

    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch (error) {
    return [];
  }
}

function writePendingActionRecordSessions_(sessions) {
  localStorage.setItem(
    ACTION_RECORD_PENDING_KEY,
    JSON.stringify(
      Array.isArray(sessions)
        ? sessions
        : []
    )
  );

  updateStaffActionSyncStatus_();
}

async function callActionRecordApi_(
  action,
  payload
) {
  const url =
    ACTION_RECORD_API_URL +
    "?action=" +
    encodeURIComponent(action) +
    "&payload=" +
    encodeURIComponent(
      JSON.stringify(payload)
    ) +
    "&_=" +
    Date.now();

  const response =
    await fetch(
      url,
      {
        method: "GET",
        redirect: "follow",
        cache: "no-store"
      }
    );

  if (!response.ok) {
    throw new Error(
      "HTTPエラー：" +
      response.status
    );
  }

  return JSON.parse(
    await response.text()
  );
}

async function resolveActionRecordClientId_(
  clientName
) {
  const result =
    await postGas({
      action:
        "getClientList"
    });

  if (
    !result ||
    result.success !== true
  ) {
    throw new Error(
      "利用者情報を取得できません"
    );
  }

  const target =
    (result.clients || [])
      .find(
        c =>
          String(
            c.name || ""
          ).trim() ===
          String(
            clientName || ""
          ).trim()
      );

  if (!target) {
    throw new Error(
      "利用者IDを確認できません：" +
      clientName
    );
  }

  return target.clientId;
}

function actionRecordOperationId_() {
  return (
    "WEB-ARS-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2,8)
      .toUpperCase()
  );
}


function getActionRecordEventOperationId_(
  session,
  event,
  index
) {
  if (event.operationId) {
    return event.operationId;
  }

  const base =
    String(
      session.sessionId ||
      session.shiftId ||
      "SESSION"
    )
      .replace(
        /[^A-Za-z0-9_-]/g,
        ""
      )
      .slice(-40);

  event.operationId =
    "ARS-" +
    base +
    "-" +
    String(index + 1)
      .padStart(3, "0");

  return event.operationId;
}

function persistPendingActionRecordSession_(
  session
) {
  const current =
    readPendingActionRecordSessions_();

  const key =
    String(
      session.sessionId ||
      session.shiftId ||
      ""
    );

  const next =
    current.map(item => {
      const itemKey =
        String(
          item.sessionId ||
          item.shiftId ||
          ""
        );

      return itemKey === key
        ? session
        : item;
    });

  writePendingActionRecordSessions_(
    next
  );
}


async function syncOneActionRecordSession_(
  session
) {
  const clientId =
    session.syncState &&
    session.syncState.clientId
      ? session.syncState.clientId
      : await resolveActionRecordClientId_(
          session.clientName
        );

  session.syncState =
    session.syncState || {};

  session.syncState.clientId =
    clientId;

  let outingResultId =
    session.syncState.outingResultId || "";

  let routeId =
    session.syncState.routeId || "";

  let previousDriverId =
    session.syncState.previousDriverId || "";

  let nextEventIndex =
    Number(
      session.syncState.nextEventIndex || 0
    );

  const events =
    Array.isArray(session.events)
      ? session.events
      : [];

  for (
    let index = nextEventIndex;
    index < events.length;
    index++
  ) {
    const event =
      events[index] || {};

    const operationId =
      getActionRecordEventOperationId_(
        session,
        event,
        index
      );

    if (event.type === "start") {
      const result =
        await callActionRecordApi_(
          "outing-start",
          {
            data: {
              supportDate:
                session.supportDate,
              shiftId:
                session.shiftId,
              requestId: "",
              userId:
                clientId,
              userName:
                session.clientName,
              serviceType:
                session.service,
              serviceContent:
                event.supportDetail || "",
              mainStaffId:
                session.employeeId,
              mainStaffName:
                session.employeeName,
              startPlaceType:
                "自宅等",
              startPlace:
                event.place,
              transport:
                event.transport,
              isDriving:
                !!event.isDriving,
              driverId:
                event.driverId || "",
              driverName:
                event.driverName || "",
              vehicleName: "",
              isPaidTransport:
                !!event.isPaidTransport,
              supportDetail:
                event.supportDetail || "",
              operatorId:
                session.employeeId,
              operatorName:
                session.employeeName,
              registerType:
                "ポータル",
              operationId:
                operationId
            }
          }
        );

      if (
        !result ||
        result.success !== true
      ) {
        throw new Error(
          result?.message ||
          "行動記録を開始できませんでした"
        );
      }

      outingResultId =
        result.outingResultId ||
        outingResultId;

      routeId =
        result.routeId ||
        routeId;

      previousDriverId =
        event.driverId || "";

    } else if (
      event.type === "arrival"
    ) {
      const result =
        await callActionRecordApi_(
          "outing-arrive",
          {
            data: {
              outingResultId,
              routeId,
              arrivalType:
                "経由地",
              arrivalPlaceType:
                "店舗等",
              arrivalPlace:
                event.place,
              arrivalPlaceNote:
                event.note || "",
              distanceKm: "",
              odometerArrivalKm: "",
              endReport: "",
              operatorId:
                session.employeeId,
              operatorName:
                session.employeeName,
              operationId:
                operationId
            }
          }
        );

      if (
        !result ||
        result.success !== true
      ) {
        throw new Error(
          result?.message ||
          "到着を同期できませんでした"
        );
      }

    } else if (
      event.type ===
        "nextDeparture"
    ) {
      const result =
        await callActionRecordApi_(
          "outing-next-departure",
          {
            data: {
              outingResultId,
              previousRouteId:
                routeId,
              departurePlaceType:
                "経由地",
              departurePlace:
                event.place,
              departurePlaceNote: "",
              transport:
                event.transport,
              isDriving:
                !!event.isDriving,
              driverId:
                event.driverId || "",
              driverName:
                event.driverName || "",
              driverChanged: true,
              previousDriverId:
                previousDriverId || "",
              vehicleName: "",
              isPaidTransport:
                !!event.isPaidTransport,
              supportDetail: "",
              operatorId:
                session.employeeId,
              operatorName:
                session.employeeName,
              operationId:
                operationId
            }
          }
        );

      if (
        !result ||
        result.success !== true
      ) {
        throw new Error(
          result?.message ||
          "再出発を同期できませんでした"
        );
      }

      routeId =
        result.routeId ||
        routeId;

      previousDriverId =
        event.driverId || "";

    } else if (
      event.type === "home"
    ) {
      const result =
        await callActionRecordApi_(
          "outing-arrive",
          {
            data: {
              outingResultId,
              routeId,
              arrivalType:
                "最終到着",
              arrivalPlaceType:
                "自宅等",
              arrivalPlace:
                "自宅",
              arrivalPlaceNote:
                event.activity || "",
              distanceKm: "",
              odometerArrivalKm: "",
              endReport:
                event.activity || "",
              operatorId:
                session.employeeId,
              operatorName:
                session.employeeName,
              operationId:
                operationId
            }
          }
        );

      if (
        !result ||
        result.success !== true
      ) {
        throw new Error(
          result?.message ||
          "帰宅を同期できませんでした"
        );
      }

    } else if (
      event.type === "finishCurrent" ||
      event.type === "forceFinish"
    ) {
      const result =
        await callActionRecordApi_(
          "outing-finish-current-arrival",
          {
            data: {
              outingResultId,
              routeId,
              endReport: "",
              operatorId:
                session.employeeId,
              operatorName:
                session.employeeName,
              operationId:
                operationId
            }
          }
        );

      if (
        !result ||
        result.success !== true
      ) {
        throw new Error(
          result?.message ||
          "行動記録終了を同期できませんでした"
        );
      }
    }

    /*
     * 1イベント成功するたびにチェックポイントを保存。
     * 次回再送は成功済みイベントを繰り返しません。
     */
    session.syncState = {
      ...session.syncState,
      outingResultId:
        outingResultId,
      routeId:
        routeId,
      previousDriverId:
        previousDriverId,
      nextEventIndex:
        index + 1,
      lastSyncedAt:
        new Date().toISOString()
    };

    persistPendingActionRecordSession_(
      session
    );
  }

  /*
   * ポータル履歴のサーバー保存は、
   * 現在のSTAFF_PORTAL GASに
   * recordPortalHistoryEventが未実装でも
   * 行動記録本体の同期を失敗扱いにしません。
   *
   * ローカル履歴は端末に残るため、
   * 後で履歴APIを整備した際に救済できます。
   */
  session.syncState = {
    ...session.syncState,
    actionRecordSynced:
      true,
    completedAt:
      new Date().toISOString()
  };

  persistPendingActionRecordSession_(
    session
  );

  return {
    success: true,
    outingResultId:
      outingResultId,
    routeId:
      routeId
  };
}


function isActionRecordNetworkError_(error) {
  const message = String(
    error && error.message
      ? error.message
      : error || ""
  ).toLowerCase();

  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("通信") ||
    message.includes("network request failed")
  );
}

function getActionRecordRetryDelayMs_(session) {
  const retryCount = Number(
    session && session.retryCount || 0
  );

  if (retryCount <= 0) return 0;
  if (retryCount === 1) return 30000;
  if (retryCount === 2) return 60000;
  if (retryCount === 3) return 120000;
  if (retryCount === 4) return 300000;
  return 600000;
}

function isActionRecordRetryDue_(session) {
  if (!session || !session.lastRetryAt) {
    return true;
  }

  const last = new Date(
    session.lastRetryAt
  ).getTime();

  if (!Number.isFinite(last)) {
    return true;
  }

  return (
    Date.now() - last >=
    getActionRecordRetryDelayMs_(session)
  );
}

function hasActionRecordCheckpoint_(session) {
  const syncState =
    session &&
    session.syncState &&
    typeof session.syncState === "object"
      ? session.syncState
      : null;

  return !!(
    syncState &&
    (
      Number(syncState.nextEventIndex || 0) > 0 ||
      syncState.outingResultId ||
      syncState.routeId ||
      syncState.actionRecordSynced
    )
  );
}


function isPastSupportDate_(supportDate) {
  const text =
    String(
      supportDate || ""
    ).trim();

  if (!text) {
    return false;
  }

  const normalized =
    text.replace(/\//g, "-");

  const match =
    normalized.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})/
    );

  if (!match) {
    return false;
  }

  const target =
    [
      match[1],
      String(match[2]).padStart(2, "0"),
      String(match[3]).padStart(2, "0")
    ].join("-");

  const today =
    getTodayLocalDateText();

  return target < today;
}


function shouldMoveOldPendingSessionToReview_(
  session
) {
  if (!session) {
    return false;
  }

  if (
    hasActionRecordCheckpoint_(
      session
    )
  ) {
    return false;
  }

  const firstError =
    String(
      session.firstError || ""
    );

  const lastError =
    String(
      session.lastError || ""
    );

  if (
    isLegacyActionRecordStateError_(
      firstError
    ) ||
    isLegacyActionRecordStateError_(
      lastError
    )
  ) {
    return true;
  }

  /*
   * 前日以前の古い未送信で、
   * チェックポイントが一度も作られず、
   * 5回以上試行済みなら無限再送を止めて要確認へ。
   * 当日分は通信不良でも自動退避しません。
   */
  return (
    isPastSupportDate_(
      session.supportDate
    ) &&
    Number(
      session.retryCount || 0
    ) >= 5
  );
}

async function flushPendingActionRecordSessions_(
  options = {}
) {
  if (actionRecordQueueFlushing) {
    return;
  }

  if (
    typeof navigator !== "undefined" &&
    navigator.onLine === false
  ) {
    updateStaffActionSyncStatus_();
    return;
  }

  const force =
    options.force === true;

  const pending =
    readPendingActionRecordSessions_();

  if (!pending.length) {
    updateStaffActionSyncStatus_();
    return;
  }

  actionRecordQueueFlushing = true;

  const failedSessions = [];

  try {
    for (const session of pending) {
      /*
       * 旧データの無限再送を止めます。
       * SW000054のように前日以前で、
       * チェックポイント無し・再送多数のものは要確認へ退避します。
       */
      if (
        shouldMoveOldPendingSessionToReview_(
          session
        )
      ) {
        moveActionRecordSessionToReview_(
          session,
          new Error(
            session.firstError ||
            session.lastError ||
            "旧未送信データのため要確認へ退避"
          )
        );
        continue;
      }

      /*
       * 自動再送はバックオフ時間が来たものだけ。
       * ユーザーが未送信表示をタップした時だけ force=true で即再送。
       */
      if (
        !force &&
        !isActionRecordRetryDue_(session)
      ) {
        failedSessions.push(session);
        continue;
      }

      try {
        await syncOneActionRecordSession_(
          session
        );

      } catch (error) {
        if (
          !hasActionRecordCheckpoint_(session) &&
          isLegacyActionRecordStateError_(error)
        ) {
          moveActionRecordSessionToReview_(
            session,
            error
          );
          continue;
        }

        const networkError =
          isActionRecordNetworkError_(error);

        const previousError =
          String(
            session.lastError || ""
          );

        const previousWasStateError =
          isLegacyActionRecordStateError_(
            previousError
          );

        const nextRetryCount =
          networkError
            ? Math.max(
                1,
                Number(
                  session.retryCount || 0
                )
              )
            : Number(
                session.retryCount || 0
              ) + 1;

        const currentErrorMessage =
          error && error.message
            ? error.message
            : String(error || "");

        failedSessions.push({
          ...session,
          retryCount:
            nextRetryCount,
          lastRetryAt:
            new Date().toISOString(),
          firstError:
            session.firstError ||
            currentErrorMessage,
          lastError:
            previousWasStateError &&
            networkError
              ? previousError
              : currentErrorMessage,
          lastNetworkError:
            networkError
              ? (
                  error && error.message
                    ? error.message
                    : String(error || "")
                )
              : (
                  session.lastNetworkError || ""
                )
        });
      }
    }

    writePendingActionRecordSessions_(
      failedSessions
    );

  } finally {
    actionRecordQueueFlushing = false;
    updateStaffActionSyncStatus_();
  }
}

const STAFF_ACTION_QUEUE_KEY =
  "staffPortalActionQueueV1";

let staffActionQueueFlushing = false;
let staffActionQueueTimer = null;

function readStaffActionQueue_() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          STAFF_ACTION_QUEUE_KEY
        ) || "[]"
      );

    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch (error) {
    console.warn(
      "未送信キューを読めませんでした",
      error
    );
    return [];
  }
}

function writeStaffActionQueue_(
  queue
) {
  localStorage.setItem(
    STAFF_ACTION_QUEUE_KEY,
    JSON.stringify(
      Array.isArray(queue)
        ? queue
        : []
    )
  );

  updateStaffActionSyncStatus_();
}

function updateStaffActionSyncStatus_() {
  const el =
    document.getElementById(
      "staffActionSyncStatus"
    );

  if (!el) return;

  const staffActionCount =
    readStaffActionQueue_().length;

  const actionRecordCount =
    readPendingActionRecordSessions_().length;

  const count =
    staffActionCount +
    actionRecordCount;

  const reviewCount =
    readActionRecordReview_()
      .length;

  el.classList.remove(
    "synced",
    "pending",
    "warning",
    "danger"
  );

  if (count === 0) {
    if (reviewCount > 0) {
      el.classList.add("warning");
      el.textContent =
        "✓ 同期済み　要確認 " +
        reviewCount +
        "件";
      el.title =
        "タップすると要確認データの詳細を表示します。";
    } else {
      el.classList.add("synced");
      el.textContent = "✓ 同期済み";
      el.title = "";
    }
  } else {
    const detail = [];

    if (staffActionCount > 0) {
      detail.push(
        "操作" +
        staffActionCount +
        "件"
      );
    }

    if (actionRecordCount > 0) {
      detail.push(
        "行動記録" +
        actionRecordCount +
        "件"
      );
    }

    if (count <= 10) {
      el.classList.add("pending");
      el.textContent =
        "↻ 未送信 " +
        count +
        "件（" +
        detail.join("・") +
        "）";
    } else if (count < 50) {
      el.classList.add("warning");
      el.textContent =
        "⚠ 未送信 " +
        count +
        "件（" +
        detail.join("・") +
        "）";
    } else {
      el.classList.add("danger");
      el.textContent =
        "⚠ 通信確認 未送信 " +
        count +
        "件（" +
        detail.join("・") +
        "）";
    }

    const staffQueue =
      readStaffActionQueue_();

    const actionSessions =
      readPendingActionRecordSessions_();

    const failedInfo = [];

    staffQueue.forEach(item => {
      if (
        item &&
        item.lastError
      ) {
        failedInfo.push(
          "操作: " +
          item.lastError
        );
      }
    });

    actionSessions.forEach(session => {
      if (
        session &&
        session.lastError
      ) {
        failedInfo.push(
          "行動記録: " +
          session.lastError
        );
      }
    });

    el.title =
      failedInfo.length
        ? (
            "タップすると未送信・要確認データの詳細を表示します\n" +
            failedInfo
              .slice(0, 5)
              .join("\n")
          )
        : "タップすると未送信・要確認データの詳細を表示します";
  }
}
function enqueueStaffAction_(
  payload
) {
  const queue =
    readStaffActionQueue_();

  const sendId =
    String(
      payload.sendId || ""
    ).trim();

  if (
    sendId &&
    queue.some(
      item =>
        item &&
        item.payload &&
        item.payload.sendId ===
          sendId
    )
  ) {
    return;
  }

  queue.push({
    id:
      sendId ||
      (
        "Q-" +
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .slice(2,8)
      ),

    createdAt:
      new Date()
        .toISOString(),

    attempts:
      0,

    lastError:
      "",

    payload:
      payload
  });

  writeStaffActionQueue_(
    queue
  );
}

function removeStaffActionQueueItem_(
  sendId
) {
  const queue =
    readStaffActionQueue_()
      .filter(
        item =>
          !item ||
          !item.payload ||
          item.payload.sendId !==
            sendId
      );

  writeStaffActionQueue_(
    queue
  );
}

function updateQueuedStaffActionError_(
  sendId,
  error
) {
  const queue =
    readStaffActionQueue_();

  queue.forEach(
    item => {
      if (
        item &&
        item.payload &&
        item.payload.sendId ===
          sendId
      ) {
        item.attempts =
          Number(
            item.attempts || 0
          ) + 1;

        item.lastError =
          error &&
          error.message
            ? error.message
            : String(
                error || ""
              );

        item.lastAttemptAt =
          new Date()
            .toISOString();
      }
    }
  );

  writeStaffActionQueue_(
    queue
  );
}

async function sendQueuedStaffActionItem_(
  item
) {
  if (
    !item ||
    !item.payload
  ) {
    return {
      success: false,
      permanentError: true,
      message:
        "送信データがありません"
    };
  }

  try {
    const result =
      await postGas(
        item.payload
      );

    if (
      !result ||
      result.success !== true
    ) {
      /*
       * GASまで届いて業務エラーになった場合は
       * 通信障害ではないため再送対象にしません。
       */
      return {
        success: false,
        permanentError: true,
        message:
          result &&
          result.message
            ? result.message
            : "操作を登録できませんでした"
      };
    }

    removeStaffActionQueueItem_(
      item.payload.sendId
    );

    /*
     * 複数人介助の未入力確認は、
     * この本人の「終わりました」がGASへ届いた後に実行します。
     * 通信不良で後日再送された場合も、送信成功した時点で実行されます。
     */
    if (
      item.payload.actionType ===
        "終わりました"
    ) {
      await finalizeUntouchedCoStaffAfterFinish_(
        {
          shiftId:
            item.payload.shiftId,
          clientName:
            item.payload.clientName,
          supportDate:
            item.payload.supportDate,
          service:
            item.payload.service,
          startTime:
            item.payload.scheduledStart,
          endTime:
            item.payload.scheduledEnd
        },
        item.payload.deviceTime
      );
    }

    return {
      success: true,
      result:
        result
    };

  } catch (error) {
    /*
     * オフライン・タイムアウト・HTTPエラー等は
     * 端末へ残して後で再送します。
     */
    updateQueuedStaffActionError_(
      item.payload.sendId,
      error
    );

    return {
      success: false,
      permanentError: false,
      error:
        error
    };
  }
}

async function flushStaffActionQueue_() {
  if (
    staffActionQueueFlushing
  ) {
    return;
  }

  if (
    typeof navigator !==
      "undefined" &&
    navigator.onLine === false
  ) {
    updateStaffActionSyncStatus_();
    return;
  }

  const queue =
    readStaffActionQueue_();

  if (!queue.length) {
    updateStaffActionSyncStatus_();
    return;
  }

  staffActionQueueFlushing =
    true;

  try {
    /*
     * 操作順序が重要なので必ず先頭から順番に送ります。
     * 1件でも通信失敗したら後続を止め、
     * 次回復旧時に同じ順番で再送します。
     */
    for (
      const item of queue
    ) {
      const sent =
        await sendQueuedStaffActionItem_(
          item
        );

      if (sent.success) {
        continue;
      }

      if (sent.permanentError) {
        /*
         * 業務エラーはキューから除外し、
         * 二重再送しないようにします。
         */
        removeStaffActionQueueItem_(
          item.payload.sendId
        );

        console.error(
          "未送信操作の登録不可",
          sent.message
        );

        continue;
      }

      /*
       * 通信失敗でも後続を止めません。
       * 失敗した1件だけ端末に残し、
       * 他の操作は送れるものから送ります。
       */
      console.warn(
        "この操作は次回再送します",
        item.payload.sendId
      );

      continue;
    }

  } finally {
    staffActionQueueFlushing =
      false;

    updateStaffActionSyncStatus_();

    /*
     * 通常操作に送信待ちが残っていても、
     * 行動記録側で送れるセッションは送信します。
     */
    flushPendingActionRecordSessions_()
      .catch(
        error =>
          console.warn(
            "行動記録の後続同期に失敗",
            error
          )
      );
  }
}


function getPendingSyncErrorDetails_() {
  const lines = [];

  const staffQueue =
    readStaffActionQueue_();

  staffQueue.forEach(
    (item, index) => {
      const payload =
        item && item.payload
          ? item.payload
          : {};

      lines.push(
        [
          "【操作 " + (index + 1) + "】",
          payload.clientName || "",
          payload.actionType || "",
          item.lastError
            ? "エラー: " + item.lastError
            : "エラー内容: まだ取得できていません",
          "再送回数: " +
            Number(item.attempts || 0)
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
  );

  const sessions =
    readPendingActionRecordSessions_();

  sessions.forEach(
    (session, index) => {
      lines.push(
        [
          "【行動記録 " + (index + 1) + "】",
          session.clientName || "",
          session.service || "",
          "シフトID: " +
            (session.shiftId || ""),
          session.lastError
            ? "エラー: " + session.lastError
            : "エラー内容: まだ取得できていません",
          "再送回数: " +
            Number(session.retryCount || 0)
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
  );

  const reviews =
    readActionRecordReview_();

  reviews.forEach(
    (session, index) => {
      lines.push(
        [
          "【要確認 " +
            (index + 1) +
            "】",
          session.clientName || "",
          session.service || "",
          "シフトID: " +
            (session.shiftId || ""),
          "理由: " +
            (
              session.reviewReason ||
              "状態不一致"
            ),
          "PC訂正対象"
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
  );

  return lines;
}


function showPendingSyncErrorDetails_() {
  const lines =
    getPendingSyncErrorDetails_();

  if (!lines.length) {
    alert("未送信データはありません。");
    return;
  }

  alert(
    "未送信データの詳細\n\n" +
    lines.join("\n\n")
  );
}


async function retryAllPendingSyncNow_() {
  const el =
    document.getElementById(
      "staffActionSyncStatus"
    );

  if (el) {
    el.textContent =
      "↻ 再送しています…";
  }

  try {
    await flushStaffActionQueue_();
    await flushPendingActionRecordSessions_({ force: true });
  } catch (error) {
    console.warn(
      "手動再送に失敗",
      error
    );
  } finally {
    /*
     * 再送後は表示だけ更新します。
     * 自動的にalertを出さないことで、
     * 「閉じた直後にまたエラー画面」のループを防ぎます。
     */
    updateStaffActionSyncStatus_();
  }
}


function startStaffActionQueueSync_() {
  updateStaffActionSyncStatus_();

  /*
   * 起動直後にも既存の未送信を整理します。
   * 古い状態不一致データは要確認へ退避され、
   * 正常な未送信はそのまま再送されます。
   */
  setTimeout(
    () => {
      flushStaffActionQueue_()
        .catch(error =>
          console.warn(
            "起動時の操作同期に失敗",
            error
          )
        );

      flushPendingActionRecordSessions_()
        .catch(error =>
          console.warn(
            "起動時の行動記録同期に失敗",
            error
          )
        );
    },
    800
  );

  const syncStatus =
    document.getElementById(
      "staffActionSyncStatus"
    );

  if (
    syncStatus &&
    !syncStatus.dataset.retryBound
  ) {
    syncStatus.dataset.retryBound = "1";
    syncStatus.style.cursor = "pointer";
    syncStatus.addEventListener(
      "click",
      () => {
        const pendingCount =
          readStaffActionQueue_().length +
          readPendingActionRecordSessions_().length;

        const reviewCount =
          readActionRecordReview_().length;

        /*
         * タップは詳細確認だけにします。
         * タップした瞬間に再送→alertを繰り返さないようにします。
         * 再送自体はバックグラウンドとonline復帰時に行います。
         */
        if (
          pendingCount > 0 ||
          reviewCount > 0
        ) {
          showPendingSyncErrorDetails_();
        }
      }
    );
  }

  if (
    staffActionQueueTimer
  ) {
    return;
  }

  staffActionQueueTimer =
    setInterval(
      () => {
        flushStaffActionQueue_()
          .catch(
            error =>
              console.warn(
                "未送信キュー再送失敗",
                error
              )
          );
      },
      30000
    );
}

window.addEventListener(
  "online",
  () => {
    flushStaffActionQueue_()
      .catch(
        error =>
          console.warn(
            "通信復旧後の再送失敗",
            error
          )
      );

    flushPendingActionRecordSessions_({
      force: true
    }).catch(
      error =>
        console.warn(
          "通信復旧後の行動記録再送失敗",
          error
        )
    );
  }
);

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState ===
      "visible"
    ) {
      flushStaffActionQueue_()
        .catch(
          error =>
            console.warn(
              "画面復帰時の再送失敗",
              error
            )
        );
    }
  }
);



let pendingStaffActionState = null;

function getExpectedStateForAction_(
  actionType
) {
  if (actionType === "向かいます") {
    return "移動中";
  }

  if (
    actionType === "入りました" ||
    actionType === "支援開始" ||
    actionType === "引き続き支援"
  ) {
    return "支援中";
  }

  if (actionType === "終わりました") {
    return "終了";
  }

  if (actionType === "キャンセル") {
    return "キャンセル";
  }

  return "";
}

function setPendingStaffActionState_(
  shift,
  actionType
) {
  if (!shift) return;

  const expectedState =
    getExpectedStateForAction_(
      actionType
    );

  if (!expectedState) {
    pendingStaffActionState = null;
    return;
  }

  pendingStaffActionState = {
    shiftId:
      shift.shiftId,
    clientName:
      shift.clientName,
    actionType:
      actionType,
    expectedState:
      expectedState,
    startedAt:
      Date.now()
  };
}

function clearPendingStaffActionState_() {
  pendingStaffActionState = null;
}


function getLocalLatestStateByShift_(
  shiftId
) {
  if (!shiftId) {
    return "";
  }

  const events =
    getPortalLocalHistory_()
      .filter(
        event =>
          event.shiftId === shiftId
      )
      .sort(
        (a, b) =>
          new Date(
            a.actualAt || 0
          ) -
          new Date(
            b.actualAt || 0
          )
      );

  if (!events.length) {
    return "";
  }

  let state = "";

  events.forEach(
    event => {
      const type =
        String(
          event.eventType || ""
        ).trim();

      if (type === "向かいます") {
        state = "移動中";

      } else if (
        type === "入りました" ||
        type === "支援開始" ||
        type === "引き続き支援"
      ) {
        state = "支援中";

      } else if (
        type === "終わりました" ||
        type === "支援終了"
      ) {
        state = "終了";

      } else if (
        type === "キャンセル"
      ) {
        state = "キャンセル";
      }
    }
  );

  return state;
}

function applyLocalHistoryStateFallback_(
  shifts
) {
  const list =
    Array.isArray(shifts)
      ? shifts.map(
          shift => ({ ...shift })
        )
      : [];

  list.forEach(
    shift => {
      const serverState =
        String(
          shift.currentState || ""
        ).trim();

      /*
       * キャッシュ表示時など、サーバー状態が空/未開始でも
       * この端末の最新履歴が先へ進んでいれば、
       * GAS取得完了までの仮表示として履歴側を優先します。
       */
      if (
        !serverState ||
        serverState === "未開始"
      ) {
        const localState =
          getLocalLatestStateByShift_(
            shift.shiftId
          );

        if (
          localState &&
          localState !== "未開始"
        ) {
          shift.currentState =
            localState;
        }
      }
    }
  );

  return list;
}

function applyPendingStaffActionState_(
  shifts
) {
  const list =
    Array.isArray(shifts)
      ? shifts.map(
          shift => ({ ...shift })
        )
      : [];

  const pending =
    pendingStaffActionState;

  if (!pending) {
    return list;
  }

  /*
   * 10秒以上残る場合は異常とみなし、
   * 通常のサーバー状態へ戻します。
   */
  if (
    Date.now() -
      pending.startedAt >
    10000
  ) {
    clearPendingStaffActionState_();
    return list;
  }

  const target =
    list.find(
      shift =>
        shift.shiftId ===
        pending.shiftId
    );

  if (!target) {
    /*
     * 終了・キャンセル後に一覧から対象が消える実装でも
     * 正常完了とみなします。
     */
    if (
      ["終了","キャンセル"].includes(
        pending.expectedState
      )
    ) {
      clearPendingStaffActionState_();
    }

    return list;
  }

  const actualState =
    String(
      target.currentState ||
      "未開始"
    ).trim();

  /*
   * GAS側の状態が期待状態まで進んだら固定解除。
   */
  if (
    actualState ===
    pending.expectedState
  ) {
    clearPendingStaffActionState_();
    return list;
  }

  /*
   * GASの再取得が一瞬古い状態を返しても、
   * 画面上だけは操作後の期待状態を維持します。
   */
  target.currentState =
    pending.expectedState;

  return list;
}

function waitPortalStateSync_(
  milliseconds
) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

async function refreshUntilPendingStateSettled_() {
  /*
   * GAS登録直後はSTAFF_ACTIONと一覧側の反映に僅かな差が
   * 出る場合があるため、短時間だけ再確認します。
   */
  for (
    let attempt = 0;
    attempt < 3;
    attempt++
  ) {
    await loadTodayStaffShifts(
      true
    );

    if (!pendingStaffActionState) {
      return;
    }

    await waitPortalStateSync_(
      250
    );
  }

  /*
   * 3回で同期しなくても、固定は最大10秒で自然解除されます。
   * 画面には古い「未開始」を出しません。
   */
}




/**
 * 本日の担当シフトを表示します。
 *
 * 1. 保存済みシフトがあれば即時表示
 * 2. 基本シフトの更新番号を確認
 * 3. 変更時だけ最新シフトを再取得
 */
async function loadTodayStaffShifts(forceRefresh = false) {

  const select =
    document.getElementById(
      "todayShiftSelect"
    );

  if (!select) {
    console.error(
      "todayShiftSelectが見つかりません"
    );

    return;
  }

  /*
   * 最新状態の確認中は、現在の支援状態を「未開始」に戻してはいけません。
   *
   * setStaffActionButtonsByState("") を呼ぶと、
   * currentState || "未開始" により「向かいます」が一瞬表示されるため、
   * ここでは既存のボタン状態をいったん全て操作不可にするだけにします。
   *
   * GASから最新状態を取得した後、
   * setTodayShiftOptions() / handleTodayShiftChange() が
   * 正しい「入りました」「終わりました」等へ切り替えます。
   */
  setStaffActionButtonsDisabled(true);

  if (!currentUser) {
    select.innerHTML =
      '<option value="">' +
      '職員情報を確認できませんでした' +
      '</option>';

    return;
  }

  /*
   * 前回保存した本日のシフトを取得します。
   */
  const cache =
    getTodayStaffShiftCache();

  /*
   * 保存済みシフトがあれば、
   * 通信を待たずに先に表示します。
   */
  if (cache) {
    todayStaffShifts =
      applyPendingStaffActionState_(
        applyLocalHistoryStateFallback_(
          cache.shifts || []
        )
      );

    setTodayShiftOptions(
      todayStaffShifts
    );

  } else {
    select.innerHTML =
      '<option value="">' +
      '本日の担当シフトを確認しています…' +
      '</option>';
  }

  try {
	/*
	 * 基本シフトの更新番号を確認します。
	 * 更新番号を取得できない場合も、
	 * 本日の支援一覧は通常どおり取得します。
	 */
	let latestVersion = "";
	let versionCheckSucceeded = false;

	try {
	  latestVersion =
	    await getStaffShiftVersion();

	  versionCheckSucceeded = true;

	} catch (versionError) {
	  console.warn(
	    "基本シフトの更新番号を取得できませんでした。" +
	    "本日の支援一覧を直接取得します。",
	    versionError
	  );

	  /*
	   * 更新番号を確認できなかった場合は、
	   * 保存データを最新版とは判断しません。
	   */
	  latestVersion =
	    "unverified-" + Date.now();
	}

	const cacheIsCurrent =
	  !forceRefresh &&
	  versionCheckSucceeded &&
	  cache &&
	  String(cache.version) ===
	    String(latestVersion);
    
    /*
     * 基本シフトの更新番号が同じでも、
     * 「向かいます」「入りました」「終わりました」などの
     * 現在状態は別データで随時変化します。
     *
     * そのためキャッシュは画面を素早く出すためだけに使い、
     * 本日の支援一覧は毎回GASから取得して現在状態を更新します。
     */
    if (cacheIsCurrent) {
      console.log(
        "基本シフトの変更なし。" +
        "現在状態だけ最新化します。"
      );
    }

    /*
     * 最新の担当シフトと現在状態を取得します。
     */
    const result =
      await postGas({
        action:
          "getTodayStaffShifts",

        employeeId:
          currentUser.employeeId,

        employeeName:
          currentUser.employeeName
      });

    if (!result.success) {
      throw new Error(
        result.message ||
        "シフトの取得に失敗しました。"
      );
    }

    const oldShifts =
      cache &&
      Array.isArray(cache.shifts)
        ? cache.shifts
        : [];

    const newShifts =
      result.shifts || [];

    /*
     * 前回にはなかったシフトを確認します。
     */
    const addedShifts =
      findAddedTodayShifts(
        oldShifts,
        newShifts
      );

    todayStaffShifts =
      applyPendingStaffActionState_(
        applyLocalHistoryStateFallback_(
          newShifts
        )
      );

    /*
     * プルダウンを最新状態へ更新します。
     * 操作直後はGASが一瞬古い状態を返しても、
     * pending状態を優先して表示します。
     */
    setTodayShiftOptions(
      todayStaffShifts
    );

    /*
     * 最新シフトと更新番号を端末へ保存します。
     */
    saveTodayStaffShiftCache(
      latestVersion,
      todayStaffShifts
    );

    /*
     * 初回取得では通知せず、
     * 前回データがある場合だけ通知します。
     */
    if (
      cache &&
      addedShifts.length > 0
    ) {
      showAddedShiftNotice(
        addedShifts
      );
    }

  } catch (error) {
    console.error(
      "本日のシフト確認エラー",
      error
    );

    /*
     * 保存済みシフトがある場合は、
     * 通信エラーでもその表示を維持します。
     */
    if (cache) {
      return;
    }

    select.innerHTML =
      '<option value="">' +
      '取得エラー：' +
      escapeHtmlForOption_(
        error.message
      ) +
      '</option>';

    setStaffActionButtonsDisabled(true);
  }
}

function escapeHtmlForOption_(
  value
) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}


/**
 * 本日のシフトを選択欄へ表示します。
 */

const LAST_OUTING_PLACE_KEY =
  "staffPortalLastOutingPlaceV1";

function saveLastOutingPlace_(place) {
  if (!place) return;
  localStorage.setItem(
    LAST_OUTING_PLACE_KEY,
    String(place)
  );
}

function getLastOutingPlace_() {
  return String(
    localStorage.getItem(
      LAST_OUTING_PLACE_KEY
    ) || ""
  ).trim();
}

function clearLastOutingPlace_() {
  localStorage.removeItem(
    LAST_OUTING_PLACE_KEY
  );
}

const ACTIVE_SUPPORT_CHAIN_KEY =
  "staffPortalActiveSupportChainV1";

function setSupportGuideText_(
  text
) {
  const el =
    document.getElementById(
      "supportGuideText"
    );

  if (el) {
    el.textContent =
      text || "";
  }
}

function getSavedSupportChain_() {
  try {
    return JSON.parse(
      localStorage.getItem(
        ACTIVE_SUPPORT_CHAIN_KEY
      ) || "null"
    );
  } catch (error) {
    return null;
  }
}

function saveSupportChain_(
  shift
) {
  if (!shift) return;

  localStorage.setItem(
    ACTIVE_SUPPORT_CHAIN_KEY,
    JSON.stringify({
      clientName:
        shift.clientName || "",

      shiftId:
        shift.shiftId || "",

      startedAt:
        new Date()
          .toISOString()
    })
  );
}

function clearSupportChain_() {
  localStorage.removeItem(
    ACTIVE_SUPPORT_CHAIN_KEY
  );
}

function isSameClientChain_(
  shift,
  chain
) {
  if (!shift || !chain) {
    return false;
  }

  return (
    String(
      shift.clientName || ""
    ).trim() ===
    String(
      chain.clientName || ""
    ).trim()
  );
}

function findChainShift_(
  shifts
) {
  if (!Array.isArray(shifts)) {
    return null;
  }

  const chain =
    getSavedSupportChain_();

  /*
   * まず現在「移動中 / 支援中」の支援を優先します。
   */
  const active =
    shifts.find(
      shift =>
        ["移動中","支援中"].includes(
          String(
            shift.currentState || ""
          ).trim()
        )
    );

  if (active) {
    saveSupportChain_(
      active
    );
    return active;
  }

  if (!chain) {
    return null;
  }

  /*
   * 同一利用者の一連の支援が続いている間は、
   * 未開始の次支援もプルダウンに表示し続けます。
   */
  const sameClientSelectable =
    shifts.find(
      shift => {
        const state =
          String(
            shift.currentState ||
            "未開始"
          ).trim();

        return (
          isSameClientChain_(
            shift,
            chain
          ) &&
          ![
            "終了",
            "キャンセル"
          ].includes(
            state
          )
        );
      }
    );

  if (sameClientSelectable) {
    return sameClientSelectable;
  }

  /*
   * 同一利用者の選択可能な支援がなくなれば、
   * 一連の支援は終了したと判断します。
   */
  clearSupportChain_();
  return null;
}

function updateSupportGuideByState_(
  shift,
  selectableCount,
  processing = false
) {
  if (processing) {
    setSupportGuideText_(
      "ただいま処理中です"
    );
    return;
  }

  if (!shift) {
    if (selectableCount > 0) {
      setSupportGuideText_(
        "支援を選択してください"
      );
    } else {
      setSupportGuideText_(
        "本日の支援は終了しています"
      );
    }
    return;
  }

  const state =
    String(
      shift.currentState ||
      "未開始"
    ).trim();

  if (state === "移動中") {
    setSupportGuideText_(
      shift.clientName +
      "さんへ向かっています"
    );
    return;
  }

  if (state === "支援中") {
    setSupportGuideText_(
      shift.clientName +
      "さんを支援中です"
    );
    return;
  }

  setSupportGuideText_(
    shift.clientName +
    "さんの支援を選択中です"
  );
}

function setTodayShiftOptions(shifts) {
  const select =
    document.getElementById(
      "todayShiftSelect"
    );

  if (!select) {
    return;
  }

  const previousSelectedShiftId =
    select.value || "";

  const allShifts =
    Array.isArray(shifts)
      ? shifts
      : [];

  const selectableShifts =
    allShifts.filter(
      shift => {
        const state =
          String(
            shift.currentState ||
            "未開始"
          ).trim();

        return ![
          "終了",
          "キャンセル"
        ].includes(state);
      }
    );

  const finishedShifts =
    allShifts.filter(
      shift => {
        const state =
          String(
            shift.currentState ||
            ""
          ).trim();

        return [
          "終了",
          "キャンセル"
        ].includes(state);
      }
    );

  /*
   * 向かいます後～同一利用者の一連の支援が終わるまで、
   * 現在の利用者の支援をプルダウンに保持します。
   */
  const chainShift =
    findChainShift_(
      selectableShifts
    );

  select.innerHTML = "";

  if (
    selectableShifts.length === 0
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value = "";
    option.textContent =
      "選択できる支援はありません";

    select.appendChild(
      option
    );

  } else if (!chainShift) {
    const option =
      document.createElement(
        "option"
      );

    option.value = "";
    option.textContent =
      "支援を選択してください";

    select.appendChild(
      option
    );
  }

  selectableShifts.forEach(
    shift => {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        shift.shiftId;

      const state =
        shift.currentState ||
        "未開始";

      option.textContent =
        shift.startTime +
        "～" +
        shift.endTime +
        "　" +
        shift.clientName +
        "　" +
        shift.service +
        "　【" +
        state +
        "】";

      select.appendChild(
        option
      );
    }
  );

  renderFinishedSupportList_(
    finishedShifts
  );

  if (
    selectableShifts.length === 0
  ) {
    clearSupportChain_();

    setStaffActionButtonsByState(
      ""
    );

    const actionGrid =
      document.getElementById(
        "portalActionButtons"
      );

    const tempButton =
      document.getElementById(
        "temporaryChangeButton"
      );

    if (actionGrid) {
      actionGrid.classList.add(
        "hidden"
      );
    }

    if (tempButton) {
      tempButton.classList.add(
        "hidden"
      );
    }

    updateSupportMainDisplay_(
      null
    );

    updateSupportGuideByState_(
      null,
      0
    );

    applyPcOperationGuard_(
      null
    );
return;
  }

  const actionGrid =
    document.getElementById(
      "portalActionButtons"
    );

  if (actionGrid) {
    actionGrid.classList.remove(
      "hidden"
    );
  }

  /*
   * Android/Chromeのネイティブselectを開くと、
   * 閉じた瞬間にwindow focusが発生することがあります。
   * そのfocus再読込で選択値が初期化されないよう、
   * select操作中は自動再取得を止めます。
   */
  select.onpointerdown =
    beginSupportSelectInteraction_;

  select.onmousedown =
    beginSupportSelectInteraction_;

  select.ontouchstart =
    beginSupportSelectInteraction_;

  select.onfocus =
    beginSupportSelectInteraction_;

  select.onchange =
    () => {
      handleTodayShiftChange();
      endSupportSelectInteraction_(
        500
      );
    };

  select.onblur =
    () => {
      endSupportSelectInteraction_(
        500
      );
    };

  if (chainShift) {
    select.value =
      chainShift.shiftId;

    select.disabled =
      ["移動中","支援中"].includes(
        String(
          chainShift.currentState ||
          ""
        ).trim()
      );

    updateSupportGuideByState_(
      chainShift,
      selectableShifts.length
    );

    handleTodayShiftChange();

    /*
     * 支援中のプルダウン固定は維持。
     * ただし移動中なら「入りました」が必ず見える状態を再確定する。
     */
    if (
      String(
        chainShift.currentState || ""
      ).trim() === "移動中"
    ) {
      setStaffActionButtonsByState(
        "移動中"
      );
}

    return;
  }

  select.disabled = false;

  const previousStillSelectable =
    previousSelectedShiftId &&
    selectableShifts.some(
      shift =>
        shift.shiftId ===
        previousSelectedShiftId
    );

  if (previousStillSelectable) {
    select.value =
      previousSelectedShiftId;

    const selectedShift =
      selectableShifts.find(
        shift =>
          shift.shiftId ===
          previousSelectedShiftId
      );

    updateSupportGuideByState_(
      selectedShift,
      selectableShifts.length
    );

  } else {
    select.value = "";

    updateSupportGuideByState_(
      null,
      selectableShifts.length
    );
  }

  handleTodayShiftChange();
}

function renderFinishedSupportList_(
  finishedShifts
) {
  const list =
    document.getElementById(
      "finishedSupportList"
    );

  const toggle =
    document.getElementById(
      "finishedSupportToggle"
    );

  if (!list || !toggle) {
    return;
  }

  const shifts =
    Array.isArray(
      finishedShifts
    )
      ? finishedShifts
      : [];

  toggle.textContent =
    "終了者一覧" +
    (
      shifts.length
        ? "（" +
          shifts.length +
          "）"
        : ""
    );

  if (!shifts.length) {
    list.innerHTML =
      '<div class="finished-support-empty">本日の終了・キャンセル済み支援はありません。</div>';
    return;
  }

  list.innerHTML =
    shifts.map(
      shift => {
        const state =
          String(
            shift.currentState ||
            "終了"
          ).trim();

        return (
          '<div class="finished-support-item">' +
            '<div class="finished-support-main">' +
              escapePortalText_(
                shift.clientName ||
                ""
              ) +
            '</div>' +
            '<div class="finished-support-sub">' +
              escapePortalText_(
                (shift.service || "") +
                "　" +
                (shift.startTime || "") +
                "～" +
                (shift.endTime || "")
              ) +
              '<span class="finished-support-state ' +
                (
                  state === "キャンセル"
                    ? "cancelled"
                    : ""
                ) +
              '">' +
                escapePortalText_(
                  state
                ) +
              '</span>' +
            '</div>' +
          '</div>'
        );
      }
    ).join("");
}

function openFinishedSupportModal() {
  const modal =
    document.getElementById(
      "finishedSupportModal"
    );

  if (!modal) return;

  modal.classList.remove(
    "hidden"
  );

  document.body.classList.add(
    "modal-open"
  );
}

function closeFinishedSupportModal() {
  const modal =
    document.getElementById(
      "finishedSupportModal"
    );

  if (!modal) return;

  modal.classList.add(
    "hidden"
  );

  document.body.classList.remove(
    "modal-open"
  );
}

function handleTodayShiftChange() {
  const shift =
    getSelectedTodayShift();

  const statusArea =
    document.getElementById(
      "selectedShiftStatus"
    );

  const instructionButton =
    document.getElementById(
      "instructionButton"
    );

  /*
   * 支援が選択されていない場合
   */
  if (!shift) {
    if (statusArea) {
      statusArea.textContent = "";
    }

    /*
     * 指示を見るボタンを無効にします。
     */
    if (instructionButton) {
      instructionButton.disabled = true;
    }

    setStaffActionButtonsByState(
      ""
    );

    return;
  }

  /*
   * 実際に支援を選択したため、
   * 追加通知を消します。
   */
  hideAddedShiftNotice();

  let currentState =
    (
      pendingStaffActionState &&
      pendingStaffActionState.shiftId ===
        shift.shiftId
    )
      ? pendingStaffActionState.expectedState
      : (
          shift.currentState ||
          "未開始"
        );

  const localActiveOuting =
    getActiveOutingForShift_(
      shift
    );

  const localActionCompleted =
    isActionRecordCompletedForShift_(
      shift
    );

  /*
   * 外出支援では、GAS側の「入りました」の反映より
   * スマホ内の行動記録状態を優先します。
   *
   * これにより
   * 向かいます → 入りました → 自宅出発 → かえで到着
   * のあとメインへ戻っても、再び「入りました」は出ません。
   */
  if (
    isOutingService_(shift) &&
    (
      localActiveOuting ||
      localActionCompleted
    )
  ) {
    currentState =
      "支援中";

    /*
     * ガイドや状態表示も同じ判定に揃えるため、
     * この端末上の表示用状態を更新します。
     */
    shift.currentState =
      "支援中";
  }

  /*
   * 本当に「向かいます」段階で、まだ行動記録が存在しない時だけ
   * 旧版残骸の掃除を行います。
   */
  if (
    String(currentState).trim() ===
      "移動中" &&
    !localActiveOuting &&
    !localActionCompleted
  ) {
    clearStalePreEntryOutingState_(
      shift
    );
  }

  updateSupportGuideByState_(
    shift,
    todayStaffShifts.filter(
      s =>
        !["終了","キャンセル"].includes(
          String(
            s.currentState ||
            "未開始"
          ).trim()
        )
    ).length
  );

  updateSupportMainDisplay_(shift);

  if (statusArea) {
    statusArea.textContent =
      shift.clientName +
      "／" +
      shift.startTime +
      "～" +
      shift.endTime +
      "／現在：" +
      currentState;
  }

  /*
   * 支援が選択されたため、
   * 指示を見るボタンを有効にします。
   */
  if (instructionButton) {
    instructionButton.disabled = false;
  }

  setStaffActionButtonsByState(
    currentState
  );

  /*
   * リロード直後など、通常ボタン領域の表示順に左右されないよう
   * 移動中専用ボタンを最後にもう一度確定します。
   */
}

/**
 * 選択中の支援について、
 * 支援指示ポップアップを表示します。
 */
function openInstructionModal() {
  const shift =
    getSelectedTodayShift();

  if (!shift) {
    alert(
      "先に支援を選択してください。"
    );

    return;
  }

  const modal =
    document.getElementById(
      "instructionModal"
    );

  const summary =
    document.getElementById(
      "instructionShiftSummary"
    );

  const normalText =
    document.getElementById(
      "normalInstructionText"
    );

  const todayText =
    document.getElementById(
      "todayInstructionText"
    );

  if (!modal) {
    console.error(
      "instructionModalが見つかりません。"
    );

    return;
  }

  /*
   * 選択した支援の概要を表示します。
   */
  if (summary) {
    summary.textContent =
      shift.clientName +
      "　" +
      shift.service +
      "\n" +
      shift.startTime +
      "～" +
      shift.endTime;
  }

  /*
   * 今回は画面確認用の仮文章です。
   * 後でスプレッドシートの情報に置き換えます。
   */
  if (normalText) {
    normalText.textContent =
      "定期的に休憩を取り、" +
      "無理のないペースで歩いてください。" +
      "歩行時はヘルパーの右肘を持ちます。";
  }

  if (todayText) {
    todayText.textContent =
      "現在、特別な指示はありません。";
  }

  modal.classList.remove(
    "hidden"
  );

  /*
   * ポップアップ表示中に、
   * 背景画面が動かないようにします。
   */
  document.body.classList.add(
    "modal-open"
  );
}


/**
 * 支援指示ポップアップを閉じます。
 */
function closeInstructionModal() {
  const modal =
    document.getElementById(
      "instructionModal"
    );

  if (modal) {
    modal.classList.add(
      "hidden"
    );
  }

  document.body.classList.remove(
    "modal-open"
  );
}


const PORTAL_HISTORY_KEY = "staffPortalLocalActionHistoryV1";
let portalHistoryMode = "all";
let portalServerHistory = null;


let todayShiftRefreshTimer = null;
let todayShiftRefreshRunning = false;
let portalActionProcessing = false;
let supportSelectInteracting = false;
let supportSelectInteractionTimer = null;

function beginSupportSelectInteraction_() {
  supportSelectInteracting = true;

  if (supportSelectInteractionTimer) {
    clearTimeout(
      supportSelectInteractionTimer
    );
  }
}

function endSupportSelectInteraction_(
  delay = 350
) {
  if (supportSelectInteractionTimer) {
    clearTimeout(
      supportSelectInteractionTimer
    );
  }

  supportSelectInteractionTimer =
    setTimeout(
      () => {
        supportSelectInteracting = false;
      },
      delay
    );
}


function startTodayShiftAutoRefresh_() {
  if (todayShiftRefreshTimer) {
    return;
  }

  /*
   * 支援が0件でも1件以上でも、30秒ごとに再取得します。
   * 登録処理中は更新を止め、操作中の表示を崩さないようにします。
   */
  todayShiftRefreshTimer =
    setInterval(
      async () => {
        if (
          document.hidden ||
          todayShiftRefreshRunning ||
          portalActionProcessing ||
          supportSelectInteracting
        ) {
          return;
        }

        todayShiftRefreshRunning = true;

        try {
          await loadTodayStaffShifts(true);
        } catch (error) {
          console.warn(
            "支援一覧の自動更新に失敗しました",
            error
          );
        } finally {
          todayShiftRefreshRunning = false;
        }
      },
      30000
    );
}

function refreshTodayShiftsOnReturn_() {
  if (
    document.visibilityState === "visible" &&
    !portalActionProcessing &&
    !supportSelectInteracting
  ) {
    loadTodayStaffShifts(true)
      .catch(
        error =>
          console.warn(
            "画面復帰時の支援一覧更新に失敗しました",
            error
          )
      );
  }
}

document.addEventListener(
  "visibilitychange",
  refreshTodayShiftsOnReturn_
);

window.addEventListener(
  "focus",
  () => {
    if (
      portalActionProcessing ||
      supportSelectInteracting
    ) {
      return;
    }

    loadTodayStaffShifts(true)
      .catch(
        error =>
          console.warn(
            "画面復帰時の支援一覧更新に失敗しました",
            error
          )
      );
  }
);

function isOutingService_(
  shiftOrService
) {
  if (!shiftOrService) return false;

  const shift =
    typeof shiftOrService ===
      "string"
      ? {
          service:
            shiftOrService
        }
      : shiftOrService;

  const service =
    String(
      shift.service || ""
    ).trim();

  const destination =
    String(
      shift.destination || ""
    ).trim();

  const alwaysOuting = [
    "同行援護",
    "移動支援",
    "通院介助",
    "有償運送",
    "その他外出",
    "外出"
  ];

  return (
    alwaysOuting.some(
      name =>
        service.includes(name)
    ) ||
    (
      service.includes(
        "身体介護"
      ) &&
      !!destination
    )
  );
}function setButtonVisible_(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("hidden", !visible);
}

function updateSupportMainDisplay_(shift) {
  const title = document.getElementById("supportMainTitle");
  const meta = document.getElementById("supportMainMeta");
  const statePill = document.getElementById("supportHeaderState");
  if (!shift) {
    if (title) {
      title.textContent =
        "支援を選択してください";
    }

    if (meta) {
      meta.textContent =
        "";
    }

    if (statePill) {
      statePill.textContent =
        "待機中";
    }

    return;
  }
  if (title) title.textContent = shift.service + "｜" + shift.clientName;
  if (meta) meta.textContent = shift.startTime + "〜" + shift.endTime;
  if (statePill) {
    const st = shift.currentState || "未開始";
    statePill.textContent = st === "未開始" ? "待機中" : (st === "移動中" ? "移動中" : (st === "支援中" ? "支援中" : "終了"));
  }
}

function savePortalLocalHistory_(eventType, shift, extra = {}) {
  if (!shift || !currentUser) return null;

  const deferServerSync =
    extra &&
    extra.deferServerSync === true;

  const cleanExtra = {
    ...(extra || {})
  };

  delete cleanExtra.deferServerSync;

  let list = [];

  try {
    list =
      JSON.parse(
        localStorage.getItem(
          PORTAL_HISTORY_KEY
        ) || "[]"
      );
  } catch(e) {}

  const event = {
    id:
      "PH-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2,7),

    employeeId:
      currentUser.employeeId ||
      "",

    employeeName:
      currentUser.employeeName ||
      "",

    supportDate:
      shift.supportDate ||
      getTodayLocalDateText(),

    shiftId:
      shift.shiftId || "",

    clientName:
      shift.clientName || "",

    service:
      shift.service || "",

    scheduledStart:
      shift.startTime || "",

    scheduledEnd:
      shift.endTime || "",

    eventType:
      eventType,

    actualAt:
      new Date()
        .toISOString(),

    syncPending:
      deferServerSync === true,

    ...cleanExtra
  };

  list.push(
    event
  );

  localStorage.setItem(
    PORTAL_HISTORY_KEY,
    JSON.stringify(
      list.slice(-300)
    )
  );

  /*
   * 外出の「入りました」や外出への引き続き支援は、
   * 1件目の出発時までGAS通信を保留します。
   */
  if (!deferServerSync) {
    postGas({
      action:
        "recordPortalHistoryEvent",
      event:
        event
    }).then(
      result => {
        if (
          result &&
          result.success === true
        ) {
          event.syncPending = false;
        }
      }
    ).catch(
      error => {
        console.warn(
          "履歴のサーバー同期に失敗しました",
          error
        );
      }
    );
  }

  return event;
}

function removePortalLocalHistoryBySendId_(
  sendId
) {
  if (!sendId) return;

  let list = [];

  try {
    list =
      JSON.parse(
        localStorage.getItem(
          PORTAL_HISTORY_KEY
        ) || "[]"
      );
  } catch (error) {}

  list =
    list.filter(
      event =>
        event.sendId !==
        sendId
    );

  localStorage.setItem(
    PORTAL_HISTORY_KEY,
    JSON.stringify(
      list.slice(-300)
    )
  );
}

function getPortalLocalHistory_() {
  try {
    const list =
      JSON.parse(
        localStorage.getItem(
          PORTAL_HISTORY_KEY
        ) || "[]"
      );

    const today =
      getTodayLocalDateText();

    return Array.isArray(list)
      ? list.filter(
          x =>
            x.supportDate === today &&
            (
              !currentUser ||
              x.employeeId ===
                currentUser.employeeId
            )
        )
      : [];

  } catch(e) {
    return [];
  }
}


async function syncLocalPortalHistoryToServer_() {
  const local =
    getPortalLocalHistory_();

  if (!local.length) {
    return;
  }

  /*
   * 以前スマホのlocalStorageだけに残っていた
   * 出発・到着・帰宅・活動もサーバーへ救済します。
   * 履歴IDでGAS側が重複排除します。
   */
  const jobs =
    local.map(
      event =>
        postGas({
          action:
            "recordPortalHistoryEvent",
          event:
            event
        })
    );

  await Promise.allSettled(
    jobs
  );
}

function getPortalHistoryForDisplay_() {
  const server =
    Array.isArray(
      portalServerHistory
    )
      ? portalServerHistory
      : [];

  const local =
    getPortalLocalHistory_();

  /*
   * PCではserverが主、
   * スマホではserver + 未同期localを統合。
   */
  const map =
    new Map();

  [...server, ...local]
    .forEach(e => {
      const key =
        e.id ||
        [
          e.shiftId || "",
          e.eventType || "",
          e.actualAt || "",
          e.clientName || "",
          e.service || ""
        ].join("|");

      if (!map.has(key)) {
        map.set(
          key,
          e
        );
      }
    });

  return Array.from(
    map.values()
  ).sort(
    (a, b) =>
      new Date(
        a.actualAt || 0
      ) -
      new Date(
        b.actualAt || 0
      )
  );
}


function normalizePortalPlannedTime_(
  value
) {
  if (!value) return "";

  if (
    /^\d{1,2}:\d{2}$/.test(
      String(value).trim()
    )
  ) {
    return String(value).trim();
  }

  const d =
    new Date(value);

  if (!Number.isNaN(d.getTime())) {
    return new Intl.DateTimeFormat(
      "ja-JP",
      {
        hour:
          "2-digit",
        minute:
          "2-digit",
        hour12:
          false,
        timeZone:
          "Asia/Tokyo"
      }
    ).format(d);
  }

  return String(value);
}

function formatActualTime_(iso) {
  try {
    return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(iso));
  } catch(e) { return ""; }
}

function sendPortalCancel(isPre) {
  const shift = getSelectedTodayShift();
  if (!shift) { alert("操作する支援を選択してください。"); return; }
  const label = isPre ? "事前キャンセル" : "キャンセル";
  const ok = confirm(shift.clientName + "\n" + shift.startTime + "～" + shift.endTime + "\n\n" + label + "しますか？");
  if (!ok) return;
  // 現行GASにキャンセル処理があるかは環境依存。recordStaffActionへ同じ形式で送る。
  sendStaffAction("キャンセル", { skipConfirm:true, localLabel:label });
}

function showPortalCancelFlash_(service) {
  const el = document.getElementById("cancelFlash");
  if (!el) return;
  el.textContent = String(service || "支援") + "がキャンセルされました";
  el.classList.remove("hidden");
  setTimeout(() => { el.classList.add("hidden"); el.textContent = ""; }, 2000);
}


function clearStalePreEntryOutingState_(shift) {
  if (!shift) return;

  const state =
    String(
      shift.currentState || ""
    ).trim();

  if (state !== "移動中") {
    return;
  }

  /*
   * 以前は「移動中」なら行動記録のlocalStorageを削除していましたが、
   * 1件目出発直後にGAS側の状態反映が少し遅れると、
   * 正常な行動記録まで消してしまうことがありました。
   *
   * 行動記録セッションに出発等のeventが1件でもある場合は
   * 絶対に削除しません。
   */
  let session = null;

  try {
    session =
      JSON.parse(
        localStorage.getItem(
          "staffPortalActionRecordSessionV1"
        ) || "null"
      );
  } catch (error) {}

  if (
    session &&
    (
      !session.shiftId ||
      session.shiftId === shift.shiftId
    ) &&
    Array.isArray(
      session.events
    ) &&
    session.events.length > 0
  ) {
    return;
  }

  /*
   * activeだけが残り、行動記録eventが1件もない場合だけ
   * 旧版の開始前残骸として削除します。
   */
  try {
    const active =
      JSON.parse(
        localStorage.getItem(
          "staffPortalActiveOuting"
        ) || "null"
      );

    if (
      active &&
      (
        !active.shiftId ||
        active.shiftId === shift.shiftId
      ) &&
      !active.localOnly
    ) {
      localStorage.removeItem(
        "staffPortalActiveOuting"
      );
    }
  } catch (error) {}
}

function getActiveOutingForShift_(shift) {
  if (!shift) return null;

  try {
    const saved =
      JSON.parse(
        localStorage.getItem(
          "staffPortalActiveOuting"
        ) || "null"
      );

    if (
      saved &&
      (
        !saved.shiftId ||
        saved.shiftId === shift.shiftId
      )
    ) {
      return saved;
    }

  } catch (error) {
    console.warn(
      "進行中の行動記録を読み取れません",
      error
    );
  }

  return null;
}

function buildActionRecordUrl_(shift, options = {}) {
  const params =
    new URLSearchParams();

  params.set(
    "shiftId",
    shift.shiftId || ""
  );

  params.set(
    "clientName",
    shift.clientName || ""
  );

  params.set(
    "service",
    shift.service || ""
  );

  params.set(
    "supportDate",
    shift.supportDate || ""
  );

  params.set(
    "scheduledStart",
    shift.startTime || ""
  );

  params.set(
    "scheduledEnd",
    shift.endTime || ""
  );

  params.set(
    "fromPortal",
    "1"
  );

  if (options.continuation) {
    params.set(
      "continuation",
      "1"
    );
  }

  if (options.mode) {
    params.set(
      "mode",
      options.mode
    );
  }

  return (
    "./action_record.html?" +
    params.toString()
  );
}

function openSelectedOutingActionRecord(
  options = {}
) {
  const shift =
    getSelectedTodayShift();

  if (!shift) {
    alert(
      "支援を選択してください。"
    );
    return;
  }

  location.href =
    buildActionRecordUrl_(
      shift,
      options
    );
}

function openSelectedOutingHome() {
  const shift =
    getSelectedTodayShift();

  if (!shift) {
    return;
  }

  location.href =
    buildActionRecordUrl_(
      shift,
      {
        mode:
          "home"
      }
    );
}

function openTemporaryChangeNotice() {
  alert("今回だけ一時変更は、GAS側の保存先を追加した後に有効化します。\n画面仕様はデモ版の内容で実装予定です。");
}

function undoLastPortalAction() {
  alert("元に戻すにはGAS側で取消対象IDを保持する処理が必要です。\nGAS実装後に有効化します。");
}

async function openPortalHistory() {
  const modal =
    document.getElementById(
      "portalHistoryModal"
    );

  const helper =
    document.getElementById(
      "historyHelperName"
    );

  if (helper && currentUser) {
    helper.textContent =
      currentUser.employeeName;
  }

  modal?.classList.remove(
    "hidden"
  );

  document.body.classList.add(
    "modal-open"
  );

  const view =
    document.getElementById(
      "portalHistoryView"
    );

  if (view) {
    view.innerHTML =
      '<div class="portal-history-empty">' +
      '履歴を読み込んでいます…' +
      '</div>';
  }

  try {
    await syncLocalPortalHistoryToServer_();

    const result =
      await postGas({
        action:
          "getPortalHistory",

        employeeId:
          currentUser
            ? currentUser.employeeId
            : "",

        supportDate:
          getTodayLocalDateText()
      });

    if (
      result &&
      result.success === true &&
      Array.isArray(
        result.events
      )
    ) {
      portalServerHistory =
        result.events;
    } else {
      portalServerHistory =
        null;
    }

  } catch (error) {
    console.warn(
      "サーバー履歴の取得に失敗しました",
      error
    );

    portalServerHistory =
      null;
  }

  renderPortalHistory_();
}

function closePortalHistory() {
  document.getElementById("portalHistoryModal")?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function setPortalHistoryMode(mode) {
  portalHistoryMode = mode;
  document.querySelectorAll("[data-history-mode]").forEach(btn => btn.classList.toggle("active", btn.dataset.historyMode === mode));
  renderPortalHistory_();
}

function renderPortalHistory_() {
  const view = document.getElementById("portalHistoryView");
  if (!view) return;

  const all = getPortalHistoryForDisplay_();

  if (!all.length) {
    view.innerHTML =
      '<div class="portal-history-empty">' +
      '本日の記録履歴はまだありません。' +
      '</div>';
    return;
  }

  /*
   * 従業員履歴
   */
  if (portalHistoryMode === "staff") {
    const blocks = [];
    const blockByShiftId = new Map();
    const cancels = [];

    all.forEach(e => {
      if (e.eventType === "キャンセル") {
        cancels.push(e);
        return;
      }

      if (
        ["入りました","支援開始","終わりました","支援終了"].includes(e.eventType)
      ) {
        const key =
          e.shiftId ||
          [
            e.clientName || "",
            e.service || "",
            e.scheduledStart || "",
            e.scheduledEnd || ""
          ].join("|");

        let block = blockByShiftId.get(key);

        if (!block) {
          block = {
            clientName: e.clientName || "",
            startActual: "",
            endActual: "",
            services: [{
              shiftId: e.shiftId || "",
              clientName: e.clientName || "",
              service: e.service || "",
              scheduledStart: e.scheduledStart || "",
              scheduledEnd: e.scheduledEnd || ""
            }]
          };

          blocks.push(block);
          blockByShiftId.set(key, block);

          if (e.shiftId) {
            blockByShiftId.set(e.shiftId, block);
          }
        }

        const actual = formatActualTime_(e.actualAt);

        if (e.eventType === "入りました" || e.eventType === "支援開始") {
          if (!block.startActual) block.startActual = actual;
        }

        if (e.eventType === "終わりました" || e.eventType === "支援終了") {
          block.endActual = actual;
        }

        return;
      }

      if (e.eventType === "引き続き支援") {
        let block = null;

        if (e.fromShiftId) {
          block = blockByShiftId.get(e.fromShiftId) || null;
        }

        if (!block) {
          for (let i = blocks.length - 1; i >= 0; i--) {
            if (blocks[i].clientName === e.clientName) {
              block = blocks[i];
              break;
            }
          }
        }

        if (!block) {
          block = {
            clientName: e.clientName || "",
            startActual: formatActualTime_(e.actualAt),
            endActual: "",
            services: []
          };
          blocks.push(block);
        }

        const nextService = {
          shiftId: e.shiftId || "",
          clientName: e.clientName || "",
          service: e.service || "",
          scheduledStart: e.scheduledStart || "",
          scheduledEnd: e.scheduledEnd || ""
        };

        const exists = block.services.some(s =>
          (
            s.shiftId &&
            nextService.shiftId &&
            s.shiftId === nextService.shiftId
          ) ||
          (
            s.service === nextService.service &&
            s.scheduledStart === nextService.scheduledStart &&
            s.scheduledEnd === nextService.scheduledEnd
          )
        );

        if (!exists) block.services.push(nextService);

        if (e.shiftId) {
          blockByShiftId.set(e.shiftId, block);
        }
      }
    });

    let html = "";

    cancels.forEach(e => {
      const scheduledRange =
        [e.scheduledStart, e.scheduledEnd]
          .filter(Boolean)
          .map(normalizePortalPlannedTime_)
          .join("～");

      html +=
        '<div class="portal-history-cancel">' +
        'キャンセル　' +
        escapePortalText_(e.clientName) +
        '｜' +
        escapePortalText_(e.service) +
        (scheduledRange ? '　' + escapePortalText_(scheduledRange) : '') +
        '</div>';
    });

    blocks.forEach(block => {
      if (!block.startActual && !block.endActual) return;

      let title = "";

      if (block.startActual) {
        title += "支援開始（" + escapePortalText_(block.startActual) + "）";
      }

      if (block.endActual) {
        title +=
          (title ? "　" : "") +
          "支援終了（" +
          escapePortalText_(block.endActual) +
          "）";
      }

      html +=
        '<div class="portal-history-group">' +
        '<div class="portal-history-item">' +
        '<strong>' + title + '</strong>';

      block.services.forEach(serviceRow => {
        const scheduledRange =
          [serviceRow.scheduledStart, serviceRow.scheduledEnd]
            .filter(Boolean)
            .map(normalizePortalPlannedTime_)
            .join("～");

        html +=
          '<small>' +
          escapePortalText_(
            (serviceRow.clientName || block.clientName) +
            "｜" +
            (serviceRow.service || "") +
            (scheduledRange ? "　予定 " + scheduledRange : "")
          ) +
          '</small>';
      });

      html += '</div></div>';
    });

    view.innerHTML =
      html ||
      '<div class="portal-history-empty">従業員履歴はまだありません。</div>';
    return;
  }

  /*
   * 利用者履歴
   * 利用者ごとに枠を分けます。
   */
  if (portalHistoryMode === "client") {
    const groups = new Map();

    all.forEach(e => {
      if (e.eventType === "向かいます") {
        return;
      }

      const clientName =
        String(
          e.clientName || "利用者未設定"
        ).trim();

      if (!groups.has(clientName)) {
        groups.set(
          clientName,
          []
        );
      }

      groups.get(
        clientName
      ).push(e);
    });

    let html = "";

    groups.forEach(
      (events, clientName) => {
        html +=
          '<div class="portal-client-history-group">' +
            '<div class="portal-client-history-head">' +
              '<strong>' +
                escapePortalText_(clientName) +
              '</strong>' +
            '</div>' +
            '<div class="portal-client-history-body">';

        events.forEach(e => {
          if (e.eventType === "キャンセル") {
            const scheduledRange =
              [e.scheduledStart, e.scheduledEnd]
                .filter(Boolean)
                .map(normalizePortalPlannedTime_)
                .join("～");

            html +=
              '<div class="portal-history-cancel">' +
              'キャンセル　' +
              escapePortalText_(e.service) +
              (scheduledRange
                ? '　' + escapePortalText_(scheduledRange)
                : '') +
              '</div>';
            return;
          }

          const time =
            formatActualTime_(e.actualAt);

          const routeClass =
            ["出発","到着","帰宅","移動手段変更","活動"]
              .includes(e.eventType)
                ? " route"
                : "";

          let detailText = "";

          if (e.eventType === "入りました" || e.eventType === "支援開始") {
            detailText =
              (e.service || "") +
              (e.scheduledStart
                ? "　" + e.scheduledStart
                : "");

          } else if (e.eventType === "活動") {
            detailText =
              e.activity || "";

          } else if (e.eventType === "引き続き支援") {
            detailText =
              (e.fromService || "") +
              " → " +
              (e.service || "");

          } else if (e.eventType === "終わりました" || e.eventType === "支援終了") {
            detailText =
              (e.service || "") +
              (e.scheduledEnd
                ? "　" + e.scheduledEnd
                : "");

          } else {
            detailText =
              [
                e.service || "",
                e.place || "",
                e.transport || ""
              ]
                .filter(Boolean)
                .join("｜");
          }

          html +=
            '<div class="portal-history-item' +
            routeClass +
            '">' +
            '<strong>' +
              escapePortalText_(
                time +
                "　" +
                e.eventType
              ) +
            '</strong>' +
            '<small>' +
              escapePortalText_(
                detailText
              ) +
            '</small>' +
            '</div>';
        });

        html +=
            '</div>' +
          '</div>';
      }
    );

    view.innerHTML =
      html ||
      '<div class="portal-history-empty">利用者履歴はまだありません。</div>';

    return;
  }

  /*
   * 全行程
   */
  const events = all.slice();

  const routeTypes = ["出発","到着","帰宅","移動手段変更","活動"];
  let html = '<div class="portal-history-group">';

  events.forEach(e => {
    if (e.eventType === "キャンセル") {
      const scheduledRange =
        [e.scheduledStart, e.scheduledEnd]
          .filter(Boolean)
          .map(normalizePortalPlannedTime_)
          .join("～");

      html +=
        '<div class="portal-history-cancel">' +
        'キャンセル　' +
        escapePortalText_(e.clientName) +
        '｜' +
        escapePortalText_(e.service) +
        (scheduledRange ? '　' + escapePortalText_(scheduledRange) : '') +
        '</div>';
      return;
    }

    const time = formatActualTime_(e.actualAt);
    const routeClass = routeTypes.includes(e.eventType) ? " route" : "";

    let detailText = "";

    if (e.eventType === "向かいます") {
      detailText =
        (e.clientName || "") +
        "｜" +
        (e.service || "") +
        (e.scheduledStart ? "　" + normalizePortalPlannedTime_(e.scheduledStart) + " 開始予定" : "");

    } else if (e.eventType === "活動") {
      detailText =
        (e.clientName || "") +
        "｜" +
        (e.activity || "");

    } else if (e.eventType === "入りました" || e.eventType === "支援開始") {
      detailText =
        (e.clientName || "") +
        "｜" +
        (e.service || "") +
        (e.scheduledStart ? "　" + normalizePortalPlannedTime_(e.scheduledStart) : "");

    } else if (e.eventType === "引き続き支援") {
      detailText =
        (e.clientName || "") +
        "｜" +
        (e.fromService || "") +
        " → " +
        (e.service || "");

    } else if (e.eventType === "終わりました" || e.eventType === "支援終了") {
      detailText =
        (e.clientName || "") +
        "｜" +
        (e.service || "") +
        (e.scheduledEnd ? "　" + normalizePortalPlannedTime_(e.scheduledEnd) : "");

    } else {
      detailText =
        [
          e.clientName || "",
          e.service || "",
          e.place || "",
          e.transport || ""
        ]
          .filter(Boolean)
          .join("｜");
    }

    html +=
      '<div class="portal-history-item' +
      routeClass +
      '">' +
      '<strong>' +
      escapePortalText_(time + "　" + e.eventType) +
      '</strong>' +
      '<small>' +
      escapePortalText_(detailText) +
      '</small>' +
      '</div>';
  });

  html += '</div>';
  view.innerHTML = html;
}

function escapePortalText_(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}


function getNextTodayShift_(shift) {
  if (!shift || !Array.isArray(todayStaffShifts)) return null;

  const currentIndex =
    todayStaffShifts.findIndex(
      s => s.shiftId === shift.shiftId
    );

  if (currentIndex < 0) return null;

  const next =
    todayStaffShifts[currentIndex + 1] || null;

  if (!next) return null;

  const sameClient =
    String(next.clientName || "").trim() ===
    String(shift.clientName || "").trim();

  const touchingTime =
    String(next.startTime || "").trim() ===
    String(shift.endTime || "").trim();

  if (!sameClient || !touchingTime) {
    return null;
  }

  return next;
}

function canContinueSupport_(shift) {
  return !!getNextTodayShift_(shift);
}

async function continueToNextSupport() {
  const currentShift =
    getSelectedTodayShift();

  if (!currentShift) {
    alert(
      "現在の支援を確認できません。"
    );
    return;
  }

  const nextShift =
    getNextTodayShift_(
      currentShift
    );

  if (!nextShift) {
    alert(
      "同じ利用者で、終了予定時刻と次の開始予定時刻が一致する支援がありません。"
    );
    return;
  }

  const confirmed =
    confirm(
      currentShift.clientName +
      "\n\n" +
      currentShift.service +
      " " +
      currentShift.startTime +
      "～" +
      currentShift.endTime +
      "\n↓\n" +
      nextShift.service +
      " " +
      nextShift.startTime +
      "～" +
      nextShift.endTime +
      "\n\n引き続き支援へ切り替えますか？"
    );

  if (!confirmed) return;

  clearCompletedActionRecord_();

  const nextIsOuting =
    isOutingService_(
      nextShift
    );

  const sendId =
    createStaffActionSendId(
      currentUser.employeeId,
      currentShift.shiftId,
      "引き続き支援"
    );

  const payload = {
    action:
      "recordStaffContinuation",

    employeeId:
      currentUser.employeeId,

    employeeName:
      currentUser.employeeName,

    fromShiftId:
      currentShift.shiftId,

    fromClientName:
      currentShift.clientName,

    fromService:
      currentShift.service,

    fromSupportDate:
      currentShift.supportDate,

    fromScheduledStart:
      currentShift.startTime,

    fromScheduledEnd:
      currentShift.endTime,

    toShiftId:
      nextShift.shiftId,

    toClientName:
      nextShift.clientName,

    toService:
      nextShift.service,

    toSupportDate:
      nextShift.supportDate,

    toScheduledStart:
      nextShift.startTime,

    toScheduledEnd:
      nextShift.endTime,

    deviceTime:
      actionDeviceTime,

    sendId:
      sendId,

    registrationMethod:
      "職員ポータル"
  };

  /*
   * 引き続きもまず端末保存。
   */
  enqueueStaffAction_(
    payload
  );

  savePortalLocalHistory_(
    "引き続き支援",
    nextShift,
    {
      fromShiftId:
        currentShift.shiftId,
      fromService:
        currentShift.service,
      fromScheduledStart:
        currentShift.startTime,
      fromScheduledEnd:
        currentShift.endTime,
      sendId:
        sendId,
      deferServerSync:
        nextIsOuting
    }
  );

  saveSupportChain_(
    nextShift
  );

  setGuideImmediatelyForAction_(
    "引き続き支援",
    currentShift,
    nextShift
  );

  const select =
    document.getElementById(
      "todayShiftSelect"
    );

  if (select) {
    select.value =
      nextShift.shiftId;
  }

  if (nextIsOuting) {
    /*
     * 次が外出なら、引き続きボタン直後にはGASへ送らない。
     * 行動記録へ移り、最初の出発直後にまとめて同期する。
     */
    setTimeout(
      () => {
        openSelectedOutingActionRecord({
          continuation: true
        });
      },
      50
    );

    return;
  }

  /*
   * 次が居宅なら、引き続きボタン直後が通信ポイント。
   */
  flushStaffActionQueue_()
    .then(
      async () => {
        try {
          await loadTodayStaffShifts(
            true
          );
        } catch (error) {
          console.warn(
            "引き続き支援後の再取得に失敗",
            error
          );
        }
      }
    )
    .catch(
      error => {
        console.warn(
          "引き続き支援の送信に失敗",
          error
        );
      }
    );

  handleTodayShiftChange();
}



function isPortalPc_() {
  const ua =
    String(
      navigator.userAgent || ""
    );

  const touchDevice =
    navigator.maxTouchPoints > 1;

  const mobileUa =
    /Android|iPhone|iPod|Mobile|Windows Phone/i
      .test(ua);

  const ipadLike =
    /iPad/i.test(ua) ||
    (
      /Macintosh/i.test(ua) &&
      touchDevice
    );

  return !mobileUa &&
    !ipadLike;
}

function applyPcOperationGuard_(shift) {
  const pc =
    isPortalPc_();

  const notice =
    document.getElementById(
      "pcOperationNotice"
    );

  const actionGrid =
    document.getElementById(
      "portalActionButtons"
    );

  const tempButton =
    document.getElementById(
      "temporaryChangeButton"
    );

  if (notice) {
    notice.classList.toggle(
      "hidden",
      !pc
    );
  }

  if (actionGrid) {
    actionGrid.classList.toggle(
      "hidden",
      pc || !shift
    );
  }

  if (tempButton) {
    tempButton.classList.toggle(
      "hidden",
      pc || !shift
    );
  }

  return pc;
}




function setStaffActionButtonsByState(currentState) {
  const instructionButton = document.getElementById("instructionButton");
  const moveButton = document.getElementById("moveButton");
  const enterButton = document.getElementById("enterButton");
  const finishButton = document.getElementById("finishButton");
  const continueButton = document.getElementById("continueButton");
  const preCancelButton = document.getElementById("preCancelButton");
  const cancelButton = document.getElementById("cancelButton");
  const actionRecordButton = document.getElementById("actionRecordButton");
  const homeReturnButton = document.getElementById("homeReturnButton");

  [moveButton,enterButton,finishButton,continueButton,preCancelButton,cancelButton,actionRecordButton,homeReturnButton]
    .forEach(b => { if (b) { b.disabled = true; b.classList.add("hidden"); } });

  const shift = getSelectedTodayShift();
updateSupportMainDisplay_(shift);

  const pc =
    applyPcOperationGuard_(
      shift
    );

  if (!shift) {
    if (instructionButton) {
      instructionButton.disabled = true;
    }
    return;
  }

  if (instructionButton) {
    instructionButton.disabled = false;
  }

  if (pc) {
    return;
  }

  const outing =
    isOutingService_(
      shift
    );

  const activeOuting =
    getActiveOutingForShift_(
      shift
    );

  const completedOuting =
    isActionRecordCompletedForShift_(
      shift
    );

  /*
   * サーバー表示が一時的に「移動中」のままでも、
   * 行動記録が開始済みなら実際の画面状態は「支援中」です。
   */
  if (
    outing &&
    String(
      currentState || ""
    ).trim() === "移動中" &&
    (
      activeOuting ||
      completedOuting
    )
  ) {
    currentState =
      "支援中";
  }

  if (actionRecordButton) {
    const label =
      actionRecordButton
        .querySelector("strong");

    if (label) {
      label.textContent =
        activeOuting
          ? "行動記録に戻る"
          : "行動記録";
    }
  }

  switch (currentState || "未開始") {
    case "未開始":
      if (moveButton) { moveButton.disabled = false; moveButton.classList.remove("hidden"); }
      if (preCancelButton) { preCancelButton.disabled = false; preCancelButton.classList.remove("hidden"); }
      break;

    case "移動中":
      /*
       * 「向かいます」の次は、通常の操作グリッド内に
       * 「入りました」を1つだけ表示します。
       */
      {
        const actionGrid =
          document.getElementById(
            "portalActionButtons"
          );

        if (actionGrid) {
          actionGrid.classList.remove(
            "hidden"
          );
        }
      }

      if (actionRecordButton) {
        actionRecordButton.disabled = true;
        actionRecordButton.classList.add(
          "hidden"
        );
      }

      if (homeReturnButton) {
        homeReturnButton.disabled = true;
        homeReturnButton.classList.add(
          "hidden"
        );
      }

      if (enterButton) {
        enterButton.disabled = false;
        enterButton.classList.remove(
          "hidden"
        );
      }

      if (cancelButton) {
        cancelButton.disabled = false;
        cancelButton.classList.remove(
          "hidden"
        );
      }
      break;

    case "支援中":
      if (outing) {
        const completed =
          isActionRecordCompletedForShift_(
            shift
          );

        if (activeOuting) {
          /*
           * 行動記録中にメインへ一時退避した状態。
           * 「終わりました」は出さず、再開だけ表示。
           */
          if (actionRecordButton) {
            actionRecordButton.disabled = false;
            actionRecordButton.classList.remove(
              "hidden"
            );

            const label =
              actionRecordButton
                .querySelector("strong");

            if (label) {
              label.textContent =
                "行動記録を再開";
            }
          }

          if (homeReturnButton) {
            homeReturnButton.disabled = true;
            homeReturnButton.classList.add(
              "hidden"
            );
          }

          if (finishButton) {
            finishButton.disabled = true;
            finishButton.classList.add(
              "hidden"
            );
          }

          if (continueButton) {
            continueButton.disabled = true;
            continueButton.classList.add(
              "hidden"
            );
          }

        } else if (completed) {
          /*
           * 行動記録完了後だけ終了系を表示。
           */
          if (actionRecordButton) {
            actionRecordButton.disabled = true;
            actionRecordButton.classList.add(
              "hidden"
            );
          }

          if (homeReturnButton) {
            homeReturnButton.disabled = true;
            homeReturnButton.classList.add(
              "hidden"
            );
          }

          if (
            canContinueSupport_(shift)
          ) {
            if (continueButton) {
              continueButton.disabled = false;
              continueButton.classList.remove(
                "hidden"
              );
            }
          } else if (finishButton) {
            finishButton.disabled = false;
            finishButton.classList.remove(
              "hidden"
            );
          }

        } else {
          /*
           * 外出支援で支援中だが、行動記録状態がまだ作られていない場合。
           * 誤って終了させないため再開ボタンを表示。
           */
          if (actionRecordButton) {
            actionRecordButton.disabled = false;
            actionRecordButton.classList.remove(
              "hidden"
            );

            const label =
              actionRecordButton
                .querySelector("strong");

            if (label) {
              label.textContent =
                "行動記録を再開";
            }
          }

          if (homeReturnButton) {
            homeReturnButton.disabled = true;
            homeReturnButton.classList.add(
              "hidden"
            );
          }

          if (finishButton) {
            finishButton.disabled = true;
            finishButton.classList.add(
              "hidden"
            );
          }

          if (continueButton) {
            continueButton.disabled = true;
            continueButton.classList.add(
              "hidden"
            );
          }
        }

      } else if (
        canContinueSupport_(shift)
      ) {
        if (continueButton) {
          continueButton.disabled = false;
          continueButton.classList.remove(
            "hidden"
          );
        }

      } else if (finishButton) {
        finishButton.disabled = false;
        finishButton.classList.remove(
          "hidden"
        );
      }

      break;

    case "終了":
      break;
  }
}

/**
 * 選択中のシフト情報を返します。
 */
function getSelectedTodayShift() {
  const select =
    document.getElementById(
      "todayShiftSelect"
    );

  if (!select || !select.value) {
    return null;
  }

  return (
    todayStaffShifts.find(
      shift =>
        shift.shiftId ===
        select.value
    ) || null
  );
}


async function finalizeUntouchedCoStaffAfterFinish_(
  shift,
  finishTime
) {
  if (!shift || !currentUser) {
    return null;
  }

  try {
    const result =
      await postGas({
        action:
          "finalizeUntouchedCoStaff",

        shiftId:
          shift.shiftId,

        clientName:
          shift.clientName,

        supportDate:
          shift.supportDate,

        service:
          shift.service,

        scheduledStart:
          shift.startTime,

        scheduledEnd:
          shift.endTime,

        finisherEmployeeId:
          currentUser.employeeId,

        finisherEmployeeName:
          currentUser.employeeName,

        finishTime:
          finishTime ||
          new Date().toISOString(),

        registrationMethod:
          "職員ポータル自動補完"
      });

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result?.message ||
        "複数人介助の未入力確認に失敗しました。"
      );
    }

    const forced =
      Array.isArray(
        result.forcedStaff
      )
        ? result.forcedStaff
        : [];

    const partial =
      Array.isArray(
        result.partialStaff
      )
        ? result.partialStaff
        : [];

    if (
      forced.length ||
      partial.length
    ) {
      const lines = [];

      if (forced.length) {
        lines.push(
          "未入力のため強制終了：" +
          forced
            .map(item => item.employeeName)
            .join("、")
        );
      }

      if (partial.length) {
        lines.push(
          "途中入力のため要確認：" +
          partial
            .map(item => item.employeeName)
            .join("、")
        );
      }

      alert(
        "複数人介助の確認\n\n" +
        lines.join("\n")
      );
    }

    return result;

  } catch (error) {
    /*
     * 本人の「終わりました」は既に端末保存/送信済み。
     * 他担当者確認の失敗で本人の終了処理を巻き戻しません。
     */
    console.warn(
      "他担当者の未入力確認に失敗",
      error
    );

    return null;
  }
}


async function sendStaffAction(
  actionType,
  options = {}
) {
  const shift =
    getSelectedTodayShift();

  if (!shift) {
    alert(
      "操作する支援を選択してください。"
    );
    return;
  }

  if (!currentUser) {
    alert(
      "職員情報を確認できません。"
    );
    return;
  }

  if (!options.skipConfirm) {
    const confirmed =
      confirm(
        shift.clientName +
        "\n" +
        shift.startTime +
        "～" +
        shift.endTime +
        "\n\n" +
        "「" +
        actionType +
        "」を記録しますか？"
      );

    if (!confirmed) return;
  }

  const actionDeviceTime =
    new Date().toISOString();

  const sendId =
    createStaffActionSendId(
      currentUser.employeeId,
      shift.shiftId,
      actionType
    );

  const payload = {
    action: "recordStaffAction",
    employeeId:
      currentUser.employeeId,
    employeeName:
      currentUser.employeeName,
    shiftId:
      shift.shiftId,
    clientName:
      shift.clientName,
    supportDate:
      shift.supportDate,
    service:
      shift.service,
    scheduledStart:
      shift.startTime,
    scheduledEnd:
      shift.endTime,
    actionType:
      actionType,
    deviceTime:
      new Date().toISOString(),
    sendId:
      sendId,
    registrationMethod:
      "職員ポータル",
    note: ""
  };

  /*
   * まず端末へ保存。
   * 通信完了を待たず画面を先へ進める。
   */
  enqueueStaffAction_(
    payload
  );

  savePortalLocalHistory_(
    actionType === "キャンセル"
      ? "キャンセル"
      : actionType,
    shift,
    {
      localLabel:
        options.localLabel || "",
      sendId:
        sendId,
      syncPending:
        true,
      deferServerSync:
        (
          actionType ===
            "入りました" &&
          isOutingService_(shift)
        )
    }
  );

  setGuideImmediatelyForAction_(
    actionType,
    shift
  );

  setPendingStaffActionState_(
    shift,
    actionType
  );

  setButtonsImmediatelyForAction_(
    actionType,
    shift
  );

  if (actionType === "向かいます") {
    clearCompletedActionRecord_();
    saveSupportChain_(shift);
  }

  if (
    actionType === "入りました" &&
    isOutingService_(shift)
  ) {
    clearCompletedActionRecord_();
  }

  if (actionType === "キャンセル") {
    showPortalCancelFlash_(
      shift.service
    );
  }

  if (
    actionType === "終わりました" ||
    actionType === "キャンセル"
  ) {
    clearCompletedActionRecord_();
  }

  updateStaffActionSyncStatus_();

  /*
   * 外出支援の「入りました」は
   * 送信を待たず行動記録へ。
   */
  if (
    actionType === "入りました" &&
    isOutingService_(shift)
  ) {
    setSupportGuideText_(
      shift.clientName +
      "さんの行動記録を開始します"
    );

    setTimeout(
      () => {
        openSelectedOutingActionRecord();
      },
      50
    );
  }

  const deferGasUntilFirstDeparture =
    (
      actionType === "入りました" &&
      isOutingService_(shift)
    );

  /*
   * 通信ポイント:
   * 向かいます直後
   * 居宅の入りました直後
   * 終わりました直後
   *
   * 外出の入りましたは通信せず、
   * 1件目の出発直後まで端末に保持します。
   */
  if (!deferGasUntilFirstDeparture) {
    flushStaffActionQueue_()
      .then(
        async () => {
          updateStaffActionSyncStatus_();

          try {
            await loadTodayStaffShifts(
              true
            );
          } catch (error) {
            console.warn(
              "操作後の状態再取得に失敗",
              error
            );
          }
        }
      )
      .catch(
        error => {
          console.warn(
            "バックグラウンド送信に失敗",
            error
          );
          updateStaffActionSyncStatus_();
        }
      );
  }

  setTodayShiftProcessing_(
    false
  );

  if (
    !(
      actionType === "入りました" &&
      isOutingService_(shift)
    )
  ) {
    const expected =
      getExpectedStateForAction_(
        actionType
      );

    if (expected) {
      setStaffActionButtonsByState(
        expected
      );
    }
  }
}


function createStaffActionSendId(
  employeeId,
  shiftId,
  actionType
) {
  return [
    employeeId,
    shiftId,
    actionType,
    Date.now(),
    Math.random()
      .toString(36)
      .substring(2, 10)
  ].join("-");
}





function setButtonsImmediatelyForAction_(
  actionType,
  shift
) {
  if (!shift) return;

  if (
    actionType === "入りました" &&
    isOutingService_(shift)
  ) {
const actionGrid =
      document.getElementById(
        "portalActionButtons"
      );

    if (actionGrid) {
      actionGrid.classList.add(
        "hidden"
      );
    }

    setStaffActionButtonsDisabled(
      true
    );

    return;
  }

  let optimisticState = "";

  if (actionType === "向かいます") {
    optimisticState =
      "移動中";
  } else if (
    actionType === "入りました" ||
    actionType === "支援開始"
  ) {
    optimisticState =
      "支援中";
  } else if (
    actionType === "終わりました" ||
    actionType === "キャンセル"
  ) {
    setStaffActionButtonsDisabled(
      true
    );
    return;
  }

  if (optimisticState) {
    setStaffActionButtonsByState(
      optimisticState
    );
    setStaffActionButtonsDisabled(
      true
    );
  }
}
function setGuideImmediatelyForAction_(
  actionType,
  shift,
  nextShift = null
) {
  if (!shift) return;

  if (actionType === "向かいます") {
    setSupportGuideText_(
      shift.clientName +
      "さんへ向かっています"
    );
    return;
  }

  if (
    actionType === "入りました" ||
    actionType === "支援開始"
  ) {
    setSupportGuideText_(
      shift.clientName +
      "さんを支援中です"
    );
    return;
  }

  if (actionType === "引き続き支援") {
    const target =
      nextShift || shift;

    setSupportGuideText_(
      target.clientName +
      "さんを支援中です"
    );
    return;
  }

  if (actionType === "終わりました") {
    setSupportGuideText_(
      shift.clientName +
      "さんの支援終了を処理しています"
    );
    return;
  }

  if (actionType === "キャンセル") {
    setSupportGuideText_(
      shift.clientName +
      "さんのキャンセルを処理しています"
    );
    return;
  }

  setSupportGuideText_(
    "ただいま処理中です"
  );
}

function setTodayShiftProcessing_(
  processing
) {
  const select =
    document.getElementById(
      "todayShiftSelect"
    );

  portalActionProcessing =
    !!processing;

  if (!select) return;

  if (processing) {
    /*
     * 処理中も現在選択中の支援名はプルダウンに残します。
     */
    select.disabled = true;

  } else {
    const shift =
      getSelectedTodayShift();

    const active =
      shift &&
      ["移動中","支援中"].includes(
        String(
          shift.currentState ||
          ""
        ).trim()
      );

    select.disabled =
      !!active;
  }
}

function setStaffActionButtonsDisabled(
  disabled
) {
  [
    "moveButton",
    "enterButton",
    "finishButton",
    "continueButton",
    "preCancelButton",
    "cancelButton",
    "actionRecordButton",
    "homeReturnButton"
  ].forEach(id => {
    const button =
      document.getElementById(id);

    if (button) {
      button.disabled = disabled;
    }
  });
}

/**
 * 事務所操作を記録します。
 *
 * actionType
 *   シャッターを開けました
 *   事務所に来ました
 *   シャッターを閉めました
 */
async function sendOfficeAction(
  actionType
) {
  if (!currentUser) {
    alert(
      "職員情報を確認できません。"
    );

    return;
  }

  const confirmed =
    confirm(
      "「" +
      actionType +
      "」を記録しますか？"
    );

  if (!confirmed) {
    return;
  }

  setOfficeActionButtonsDisabled(
    true
  );

  try {
    const deviceTime =
      new Date().toISOString();

    const sendId =
      createOfficeActionSendId(
        currentUser.employeeId,
        actionType
      );

    const result =
      await postGas({
        action:
          "recordOfficeAction",

        employeeId:
          currentUser.employeeId,

        employeeName:
          currentUser.employeeName,

        actionType:
          actionType,

        deviceTime:
          deviceTime,

        sendId:
          sendId,

        registrationMethod:
          "職員ポータル",

        note:
          ""
      });

    if (!result.success) {
      throw new Error(
        result.message ||
        "事務所操作を登録できませんでした。"
      );
    }

    if (result.duplicate) {
      alert(
        result.message ||
        "この操作はすでに登録されています。"
      );

      return;
    }

    if (result.warning) {
      alert(
        "操作履歴を要確認として記録しました。\n\n" +
        (
          result.message ||
          "現在の事務所状態を確認してください。"
        )
      );

      return;
    }

    alert(
      result.message ||
      actionType +
      "を記録しました。"
    );

  } catch (error) {
    console.error(
      "事務所操作登録エラー",
      error
    );

    alert(
      "事務所操作の登録に失敗しました。\n" +
      error.message
    );

  } finally {
    setOfficeActionButtonsDisabled(
      false
    );
  }
}


/**
 * 事務所操作の送信IDを作成します。
 *
 * ボタンを押すたびに異なるIDを作ります。
 */
function createOfficeActionSendId(
  employeeId,
  actionType
) {
  return [
    "OFFICE",
    employeeId,
    actionType,
    Date.now(),
    Math.random()
      .toString(36)
      .substring(2, 10)
  ].join("-");
}


/**
 * 事務所操作ボタンを
 * 一括で有効・無効にします。
 */
function setOfficeActionButtonsDisabled(
  disabled
) {
  [
    "officeOpenButton",
    "officeArrivalButton",
    "officeCloseButton"
  ].forEach(id => {
    const button =
      document.getElementById(id);

    if (button) {
      button.disabled = disabled;
    }
  });
}

/*
 * 基本シフト用GASのURLです。
 */
const SHIFT_WEEK_VERSION_API_URL =
  "https://script.google.com/macros/s/AKfycbwBQOZ5MjFRwQyKKYXLVpM5npEl9od34CQjoW9rWimQaphIf_sTK8_uIjxSVrMxvtGX/exec";


/*
 * 本日の担当シフトを保存するキーです。
 */
const TODAY_STAFF_SHIFT_CACHE_KEY =
  "todayStaffShiftCacheV2";


/**
 * 基本シフトの更新番号を取得します。
 */
function getStaffShiftVersion() {
  return new Promise(
    (resolve, reject) => {
      const callbackName =
        "staffShiftVersionCallback_" +
        Date.now() +
        "_" +
        Math.floor(
          Math.random() * 100000
        );

      const script =
        document.createElement(
          "script"
        );

      let finished = false;

      const cleanup = () => {
        delete window[callbackName];

        if (script.parentNode) {
          script.parentNode
            .removeChild(script);
        }
      };

      /*
       * 10秒経過しても応答がない場合
       */
      const timer =
        setTimeout(() => {
          if (finished) {
            return;
          }

          finished = true;
          cleanup();

          reject(
            new Error(
              "更新確認がタイムアウトしました。"
            )
          );
        }, 10000);

      /*
       * GASから呼び出される関数
       */
      window[callbackName] =
        result => {
          if (finished) {
            return;
          }

          finished = true;
          clearTimeout(timer);
          cleanup();

          if (
            !result ||
            result.success !== true
          ) {
            reject(
              new Error(
                result?.message ||
                "更新番号を取得できませんでした。"
              )
            );

            return;
          }

          resolve(
            String(
              result.version || "0"
            )
          );
        };

      const parameters =
        new URLSearchParams();

      parameters.set(
        "action",
        "week-version"
      );

      parameters.set(
        "callback",
        callbackName
      );

      parameters.set(
        "_",
        Date.now()
      );

      script.src =
        SHIFT_WEEK_VERSION_API_URL +
        "?" +
        parameters.toString();

      script.onerror = () => {
        if (finished) {
          return;
        }

        finished = true;
        clearTimeout(timer);
        cleanup();

        reject(
          new Error(
            "基本シフトの更新確認に接続できませんでした。"
          )
        );
      };

      document.body.appendChild(
        script
      );
    }
  );
}


/**
 * 本日のシフトを端末へ保存します。
 */
function saveTodayStaffShiftCache(
  version,
  shifts
) {
  if (!currentUser) {
    return;
  }

  const cache = {
    date:
      getTodayLocalDateText(),

    version:
      String(version || "0"),

    employeeId:
      currentUser.employeeId,

    shifts:
      shifts,

    savedAt:
      new Date().toISOString()
  };

  localStorage.setItem(
    TODAY_STAFF_SHIFT_CACHE_KEY,
    JSON.stringify(cache)
  );
}


/**
 * 保存済みの本日のシフトを取得します。
 */
function getTodayStaffShiftCache() {
  if (!currentUser) {
    return null;
  }

  const text =
    localStorage.getItem(
      TODAY_STAFF_SHIFT_CACHE_KEY
    );

  if (!text) {
    return null;
  }

  try {
    const cache =
      JSON.parse(text);

    if (
      !cache ||
      !Array.isArray(cache.shifts)
    ) {
      return null;
    }

    /*
     * 保存日が今日でなければ使用しません。
     */
    if (
      cache.date !==
      getTodayLocalDateText()
    ) {
      return null;
    }

    /*
     * 別の職員の保存データは
     * 使用しません。
     */
    if (
      cache.employeeId !==
      currentUser.employeeId
    ) {
      return null;
    }

    return cache;

  } catch (error) {
    console.error(
      "本日のシフト保存情報を読めませんでした",
      error
    );

    localStorage.removeItem(
      TODAY_STAFF_SHIFT_CACHE_KEY
    );

    return null;
  }
}


/**
 * 日本時間の今日の日付を
 * yyyy-MM-dd形式で返します。
 */
function getTodayLocalDateText() {
  const now =
    new Date();

  const parts =
    new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone:
          "Asia/Tokyo",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit"
      }
    )
      .formatToParts(now);

  const values = {};

  parts.forEach(part => {
    values[part.type] =
      part.value;
  });

  return (
    values.year +
    "-" +
    values.month +
    "-" +
    values.day
  );
}

async function testStaffShiftVersion() {
  try {
    const version =
      await getStaffShiftVersion();

    alert(
      "基本シフト更新番号：" +
      version
    );

  } catch (error) {
    alert(
      "更新番号の取得に失敗：" +
      error.message
    );
  }
}

/**
 * 前回にはなく、最新一覧に追加された
 * シフトを返します。
 */
function findAddedTodayShifts(
  oldShifts,
  newShifts
) {
  if (
    !Array.isArray(oldShifts) ||
    !Array.isArray(newShifts)
  ) {
    return [];
  }

  const oldShiftIds =
    new Set(
      oldShifts
        .map(shift =>
          String(
            shift.shiftId || ""
          )
        )
        .filter(Boolean)
    );

  return newShifts.filter(
    shift => {
      const shiftId =
        String(
          shift.shiftId || ""
        );

      return (
        shiftId &&
        !oldShiftIds.has(shiftId)
      );
    }
  );
}

/**
 * 追加シフトの通知を表示します。
 */
function showAddedShiftNotice(
  addedShifts
) {
  const notice =
    document.getElementById(
      "addedShiftNotice"
    );

  if (
    !notice ||
    !Array.isArray(addedShifts) ||
    addedShifts.length === 0
  ) {
    return;
  }

  const details =
    addedShifts
      .map(shift => {
        return (
          shift.startTime +
          "～" +
          shift.endTime +
          "　" +
          shift.clientName +
          "　" +
          shift.service
        );
      })
      .join("\n");

  notice.textContent =
    addedShifts.length === 1
      ? (
          "追加のシフトがあります。\n" +
          details
        )
      : (
          "追加のシフトが" +
          addedShifts.length +
          "件あります。\n" +
          details
        );

  notice.classList.remove(
    "hidden"
  );
}


/**
 * 追加シフト通知を消します。
 */
function hideAddedShiftNotice() {
  const notice =
    document.getElementById(
      "addedShiftNotice"
    );

  if (!notice) {
    return;
  }

  notice.textContent = "";

  notice.classList.add(
    "hidden"
  );
}


document.addEventListener(
  "DOMContentLoaded",
  () => {
    startTodayShiftAutoRefresh_();
  }
);


document.addEventListener(
  "DOMContentLoaded",
  () => {
    startStaffActionQueueSync_();

    /*
     * 起動直後にも未送信があれば一度再送します。
     */
    flushStaffActionQueue_()
      .catch(
        error =>
          console.warn(
            "起動時の未送信再送失敗",
            error
          )
      );
  }
);

