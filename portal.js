let currentUser = null;
let currentLineProfile = null;


document.addEventListener(
  "DOMContentLoaded",
  async () => {
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
     * 先に端末へ保存された
     * 本人情報を確認します。
     */
    currentUser =
      getSavedPortalUser();

    if (currentUser) {
      showPortalAreaDirect();
      return;
    }

    /*
     * 保存情報がない場合だけ
     * 本人確認画面を表示します。
     */
    showLoadingArea();

    currentLineProfile =
      await initLiff();

    /*
     * LINE IDで本人確認します。
     */
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
     * 本人確認できない場合だけ
     * 初回登録画面を表示します。
     */
    showRegisterArea();

    await loadEmployeeList();
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

  /*
   * シフト確認が終わるまでは
   * 3つのボタンをすべて使用不可
   */
  setStaffActionButtonsByState("");
  
  loadTodayStaffShifts();
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
    await liff.init({
      liffId: LIFF_ID
    });

    if (liff.isLoggedIn()) {
      const profile =
        await liff.getProfile();

      return {
        lineId: profile.userId,
        lineName: profile.displayName
      };
    }

    liff.login();
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


/**
 * ログイン職員の本日の担当シフトを取得します。
 */
async function loadTodayStaffShifts() {
  
  setStaffActionButtonsByState("");
  
  console.log(
    "loadTodayStaffShifts開始",
    {
      currentUser: currentUser,
      select:
        document.getElementById(
          "todayShiftSelect"
        )
    }
  );

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

  if (!currentUser) {
    select.innerHTML =
      '<option value="">' +
      '職員情報を確認できませんでした' +
      '</option>';

    console.error(
      "currentUserが設定されていません"
    );
    return;
  }

  select.disabled = true;

  select.innerHTML =
    '<option value="">' +
    '本日の担当シフトを取得しています…' +
    '</option>';

  try {
    console.log(
      "GASへ送信する職員情報",
      currentUser
    );

    const result =
      await postGas({
        action:
          "getTodayStaffShifts",

        employeeId:
          currentUser.employeeId,

        employeeName:
          currentUser.employeeName
      });

    console.log(
      "シフト取得結果",
      result
    );

    if (!result.success) {
      throw new Error(
        result.message ||
        "シフトの取得に失敗しました。"
      );
    }

    todayStaffShifts =
      result.shifts || [];

    setTodayShiftOptions(
      todayStaffShifts
    );

  } catch (error) {
    console.error(
      "シフト取得エラー",
      error
    );

    select.innerHTML =
      '<option value="">' +
      '取得エラー：' +
      escapeHtmlForOption_(
        error.message
      ) +
      '</option>';

  } finally {
    select.disabled = false;
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
function setTodayShiftOptions(shifts) {
  const select =
    document.getElementById(
      "todayShiftSelect"
    );

  if (!select) {
    return;
  }

  select.innerHTML =
    '<option value="">' +
    '支援を選択してください' +
    '</option>';

  if (shifts.length === 0) {
    select.innerHTML =
      '<option value="">' +
      '本日の担当シフトはありません' +
      '</option>';

    setStaffActionButtonsByState(
      ""
    );

    return;
  }

  shifts.forEach(shift => {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      shift.shiftId;

    const currentState =
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
      currentState +
      "】";

    select.appendChild(option);
  });

  select.addEventListener(
    "change",
    handleTodayShiftChange
  );

  setStaffActionButtonsByState(
    ""
  );
}


/**
 * 操作対象シフトが選択されたときの表示です。
 */
function handleTodayShiftChange() {
  const shift =
    getSelectedTodayShift();

  const statusArea =
    document.getElementById(
      "selectedShiftStatus"
    );

  if (!shift) {
    if (statusArea) {
      statusArea.textContent = "";
    }

    setStaffActionButtonsByState(
      ""
    );

    return;
  }

  const currentState =
    shift.currentState ||
    "未開始";

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

  setStaffActionButtonsByState(
    currentState
  );
}

function setStaffActionButtonsByState(
  currentState
) {
  const moveButton =
    document.getElementById(
      "moveButton"
    );

  const enterButton =
    document.getElementById(
      "enterButton"
    );

  const finishButton =
    document.getElementById(
      "finishButton"
    );

  // 最初に全て使用不可
  if (moveButton) {
    moveButton.disabled = true;
  }

  if (enterButton) {
    enterButton.disabled = true;
  }

  if (finishButton) {
    finishButton.disabled = true;
  }

  switch (currentState) {
    case "未開始":
      if (moveButton) {
        moveButton.disabled = false;
      }
      break;

    case "移動中":
      if (enterButton) {
        enterButton.disabled = false;
      }
      break;

    case "支援中":
      if (finishButton) {
        finishButton.disabled = false;
      }
      break;

    case "終了":
      // 全て使用不可のまま
      break;

    default:
      // 状態不明時も全て使用不可
      console.warn(
        "不明な現在状態です",
        currentState
      );
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

async function sendStaffAction(
  actionType
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

  if (!confirmed) {
    return;
  }

  setStaffActionButtonsDisabled(
    true
  );

  try {
    const deviceTime =
      new Date().toISOString();

    const sendId =
      createStaffActionSendId(
        currentUser.employeeId,
        shift.shiftId,
        actionType
      );

    const result =
      await postGas({
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
          deviceTime,

        sendId:
          sendId,

        registrationMethod:
          "職員ポータル",

        note: ""
      });

    if (!result.success) {
      throw new Error(
        result.message ||
        "操作を登録できませんでした。"
      );
    }

    const selectedShiftId =
      shift.shiftId;

    alert(result.message);

    await loadTodayStaffShifts();

    const select =
      document.getElementById(
        "todayShiftSelect"
      );

    if (select) {
      select.value =
        selectedShiftId;

      handleTodayShiftChange();
    }

  } catch (error) {
    alert(
      "操作の登録に失敗しました：" +
      error.message
    );

  } finally {
    const selectedShift =
      getSelectedTodayShift();
    if (selectedShift) {
      setStaffActionButtonsByState(
        selectedShift.currentState ||
        "未開始"
      );
    } else {
      setStaffActionButtonsByState(
        ""
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


function setStaffActionButtonsDisabled(
  disabled
) {
  [
    "moveButton",
    "enterButton",
    "finishButton"
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
  "todayStaffShiftCacheV1";


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

