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
   * 確認が終わるまでは、
   * 3つの操作ボタンを使用不可にします。
   */
  setStaffActionButtonsByState("");

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
      cache.shifts || [];

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
     * 更新番号が同じなら、
     * シフト一覧は再取得しません。
     */
    if (cacheIsCurrent) {
      console.log(
        "基本シフトの変更なし：" +
        "保存済みシフトを使用します。"
      );

      return;
    }

    /*
     * 更新番号が変わった場合だけ、
     * 最新の担当シフトを取得します。
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
      newShifts;

    /*
     * プルダウンを最新状態へ更新します。
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

    setStaffActionButtonsByState("");
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

    setStaffActionButtonsByState("");

    const actionGrid =
      document.getElementById("portalActionButtons");

    const tempButton =
      document.getElementById("temporaryChangeButton");

    if (actionGrid) {
      actionGrid.classList.add("hidden");
    }

    if (tempButton) {
      tempButton.classList.add("hidden");
    }

    updateSupportMainDisplay_(null);

    return;
  }

  const actionGrid =
    document.getElementById("portalActionButtons");

  const tempButton =
    document.getElementById("temporaryChangeButton");

  if (actionGrid) {
    actionGrid.classList.remove("hidden");
  }

  if (tempButton) {
    tempButton.classList.remove("hidden");
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

  const currentState =
    shift.currentState ||
    "未開始";

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

function isOutingService_(service) {
  const s = String(service || "");
  return ["同行援護","移動支援","通院介助","通院等介助","有償運送"].some(v => s.includes(v));
}

function setButtonVisible_(id, visible) {
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
        todayStaffShifts.length
          ? "支援を選択してください"
          : "本日の支援予定はありません";
    }

    if (meta) {
      meta.textContent =
        todayStaffShifts.length
          ? ""
          : "現在、操作する支援はありません。";
    }

    if (statePill) {
      statePill.textContent =
        todayStaffShifts.length
          ? "待機中"
          : "予定なし";
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
  if (!shift || !currentUser) return;
  let list = [];
  try { list = JSON.parse(localStorage.getItem(PORTAL_HISTORY_KEY) || "[]"); } catch(e) {}
  list.push({
    id: "PH-" + Date.now() + "-" + Math.random().toString(36).slice(2,7),
    employeeId: currentUser.employeeId || "",
    employeeName: currentUser.employeeName || "",
    supportDate: shift.supportDate || getTodayLocalDateText(),
    shiftId: shift.shiftId || "",
    clientName: shift.clientName || "",
    service: shift.service || "",
    scheduledStart: shift.startTime || "",
    scheduledEnd: shift.endTime || "",
    eventType,
    actualAt: new Date().toISOString(),
    ...extra
  });
  localStorage.setItem(PORTAL_HISTORY_KEY, JSON.stringify(list.slice(-300)));
}

function getPortalLocalHistory_() {
  try {
    const list = JSON.parse(localStorage.getItem(PORTAL_HISTORY_KEY) || "[]");
    const today = getTodayLocalDateText();
    return Array.isArray(list) ? list.filter(x => x.supportDate === today && (!currentUser || x.employeeId === currentUser.employeeId)) : [];
  } catch(e) {
    return [];
  }
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

function openSelectedOutingActionRecord() {
  const shift = getSelectedTodayShift();
  if (!shift) { alert("支援を選択してください。"); return; }
  const params = new URLSearchParams();
  params.set("shiftId", shift.shiftId || "");
  params.set("clientName", shift.clientName || "");
  params.set("service", shift.service || "");
  params.set("scheduledStart", shift.startTime || "");
  params.set("scheduledEnd", shift.endTime || "");
  params.set("fromPortal", "1");
  location.href = "./outing.html?" + params.toString();
}

function openTemporaryChangeNotice() {
  alert("今回だけ一時変更は、GAS側の保存先を追加した後に有効化します。\n画面仕様はデモ版の内容で実装予定です。");
}

function undoLastPortalAction() {
  alert("元に戻すにはGAS側で取消対象IDを保持する処理が必要です。\nGAS実装後に有効化します。");
}

function openPortalHistory() {
  const modal = document.getElementById("portalHistoryModal");
  const helper = document.getElementById("historyHelperName");
  if (helper && currentUser) helper.textContent = currentUser.employeeName;
  renderPortalHistory_();
  modal?.classList.remove("hidden");
  document.body.classList.add("modal-open");
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
  const all = getPortalLocalHistory_();
  let events = all.slice();

  if (portalHistoryMode === "client") {
    events = events.filter(e => e.eventType !== "向かいます");
  } else if (portalHistoryMode === "staff") {
    events = events.filter(e => ["入りました","支援開始","引き続き支援","終わりました","支援終了","キャンセル"].includes(e.eventType));
  }

  if (!events.length) {
    view.innerHTML = '<div class="portal-history-empty">この端末で記録した履歴はまだありません。</div>';
    return;
  }

  const routeTypes = ["出発","到着","帰宅","移動手段変更"];
  let html = '<div class="portal-history-group">';
  events.forEach(e => {
    if (e.eventType === "キャンセル") {
      html += '<div class="portal-history-cancel">キャンセル　' +
        escapePortalText_(e.clientName) + '｜' + escapePortalText_(e.service) + '　' + escapePortalText_(e.scheduledStart) + '</div>';
      return;
    }
    const time = formatActualTime_(e.actualAt);
    const routeClass = routeTypes.includes(e.eventType) ? " route" : "";
    html += '<div class="portal-history-item' + routeClass + '"><strong>' +
      escapePortalText_(time + "　" + e.eventType) + '</strong><small>' +
      escapePortalText_(e.clientName + "｜" + e.service + (e.scheduledStart ? "　" + e.scheduledStart : "")) +
      '</small></div>';
  });
  html += '</div>';
  view.innerHTML = html;
}

function escapePortalText_(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function setStaffActionButtonsByState(currentState) {
  const instructionButton = document.getElementById("instructionButton");
  const moveButton = document.getElementById("moveButton");
  const enterButton = document.getElementById("enterButton");
  const finishButton = document.getElementById("finishButton");
  const preCancelButton = document.getElementById("preCancelButton");
  const cancelButton = document.getElementById("cancelButton");
  const actionRecordButton = document.getElementById("actionRecordButton");

  [moveButton,enterButton,finishButton,preCancelButton,cancelButton,actionRecordButton]
    .forEach(b => { if (b) { b.disabled = true; b.classList.add("hidden"); } });

  const shift = getSelectedTodayShift();
  updateSupportMainDisplay_(shift);

  if (!shift) {
    if (instructionButton) instructionButton.disabled = true;
    return;
  }

  if (instructionButton) instructionButton.disabled = false;
  const outing = isOutingService_(shift.service);

  switch (currentState || "未開始") {
    case "未開始":
      if (moveButton) { moveButton.disabled = false; moveButton.classList.remove("hidden"); }
      if (preCancelButton) { preCancelButton.disabled = false; preCancelButton.classList.remove("hidden"); }
      break;

    case "移動中":
      if (outing) {
        if (actionRecordButton) { actionRecordButton.disabled = false; actionRecordButton.classList.remove("hidden"); }
      } else {
        if (enterButton) { enterButton.disabled = false; enterButton.classList.remove("hidden"); }
      }
      if (cancelButton) { cancelButton.disabled = false; cancelButton.classList.remove("hidden"); }
      break;

    case "支援中":
      if (finishButton) { finishButton.disabled = false; finishButton.classList.remove("hidden"); }
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

    if (!confirmed) {
      return;
    }
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

    savePortalLocalHistory_(
      actionType === "キャンセル" ? "キャンセル" : actionType,
      shift,
      { localLabel: options.localLabel || "" }
    );

    if (actionType === "キャンセル") {
      showPortalCancelFlash_(shift.service);
    }

    const selectedShiftId =
      shift.shiftId;

		/*
		 * 完了メッセージは表示せず、
		 * 最新状態を取得して次のボタンへ切り替えます。
		 */
		await loadTodayStaffShifts(true);

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
    "finishButton",
    "preCancelButton",
    "cancelButton",
    "actionRecordButton"
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
