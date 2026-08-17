/**
 * =============================================================
 * シフト規定値 V5
 * shift-master-v5-app.js
 *
 * V2のGAS API
 * list / masters / save / disable / restore
 * をそのまま利用し、画面だけ一覧表＋詳細ポップアップへ変更します。
 * =============================================================
 */


/* =============================================================
   1. API・状態
   ============================================================= */

const GAS_API_URL =
  "https://script.google.com/macros/s/AKfycbwBQOZ5MjFRwQyKKYXLVpM5npEl9od34CQjoW9rWimQaphIf_sTK8_uIjxSVrMxvtGX/exec";


let shiftData = [];

let masterData = {
  staff: [],
  choices: {}
};


let selectedIndex = -1;

let editMode = "new";


const WEEKDAY_ORDER = {
  "月": 1,
  "火": 2,
  "水": 3,
  "木": 4,
  "金": 5,
  "土": 6,
  "日": 7
};


/* =============================================================
   2. DOM共通
   ============================================================= */

function qs(selector) {
  return document.querySelector(
    selector
  );
}


function qsa(selector) {
  return Array.from(
    document.querySelectorAll(
      selector
    )
  );
}


function setInput(
  id,
  value
) {
  const element =
    document.getElementById(
      id
    );

  if (!element) {
    return;
  }

  element.value =
    value === null ||
    value === undefined
      ? ""
      : value;
}


function getInput(id) {
  const element =
    document.getElementById(
      id
    );

  return element
    ? String(
        element.value || ""
      )
    : "";
}


/* =============================================================
   3. エラー・メッセージ
   ============================================================= */

class ApiError extends Error {

  constructor(
    message,
    errorId = ""
  ) {
    super(
      message ||
      "処理に失敗しました"
    );

    this.name =
      "ApiError";

    this.errorId =
      errorId || "";
  }

}


function showApiError(
  error,
  heading = "処理に失敗しました"
) {
  console.error(
    error
  );

  const message =
    error &&
    error.message
      ? error.message
      : "不明なエラーが発生しました";

  const errorId =
    error &&
    error.errorId
      ? String(
          error.errorId
        )
      : "";

  alert(
    heading +
    "\n\n" +
    message +
    (
      errorId
        ? "\n\nエラー番号：" +
          errorId
        : ""
    )
  );
}


function showMessage(
  message,
  isError = false
) {
  const area =
    document.getElementById(
      "messageArea"
    );

  if (!area) {
    return;
  }

  area.textContent =
    message || "";

  area.classList.toggle(
    "error",
    isError
  );

  area.classList.toggle(
    "hidden",
    !message
  );
}


function setLoadingStatus(
  text
) {
  const element =
    document.getElementById(
      "loadingStatus"
    );

  if (element) {
    element.textContent =
      text || "";
  }
}


/* =============================================================
   4. JSONP通信
   ============================================================= */

function jsonpRequest(
  action,
  payload = null,
  callbackPrefix = "callback"
) {
  return new Promise(
    (resolve, reject) => {

      const callbackName =
        callbackPrefix +
        "_" +
        Date.now() +
        "_" +
        Math.floor(
          Math.random() *
          100000
        );

      const script =
        document.createElement(
          "script"
        );

      let finished =
        false;


      const cleanup = () => {

        delete window[
          callbackName
        ];

        if (
          script.parentNode
        ) {
          script.parentNode
            .removeChild(
              script
            );
        }

      };


      const timer =
        setTimeout(
          () => {

            if (finished) {
              return;
            }

            finished =
              true;

            cleanup();

            reject(
              new ApiError(
                "GASの応答がタイムアウトしました"
              )
            );

          },
          30000
        );


      window[
        callbackName
      ] = result => {

        if (finished) {
          return;
        }

        finished =
          true;

        clearTimeout(
          timer
        );

        cleanup();


        if (
          !result ||
          result.success !== true
        ) {
          reject(
            new ApiError(
              result &&
              result.message
                ? result.message
                : "処理に失敗しました",

              result &&
              result.errorId
                ? result.errorId
                : ""
            )
          );

          return;
        }


        resolve(
          result
        );

      };


      const params =
        new URLSearchParams();

      params.set(
        "action",
        action
      );

      params.set(
        "callback",
        callbackName
      );

      params.set(
        "_",
        Date.now()
      );


      if (
        payload !== null
      ) {
        params.set(
          "payload",
          JSON.stringify(
            payload
          )
        );
      }


      script.src =
        GAS_API_URL +
        "?" +
        params.toString();


      script.onerror = () => {

        if (finished) {
          return;
        }

        finished =
          true;

        clearTimeout(
          timer
        );

        cleanup();

        reject(
          new ApiError(
            "GASへ接続できませんでした"
          )
        );

      };


      document.body
        .appendChild(
          script
        );

    }
  );
}


/* =============================================================
   5. GASデータ取得
   ============================================================= */

async function loadMasterDataFromGas() {

  const result =
    await jsonpRequest(
      "masters",
      null,
      "shiftMasterMastersCallback"
    );

  masterData.staff =
    result.staff || [];

  masterData.choices =
    result.choices || {};

}


async function loadShiftDataFromGas() {

  const result =
    await jsonpRequest(
      "list",
      null,
      "shiftMasterListCallback"
    );

  shiftData =
    Array.isArray(
      result.data
    )
      ? result.data
      : [];

}


/* =============================================================
   6. 有効・無効判定
   ============================================================= */

function isInactiveItem(
  item
) {
  return (
    String(
      item &&
      item.status ||
      ""
    ).trim() ===
    "無効"
  );
}


function isActiveItem(
  item
) {
  const status =
    String(
      item &&
      item.status ||
      ""
    ).trim();

  return (
    status === "" ||
    status === "有効"
  );
}


/* =============================================================
   7. 並び順
   ============================================================= */

function compareText(
  a,
  b
) {
  return String(
    a || ""
  ).localeCompare(
    String(
      b || ""
    ),
    "ja",
    {
      numeric: true,
      sensitivity: "base"
    }
  );
}


function formatTimeForList(
  value
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return "";
  }


  if (
    typeof value ===
    "number"
  ) {
    const text =
      String(
        Math.trunc(
          value
        )
      ).padStart(
        4,
        "0"
      );

    return (
      text.slice(
        0,
        2
      ) +
      ":" +
      text.slice(
        2,
        4
      )
    );
  }


  const text =
    String(
      value
    ).trim();

  if (!text) {
    return "";
  }


  if (
    /^\d{1,2}:\d{2}$/.test(
      text
    )
  ) {
    const [
      hour,
      minute
    ] =
      text.split(
        ":"
      );

    return (
      hour.padStart(
        2,
        "0"
      ) +
      ":" +
      minute
    );
  }


  if (
    /^\d{1,4}$/.test(
      text
    )
  ) {
    const padded =
      text.padStart(
        4,
        "0"
      );

    return (
      padded.slice(
        0,
        2
      ) +
      ":" +
      padded.slice(
        2,
        4
      )
    );
  }


  return text;
}


function formatTimeRange(
  startTime,
  endTime
) {
  const start =
    formatTimeForList(
      startTime
    );

  const end =
    formatTimeForList(
      endTime
    );

  if (
    !start &&
    !end
  ) {
    return "";
  }

  return (
    start +
    "～" +
    end
  );
}


function getTimeSortValue(
  value
) {
  const text =
    formatTimeForList(
      value
    );

  if (!text) {
    return (
      24 * 60 +
      1
    );
  }


  const match =
    text.match(
      /^(\d{2}):(\d{2})$/
    );

  if (!match) {
    return (
      24 * 60 +
      1
    );
  }


  return (
    Number(
      match[1]
    ) *
    60 +
    Number(
      match[2]
    )
  );
}


function getOrderSortValue(
  value
) {
  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : 999999;
}


function compareShiftItems(
  a,
  b,
  sortMode
) {
  let result =
    (
      WEEKDAY_ORDER[
        a.weekday
      ] ||
      99
    ) -
    (
      WEEKDAY_ORDER[
        b.weekday
      ] ||
      99
    );

  if (
    result !== 0
  ) {
    return result;
  }


  if (
    sortMode ===
    "staff"
  ) {
    result =
      compareText(
        a.staff1,
        b.staff1
      );

    if (
      result !== 0
    ) {
      return result;
    }

  } else if (
    sortMode ===
    "user"
  ) {
    result =
      compareText(
        a.user,
        b.user
      );

    if (
      result !== 0
    ) {
      return result;
    }
  }


  result =
    getTimeSortValue(
      a.startTime
    ) -
    getTimeSortValue(
      b.startTime
    );

  if (
    result !== 0
  ) {
    return result;
  }


  result =
    getOrderSortValue(
      a.order
    ) -
    getOrderSortValue(
      b.order
    );

  if (
    result !== 0
  ) {
    return result;
  }


  result =
    compareText(
      a.user,
      b.user
    );

  if (
    result !== 0
  ) {
    return result;
  }


  return compareText(
    a.id,
    b.id
  );
}


/* =============================================================
   8. 一覧フィルター
   ============================================================= */

function getFilteredSortedItems() {

  const filterUser =
    getInput(
      "filterUser"
    );

  const filterWeekday =
    getInput(
      "filterWeekday"
    );

  const sortMode =
    getInput(
      "sortMode"
    ) ||
    "shift";

  const activeFilter =
    getInput(
      "activeFilter"
    ) ||
    "active";


  return shiftData
    .map(
      (
        item,
        originalIndex
      ) => ({
        item,
        originalIndex
      })
    )
    .filter(
      ({
        item
      }) => {

        if (
          filterUser &&
          item.user !==
          filterUser
        ) {
          return false;
        }


        if (
          filterWeekday &&
          item.weekday !==
          filterWeekday
        ) {
          return false;
        }


        if (
          activeFilter ===
          "active" &&
          !isActiveItem(
            item
          )
        ) {
          return false;
        }


        if (
          activeFilter ===
          "inactive" &&
          !isInactiveItem(
            item
          )
        ) {
          return false;
        }


        return true;
      }
    )
    .sort(
      (
        a,
        b
      ) =>
        compareShiftItems(
          a.item,
          b.item,
          sortMode
        )
    );
}


/* =============================================================
   9. HTMLエスケープ
   ============================================================= */

function escapeHtml(
  value
) {
  return String(
    value === null ||
    value === undefined
      ? ""
      : value
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}



/* =============================================================
   9-A. 一覧用プルダウン
   ============================================================= */

function optionHtml(
  value,
  currentValue
) {
  const text =
    value === null ||
    value === undefined
      ? ""
      : String(
          value
        );

  const current =
    currentValue === null ||
    currentValue === undefined
      ? ""
      : String(
          currentValue
        );

  return (
    '<option value="' +
    escapeHtml(
      text
    ) +
    '"' +
    (
      text === current
        ? ' selected'
        : ''
    ) +
    '>' +
    escapeHtml(
      text
    ) +
    '</option>'
  );
}


function buildListSelectHtml(
  fieldName,
  currentValue,
  options,
  originalIndex,
  includeBlank = true
) {
  const values =
    Array.from(
      new Set(
        [
          ...(includeBlank ? [""] : []),
          ...(
            options ||
            []
          ),
          (
            currentValue === null ||
            currentValue === undefined
              ? ""
              : String(
                  currentValue
                )
          )
        ]
      )
    );

  return (
    '<select ' +
    'class="list-select" ' +
    'data-field="' +
    escapeHtml(
      fieldName
    ) +
    '" ' +
    'data-index="' +
    originalIndex +
    '">' +
    values
      .map(
        value =>
          optionHtml(
            value,
            currentValue
          )
      )
      .join(
        ""
      ) +
    '</select>'
  );
}


function getListChoiceValues(
  key
) {
  return (
    masterData.choices[
      key
    ] ||
    []
  );
}


function getListStaffValues() {
  return (
    masterData.staff ||
    []
  );
}


async function handleListSelectChange(
  select
) {
  const index =
    Number(
      select.dataset.index
    );

  const fieldName =
    String(
      select.dataset.field ||
      ""
    );

  if (
    !Number.isInteger(
      index
    ) ||
    index < 0 ||
    index >= shiftData.length ||
    !fieldName
  ) {
    return;
  }


  const item =
    shiftData[
      index
    ];

  const oldValue =
    item[
      fieldName
    ] === null ||
    item[
      fieldName
    ] === undefined
      ? ""
      : String(
          item[
            fieldName
          ]
        );

  const newValue =
    String(
      select.value ||
      ""
    );


  if (
    oldValue ===
    newValue
  ) {
    return;
  }


  const updatedItem = {
    ...item,
    [fieldName]:
      newValue
  };


  select.disabled =
    true;


  try {

    const result =
      await jsonpRequest(
        "save",
        {
          mode:
            "update",

          sourceRow:
            item.sourceRow ||
            0,

          data:
            updatedItem
        },
        "shiftMasterInlineSaveCallback"
      );


    await reloadAllData();


    showMessage(
      result.message ||
      "変更を保存しました"
    );


  } catch (
    error
  ) {

    select.disabled =
      false;

    select.value =
      oldValue;


    showApiError(
      error,
      "一覧の変更を保存できませんでした"
    );

  }
}


/* =============================================================
   10. 一覧表示
   ============================================================= */

function renderTable() {

  const tbody =
    document.getElementById(
      "shiftTableBody"
    );

  const emptyArea =
    document.getElementById(
      "emptyArea"
    );

  const displayItems =
    getFilteredSortedItems();


  tbody.innerHTML =
    "";


  document
    .getElementById(
      "recordCount"
    )
    .textContent =
      displayItems.length +
      "件";


  if (
    displayItems.length === 0
  ) {
    emptyArea.classList
      .remove(
        "hidden"
      );

    return;
  }


  emptyArea.classList
    .add(
      "hidden"
    );


  displayItems.forEach(
    (
      {
        item,
        originalIndex
      },
      displayIndex
    ) => {

      const row =
        document.createElement(
          "tr"
        );


      if (
        isInactiveItem(
          item
        )
      ) {
        row.classList.add(
          "inactive-row"
        );
      }


      const statusClass =
        isInactiveItem(
          item
        )
          ? "inactive"
          : "active";

      const statusText =
        isInactiveItem(
          item
        )
          ? "無効"
          : "有効";


      row.innerHTML = `
        <td class="center-cell">
          ${displayIndex + 1}
        </td>

        <td class="list-select-cell">
          ${buildListSelectHtml(
            "weekday",
            item.weekday,
            [
              "月",
              "火",
              "水",
              "木",
              "金",
              "土",
              "日"
            ],
            originalIndex,
            false
          )}
        </td>

        <td class="center-cell">
          ${escapeHtml(
            formatTimeRange(
              item.startTime,
              item.endTime
            )
          )}
        </td>

        <td class="user-cell">
          ${escapeHtml(item.user)}
        </td>

        <td class="list-select-cell">
          ${buildListSelectHtml(
            "service",
            item.service,
            getListChoiceValues(
              "サービス"
            ),
            originalIndex
          )}
        </td>

        <td class="center-cell">
          ${escapeHtml(item.weekPattern)}
        </td>

        <td class="list-select-cell">
          ${buildListSelectHtml(
            "staff1",
            item.staff1,
            getListStaffValues(),
            originalIndex
          )}
        </td>

        <td class="list-select-cell">
          ${buildListSelectHtml(
            "staff2",
            item.staff2,
            getListStaffValues(),
            originalIndex
          )}
        </td>

        <td class="list-select-cell">
          ${buildListSelectHtml(
            "staff3",
            item.staff3,
            getListStaffValues(),
            originalIndex
          )}
        </td>

        <td class="list-select-cell">
          ${buildListSelectHtml(
            "staff4",
            item.staff4,
            getListStaffValues(),
            originalIndex
          )}
        </td>

        <td
          class="ellipsis-cell"
          title="${escapeHtml(item.destination)}"
        >
          ${escapeHtml(item.destination)}
        </td>

        <td class="list-select-cell">
          ${buildListSelectHtml(
            "transport",
            item.transport,
            getListChoiceValues(
              "移動手段"
            ),
            originalIndex
          )}
        </td>

        <td class="center-cell">
          <span class="status-badge ${statusClass}">
            ${statusText}
          </span>
        </td>

        <td class="center-cell">
          <button
            type="button"
            class="detail-button"
            data-index="${originalIndex}"
          >
            詳細
          </button>
        </td>
      `;


      tbody.appendChild(
        row
      );

    }
  );


  qsa(
    ".detail-button"
  ).forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const index =
            Number(
              button.dataset.index
            );

          openExistingDetail(
            index
          );

        }
      );

    }
  );


  qsa(
    ".list-select"
  ).forEach(
    select => {

      select.addEventListener(
        "change",
        () => {
          handleListSelectChange(
            select
          );
        }
      );

    }
  );
}


/* =============================================================
   11. 一覧の利用者フィルター
   ============================================================= */

function getKnownUsers() {

  const values = [
    ...shiftData
      .map(
        item =>
          item.user
      )
      .filter(
        Boolean
      ),

    ...(
      masterData.choices[
        "利用者"
      ] ||
      []
    )
  ];


  return [
    ...new Set(
      values
    )
  ].sort(
    (
      a,
      b
    ) =>
      compareText(
        a,
        b
      )
  );
}


function updateFilterOptions() {

  const select =
    document.getElementById(
      "filterUser"
    );

  const currentValue =
    select.value;

  const users =
    getKnownUsers();


  select.innerHTML =
    '<option value="">すべての利用者</option>';


  users.forEach(
    user => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        user;

      option.textContent =
        user;

      select.appendChild(
        option
      );

    }
  );


  if (
    users.includes(
      currentValue
    )
  ) {
    select.value =
      currentValue;
  }
}


/* =============================================================
   12. セレクト候補
   ============================================================= */

function setSelectOptions(
  id,
  list,
  firstText = "選択してください"
) {
  const select =
    document.getElementById(
      id
    );

  if (!select) {
    return;
  }


  const currentValue =
    select.value;


  select.innerHTML =
    "";


  const empty =
    document.createElement(
      "option"
    );

  empty.value =
    "";

  empty.textContent =
    firstText;

  select.appendChild(
    empty
  );


  (
    list ||
    []
  ).forEach(
    value => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        value;

      option.textContent =
        value;

      select.appendChild(
        option
      );

    }
  );


  if (
    (
      list ||
      []
    ).includes(
      currentValue
    )
  ) {
    select.value =
      currentValue;
  }
}


function applyMasterOptions() {

  setSelectOptions(
    "staff1",
    masterData.staff,
    "選択"
  );

  setSelectOptions(
    "staff2",
    masterData.staff,
    "選択"
  );

  setSelectOptions(
    "staff3",
    masterData.staff,
    "選択"
  );

  setSelectOptions(
    "staff4",
    masterData.staff,
    "選択"
  );


  setSelectOptions(
    "serviceSelect",
    masterData.choices[
      "サービス"
    ] ||
    []
  );


  setSelectOptions(
    "transport",
    masterData.choices[
      "移動手段"
    ] ||
    [],
    "選択"
  );

  updateUserSelectOptions();
}


function updateUserSelectOptions() {

  const select =
    document.getElementById(
      "userSelect"
    );

  const currentValue =
    select.value;

  const users =
    getKnownUsers();


  select.innerHTML =
    '<option value="">選択してください</option>';


  users.forEach(
    user => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        user;

      option.textContent =
        user;

      select.appendChild(
        option
      );

    }
  );


  if (
    users.includes(
      currentValue
    )
  ) {
    select.value =
      currentValue;
  }
}


/* =============================================================
   13. 日付入力
   ============================================================= */

function formatDateForInput(
  value
) {
  if (!value) {
    return "";
  }


  if (
    typeof value ===
    "string"
  ) {

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        value
      )
    ) {
      return value;
    }


    if (
      /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(
        value
      )
    ) {
      const parts =
        value.split(
          "/"
        );

      return [
        parts[0],
        parts[1]
          .padStart(
            2,
            "0"
          ),
        parts[2]
          .padStart(
            2,
            "0"
          )
      ].join(
        "-"
      );
    }

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  return [
    date.getFullYear(),

    String(
      date.getMonth() +
      1
    ).padStart(
      2,
      "0"
    ),

    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    )
  ].join(
    "-"
  );
}


function formatTimeForInput(
  value
) {
  const formatted =
    formatTimeForList(
      value
    );

  return (
    /^\d{2}:\d{2}$/.test(
      formatted
    )
      ? formatted
      : ""
  );
}


/* =============================================================
   14. 週パターン
   ============================================================= */

function setWeekPatternChecks(
  weekPattern
) {
  const pattern =
    String(
      weekPattern ||
      ""
    );


  qsa(
    "#weekPanel input[type='checkbox']"
  ).forEach(
    checkbox => {

      if (
        checkbox.dataset.weekGroup ===
        "number"
      ) {
        checkbox.checked =
          pattern.includes(
            checkbox.value
          );

      } else {
        checkbox.checked =
          pattern ===
          checkbox.value;
      }

    }
  );


  if (!pattern) {

    const every =
      qs(
        '#weekPanel input[value="毎週"]'
      );

    if (every) {
      every.checked =
        true;
    }

    setInput(
      "weekPatternText",
      "毎週"
    );

  } else {
    setInput(
      "weekPatternText",
      pattern
    );
  }
}


function updateWeekPattern(
  changedCheckbox
) {
  const allChecks =
    qsa(
      "#weekPanel input[type='checkbox']"
    );


  if (
    changedCheckbox.checked
  ) {

    const selectedGroup =
      changedCheckbox
        .dataset
        .weekGroup;


    allChecks.forEach(
      checkbox => {

        if (
          checkbox ===
          changedCheckbox
        ) {
          return;
        }


        if (
          selectedGroup ===
          "number" &&
          checkbox.dataset.weekGroup ===
          "number"
        ) {
          return;
        }


        checkbox.checked =
          false;

      }
    );


    if (
      selectedGroup ===
      "alternate"
    ) {
      allChecks.forEach(
        checkbox => {

          if (
            checkbox !==
            changedCheckbox &&
            checkbox.dataset.weekGroup ===
            "alternate"
          ) {
            checkbox.checked =
              false;
          }

        }
      );
    }

  }


  const selected =
    allChecks
      .filter(
        checkbox =>
          checkbox.checked
      )
      .map(
        checkbox =>
          checkbox.value
      );


  if (
    selected.length === 0
  ) {
    const every =
      qs(
        '#weekPanel input[value="毎週"]'
      );

    if (every) {
      every.checked =
        true;
    }

    setInput(
      "weekPatternText",
      "毎週"
    );

    return;
  }


  setInput(
    "weekPatternText",
    selected.join(
      ""
    )
  );
}


/* =============================================================
   15. 詳細フォームへ展開
   ============================================================= */

function loadToForm(
  item
) {
  setInput(
    "masterId",
    item.id
  );

  setInput(
    "historyId",
    item.historyId
  );

  setInput(
    "statusDisplay",
    isInactiveItem(
      item
    )
      ? "無効"
      : "有効"
  );

  setInput(
    "userSelect",
    item.user
  );

  setInput(
    "startDate",
    formatDateForInput(
      item.startDate
    )
  );

  setInput(
    "endDate",
    formatDateForInput(
      item.endDate
    )
  );

  setInput(
    "weekdaySelect",
    item.weekday
  );

  setInput(
    "startTime",
    formatTimeForInput(
      item.startTime
    )
  );

  setInput(
    "endTime",
    formatTimeForInput(
      item.endTime
    )
  );

  setInput(
    "peopleSelect",
    item.people ||
    "1人"
  );

  setInput(
    "serviceSelect",
    item.service
  );

  setInput(
    "changeType",
    item.changeType ||
    "通常"
  );

  setInput(
    "displayOrder",
    item.order
  );

  setInput(
    "staff1",
    item.staff1
  );

  setInput(
    "staff2",
    item.staff2
  );

  setInput(
    "staff3",
    item.staff3
  );

  setInput(
    "staff4",
    item.staff4
  );

  setInput(
    "support",
    item.support
  );

  setInput(
    "destination",
    item.destination
  );

  setInput(
    "meeting",
    item.meeting
  );

  setInput(
    "meetingPoint",
    item.meetingPoint
  );

  setInput(
    "transport",
    item.transport
  );

  setInput(
    "detailNote",
    item.detailNote
  );

  setInput(
    "simpleMemo",
    item.simpleMemo
  );

  setInput(
    "note",
    item.note
  );


  setInput(
    "paidGoTime",
    formatTimeForInput(
      item.paidGoTime
    )
  );

  setInput(
    "paidGoFrom",
    item.paidGoFrom
  );

  setInput(
    "paidGoDriver",
    item.paidGoDriver
  );

  setInput(
    "paidGoVehicle",
    item.paidGoVehicle
  );

  setInput(
    "paidReturnTime",
    formatTimeForInput(
      item.paidReturnTime
    )
  );

  setInput(
    "paidReturnFrom",
    item.paidReturnFrom
  );

  setInput(
    "paidReturnDriver",
    item.paidReturnDriver
  );

  setInput(
    "paidReturnVehicle",
    item.paidReturnVehicle
  );

  setInput(
    "pickupTime",
    formatTimeForInput(
      item.pickupTime
    )
  );

  setInput(
    "pickupFrom",
    item.pickupFrom
  );

  setInput(
    "pickupTo",
    item.pickupTo
  );

  setInput(
    "pickupDriver",
    item.pickupDriver
  );

  setInput(
    "pickupVehicle",
    item.pickupVehicle
  );


  setWeekPatternChecks(
    item.weekPattern
  );


  const userSelect =
    document.getElementById(
      "userSelect"
    );

  userSelect.disabled =
    editMode ===
    "update";
}


/* =============================================================
   16. 新規フォーム初期化
   ============================================================= */

function clearForm() {

  setInput(
    "masterId",
    ""
  );

  setInput(
    "historyId",
    ""
  );

  setInput(
    "statusDisplay",
    "有効"
  );

  setInput(
    "userSelect",
    ""
  );

  setInput(
    "startDate",
    ""
  );

  setInput(
    "endDate",
    ""
  );

  setInput(
    "weekdaySelect",
    ""
  );

  setInput(
    "startTime",
    ""
  );

  setInput(
    "endTime",
    ""
  );

  setInput(
    "peopleSelect",
    "1人"
  );

  setInput(
    "serviceSelect",
    ""
  );

  setInput(
    "changeType",
    "通常"
  );

  setInput(
    "displayOrder",
    ""
  );

  setInput(
    "staff1",
    ""
  );

  setInput(
    "staff2",
    ""
  );

  setInput(
    "staff3",
    ""
  );

  setInput(
    "staff4",
    ""
  );

  setInput(
    "support",
    ""
  );

  setInput(
    "destination",
    ""
  );

  setInput(
    "meeting",
    ""
  );

  setInput(
    "meetingPoint",
    ""
  );

  setInput(
    "transport",
    ""
  );

  setInput(
    "detailNote",
    ""
  );

  setInput(
    "simpleMemo",
    ""
  );

  setInput(
    "note",
    ""
  );


  [
    "paidGoTime",
    "paidGoFrom",
    "paidGoDriver",
    "paidGoVehicle",
    "paidReturnTime",
    "paidReturnFrom",
    "paidReturnDriver",
    "paidReturnVehicle",
    "pickupTime",
    "pickupFrom",
    "pickupTo",
    "pickupDriver",
    "pickupVehicle"
  ].forEach(
    id => {
      setInput(
        id,
        ""
      );
    }
  );


  setWeekPatternChecks(
    "毎週"
  );


  document
    .getElementById(
      "userSelect"
    )
    .disabled =
      false;
}


/* =============================================================
   17. フォーム → GAS保存データ
   ============================================================= */

function formToData() {

  return {
    id:
      getInput(
        "masterId"
      ),

    historyId:
      getInput(
        "historyId"
      ),

    startDate:
      getInput(
        "startDate"
      ),

    endDate:
      getInput(
        "endDate"
      ),

    weekPattern:
      getInput(
        "weekPatternText"
      ),

    weekday:
      getInput(
        "weekdaySelect"
      ),

    order:
      getInput(
        "displayOrder"
      ),

    user:
      getInput(
        "userSelect"
      ),

    service:
      getInput(
        "serviceSelect"
      ),

    startTime:
      getInput(
        "startTime"
      ),

    endTime:
      getInput(
        "endTime"
      ),

    people:
      getInput(
        "peopleSelect"
      ),

    changeType:
      getInput(
        "changeType"
      ),

    staff1:
      getInput(
        "staff1"
      ),

    staff2:
      getInput(
        "staff2"
      ),

    staff3:
      getInput(
        "staff3"
      ),

    staff4:
      getInput(
        "staff4"
      ),

    support:
      getInput(
        "support"
      ),

    destination:
      getInput(
        "destination"
      ),

    meeting:
      getInput(
        "meeting"
      ),

    meetingPoint:
      getInput(
        "meetingPoint"
      ),

    transport:
      getInput(
        "transport"
      ),

    detailNote:
      getInput(
        "detailNote"
      ),

    simpleMemo:
      getInput(
        "simpleMemo"
      ),

    note:
      getInput(
        "note"
      ),

    paidGoTime:
      getInput(
        "paidGoTime"
      ),

    paidGoFrom:
      getInput(
        "paidGoFrom"
      ),

    paidGoDriver:
      getInput(
        "paidGoDriver"
      ),

    paidGoVehicle:
      getInput(
        "paidGoVehicle"
      ),

    paidReturnTime:
      getInput(
        "paidReturnTime"
      ),

    paidReturnFrom:
      getInput(
        "paidReturnFrom"
      ),

    paidReturnDriver:
      getInput(
        "paidReturnDriver"
      ),

    paidReturnVehicle:
      getInput(
        "paidReturnVehicle"
      ),

    pickupTime:
      getInput(
        "pickupTime"
      ),

    pickupFrom:
      getInput(
        "pickupFrom"
      ),

    pickupTo:
      getInput(
        "pickupTo"
      ),

    pickupDriver:
      getInput(
        "pickupDriver"
      ),

    pickupVehicle:
      getInput(
        "pickupVehicle"
      )
  };
}


/* =============================================================
   18. 入力チェック
   ============================================================= */

function validateData(
  data
) {
  if (!data.user) {
    return (
      "利用者を選択してください"
    );
  }

  if (!data.weekday) {
    return (
      "曜日を選択してください"
    );
  }

  if (!data.startTime) {
    return (
      "開始時刻を入力してください"
    );
  }

  if (!data.endTime) {
    return (
      "終了時刻を入力してください"
    );
  }

  if (!data.service) {
    return (
      "サービスを選択してください"
    );
  }

  return "";
}


/* =============================================================
   19. 詳細ポップアップ
   ============================================================= */

function openModal() {
  document
    .getElementById(
      "shiftDetailModal"
    )
    .classList
    .remove(
      "hidden"
    );

  document.body
    .classList
    .add(
      "modal-open"
    );
}


function closeModal() {
  document
    .getElementById(
      "shiftDetailModal"
    )
    .classList
    .add(
      "hidden"
    );

  document.body
    .classList
    .remove(
      "modal-open"
    );
}


function updateModalButtons() {

  const disableButton =
    document.getElementById(
      "disableButton"
    );

  const copyButton =
    document.getElementById(
      "copyDetailButton"
    );


  if (
    editMode !==
    "update" ||
    selectedIndex < 0
  ) {
    disableButton.disabled =
      true;

    disableButton.textContent =
      "無効にする";

    copyButton.disabled =
      true;

    return;
  }


  disableButton.disabled =
    false;

  disableButton.textContent =
    isInactiveItem(
      shiftData[
        selectedIndex
      ]
    )
      ? "有効に戻す"
      : "無効にする";


  copyButton.disabled =
    false;
}


function openExistingDetail(
  index
) {

  if (
    !Number.isInteger(
      index
    ) ||
    index < 0 ||
    index >= shiftData.length
  ) {
    return;
  }


  selectedIndex =
    index;

  editMode =
    "update";


  document
    .getElementById(
      "modalTitle"
    )
    .textContent =
      "規定値の詳細";


  loadToForm(
    shiftData[
      index
    ]
  );

  updateModalButtons();

  openModal();
}


function openNewDetail() {

  selectedIndex =
    -1;

  editMode =
    "new";


  document
    .getElementById(
      "modalTitle"
    )
    .textContent =
      "新しい規定値";


  clearForm();

  updateModalButtons();

  openModal();
}


/* =============================================================
   20. コピーして新規作成
   ============================================================= */

function copyCurrentToNew() {

  if (
    editMode !==
    "update" ||
    selectedIndex < 0
  ) {
    return;
  }


  const source =
    shiftData[
      selectedIndex
    ];


  const copied = {
    ...source,

    id: "",
    historyId: "",
    sourceRow: 0,

    status:
      "有効",

    active:
      true
  };


  selectedIndex =
    -1;

  editMode =
    "copy";


  document
    .getElementById(
      "modalTitle"
    )
    .textContent =
      "規定値をコピーして新規作成";


  loadToForm(
    copied
  );


  document
    .getElementById(
      "userSelect"
    )
    .disabled =
      false;


  setInput(
    "statusDisplay",
    "有効"
  );


  updateModalButtons();
}


/* =============================================================
   21. 保存
   ============================================================= */

async function saveShiftDataToGas(
  data
) {

  const sourceItem =
    selectedIndex >= 0
      ? shiftData[
          selectedIndex
        ]
      : null;


  return jsonpRequest(
    "save",
    {
      mode:
        editMode,

      sourceRow:
        sourceItem &&
        sourceItem.sourceRow
          ? sourceItem.sourceRow
          : 0,

      data:
        data
    },
    "shiftMasterSaveCallback"
  );
}


async function saveCurrent() {

  const data =
    formToData();

  const errorMessage =
    validateData(
      data
    );


  if (
    errorMessage
  ) {
    alert(
      errorMessage
    );

    return;
  }


  const button =
    document.getElementById(
      "saveButton"
    );


  button.disabled =
    true;

  button.textContent =
    "保存中...";


  try {

    const result =
      await saveShiftDataToGas(
        data
      );


    await reloadAllData();


    showMessage(
      result.message ||
      "保存しました"
    );


    closeModal();


  } catch (
    error
  ) {

    showApiError(
      error,
      "保存に失敗しました"
    );

  } finally {

    button.disabled =
      false;

    button.textContent =
      "この内容で保存";

  }
}


/* =============================================================
   22. 無効化・復活
   ============================================================= */

async function disableShiftDataToGas(
  item
) {
  return jsonpRequest(
    "disable",
    {
      sourceRow:
        item.sourceRow ||
        0,

      id:
        item.id ||
        "",

      historyId:
        item.historyId ||
        ""
    },
    "shiftMasterDisableCallback"
  );
}


async function restoreShiftDataToGas(
  item
) {
  return jsonpRequest(
    "restore",
    {
      sourceRow:
        item.sourceRow ||
        0,

      id:
        item.id ||
        "",

      historyId:
        item.historyId ||
        ""
    },
    "shiftMasterRestoreCallback"
  );
}


async function disableCurrent() {

  if (
    editMode !==
    "update" ||
    selectedIndex < 0
  ) {
    return;
  }


  const item =
    shiftData[
      selectedIndex
    ];

  const isRestore =
    isInactiveItem(
      item
    );


  const confirmed =
    confirm(
      "この規定値を" +
      (
        isRestore
          ? "有効に戻しますか？"
          : "無効にしますか？"
      ) +
      "\n\n" +
      (
        item.user ||
        ""
      ) +
      "　" +
      (
        item.weekday ||
        ""
      ) +
      "曜日　" +
      formatTimeRange(
        item.startTime,
        item.endTime
      )
    );


  if (
    !confirmed
  ) {
    return;
  }


  const button =
    document.getElementById(
      "disableButton"
    );


  button.disabled =
    true;

  button.textContent =
    "処理中...";


  try {

    const result =
      isRestore
        ? await restoreShiftDataToGas(
            item
          )
        : await disableShiftDataToGas(
            item
          );


    await reloadAllData();


    showMessage(
      result.message ||
      (
        isRestore
          ? "有効に戻しました"
          : "無効にしました"
      )
    );


    closeModal();


  } catch (
    error
  ) {

    showApiError(
      error,
      isRestore
        ? "復活に失敗しました"
        : "無効化に失敗しました"
    );

  } finally {

    button.disabled =
      false;

    updateModalButtons();

  }
}


/* =============================================================
   23. 変更取り消し
   ============================================================= */

function cancelCurrentEdit() {

  if (
    editMode ===
    "update" &&
    selectedIndex >= 0
  ) {
    loadToForm(
      shiftData[
        selectedIndex
      ]
    );
  }


  closeModal();
}


/* =============================================================
   24. 再読込
   ============================================================= */

async function reloadAllData() {

  setLoadingStatus(
    "更新中..."
  );


  await loadShiftDataFromGas();


  updateFilterOptions();

  updateUserSelectOptions();

  renderTable();


  setLoadingStatus(
    ""
  );
}


/* =============================================================
   25. 初期化
   ============================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    document
      .getElementById(
        "newButton"
      )
      .addEventListener(
        "click",
        openNewDetail
      );


    document
      .getElementById(
        "modalCloseButton"
      )
      .addEventListener(
        "click",
        closeModal
      );


    document
      .getElementById(
        "modalBackdrop"
      )
      .addEventListener(
        "click",
        closeModal
      );


    document
      .getElementById(
        "cancelButton"
      )
      .addEventListener(
        "click",
        cancelCurrentEdit
      );


    document
      .getElementById(
        "copyDetailButton"
      )
      .addEventListener(
        "click",
        copyCurrentToNew
      );


    document
      .getElementById(
        "saveButton"
      )
      .addEventListener(
        "click",
        saveCurrent
      );


    document
      .getElementById(
        "disableButton"
      )
      .addEventListener(
        "click",
        disableCurrent
      );


    qsa(
      "#weekPanel input[type='checkbox']"
    ).forEach(
      checkbox => {

        checkbox.addEventListener(
          "change",
          () =>
            updateWeekPattern(
              checkbox
            )
        );

      }
    );


    [
      "filterUser",
      "filterWeekday",
      "sortMode",
      "activeFilter"
    ].forEach(
      id => {

        document
          .getElementById(
            id
          )
          .addEventListener(
            "change",
            renderTable
          );

      }
    );


    try {

      setLoadingStatus(
        "読込中..."
      );


      await loadMasterDataFromGas();

      await loadShiftDataFromGas();


      applyMasterOptions();

      updateFilterOptions();

      renderTable();


      setLoadingStatus(
        ""
      );


    } catch (
      error
    ) {

      setLoadingStatus(
        ""
      );


      showApiError(
        error,
        "初期データを読み込めませんでした"
      );


      shiftData =
        [];

      renderTable();

    }

  }
);
