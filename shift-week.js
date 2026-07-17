/**
 * 基本シフト表 画面処理
 *
 * 主な機能
 * ・起動時は翌週を初期表示
 * ・対象週の一覧取得
 * ・最大3週分をブラウザへ保存
 * ・担当者4名をプルダウンで変更
 * ・利用者名をクリックすると、スマホ表示用詳細欄を開閉
 * ・詳細内容をSHIFT_WEEKへ保存
 */

const SHIFT_WEEK_API_URL =
  "https://script.google.com/macros/s/AKfycbyr8KW-_XZsWDpQ_BnjdLQpiawjvOAAz4jWI8HVYVbCd-iiFjd6cau84tegSkbF203g/exec";

const SHIFT_WEEK_CACHE_KEY = "shiftWeekCacheV1";
const SHIFT_WEEK_CACHE_LIMIT = 3;

let currentWeekItems = [];
let staffOptions = [];
let openedShiftId = "";

class ApiError extends Error {
  constructor(message, errorId = "") {
    super(message || "処理に失敗しました");
    this.name = "ApiError";
    this.errorId = errorId;
  }
}

/**
 * 初期処理
 */
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
      await loadCurrentWeek(false);
    });

  document
    .getElementById("reloadButton")
    .addEventListener("click", () => loadCurrentWeek(true));

  document
    .getElementById("createButton")
    .addEventListener("click", createInitialWeek);

  document
    .getElementById("weekMonday")
    .addEventListener("change", async event => {
      const selectedDate = parseLocalDate(event.target.value);
      if (!selectedDate) return;

      setWeekMonday(getMonday(selectedDate));
      await loadCurrentWeek(false);
    });

  // 起動時は翌週の月曜日を表示します。
  const nextWeekMonday = addDays(getMonday(new Date()), 7);
  setWeekMonday(nextWeekMonday);

  await loadStaffOptions();
  await loadCurrentWeek(true);
});

/**
 * 職員マスタを取得します。
 * GAS側の week-masters が未実装の場合でも、一覧表示自体は継続します。
 */
async function loadStaffOptions() {
  try {
    const result = await jsonpRequest(
      "week-masters",
      null,
      "shiftWeekMastersCallback"
    );

    staffOptions = Array.isArray(result.staff)
      ? result.staff
      : Array.isArray(result.data && result.data.staff)
        ? result.data.staff
        : [];
  } catch (error) {
    console.warn("職員マスタを取得できませんでした", error);
    staffOptions = [];
  }
}

/**
 * 対象週の基本シフトを読み込みます。
 * forceReload=false の場合はブラウザ保存を優先します。
 */
async function loadCurrentWeek(forceReload = false) {
  const weekMonday = getSelectedWeekMonday();
  openedShiftId = "";

  if (!forceReload) {
    const cached = getCachedWeek(weekMonday);

    if (cached) {
      currentWeekItems = cached.items;
      renderTable();
      setMessage("保存済みの基本シフトを表示しています。", false);
      showCacheStatus(cached.savedAt);
      return;
    }
  }

  setMessage("基本シフトを読み込んでいます。", false);

  try {
    const result = await jsonpRequest(
      "week-list",
      null,
      "shiftWeekListCallback",
      { weekMonday }
    );

    currentWeekItems = result.data || [];
    saveCachedWeek(weekMonday, currentWeekItems);
    renderTable();

    setMessage(
      currentWeekItems.length > 0
        ? "基本シフトを読み込みました。"
        : "この週の基本シフトはまだありません。",
      false
    );

    showCacheStatus(Date.now());
  } catch (error) {
    showApiError(error, "基本シフトの読み込みに失敗しました");
  }
}

/**
 * 一覧表を描画します。
 */
function renderTable() {
  const tbody = document.getElementById("shiftWeekBody");
  const tableScroll = document.querySelector(".table-scroll");
  const emptyArea = document.getElementById("emptyArea");

  tbody.innerHTML = "";
  document.getElementById("recordCount").textContent =
    `${currentWeekItems.length}件`;

  if (currentWeekItems.length === 0) {
    tableScroll.classList.add("hidden");
    emptyArea.classList.remove("hidden");
    return;
  }

  tableScroll.classList.remove("hidden");
  emptyArea.classList.add("hidden");

  currentWeekItems.forEach(item => {
    tbody.appendChild(createMainRow(item));

    if (openedShiftId === item.shiftId) {
      tbody.appendChild(createDetailRow(item));
    }
  });
}

/**
 * 通常の明細行を作成します。
 */
function createMainRow(item) {
  const row = document.createElement("tr");
  row.dataset.shiftId = item.shiftId;

  row.innerHTML = `
    <td>
      <button
        type="button"
        class="user-detail-button ${openedShiftId === item.shiftId ? "is-open" : ""}"
        data-action="toggle-detail"
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
    <td>${escapeHtml(item.vehicle)}</td>
    <td class="content-cell" title="${escapeHtml(item.content)}">${escapeHtml(item.content)}</td>
    <td class="note-cell" title="${escapeHtml(item.note)}">${escapeHtml(item.note)}</td>
    <td>${createStaffSelect(item, "staff1")}</td>
    <td>${createStaffSelect(item, "staff2")}</td>
    <td>${createStaffSelect(item, "staff3")}</td>
    <td>${createStaffSelect(item, "staff4")}</td>
    <td>${escapeHtml(item.status)}</td>
    <td>${escapeHtml(item.publishStatus)}</td>
  `;

  row.querySelector('[data-action="toggle-detail"]')
    .addEventListener("click", () => toggleDetail(item.shiftId));

  row.querySelectorAll(".staff-select").forEach(select => {
    select.addEventListener("change", handleStaffChange);
  });

  return row;
}

/**
 * 担当者選択用のプルダウンを作成します。
 */
function createStaffSelect(item, fieldName) {
  const currentValue = String(item[fieldName] || "");
  const names = [...new Set([
    "",
    currentValue,
    ...staffOptions.map(staff =>
      typeof staff === "string"
        ? staff
        : staff.name || staff.staffName || ""
    )
  ])].filter((name, index) => index === 0 || name);

  const options = names.map(name => `
    <option
      value="${escapeHtml(name)}"
      ${name === currentValue ? "selected" : ""}
    >
      ${escapeHtml(name || "未選択")}
    </option>
  `).join("");

  return `
    <select
      class="staff-select"
      data-shift-id="${escapeHtml(item.shiftId)}"
      data-field="${escapeHtml(fieldName)}"
    >
      ${options}
    </select>
  `;
}

/**
 * 利用者名をクリックしたときに詳細欄を開閉します。
 */
function toggleDetail(shiftId) {
  openedShiftId = openedShiftId === shiftId ? "" : shiftId;
  renderTable();
}

/**
 * 利用者名の直下に表示する詳細入力欄を作成します。
 * 利用者名を先頭に置き、全体を3段程度へ収めます。
 */
function createDetailRow(item) {
  const row = document.createElement("tr");
  row.className = "detail-row";

  const cell = document.createElement("td");
  cell.colSpan = 15;

  cell.innerHTML = `
    <div class="detail-panel" data-shift-id="${escapeHtml(item.shiftId)}">
      <div class="detail-header">
        <div class="detail-user-heading">
          <strong>${escapeHtml(item.user)}</strong>
          <span>
            ${escapeHtml(formatDateForTable(item.date))}
            ${escapeHtml(item.weekday)}曜日
            ${escapeHtml(item.startTime)}～${escapeHtml(item.endTime)}
            ${escapeHtml(item.service)}
          </span>
        </div>

        <div class="detail-actions">
          <button type="button" class="detail-save-button">詳細を保存</button>
          <button type="button" class="detail-close-button">閉じる</button>
        </div>
      </div>

      <div class="detail-grid">
        ${createDetailInput("支援開始場所", "startPlace", item.startPlace, "field-start-place")}
        ${createDetailInput("開始場所補足", "startPlaceNote", item.startPlaceNote, "field-start-note")}
        ${createDetailInput("支援終了場所", "endPlace", item.endPlace, "field-end-place")}
        ${createDetailInput("終了場所補足", "endPlaceNote", item.endPlaceNote, "field-end-note")}
        ${createDetailInput("行き先", "destination", item.destination, "field-destination")}
        ${createDetailInput("移動手段", "transport", item.transport, "field-transport")}

        ${createDetailInput("待合せ", "meeting", item.meeting, "field-meeting")}
        ${createDetailInput("合流場所", "meetingPoint", item.meetingPoint, "field-meeting-point")}
        ${createDetailInput("簡易表示メモ", "simpleMemo", item.simpleMemo, "field-simple-memo")}
        ${createDetailTextarea("詳細注意", "detailNote", item.detailNote, "field-detail-note")}

        ${createDetailTextarea("支援内容", "support", item.support, "field-support")}
        ${createDetailTextarea("当日の指示", "instruction", item.instruction, "field-instruction")}
      </div>
    </div>
  `;

  row.appendChild(cell);

  cell.querySelector(".detail-close-button")
    .addEventListener("click", () => {
      openedShiftId = "";
      renderTable();
    });

  cell.querySelector(".detail-save-button")
    .addEventListener("click", () => saveDetail(item.shiftId, cell));

  return row;
}

function createDetailInput(label, field, value, className) {
  return `
    <div class="detail-field ${className}">
      <label>${escapeHtml(label)}</label>
      <input
        type="text"
        data-field="${escapeHtml(field)}"
        value="${escapeHtml(value)}"
      >
    </div>
  `;
}

function createDetailTextarea(label, field, value, className) {
  return `
    <div class="detail-field ${className}">
      <label>${escapeHtml(label)}</label>
      <textarea
        rows="1"
        data-field="${escapeHtml(field)}"
      >${escapeHtml(value)}</textarea>
    </div>
  `;
}

/**
 * 担当者変更を1項目だけ保存します。
 */
async function handleStaffChange(event) {
  const select = event.currentTarget;
  const shiftId = select.dataset.shiftId;
  const field = select.dataset.field;
  const value = select.value;

  try {
    await updateShiftWeek({
      shiftId,
      fields: { [field]: value }
    });

    const item = currentWeekItems.find(row => row.shiftId === shiftId);
    if (item) item[field] = value;

    saveCachedWeek(getSelectedWeekMonday(), currentWeekItems);
    setMessage("担当者を保存しました。", false);
  } catch (error) {
    showApiError(error, "担当者の保存に失敗しました");
    await loadCurrentWeek(true);
  }
}

/**
 * 詳細入力欄をまとめて保存します。
 */
async function saveDetail(shiftId, detailCell) {
  const fields = {};

  detailCell.querySelectorAll("[data-field]").forEach(input => {
    fields[input.dataset.field] = input.value;
  });

  try {
    await updateShiftWeek({ shiftId, fields });

    const item = currentWeekItems.find(row => row.shiftId === shiftId);
    if (item) Object.assign(item, fields);

    saveCachedWeek(getSelectedWeekMonday(), currentWeekItems);
    setMessage("スマホ表示用の詳細を保存しました。", false);
  } catch (error) {
    showApiError(error, "詳細の保存に失敗しました");
  }
}

function updateShiftWeek(payload) {
  return jsonpRequest(
    "week-update",
    payload,
    "shiftWeekUpdateCallback"
  );
}

/**
 * 規定値から対象週を初回作成します。
 */
async function createInitialWeek() {
  const weekMonday = getSelectedWeekMonday();

  if (!confirm(`${weekMonday}の週を規定値から作成しますか？`)) {
    return;
  }

  const button = document.getElementById("createButton");
  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = "作成中...";

  try {
    const result = await jsonpRequest(
      "week-create",
      { weekMonday },
      "shiftWeekCreateCallback"
    );

    setMessage(result.message || "初回作成が完了しました。", false);
    removeCachedWeek(weekMonday);
    await loadCurrentWeek(true);
  } catch (error) {
    showApiError(error, "基本シフトの初回作成に失敗しました");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

/**
 * 日付関係
 */
function parseLocalDate(text) {
  const match = String(text || "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) return null;

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

function getMonday(date) {
  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function setWeekMonday(date) {
  document.getElementById("weekMonday").value = formatLocalDate(date);

  const sunday = addDays(date, 6);
  document.getElementById("weekRange").textContent =
    `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日` +
    ` ～ ` +
    `${sunday.getFullYear()}年${sunday.getMonth() + 1}月${sunday.getDate()}日`;
}

async function moveWeek(days) {
  const current = parseLocalDate(getSelectedWeekMonday());
  if (!current) return;

  setWeekMonday(addDays(current, days));
  await loadCurrentWeek(false);
}

function getSelectedWeekMonday() {
  return document.getElementById("weekMonday").value;
}

function formatDateForTable(value) {
  const date = parseLocalDate(value);
  return date ? `${date.getMonth() + 1}/${date.getDate()}` : value || "";
}

/**
 * ブラウザ保存
 */
function readCache() {
  try {
    return JSON.parse(localStorage.getItem(SHIFT_WEEK_CACHE_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function writeCache(cache) {
  localStorage.setItem(SHIFT_WEEK_CACHE_KEY, JSON.stringify(cache));
}

function getCachedWeek(weekMonday) {
  const cache = readCache();
  const entry = cache[weekMonday];

  if (!entry) return null;

  entry.lastUsedAt = Date.now();
  cache[weekMonday] = entry;
  writeCache(cache);

  return entry;
}

function saveCachedWeek(weekMonday, items) {
  const cache = readCache();
  const now = Date.now();

  cache[weekMonday] = {
    items,
    savedAt: now,
    lastUsedAt: now
  };

  const keys = Object.keys(cache);

  if (keys.length > SHIFT_WEEK_CACHE_LIMIT) {
    keys
      .sort((a, b) => cache[a].lastUsedAt - cache[b].lastUsedAt)
      .slice(0, keys.length - SHIFT_WEEK_CACHE_LIMIT)
      .forEach(key => delete cache[key]);
  }

  writeCache(cache);
}

function removeCachedWeek(weekMonday) {
  const cache = readCache();
  delete cache[weekMonday];
  writeCache(cache);
}

function showCacheStatus(savedAt) {
  const date = new Date(savedAt);
  document.getElementById("cacheStatus").textContent =
    `端末保存：${date.getMonth() + 1}/${date.getDate()} ` +
    `${String(date.getHours()).padStart(2, "0")}:` +
    `${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * メッセージ・API共通処理
 */
function setMessage(message, isError) {
  const area = document.getElementById("messageArea");
  area.textContent = message;
  area.className = `message-area${isError ? " error" : ""}`;
}

function showApiError(error, heading) {
  const message = error && error.message
    ? error.message
    : "不明なエラーが発生しました";

  const errorId = error && error.errorId
    ? error.errorId
    : "";

  setMessage(
    `${heading}：${message}${errorId ? `　エラー番号：${errorId}` : ""}`,
    true
  );
}

function jsonpRequest(
  action,
  payload = null,
  callbackPrefix = "callback",
  extraParameters = {}
) {
  return new Promise((resolve, reject) => {
    const callbackName =
      `${callbackPrefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const script = document.createElement("script");
    let finished = false;

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new ApiError("GASの応答がタイムアウトしました"));
    }, 30000);

    window[callbackName] = result => {
      if (finished) return;

      finished = true;
      clearTimeout(timer);
      cleanup();

      if (!result || result.success !== true) {
        reject(new ApiError(
          result && result.message ? result.message : "処理に失敗しました",
          result && result.errorId ? result.errorId : ""
        ));
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

    script.src = `${SHIFT_WEEK_API_URL}?${parameters.toString()}`;
    script.onerror = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup();
      reject(new ApiError("GASへ接続できませんでした"));
    };

    document.body.appendChild(script);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
