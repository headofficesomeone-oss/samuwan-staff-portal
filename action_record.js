
const OUTING_ROUTE_API_URL =
  "https://script.google.com/macros/s/AKfycbw0DoVUbEfvfrmKrgjYig2vmJRkzXmqKAOr9RJheB88xx0WEC-IyXYicYgmhYt_ko7A/exec";

const ACTIVE_OUTING_KEY =
  "staffPortalActiveOuting";

const PORTAL_HISTORY_KEY =
  "staffPortalLocalActionHistoryV1";

const ACTION_RECORD_SESSION_KEY =
  "staffPortalActionRecordSessionV1";

const ACTION_RECORD_PENDING_KEY =
  "staffPortalPendingActionRecordSessionsV1";

const ACTION_RECORD_COMPLETED_KEY =
  "staffPortalCompletedActionRecordV1";


let recordUser = null;
let recordContext = null;
let cameraStream = null;
let capturedImageData = "";
let recordOperationBusy = false;

document.addEventListener(
  "DOMContentLoaded",
  initActionRecord_
);

function getActionRecordSession_() {
  try {
    return JSON.parse(
      localStorage.getItem(
        ACTION_RECORD_SESSION_KEY
      ) || "null"
    );
  } catch (error) {
    return null;
  }
}

function saveActionRecordSession_(session) {
  localStorage.setItem(
    ACTION_RECORD_SESSION_KEY,
    JSON.stringify(session)
  );
}

function ensureActionRecordSession_() {
  let session =
    getActionRecordSession_();

  if (
    session &&
    session.shiftId ===
      recordContext.shiftId
  ) {
    return session;
  }

  session = {
    sessionId:
      "ARS-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2,8),

    shiftId:
      recordContext.shiftId,

    clientName:
      recordContext.clientName,

    service:
      recordContext.service,

    supportDate:
      recordContext.supportDate ||
      localDate_(),

    scheduledStart:
      recordContext.scheduledStart,

    scheduledEnd:
      recordContext.scheduledEnd,

    employeeId:
      recordUser.employeeId,

    employeeName:
      recordUser.employeeName,

    continuation:
      !!recordContext.continuation,

    createdAt:
      new Date().toISOString(),

    events: [],
    historyEventIds: []
  };

  saveActionRecordSession_(session);
  return session;
}

function appendActionRecordSessionEvent_(event) {
  const session =
    ensureActionRecordSession_();

  session.events.push({
    eventId:
      "ARE-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2,8),

    actualAt:
      new Date().toISOString(),

    ...event
  });

  saveActionRecordSession_(session);
  return session;
}

function appendSessionHistoryId_(historyId) {
  if (!historyId) return;

  const session =
    getActionRecordSession_();

  if (
    !session ||
    session.shiftId !==
      recordContext.shiftId
  ) {
    return;
  }

  session.historyEventIds =
    Array.from(
      new Set([
        ...(session.historyEventIds || []),
        historyId
      ])
    );

  saveActionRecordSession_(session);
}

function enqueueCompletedActionRecordSession_(
  completionType,
  finalPlace
) {
  const session =
    ensureActionRecordSession_();

  session.completedAt =
    new Date().toISOString();

  session.completionType =
    completionType || "";

  session.finalPlace =
    finalPlace || "";

  let pending = [];

  try {
    pending =
      JSON.parse(
        localStorage.getItem(
          ACTION_RECORD_PENDING_KEY
        ) || "[]"
      );
  } catch (error) {}

  if (!Array.isArray(pending)) {
    pending = [];
  }

  if (
    !pending.some(
      item =>
        item &&
        item.sessionId ===
          session.sessionId
    )
  ) {
    pending.push(session);
  }

  localStorage.setItem(
    ACTION_RECORD_PENDING_KEY,
    JSON.stringify(pending)
  );

  localStorage.setItem(
    ACTION_RECORD_COMPLETED_KEY,
    JSON.stringify({
      shiftId:
        session.shiftId,
      sessionId:
        session.sessionId,
      completionType:
        completionType || "",
      finalPlace:
        finalPlace || "",
      completedAt:
        session.completedAt
    })
  );

  localStorage.removeItem(
    ACTION_RECORD_SESSION_KEY
  );

  localStorage.removeItem(
    ACTIVE_OUTING_KEY
  );
}

function temporarilyReturnToPortal_() {
  stopCamera_();
  location.href = "./index.html";
}


const STAFF_ACTION_QUEUE_KEY =
  "staffPortalActionQueueV1";

async function flushDeferredStaffActionsFromActionRecord_() {
  let queue = [];

  try {
    queue =
      JSON.parse(
        localStorage.getItem(
          STAFF_ACTION_QUEUE_KEY
        ) || "[]"
      );
  } catch (error) {}

  if (!Array.isArray(queue)) {
    queue = [];
  }

  while (queue.length > 0) {
    const item =
      queue[0];

    if (
      !item ||
      !item.payload
    ) {
      queue.shift();
      continue;
    }

    const result =
      await postGas(
        item.payload
      );

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result?.message ||
        "操作を同期できませんでした"
      );
    }

    queue.shift();

    localStorage.setItem(
      STAFF_ACTION_QUEUE_KEY,
      JSON.stringify(queue)
    );
  }
}

async function flushDeferredPortalHistoryFromActionRecord_() {
  let history = [];

  try {
    history =
      JSON.parse(
        localStorage.getItem(
          PORTAL_HISTORY_KEY
        ) || "[]"
      );
  } catch (error) {}

  if (!Array.isArray(history)) {
    history = [];
  }

  for (const event of history) {
    if (
      event &&
      event.syncPending === true &&
      (
        event.eventType ===
          "入りました" ||
        event.eventType ===
          "引き続き支援"
      )
    ) {
      const result =
        await postGas({
          action:
            "recordPortalHistoryEvent",
          event:
            event
        });

      if (
        !result ||
        result.success !== true
      ) {
        throw new Error(
          result?.message ||
          "履歴を同期できませんでした"
        );
      }

      event.syncPending =
        false;
    }
  }

  localStorage.setItem(
    PORTAL_HISTORY_KEY,
    JSON.stringify(
      history.slice(-400)
    )
  );
}

async function runFirstDepartureGasCheckpoint_() {
  if (
    typeof navigator !==
      "undefined" &&
    navigator.onLine === false
  ) {
    return;
  }

  try {
    /*
     * 外出の「入りました」や外出への引き続き支援を、
     * ここで初めてGASへ送ります。
     */
    await flushDeferredStaffActionsFromActionRecord_();

    await flushDeferredPortalHistoryFromActionRecord_();

    /*
     * 送信後、GAS側の本日の支援状態も確認します。
     */
    await postGas({
      action:
        "getTodayStaffShifts",
      employeeId:
        recordUser.employeeId,
      employeeName:
        recordUser.employeeName
    });

  } catch (error) {
    /*
     * 失敗しても端末保存済みなので行動記録は止めません。
     */
    console.warn(
      "1件目出発時のGAS確認に失敗",
      error
    );
  }
}



function setRecordProcessing_(processing, text = "ただいま登録中です") {
  recordOperationBusy = !!processing;

  const overlay = document.getElementById("recordProcessingOverlay");
  const textEl = document.getElementById("recordProcessingText");

  if (textEl) {
    textEl.textContent = text;
  }

  if (overlay) {
    overlay.classList.toggle("hidden", !processing);
  }
}

function guardRecordBusy_() {
  return recordOperationBusy;
}

async function initActionRecord_() {
  recordUser =
    getSavedPortalUser();

  if (
    !recordUser ||
    !recordUser.employeeId
  ) {
    alert(
      "職員情報を確認できません。"
    );
    location.href =
      "./index.html";
    return;
  }

  recordContext =
    getRecordContext_();

  if (
    !recordContext.shiftId ||
    !recordContext.clientName
  ) {
    alert(
      "支援情報を確認できません。"
    );
    location.href =
      "./index.html";
    return;
  }

  setText_(
    "recordHelperName",
    recordUser.employeeName
  );

  setText_(
    "recordService",
    recordContext.service
  );

  setText_(
    "recordClient",
    recordContext.clientName
  );

  setText_(
    "recordSchedule",
    recordContext.scheduledStart +
    "～" +
    recordContext.scheduledEnd
  );

  const active =
    getActiveOuting_();

  if (
    recordContext.mode === "home"
  ) {
    if (
      !active ||
      active.movementStatus !==
        "移動中"
    ) {
      alert(
        "現在は帰宅を登録できる状態ではありません。"
      );
      returnToPortal_();
      return;
    }

    prepareHomeScreen_(
      active
    );

    showOnly_("screenHome");
    setBadge_("帰宅");
    return;
  }

  if (!active) {
    prepareStartScreen_();
    return;
  }

  if (
    active.shiftId &&
    active.shiftId !==
      recordContext.shiftId
  ) {
    /*
     * 以前の支援のローカル状態が残っている可能性があります。
     * GAS側でその支援がまだ進行中か確認し、
     * 終了・キャンセル済み、または本日の支援一覧に存在しない場合は
     * 古いローカル状態として自動削除します。
     */
    const stale =
      await isStaleActiveOuting_(
        active
      );

    if (stale) {
      localStorage.removeItem(
        ACTIVE_OUTING_KEY
      );

      prepareStartScreen_();
      return;
    }

    alert(
      "別の支援の移動行程が進行中です。\n\n" +
      (active.userName || "") +
      "｜" +
      (active.service || "")
    );

    returnToPortal_();
    return;
  }

  if (
    active.movementStatus ===
      "待機中"
  ) {
    showAtPlace_();
    return;
  }

  showMoveScreen_();
}

function getRecordContext_() {
  const p =
    new URLSearchParams(
      location.search
    );

  return {
    shiftId:
      p.get("shiftId") || "",
    clientName:
      p.get("clientName") || "",
    service:
      p.get("service") || "",
    supportDate:
      p.get("supportDate") || "",
    scheduledStart:
      p.get("scheduledStart") || "",
    scheduledEnd:
      p.get("scheduledEnd") || "",
    continuation:
      p.get("continuation") === "1",
    mode:
      p.get("mode") || ""
  };
}

function prepareStartScreen_() {
  const continuation =
    recordContext.continuation;

  setText_(
    "startTitle",
    continuation
      ? "出発"
      : "支援開始・出発"
  );

  setText_(
    "startLead",
    continuation
      ? "引き続き支援でサービスは開始済みです。最初の場所と移動方法を確認して出発を登録します。"
      : "最初の場所と移動方法を確認し、支援開始と最初の出発を登録します。"
  );

  setText_(
    "startRegisterButton",
    continuation
      ? "出発を登録"
      : "支援開始・出発を登録"
  );

  const paid =
    recordContext.service ===
      "有償運送";

  document
    .getElementById(
      "normalTransportFields"
    )
    .classList
    .toggle(
      "hidden",
      paid
    );

  document
    .getElementById(
      "paidTransportNote"
    )
    .classList
    .toggle(
      "hidden",
      !paid
    );

  showOnly_("screenStart");
  setBadge_(
    continuation
      ? "支援中"
      : "開始前"
  );
}


function setStartActivity_(
  text
) {
  const input =
    document.getElementById(
      "startActivity"
    );

  if (input) {
    input.value =
      text || "";
  }
}

async function getContinuousNextShift_() {
  try {
    const result =
      await postGas({
        action:
          "getTodayStaffShifts",

        employeeId:
          recordUser.employeeId,

        employeeName:
          recordUser.employeeName
      });

    if (
      !result ||
      result.success !== true ||
      !Array.isArray(
        result.shifts
      )
    ) {
      return null;
    }

    const shifts =
      result.shifts;

    const index =
      shifts.findIndex(
        s =>
          s.shiftId ===
          recordContext.shiftId
      );

    const next =
      index >= 0
        ? shifts[index + 1]
        : null;

    if (
      !next ||
      String(
        next.clientName || ""
      ).trim() !==
      String(
        recordContext.clientName || ""
      ).trim() ||
      String(
        next.startTime || ""
      ).trim() !==
      String(
        recordContext.scheduledEnd || ""
      ).trim()
    ) {
      return null;
    }

    return next;

  } catch (error) {
    console.warn(
      "次の連続支援確認に失敗",
      error
    );
    return null;
  }
}

async function recordContinuationFromActionRecord_(
  nextShift
) {
  const result =
    await postGas({
      action:
        "recordStaffContinuation",

      employeeId:
        recordUser.employeeId,

      employeeName:
        recordUser.employeeName,

      fromShiftId:
        recordContext.shiftId,

      fromClientName:
        recordContext.clientName,

      fromService:
        recordContext.service,

      fromSupportDate:
        recordContext.supportDate,

      fromScheduledStart:
        recordContext.scheduledStart,

      fromScheduledEnd:
        recordContext.scheduledEnd,

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
        new Date()
          .toISOString(),

      sendId:
        [
          recordUser.employeeId,
          recordContext.shiftId,
          nextShift.shiftId,
          "引き続き支援",
          Date.now(),
          Math.random()
            .toString(36)
            .slice(2,8)
        ].join("-"),

      registrationMethod:
        "行動記録"
    });

  if (
    !result ||
    result.success !== true
  ) {
    throw new Error(
      result?.message ||
      "引き続き支援へ切り替えられませんでした"
    );
  }

  return result;
}

async function registerInitialDeparture_() {
  if (guardRecordBusy_()) return;

  const place =
    value_("startPlace");

  if (!place) {
    alert("最初の場所を入力してください。");
    return;
  }

  const paid =
    recordContext.service ===
      "有償運送";

  const transport =
    paid
      ? "有償運送"
      : value_("startTransport");

  let driverName = "";
  let driverId = "";
  let isDriving = false;

  if (paid) {
    driverName =
      recordUser.employeeName;
    driverId =
      recordUser.employeeId;
    isDriving = true;

  } else if (
    transport === "有償運送"
  ) {
    const driver =
      value_("startDriver");

    if (!driver) {
      alert("運転手を選択してください。");
      return;
    }

    if (driver === "自分") {
      driverName =
        recordUser.employeeName;
      driverId =
        recordUser.employeeId;
      isDriving = true;
    } else {
      driverName = "他職員";
    }
  }

  const ok =
    confirm(
      place +
      "から出発します。\n\n" +
      (
        paid
          ? "有償運送"
          : "移動手段：" +
            transport
      ) +
      "\n\nよろしいですか？"
    );

  if (!ok) return;

  ensureActionRecordSession_();

  appendActionRecordSessionEvent_({
    type: "start",
    place,
    transport,
    driverName,
    driverId,
    isDriving,
    isPaidTransport:
      transport === "有償運送"
  });

  saveActiveOuting_({
    outingResultId: "",
    routeId: "LOCAL-1",
    routeNumber: 1,
    shiftId:
      recordContext.shiftId,
    userName:
      recordContext.clientName,
    service:
      recordContext.service,
    supportDate:
      recordContext.supportDate,
    scheduledStart:
      recordContext.scheduledStart,
    scheduledEnd:
      recordContext.scheduledEnd,
    currentPlace:
      place,
    movementStatus:
      "移動中",
    transport,
    driverId,
    driverName,
    isDriving,
    localOnly: true
  });

  saveLocalHistory_(
    "出発",
    {
      place,
      transport
    }
  );

  showMessage_(
    "出発を端末に保存しました。"
  );

  /*
   * 1件目の出発直後が外出支援のGAS通信ポイント。
   * 画面展開は止めず、裏で問い合わせます。
   */
  runFirstDepartureGasCheckpoint_()
    .catch(
      error =>
        console.warn(
          "出発時チェックポイント失敗",
          error
        )
    );

  await initActionRecord_();
}

async function registerActivityOnlyRoute_() {
  if (guardRecordBusy_()) return;

  const place =
    value_("startPlace");

  const activity =
    value_("startActivity");

  if (!place) {
    alert("最初の場所を入力してください。");
    return;
  }

  if (!activity) {
    alert("何をしたか入力してください。");
    return;
  }

  const paid =
    recordContext.service ===
      "有償運送";

  const transport =
    paid
      ? "有償運送"
      : value_("startTransport");

  let driverName = "";
  let driverId = "";
  let isDriving = false;

  if (paid) {
    driverName =
      recordUser.employeeName;
    driverId =
      recordUser.employeeId;
    isDriving = true;

  } else if (
    transport === "有償運送"
  ) {
    const driver =
      value_("startDriver");

    if (!driver) {
      alert("運転手を選択してください。");
      return;
    }

    if (driver === "自分") {
      driverName =
        recordUser.employeeName;
      driverId =
        recordUser.employeeId;
      isDriving = true;
    } else {
      driverName = "他職員";
    }
  }

  const ok =
    confirm(
      activity +
      "として記録し、行動記録を終了します。\n\n" +
      "よろしいですか？"
    );

  if (!ok) return;

  ensureActionRecordSession_();

  appendActionRecordSessionEvent_({
    type: "start",
    place,
    transport,
    driverName,
    driverId,
    isDriving,
    isPaidTransport:
      transport === "有償運送",
    supportDetail:
      activity
  });

  const actualAt =
    new Date().toISOString();

  saveLocalHistory_(
    "出発",
    {
      place,
      transport,
      actualAt
    }
  );

  saveLocalHistory_(
    "活動",
    {
      activity,
      actualAt
    }
  );

  appendActionRecordSessionEvent_({
    type: "home",
    place: "自宅",
    activity,
    final: true
  });

  saveLocalHistory_(
    "帰宅",
    {
      place: "自宅",
      actualAt
    }
  );

  localStorage.setItem(
    "staffPortalLastOutingPlaceV1",
    "自宅"
  );

  enqueueCompletedActionRecordSession_(
    "帰宅",
    "自宅"
  );

  showMessage_(
    "行動記録を端末に保存しました。"
  );

  setTimeout(
    returnToPortal_,
    250
  );
}

function showMoveScreen_() {
  stopCamera_();
  switchInputMode_(
    "camera"
  );
  showOnly_(
    "screenMove"
  );
  setBadge_(
    "移動中"
  );
}

function switchInputMode_(mode) {
  const camera =
    mode === "camera";

  document
    .getElementById(
      "cameraPane"
    )
    .classList
    .toggle(
      "hidden",
      !camera
    );

  document
    .getElementById(
      "manualPane"
    )
    .classList
    .toggle(
      "hidden",
      camera
    );

  document
    .getElementById(
      "cameraTab"
    )
    .classList
    .toggle(
      "active",
      camera
    );

  document
    .getElementById(
      "manualTab"
    )
    .classList
    .toggle(
      "active",
      !camera
    );

  if (!camera) {
    stopCamera_();
  }
}

async function startCamera_() {
  try {
    cameraStream =
      await navigator
        .mediaDevices
        .getUserMedia({
          video: {
            facingMode: {
              ideal:
                "environment"
            }
          },
          audio:
            false
        });

    const video =
      document.getElementById(
        "cameraVideo"
      );

    video.srcObject =
      cameraStream;

    video.classList.remove(
      "hidden"
    );

    document
      .getElementById(
        "cameraPlaceholder"
      )
      .classList
      .add(
        "hidden"
      );

    document
      .getElementById(
        "cameraStartButton"
      )
      .classList
      .add(
        "hidden"
      );

    document
      .getElementById(
        "cameraCaptureButton"
      )
      .classList
      .remove(
        "hidden"
      );

  } catch (error) {
    alert(
      "カメラを開始できませんでした。手入力へ切り替えてください。"
    );
    switchInputMode_(
      "manual"
    );
  }
}

function capturePhoto_() {
  const video =
    document.getElementById(
      "cameraVideo"
    );

  const canvas =
    document.getElementById(
      "cameraCanvas"
    );

  if (
    !video.videoWidth ||
    !video.videoHeight
  ) {
    alert(
      "カメラ映像を確認できません。"
    );
    return;
  }

  canvas.width =
    video.videoWidth;

  canvas.height =
    video.videoHeight;

  const ctx =
    canvas.getContext(
      "2d"
    );

  ctx.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );

  capturedImageData =
    canvas.toDataURL(
      "image/jpeg",
      0.72
    );

  stopCamera_();

  document
    .getElementById(
      "photoPreview"
    )
    .style
    .backgroundImage =
      `url("${capturedImageData}")`;

  document
    .getElementById(
      "photoPreview"
    )
    .classList
    .remove(
      "hidden"
    );

  document
    .getElementById(
      "photoAnalysisNote"
    )
    .classList
    .remove(
      "hidden"
    );

  document
    .getElementById(
      "confirmPlace"
    )
    .value = "";

  document
    .getElementById(
      "confirmNote"
    )
    .value = "";

  showOnly_(
    "screenConfirm"
  );

  setBadge_(
    "確認"
  );
}

function prepareManualConfirm_() {
  const place =
    value_(
      "manualPlace"
    );

  if (!place) {
    alert(
      "到着場所を入力してください。"
    );
    return;
  }

  document
    .getElementById(
      "confirmPlace"
    )
    .value =
      place;

  document
    .getElementById(
      "confirmNote"
    )
    .value =
      value_(
        "manualNote"
      );

  document
    .getElementById(
      "photoPreview"
    )
    .classList
    .add(
      "hidden"
    );

  document
    .getElementById(
      "photoAnalysisNote"
    )
    .classList
    .add(
      "hidden"
    );

  showOnly_(
    "screenConfirm"
  );

  setBadge_(
    "確認"
  );
}

async function registerArrival_() {
  if (guardRecordBusy_()) return;

  const active =
    getActiveOuting_();

  const place =
    value_("confirmPlace");

  const note =
    value_("confirmNote");

  if (!active) {
    alert(
      "進行中の移動行程を確認できません。"
    );
    return;
  }

  if (!place) {
    alert("到着場所を入力してください。");
    return;
  }

  const ok =
    confirm(
      place +
      "への到着を登録しますか？"
    );

  if (!ok) return;

  appendActionRecordSessionEvent_({
    type: "arrival",
    place,
    note
  });

  active.currentPlace =
    place;

  active.movementStatus =
    "待機中";

  active.arrivalType =
    "経由地";

  saveActiveOuting_(active);

  saveLocalHistory_(
    "到着",
    {
      place
    }
  );

  showMessage_(
    "到着を端末に保存しました。"
  );

  await initActionRecord_();
}

function setDirectActivity_(
  text
) {
  const input =
    document.getElementById(
      "directActivity"
    );

  if (input) {
    input.value =
      text || "";
  }
}

function openDirectHomeFromMove_() {
  const active =
    getActiveOuting_();

  if (
    !active ||
    active.movementStatus !==
      "移動中"
  ) {
    alert(
      "現在は帰宅を登録できる状態ではありません。"
    );
    return;
  }

  prepareHomeScreen_(
    active
  );

  showOnly_(
    "screenHome"
  );

  setBadge_(
    "帰宅"
  );
}

function prepareHomeScreen_(
  active
) {
  const homeActivityBox =
    document.getElementById(
      "homeActivityBox"
    );

  const directActivityInput =
    document.getElementById(
      "directActivity"
    );

  const isNoStopPattern =
    active &&
    Number(
      active.routeNumber || 1
    ) === 1;

  if (homeActivityBox) {
    homeActivityBox.classList.toggle(
      "hidden",
      !isNoStopPattern
    );
  }

  if (
    directActivityInput &&
    active &&
    active.directActivity
  ) {
    directActivityInput.value =
      active.directActivity;
  }

  const lead =
    document.getElementById(
      "homeLead"
    );

  if (lead) {
    lead.textContent =
      isNoStopPattern
        ? "途中でどこにも立ち寄らなかった場合は、活動内容を入力して帰宅を登録します。"
        : "利用者宅への帰宅として登録します。";
  }
}

function showAtPlace_() {
  const active =
    getActiveOuting_();

  if (!active) {
    returnToPortal_();
    return;
  }

  setText_(
    "currentPlaceTitle",
    active.currentPlace ||
    "到着場所"
  );

  setText_(
    "arrivalInfo",
    "到着済みです。出発・支援終了・移動手段変更を選択できます。"
  );

  document
    .getElementById(
      "changedTransport"
    )
    .value =
      active.transport ||
      "徒歩";

  showOnly_(
    "screenAtPlace"
  );

  setBadge_(
    "滞在中"
  );
}

function openDepartureScreen_() {
  const active =
    getActiveOuting_();

  if (!active) {
    return;
  }

  setText_(
    "departureFromPlace",
    active.currentPlace
  );

  document
    .getElementById(
      "nextTransport"
    )
    .value =
      active.transport ||
      "徒歩";

  toggleDriverField_(
    "next"
  );

  showOnly_(
    "screenDeparture"
  );

  setBadge_(
    "出発"
  );
}

async function registerNextDeparture_() {
  if (guardRecordBusy_()) return;

  const active =
    getActiveOuting_();

  if (!active) return;

  const transport =
    value_("nextTransport");

  let driverName = "";
  let driverId = "";
  let isDriving = false;

  if (transport === "有償運送") {
    const driver =
      value_("nextDriver");

    if (!driver) {
      alert("運転手を選択してください。");
      return;
    }

    if (driver === "自分") {
      driverName =
        recordUser.employeeName;
      driverId =
        recordUser.employeeId;
      isDriving = true;
    } else {
      driverName = "他職員";
    }
  }

  const ok =
    confirm(
      active.currentPlace +
      "から出発します。\n\n" +
      "移動手段：" +
      transport +
      "\n\nよろしいですか？"
    );

  if (!ok) return;

  appendActionRecordSessionEvent_({
    type: "nextDeparture",
    place:
      active.currentPlace,
    transport,
    driverName,
    driverId,
    isDriving,
    previousDriverId:
      active.driverId || "",
    isPaidTransport:
      transport === "有償運送"
  });

  active.routeNumber =
    Number(
      active.routeNumber || 1
    ) + 1;

  active.routeId =
    "LOCAL-" +
    active.routeNumber;

  active.movementStatus =
    "移動中";

  active.transport =
    transport;

  active.driverName =
    driverName;

  active.driverId =
    driverId;

  active.isDriving =
    isDriving;

  delete active.arrivalType;

  saveActiveOuting_(active);

  saveLocalHistory_(
    "出発",
    {
      place:
        active.currentPlace,
      transport
    }
  );

  showMessage_(
    "出発を端末に保存しました。"
  );

  await initActionRecord_();
}

async function finishOutingAtCurrentPlace_() {
  if (guardRecordBusy_()) return;

  const active =
    getActiveOuting_();

  if (
    !active ||
    active.movementStatus !==
      "待機中"
  ) {
    alert(
      "現在の到着場所を確認できません。"
    );
    return;
  }

  const ok =
    confirm(
      active.currentPlace +
      "で行動記録を終了しますか？"
    );

  if (!ok) return;

  appendActionRecordSessionEvent_({
    type: "finishCurrent",
    place:
      active.currentPlace,
    final: true
  });

  enqueueCompletedActionRecordSession_(
    "現在地終了",
    active.currentPlace
  );

  showMessage_(
    "行動記録を端末に保存しました。"
  );

  setTimeout(
    returnToPortal_,
    250
  );
}

async function registerHome_(andEnd) {
  if (guardRecordBusy_()) return;

  const active =
    getActiveOuting_();

  if (
    !active ||
    active.movementStatus !==
      "移動中"
  ) {
    alert(
      "現在は帰宅を登録できません。"
    );
    return;
  }

  const isNoStopPattern =
    Number(
      active.routeNumber || 1
    ) === 1;

  let activity = "";

  if (isNoStopPattern) {
    activity =
      value_("directActivity");

    if (!activity) {
      alert(
        "何をしたか入力してください。"
      );
      return;
    }
  }

  const ok =
    confirm(
      "利用者宅への帰宅を登録し、行動記録を終了しますか？"
    );

  if (!ok) return;

  const actualAt =
    new Date().toISOString();

  if (activity) {
    saveLocalHistory_(
      "活動",
      {
        activity,
        actualAt
      }
    );
  }

  appendActionRecordSessionEvent_({
    type: "home",
    place: "自宅",
    activity,
    final: true
  });

  saveLocalHistory_(
    "帰宅",
    {
      place: "自宅",
      actualAt
    }
  );

  localStorage.setItem(
    "staffPortalLastOutingPlaceV1",
    "自宅"
  );

  enqueueCompletedActionRecordSession_(
    "帰宅",
    "自宅"
  );

  showMessage_(
    "帰宅と行動記録を端末に保存しました。"
  );

  setTimeout(
    returnToPortal_,
    250
  );
}

async function recordPortalStaffAction_(
  actionType
) {
  const result =
    await postGas({
      action:
        "recordStaffAction",

      employeeId:
        recordUser.employeeId,

      employeeName:
        recordUser.employeeName,

      shiftId:
        recordContext.shiftId,

      clientName:
        recordContext.clientName,

      supportDate:
        recordContext.supportDate,

      service:
        recordContext.service,

      scheduledStart:
        recordContext.scheduledStart,

      scheduledEnd:
        recordContext.scheduledEnd,

      actionType:
        actionType,

      deviceTime:
        new Date().toISOString(),

      sendId:
        [
          recordUser.employeeId,
          recordContext.shiftId,
          actionType,
          Date.now(),
          Math.random()
            .toString(36)
            .slice(2,8)
        ].join("-"),

      registrationMethod:
        "行動記録",

      note:
        ""
    });

  if (
    !result ||
    result.success !== true
  ) {
    throw new Error(
      result?.message ||
      "支援状態を更新できませんでした"
    );
  }

  return result;
}

async function hasContinuousNext_() {
  return !!(
    await getContinuousNextShift_()
  );
}

async function resolveClientId_(
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

async function callOutingApi_(
  action,
  payload
) {
  const separator =
    OUTING_ROUTE_API_URL
      .includes("?")
      ? "&"
      : "?";

  const url =
    OUTING_ROUTE_API_URL +
    separator +
    "action=" +
    encodeURIComponent(
      action
    ) +
    "&payload=" +
    encodeURIComponent(
      JSON.stringify(
        payload
      )
    ) +
    "&_=" +
    Date.now();

  const response =
    await fetch(
      url,
      {
        method:
          "GET",
        redirect:
          "follow",
        cache:
          "no-store"
      }
    );

  if (!response.ok) {
    throw new Error(
      "HTTPエラー：" +
      response.status
    );
  }

  const text =
    await response.text();

  try {
    return JSON.parse(
      text
    );

  } catch (error) {
    throw new Error(
      "外出支援APIの応答を読み取れません"
    );
  }
}


async function isStaleActiveOuting_(
  active
) {
  try {
    const result =
      await postGas({
        action:
          "getTodayStaffShifts",

        employeeId:
          recordUser.employeeId,

        employeeName:
          recordUser.employeeName
      });

    if (
      !result ||
      result.success !== true ||
      !Array.isArray(
        result.shifts
      )
    ) {
      return false;
    }

    const oldShift =
      result.shifts.find(
        s =>
          String(
            s.shiftId || ""
          ).trim() ===
          String(
            active.shiftId || ""
          ).trim()
      );

    /*
     * 本日の一覧に存在しない場合は、
     * 前回テストや別日のローカル残骸と判断します。
     */
    if (!oldShift) {
      return true;
    }

    const state =
      String(
        oldShift.currentState || ""
      ).trim();

    /*
     * 進行中とみなすのは移動中・支援中のみです。
     */
    return ![
      "移動中",
      "支援中"
    ].includes(
      state
    );

  } catch (error) {
    console.warn(
      "古い移動行程の確認に失敗しました",
      error
    );

    /*
     * 通信に失敗した場合は安全側に倒し、
     * 自動削除しません。
     */
    return false;
  }
}

function getActiveOuting_() {
  try {
    return JSON.parse(
      localStorage.getItem(
        ACTIVE_OUTING_KEY
      ) || "null"
    );
  } catch (error) {
    return null;
  }
}

function saveActiveOuting_(
  active
) {
  localStorage.setItem(
    ACTIVE_OUTING_KEY,
    JSON.stringify(
      active
    )
  );
}

function saveLocalHistory_(
  eventType,
  extra = {}
) {
  let list = [];

  try {
    list =
      JSON.parse(
        localStorage.getItem(
          PORTAL_HISTORY_KEY
        ) || "[]"
      );
  } catch (error) {}

  const actualAt =
    extra.actualAt ||
    new Date().toISOString();

  const cleanExtra = {
    ...extra
  };

  delete cleanExtra.actualAt;

  const event = {
    id:
      "PH-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2,7),

    employeeId:
      recordUser.employeeId,

    employeeName:
      recordUser.employeeName,

    supportDate:
      recordContext.supportDate ||
      localDate_(),

    shiftId:
      recordContext.shiftId,

    clientName:
      recordContext.clientName,

    service:
      recordContext.service,

    scheduledStart:
      recordContext.scheduledStart,

    scheduledEnd:
      recordContext.scheduledEnd,

    eventType,
    actualAt,
    syncPending: true,
    ...cleanExtra
  };

  list.push(event);

  localStorage.setItem(
    PORTAL_HISTORY_KEY,
    JSON.stringify(
      list.slice(-400)
    )
  );

  appendSessionHistoryId_(
    event.id
  );

  return event;
}


function startVoiceInput_(
  inputId
) {
  const Recognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!Recognition) {
    alert(
      "このブラウザでは音声入力を利用できません。キーボードの音声入力も利用できます。"
    );
    return;
  }

  const recognition =
    new Recognition();

  recognition.lang =
    "ja-JP";

  recognition.interimResults =
    false;

  recognition.onresult =
    event => {
      const text =
        event.results[0][0]
          .transcript;

      const input =
        document.getElementById(
          inputId
        );

      if (input) {
        input.value =
          text;
      }
    };

  recognition.start();
}

function stopCamera_() {
  if (cameraStream) {
    cameraStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

    cameraStream = null;
  }
}

function showOnly_(
  id
) {
  document
    .querySelectorAll(
      ".record-screen"
    )
    .forEach(
      screen =>
        screen.classList.add(
          "hidden"
        )
    );

  document
    .getElementById(
      id
    )
    ?.classList
    .remove(
      "hidden"
    );
}

function showMessage_(
  text,
  error = false
) {
  const el =
    document.getElementById(
      "recordMessage"
    );

  if (!el) return;

  el.textContent =
    text || "";

  el.classList.toggle(
    "error",
    error
  );

  el.classList.toggle(
    "hidden",
    !text
  );
}

function setBadge_(text) {
  setText_(
    "recordStateBadge",
    text
  );
}

function setText_(
  id,
  text
) {
  const el =
    document.getElementById(
      id
    );

  if (el) {
    el.textContent =
      String(
        text || ""
      );
  }
}

function value_(id) {
  const el =
    document.getElementById(
      id
    );

  return String(
    el
      ? el.value || ""
      : ""
  ).trim();
}

function operationId_() {
  return (
    "WEB-ACT-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2,8)
      .toUpperCase()
  );
}

function localDate_() {
  const d =
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
    .formatToParts(
      d
    );

  const v = {};

  parts.forEach(
    p => {
      v[p.type] =
        p.value;
    }
  );

  return (
    v.year +
    "-" +
    v.month +
    "-" +
    v.day
  );
}

function forceExitActionRecord_() {
  const ok =
    confirm(
      "行動記録を強制終了してポータルへ戻ります。\n" +
      "通常の終了処理ができない場合のみ使用してください。\n\n" +
      "現在までの記録は端末に保持します。\n" +
      "よろしいですか？"
    );

  if (!ok) return;

  const active =
    getActiveOuting_();

  if (active) {
    appendActionRecordSessionEvent_({
      type: "forceFinish",
      place:
        active.currentPlace || "",
      final: true
    });

    enqueueCompletedActionRecordSession_(
      "強制終了",
      active.currentPlace || ""
    );
  }

  returnToPortal_();
}


function returnToPortal_() {
  stopCamera_();
  location.href =
    "./index.html";
}


window.addEventListener("error", event => {
  const message = document.getElementById("recordMessage");
  if (message) {
    message.textContent =
      "行動記録の読み込みでエラーが発生しました。ページを再読み込みしてください。";
    message.classList.remove("hidden");
    message.classList.add("error");
  }
});
