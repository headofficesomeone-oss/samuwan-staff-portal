/**
 * =============================================================
 * 基本シフト表 画面処理
 * =============================================================
 *
 * このファイルでは、主に次の処理を行います。
 *
 * 1. 起動時に翌週を初期表示する
 * 2. 前の週・次の週・今週へ移動する
 * 3. 基本シフトをGASから取得する
 * 4. 取得した基本シフトを表に表示する
 * 5. 規定値から基本シフトを初回作成する
 * 6. 最大3週分をブラウザへ保存する
 * 7. 保存済みの週は、原則として通信せずに表示する
 *
 * ブラウザ保存には localStorage を使用します。
 * 同じ端末・同じブラウザであれば、画面を閉じても保持されます。
 */

/* =============================================================
   GAS WebアプリURL
============================================================= */
const SHIFT_WEEK_API_URL =
  "https://script.google.com/macros/s/AKfycbyr8KW-_XZsWDpQ_BnjdLQpiawjvOAAz4jWI8HVYVbCd-iiFjd6cau84tegSkbF203g/exec";

/* =============================================================
   ブラウザ保存の設定
============================================================= */

/** localStorageで使用する保存キー */
const SHIFT_WEEK_CACHE_KEY = "shiftWeekCacheV1";

/** ブラウザに保持する週数 */
const SHIFT_WEEK_CACHE_LIMIT = 3;

/** 現在画面に表示している基本シフト */
let currentWeekItems = [];

/**
 * API通信でエラーが起きた場合に使用する専用エラーです。
 * GAS側で発行したエラー番号も保持できます。
 */
class ApiError extends Error {
  constructor(message, errorId = "") {
    super(message || "処理に失敗しました");
    this.name = "ApiError";
    this.errorId = errorId || "";
  }
}

/* =============================================================
   画面起動時の処理
============================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  /* 前の週へ移動 */
  document
    .getElementById("previousWeekButton")
    .addEventListener("click", () => moveWeek(-7));

  /* 次の週へ移動 */
  document
    .getElementById("nextWeekButton")
    .addEventListener("click", () => moveWeek(7));

  /* 現在の日付を含む週へ移動 */
  document
    .getElementById("currentWeekButton")
    .addEventListener("click", async () => {
      setWeekMonday(getMonday(new Date()));
      await loadCurrentWeek({ forceReload: false });
    });

  /*
    再読み込みボタンでは、ブラウザ保存を使わず、
    GASから最新データを取り直します。
  */
  document
    .getElementById("reloadButton")
    .addEventListener("click", async () => {
      await loadCurrentWeek({ forceReload: true });
    });

  /* 規定値から初回作成 */
  document
    .getElementById("createButton")
    .addEventListener("click", createInitialWeek);

  /* 日付入力を変更した場合 */
  document
    .getElementById("weekMonday")
    .addEventListener("change", async event => {
      const selectedDate = parseLocalDate(event.target.value);

      if (!selectedDate) {
        return;
      }

      /* 選択した日付が何曜日でも、その週の月曜日へそろえます。 */
      setWeekMonday(getMonday(selectedDate));
      await loadCurrentWeek({ forceReload: false });
    });

  /*
    基本シフトを作る段階では翌週を扱うことが多いため、
    画面起動時の初期表示は「翌週の月曜日」にします。
  */
  const nextWeekMonday = addDays(
    getMonday(new Date()),
    7
  );

  setWeekMonday(nextWeekMonday);

  /*
    起動時は最新情報を確認するため、GASから取得します。
    通信に失敗した場合は、保存済みデータへ切り替えます。
  */
  await loadCurrentWeek({ forceReload: true });
});

/* =============================================================
   日付関連の共通処理
============================================================= */

/**
 * yyyy-MM-dd形式の文字列をローカル日付へ変換します。
 * new Date("yyyy-MM-dd") を直接使うと時差の影響を受けるため、
 * 年・月・日を分けてDateを作成します。
 */
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

/** Dateをyyyy-MM-dd形式へ変換します。 */
function formatLocalDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

/** Dateを「2026年7月20日」の形式へ変換します。 */
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

/** 指定した日付を含む週の月曜日を返します。 */
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

/** 指定した日付に日数を加えます。 */
function addDays(date, days) {
  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  result.setDate(result.getDate() + days);
  return result;
}

/**
 * 対象週の月曜日を画面へ設定し、
 * 月曜日から日曜日までの期間も表示します。
 */
function setWeekMonday(monday) {
  const weekMondayInput = document.getElementById("weekMonday");
  const weekRange = document.getElementById("weekRange");
  const sunday = addDays(monday, 6);

  weekMondayInput.value = formatLocalDate(monday);
  weekRange.textContent =
    formatJapaneseDate(monday) +
    " ～ " +
    formatJapaneseDate(sunday);
}

/** 現在画面で選択している月曜日を取得します。 */
function getSelectedWeekMonday() {
  return document.getElementById("weekMonday").value;
}

/** 前後の週へ移動します。 */
async function moveWeek(days) {
  const currentMonday = parseLocalDate(
    getSelectedWeekMonday()
  );

  if (!currentMonday) {
    return;
  }

  setWeekMonday(addDays(currentMonday, days));

  /*
    前後の週へ移動した場合は、保存済みデータを優先します。
    保存がない週だけGASから取得します。
  */
  await loadCurrentWeek({ forceReload: false });
}

/* =============================================================
   基本シフトの読み込み
============================================================= */

/**
 * 対象週の基本シフトを読み込みます。
 *
 * forceReload = false
 *   保存済みの週があれば、通信せずに表示します。
 *
 * forceReload = true
 *   保存済みデータがあっても、GASから最新情報を取得します。
 */
async function loadCurrentWeek({ forceReload = false } = {}) {
  const weekMonday = getSelectedWeekMonday();

  if (!weekMonday) {
    return;
  }

  /* 保存済みデータを確認します。 */
  const cachedWeek = getCachedWeek(weekMonday);

  if (!forceReload && cachedWeek) {
    currentWeekItems = cachedWeek.items || [];
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
    renderTable();

    /* 最新データをブラウザへ保存します。 */
    saveWeekToCache(weekMonday, currentWeekItems);

    setMessage(
      currentWeekItems.length > 0
        ? "基本シフトを読み込みました。"
        : "この週の基本シフトはまだありません。"
    );

    showCacheStatus(new Date().toISOString());
  } catch (error) {
    /*
      通信に失敗しても保存データがあれば、
      閲覧を続けられるようにします。
    */
    if (cachedWeek) {
      currentWeekItems = cachedWeek.items || [];
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
   規定値からの初回作成
============================================================= */

/**
 * 現在選択している対象週について、
 * シフト規定値から基本シフトを作成します。
 */
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

    /*
      初回作成後は保存済みデータを使わず、
      GASから作成後のデータを必ず取り直します。
    */
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

/** 取得した基本シフトを一覧表へ表示します。 */
function renderTable() {
  const tbody = document.getElementById("shiftWeekBody");
  const emptyArea = document.getElementById("emptyArea");
  const tableScroll = document.querySelector(".table-scroll");
  const recordCount = document.getElementById("recordCount");

  tbody.innerHTML = "";
  recordCount.textContent = currentWeekItems.length + "件";

  if (currentWeekItems.length === 0) {
    tableScroll.classList.add("hidden");
    emptyArea.classList.remove("hidden");
    return;
  }

  tableScroll.classList.remove("hidden");
  emptyArea.classList.add("hidden");

  currentWeekItems.forEach(item => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(item.user)}</td>
      <td>${escapeHtml(formatDateForTable(item.date))}</td>
      <td>${escapeHtml(item.weekday)}</td>
      <td>${escapeHtml(item.startTime)}</td>
      <td>${escapeHtml(item.endTime)}</td>
      <td>${escapeHtml(item.service)}</td>
      <td>${escapeHtml(item.vehicle)}</td>
      <td class="content-cell">${escapeHtml(item.content)}</td>
      <td class="note-cell">${escapeHtml(item.note)}</td>
      <td>${escapeHtml(item.staff1)}</td>
      <td>${escapeHtml(item.staff2)}</td>
      <td>${escapeHtml(item.staff3)}</td>
      <td>${escapeHtml(item.staff4)}</td>
      <td>${createStatusLabel(item.status)}</td>
      <td>${escapeHtml(item.publishStatus)}</td>
    `;

    tbody.appendChild(row);
  });
}

/** 一覧の日付を「7/20」の形へ変換します。 */
function formatDateForTable(value) {
  const date = parseLocalDate(value);

  if (!date) {
    return value || "";
  }

  return (
    (date.getMonth() + 1) +
    "/" +
    date.getDate()
  );
}

/** 状態を見やすいラベルとして表示します。 */
function createStatusLabel(statusValue) {
  const status = String(statusValue || "予定");
  let cssClass = "planned";

  if (status === "変更") {
    cssClass = "changed";
  }

  if (
    status === "キャンセル" ||
    status === "取消"
  ) {
    cssClass = "cancelled";
  }

  return `
    <span class="status-label ${cssClass}">
      ${escapeHtml(status)}
    </span>
  `;
}

/* =============================================================
   ブラウザ保存
============================================================= */

/** localStorageから全キャッシュを読み込みます。 */
function readShiftWeekCache() {
  try {
    const text = localStorage.getItem(
      SHIFT_WEEK_CACHE_KEY
    );

    if (!text) {
      return { weeks: {} };
    }

    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== "object") {
      return { weeks: {} };
    }

    if (!parsed.weeks || typeof parsed.weeks !== "object") {
      parsed.weeks = {};
    }

    return parsed;
  } catch (error) {
    console.warn("基本シフトの保存データを読めませんでした。", error);
    return { weeks: {} };
  }
}

/** 全キャッシュをlocalStorageへ保存します。 */
function writeShiftWeekCache(cache) {
  try {
    localStorage.setItem(
      SHIFT_WEEK_CACHE_KEY,
      JSON.stringify(cache)
    );
  } catch (error) {
    console.warn("基本シフトをブラウザへ保存できませんでした。", error);
  }
}

/** 指定週の保存済みデータを取得します。 */
function getCachedWeek(weekMonday) {
  const cache = readShiftWeekCache();
  const cachedWeek = cache.weeks[weekMonday];

  if (!cachedWeek) {
    return null;
  }

  /*
    使用した週は古い週として削除されにくいよう、
    最終使用日時を更新します。
  */
  cachedWeek.lastUsedAt = new Date().toISOString();
  writeShiftWeekCache(cache);

  return cachedWeek;
}

/** 指定週のデータを保存します。 */
function saveWeekToCache(weekMonday, items) {
  const cache = readShiftWeekCache();
  const now = new Date().toISOString();

  cache.weeks[weekMonday] = {
    weekMonday,
    items: Array.isArray(items) ? items : [],
    savedAt: now,
    lastUsedAt: now
  };

  /* 最大3週になるよう、古く使われた週から削除します。 */
  trimShiftWeekCache(cache);
  writeShiftWeekCache(cache);
}

/** 指定週だけ保存データから削除します。 */
function removeWeekFromCache(weekMonday) {
  const cache = readShiftWeekCache();

  delete cache.weeks[weekMonday];
  writeShiftWeekCache(cache);
}

/** 保存週数が上限を超えた場合、古い週から削除します。 */
function trimShiftWeekCache(cache) {
  const entries = Object.entries(cache.weeks);

  if (entries.length <= SHIFT_WEEK_CACHE_LIMIT) {
    return;
  }

  entries.sort((a, b) => {
    const aTime = new Date(
      a[1].lastUsedAt || a[1].savedAt || 0
    ).getTime();

    const bTime = new Date(
      b[1].lastUsedAt || b[1].savedAt || 0
    ).getTime();

    return aTime - bTime;
  });

  while (entries.length > SHIFT_WEEK_CACHE_LIMIT) {
    const oldestEntry = entries.shift();

    if (oldestEntry) {
      delete cache.weeks[oldestEntry[0]];
    }
  }
}

/** 保存日時を画面右側へ表示します。 */
function showCacheStatus(savedAt) {
  const cacheStatus = document.getElementById("cacheStatus");

  if (!savedAt) {
    cacheStatus.textContent = "";
    return;
  }

  const date = new Date(savedAt);

  if (Number.isNaN(date.getTime())) {
    cacheStatus.textContent = "";
    return;
  }

  const formatted =
    String(date.getMonth() + 1).padStart(2, "0") +
    "/" +
    String(date.getDate()).padStart(2, "0") +
    " " +
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0");

  cacheStatus.textContent =
    "端末保存：" + formatted +
    "　最大" + SHIFT_WEEK_CACHE_LIMIT + "週";
}

/* =============================================================
   画面メッセージ・ボタン制御
============================================================= */

/** 件数の右側へ処理メッセージを表示します。 */
function setMessage(message, isError = false) {
  const messageArea = document.getElementById("messageArea");

  if (!message) {
    messageArea.textContent = "";
    messageArea.className = "message-area hidden";
    return;
  }

  messageArea.textContent = message;
  messageArea.className =
    "message-area" +
    (isError ? " error" : "");
}

/** 通信中に連続操作されないよう、主なボタンを無効にします。 */
function setButtonsDisabled(disabled) {
  [
    "previousWeekButton",
    "nextWeekButton",
    "currentWeekButton",
    "reloadButton",
    "createButton"
  ].forEach(id => {
    const button = document.getElementById(id);

    if (button) {
      button.disabled = disabled;
    }
  });
}

/** APIエラーを画面とダイアログへ表示します。 */
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

  const displayMessage =
    heading +
    "：" +
    message +
    (errorId ? "　エラー番号：" + errorId : "");

  setMessage(displayMessage, true);

  alert(
    heading +
    "\n\n" +
    message +
    (errorId ? "\n\nエラー番号：" + errorId : "")
  );
}

/* =============================================================
   GASとのJSONP通信
============================================================= */

/**
 * GitHub PagesからGASへ通信するため、JSONPを使用します。
 *
 * action
 *   GAS側で実行する処理名
 *
 * payload
 *   GASへ渡す登録・作成用データ
 *
 * callbackPrefix
 *   コールバック関数名の先頭部分
 *
 * extraParameters
 *   weekMondayなどの追加GETパラメータ
 */
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

    /** 通信後にscript要素と一時関数を削除します。 */
    const cleanup = () => {
      delete window[callbackName];

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    /** 30秒以内に応答がない場合はタイムアウトにします。 */
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

    /** GASから呼び出される一時的なコールバック関数です。 */
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

    Object.entries(extraParameters).forEach(
      ([key, value]) => {
        parameters.set(key, value);
      }
    );

    if (payload !== null) {
      parameters.set(
        "payload",
        JSON.stringify(payload)
      );
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
   HTML安全化
============================================================= */

/**
 * シートから取得した文字列をHTMLへ表示する前に、
 * 特殊文字を置き換えて意図しないHTML実行を防止します。
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
