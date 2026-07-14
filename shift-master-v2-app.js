/**
 * シフト規定値マスタ V2 フロント処理
 *
 * 主な役割
 * ・GAS APIから規定値・従業員・選択肢マスタを取得する
 * ・一覧の検索、並び替え、選択状態を管理する
 * ・新規登録、コピー新規、修正保存を行う
 * ・規定値の無効化と、有効への復活を行う
 *
 * 注意
 * ・規定値ID（id）は同じ規定値を識別するためのID
 * ・履歴ID（historyId）は変更履歴を識別するためのID
 * ・sourceRowはGAS側で元データ行を安全に確認するために使用する
 * ・通信方式はJSONP。GAS_API_URLは再デプロイ時に変更されていないか確認する
 */

// GAS Webアプリの実行URL。APIの再デプロイ後も同じURLか確認する。
const GAS_API_URL =
  "https://script.google.com/macros/s/AKfycbyr8KW-_XZsWDpQ_BnjdLQpiawjvOAAz4jWI8HVYVbCd-iiFjd6cau84tegSkbF203g/exec";

// GASから取得した規定値一覧。画面表示・選択・保存後の再読込に使用する。
let shiftData = [];
// shiftData上で現在選択している位置。未選択は-1。
let selectedIndex = -1;
// new:新規、copy:コピー新規、update:既存データ修正。
let editMode = "new";

// 従業員一覧と、サービス・移動手段などの選択肢マスタ。
let masterData = {
  staff: [],
  choices: {}
};

const WEEKDAY_ORDER = {
  "月": 1,
  "火": 2,
  "水": 3,
  "木": 4,
  "金": 5,
  "土": 6,
  "日": 7
};

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function setInput(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value === null || value === undefined ? "" : value;
}

function getInput(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

/** 規定値が無効状態かを判定する。 */
function isInactiveItem(item) {
  return String(item.status || "").trim() === "無効";
}

/** 空欄または「有効」を有効データとして扱う。 */
function isActiveItem(item) {
  const status = String(item.status || "").trim();
  return status === "" || status === "有効";
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "ja", {
    numeric: true,
    sensitivity: "base"
  });
}

function getTimeSortValue(value) {
  const text = formatTimeForList(value);
  if (!text) return 24 * 60 + 1;

  const match = text.match(/^(\d{2}):(\d{2})$/);
  if (!match) return 24 * 60 + 1;

  return Number(match[1]) * 60 + Number(match[2]);
}

function compareWeekday(a, b) {
  return (WEEKDAY_ORDER[a.weekday] || 99) -
         (WEEKDAY_ORDER[b.weekday] || 99);
}

/**
 * 一覧表示用の並び順を決める。
 * 曜日を最優先し、画面で選択された並び替え方法に従う。
 */
function compareShiftItems(a, b, sortMode) {
  let result = compareWeekday(a, b);
  if (result !== 0) return result;

  if (sortMode === "staff") {
    result = compareText(a.staff1, b.staff1);
    if (result !== 0) return result;

    result = getTimeSortValue(a.startTime) - getTimeSortValue(b.startTime);
    if (result !== 0) return result;

  } else if (sortMode === "user") {
    result = compareText(a.user, b.user);
    if (result !== 0) return result;

    result = getTimeSortValue(a.startTime) - getTimeSortValue(b.startTime);
    if (result !== 0) return result;

  } else {
    result = getTimeSortValue(a.startTime) - getTimeSortValue(b.startTime);
    if (result !== 0) return result;

    result = compareText(a.staff1, b.staff1);
    if (result !== 0) return result;
  }

  result = compareText(a.user, b.user);
  if (result !== 0) return result;

  return compareText(a.id, b.id);
}

/**
 * 利用者・曜日・有効状態で絞り込み、指定順に並べた一覧を返す。
 * originalIndexは、並び替え後も元のshiftDataを正しく選択するために保持する。
 */
function getFilteredSortedItems() {
  const filterUser = getInput("filterUser");
  const filterWeekday = getInput("filterWeekday");
  const sortMode = getInput("sortMode") || "shift";
  const activeFilter = getInput("activeFilter") || "active";

  return shiftData
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (filterUser && item.user !== filterUser) return false;
      if (filterWeekday && item.weekday !== filterWeekday) return false;

      if (activeFilter === "active" && !isActiveItem(item)) return false;
      if (activeFilter === "inactive" && !isInactiveItem(item)) return false;

      return true;
    })
    .sort((a, b) => compareShiftItems(a.item, b.item, sortMode));
}

/** 左側の規定値一覧を再描画する。 */
function renderList() {
  const list = qs(".shift-list");
  if (!list) return;

  list.innerHTML = "";

  const displayItems = getFilteredSortedItems();

  if (displayItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "shift-list-empty";
    empty.textContent = "該当する規定値はありません";
    list.appendChild(empty);
    return;
  }

  displayItems.forEach(({ item, originalIndex }) => {
    const div = document.createElement("div");
    div.className =
      "shift-item" +
      (originalIndex === selectedIndex ? " selected" : "") +
      (isInactiveItem(item) ? " inactive" : "");

    div.innerHTML = `
      <div class="shift-line1">
        <span>${item.weekday || ""}曜日</span>
        <span>${formatTimeRange(item.startTime, item.endTime)}</span>
        <span class="shift-name">${item.user || ""}</span>
      </div>
      <div class="shift-line2">
        <span>${item.service || ""}</span>
        <span>${item.staff1 || ""}</span>
        <span>${item.people || ""}</span>
        ${isInactiveItem(item) ? "<span>無効</span>" : ""}
      </div>
    `;

    div.addEventListener("click", () => {
      closeWeekPanel();
      selectedIndex = originalIndex;
      editMode = "update";
      loadToForm(item);
      updateDisableButtonState();
      renderList();
    });

    list.appendChild(div);
  });
}

function formatTimeForList(value) {
  if (value === "" || value === null || value === undefined) return "";

  if (typeof value === "number") {
    const text = String(Math.trunc(value)).padStart(4, "0");
    return text.slice(0, 2) + ":" + text.slice(2, 4);
  }

  const text = String(value).trim();
  if (!text) return "";

  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [hour, minute] = text.split(":");
    return hour.padStart(2, "0") + ":" + minute.padStart(2, "0");
  }

  if (/^\d{1,4}$/.test(text)) {
    const padded = text.padStart(4, "0");
    return padded.slice(0, 2) + ":" + padded.slice(2, 4);
  }

  return text;
}

function formatTimeRange(startTime, endTime) {
  const start = formatTimeForList(startTime);
  const end = formatTimeForList(endTime);

  if (!start && !end) return "";
  return `${start} ～ ${end}`;
}

/** 規定値データから利用者検索用プルダウンを作り直す。 */
function updateFilterOptions() {
  const filterUser = qs("#filterUser");
  if (!filterUser) return;

  const currentValue = filterUser.value;
  const users = [...new Set(
    shiftData.map(item => item.user).filter(Boolean)
  )].sort((a, b) => compareText(a, b));

  filterUser.innerHTML = `<option value="">すべての利用者</option>`;

  users.forEach(user => {
    const option = document.createElement("option");
    option.value = user;
    option.textContent = user;
    filterUser.appendChild(option);
  });

  if (users.includes(currentValue)) {
    filterUser.value = currentValue;
  }
}

/** 規定値データから登録フォームの利用者プルダウンを作り直す。 */
function updateUserSelectOptions() {
  const userSelect = qs("#userSelect");
  if (!userSelect) return;

  const currentValue = userSelect.value;
  const users = [...new Set(
    shiftData.map(item => item.user).filter(Boolean)
  )].sort((a, b) => compareText(a, b));

  userSelect.innerHTML = `<option value="">選択してください</option>`;

  users.forEach(user => {
    const option = document.createElement("option");
    option.value = user;
    option.textContent = user;
    userSelect.appendChild(option);
  });

  if (users.includes(currentValue)) {
    userSelect.value = currentValue;
  }
}

/**
 * 選択した規定値を入力フォームへ展開する。
 * 修正時は利用者の変更を禁止し、別利用者へ登録したい場合はコピー新規を使う。
 */
function loadToForm(item) {
  setInput("masterId", item.id);
  setInput("historyId", item.historyId);
  setInput("userSelect", item.user);
  setInput("startDate", formatDateForInput(item.startDate));
  setInput("endDate", formatDateForInput(item.endDate));
  setInput("weekdaySelect", item.weekday);
  setInput("startTime", formatTimeForInput(item.startTime));
  setInput("endTime", formatTimeForInput(item.endTime));
  setInput("peopleSelect", item.people || "1人");
  setInput("serviceSelect", item.service);
  setInput("changeType", item.changeType || "通常");
  setInput("staff1", item.staff1);
  setInput("staff2", item.staff2);
  setInput("staff3", item.staff3);
  setInput("staff4", item.staff4);
  setInput("support", item.support);
  setInput("destination", item.destination);
  setInput("meeting", item.meeting);
  setInput("transport", item.transport);
  setInput("note", item.note);

  const weekPattern = String(
    item.weekPattern === null || item.weekPattern === undefined
      ? ""
      : item.weekPattern
  );

  setInput("weekPatternText", weekPattern);

  qsa("#weekPanel input[type='checkbox']").forEach(cb => {
    if (cb.dataset.weekGroup === "number") {
      cb.checked = weekPattern.includes(cb.value);
    } else {
      cb.checked = weekPattern === cb.value;
    }
  });

  const userSelect = qs("#userSelect");
  if (userSelect) {
    userSelect.disabled = editMode === "update";
  }
}

/** 入力フォームの内容をGASへ送るデータ形式にまとめる。 */
function formToData() {
  return {
    id: getInput("masterId"),
    historyId: getInput("historyId"),
    startDate: getInput("startDate"),
    endDate: getInput("endDate"),
    weekPattern: getInput("weekPatternText"),
    weekday: getInput("weekdaySelect"),
    order: "",
    user: getInput("userSelect"),
    service: getInput("serviceSelect"),
    startTime: getInput("startTime"),
    endTime: getInput("endTime"),
    people: getInput("peopleSelect"),
    changeType: getInput("changeType"),
    staff1: getInput("staff1"),
    staff2: getInput("staff2"),
    staff3: getInput("staff3"),
    staff4: getInput("staff4"),
    support: getInput("support"),
    destination: getInput("destination"),
    meeting: getInput("meeting"),
    meetingPoint: "",
    transport: getInput("transport"),
    detailNote: "",
    simpleMemo: "",
    note: getInput("note")
  };
}

/** 新規入力用にフォームと週パターン選択を初期化する。 */
function clearForm() {
  setInput("masterId", "");
  setInput("historyId", "");
  setInput("userSelect", "");
  setInput("startDate", "");
  setInput("endDate", "");
  setInput("weekdaySelect", "");
  setInput("startTime", "");
  setInput("endTime", "");
  setInput("peopleSelect", "1人");
  setInput("serviceSelect", "");
  setInput("weekPatternText", "毎週");
  setInput("changeType", "通常");
  setInput("staff1", "");
  setInput("staff2", "");
  setInput("staff3", "");
  setInput("staff4", "");
  setInput("support", "");
  setInput("destination", "");
  setInput("meeting", "");
  setInput("transport", "");
  setInput("note", "");

  qsa("#weekPanel input[type='checkbox']").forEach(cb => {
    cb.checked = cb.value === "毎週";
  });

  const userSelect = qs("#userSelect");
  if (userSelect) {
    userSelect.disabled = false;
  }
}

/** 保存前の必須項目チェック。最初に見つかった不足内容を返す。 */
function validateData(data) {
  if (!data.user) return "利用者を選択してください";
  if (!data.weekday) return "曜日を選択してください";
  if (!data.startTime) return "開始時刻を入力してください";
  if (!data.endTime) return "終了時刻を入力してください";
  if (!data.service) return "サービスを選択してください";
  return "";
}

/**
 * 現在のフォーム内容を保存する。
 * editModeとsourceRowをGASへ渡し、新規・コピー新規・修正をGAS側で判定する。
 * 保存後は全件を再取得し、保存された規定値を再選択する。
 */
async function saveCurrent() {
  closeWeekPanel();

  const data = formToData();
  const errorMessage = validateData(data);

  if (errorMessage) {
    alert(errorMessage);
    return;
  }

  const saveButton = qs(".save-button");
  saveButton.disabled = true;
  saveButton.textContent = "保存中...";

  try {
    const result = await saveShiftDataToGas(data);
    alert(result.message || "保存しました");

    await reloadAllData();

    const savedIndex = shiftData.findIndex(item =>
      item.id === result.id &&
      item.historyId === result.historyId
    );

    if (savedIndex >= 0) {
      selectedIndex = savedIndex;
      editMode = "update";
      loadToForm(shiftData[savedIndex]);
    } else {
      selectedIndex = -1;
      editMode = "new";
      clearForm();
    }

    renderList();
    updateDisableButtonState();

  } catch (error) {
    console.error(error);
    alert(error.message);

  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "この内容で保存";
  }
}

/** 入力内容を破棄し、新規時は空欄、修正時は選択中データへ戻す。 */
function cancelEdit() {
  closeWeekPanel();

  if (editMode === "new" || editMode === "copy") {
    selectedIndex = -1;
    editMode = "new";
    clearForm();
  } else if (selectedIndex >= 0) {
    loadToForm(shiftData[selectedIndex]);
  }

  updateDisableButtonState();
  renderList();
}

/**
 * 選択中の規定値を元にコピー新規を開始する。
 * ID・履歴ID・sourceRowをクリアし、既存行の上書きを防ぐ。
 */
function copyToNew() {
  closeWeekPanel();

  if (selectedIndex < 0) {
    alert("コピー元を一覧から選択してください");
    return;
  }

  const copied = {
    ...shiftData[selectedIndex],
    id: "",
    historyId: "",
    sourceRow: 0,
    status: "有効"
  };

  editMode = "copy";
  selectedIndex = -1;

  loadToForm(copied);

  const userSelect = qs("#userSelect");
  if (userSelect) userSelect.disabled = false;

  updateDisableButtonState();
  renderList();
}

function toggleWeekPanel() {
  const panel = qs("#weekPanel");
  if (panel) panel.classList.toggle("hidden");
}

function closeWeekPanel() {
  const panel = qs("#weekPanel");
  if (panel) panel.classList.add("hidden");
}

/** 週パターンの排他選択と、第1～第5週の複数選択を制御する。 */
function updateWeekPattern(changedCheckbox) {
  const allChecks = qsa("#weekPanel input[type='checkbox']");

  if (changedCheckbox.checked) {
    const selectedGroup = changedCheckbox.dataset.weekGroup;

    allChecks.forEach(cb => {
      if (cb === changedCheckbox) return;

      if (
        selectedGroup === "number" &&
        cb.dataset.weekGroup === "number"
      ) {
        return;
      }

      cb.checked = false;
    });

    if (selectedGroup === "alternate") {
      allChecks.forEach(cb => {
        if (
          cb !== changedCheckbox &&
          cb.dataset.weekGroup === "alternate"
        ) {
          cb.checked = false;
        }
      });
    }
  }

  const selected = allChecks
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  setInput("weekPatternText", selected.join(""));
}

function setSelectOptions(id, list, firstText = "選択してください") {
  const select = document.getElementById(id);
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = firstText;
  select.appendChild(empty);

  (list || []).forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if ((list || []).includes(currentValue)) {
    select.value = currentValue;
  }
}

/** GASから取得した従業員・サービス・移動手段を各プルダウンへ反映する。 */
function applyMasterOptions() {
  setSelectOptions("staff1", masterData.staff);
  setSelectOptions("staff2", masterData.staff);
  setSelectOptions("staff3", masterData.staff);
  setSelectOptions("staff4", masterData.staff);
  setSelectOptions("serviceSelect", masterData.choices["サービス"] || []);
  setSelectOptions("transport", masterData.choices["移動手段"] || [], "選択");
}

/** GASから返された画面表示用メッセージとエラー番号を保持する。 */
class ApiError extends Error {
  constructor(message, errorId = "") {
    super(message || "処理に失敗しました");
    this.name = "ApiError";
    this.errorId = errorId || "";
  }
}

/**
 * 利用者には簡潔なメッセージとエラー番号を表示する。
 * 詳細原因はGAS側のERROR_LOGで同じエラー番号を検索して確認する。
 */
function showApiError(error, heading = "処理に失敗しました") {
  console.error(error);

  const message =
    error && error.message
      ? error.message
      : "不明なエラーが発生しました";

  const errorId =
    error && error.errorId
      ? String(error.errorId)
      : "";

  alert(
    heading + "\n\n" +
    message +
    (errorId ? "\n\nエラー番号：" + errorId : "")
  );
}

/**
 * GAS WebアプリへJSONPでアクセスする共通通信処理。
 * タイムアウト、接続失敗、GAS側エラーをApiErrorへ統一する。
 */
function jsonpRequest(action, payload = null, callbackPrefix = "callback") {
  return new Promise((resolve, reject) => {
    const callbackName =
      callbackPrefix + "_" +
      Date.now() + "_" +
      Math.floor(Math.random() * 100000);

    const script = document.createElement("script");
    let finished = false;

    const cleanup = () => {
      delete window[callbackName];

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    const timer = setTimeout(() => {
      if (finished) return;

      finished = true;
      cleanup();

      reject(
        new ApiError(
          "GASの応答がタイムアウトしました"
        )
      );
    }, 30000);

    window[callbackName] = result => {
      if (finished) return;

      finished = true;
      clearTimeout(timer);
      cleanup();

      if (!result || result.success !== true) {
        reject(
          new ApiError(
            result && result.message
              ? result.message
              : "処理に失敗しました",
            result && result.errorId
              ? result.errorId
              : ""
          )
        );
        return;
      }

      resolve(result);
    };

    const params = new URLSearchParams();
    params.set("action", action);
    params.set("callback", callbackName);
    params.set("_", Date.now());

    if (payload !== null) {
      params.set("payload", JSON.stringify(payload));
    }

    script.src = `${GAS_API_URL}?${params.toString()}`;

    script.onerror = () => {
      if (finished) return;

      finished = true;
      clearTimeout(timer);
      cleanup();

      reject(
        new ApiError(
          "GASへ接続できませんでした"
        )
      );
    };

    document.body.appendChild(script);
  });
}


/** 従業員・選択肢マスタをGASから取得する。 */
async function loadMasterDataFromGas() {
  const result = await jsonpRequest("masters", null, "masterCallback");
  masterData.staff = result.staff || [];
  masterData.choices = result.choices || {};
}

/** 規定値一覧をGASから取得する。 */
async function loadShiftDataFromGas() {
  const result = await jsonpRequest("list", null, "shiftKCallback");
  shiftData = result.data || [];
}

/** 保存・無効化・復活後に規定値一覧とプルダウンを最新化する。 */
async function reloadAllData() {
  await loadShiftDataFromGas();
  updateFilterOptions();
  updateUserSelectOptions();
}

/**
 * 保存APIを呼び出す。
 * sourceRowは修正対象行の照合に使用し、新規時は0を渡す。
 */
async function saveShiftDataToGas(data) {
  const sourceItem =
    selectedIndex >= 0 ? shiftData[selectedIndex] : null;

  return jsonpRequest(
    "save",
    {
      mode: editMode,
      sourceRow: sourceItem && sourceItem.sourceRow
        ? sourceItem.sourceRow
        : 0,
      data
    },
    "saveShiftKCallback"
  );
}

/** 選択中の規定値を無効化するAPIを呼び出す。 */
async function disableShiftDataToGas(item) {
  return jsonpRequest(
    "disable",
    {
      sourceRow: item.sourceRow || 0,
      id: item.id || "",
      historyId: item.historyId || ""
    },
    "disableShiftKCallback"
  );
}

/** 無効になっている規定値を有効へ戻すAPIを呼び出す。 */
async function restoreShiftDataToGas(item) {
  return jsonpRequest(
    "restore",
    {
      sourceRow: item.sourceRow || 0,
      id: item.id || "",
      historyId: item.historyId || ""
    },
    "restoreShiftKCallback"
  );
}

/**
 * 選択中データの状態に応じて、無効化または有効への復活を実行する。
 * 画面上は同じボタンを使い、isRestoreで処理を切り替える。
 */
async function disableCurrent() {
  closeWeekPanel();

  if (editMode !== "update" || selectedIndex < 0) {
    alert("規定値を一覧から選択してください");
    return;
  }

  const item = shiftData[selectedIndex];
  const isRestore = isInactiveItem(item);

  const message =
    `この規定値を${isRestore ? "有効に戻しますか？" : "無効にしますか？"}\n\n` +
    `${item.user || ""}　${item.weekday || ""}曜日　` +
    formatTimeRange(item.startTime, item.endTime);

  if (!confirm(message)) return;

  const button = qs(".disable-button");
  button.disabled = true;
  button.textContent = "処理中...";

  try {
    const result = isRestore
      ? await restoreShiftDataToGas(item)
      : await disableShiftDataToGas(item);

    alert(result.message || (isRestore ? "有効に戻しました" : "無効にしました"));

    await reloadAllData();

    selectedIndex = -1;
    editMode = "new";
    clearForm();
    renderList();

  } catch (error) {
    console.error(error);
    alert(error.message);

  } finally {
    updateDisableButtonState();
  }
}

/** 選択状態と有効状態に合わせて無効化／有効に戻すボタンを更新する。 */
function updateDisableButtonState() {
  const button = qs(".disable-button");
  if (!button) return;

  if (editMode !== "update" || selectedIndex < 0) {
    button.disabled = true;
    button.textContent = "無効にする";
    return;
  }

  button.disabled = false;
  button.textContent = isInactiveItem(shiftData[selectedIndex])
    ? "有効に戻す"
    : "無効にする";
}

function formatDateForInput(value) {
  if (!value) return "";

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(value)) {
      const parts = value.split("/");
      return [
        parts[0],
        parts[1].padStart(2, "0"),
        parts[2].padStart(2, "0")
      ].join("-");
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function formatTimeForInput(value) {
  const formatted = formatTimeForList(value);
  return /^\d{2}:\d{2}$/.test(formatted) ? formatted : "";
}

/** 有効状態フィルター変更時に選択とフォームを安全にリセットする。 */
function resetSelectionForFilter() {
  closeWeekPanel();
  selectedIndex = -1;
  editMode = "new";
  clearForm();
  updateDisableButtonState();
  renderList();
}

/**
 * 画面初期化。イベント登録後にマスタと規定値を取得し、最初の有効データを表示する。
 * 初期読込に失敗した場合でも、空の画面として操作可能な状態へ戻す。
 */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    qs(".new-button").addEventListener("click", () => {
      closeWeekPanel();
      selectedIndex = -1;
      editMode = "new";
      clearForm();
      updateDisableButtonState();
      renderList();
    });

    qs(".copy-button").addEventListener("click", copyToNew);
    qs(".save-button").addEventListener("click", saveCurrent);
    qs(".secondary-button").addEventListener("click", cancelEdit);
    qs(".disable-button").addEventListener("click", disableCurrent);
    qs("#weekButton").addEventListener("click", toggleWeekPanel);

    qsa("#weekPanel input[type='checkbox']").forEach(cb => {
      cb.addEventListener("change", () => updateWeekPattern(cb));
    });

    qs("#filterUser").addEventListener("change", renderList);
    qs("#filterWeekday").addEventListener("change", renderList);
    qs("#sortMode").addEventListener("change", renderList);
    qs("#activeFilter").addEventListener("change", resetSelectionForFilter);

    await loadMasterDataFromGas();
    applyMasterOptions();

    await loadShiftDataFromGas();

    updateFilterOptions();
    updateUserSelectOptions();

    const firstActiveIndex = shiftData.findIndex(isActiveItem);

    if (firstActiveIndex >= 0) {
      selectedIndex = firstActiveIndex;
      editMode = "update";
      loadToForm(shiftData[firstActiveIndex]);
    } else {
      selectedIndex = -1;
      editMode = "new";
      clearForm();
    }

    renderList();
    updateDisableButtonState();

  } catch (error) {
    console.error(error);
    alert(
      "初期データを読み込めませんでした。\n" +
      error.message
    );

    shiftData = [];
    selectedIndex = -1;
    editMode = "new";
    clearForm();
    renderList();
    updateDisableButtonState();
  }
});