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

	const savedActiveOuting =
	  getActiveOutingFromBrowser_();

	if (
	  savedActiveOuting &&
	  savedActiveOuting.outingResultId &&
	  savedActiveOuting.routeId
	) {
	  showSavedActiveOuting_(
	    savedActiveOuting
	  );

	} else {
	  await loadOutingClientList_();
	}
    
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


  console.log(
    "利用者一覧取得開始",
    typeof postGas,
    STAFF_PORTAL_API_URL
  );
  


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


/**
 * 現在の行程を経由地到着として登録します。
 */
async function arriveAtOutingViaPoint_() {
  const activeOuting =
    getActiveOutingFromBrowser_();

  if (
    !activeOuting ||
    !activeOuting.outingResultId ||
    !activeOuting.routeId
  ) {
    alert(
      "進行中の外出支援を確認できません。"
    );

    return;
  }

  if (
    !outingCurrentUser ||
    !outingCurrentUser.employeeId
  ) {
    alert(
      "職員情報を確認できません。"
    );

    return;
  }

  const arrivalPlaceType =
    getOutingInputValue_(
      "arrivalPlaceType"
    );

  const arrivalPlace =
    getOutingInputValue_(
      "arrivalPlace"
    );

  const arrivalPlaceNote =
    getOutingInputValue_(
      "arrivalPlaceNote"
    );

  const distanceText =
    getOutingInputValue_(
      "arrivalDistanceKm"
    );

  const odometerText =
    getOutingInputValue_(
      "arrivalOdometerKm"
    );

  if (!arrivalPlace) {
    alert(
      "到着場所を入力してください。"
    );

    return;
  }

  const confirmed =
    confirm(
      activeOuting.userName +
      "さんの移動について、\n\n" +
      arrivalPlace +
      "への到着を登録します。\n\n" +
      "よろしいですか？"
    );

  if (!confirmed) {
    return;
  }

  const button =
    document.getElementById(
      "viaArrivalButton"
    );

  const operationId =
    createBrowserOutingOperationId_();

  try {
    if (button) {
      button.disabled = true;

      button.textContent =
        "到着処理中…";
    }

    showOutingMessage_(
      "経由地への到着を登録しています。",
      "loading"
    );

    const result =
      await callOutingApi_(
        "outing-arrive",
        {
          data: {
            outingResultId:
              activeOuting.outingResultId,

            routeId:
              activeOuting.routeId,

            arrivalType:
              "経由地",

            arrivalPlaceType:
              arrivalPlaceType,

            arrivalPlace:
              arrivalPlace,

            arrivalPlaceNote:
              arrivalPlaceNote,

            distanceKm:
              distanceText === ""
                ? ""
                : Number(distanceText),

            odometerArrivalKm:
              odometerText === ""
                ? ""
                : Number(odometerText),

            endReport:
              "",

            operatorId:
              outingCurrentUser.employeeId,

            operatorName:
              outingCurrentUser.employeeName,

            operationId:
              operationId
          }
        }
      );

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result && result.message
          ? result.message
          : "到着を登録できませんでした"
      );
    }

    activeOuting.currentPlace =
      result.arrivalPlace ||
      arrivalPlace;

    activeOuting.movementStatus =
      "待機中";

    activeOuting.arrivalType =
      "経由地";

    localStorage.setItem(
      "staffPortalActiveOuting",
      JSON.stringify(
        activeOuting
      )
    );

    setOutingText_(
      "waitingCurrentPlace",
      result.arrivalPlace ||
      arrivalPlace
    );

    setOutingText_(
      "waitingMovementMinutes",
      String(
        result.movementMinutes ?? 0
      ) + "分"
    );

    document
      .getElementById(
        "outingArrivalArea"
      )
      .classList.add(
        "hidden"
      );

    document
      .getElementById(
        "outingWaitingArea"
      )
      .classList.remove(
        "hidden"
      );

    showOutingMessage_(
      result.message ||
      "経由地への到着を登録しました。",
      "success"
    );

  } catch (error) {
    console.error(
      "経由地到着エラー",
      error
    );

    showOutingMessage_(
      "経由地への到着登録に失敗しました。" +
      error.message,
      "error"
    );

  } finally {
    if (button) {
      button.disabled = false;

      button.textContent =
        "経由地に到着";
    }
  }
}


/**
 * 端末に保存した進行中の
 * 外出支援情報を取得します。
 */
function getActiveOutingFromBrowser_() {
  const saved =
    localStorage.getItem(
      "staffPortalActiveOuting"
    );

  if (!saved) {
    return null;
  }

  try {
    return JSON.parse(
      saved
    );

  } catch (error) {
    console.error(
      "進行中外出支援の読込エラー",
      error
    );

    localStorage.removeItem(
      "staffPortalActiveOuting"
    );

    return null;
  }
}

/**
 * 保存済みの進行中情報を画面へ復元します。
 */
function showSavedActiveOuting_(
  activeOuting
) {
  setOutingText_(
    "startedOutingId",
    activeOuting.outingResultId
  );

  setOutingText_(
    "startedRouteId",
    activeOuting.routeId
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

  if (
    activeOuting.movementStatus ===
    "待機中"
  ) {
    setOutingText_(
      "waitingCurrentPlace",
      activeOuting.currentPlace
    );

    setOutingText_(
      "waitingMovementMinutes",
      "登録済み"
    );

    document
      .getElementById(
        "outingArrivalArea"
      )
      .classList.add(
        "hidden"
      );

    document
      .getElementById(
        "outingWaitingArea"
      )
      .classList.remove(
        "hidden"
      );
  }
}

/**
 * 待機中の場所から次の行程を開始します。
 */
async function departNextOutingRoute_() {
  const activeOuting =
    getActiveOutingFromBrowser_();

  if (
    !activeOuting ||
    !activeOuting.outingResultId ||
    !activeOuting.routeId
  ) {
    alert(
      "進行中の外出支援を確認できません。"
    );

    return;
  }

  if (
    !outingCurrentUser ||
    !outingCurrentUser.employeeId
  ) {
    alert(
      "職員情報を確認できません。"
    );

    return;
  }

  const transport =
    getOutingInputValue_(
      "nextTransport"
    );

  const vehicleName =
    getOutingInputValue_(
      "nextVehicleName"
    );

  const supportDetail =
    getOutingInputValue_(
      "nextSupportDetail"
    );

  const currentUserIsDriver =
    document
      .getElementById(
        "nextCurrentUserIsDriver"
      )
      .checked;

  const isPaidTransport =
    document
      .getElementById(
        "nextPaidTransport"
      )
      .checked;

  if (!transport) {
    alert(
      "次の移動手段を選択してください。"
    );

    return;
  }

  const confirmed =
    confirm(
      activeOuting.currentPlace +
      "から次の場所へ出発します。\n\n" +
      "移動手段：" +
      transport +
      "\n\n" +
      "よろしいですか？"
    );

  if (!confirmed) {
    return;
  }

  const button =
    document.getElementById(
      "nextDepartureButton"
    );

  try {
    if (button) {
      button.disabled = true;

      button.textContent =
        "出発処理中…";
    }

    showOutingMessage_(
      "次の場所への出発を登録しています。",
      "loading"
    );

    const result =
      await callOutingApi_(
        "outing-next-departure",
        {
          data: {
            outingResultId:
              activeOuting.outingResultId,

            previousRouteId:
              activeOuting.routeId,

            departurePlaceType:
              "経由地",

            departurePlace:
              activeOuting.currentPlace,

            departurePlaceNote:
              "",

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

            driverChanged:
              false,

            previousDriverId:
              "",

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

            operationId:
              createBrowserOutingOperationId_()
          }
        }
      );

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result && result.message
          ? result.message
          : "次の出発を登録できませんでした"
      );
    }

    activeOuting.routeId =
      result.routeId;

    activeOuting.routeNumber =
      result.routeNumber;

    activeOuting.currentPlace =
      result.departurePlace ||
      activeOuting.currentPlace;

    activeOuting.movementStatus =
      "移動中";

    delete activeOuting.arrivalType;

    localStorage.setItem(
      "staffPortalActiveOuting",
      JSON.stringify(
        activeOuting
      )
    );

    setOutingText_(
      "startedRouteId",
      result.routeId
    );

    document
      .getElementById(
        "outingWaitingArea"
      )
      .classList.add(
        "hidden"
      );

    document
      .getElementById(
        "outingArrivalArea"
      )
      .classList.remove(
        "hidden"
      );

    clearNextDepartureInputs_();
    clearArrivalInputs_();

    showOutingMessage_(
      result.message ||
      "次の場所へ出発しました。",
      "success"
    );

  } catch (error) {
    console.error(
      "次の場所への出発エラー",
      error
    );

    showOutingMessage_(
      "次の場所への出発登録に失敗しました。" +
      error.message,
      "error"
    );

  } finally {
    if (button) {
      button.disabled = false;

      button.textContent =
        "次の場所へ出発";
    }
  }
}


/**
 * 次の出発入力欄を初期化します。
 */
function clearNextDepartureInputs_() {
  const ids = [
    "nextTransport",
    "nextVehicleName",
    "nextSupportDetail"
  ];

  ids.forEach(
    function(id) {
      const element =
        document.getElementById(id);

      if (element) {
        element.value = "";
      }
    }
  );

  const driver =
    document.getElementById(
      "nextCurrentUserIsDriver"
    );

  const paid =
    document.getElementById(
      "nextPaidTransport"
    );

  if (driver) {
    driver.checked = false;
  }

  if (paid) {
    paid.checked = false;
  }
}


/**
 * 到着入力欄を初期化します。
 */
function clearArrivalInputs_() {
  const ids = [
    "arrivalPlace",
    "arrivalPlaceNote",
    "arrivalDistanceKm",
    "arrivalOdometerKm"
  ];

  ids.forEach(
    function(id) {
      const element =
        document.getElementById(id);

      if (element) {
        element.value = "";
      }
    }
  );
}
