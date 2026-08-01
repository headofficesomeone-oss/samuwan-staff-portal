/*
 * OUTING_ROUTE_APIの
 * WebアプリURLを設定します。
 */
const OUTING_ROUTE_API_URL =
  "https://script.google.com/macros/s/AKfycbw0DoVUbEfvfrmKrgjYig2vmJRkzXmqKAOr9RJheB88xx0WEC-IyXYicYgmhYt_ko7A/exec";


let outingCurrentUser = null;


/*
 * 二重クリック防止のため、
 * 同じ開始処理中は同じ操作IDを使います。
 */
let currentOutingOperationId = "";


document.addEventListener(
  "DOMContentLoaded",
  async function() {
    outingCurrentUser =
      getSavedPortalUser();

    if (
      !outingCurrentUser ||
      !outingCurrentUser.employeeId ||
      !outingCurrentUser.employeeName
    ) {
      alert(
        "本人情報を確認できません。" +
        "職員ポータルから開き直してください。"
      );

      location.href =
        "./index.html";

      return;
    }

    const userNameArea =
      document.getElementById(
        "outingUserName"
      );

    if (userNameArea) {
      userNameArea.textContent =
        outingCurrentUser.employeeName +
        " さん";
    }

    const form =
      document.getElementById(
        "outingStartForm"
      );

    if (form) {
      form.addEventListener(
        "submit",
        handleOutingStart_
      );
    }

    await loadOutingClientList_();
  }
);


/**
 * ポータルGASから利用者一覧を取得します。
 */
async function loadOutingClientList_() {
  const select =
    document.getElementById(
      "outingClient"
    );

  if (!select) {
    return;
  }

  select.disabled = true;

  try {
    const result =
      await postGas({
        action:
          "getClientList"
      });

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result && result.message
          ? result.message
          : "利用者一覧を取得できませんでした"
      );
    }

    const clients =
      Array.isArray(result.clients)
        ? result.clients
        : [];

    select.innerHTML =
      '<option value="">' +
      '利用者を選択してください' +
      '</option>';

    clients.forEach(
      function(client) {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          String(
            client.clientId || ""
          );

        option.textContent =
          String(
            client.name || ""
          );

        select.appendChild(
          option
        );
      }
    );

  } catch (error) {
    console.error(
      "利用者一覧取得エラー",
      error
    );

    select.innerHTML =
      '<option value="">' +
      '利用者一覧の取得に失敗しました' +
      '</option>';

    showOutingMessage_(
      "利用者一覧の取得に失敗しました。" +
      error.message,
      "error"
    );

  } finally {
    select.disabled = false;
  }
}


/**
 * 外出支援開始フォームを送信します。
 */
async function handleOutingStart_(
  event
) {
  event.preventDefault();

  if (
    !outingCurrentUser ||
    !outingCurrentUser.employeeId
  ) {
    alert(
      "職員情報を確認できません"
    );

    return;
  }

  const clientSelect =
    document.getElementById(
      "outingClient"
    );

  const selectedOption =
    clientSelect.options[
      clientSelect.selectedIndex
    ];

  const userId =
    String(
      clientSelect.value || ""
    ).trim();

  const userName =
    String(
      selectedOption
        ? selectedOption.textContent
        : ""
    ).trim();

  const serviceType =
    getOutingInputValue_(
      "serviceType"
    );

  const serviceContent =
    getOutingInputValue_(
      "serviceContent"
    );

  const startPlace =
    getOutingInputValue_(
      "startPlace"
    );

  const transport =
    getOutingInputValue_(
      "transport"
    );

  const vehicleName =
    getOutingInputValue_(
      "vehicleName"
    );

  const supportDetail =
    getOutingInputValue_(
      "supportDetail"
    );

  const currentUserIsDriver =
    document
      .getElementById(
        "currentUserIsDriver"
      )
      .checked;

  const isPaidTransport =
    document
      .getElementById(
        "paidTransport"
      )
      .checked;

  if (
    !userId ||
    !serviceType ||
    !startPlace ||
    !transport
  ) {
    alert(
      "利用者、サービス区分、" +
      "出発場所、移動手段を確認してください。"
    );

    return;
  }

  const confirmed =
    confirm(
      userName +
      "さんの外出支援を開始します。\n\n" +
      "出発場所：" +
      startPlace +
      "\n" +
      "移動手段：" +
      transport +
      "\n\n" +
      "開始してよろしいですか？"
    );

  if (!confirmed) {
    return;
  }

  const startButton =
    document.getElementById(
      "outingStartButton"
    );

  try {
    if (!currentOutingOperationId) {
      currentOutingOperationId =
        createBrowserOutingOperationId_();
    }

    if (startButton) {
      startButton.disabled = true;
      startButton.textContent =
        "開始処理中…";
    }

    showOutingMessage_(
      "外出支援を開始しています。",
      "loading"
    );

    const today =
      formatBrowserDate_(
        new Date()
      );

    const payload = {
      data: {
        supportDate:
          today,

        shiftId:
          "",

        requestId:
          "",

        userId:
          userId,

        userName:
          userName,

        serviceType:
          serviceType,

        serviceContent:
          serviceContent,

        mainStaffId:
          outingCurrentUser.employeeId,

        mainStaffName:
          outingCurrentUser.employeeName,

        startPlaceType:
          "自宅等",

        startPlace:
          startPlace,

        transport:
          transport,

        isDriving:
          currentUserIsDriver,

        driverId:
          currentUserIsDriver
            ? outingCurrentUser.employeeId
            : "",

        driverName:
          currentUserIsDriver
            ? outingCurrentUser.employeeName
            : "",

        vehicleName:
          vehicleName,

        isPaidTransport:
          isPaidTransport,

        supportDetail:
          supportDetail,

        operatorId:
          outingCurrentUser.employeeId,

        operatorName:
          outingCurrentUser.employeeName,

        registerType:
          "ポータル",

        operationId:
          currentOutingOperationId
      }
    };

    const result =
      await callOutingApi_(
        "outing-start",
        payload
      );

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result && result.message
          ? result.message
          : "外出支援を開始できませんでした"
      );
    }

    /*
     * 進行中情報を端末にも一時保存します。
     */
    const activeOuting = {
      outingResultId:
        result.outingResultId,

      routeId:
        result.routeId,

      routeNumber:
        result.routeNumber,

      userId:
        userId,

      userName:
        userName,

      currentPlace:
        startPlace,

      movementStatus:
        "移動中"
    };

    localStorage.setItem(
      "staffPortalActiveOuting",
      JSON.stringify(
        activeOuting
      )
    );

    setOutingText_(
      "startedOutingId",
      result.outingResultId
    );

    setOutingText_(
      "startedRouteId",
      result.routeId
    );

    document
      .getElementById(
        "outingStartArea"
      )
      .classList.add(
        "hidden"
      );

    document
      .getElementById(
        "outingStartedArea"
      )
      .classList.remove(
        "hidden"
      );

    currentOutingOperationId =
      "";

    showOutingMessage_(
      result.message ||
      "外出支援を開始しました。",
      "success"
    );

  } catch (error) {
    console.error(
      "外出支援開始エラー",
      error
    );

    showOutingMessage_(
      "外出支援の開始に失敗しました。" +
      error.message,
      "error"
    );

  } finally {
    if (startButton) {
      startButton.disabled = false;
      startButton.textContent =
        "自宅等を出発";
    }
  }
}


/**
 * OUTING_ROUTE_APIを呼び出します。
 */
async function callOutingApi_(
  action,
  payload
) {
  const separator =
    OUTING_ROUTE_API_URL.includes("?")
      ? "&"
      : "?";

  const requestUrl =
    OUTING_ROUTE_API_URL +
    separator +
    "action=" +
    encodeURIComponent(action) +
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
        method:
          "GET",

        redirect:
          "follow",

        cache:
          "no-store"
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

  try {
    return JSON.parse(
      responseText
    );

  } catch (error) {
    console.error(
      "OUTING_ROUTE_API応答",
      responseText
    );

    throw new Error(
      "サーバーの応答を読み取れませんでした"
    );
  }
}


/**
 * yyyy-MM-dd形式を作ります。
 */
function formatBrowserDate_(
  date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return (
    year +
    "-" +
    month +
    "-" +
    day
  );
}


/**
 * ブラウザ側の操作IDを作ります。
 */
function createBrowserOutingOperationId_() {
  const randomText =
    Math.random()
      .toString(36)
      .slice(2, 9)
      .toUpperCase();

  return (
    "WEB-OUT-" +
    Date.now() +
    "-" +
    randomText
  );
}


function getOutingInputValue_(
  elementId
) {
  const element =
    document.getElementById(
      elementId
    );

  return String(
    element
      ? element.value
      : ""
  ).trim();
}


function setOutingText_(
  elementId,
  value
) {
  const element =
    document.getElementById(
      elementId
    );

  if (element) {
    element.textContent =
      String(value || "");
  }
}


function showOutingMessage_(
  message,
  type
) {
  const element =
    document.getElementById(
      "outingMessage"
    );

  if (!element) {
    return;
  }

  element.textContent =
    String(message || "");

  element.className =
    "outing-message " +
    String(type || "");

  if (!message) {
    element.classList.add(
      "hidden"
    );
  }
}