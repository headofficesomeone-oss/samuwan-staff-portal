/*
 * OUTING_ROUTE_APIの
 * WebアプリURLを設定します。
 */
const OUTING_ROUTE_API_URL =
  "https://script.google.com/macros/s/AKfycbw0DoVUbEfvfrmKrgjYig2vmJRkzXmqKAOr9RJheB88xx0WEC-IyXYicYgmhYt_ko7A/exec";


let outingCurrentUser = null;
let currentOutingSummaryContext = null;

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

	const enteredDriverName =
	  getOutingInputValue_(
	    "driverName"
	  );

	const driverName =
	  currentUserIsDriver
	    ? outingCurrentUser.employeeName
	    : enteredDriverName;

	const driverId =
	  currentUserIsDriver
	    ? outingCurrentUser.employeeId
	    : "";

	const isPaidTransport =
	  transport === "有償運送";
	  
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

	if (
	  transport === "有償運送" &&
	  !driverName
	) {
	  alert(
	    "有償運送の場合は、運転手名を確認してください。"
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
				  driverId,

				driverName:
				  driverName,
  
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

		updateOutingCurrentStatus_(
		  activeOuting
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
 * 到着後の選択内容に応じて、
 * 経由地到着または最終到着を登録します。
 */
async function registerOutingArrival_() {
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

  const afterAction =
    getSelectedArrivalAfterAction_();

  if (!arrivalPlace) {
    alert(
      "到着場所を入力してください。"
    );

    return;
  }

  if (!afterAction) {
    alert(
      "到着後の動きを選択してください。"
    );

    return;
  }

  const arrivalType =
    afterAction === "finish"
      ? "最終到着"
      : "経由地";

  let confirmationText =
    activeOuting.userName +
    "さんの移動について、\n\n" +
    arrivalPlace +
    "への到着を登録します。\n\n";

  if (afterAction === "finish") {
    confirmationText +=
      "この到着で外出支援を終了し、" +
      "一連の行程を表示します。";

  } else if (
    afterAction === "continue"
  ) {
    confirmationText +=
      "到着後も続けて行程を入力します。";

  } else {
    confirmationText +=
      "到着後は職員ポータルへ戻ります。\n" +
      "外出支援は待機中として保存されます。";
  }

  confirmationText +=
    "\n\nよろしいですか？";

  const confirmed =
    confirm(
      confirmationText
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
      arrivalType === "最終到着"
        ? "最終到着と外出支援終了を登録しています。"
        : "到着を登録しています。",
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
              arrivalType,

            arrivalPlaceType:
              arrivalType ===
                "最終到着"
                ? "自宅等"
                : arrivalPlaceType,

            arrivalPlace:
              arrivalPlace,

            arrivalPlaceNote:
              arrivalPlaceNote,

            distanceKm:
              distanceText === ""
                ? ""
                : Number(
                    distanceText
                  ),

            odometerArrivalKm:
              odometerText === ""
                ? ""
                : Number(
                    odometerText
                  ),

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

		const cancelArea =
		  document.getElementById(
		    "cancelLastDepartureArea"
		  );

		if (cancelArea) {
		  cancelArea.classList.add(
		    "hidden"
		  );
		}


    /*
     * この到着で終了する場合
     */
    if (
      afterAction === "finish"
    ) {
      currentOutingSummaryContext = {
        outingResultId:
          activeOuting.outingResultId,

        routeId:
          activeOuting.routeId,

        userId:
          activeOuting.userId || "",

        userName:
          activeOuting.userName || "",

        currentPlace:
          result.arrivalPlace ||
          arrivalPlace
      };

      localStorage.removeItem(
        "staffPortalActiveOuting"
      );

      await loadAndShowOutingSummary_(
        activeOuting.outingResultId
      );

      showOutingMessage_(
        result.message ||
        "外出支援を終了しました。",
        "success"
      );

      return;
    }

    /*
     * 経由地到着として端末へ保存します。
     */
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

    /*
     * 続けて入力する場合
     */
    if (
      afterAction === "continue"
    ) {
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
        "到着を登録しました。",
        "success"
      );

      return;
    }

    /*
     * 到着だけ登録して、
     * ポータルへ戻る場合
     */
    showOutingMessage_(
      result.message ||
      "到着を登録しました。",
      "success"
    );

    location.href =
      "./index.html?v=20260801-2";

  } catch (error) {
    console.error(
      "到着登録エラー",
      error
    );

    showOutingMessage_(
      "到着登録に失敗しました。" +
      error.message,
      "error"
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        "到着を登録";
    }
  }
}


/**
 * 到着後の動きとして選択された値を取得します。
 */
function getSelectedArrivalAfterAction_() {
  const selected =
    document.querySelector(
      'input[name="arrivalAfterAction"]:checked'
    );

  return selected
    ? String(
        selected.value || ""
      ).trim()
    : "";
}


/**
 * 一連の行程を取得し、
 * 終了確認画面へ表示します。
 */
async function loadAndShowOutingSummary_(
  outingResultId
) {
  const result =
    await callOutingApi_(
      "outing-summary",
      {
        data: {
          outingResultId:
            outingResultId
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
        : "一連の行程を取得できませんでした"
    );
  }

  renderOutingSummary_(
    result
  );

  const arrivalArea =
    document.getElementById(
      "outingArrivalArea"
    );

  const waitingArea =
    document.getElementById(
      "outingWaitingArea"
    );

  const summaryArea =
    document.getElementById(
      "outingSummaryArea"
    );

  if (arrivalArea) {
    arrivalArea.classList.add(
      "hidden"
    );
  }

  if (waitingArea) {
    waitingArea.classList.add(
      "hidden"
    );
  }

  if (summaryArea) {
    summaryArea.classList.remove(
      "hidden"
    );
  }
}


/**
 * 行程一覧を終了確認画面へ表示します。
 */
function renderOutingSummary_(
  result
) {
  const summary =
    result &&
    result.summary
      ? result.summary
      : {};

  const routes =
    Array.isArray(
      result.routes
    )
      ? result.routes
      : [];

  const cancelledRoutes =
    Array.isArray(
      result.cancelledRoutes
    )
      ? result.cancelledRoutes
      : [];

  setOutingText_(
    "summaryUserName",
    summary.userName || "―"
  );

  setOutingText_(
    "summaryStartedAt",
    summary.startedAt || "―"
  );

  setOutingText_(
    "summaryEndedAt",
    summary.endedAt || "―"
  );

  setOutingText_(
    "summaryRouteCount",
    String(
      summary.routeCount ??
      routes.length
    ) + "行程"
  );

  setOutingText_(
    "summaryMovementMinutes",
    String(
      summary.totalMovementMinutes ??
      0
    ) + "分"
  );

  setOutingText_(
    "summaryWaitingMinutes",
    String(
      summary.totalWaitingMinutes ??
      0
    ) + "分"
  );

  setOutingText_(
    "summaryDistanceKm",
    String(
      summary.totalDistanceKm ??
      0
    ) + "km"
  );

  const routeList =
    document.getElementById(
      "summaryRouteList"
    );

  if (routeList) {
    routeList.innerHTML =
      routes.length > 0
        ? routes
            .map(
              createOutingRouteSummaryHtml_
            )
            .join("")
        : (
            '<div class="summary-route-card">' +
            "行程がありません" +
            "</div>"
          );
  }

  const cancelledArea =
    document.getElementById(
      "summaryCancelledArea"
    );

  const cancelledList =
    document.getElementById(
      "summaryCancelledRouteList"
    );

  if (
    cancelledRoutes.length > 0
  ) {
    if (cancelledList) {
      cancelledList.innerHTML =
        cancelledRoutes
          .map(
            createOutingRouteSummaryHtml_
          )
          .join("");
    }

    if (cancelledArea) {
      cancelledArea.classList.remove(
        "hidden"
      );
    }

  } else if (cancelledArea) {
    cancelledArea.classList.add(
      "hidden"
    );
  }

  currentOutingSummaryContext = {
    outingResultId:
      summary.outingResultId || "",

    routeId:
      summary.currentRouteId || "",

    userId:
      summary.userId || "",

    userName:
      summary.userName || "",

    currentPlace:
      summary.currentPlace ||
      summary.finalArrivalPlace ||
      "",

    routeNumber:
      summary.currentRouteNumber || 0
  };
}


/**
 * 1行程分の表示HTMLを作ります。
 */
function createOutingRouteSummaryHtml_(
  route
) {
  const departurePlace =
    escapeOutingHtml_(
      route.departurePlace || "―"
    );

  const arrivalPlace =
    escapeOutingHtml_(
      route.arrivalPlace || "未到着"
    );

  const transport =
    escapeOutingHtml_(
      route.transport || "―"
    );

  const movementMinutes =
    Number(
      route.movementMinutes || 0
    );

  const distanceKm =
    Number(
      route.distanceKm || 0
    );

  const routeNumber =
    Number(
      route.routeNumber || 0
    );

  const state =
    escapeOutingHtml_(
      route.state || ""
    );

  let detailText =
    "移動手段：" +
    transport +
    "　移動時間：" +
    movementMinutes +
    "分";

  if (distanceKm > 0) {
    detailText +=
      "　距離：" +
      distanceKm +
      "km";
  }

  if (
    route.driverName
  ) {
    detailText +=
      "　運転手：" +
      escapeOutingHtml_(
        route.driverName
      );
  }

  return (
    '<div class="summary-route-card">' +

      '<div class="summary-route-number">' +
        "行程 " +
        routeNumber +
        (
          state === "取消"
            ? "（取消）"
            : ""
        ) +
      "</div>" +

      '<div class="summary-route-main">' +
        departurePlace +
        '<div class="summary-route-arrow">↓</div>' +
        arrivalPlace +
      "</div>" +

      '<div class="summary-route-detail">' +
        detailText +
      "</div>" +

    "</div>"
  );
}


/**
 * HTMLへ表示する文字を安全な形へ変換します。
 */
function escapeOutingHtml_(
  value
) {
  return String(
    value === null ||
    value === undefined
      ? ""
      : value
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/**
 * 外出支援終了後に
 * 職員ポータルへ戻ります。
 */
function returnToPortalAfterOuting_() {
  localStorage.removeItem(
    "staffPortalActiveOuting"
  );

  location.href =
    "./index.html?v=20260801-2";
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

	updateOutingCurrentStatus_(
	  activeOuting
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
  
	  const cancelArea =
	  document.getElementById(
	    "cancelLastDepartureArea"
	  );

	if (
	  cancelArea &&
	  activeOuting.movementStatus ===
	    "移動中" &&
	  Number(
	    activeOuting.routeNumber || 0
	  ) > 1
	) {
	  cancelArea.classList.remove(
	    "hidden"
	  );

	} else if (cancelArea) {
	  cancelArea.classList.add(
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

	const enteredDriverName =
	  getOutingInputValue_(
	    "nextDriverName"
	  );

	const driverName =
	  currentUserIsDriver
	    ? outingCurrentUser.employeeName
	    : enteredDriverName;

	const driverId =
	  currentUserIsDriver
	    ? outingCurrentUser.employeeId
	    : "";

	const isPaidTransport =
	  transport === "有償運送";

  if (!transport) {
    alert(
      "次の移動手段を選択してください。"
    );

    return;
  }

	if (
	  transport === "有償運送" &&
	  !driverName
	) {
	  alert(
	    "有償運送の場合は、運転手名を確認してください。"
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
						  driverId,

						driverName:
						  driverName,
  
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

		updateOutingCurrentStatus_(
		  activeOuting
		);

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

			const cancelArea =
			  document.getElementById(
			    "cancelLastDepartureArea"
			  );

			if (
			  cancelArea &&
			  Number(
			    activeOuting.routeNumber || 0
			  ) > 1
			) {
			  cancelArea.classList.remove(
			    "hidden"
			  );
			}


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
	  "nextDriverName",
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

  if (driver) {
    driver.checked = false;
  }

	updateNextOutingDriverNameInput_();

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


/**
 * 待機中になっている現在の到着を、
 * 後から最終到着へ変更します。
 */
async function finishOutingFromWaiting_() {
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

  if (
    activeOuting.movementStatus !==
    "待機中"
  ) {
    alert(
      "現在は待機中ではありません。"
    );

    return;
  }

  const confirmed =
    confirm(
      "この到着で外出支援が終了していたものとして修正します。\n\n" +
      "新しい行程は作成せず、最後の到着時刻を終了時刻にします。\n\n" +
      "よろしいですか？"
    );

  if (!confirmed) {
    return;
  }

  const button =
    document.getElementById(
      "finishCurrentArrivalButton"
    );

  try {
    if (button) {
      button.disabled = true;
      button.textContent =
        "終了処理中…";
    }

    showOutingMessage_(
      "最後の到着を外出支援の終了へ変更しています。",
      "loading"
    );

    const result =
      await callOutingApi_(
        "outing-finish-current-arrival",
        {
          data: {
            outingResultId:
              activeOuting.outingResultId,

            routeId:
              activeOuting.routeId,

            endReport:
              "終了登録の付け忘れを修正",

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
          : "外出支援を終了できませんでした"
      );
    }

    currentOutingSummaryContext = {
      outingResultId:
        activeOuting.outingResultId,

      routeId:
        activeOuting.routeId,

      userId:
        activeOuting.userId || "",

      userName:
        activeOuting.userName || "",

      currentPlace:
        result.arrivalPlace ||
        activeOuting.currentPlace ||
        "",

      routeNumber:
        activeOuting.routeNumber || 0
    };

    localStorage.removeItem(
      "staffPortalActiveOuting"
    );

    await loadAndShowOutingSummary_(
      activeOuting.outingResultId
    );

    showOutingMessage_(
      result.message ||
      "外出支援を終了しました。",
      "success"
    );

  } catch (error) {
    console.error(
      "待機中からの終了処理エラー",
      error
    );

    showOutingMessage_(
      "外出支援の終了に失敗しました。" +
      error.message,
      "error"
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        "この到着で外出支援を終了する";
    }
  }
}


/**
 * 終了済みの外出支援を取り消し、
 * 最後の到着地点で待機中へ戻します。
 */
async function undoOutingFinishFromSummary_() {
  const context =
    currentOutingSummaryContext;

  if (
    !context ||
    !context.outingResultId ||
    !context.routeId
  ) {
    alert(
      "終了した外出支援の情報を確認できません。"
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

  const confirmed =
    confirm(
      "外出支援の終了を取り消します。\n\n" +
      "最後の到着を経由地到着へ戻し、" +
      "その場所で待機中として再開します。\n\n" +
      "よろしいですか？"
    );

  if (!confirmed) {
    return;
  }

  const button =
    document.getElementById(
      "undoOutingFinishButton"
    );

  try {
    if (button) {
      button.disabled = true;
      button.textContent =
        "終了取消処理中…";
    }

    showOutingMessage_(
      "外出支援の終了を取り消しています。",
      "loading"
    );

    const result =
      await callOutingApi_(
        "outing-undo-finish",
        {
          data: {
            outingResultId:
              context.outingResultId,

            routeId:
              context.routeId,

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
          : "終了を取り消せませんでした"
      );
    }

    const activeOuting = {
      outingResultId:
        result.outingResultId ||
        context.outingResultId,

      routeId:
        result.routeId ||
        context.routeId,

      routeNumber:
        result.routeNumber ||
        context.routeNumber ||
        0,

      userId:
        context.userId || "",

      userName:
        context.userName || "",

      currentPlace:
        result.currentPlace ||
        context.currentPlace ||
        "",

      movementStatus:
        "待機中",

      arrivalType:
        "経由地"
    };

		updateOutingCurrentStatus_(
		  activeOuting
		);

    localStorage.setItem(
      "staffPortalActiveOuting",
      JSON.stringify(
        activeOuting
      )
    );

    setOutingText_(
      "startedOutingId",
      activeOuting.outingResultId
    );

    setOutingText_(
      "startedRouteId",
      activeOuting.routeId
    );

    setOutingText_(
      "waitingCurrentPlace",
      activeOuting.currentPlace
    );

    setOutingText_(
      "waitingMovementMinutes",
      "登録済み"
    );

    const summaryArea =
      document.getElementById(
        "outingSummaryArea"
      );

    const waitingArea =
      document.getElementById(
        "outingWaitingArea"
      );

    const arrivalArea =
      document.getElementById(
        "outingArrivalArea"
      );

    if (summaryArea) {
      summaryArea.classList.add(
        "hidden"
      );
    }

    if (arrivalArea) {
      arrivalArea.classList.add(
        "hidden"
      );
    }

    if (waitingArea) {
      waitingArea.classList.remove(
        "hidden"
      );
    }

    currentOutingSummaryContext =
      null;

    showOutingMessage_(
      result.message ||
      "終了を取り消して待機中へ戻しました。",
      "success"
    );

  } catch (error) {
    console.error(
      "外出支援終了取消エラー",
      error
    );

    showOutingMessage_(
      "終了の取消に失敗しました。" +
      error.message,
      "error"
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        "終了を取り消して行程を続ける";
    }
  }
}


/**
 * 誤って開始した直前の行程を取り消し、
 * 1つ前の到着地点で外出支援を終了します。
 */
async function cancelLastDepartureAndFinish_() {
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

  if (
    activeOuting.movementStatus !==
    "移動中"
  ) {
    alert(
      "現在は移動中ではありません。"
    );

    return;
  }

  if (
    Number(
      activeOuting.routeNumber || 0
    ) <= 1
  ) {
    alert(
      "最初の出発は、この処理では取り消せません。"
    );

    return;
  }

  const confirmed =
    confirm(
      "直前の出発登録を取り消します。\n\n" +
      "現在の行程は「取消」として履歴に残し、" +
      "1つ前の到着地点で外出支援が終了していたものとして修正します。\n\n" +
      "よろしいですか？"
    );

  if (!confirmed) {
    return;
  }

  const button =
    document.getElementById(
      "cancelLastDepartureButton"
    );

  try {
    if (button) {
      button.disabled = true;
      button.textContent =
        "出発取消処理中…";
    }

    showOutingMessage_(
      "直前の出発を取り消しています。",
      "loading"
    );

    const result =
      await callOutingApi_(
        "outing-cancel-last-departure",
        {
          data: {
            outingResultId:
              activeOuting.outingResultId,

            routeId:
              activeOuting.routeId,

            cancelReason:
              "直前の出発登録誤り",

            endReport:
              "直前の出発を取り消し、前の到着地点で終了",

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
          : "直前の出発を取り消せませんでした"
      );
    }

    currentOutingSummaryContext = {
      outingResultId:
        activeOuting.outingResultId,

      routeId:
        result.previousRouteId || "",

      userId:
        activeOuting.userId || "",

      userName:
        activeOuting.userName || "",

      currentPlace:
        result.arrivalPlace || "",

      routeNumber:
        result.routeNumber || 0
    };

    localStorage.removeItem(
      "staffPortalActiveOuting"
    );

    await loadAndShowOutingSummary_(
      activeOuting.outingResultId
    );

    showOutingMessage_(
      result.message ||
      "直前の出発を取り消して外出支援を終了しました。",
      "success"
    );

  } catch (error) {
    console.error(
      "直前出発取消エラー",
      error
    );

    showOutingMessage_(
      "直前の出発取消に失敗しました。" +
      error.message,
      "error"
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        "直前の出発を取り消して、前の到着地点で終了する";
    }
  }
}

/**
 * 最初の出発画面で、
 * 本人運転チェックと運転手名欄を連動します。
 */
function updateOutingDriverNameInput_() {
  const driverCheckbox =
    document.getElementById(
      "currentUserIsDriver"
    );

  const driverNameInput =
    document.getElementById(
      "driverName"
    );

  const help =
    document.getElementById(
      "driverNameHelp"
    );

  if (
    !driverCheckbox ||
    !driverNameInput
  ) {
    return;
  }

  if (driverCheckbox.checked) {
    driverNameInput.value =
      outingCurrentUser &&
      outingCurrentUser.employeeName
        ? outingCurrentUser.employeeName
        : "";

    driverNameInput.disabled = true;

    if (help) {
      help.textContent =
        "入力者本人を運転手として登録します";
    }

  } else {
    /*
     * 本人運転のチェックを外したときは、
     * 自動入力された本人名だけを消します。
     */
    const currentEmployeeName =
      outingCurrentUser &&
      outingCurrentUser.employeeName
        ? outingCurrentUser.employeeName
        : "";

    if (
      driverNameInput.disabled ||
      driverNameInput.value ===
        currentEmployeeName
    ) {
      driverNameInput.value = "";
    }

    driverNameInput.disabled = false;

    if (help) {
      help.textContent =
        "入力者本人が運転しない場合に入力してください";
    }
  }
}


/**
 * 次の出発画面で、
 * 本人運転チェックと運転手名欄を連動します。
 */
function updateNextOutingDriverNameInput_() {
  const driverCheckbox =
    document.getElementById(
      "nextCurrentUserIsDriver"
    );

  const driverNameInput =
    document.getElementById(
      "nextDriverName"
    );

  const help =
    document.getElementById(
      "nextDriverNameHelp"
    );

  if (
    !driverCheckbox ||
    !driverNameInput
  ) {
    return;
  }

  if (driverCheckbox.checked) {
    driverNameInput.value =
      outingCurrentUser &&
      outingCurrentUser.employeeName
        ? outingCurrentUser.employeeName
        : "";

    driverNameInput.disabled = true;

    if (help) {
      help.textContent =
        "入力者本人を運転手として登録します";
    }

  } else {
    const currentEmployeeName =
      outingCurrentUser &&
      outingCurrentUser.employeeName
        ? outingCurrentUser.employeeName
        : "";

    if (
      driverNameInput.disabled ||
      driverNameInput.value ===
        currentEmployeeName
    ) {
      driverNameInput.value = "";
    }

    driverNameInput.disabled = false;

    if (help) {
      help.textContent =
        "入力者本人が運転しない場合に入力してください";
    }
  }
}

/**
 * 外出支援の現在状態を
 * 1行または2行の案内として表示します。
 */
function updateOutingCurrentStatus_(
  activeOuting
) {
  const statusText =
    document.getElementById(
      "outingCurrentStatusText"
    );

  if (
    !statusText ||
    !activeOuting
  ) {
    return;
  }

  if (
    activeOuting.movementStatus ===
    "待機中"
  ) {
    const currentPlace =
      String(
        activeOuting.currentPlace || ""
      ).trim();

    statusText.textContent =
      currentPlace
        ? (
            "現在、" +
            currentPlace +
            "で待機中です"
          )
        : "現在、到着地点で待機中です";

    return;
  }

  if (
    activeOuting.movementStatus ===
    "移動中"
  ) {
    statusText.textContent =
      "現在、目的地へ移動中です";

    return;
  }

  statusText.textContent =
    "現在、外出支援を実施中です";
}


