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

/* 対象週エリアの折りたたみ状態を端末へ保存するキーです。 */
const WEEK_CONTROL_COLLAPSE_KEY = "shiftWeekControlsCollapsed";

let currentWeekItems = [];
let staffChoices = [];
let openDetailShiftId = "";

/* 現在選択している担当者フィルターです。空欄は全員です。 */
let selectedStaffFilter = "";

/* 現在選択している曜日フィルターです。空欄は全曜日です。 */
let selectedWeekdayFilter = "";

/* 一覧の並び替え */
let selectedSortOrder = "dateTime";

/*
  true のとき、各一覧行の下へ
  「支援内容・当日の指示・詳細注意・簡易メモ」を表示します。
*/
let instructionRowsVisible = false;

/* true のとき、対象週の大きな操作エリアを折りたたみます。 */
let weekControlsCollapsed = false;

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

  /* 前回の折りたたみ状態を復元します。 */
  restoreWeekControlState();

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
    .getElementById("collapseWeekControlsButton")
    .addEventListener("click", () => {
      setWeekControlsCollapsed(true);
    });

  document
    .getElementById("expandWeekControlsButton")
    .addEventListener("click", () => {
      setWeekControlsCollapsed(false);
    });

  document
    .getElementById("staffFilter")
    .addEventListener("change", event => {
      selectedStaffFilter = event.target.value;
      openDetailShiftId = "";
      renderTable();
    });

  document
    .getElementById("weekdayFilter")
    .addEventListener("change", event => {
      selectedWeekdayFilter = event.target.value;
      openDetailShiftId = "";
      renderTable();
    });

  document
    .getElementById("sortOrder")
    .addEventListener("change", event => {
      selectedSortOrder = event.target.value || "dateTime";
      renderTable();
    });

  document
    .getElementById("closeDetailButton")
    .addEventListener("click", closeShiftDetailModal);

  document
    .getElementById("cancelDetailButton")
    .addEventListener("click", closeShiftDetailModal);

  document
    .querySelector("#shiftDetailModal .shift-modal-backdrop")
    .addEventListener("click", closeShiftDetailModal);

  document
    .getElementById("shiftDetailForm")
    .addEventListener("submit", saveShiftDetailModal);

  document
    .getElementById("detailDate")
    .addEventListener("change", syncDetailWeekdayFromDate);

  document
    .getElementById("instructionToggleButton")
    .addEventListener("click", async () => {
      await toggleInstructionRows();
    });

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
	  .getElementById("newShiftButton")
	  .addEventListener("click", openNewShiftModal);

	document
	  .getElementById("closeNewShiftButton")
	  .addEventListener("click", closeNewShiftModal);

	document
	  .getElementById("cancelNewShiftButton")
	  .addEventListener("click", closeNewShiftModal);

	document
	  .querySelector("#newShiftModal .shift-modal-backdrop")
	  .addEventListener("click", closeNewShiftModal);

	document
	  .getElementById("newShiftForm")
	  .addEventListener("submit", saveNewShiftFromForm);
  
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
   対象週エリアの折りたたみ
   ============================================================= */

/**
 * 保存されている折りたたみ状態を復元します。
 */
function restoreWeekControlState() {
  weekControlsCollapsed =
    localStorage.getItem(WEEK_CONTROL_COLLAPSE_KEY) === "true";

  applyWeekControlState();
}


/**
 * 折りたたみ状態を変更して端末へ保存します。
 */
function setWeekControlsCollapsed(collapsed) {
  weekControlsCollapsed = Boolean(collapsed);

  localStorage.setItem(
    WEEK_CONTROL_COLLAPSE_KEY,
    String(weekControlsCollapsed)
  );

  applyWeekControlState();
}


/**
 * 大きな対象週エリアと小さな表示バーを切り替えます。
 */
function applyWeekControlState() {
  const controlCard =
    document.getElementById("weekControlCard");

  const collapsedBar =
    document.getElementById("collapsedWeekBar");

  if (!controlCard || !collapsedBar) return;

  controlCard.classList.toggle(
    "hidden",
    weekControlsCollapsed
  );

  collapsedBar.classList.toggle(
    "hidden",
    !weekControlsCollapsed
  );

  document.body.classList.toggle(
    "week-controls-collapsed",
    weekControlsCollapsed
  );

  /*
    一覧の高さが変わるため、
    上側横スクロールバーの幅も再計算します。
  */
  requestAnimationFrame(() => {
    updateHorizontalScrollWidth();
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

  const rangeText =
    `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日` +
    " ～ " +
    `${sunday.getFullYear()}年${sunday.getMonth() + 1}月${sunday.getDate()}日`;

  document.getElementById("weekRange").textContent = rangeText;
  document.getElementById("collapsedWeekRange").textContent = rangeText;
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
    updateStaffFilterOptions();
  } catch (error) {
    /*
      職員一覧を取得できない場合も一覧表示自体は続けます。
      その場合は、現在登録されている担当者だけを選択肢にします。
    */
    console.error(error);
    staffChoices = [];
    updateStaffFilterOptions();
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


/**
 * 職員一覧から担当者フィルターの選択肢を作ります。
 */
function updateStaffFilterOptions() {
  const select = document.getElementById("staffFilter");

  if (!select) return;

  const currentValue = selectedStaffFilter || select.value;
  select.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "担当者：全員";
  select.appendChild(allOption);

  staffChoices.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });

  if (currentValue && staffChoices.includes(currentValue)) {
    select.value = currentValue;
    selectedStaffFilter = currentValue;
  } else {
    select.value = "";
    selectedStaffFilter = "";
  }
}


/**
 * 主担当・副担当・担当3・担当4のどこかに、
 * 選択した職員名があるか確認します。
 */
function matchesStaffFilter(item) {
  if (!selectedStaffFilter) return true;

  return [
    item.staff1,
    item.staff2,
    item.staff3,
    item.staff4
  ].some(name => {
    return String(name || "").trim() === selectedStaffFilter;
  });
}


/**
 * 選択した曜日と基本シフトの曜日が一致するか確認します。
 */
function matchesWeekdayFilter(item) {
  if (!selectedWeekdayFilter) return true;

  return String(item.weekday || "").trim() === selectedWeekdayFilter;
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

function getSortedDisplayItems_() {
  const items =
    currentWeekItems
      .filter(item =>
        matchesStaffFilter(item) &&
        matchesWeekdayFilter(item)
      )
      .slice();

  const dateKey = item =>
    String(item.date || "");

  const timeKey = item =>
    String(item.startTime || "");

  items.sort((a, b) => {
    if (selectedSortOrder === "dateStaffTime") {
      return (
        dateKey(a).localeCompare(dateKey(b)) ||
        String(a.staff1 || "").localeCompare(
          String(b.staff1 || ""),
          "ja"
        ) ||
        timeKey(a).localeCompare(timeKey(b))
      );
    }

    if (selectedSortOrder === "userDateTime") {
      return (
        String(a.user || "").localeCompare(
          String(b.user || ""),
          "ja"
        ) ||
        dateKey(a).localeCompare(dateKey(b)) ||
        timeKey(a).localeCompare(timeKey(b))
      );
    }

    return (
      dateKey(a).localeCompare(dateKey(b)) ||
      timeKey(a).localeCompare(timeKey(b))
    );
  });

  return items;
}


function renderTable() {
  const tbody =
    document.getElementById("shiftWeekBody");

  const emptyArea =
    document.getElementById("emptyArea");

  const tableScroll =
    document.querySelector(".table-scroll");

  tbody.innerHTML = "";

  const displayItems =
    getSortedDisplayItems_();

  document
    .getElementById("recordCount")
    .textContent =
      `${displayItems.length}件`;

  if (displayItems.length === 0) {
    tableScroll.classList.add("hidden");
    emptyArea.classList.remove("hidden");

    if (
      selectedStaffFilter &&
      selectedWeekdayFilter
    ) {
      emptyArea.textContent =
        `${selectedStaffFilter}さんの` +
        `${selectedWeekdayFilter}曜日の基本シフトはありません。`;
    } else if (selectedStaffFilter) {
      emptyArea.textContent =
        `${selectedStaffFilter}さんが担当する基本シフトはありません。`;
    } else if (selectedWeekdayFilter) {
      emptyArea.textContent =
        `${selectedWeekdayFilter}曜日の基本シフトはありません。`;
    } else {
      emptyArea.textContent =
        "この週の基本シフトはまだありません。";
    }

    updateInstructionToggleButton();
    updateHorizontalScrollWidth();
    return;
  }

  tableScroll.classList.remove("hidden");
  emptyArea.classList.add("hidden");

  displayItems.forEach(item => {
    tbody.appendChild(
      createMainRow(item)
    );

    /*
     * 既存の「指示」一括表示機能は残します。
     * 詳細編集はポップアップへ移しました。
     */
    if (instructionRowsVisible) {
      tbody.appendChild(
        createInstructionRow(item)
      );
    }
  });

  updateInstructionToggleButton();

  requestAnimationFrame(
    updateHorizontalScrollWidth
  );
}


function createMainRow(item) {
  const row =
    document.createElement("tr");

  row.className = "main-row";
  row.dataset.shiftId =
    item.shiftId;

  const hasPaidTransport =
    [
      item.paidGoTime,
      item.paidGoFrom,
      item.paidGoDriverNo,
      item.paidGoVehicle,
      item.paidReturnTime,
      item.paidReturnFrom,
      item.paidReturnDriverNo,
      item.paidReturnVehicle,
      item.vehicle
    ].some(value => String(value || "").trim());

  const paid =
    hasPaidTransport
      ? "有"
      : "";

  const vehicleSummaryValues =
    [
      item.paidGoVehicle,
      item.paidReturnVehicle,
      item.pickupVehicle,
      item.vehicle
    ]
      .map(value => String(value || "").trim())
      .filter(Boolean);

  const vehicleSummary =
    [...new Set(vehicleSummaryValues)]
      .join(" / ");

  row.innerHTML = `
    <td class="center-cell">
      ${escapeHtml(formatShortDate(item.date))}
    </td>

    <td class="center-cell weekday-cell">
      ${escapeHtml(item.weekday)}
    </td>

    <td class="center-cell time-cell">
      ${escapeHtml(item.startTime)}
      <span class="time-separator">－</span>
      ${escapeHtml(item.endTime)}
    </td>

    <td class="user-cell">
      ${escapeHtml(item.user)}
    </td>

    <td class="service-cell">
      ${escapeHtml(item.service)}
    </td>

    <td
      class="content-cell"
      title="${escapeAttribute(item.support || item.content)}"
    >
      ${escapeHtml(item.support || item.content)}
    </td>

    <td>${createStaffSelect(item, "staff1")}</td>
    <td>${createStaffSelect(item, "staff2")}</td>
    <td>${createStaffSelect(item, "staff3")}</td>
    <td>${createStaffSelect(item, "staff4")}</td>

    <td class="center-cell paid-cell">
      ${paid}
    </td>

    <td
      class="vehicle-cell"
      title="${escapeAttribute(vehicleSummary)}"
    >
      ${escapeHtml(vehicleSummary)}
    </td>

    <td
      class="destination-cell"
      title="${escapeAttribute(item.destination)}"
    >
      ${escapeHtml(item.destination)}
    </td>

    <td class="center-cell status-cell">
      ${escapeHtml(item.status)}
    </td>

    <td class="center-cell detail-cell">
      <button
        type="button"
        class="detail-open-button"
        data-shift-id="${escapeAttribute(item.shiftId)}"
      >
        詳細
      </button>
    </td>
  `;

  row
    .querySelector(".detail-open-button")
    .addEventListener("click", () => {
      openShiftDetailModal(
        item.shiftId
      );
    });

  row
    .querySelectorAll(".staff-select")
    .forEach(select => {
      select.addEventListener(
        "change",
        async event => {
          await saveStaffChange(
            item.shiftId,
            event.target.dataset.field,
            event.target.value
          );
        }
      );
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

/**
 * 見出しの「指示」ボタンで、
 * 各利用者の2段目を一斉に表示・非表示にします。
 */
async function toggleInstructionRows() {
  if (instructionRowsVisible) {
    const saved = await saveChangedInstructionRows();

    if (!saved) return;
  }

  instructionRowsVisible = !instructionRowsVisible;
  renderTable();
}


/**
 * 「指示」ボタンの表示状態を更新します。
 */
function updateInstructionToggleButton() {
  const button = document.getElementById("instructionToggleButton");

  if (!button) return;

  button.classList.toggle("active", instructionRowsVisible);
  button.setAttribute(
    "aria-pressed",
    instructionRowsVisible ? "true" : "false"
  );
  button.textContent = instructionRowsVisible
    ? "指示を閉じる"
    : "指示";
}


async function toggleDetail(shiftId) {
  openShiftDetailModal(shiftId);
}



/* =============================================================
   詳細ポップアップ
   ============================================================= */

function getShiftItemById_(shiftId) {
  return currentWeekItems.find(
    item =>
      String(item.shiftId || "") ===
      String(shiftId || "")
  ) || null;
}


function fillStaffSelect_(
  select,
  currentValue
) {
  select.innerHTML = "";

  const choices =
    [...staffChoices];

  if (
    currentValue &&
    !choices.includes(currentValue)
  ) {
    choices.unshift(currentValue);
  }

  ["", ...choices].forEach(name => {
    const option =
      document.createElement("option");

    option.value = name;
    option.textContent =
      name || "未定";

    select.appendChild(option);
  });

  select.value =
    currentValue || "";
}


function openShiftDetailModal(
  shiftId
) {
  const item =
    getShiftItemById_(shiftId);

  if (!item) return;

  openDetailShiftId =
    shiftId;

  document
    .getElementById("detailShiftId")
    .value =
      item.shiftId || "";

  document
    .getElementById("detailDate")
    .value =
      item.date || "";

  document
    .getElementById("detailWeekday")
    .value =
      item.weekday || "";

  document
    .getElementById("detailStartTime")
    .value =
      item.startTime || "";

  document
    .getElementById("detailEndTime")
    .value =
      item.endTime || "";

  document
    .getElementById("detailUser")
    .value =
      item.user || "";

  document
    .getElementById("detailService")
    .value =
      item.service || "";

  document
    .getElementById("detailContent")
    .value =
      item.content ||
      item.support ||
      "";

  fillStaffSelect_(
    document.getElementById("detailStaff1"),
    item.staff1 || ""
  );

  fillStaffSelect_(
    document.getElementById("detailStaff2"),
    item.staff2 || ""
  );

  fillStaffSelect_(
    document.getElementById("detailStaff3"),
    item.staff3 || ""
  );

  fillStaffSelect_(
    document.getElementById("detailStaff4"),
    item.staff4 || ""
  );

  document
    .getElementById("detailTransport")
    .value =
      item.transport || "";

  document
    .getElementById("detailDestination")
    .value =
      item.destination || "";

  document
    .getElementById("detailMeeting")
    .value =
      item.meeting || "";

  document
    .getElementById("detailMeetingPoint")
    .value =
      item.meetingPoint ||
      item.meetingInfo ||
      "";

  document.getElementById("detailPaidGoTime").value =
    item.paidGoTime || "";
  document.getElementById("detailPaidGoFrom").value =
    item.paidGoFrom || "";
  document.getElementById("detailPaidGoDriverNo").value =
    String(item.paidGoDriverNo || "");
  document.getElementById("detailPaidGoVehicle").value =
    item.paidGoVehicle || "";

  document.getElementById("detailPaidReturnTime").value =
    item.paidReturnTime || "";
  document.getElementById("detailPaidReturnFrom").value =
    item.paidReturnFrom || "";
  document.getElementById("detailPaidReturnDriverNo").value =
    String(item.paidReturnDriverNo || "");
  document.getElementById("detailPaidReturnVehicle").value =
    item.paidReturnVehicle || "";

  document.getElementById("detailPickupTime").value =
    item.pickupTime || "";
  document.getElementById("detailPickupFrom").value =
    item.pickupFrom || "";
  document.getElementById("detailPickupTo").value =
    item.pickupTo || "";
  document.getElementById("detailPickupDriverNo").value =
    String(item.pickupDriverNo || "");
  document.getElementById("detailPickupVehicle").value =
    item.pickupVehicle || "";

  document
    .getElementById("detailSimpleMemo")
    .value =
      item.simpleMemo || "";

  document
    .getElementById("detailNote")
    .value =
      item.detailNote || "";

  document
    .getElementById("detailRemarks")
    .value =
      item.note || "";

  document
    .getElementById("shiftDetailModal")
    .classList.remove("hidden");

  document.body.classList.add(
    "shift-modal-open"
  );
}


function closeShiftDetailModal() {
  document
    .getElementById("shiftDetailModal")
    .classList.add("hidden");

  document.body.classList.remove(
    "shift-modal-open"
  );

  openDetailShiftId = "";
}


function syncDetailWeekdayFromDate() {
  const date =
    parseLocalDate(
      document
        .getElementById("detailDate")
        .value
    );

  if (!date) return;

  const labels =
    ["日", "月", "火", "水", "木", "金", "土"];

  document
    .getElementById("detailWeekday")
    .value =
      labels[date.getDay()];
}



async function saveShiftDetailModal(
  event
) {
  event.preventDefault();

  const shiftId =
    document
      .getElementById("detailShiftId")
      .value;

  const item =
    getShiftItemById_(shiftId);

  if (!item) {
    alert(
      "更新対象のシフトが見つかりません。"
    );
    return;
  }

  const changes = {
    date:
      document.getElementById("detailDate").value,
    weekday:
      document.getElementById("detailWeekday").value,
    startTime:
      document.getElementById("detailStartTime").value,
    endTime:
      document.getElementById("detailEndTime").value,
    user:
      document.getElementById("detailUser").value.trim(),
    service:
      document.getElementById("detailService").value.trim(),
    content:
      document.getElementById("detailContent").value.trim(),
    staff1:
      document.getElementById("detailStaff1").value,
    staff2:
      document.getElementById("detailStaff2").value,
    staff3:
      document.getElementById("detailStaff3").value,
    staff4:
      document.getElementById("detailStaff4").value,
    transport:
      document.getElementById("detailTransport").value,
    destination:
      document.getElementById("detailDestination").value.trim(),
    meeting:
      document.getElementById("detailMeeting").value.trim(),
    meetingPoint:
      document.getElementById("detailMeetingPoint").value.trim(),

    paidGoTime:
      document.getElementById("detailPaidGoTime").value,
    paidGoFrom:
      document.getElementById("detailPaidGoFrom").value.trim(),
    paidGoDriverNo:
      document.getElementById("detailPaidGoDriverNo").value,
    paidGoVehicle:
      document.getElementById("detailPaidGoVehicle").value.trim(),

    paidReturnTime:
      document.getElementById("detailPaidReturnTime").value,
    paidReturnFrom:
      document.getElementById("detailPaidReturnFrom").value.trim(),
    paidReturnDriverNo:
      document.getElementById("detailPaidReturnDriverNo").value,
    paidReturnVehicle:
      document.getElementById("detailPaidReturnVehicle").value.trim(),

    pickupTime:
      document.getElementById("detailPickupTime").value,
    pickupFrom:
      document.getElementById("detailPickupFrom").value.trim(),
    pickupTo:
      document.getElementById("detailPickupTo").value.trim(),
    pickupDriverNo:
      document.getElementById("detailPickupDriverNo").value,
    pickupVehicle:
      document.getElementById("detailPickupVehicle").value.trim(),
    simpleMemo:
      document.getElementById("detailSimpleMemo").value.trim(),
    detailNote:
      document.getElementById("detailNote").value.trim(),
    note:
      document.getElementById("detailRemarks").value.trim()
  };

  const actualChanges = {};

  Object.entries(changes).forEach(
    ([field, value]) => {
      const oldValue =
        String(item[field] ?? "");

      if (
        String(value ?? "") !==
        oldValue
      ) {
        actualChanges[field] =
          value;
      }
    }
  );

  if (
    Object.keys(actualChanges)
      .length === 0
  ) {
    closeShiftDetailModal();
    return;
  }

  const saveButton =
    document.getElementById(
      "saveDetailButton"
    );

  const originalText =
    saveButton.textContent;

  saveButton.disabled = true;
  saveButton.textContent =
    "保存中...";

  try {
    await updateShiftWeek(
      shiftId,
      actualChanges
    );

    updateLocalItem(
      shiftId,
      actualChanges
    );

    setMessage(
      "基本シフトを保存しました。"
    );

    closeShiftDetailModal();
    renderTable();

  } catch (error) {
    showApiError(
      error,
      "基本シフトの保存に失敗しました"
    );

  } finally {
    saveButton.disabled = false;
    saveButton.textContent =
      originalText;
  }
}


/* =============================================================
   詳細入力欄
   ============================================================= */

function createDetailRow(item) {
  const row = document.createElement("tr");
  row.className = "detail-row";
  row.dataset.shiftId = item.shiftId;

  const cell = document.createElement("td");
  cell.colSpan = 15;

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
        ${createTextareaField("当日の指示", "instruction", item.instruction)}
        ${createTextareaField("詳細注意", "detailNote", item.detailNote)}
        ${createTextareaField("簡易メモ", "simpleMemo", item.simpleMemo)}
      </div>
    </div>
  `;

  row.appendChild(cell);

  return row;
}

/**
 * 見出しの「指示」ボタンを押したときに、
 * 各利用者の一覧行の直下へ表示する入力欄を作ります。
 */
function createInstructionRow(item) {
  const row = document.createElement("tr");
  row.className = "instruction-row";
  row.dataset.shiftId = item.shiftId;

  const cell = document.createElement("td");
  cell.colSpan = 15;

  cell.innerHTML = `
    <div class="instruction-panel">
      <div class="instruction-row-layout">
        <div
          class="instruction-flow-icon"
          aria-hidden="true"
          title="この行の指示入力"
        >
          <svg
            viewBox="0 0 56 40"
            class="instruction-flow-svg"
            role="img"
            aria-hidden="true"
          >
            <rect
              x="1.5"
              y="1.5"
              width="53"
              height="37"
              rx="10"
              fill="#f4fff7"
              stroke="#cfe0d4"
              stroke-width="1.5"
            ></rect>

            <path
              d="M13 8 V31"
              fill="none"
              stroke="#27a857"
              stroke-width="4"
              stroke-linecap="round"
            ></path>

            <path
              d="M13 20 H27"
              fill="none"
              stroke="#ff9f43"
              stroke-width="4"
              stroke-linecap="round"
            ></path>

            <path
              d="M23 15.5 L30 20 L23 24.5"
              fill="none"
              stroke="#ff9f43"
              stroke-width="4"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>

            <path
              d="M13 27 H34"
              fill="none"
              stroke="#ff7a59"
              stroke-width="4"
              stroke-linecap="round"
            ></path>

            <path
              d="M30 22.5 L37 27 L30 31.5"
              fill="none"
              stroke="#ff7a59"
              stroke-width="4"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
          </svg>
        </div>

        <div class="instruction-row-fields">
          ${createTextareaField("支援内容", "support", item.support)}
          ${createTextareaField("当日の指示", "instruction", item.instruction)}
          ${createTextareaField("詳細注意", "detailNote", item.detailNote)}
          ${createTextareaField("簡易メモ", "simpleMemo", item.simpleMemo)}
        </div>

      </div>
    </div>
  `;

  row.appendChild(cell);

  return row;
}


/**
 * 指示表示で編集した4項目を保存します。
 */
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

/**
 * 表示中の入力値と元データを比較し、
 * 変更された項目だけを返します。
 */
function collectChangedFields(container, item) {
  const changes = {};

  container
    .querySelectorAll("[data-detail-field]")
    .forEach(input => {
      const fieldName = input.dataset.detailField;
      const newValue = String(input.value ?? "");
      const oldValue = String(item[fieldName] ?? "");

      if (newValue !== oldValue) {
        changes[fieldName] = newValue;
      }
    });

  return changes;
}


function hasChanges(changes) {
  return Object.keys(changes).length > 0;
}


/**
 * 現在開いている利用者の詳細を、
 * 変更がある場合だけ保存します。
 */
async function saveOpenDetailIfChanged() {
  if (!openDetailShiftId) return true;

  const detailRow = Array.from(
    document.querySelectorAll(".detail-row[data-shift-id]")
  ).find(row => row.dataset.shiftId === openDetailShiftId);

  const item = currentWeekItems.find(
    currentItem => currentItem.shiftId === openDetailShiftId
  );

  if (!detailRow || !item) return true;

  const changes = collectChangedFields(detailRow, item);

  if (!hasChanges(changes)) return true;

  try {
    setMessage("変更した詳細内容を保存しています。");

    await updateShiftWeek(openDetailShiftId, changes);
    updateLocalItem(openDetailShiftId, changes);

    setMessage("変更した詳細内容を保存しました。");
    return true;
  } catch (error) {
    showApiError(error, "詳細内容の保存に失敗しました");
    return false;
  }
}


/**
 * 指示欄を閉じる前に、
 * 変更された利用者だけを順番に保存します。
 */
async function saveChangedInstructionRows() {
  const changedRows = [];

  document
    .querySelectorAll(".instruction-row[data-shift-id]")
    .forEach(row => {
      const shiftId = row.dataset.shiftId;

      const item = currentWeekItems.find(
        currentItem => currentItem.shiftId === shiftId
      );

      if (!item) return;

      const changes = collectChangedFields(row, item);

      if (hasChanges(changes)) {
        changedRows.push({ shiftId, changes });
      }
    });

  if (changedRows.length === 0) return true;

  const button = document.getElementById("instructionToggleButton");
  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = "保存中...";

  try {
    for (const rowData of changedRows) {
      await updateShiftWeek(
        rowData.shiftId,
        rowData.changes
      );

      updateLocalItem(
        rowData.shiftId,
        rowData.changes
      );
    }

    setMessage(`${changedRows.length}件の変更を保存しました。`);
    return true;
  } catch (error) {
    showApiError(error, "指示内容の保存に失敗しました");
    return false;
  } finally {
    button.disabled = false;
    button.textContent = originalText;
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

    console.log(
      "基本シフトGAS URL:",
      script.src
    );

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

/* =============================================================
   基本シフトの個別新規追加
   ============================================================= */

/**
 * 新規シフト入力画面を開きます。
 */
function openNewShiftModal() {
  const modal =
    document.getElementById("newShiftModal");

  const form =
    document.getElementById("newShiftForm");

  if (!modal || !form) {
    return;
  }

  form.reset();

  setNewShiftFormMessage("");

  setNewShiftStaffOptions();
  setNewShiftUserAndServiceOptions();

  /*
   * 初期日付は、表示している週の月曜日にします。
   */
  const weekMonday =
    document.getElementById("weekMonday").value;

  document.getElementById("newShiftDate").value =
    weekMonday || "";

  modal.classList.remove("hidden");
  document.body.classList.add("shift-modal-open");

  document
    .getElementById("newShiftUser")
    .focus();
}


/**
 * 新規シフト入力画面を閉じます。
 */
function closeNewShiftModal() {
  const modal =
    document.getElementById("newShiftModal");

  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
  document.body.classList.remove("shift-modal-open");

  setNewShiftFormMessage("");
}


/**
 * 主担当から担当4までの選択肢を設定します。
 */
function setNewShiftStaffOptions() {
  [
    "newShiftStaff1",
    "newShiftStaff2",
    "newShiftStaff3",
    "newShiftStaff4"
  ].forEach(selectId => {
    const select =
      document.getElementById(selectId);

    if (!select) {
      return;
    }

    select.innerHTML = "";

    const blankOption =
      document.createElement("option");

    blankOption.value = "";
    blankOption.textContent = "未定";

    select.appendChild(blankOption);

    staffChoices.forEach(name => {
      const option =
        document.createElement("option");

      option.value = name;
      option.textContent = name;

      select.appendChild(option);
    });
  });
}


/**
 * 現在読み込んでいる基本シフトから、
 * 利用者とサービスの入力候補を作ります。
 */
function setNewShiftUserAndServiceOptions() {
  const users = [
    ...new Set(
      currentWeekItems
        .map(item =>
          String(item.user || "").trim()
        )
        .filter(Boolean)
    )
  ].sort((a, b) =>
    a.localeCompare(b, "ja")
  );

  const services = [
    ...new Set(
      currentWeekItems
        .map(item =>
          String(item.service || "").trim()
        )
        .filter(Boolean)
    )
  ].sort((a, b) =>
    a.localeCompare(b, "ja")
  );

  setNewShiftDataListOptions(
    "newShiftUserList",
    users
  );

  setNewShiftDataListOptions(
    "newShiftServiceList",
    services
  );
}


/**
 * datalistへ候補を設定します。
 */
function setNewShiftDataListOptions(
  listId,
  values
) {
  const list =
    document.getElementById(listId);

  if (!list) {
    return;
  }

  list.innerHTML = "";

  values.forEach(value => {
    const option =
      document.createElement("option");

    option.value = value;
    list.appendChild(option);
  });
}


/**
 * 入力した新規シフトをGASへ送信します。
 */
async function saveNewShiftFromForm(event) {
  event.preventDefault();

  const form =
    document.getElementById("newShiftForm");

  const saveButton =
    document.getElementById("saveNewShiftButton");

  if (!form || !saveButton) {
    return;
  }

  if (!form.reportValidity()) {
    return;
  }

  const data =
    getNewShiftFormData();

  const validationMessage =
    validateNewShiftFormData(data);

  if (validationMessage) {
    setNewShiftFormMessage(
      validationMessage,
      true
    );
    return;
  }

  const confirmed = confirm(
    [
      "次の内容で新しい基本シフトを登録します。",
      "",
      data.user,
      data.date,
      data.startTime + "～" + data.endTime,
      data.service,
      "",
      "依頼情報にも同時に登録されます。",
      "シフト規定値には登録されません。"
    ].join("\n")
  );

  if (!confirmed) {
    return;
  }

  const originalText =
    saveButton.textContent;

  saveButton.disabled = true;
  saveButton.textContent = "登録中...";

  setNewShiftFormMessage(
    "新しい基本シフトを登録しています。"
  );

  try {
    const result =
      await jsonpRequest(
        "week-create-with-request",
        {
          data: data
        },
        "shiftWeekDirectCreateCallback"
      );

    setMessage(
      result.message ||
      "新しい基本シフトを登録しました。"
    );

    closeNewShiftModal();

    /*
     * 登録後は端末保存ではなく、
     * GASから最新データを再取得します。
     */
    await loadCurrentWeek({
      forceReload: true
    });

  } catch (error) {
    console.error(error);

    const message =
      error && error.message
        ? error.message
        : "新規登録に失敗しました";

    setNewShiftFormMessage(
      message +
      (
        error && error.errorId
          ? "　エラー番号：" + error.errorId
          : ""
      ),
      true
    );

  } finally {
    saveButton.disabled = false;
    saveButton.textContent =
      originalText;
  }
}


/**
 * 入力画面から登録内容を取得します。
 */
function getNewShiftFormData() {
  return {
    weekMonday:
      document
        .getElementById("weekMonday")
        .value,

    user:
      getNewShiftInputValue(
        "newShiftUser"
      ),

    date:
      getNewShiftInputValue(
        "newShiftDate"
      ),

    startTime:
      getNewShiftInputValue(
        "newShiftStartTime"
      ),

    endTime:
      getNewShiftInputValue(
        "newShiftEndTime"
      ),

    service:
      getNewShiftInputValue(
        "newShiftService"
      ),

    vehicle:
      getNewShiftInputValue(
        "newShiftVehicle"
      ),

    staff1:
      getNewShiftInputValue(
        "newShiftStaff1"
      ),

    staff2:
      getNewShiftInputValue(
        "newShiftStaff2"
      ),

    staff3:
      getNewShiftInputValue(
        "newShiftStaff3"
      ),

    staff4:
      getNewShiftInputValue(
        "newShiftStaff4"
      ),

    destination:
      getNewShiftInputValue(
        "newShiftDestination"
      ),

    meeting:
      getNewShiftInputValue(
        "newShiftMeeting"
      ),

    transport:
      getNewShiftInputValue(
        "newShiftTransport"
      ),

    startPlace:
      getNewShiftInputValue(
        "newShiftStartPlace"
      ),

    endPlace:
      getNewShiftInputValue(
        "newShiftEndPlace"
      ),

    meetingInfo:
      getNewShiftInputValue(
        "newShiftMeetingInfo"
      ),

    reservationInfo:
      getNewShiftInputValue(
        "newShiftReservationInfo"
      ),

    support:
      getNewShiftInputValue(
        "newShiftSupport"
      ),

    instruction:
      getNewShiftInputValue(
        "newShiftInstruction"
      ),

    detailNote:
      getNewShiftInputValue(
        "newShiftDetailNote"
      ),

    simpleMemo:
      getNewShiftInputValue(
        "newShiftSimpleMemo"
      ),

    note:
      getNewShiftInputValue(
        "newShiftNote"
      )
  };
}


/**
 * 指定した入力欄の値を取得します。
 */
function getNewShiftInputValue(id) {
  const element =
    document.getElementById(id);

  return element
    ? String(element.value || "").trim()
    : "";
}


/**
 * ブラウザ側でも必須内容を確認します。
 */
function validateNewShiftFormData(data) {
  if (!data.user) {
    return "利用者を入力してください。";
  }

  if (!data.date) {
    return "日付を入力してください。";
  }

  if (!data.startTime) {
    return "開始時刻を入力してください。";
  }

  if (!data.endTime) {
    return "終了時刻を入力してください。";
  }

  if (!data.service) {
    return "サービスを入力してください。";
  }

  if (data.endTime <= data.startTime) {
    return "終了時刻は開始時刻より後にしてください。";
  }

  const date =
    parseLocalDate(data.date);

  const weekMonday =
    parseLocalDate(data.weekMonday);

  if (!date || !weekMonday) {
    return "日付を確認してください。";
  }

  const weekSunday =
    addDays(weekMonday, 6);

  if (
    date.getTime() <
      weekMonday.getTime() ||
    date.getTime() >
      weekSunday.getTime()
  ) {
    return (
      "日付は、現在表示している週の" +
      "月曜日から日曜日の範囲で入力してください。"
    );
  }

  return "";
}


/**
 * 新規登録画面内のメッセージを表示します。
 */
function setNewShiftFormMessage(
  message,
  isError = false
) {
  const area =
    document.getElementById(
      "newShiftFormMessage"
    );

  if (!area) {
    return;
  }

  area.textContent =
    message || "";

  area.className =
    "new-shift-form-message" +
    (
      isError
        ? " error"
        : ""
    ) +
    (
      message
        ? ""
        : " hidden"
    );
}

