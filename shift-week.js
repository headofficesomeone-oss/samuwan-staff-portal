/**
 * =============================================================
 * 基本シフト表 画面処理
 * =============================================================
 *
 * 主な処理
 * 1. 起動時に翌週を表示する
 * 2. 対象週を移動する
 * 3. 基本シフトをGASから取得する
 * 4. 最大3週分をブラウザへ保存する
 * 5. 担当者4人分をプルダウンで変更する
 * 6. 利用者名をクリックして詳細入力欄を開閉する
 * 7. 担当変更・スマホ表示用詳細をSHIFT_WEEKへ保存する
 */

/* =============================================================
   GAS WebアプリURL
============================================================= */
const SHIFT_WEEK_API_URL =
  "https://script.google.com/macros/s/AKfycbyr8KW-_XZsWDpQ_BnjdLQpiawjvOAAz4jWI8HVYVbCd-iiFjd6cau84tegSkbF203g/exec";

/* =============================================================
   ブラウザ保存の設定
============================================================= */
const SHIFT_WEEK_CACHE_KEY = "shiftWeekCacheV2";
const SHIFT_WEEK_CACHE_LIMIT = 3;

/** 現在画面に表示している基本シフト */
let currentWeekItems = [];

/** 職員プルダウンへ表示する職員名 */
let staffOptions = [];

/** 現在詳細欄を開いているシフトID */
let expandedShiftId = "";

class ApiError extends Error {
  constructor(message, errorId = "") {
    super(message || "処理に失敗しました");
    this.name = "ApiError";
    this.errorId = errorId || "";
  }
}

/* =============================================================
   画面起動時
============================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  document
    .getElementById("previousWeekButton")
    .addEventListener("click", () => moveWeek(-7));

  document
    .getElementById("nextWeekButton")
    .addEventListener("click", () => moveWeek(7));

  document
    .getElementById("currentWeekButton")
    .addEventListener("click", async () => {
      setWeekMonday(getMonday(new Date()));
      await loadCurrentWeek({ forceReload: false });
    });

  document
    .getElementById("reloadButton")
    .addEventListener("click", async () => {
      await loadCurrentWeek({ forceReload: true });
    });

  document
    .getElementById("createButton")
    .addEventListener("click", createInitialWeek);

  document
    .getElementById("weekMonday")
    .addEventListener("change", async event => {
      const selectedDate = parseLocalDate(event.target.value);

      if (!selectedDate) {
        return;
      }

      setWeekMonday(getMonday(selectedDate));
      await loadCurrentWeek({ forceReload: false });
    });

  /* 起動時は翌週を初期表示します。 */
  const nextWeekMonday = addDays(
    getMonday(new Date()),
    7
  );

  setWeekMonday(nextWeekMonday);

  /* 職員マスタと対象週を並行して読み込みます。 */
  await Promise.all([
    loadStaffOptions(),
    loadCurrentWeek({ forceReload: true })
  ]);
});

/* =============================================================
   日付関連
============================================================= */
function parseLocalDate(text) {
  const match = String(text || "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    return null;
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
}

function formatLocalDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function formatJapaneseDate(date) {
  return (
    date.getFullYear() +
    "年" +
    (date.getMonth() + 1) +
    "月" +
    date.getDate() +
    "日"
  );
}

function getMonday(date) {
  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const weekday = result.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;

  result.setDate(result.getDate() + offset);
  return result;
}

function addDays(date, days) {
  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  result.setDate(result.getDate() + days);
  return result;
}

function setWeekMonday(monday) {
  const sunday = addDays(monday, 6);

  document.getElementById("weekMonday").value =
    formatLocalDate(monday);

  document.getElementById("weekRange").textContent =
    formatJapaneseDate(monday) +
    " ～ " +
    formatJapaneseDate(sunday);
}

function getSelectedWeekMonday() {
  return document.getElementById("weekMonday").value;
}

async function moveWeek(days) {
  const currentMonday = parseLocalDate(
    getSelectedWeekMonday()
  );

  if (!currentMonday) {
    return;
  }

  expandedShiftId = "";
  setWeekMonday(addDays(currentMonday, days));
  await loadCurrentWeek({ forceReload: false });
}

/* =============================================================
   職員マスタ
============================================================= */
/**
 * 担当者プルダウン用の職員一覧を取得します。
 * GAS側のgetStaffList()をweek-masters経由で使用します。
 */
async function loadStaffOptions() {
  try {
    const result = await jsonpRequest(
      "week-masters",
      null,
      "shiftWeekMastersCallback"
    );

    staffOptions = normalizeStaffOptions(result.data);

    /* 一覧が先に描画済みの場合は、プルダウンを描画し直します。 */
    if (currentWeekItems.length > 0) {
      renderTable();
    }
  } catch (error) {
    console.error("職員マスタを取得できませんでした", error);

    /*
      職員マスタが取得できなくても、現在登録されている担当者を
      選択肢に含めて最低限の編集を可能にします。
    */
    staffOptions = collectCurrentStaffNames();
  }
}

/** GASの返却形式の違いを吸収して職員名配列へ変換します。 */
function normalizeStaffOptions(data) {
  const source = Array.isArray(data)
    ? data
    : Array.isArray(data && data.staff)
      ? data.staff
      : Array.isArray(data && data.staffList)
        ? data.staffList
        : [];

  const names = source
    .map(item => {
      if (typeof item === "string") {
        return item.trim();
      }

      return String(
        item.name ||
        item.staffName ||
        item.employeeName ||
        item.label ||
        item.value ||
        ""
      ).trim();
    })
    .filter(Boolean);

  return [...new Set(names)].sort((a, b) =>
    a.localeCompare(b, "ja")
  );
}

/** 現在のシフトに登録されている担当者名を集めます。 */
function collectCurrentStaffNames() {
  const names = [];

  currentWeekItems.forEach(item => {
    [item.staff1, item.staff2, item.staff3, item.staff4]
      .map(value => String(value || "").trim())
      .filter(Boolean)
      .forEach(name => names.push(name));
  });

  return [...new Set(names)].sort((a, b) =>
    a.localeCompare(b, "ja")
  );
}

/* =============================================================
   基本シフト読み込み
============================================================= */
async function loadCurrentWeek({ forceReload = false } = {}) {
  const weekMonday = getSelectedWeekMonday();

  if (!weekMonday) {
    return;
  }

  const cachedWeek = getCachedWeek(weekMonday);

  if (!forceReload && cachedWeek) {
    currentWeekItems = cachedWeek.items || [];
    expandedShiftId = "";
    renderTable();

    setMessage("保存済みの基本シフトを表示しています。");
    showCacheStatus(cachedWeek.savedAt);
    return;
  }

  setMessage("基本シフトを読み込んでいます。");
  setButtonsDisabled(true);

  try {
    const result = await jsonpRequest(
      "week-list",
      null,
      "shiftWeekListCallback",
      { weekMonday }
    );

    currentWeekItems = result.data || [];
    expandedShiftId = "";
    renderTable();
    saveWeekToCache(weekMonday, currentWeekItems);

    setMessage(
      currentWeekItems.length > 0
        ? "基本シフトを読み込みました。"
        : "この週の基本シフトはまだありません。"
    );

    showCacheStatus(new Date().toISOString());
  } catch (error) {
    if (cachedWeek) {
      currentWeekItems = cachedWeek.items || [];
      expandedShiftId = "";
      renderTable();

      setMessage(
        "通信できないため、保存済みデータを表示しています。",
        true
      );

      showCacheStatus(cachedWeek.savedAt);
      return;
    }

    showApiError(
      error,
      "基本シフトの読み込みに失敗しました"
    );
  } finally {
    setButtonsDisabled(false);
  }
}

/* =============================================================
   規定値から初回作成
============================================================= */
async function createInitialWeek() {
  const weekMonday = getSelectedWeekMonday();

  if (!weekMonday) {
    alert("対象週を選択してください。");
    return;
  }

  const confirmed = confirm(
    weekMonday +
    "の週について、規定値から基本シフトを作成しますか？"
  );

  if (!confirmed) {
    return;
  }

  const createButton = document.getElementById("createButton");
  const originalText = createButton.textContent;

  setButtonsDisabled(true);
  createButton.textContent = "作成中...";

  try {
    const result = await jsonpRequest(
      "week-create",
      { weekMonday },
      "shiftWeekCreateCallback"
    );

    setMessage(
      result.message || "初回作成が完了しました。"
    );

    removeWeekFromCache(weekMonday);
    await loadCurrentWeek({ forceReload: true });
  } catch (error) {
    showApiError(
      error,
      "基本シフトの初回作成に失敗しました"
    );
  } finally {
    createButton.textContent = originalText;
    setButtonsDisabled(false);
  }
}

/* =============================================================
   一覧表の描画
============================================================= */
function renderTable() {
  const tbody = document.getElementById("shiftWeekBody");
  const emptyArea = document.getElementById("emptyArea");
  const tableScroll = document.querySelector(".table-scroll");

  tbody.innerHTML = "";

  document.getElementById("recordCount").textContent =
    currentWeekItems.length + "件";

  if (currentWeekItems.length === 0) {
    tableScroll.classList.add("hidden");
    emptyArea.classList.remove("hidden");
    return;
  }

  tableScroll.classList.remove("hidden");
  emptyArea.classList.add("hidden");

  currentWeekItems.forEach(item => {
    tbody.appendChild(createShiftDataRow(item));

    if (expandedShiftId === item.shiftId) {
      tbody.appendChild(createDetailRow(item));
    }
  });
}

/** 基本シフトの通常行を作成します。 */
function createShiftDataRow(item) {
  const row = document.createElement("tr");
  row.className = "shift-data-row";
  row.dataset.shiftId = item.shiftId;

  row.innerHTML = `
    <td>
      <button
        type="button"
        class="user-detail-button"
        aria-expanded="${expandedShiftId === item.shiftId}"
        data-shift-id="${escapeHtml(item.shiftId)}"
      >
        ${escapeHtml(item.user)}
      </button>
    </td>
    <td>${escapeHtml(formatDateForTable(item.date))}</td>
    <td>${escapeHtml(item.weekday)}</td>
    <td>${escapeHtml(item.startTime)}</td>
    <td>${escapeHtml(item.endTime)}</td>
    <td>${escapeHtml(item.service)}</td>
    <td class="vehicle-cell" title="${escapeHtml(item.vehicle)}">
      ${escapeHtml(item.vehicle)}
    </td>
    <td class="content-cell" title="${escapeHtml(item.content)}">
      ${escapeHtml(item.content)}
    </td>
    <td class="note-cell" title="${escapeHtml(item.note)}">
      ${escapeHtml(item.note)}
    </td>
    <td>${createStaffSelect(item, "staff1")}</td>
    <td>${createStaffSelect(item, "staff2")}</td>
    <td>${createStaffSelect(item, "staff3")}</td>
    <td>${createStaffSelect(item, "staff4")}</td>
    <td>${createStatusLabel(item.status)}</td>
    <td>${escapeHtml(item.publishStatus)}</td>
  `;

  row
    .querySelector(".user-detail-button")
    .addEventListener("click", () => {
      toggleDetailRow(item.shiftId);
    });

  row
    .querySelectorAll(".staff-select")
    .forEach(select => {
      select.addEventListener("change", () => {
        saveStaffChange(select);
      });
    });

  return row;
}

/** 担当者プルダウンHTMLを作成します。 */
function createStaffSelect(item, fieldName) {
  const currentValue = String(item[fieldName] || "").trim();

  const availableNames = [
    ...staffOptions,
    currentValue
  ].filter(Boolean);

  const uniqueNames = [...new Set(availableNames)].sort(
    (a, b) => a.localeCompare(b, "ja")
  );

  const options = [
    `<option value="">未設定</option>`,
    ...uniqueNames.map(name => {
      const selected = name === currentValue
        ? " selected"
        : "";

      return (
        `<option value="${escapeHtml(name)}"${selected}>` +
        `${escapeHtml(name)}</option>`
      );
    })
  ].join("");

  return `
    <select
      class="staff-select"
      data-shift-id="${escapeHtml(item.shiftId)}"
      data-field="${escapeHtml(fieldName)}"
      aria-label="${escapeHtml(item.user)}の${getStaffFieldLabel(fieldName)}"
    >
      ${options}
    </select>
  `;
}

function getStaffFieldLabel(fieldName) {
  const labels = {
    staff1: "主担当",
    staff2: "副担当",
    staff3: "担当3",
    staff4: "担当4"
  };

  return labels[fieldName] || fieldName;
}

/* =============================================================
   担当者プルダウンの保存
============================================================= */
async function saveStaffChange(select) {
  const shiftId = select.dataset.shiftId;
  const fieldName = select.dataset.field;
  const newValue = select.value;
  const item = findShiftItem(shiftId);

  if (!item || !fieldName) {
    return;
  }

  const previousValue = item[fieldName] || "";

  select.disabled = true;
  select.classList.add("is-saving");

  try {
    await updateShiftWeek({
      shiftId,
      changes: {
        [fieldName]: newValue
      }
    });

    item[fieldName] = newValue;
    updateCurrentWeekCache();

    select.classList.remove("is-saving");
    select.classList.add("is-saved");

    setMessage(
      item.user + "の" +
      getStaffFieldLabel(fieldName) +
      "を保存しました。"
    );

    setTimeout(() => {
      select.classList.remove("is-saved");
    }, 1200);
  } catch (error) {
    select.value = previousValue;
    select.classList.remove("is-saving");
    select.classList.add("is-error");

    showApiError(error, "担当者の保存に失敗しました");

    setTimeout(() => {
      select.classList.remove("is-error");
    }, 1800);
  } finally {
    select.disabled = false;
  }
}

/* =============================================================
   詳細欄の開閉
============================================================= */
function toggleDetailRow(shiftId) {
  expandedShiftId =
    expandedShiftId === shiftId
      ? ""
      : shiftId;

  renderTable();

  if (expandedShiftId) {
    const detailRow = document.querySelector(
      `.detail-row[data-shift-id="${cssEscape(expandedShiftId)}"]`
    );

    if (detailRow) {
      detailRow.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }
  }
}

/** スマホ表示用の詳細入力欄を作成します。 */
function createDetailRow(item) {
  const row = document.createElement("tr");
  row.className = "detail-row";
  row.dataset.shiftId = item.shiftId;

  const cell = document.createElement("td");
  cell.colSpan = 15;

  cell.innerHTML = `
    <div class="detail-panel">
      <div class="detail-panel-header">
        <h2 class="detail-panel-title">
          ${escapeHtml(item.user)}　スマホ表示用の詳細
        </h2>

        <button
          type="button"
          class="secondary-button detail-close-button"
        >
          閉じる
        </button>
      </div>

      <div class="detail-grid">
        ${createDetailInput("支援開始場所", "startPlace", item.startPlace)}
        ${createDetailInput("開始場所補足", "startPlaceNote", item.startPlaceNote)}
        ${createDetailInput("支援終了場所", "endPlace", item.endPlace)}
        ${createDetailInput("終了場所補足", "endPlaceNote", item.endPlaceNote)}

        ${createDetailInput("行き先", "destination", item.destination)}
        ${createDetailInput("待合せ", "meeting", item.meeting)}
        ${createDetailInput("合流場所", "meetingPoint", item.meetingPoint)}
        ${createDetailInput("移動手段", "transport", item.transport)}

        ${createDetailTextarea("支援内容", "support", item.support, "span-2")}
        ${createDetailTextarea("当日の指示", "instruction", item.instruction, "span-2")}
        ${createDetailTextarea("詳細注意", "detailNote", item.detailNote, "span-2")}
        ${createDetailTextarea("簡易表示メモ", "simpleMemo", item.simpleMemo, "span-2")}
      </div>

      <div class="detail-actions">
        <span class="detail-save-status"></span>

        <button
          type="button"
          class="secondary-button detail-cancel-button"
        >
          入力を戻す
        </button>

        <button
          type="button"
          class="primary-button detail-save-button"
        >
          詳細を保存
        </button>
      </div>
    </div>
  `;

  row.appendChild(cell);

  cell
    .querySelector(".detail-close-button")
    .addEventListener("click", () => {
      expandedShiftId = "";
      renderTable();
    });

  cell
    .querySelector(".detail-cancel-button")
    .addEventListener("click", () => {
      renderTable();
    });

  cell
    .querySelector(".detail-save-button")
    .addEventListener("click", () => {
      saveDetailChanges(row, item);
    });

  return row;
}

function createDetailInput(label, fieldName, value) {
  return `
    <div class="detail-field">
      <label>${escapeHtml(label)}</label>
      <input
        type="text"
        data-detail-field="${escapeHtml(fieldName)}"
        value="${escapeHtml(value)}"
      >
    </div>
  `;
}

function createDetailTextarea(label, fieldName, value, extraClass = "") {
  return `
    <div class="detail-field ${escapeHtml(extraClass)}">
      <label>${escapeHtml(label)}</label>
      <textarea
        data-detail-field="${escapeHtml(fieldName)}"
      >${escapeHtml(value)}</textarea>
    </div>
  `;
}

/* =============================================================
   詳細欄の保存
============================================================= */
async function saveDetailChanges(detailRow, item) {
  const saveButton = detailRow.querySelector(
    ".detail-save-button"
  );
  const statusArea = detailRow.querySelector(
    ".detail-save-status"
  );
  const originalText = saveButton.textContent;
  const changes = {};

  detailRow
    .querySelectorAll("[data-detail-field]")
    .forEach(input => {
      changes[input.dataset.detailField] = input.value.trim();
    });

  saveButton.disabled = true;
  saveButton.textContent = "保存中...";
  statusArea.textContent = "詳細を保存しています。";

  try {
    await updateShiftWeek({
      shiftId: item.shiftId,
      changes
    });

    Object.assign(item, changes);
    updateCurrentWeekCache();

    statusArea.textContent = "保存しました。";
    setMessage(item.user + "の詳細を保存しました。");
  } catch (error) {
    statusArea.textContent = "保存できませんでした。";
    showApiError(error, "詳細の保存に失敗しました");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = originalText;
  }
}

/** 基本シフト1件の変更をGASへ送信します。 */
async function updateShiftWeek(payload) {
  const result = await jsonpRequest(
    "week-update",
    payload,
    "shiftWeekUpdateCallback"
  );

  if (!result || result.success !== true) {
    throw new ApiError(
      result && result.message
        ? result.message
        : "保存に失敗しました",
      result && result.errorId
        ? result.errorId
        : ""
    );
  }

  return result;
}

function findShiftItem(shiftId) {
  return currentWeekItems.find(
    item => item.shiftId === shiftId
  );
}

/* =============================================================
   表示補助
============================================================= */
function formatDateForTable(value) {
  const date = parseLocalDate(value);

  if (!date) {
    return value || "";
  }

  return (
    date.getMonth() + 1 +
    "/" +
    date.getDate()
  );
}

function createStatusLabel(statusValue) {
  const status = String(statusValue || "予定");
  let className = "planned";

  if (status === "変更") {
    className = "changed";
  } else if (status === "キャンセル") {
    className = "cancelled";
  }

  return `
    <span class="status-label ${className}">
      ${escapeHtml(status)}
    </span>
  `;
}

function setMessage(message, isError = false) {
  const area = document.getElementById("messageArea");

  area.textContent = message;
  area.className =
    "message-area" +
    (isError ? " error" : "");
}

function showCacheStatus(savedAt) {
  const area = document.getElementById("cacheStatus");

  if (!savedAt) {
    area.textContent = "";
    return;
  }

  const date = new Date(savedAt);

  if (Number.isNaN(date.getTime())) {
    area.textContent = "";
    return;
  }

  area.textContent =
    "端末保存：" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "/" +
    String(date.getDate()).padStart(2, "0") +
    " " +
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0");
}

function showApiError(error, heading) {
  console.error(error);

  const message =
    error && error.message
      ? error.message
      : "不明なエラーが発生しました";

  const errorId =
    error && error.errorId
      ? String(error.errorId)
      : "";

  setMessage(
    heading +
    "：" +
    message +
    (errorId ? "　エラー番号：" + errorId : ""),
    true
  );

  alert(
    heading +
    "\n\n" +
    message +
    (errorId ? "\n\nエラー番号：" + errorId : "")
  );
}

function setButtonsDisabled(disabled) {
  [
    "previousWeekButton",
    "nextWeekButton",
    "currentWeekButton",
    "reloadButton",
    "createButton",
    "weekMonday"
  ].forEach(id => {
    const element = document.getElementById(id);

    if (element) {
      element.disabled = disabled;
    }
  });
}

/* =============================================================
   ブラウザ保存
============================================================= */
function readCache() {
  try {
    const text = localStorage.getItem(
      SHIFT_WEEK_CACHE_KEY
    );

    if (!text) {
      return { weeks: {} };
    }

    const cache = JSON.parse(text);

    if (!cache || typeof cache !== "object") {
      return { weeks: {} };
    }

    if (!cache.weeks || typeof cache.weeks !== "object") {
      cache.weeks = {};
    }

    return cache;
  } catch (error) {
    console.warn("基本シフトの保存データを読めませんでした", error);
    return { weeks: {} };
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(
      SHIFT_WEEK_CACHE_KEY,
      JSON.stringify(cache)
    );
  } catch (error) {
    console.warn("基本シフトをブラウザへ保存できませんでした", error);
  }
}

function getCachedWeek(weekMonday) {
  const cache = readCache();
  const entry = cache.weeks[weekMonday];

  if (!entry) {
    return null;
  }

  entry.lastAccessedAt = new Date().toISOString();
  writeCache(cache);

  return entry;
}

function saveWeekToCache(weekMonday, items) {
  const cache = readCache();
  const now = new Date().toISOString();

  cache.weeks[weekMonday] = {
    items,
    savedAt: now,
    lastAccessedAt: now
  };

  const entries = Object.entries(cache.weeks);

  if (entries.length > SHIFT_WEEK_CACHE_LIMIT) {
    entries
      .sort((a, b) => {
        const aTime = new Date(
          a[1].lastAccessedAt || a[1].savedAt || 0
        ).getTime();

        const bTime = new Date(
          b[1].lastAccessedAt || b[1].savedAt || 0
        ).getTime();

        return aTime - bTime;
      })
      .slice(
        0,
        entries.length - SHIFT_WEEK_CACHE_LIMIT
      )
      .forEach(([key]) => {
        delete cache.weeks[key];
      });
  }

  writeCache(cache);
}

function updateCurrentWeekCache() {
  const weekMonday = getSelectedWeekMonday();

  if (!weekMonday) {
    return;
  }

  saveWeekToCache(weekMonday, currentWeekItems);
  showCacheStatus(new Date().toISOString());
}

function removeWeekFromCache(weekMonday) {
  const cache = readCache();

  if (cache.weeks[weekMonday]) {
    delete cache.weeks[weekMonday];
    writeCache(cache);
  }
}

/* =============================================================
   JSONP通信
============================================================= */
function jsonpRequest(
  action,
  payload = null,
  callbackPrefix = "callback",
  extraParameters = {}
) {
  return new Promise((resolve, reject) => {
    const callbackName =
      callbackPrefix +
      "_" +
      Date.now() +
      "_" +
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
      if (finished) {
        return;
      }

      finished = true;
      cleanup();

      reject(
        new ApiError("GASの応答がタイムアウトしました")
      );
    }, 30000);

    window[callbackName] = result => {
      if (finished) {
        return;
      }

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

    const parameters = new URLSearchParams();

    parameters.set("action", action);
    parameters.set("callback", callbackName);
    parameters.set("_", Date.now());

    Object.entries(extraParameters).forEach(([key, value]) => {
      parameters.set(key, value);
    });

    if (payload !== null) {
      parameters.set("payload", JSON.stringify(payload));
    }

    script.src =
      SHIFT_WEEK_API_URL +
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
        new ApiError("GASへ接続できませんでした")
      );
    };

    document.body.appendChild(script);
  });
}

/* =============================================================
   文字列の安全な表示
============================================================= */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** querySelectorでシフトIDを安全に使用します。 */
function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(String(value));
  }

  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
