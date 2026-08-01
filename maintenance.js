/*
 * SHIFT_MASTER_V4の
 * WebアプリURLを設定してください。
 *
 * URLの末尾は /exec です。
 */
const SHIFT_MASTER_V4_API_URL =
  "https://script.google.com/macros/s/AKfycbwBQOZ5MjFRwQyKKYXLVpM5npEl9od34CQjoW9rWimQaphIf_sTK8_uIjxSVrMxvtGX/exec";


document.addEventListener(
  "DOMContentLoaded",
  function() {
    const refreshButton =
      document.getElementById(
        "refreshButton"
      );

    const backupButton =
      document.getElementById(
        "backupButton"
      );

    if (refreshButton) {
      refreshButton.addEventListener(
        "click",
        loadMaintenanceStatus
      );
    }

    if (backupButton) {
      backupButton.addEventListener(
        "click",
        createMaintenanceBackup
      );
    }

    loadMaintenanceStatus();
    loadLastMaintenanceBackup();
  }
);


/**
 * SHIFT_MASTER_V4から
 * 現在のデータ状況を取得します。
 */
async function loadMaintenanceStatus() {
  const refreshButton =
    document.getElementById(
      "refreshButton"
    );

  try {
    setLoadingState_(true);

    showMaintenanceMessage_(
      "現在のデータ状況を確認しています。",
      "loading"
    );

    const requestUrl =
      SHIFT_MASTER_V4_API_URL +
      (
        SHIFT_MASTER_V4_API_URL.includes("?")
          ? "&"
          : "?"
      ) +
      "action=" +
      encodeURIComponent(
        "maintenance-status"
      ) +
      "&_=" +
      Date.now();

    const response =
      await fetch(
        requestUrl,
        {
          method: "GET",
          redirect: "follow",
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        "HTTPエラー：" +
        response.status
      );
    }

    const responseText =
      await response.text();

    let result;

    try {
      result =
        JSON.parse(responseText);

    } catch (error) {
      console.error(
        "SHIFT_MASTER_V4応答",
        responseText
      );

      throw new Error(
        "サーバーの応答を読み取れませんでした。"
      );
    }

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result && result.message
          ? result.message
          : "データ状況を取得できませんでした。"
      );
    }

    displayMaintenanceStatus_(
      result
    );

    showMaintenanceMessage_(
      "最新のデータ状況を取得しました。",
      "success"
    );

  } catch (error) {
    console.error(
      "メンテナンス状況取得エラー",
      error
    );

    showMaintenanceMessage_(
      "データ状況の取得に失敗しました。" +
      error.message,
      "error"
    );

  } finally {
    setLoadingState_(false);
  }
}


/**
 * 取得した件数を画面へ表示します。
 */
function displayMaintenanceStatus_(
  result
) {
  const data =
    result.data || {};

  const shiftK =
    data.shiftK || {};

  const shiftWeek =
    data.shiftWeek || {};

  const request =
    data.request || {};

  setMaintenanceText_(
    "environmentName",
    result.environment ||
      "未設定"
  );

  setMaintenanceText_(
    "checkedAt",
    formatMaintenanceDateTime_(
      result.checkedAt
    )
  );

  setMaintenanceText_(
    "shiftKTotal",
    formatMaintenanceCount_(
      shiftK.total
    )
  );

  setMaintenanceText_(
    "shiftKActive",
    formatMaintenanceCount_(
      shiftK.active
    )
  );

  setMaintenanceText_(
    "shiftKInactive",
    formatMaintenanceCount_(
      shiftK.inactive
    )
  );

  setMaintenanceText_(
    "shiftKHistory",
    formatMaintenanceCount_(
      shiftK.history
    )
  );

  setMaintenanceText_(
    "shiftWeekTotal",
    formatMaintenanceCount_(
      shiftWeek.total
    )
  );

  setMaintenanceText_(
    "requestTotal",
    formatMaintenanceCount_(
      request.total
    )
  );
}


/**
 * 件数表示を「○件」に統一します。
 */
function formatMaintenanceCount_(
  value
) {
  const numberValue =
    Number(value);

  if (
    !Number.isFinite(numberValue)
  ) {
    return "0件";
  }

  return (
    numberValue.toLocaleString(
      "ja-JP"
    ) +
    "件"
  );
}


/**
 * APIの日時を日本時間表示へ変換します。
 */
function formatMaintenanceDateTime_(
  value
) {
  if (!value) {
    return "―";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      timeZone:
        "Asia/Tokyo",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit"
    }
  ).format(date);
}


/**
 * 指定したIDへ文字を表示します。
 */
function setMaintenanceText_(
  elementId,
  value
) {
  const element =
    document.getElementById(
      elementId
    );

  if (!element) {
    return;
  }

  element.textContent =
    value === null ||
    value === undefined
      ? ""
      : String(value);
}


/**
 * 取得中のボタン表示を変更します。
 */
function setLoadingState_(
  loading
) {
  const refreshButton =
    document.getElementById(
      "refreshButton"
    );

  if (!refreshButton) {
    return;
  }

  refreshButton.disabled =
    loading;

  refreshButton.textContent =
    loading
      ? "確認しています…"
      : "最新状態を取得";
}


/**
 * 画面上部へ処理結果を表示します。
 */
function showMaintenanceMessage_(
  message,
  type
) {
  const messageBox =
    document.getElementById(
      "messageBox"
    );

  if (!messageBox) {
    return;
  }

  messageBox.textContent =
    message || "";

  messageBox.className =
    "message-box " +
    String(type || "");

  if (!message) {
    messageBox.classList.add(
      "hidden"
    );
  }
}

/**
 * 初期化前バックアップを作成します。
 */
async function createMaintenanceBackup() {
  const confirmationInput =
    document.getElementById(
      "backupConfirmation"
    );

  const backupButton =
    document.getElementById(
      "backupButton"
    );

  const confirmation =
    String(
      confirmationInput
        ? confirmationInput.value
        : ""
    ).trim();

  if (
    confirmation !==
    "バックアップを作成"
  ) {
    alert(
      "確認欄へ「バックアップを作成」と入力してください。"
    );

    confirmationInput?.focus();
    return;
  }

  const confirmed =
    confirm(
      "規定値・基本シフト・支援依頼の" +
      "バックアップを作成します。\n\n" +
      "この処理では元データを削除・変更しません。\n" +
      "実行してよろしいですか？"
    );

  if (!confirmed) {
    return;
  }

  try {
    if (backupButton) {
      backupButton.disabled = true;
      backupButton.textContent =
        "バックアップ作成中…";
    }

    showMaintenanceMessage_(
      "バックアップを作成しています。",
      "loading"
    );

    const payload = {
      confirmation:
        confirmation
    };

    const requestUrl =
      SHIFT_MASTER_V4_API_URL +
      (
        SHIFT_MASTER_V4_API_URL.includes("?")
          ? "&"
          : "?"
      ) +
      "action=" +
      encodeURIComponent(
        "maintenance-backup"
      ) +
      "&payload=" +
      encodeURIComponent(
        JSON.stringify(payload)
      ) +
      "&_=" +
      Date.now();

    const response =
      await fetch(
        requestUrl,
        {
          method: "GET",
          redirect: "follow",
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        "HTTPエラー：" +
        response.status
      );
    }

    const responseText =
      await response.text();

    let result;

    try {
      result =
        JSON.parse(responseText);

    } catch (error) {
      console.error(
        "バックアップ応答",
        responseText
      );

      throw new Error(
        "サーバーの応答を読み取れませんでした。"
      );
    }

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result && result.message
          ? result.message
          : "バックアップを作成できませんでした。"
      );
    }

    if (confirmationInput) {
      confirmationInput.value = "";
    }

    displayLastMaintenanceBackup_({
      exists: true,
      backup: {
        createdAt:
          result.createdAt,

        folderId:
          result.folderId,

        folderName:
          result.folderName,

        backups:
          result.backups
      }
    });

    showMaintenanceMessage_(
      result.message ||
      "バックアップを作成しました。",
      "success"
    );

  } catch (error) {
    console.error(
      "バックアップ作成エラー",
      error
    );

    showMaintenanceMessage_(
      "バックアップの作成に失敗しました。" +
      error.message,
      "error"
    );

  } finally {
    if (backupButton) {
      backupButton.disabled = false;
      backupButton.textContent =
        "バックアップを作成";
    }
  }
}


/**
 * 最後に作成したバックアップを取得します。
 */
async function loadLastMaintenanceBackup() {
  try {
    const requestUrl =
      SHIFT_MASTER_V4_API_URL +
      (
        SHIFT_MASTER_V4_API_URL.includes("?")
          ? "&"
          : "?"
      ) +
      "action=" +
      encodeURIComponent(
        "maintenance-last-backup"
      ) +
      "&_=" +
      Date.now();

    const response =
      await fetch(
        requestUrl,
        {
          method: "GET",
          redirect: "follow",
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        "HTTPエラー：" +
        response.status
      );
    }

    const result =
      await response.json();

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result && result.message
          ? result.message
          : "バックアップ情報を取得できませんでした。"
      );
    }

    displayLastMaintenanceBackup_(
      result
    );

  } catch (error) {
    console.warn(
      "最後のバックアップ確認エラー",
      error
    );

    setMaintenanceText_(
      "lastBackupText",
      "確認できませんでした"
    );
  }
}


/**
 * 最後のバックアップ情報を表示します。
 */
function displayLastMaintenanceBackup_(
  result
) {
  const backup =
    result && result.backup
      ? result.backup
      : null;

  const link =
    document.getElementById(
      "backupFolderLink"
    );

  if (
    !result ||
    result.exists !== true ||
    !backup
  ) {
    setMaintenanceText_(
      "lastBackupText",
      "まだバックアップはありません"
    );

    if (link) {
      link.classList.add(
        "hidden"
      );
    }

    return;
  }

  const backupCount =
    Array.isArray(
      backup.backups
    )
      ? backup.backups.length
      : 0;

  setMaintenanceText_(
    "lastBackupText",
    formatMaintenanceDateTime_(
      backup.createdAt
    ) +
    "　" +
    backupCount +
    "ファイル"
  );

  if (
    link &&
    backup.folderId
  ) {
    link.href =
      "https://drive.google.com/drive/folders/" +
      encodeURIComponent(
        backup.folderId
      );

    link.classList.remove(
      "hidden"
    );
  }
}