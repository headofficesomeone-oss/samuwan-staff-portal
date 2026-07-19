/**
 * =============================================================
 * shift-week.js
 * =============================================================
 *
 * 基本シフト表画面の処理をまとめています。
 *
 * 主な機能
 * ・起動時は翌週を表示
 * ・前週／次週／今週の切替
 * ・最大3週分をブラウザへ保存
 * ・未保存の週だけGASから取得
 * ・初回作成
 * ・担当者4名のプルダウン変更と保存
 * ・利用者名クリックで詳細欄を開閉
 * ・スマホ表示用詳細項目の保存
 */

const SHIFT_WEEK_API_URL =
  "https://script.google.com/macros/s/AKfycbwBQOZ5MjFRwQyKKYXLVpM5npEl9od34CQjoW9rWimQaphIf_sTK8_uIjxSVrMxvtGX/exec";

/* ブラウザへ保存するキーと、保存する最大週数です。 */
const SHIFT_WEEK_CACHE_KEY = "shiftWeekCacheV3";
const SHIFT_WEEK_CACHE_LIMIT = 3;

let currentWeekItems = [];
let staffChoices = [];
let openDetailShiftId = "";

class ApiError extends Error {
  constructor(message, errorId = "") {
    super(message || "処理に失敗しました");
    this.name = "ApiError";
    this.errorId = errorId || "";
  }
}

/* =============================================================
   起動処理
   ============================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  bindScreenEvents();

  /*
    見出し上の横スクロールバーと表本体を連動させます。
    HTMLが読み込まれた後に一度だけ設定します。
  */
  setupHorizontalScrollSync();

  /* 担当者プルダウン用の職員一覧を取得します。 */
  await loadMasters();

  /*
    基本シフトは通常、翌週分を作成するため、
    起動時は翌週の月曜日を初期表示します。
  */
  const nextWeekMonday = addDays(getMonday(new Date()), 7);
  setWeekMonday(nextWeekMonday);

  /* 起動時はGASから最新状態を取得します。 */
  await loadCurrentWeek({ forceReload: true });
});

function bindScreenEvents() {
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
      await loadCurrentWeek();
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

      if (!selectedDate) return;

      setWeekMonday(getMonday(selectedDate));
      await loadCurrentWeek();
    });
}

/* =============================================================
   日付処理
   ============================================================= */

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

  const weekday = result.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;

  result.setDate(result.getDate() + offset);
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function setWeekMonday(date) {
  const input = document.getElementById("weekMonday");
  const sunday = addDays(date, 6);

  input.value = formatLocalDate(date);

  document.getElementById("weekRange").textContent =
    `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日` +
    " ～ " +
    `${sunday.getFullYear()}年${sunday.getMonth() + 1}月${sunday.getDate()}日`;
}

async function moveWeek(days) {
  const current = parseLocalDate(
    document.getElementById("weekMonday").value
  );

  if (!current) return;

  setWeekMonday(addDays(current, days));
  await loadCurrentWeek();
}

/* =============================================================
   上側横スクロールバー
   ============================================================= */

/**
 * 見出し上の横スクロールバーと、表本体の横スクロールを
 * 双方向に同期させます。
 *
 * この関数は画面起動時に一度だけ実行します。
 */
function setupHorizontalScrollSync() {
  const topScroll = document.getElementById("topScroll");
  const tableScroll = document.getElementById("tableScroll");

  if (!topScroll || !tableScroll) {
    return;
  }

  let syncingFromTop = false;
  let syncingFromTable = false;

  /* 上側バーを動かした場合、表本体も同じ位置へ動かします。 */
  topScroll.addEventListener("scroll", () => {
    if (syncingFromTable) return;

    syncingFromTop = true;
    tableScroll.scrollLeft = topScroll.scrollLeft;
    syncingFromTop = false;
  });

  /* 表本体を動かした場合、上側バーも同じ位置へ動かします。 */
  tableScroll.addEventListener("scroll", () => {
    if (syncingFromTop) return;

    syncingFromTable = true;
    topScroll.scrollLeft = tableScroll.scrollLeft;
    syncingFromTable = false;
  });

  /* 画面幅が変わった際は、表の横幅を測り直します。 */
  window.addEventListener("resize", updateHorizontalScrollWidth);

  updateHorizontalScrollWidth();
}

/**
 * 上側スクロールバーの中身を、実際の表の横幅へ合わせます。
 *
 * 表が画面幅より広い場合だけ上側バーを表示し、
 * 横スクロールが不要な場合やデータがない場合は隠します。
 */
function updateHorizontalScrollWidth() {
  const topScroll = document.getElementById("topScroll");
  const topScrollInner = document.getElementById("topScrollInner");
  const tableScroll = document.getElementById("tableScroll");
  const table = document.querySelector(".shift-table");

  if (!topScroll || !topScrollInner || !tableScroll || !table) {
    return;
  }

  const tableIsHidden = tableScroll.classList.contains("hidden");
  const tableWidth = Math.max(table.scrollWidth, tableScroll.scrollWidth);
  const needsHorizontalScroll = tableWidth > tableScroll.clientWidth + 1;

  topScrollInner.style.width = `${tableWidth}px`;
  topScroll.classList.toggle(
    "hidden",
    tableIsHidden || !needsHorizontalScroll
  );

  /* 表側で保持している現在位置も上側へ反映します。 */
  topScroll.scrollLeft = tableScroll.scrollLeft;
}

/* =============================================================
   ブラウザ保存
   ============================================================= */

function readWeekCache() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(SHIFT_WEEK_CACHE_KEY) || "{}"
    );

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("基本シフトの端末保存を読めませんでした", error);
    return {};
  }
}

function getCachedWeek(weekMonday) {
  const cache = readWeekCache();
  const entry = cache[weekMonday];

  if (!entry || !Array.isArray(entry.items)) {
    return null;
  }

  /* 表示した週を最新利用として記録します。 */
  entry.lastUsedAt = Date.now();
  cache[weekMonday] = entry;
  localStorage.setItem(SHIFT_WEEK_CACHE_KEY, JSON.stringify(cache));

  return entry;
}

function saveWeekCache(weekMonday, items) {
  const cache = readWeekCache();
  const now = Date.now();

  cache[weekMonday] = {
    items: items,
    savedAt: now,
    lastUsedAt: now
  };

  const keys = Object.keys(cache);

  if (keys.length > SHIFT_WEEK_CACHE_LIMIT) {
    keys
      .sort((a, b) => {
        return (
          Number(cache[a].lastUsedAt || 0) -
          Number(cache[b].lastUsedAt || 0)
        );
      })
      .slice(0, keys.length - SHIFT_WEEK_CACHE_LIMIT)
      .forEach(key => delete cache[key]);
  }

  localStorage.setItem(SHIFT_WEEK_CACHE_KEY, JSON.stringify(cache));
}

function updateCacheStatus(entry = null) {
  const area = document.getElementById("cacheStatus");

  if (!entry || !entry.savedAt) {
    area.textContent = "";
    return;
  }

  const date = new Date(entry.savedAt);

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

/* =============================================================
   マスタ取得
   ============================================================= */

async function loadMasters() {
  try {
    const result = await jsonpRequest(
      "week-masters",
      null,
      "shiftWeekMastersCallback"
    );

    const rawStaff = result.data && result.data.staff
      ? result.data.staff
      : [];

    staffChoices = normalizeStaffChoices(rawStaff);
  } catch (error) {
    /*
      職員一覧を取得できない場合も一覧表示自体は続けます。
      その場合は、現在登録されている担当者だけを選択肢にします。
    */
    console.error(error);
    staffChoices = [];
    setMessage("職員一覧を取得できませんでした。", true);
  }
}

function normalizeStaffChoices(rawStaff) {
  return rawStaff
    .map(item => {
      if (typeof item === "string") {
        return item.trim();
      }

      return String(
        item.name ||
        item.staffName ||
        item.user ||
        item.label ||
        ""
      ).trim();
    })
    .filter(Boolean)
    .filter((name, index, array) => array.indexOf(name) === index)
    .sort((a, b) => a.localeCompare(b, "ja"));
}

/* =============================================================
   基本シフトの取得・初回作成
   ============================================================= */

async function loadCurrentWeek({ forceReload = false } = {}) {
  const weekMonday = document.getElementById("weekMonday").value;

  if (!weekMonday) return;

  openDetailShiftId = "";

  if (!forceReload) {
    const cached = getCachedWeek(weekMonday);

    if (cached) {
      currentWeekItems = cached.items;
      renderTable();
      updateCacheStatus(cached);
      setMessage("保存済みの基本シフトを表示しています。");
      return;
    }
  }

  setMessage("基本シフトを読み込んでいます。");

  try {
    const result = await jsonpRequest(
      "week-list",
      null,
      "shiftWeekListCallback",
      { weekMonday }
    );

    currentWeekItems = result.data || [];
    saveWeekCache(weekMonday, currentWeekItems);
    renderTable();
    updateCacheStatus(getCachedWeek(weekMonday));

    setMessage(
      currentWeekItems.length > 0
        ? "基本シフトを読み込みました。"
        : "この週の基本シフトはまだありません。"
    );
  } catch (error) {
    const cached = getCachedWeek(weekMonday);

    if (cached) {
      currentWeekItems = cached.items;
      renderTable();
      updateCacheStatus(cached);
      setMessage(
        "通信できなかったため、保存済みデータを表示しています。",
        true
      );
      return;
    }

    showApiError(error, "基本シフトの読み込みに失敗しました");
  }
}

async function createInitialWeek() {
  const weekMonday = document.getElementById("weekMonday").value;

  if (!weekMonday) {
    alert("対象週を選択してください。");
    return;
  }

  const confirmed = confirm(
    `${weekMonday}の週を、規定値から初回作成しますか？`
  );

  if (!confirmed) return;

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

    setMessage(result.message || "初回作成が完了しました。");

    /* 作成後は、必ずGASから再取得します。 */
    await loadCurrentWeek({ forceReload: true });
  } catch (error) {
    showApiError(error, "基本シフトの初回作成に失敗しました");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

/* =============================================================
   一覧表示
   ============================================================= */

function renderTable() {
  const tbody = document.getElementById("shiftWeekBody");
  const emptyArea = document.getElementById("emptyArea");
  const tableScroll = document.querySelector(".table-scroll");

  tbody.innerHTML = "";

  document.getElementById("recordCount").textContent =
    `${currentWeekItems.length}件`;

  if (currentWeekItems.length === 0) {
    tableScroll.classList.add("hidden");
    emptyArea.classList.remove("hidden");

    /* データがないときは上側スクロールバーも隠します。 */
    updateHorizontalScrollWidth();
    return;
  }

  tableScroll.classList.remove("hidden");
  emptyArea.classList.add("hidden");

  currentWeekItems.forEach(item => {
    tbody.appendChild(createMainRow(item));

    if (openDetailShiftId === item.shiftId) {
      tbody.appendChild(createDetailRow(item));
    }
  });

  /*
    行や詳細欄の描画が終わった後に、
    上側スクロールバーの横幅を表全体へ合わせます。
  */
  requestAnimationFrame(updateHorizontalScrollWidth);
}

function createMainRow(item) {
  const row = document.createElement("tr");
  row.className = "main-row";
  row.dataset.shiftId = item.shiftId;

  row.innerHTML = `
    <td>
      <button
        type="button"
        class="user-detail-button"
        data-shift-id="${escapeAttribute(item.shiftId)}"
      >
        ${escapeHtml(item.user)}
      </button>
    </td>

    <td class="center-cell">${escapeHtml(formatShortDate(item.date))}</td>
    <td class="center-cell">${escapeHtml(item.weekday)}</td>
    <td class="center-cell">${escapeHtml(item.startTime)}</td>
    <td class="center-cell">${escapeHtml(item.endTime)}</td>
    <td class="center-cell">${escapeHtml(item.service)}</td>
    <td class="center-cell">${escapeHtml(item.vehicle)}</td>
    <td class="content-cell" title="${escapeAttribute(item.support || item.content)}">
      ${escapeHtml(item.support || item.content)}
    </td>
    <td class="destination-cell" title="${escapeAttribute(item.destination)}">
      ${escapeHtml(item.destination)}
    </td>
    <td class="note-cell" title="${escapeAttribute(item.note)}">
      ${escapeHtml(item.note)}
    </td>
    <td>${createStaffSelect(item, "staff1")}</td>
    <td>${createStaffSelect(item, "staff2")}</td>
    <td>${createStaffSelect(item, "staff3")}</td>
    <td>${createStaffSelect(item, "staff4")}</td>
    <td class="center-cell">${escapeHtml(item.status)}</td>
    <td class="center-cell">${escapeHtml(item.publishStatus)}</td>
  `;

  row
    .querySelector(".user-detail-button")
    .addEventListener("click", () => toggleDetail(item.shiftId));

  row.querySelectorAll(".staff-select").forEach(select => {
    select.addEventListener("change", async event => {
      await saveStaffChange(
        item.shiftId,
        event.target.dataset.field,
        event.target.value
      );
    });
  });

  return row;
}

function createStaffSelect(item, fieldName) {
  const currentValue = String(item[fieldName] || "").trim();
  const choices = [...staffChoices];

  if (currentValue && !choices.includes(currentValue)) {
    choices.unshift(currentValue);
  }

  const options = ["", ...choices]
    .map(name => {
      const selected = name === currentValue ? " selected" : "";

      return (
        `<option value="${escapeAttribute(name)}"${selected}>` +
        `${escapeHtml(name)}</option>`
      );
    })
    .join("");

  return `
    <select
      class="staff-select"
      data-field="${escapeAttribute(fieldName)}"
      aria-label="${escapeAttribute(fieldName)}"
    >
      ${options}
    </select>
  `;
}

function toggleDetail(shiftId) {
  openDetailShiftId =
    openDetailShiftId === shiftId ? "" : shiftId;

  renderTable();
}

/* =============================================================
   詳細入力欄
   ============================================================= */

function createDetailRow(item) {
  const row = document.createElement("tr");
  row.className = "detail-row";

  const cell = document.createElement("td");
  cell.colSpan = 16;

  cell.innerHTML = `
    <div class="detail-panel">
      <div class="detail-header">
        <div class="detail-person">
          <span class="detail-user-name">${escapeHtml(item.user)}</span>
          <span class="detail-summary">
            ${escapeHtml(formatLongDate(item.date, item.weekday))}
            ${escapeHtml(item.startTime)}～${escapeHtml(item.endTime)}
          </span>
          <span class="detail-summary">${escapeHtml(item.service)}</span>
        </div>

        <div class="detail-actions">
          <button
            type="button"
            class="detail-save-button"
          >
            詳細を保存
          </button>

          <button
            type="button"
            class="detail-close-button"
          >
            閉じる
          </button>
        </div>
      </div>

      <div class="detail-row-one">
        ${createSelectField(
          "移動手段",
          "transport",
          item.transport,
          ["", "徒歩", "車", "電車", "バス", "タクシー", "その他"]
        )}

        ${createInputField("支援開始場所", "startPlace", item.startPlace)}
        ${createInputField("支援終了場所", "endPlace", item.endPlace)}
        ${createInputField("行き先", "destination", item.destination)}
        ${createInputField("待合せ場所", "meeting", item.meeting)}
        ${createInputField("合流情報", "meetingInfo", item.meetingInfo)}
        ${createInputField("予約情報", "reservationInfo", item.reservationInfo)}
      </div>

      <div class="detail-row-two">
        ${createTextareaField("支援内容", "support", item.support)}
        ${createTextareaField("簡易メモ", "simpleMemo", item.simpleMemo)}
        ${createTextareaField("詳細注意", "detailNote", item.detailNote)}
        ${createTextareaField("当日の指示", "instruction", item.instruction)}
      </div>
    </div>
  `;

  row.appendChild(cell);

  cell
    .querySelector(".detail-close-button")
    .addEventListener("click", () => {
      openDetailShiftId = "";
      renderTable();
    });

  cell
    .querySelector(".detail-save-button")
    .addEventListener("click", async event => {
      await saveDetail(item.shiftId, cell, event.currentTarget);
    });

  return row;
}

function createInputField(label, fieldName, value) {
  return `
    <div class="detail-field">
      <label>${escapeHtml(label)}</label>
      <input
        type="text"
        data-detail-field="${escapeAttribute(fieldName)}"
        value="${escapeAttribute(value)}"
      >
    </div>
  `;
}

function createTextareaField(label, fieldName, value) {
  return `
    <div class="detail-field">
      <label>${escapeHtml(label)}</label>
      <textarea
        rows="1"
        data-detail-field="${escapeAttribute(fieldName)}"
      >${escapeHtml(value)}</textarea>
    </div>
  `;
}

function createSelectField(label, fieldName, currentValue, choices) {
  const current = String(currentValue || "");

  const options = choices
    .map(choice => {
      const selected = choice === current ? " selected" : "";

      return (
        `<option value="${escapeAttribute(choice)}"${selected}>` +
        `${escapeHtml(choice)}</option>`
      );
    })
    .join("");

  return `
    <div class="detail-field">
      <label>${escapeHtml(label)}</label>
      <select data-detail-field="${escapeAttribute(fieldName)}">
        ${options}
      </select>
    </div>
  `;
}

/* =============================================================
   保存処理
   ============================================================= */

async function saveStaffChange(shiftId, fieldName, value) {
  try {
    await updateShiftWeek(shiftId, {
      [fieldName]: value
    });

    updateLocalItem(shiftId, {
      [fieldName]: value
    });

    setMessage("担当者を保存しました。");
  } catch (error) {
    showApiError(error, "担当者の保存に失敗しました");
    await loadCurrentWeek({ forceReload: true });
  }
}

async function saveDetail(shiftId, detailCell, saveButton) {
  const changes = {};

  detailCell
    .querySelectorAll("[data-detail-field]")
    .forEach(input => {
      changes[input.dataset.detailField] = input.value;
    });

  const originalText = saveButton.textContent;

  saveButton.disabled = true;
  saveButton.textContent = "保存中...";

  try {
    await updateShiftWeek(shiftId, changes);
    updateLocalItem(shiftId, changes);
    setMessage("詳細内容を保存しました。");
    renderTable();
  } catch (error) {
    showApiError(error, "詳細内容の保存に失敗しました");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = originalText;
  }
}

async function updateShiftWeek(shiftId, changes) {
  return jsonpRequest(
    "week-update",
    {
      shiftId,
      changes
    },
    "shiftWeekUpdateCallback"
  );
}

function updateLocalItem(shiftId, changes) {
  const target = currentWeekItems.find(
    item => item.shiftId === shiftId
  );

  if (!target) return;

  Object.assign(target, changes);

  const weekMonday = document.getElementById("weekMonday").value;
  saveWeekCache(weekMonday, currentWeekItems);
  updateCacheStatus(getCachedWeek(weekMonday));
}

/* =============================================================
   表示補助
   ============================================================= */

function formatShortDate(value) {
  const date = parseLocalDate(value);

  if (!date) return value || "";

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatLongDate(value, weekday) {
  const date = parseLocalDate(value);

  if (!date) return value || "";

  return (
    `${date.getFullYear()}年` +
    `${date.getMonth() + 1}月` +
    `${date.getDate()}日` +
    `（${weekday || ""}）`
  );
}

function setMessage(message, isError = false) {
  const area = document.getElementById("messageArea");

  area.textContent = message;
  area.className =
    "message-area" + (isError ? " error" : "");
}

function showApiError(error, heading) {
  console.error(error);

  const message = error && error.message
    ? error.message
    : "不明なエラーが発生しました";

  const errorId = error && error.errorId
    ? String(error.errorId)
    : "";

  setMessage(
    heading +
    "：" +
    message +
    (errorId ? `　エラー番号：${errorId}` : ""),
    true
  );

  alert(
    heading +
    "\n\n" +
    message +
    (errorId ? `\n\nエラー番号：${errorId}` : "")
  );
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
      `${SHIFT_WEEK_API_URL}?${parameters.toString()}`;

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

/* =============================================================
   HTMLエスケープ
   ============================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
