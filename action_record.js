
const OUTING_ROUTE_API_URL =
  "https://script.google.com/macros/s/AKfycbw0DoVUbEfvfrmKrgjYig2vmJRkzXmqKAOr9RJheB88xx0WEC-IyXYicYgmhYt_ko7A/exec";

const ACTIVE_OUTING_KEY =
  "staffPortalActiveOuting";

const PORTAL_HISTORY_KEY =
  "staffPortalLocalActionHistoryV1";

let recordUser = null;
let recordContext = null;
let cameraStream = null;
let capturedImageData = "";

document.addEventListener(
  "DOMContentLoaded",
  initActionRecord_
);

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

async function registerInitialDeparture_() {
  const place =
    value_("startPlace");

  if (!place) {
    alert(
      "最初の場所を入力してください。"
    );
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
    transport ===
      "有償運送"
  ) {
    const driver =
      value_("startDriver");

    if (!driver) {
      alert(
        "運転手を選択してください。"
      );
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

  showMessage_(
    "登録しています…"
  );

  try {
    const clientId =
      await resolveClientId_(
        recordContext.clientName
      );

    const result =
      await callOutingApi_(
        "outing-start",
        {
          data: {
            supportDate:
              recordContext.supportDate ||
              localDate_(),

            shiftId:
              recordContext.shiftId,

            requestId:
              "",

            userId:
              clientId,

            userName:
              recordContext.clientName,

            serviceType:
              recordContext.service,

            serviceContent:
              "",

            mainStaffId:
              recordUser.employeeId,

            mainStaffName:
              recordUser.employeeName,

            startPlaceType:
              "自宅等",

            startPlace:
              place,

            transport:
              transport,

            isDriving:
              isDriving,

            driverId:
              driverId,

            driverName:
              driverName,

            vehicleName:
              "",

            isPaidTransport:
              transport ===
                "有償運送",

            supportDetail:
              "",

            operatorId:
              recordUser.employeeId,

            operatorName:
              recordUser.employeeName,

            registerType:
              "ポータル",

            operationId:
              operationId_()
          }
        }
      );

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result?.message ||
        "出発を登録できませんでした"
      );
    }

    const active = {
      outingResultId:
        result.outingResultId,

      routeId:
        result.routeId,

      routeNumber:
        result.routeNumber || 1,

      shiftId:
        recordContext.shiftId,

      userId:
        clientId,

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

      transport:
        transport,

      driverId:
        driverId,

      driverName:
        driverName,

      isDriving:
        isDriving
    };

    saveActiveOuting_(active);

    if (
      !recordContext.continuation
    ) {
      await recordPortalStaffAction_(
        "入りました"
      );

      saveLocalHistory_(
        "支援開始・出発",
        {
          place:
            place,
          transport:
            transport
        }
      );

    } else {
      saveLocalHistory_(
        "出発",
        {
          place:
            place,
          transport:
            transport
        }
      );
    }

    showMessage_(
      "出発を登録しました。"
    );

    setTimeout(
      returnToPortal_,
      350
    );

  } catch (error) {
    showMessage_(
      "登録に失敗しました：" +
      error.message,
      true
    );
  }
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
  const active =
    getActiveOuting_();

  const place =
    value_(
      "confirmPlace"
    );

  const note =
    value_(
      "confirmNote"
    );

  if (!active) {
    alert(
      "進行中の移動行程を確認できません。"
    );
    return;
  }

  if (!place) {
    alert(
      "到着場所を入力してください。"
    );
    return;
  }

  const ok =
    confirm(
      place +
      "への到着を登録しますか？"
    );

  if (!ok) return;

  showMessage_(
    "到着を登録しています…"
  );

  try {
    const result =
      await callOutingApi_(
        "outing-arrive",
        {
          data: {
            outingResultId:
              active.outingResultId,

            routeId:
              active.routeId,

            arrivalType:
              "経由地",

            arrivalPlaceType:
              "店舗等",

            arrivalPlace:
              place,

            arrivalPlaceNote:
              note,

            distanceKm:
              "",

            odometerArrivalKm:
              "",

            endReport:
              "",

            operatorId:
              recordUser.employeeId,

            operatorName:
              recordUser.employeeName,

            operationId:
              operationId_()
          }
        }
      );

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result?.message ||
        "到着を登録できませんでした"
      );
    }

    active.currentPlace =
      result.arrivalPlace ||
      place;

    active.movementStatus =
      "待機中";

    active.arrivalType =
      "経由地";

    saveActiveOuting_(
      active
    );

    saveLocalHistory_(
      "到着",
      {
        place:
          active.currentPlace
      }
    );

    showMessage_(
      "到着を登録しました。"
    );

    setTimeout(
      returnToPortal_,
      350
    );

  } catch (error) {
    showMessage_(
      "到着登録に失敗しました：" +
      error.message,
      true
    );
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
  const active =
    getActiveOuting_();

  if (!active) return;

  const transport =
    value_(
      "nextTransport"
    );

  let driverName = "";
  let driverId = "";
  let isDriving = false;

  if (
    transport ===
      "有償運送"
  ) {
    const driver =
      value_(
        "nextDriver"
      );

    if (!driver) {
      alert(
        "運転手を選択してください。"
      );
      return;
    }

    if (driver === "自分") {
      driverName =
        recordUser.employeeName;
      driverId =
        recordUser.employeeId;
      isDriving = true;

    } else {
      driverName =
        "他職員";
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

  showMessage_(
    "出発を登録しています…"
  );

  try {
    const result =
      await callOutingApi_(
        "outing-next-departure",
        {
          data: {
            outingResultId:
              active.outingResultId,

            previousRouteId:
              active.routeId,

            departurePlaceType:
              "経由地",

            departurePlace:
              active.currentPlace,

            departurePlaceNote:
              "",

            transport:
              transport,

            isDriving:
              isDriving,

            driverId:
              driverId,

            driverName:
              driverName,

            driverChanged:
              true,

            previousDriverId:
              active.driverId ||
              "",

            vehicleName:
              "",

            isPaidTransport:
              transport ===
                "有償運送",

            supportDetail:
              "",

            operatorId:
              recordUser.employeeId,

            operatorName:
              recordUser.employeeName,

            operationId:
              operationId_()
          }
        }
      );

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result?.message ||
        "出発を登録できませんでした"
      );
    }

    active.routeId =
      result.routeId;

    active.routeNumber =
      result.routeNumber;

    active.currentPlace =
      result.departurePlace ||
      active.currentPlace;

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

    saveActiveOuting_(
      active
    );

    saveLocalHistory_(
      "出発",
      {
        place:
          active.currentPlace,
        transport:
          transport
      }
    );

    showMessage_(
      "出発を登録しました。"
    );

    setTimeout(
      returnToPortal_,
      350
    );

  } catch (error) {
    showMessage_(
      "出発登録に失敗しました：" +
      error.message,
      true
    );
  }
}

async function finishOutingAtCurrentPlace_() {
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
      "で外出の行程を終了しますか？"
    );

  if (!ok) return;

  showMessage_(
    "支援終了を登録しています…"
  );

  try {
    const result =
      await callOutingApi_(
        "outing-finish-current-arrival",
        {
          data: {
            outingResultId:
              active.outingResultId,

            routeId:
              active.routeId,

            endReport:
              "",

            operatorId:
              recordUser.employeeId,

            operatorName:
              recordUser.employeeName,

            operationId:
              operationId_()
          }
        }
      );

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result?.message ||
        "支援終了を登録できませんでした"
      );
    }

    localStorage.removeItem(
      ACTIVE_OUTING_KEY
    );

    saveLocalHistory_(
      "支援終了",
      {
        place:
          active.currentPlace
      }
    );

    const hasContinuous =
      await hasContinuousNext_();

    if (!hasContinuous) {
      await recordPortalStaffAction_(
        "終わりました"
      );
    }

    showMessage_(
      hasContinuous
        ? "行程を終了しました。ポータルで引き続き支援へ進めます。"
        : "支援を終了しました。"
    );

    setTimeout(
      returnToPortal_,
      450
    );

  } catch (error) {
    showMessage_(
      "支援終了に失敗しました：" +
      error.message,
      true
    );
  }
}

async function registerHome_(andEnd) {
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

  const ok =
    confirm(
      andEnd
        ? "利用者宅への帰宅と支援終了を登録しますか？"
        : "利用者宅への帰宅を登録しますか？"
    );

  if (!ok) return;

  showMessage_(
    "帰宅を登録しています…"
  );

  try {
    const result =
      await callOutingApi_(
        "outing-arrive",
        {
          data: {
            outingResultId:
              active.outingResultId,

            routeId:
              active.routeId,

            arrivalType:
              andEnd
                ? "最終到着"
                : "経由地",

            arrivalPlaceType:
              "自宅等",

            arrivalPlace:
              "利用者宅",

            arrivalPlaceNote:
              "",

            distanceKm:
              "",

            odometerArrivalKm:
              "",

            endReport:
              "",

            operatorId:
              recordUser.employeeId,

            operatorName:
              recordUser.employeeName,

            operationId:
              operationId_()
          }
        }
      );

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result?.message ||
        "帰宅を登録できませんでした"
      );
    }

    saveLocalHistory_(
      "帰宅",
      {
        place:
          "利用者宅"
      }
    );

    if (andEnd) {
      localStorage.removeItem(
        ACTIVE_OUTING_KEY
      );

      saveLocalHistory_(
        "支援終了",
        {
          place:
            "利用者宅"
        }
      );

      const hasContinuous =
        await hasContinuousNext_();

      if (!hasContinuous) {
        await recordPortalStaffAction_(
          "終わりました"
        );
      }

    } else {
      active.currentPlace =
        "利用者宅";

      active.movementStatus =
        "待機中";

      active.arrivalType =
        "経由地";

      saveActiveOuting_(
        active
      );
    }

    showMessage_(
      andEnd
        ? "帰宅・支援終了を登録しました。"
        : "帰宅を登録しました。"
    );

    setTimeout(
      returnToPortal_,
      450
    );

  } catch (error) {
    showMessage_(
      "帰宅登録に失敗しました：" +
      error.message,
      true
    );
  }
}

function toggleTransportChange_() {
  document
    .getElementById(
      "transportChangeBox"
    )
    .classList
    .toggle(
      "hidden"
    );
}

function toggleChangedDriver_() {
  document
    .getElementById(
      "changedDriverWrap"
    )
    .classList
    .toggle(
      "hidden",
      value_(
        "changedTransport"
      ) !==
        "有償運送"
    );
}

function applyTransportChange_() {
  const active =
    getActiveOuting_();

  if (!active) return;

  const transport =
    value_(
      "changedTransport"
    );

  if (
    transport ===
      "有償運送" &&
    !value_(
      "changedDriver"
    )
  ) {
    alert(
      "運転手を選択してください。"
    );
    return;
  }

  active.transport =
    transport;

  if (
    transport ===
      "有償運送"
  ) {
    const self =
      value_(
        "changedDriver"
      ) === "自分";

    active.driverName =
      self
        ? recordUser.employeeName
        : "他職員";

    active.driverId =
      self
        ? recordUser.employeeId
        : "";

    active.isDriving =
      self;
  } else {
    active.driverName = "";
    active.driverId = "";
    active.isDriving = false;
  }

  saveActiveOuting_(
    active
  );

  document
    .getElementById(
      "transportChangeBox"
    )
    .classList
    .add(
      "hidden"
    );

  showMessage_(
    "移動手段を変更しました。次の出発に反映します。"
  );
}

function toggleDriverField_(prefix) {
  const transport =
    value_(
      prefix === "start"
        ? "startTransport"
        : "nextTransport"
    );

  document
    .getElementById(
      prefix === "start"
        ? "startDriverWrap"
        : "nextDriverWrap"
    )
    .classList
    .toggle(
      "hidden",
      transport !==
        "有償運送"
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

    return !!(
      next &&
      String(
        next.clientName || ""
      ).trim() ===
      String(
        recordContext.clientName || ""
      ).trim() &&
      String(
        next.startTime || ""
      ).trim() ===
      String(
        recordContext.scheduledEnd || ""
      ).trim()
    );

  } catch (error) {
    console.warn(
      "次の連続支援確認に失敗",
      error
    );
    return false;
  }
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

  list.push({
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

    eventType:
      eventType,

    actualAt:
      new Date()
        .toISOString(),

    ...extra
  });

  localStorage.setItem(
    PORTAL_HISTORY_KEY,
    JSON.stringify(
      list.slice(-400)
    )
  );
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

function returnToPortal_() {
  stopCamera_();
  location.href =
    "./index.html";
}
