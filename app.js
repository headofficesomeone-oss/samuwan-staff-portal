const GAS_URL = "https://script.google.com/macros/s/AKfycbwoQp13Pi9DWYep8D-F9uUETF2YTjsXDBAwKTdGtclRqCZVuzfVtnJPPIbYhAV4b-YyZA/exec";
let clientListCache = null;
let pendingShiftRequestData = null;
let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
    const savedUser = localStorage.getItem("staffPortalCurrentUser");

    if (savedUser) {
        currentUser = JSON.parse(savedUser);

		showPortalUserName();

        const registerArea = document.getElementById("registerArea");
        const portalArea = document.getElementById("portalArea");

        if (registerArea) registerArea.classList.add("hidden");
        if (portalArea) portalArea.classList.remove("hidden");
    } else {
        loadEmployeeList();
    }

    const form = document.getElementById("registerForm");
    if (form) form.addEventListener("submit", handleRegister);

    const shiftForm = document.getElementById("shiftRequestForm");
    if (shiftForm) shiftForm.addEventListener("submit", handleShiftRequestSubmit);
});

async function handleRegister(e) {
    e.preventDefault();

    const employeeName = document.getElementById("employeeName").value;
    const tempId = document.getElementById("tempId").value;

    const lineId = "TEST_LINE_ID_FROM_WEB";
    const lineName = "テスト表示名";

    if (!employeeName || !tempId) {
        showMessage("氏名と仮登録IDを入力してください。", "error");
        return;
    }

    const data = {
        action: "registerLineId",
        employeeName: employeeName,
        tempId: tempId,
        lineId: lineId,
        lineName: lineName
    };

    try {
        showMessage("登録処理中です。", "success");

        const response = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify(data)
        });

        const result = await response.json();
		console.log("登録結果:", result);

		if (result.success) {
		    currentUser = {
		        employeeId: result.employeeId,
		        employeeName: result.employeeName
		    };

		    console.log("現在の利用者:", currentUser);
    		localStorage.setItem("staffPortalCurrentUser", JSON.stringify(currentUser));
    
		    showCompleteArea(result.message);
		} else {
		    showMessage(result.message, "error");
		}

    } catch (error) {
        showMessage("通信に失敗しました。", "error");
        console.error(error);
    }
}

function showCompleteArea(message) {
    const registerArea = document.getElementById("registerArea");
    const completeArea = document.getElementById("completeArea");

    if (registerArea) registerArea.classList.add("hidden");
    if (completeArea) completeArea.classList.remove("hidden");

    showMessage(message || "登録が完了しました。", "success");
}

function showMessage(message, type) {
    let messageBox = document.getElementById("messageBox");

    if (!messageBox) {
        messageBox = document.createElement("div");
        messageBox.id = "messageBox";
        messageBox.className = "message-box";

        const form = document.getElementById("registerForm");
        form.insertBefore(messageBox, form.firstChild);
    }

    messageBox.textContent = message;
    messageBox.className = "message-box " + type;
}

async function loadEmployeeList() {
    const select = document.getElementById("employeeName");

    try {
        const response = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "getEmployeeList"
            })
        });

        const result = await response.json();
        console.log("職員一覧取得結果", result);

        select.innerHTML = "";

        const firstOption = document.createElement("option");
        firstOption.value = "";
        firstOption.textContent = "氏名を選択してください";
        select.appendChild(firstOption);

        if (!result.success) {
            showMessage(result.message || "職員一覧の取得に失敗しました。", "error");
            return;
        }

        result.employees.forEach(employee => {
            const option = document.createElement("option");
            option.value = employee.name;
            option.textContent = employee.name;
            select.appendChild(option);
        });

    } catch (error) {
        select.innerHTML = '<option value="">取得失敗</option>';
        showMessage("職員一覧の取得に失敗しました。" + error.message, "error");
        console.error(error);
    }
}

function showPortalArea() {
    const completeArea = document.getElementById("completeArea");
    const portalArea = document.getElementById("portalArea");
    const messageBox = document.getElementById("messageBox");

    if (completeArea) completeArea.classList.add("hidden");
    if (messageBox) messageBox.remove();
    if (portalArea) portalArea.classList.remove("hidden");

    showPortalUserName();
}

function goShiftRequest() {
    const portalArea = document.getElementById("portalArea");
    const shiftRequestArea = document.getElementById("shiftRequestArea");

    if (portalArea) portalArea.classList.add("hidden");
    if (shiftRequestArea) shiftRequestArea.classList.remove("hidden");
    
    loadClientList();
}

function backToPortal() {
    const portalArea = document.getElementById("portalArea");
    const shiftRequestArea = document.getElementById("shiftRequestArea");

    if (shiftRequestArea) shiftRequestArea.classList.add("hidden");
    if (portalArea) portalArea.classList.remove("hidden");
}

async function loadClientList() {
    const select = document.getElementById("clientName");

    if (clientListCache) {
        setClientOptions(clientListCache);
        return;
    }

    select.innerHTML = '<option value="">読み込み中...</option>';
    select.disabled = true;

    try {
        const response = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "getClientList"
            })
        });

        const result = await response.json();

        if (!result.success) {
            showMessage("利用者一覧の取得に失敗しました。", "error");
            return;
        }

        clientListCache = result.clients;
        setClientOptions(clientListCache);

    } catch (error) {
        select.innerHTML = '<option value="">取得失敗</option>';
        showMessage("利用者一覧の取得に失敗しました。", "error");

    } finally {
        select.disabled = false;
    }
}

function setClientOptions(clients) {
    const select = document.getElementById("clientName");

    select.innerHTML = "";

    const firstOption = document.createElement("option");
    firstOption.value = "";
    firstOption.textContent = "利用者を選択してください";
    select.appendChild(firstOption);

    clients.forEach(client => {
        const option = document.createElement("option");
        option.value = client.clientId;
        option.textContent = client.name;
        select.appendChild(option);
    });
}

function changeRequestMode() {
    const mode = document.querySelector('input[name="requestMode"]:checked').value;

    const singleDateArea = document.getElementById("singleDateArea");
    const repeatDateArea = document.getElementById("repeatDateArea");

    if (mode === "single") {
        singleDateArea.classList.remove("hidden");
        repeatDateArea.classList.add("hidden");
    } else {
        singleDateArea.classList.add("hidden");
        repeatDateArea.classList.remove("hidden");
    }
}

async function handleShiftRequestSubmit(e) {
    e.preventDefault();

	if (!currentUser || !currentUser.employeeName) {
	    alert("本人情報を確認できません。もう一度本人確認を行ってください。");
	    return;
	}
	
    const mode = document.querySelector('input[name="requestMode"]:checked').value;

    const clientSelect = document.getElementById("clientName");
    const clientId = clientSelect.value;
    const clientName = clientSelect.options[clientSelect.selectedIndex].text;

    const requestType = document.getElementById("requestType").value;
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;
    const destination = document.getElementById("destination").value;
    const meetingPlace = document.getElementById("meetingPlace").value;
    const transportation = document.getElementById("transportation").value;
    const specialNotes = document.getElementById("specialNotes").value;

    if (!clientId || !requestType || !startTime) {
        alert("未入力があります");
        return;
    }

    let requests = [];

    if (mode === "single") {
        const requestDate = document.getElementById("requestDate").value;

        if (!requestDate) {
            showMessage("日時を入力してください。", "error");
            return;
        }

        requests.push({
            date: requestDate
        });
    }

    if (mode === "repeat") {
        const startDate = document.getElementById("periodStartDate").value;
        const endDate = document.getElementById("periodEndDate").value;

        const weekdays = Array.from(
            document.querySelectorAll('input[name="weekday"]:checked')
        ).map(cb => Number(cb.value));

        if (!startDate || !endDate || weekdays.length === 0) {
            showMessage("開始日、終了日、曜日を入力してください。", "error");
            return;
        }

        requests = createRepeatDates(startDate, endDate, weekdays);
    }

    const data = {
        action: "saveShiftRequest",
		reporter: currentUser.employeeName,
        clientId,
        clientName,
        requestType,
        startTime,
        endTime,
        destination,
        meetingPlace,
        transportation,
        specialNotes,
        requests
    };

    pendingShiftRequestData = data;
    showShiftConfirm(data);
}

function createRepeatDates(startDate, endDate, weekdays) {
    const result = [];

    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (weekdays.includes(d.getDay())) {
            result.push({
                date: formatDate(d)
            });
        }
    }

    return result;
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function showShiftConfirm(data) {
    const shiftRequestArea = document.getElementById("shiftRequestArea");
    const shiftConfirmArea = document.getElementById("shiftConfirmArea");
    const content = document.getElementById("shiftConfirmContent");

    const datesHtml = data.requests
        .map(req => `<div>${req.date}</div>`)
        .join("");

    content.innerHTML = `
    <div class="confirm-row">
      <div class="confirm-label">利用者</div>
      <div>${data.clientName}</div>
    </div>

    <div class="confirm-row">
      <div class="confirm-label">区分</div>
      <div>${data.requestType}</div>
    </div>

    <div class="confirm-row">
      <div class="confirm-label">対象日</div>
      <div>${data.requests.length}件</div>
      <div class="date-list">${datesHtml}</div>
    </div>

    <div class="confirm-row">
      <div class="confirm-label">時間</div>
      <div>${data.startTime} ～ ${data.endTime || "未入力"}</div>
    </div>

    <div class="confirm-row">
      <div class="confirm-label">行き先場所</div>
      <div>${data.destination || "未入力"}</div>
    </div>

    <div class="confirm-row">
      <div class="confirm-label">待合せ場所</div>
      <div>${data.meetingPlace || "未入力"}</div>
    </div>

    <div class="confirm-row">
      <div class="confirm-label">移動手段</div>
      <div>${data.transportation || "未入力"}</div>
    </div>

    <div class="confirm-row">
      <div class="confirm-label">特記事項</div>
      <div>${data.specialNotes || "未入力"}</div>
    </div>
  `;

    shiftRequestArea.classList.add("hidden");
    shiftConfirmArea.classList.remove("hidden");
}

async function submitShiftRequest() {
  if (!pendingShiftRequestData) {
    showMessage("登録するデータがありません。", "error");
    return;
  }

  const button = document.getElementById("submitShiftRequestButton");
  const originalText = button.textContent;

  button.disabled = true;
  button.classList.add("loading");
  button.textContent = "登録中です…";

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(pendingShiftRequestData)
    });

    const result = await response.json();

	if (result.success) {
	    document.getElementById("shiftRequestForm").reset();
	    changeRequestMode();

	    pendingShiftRequestData = null;

	    const confirmArea = document.getElementById("shiftConfirmArea");
	    if (confirmArea) confirmArea.classList.add("hidden");

	    const completeMessage = document.getElementById("shiftCompleteMessage");
	    if (completeMessage) {
	        completeMessage.textContent = result.message;
	    }

	    const completeArea = document.getElementById("shiftCompleteArea");
	    if (completeArea) {
	        completeArea.classList.remove("hidden");
	    } else {
	        alert(result.message);
	    }

	    button.disabled = false;
	    button.classList.remove("loading");
	    button.textContent = originalText;

	} else {
	    alert(result.message);
	    button.disabled = false;
	    button.classList.remove("loading");
	    button.textContent = originalText;
	}

  } catch (error) {
    alert("シフト依頼の登録に失敗しました：" + error.message);
    button.disabled = false;
    button.classList.remove("loading");
    button.textContent = originalText;
  }
}

function backToShiftRequest() {
    document.getElementById("shiftConfirmArea").classList.add("hidden");
    document.getElementById("shiftRequestArea").classList.remove("hidden");
}

function continueShiftRequest() {
  document.getElementById("shiftCompleteArea").classList.add("hidden");
  document.getElementById("shiftRequestArea").classList.remove("hidden");

  loadClientList();
}

function backToPortalFromComplete() {
  const completeArea = document.getElementById("shiftCompleteArea");
  const portalArea = document.getElementById("portalArea");

  if (completeArea) completeArea.classList.add("hidden");
  if (portalArea) portalArea.classList.remove("hidden");
}

function logoutPortal() {
    localStorage.removeItem("staffPortalCurrentUser");
    currentUser = null;
    location.reload();
}

function showPortalUserName() {
  const nameArea = document.getElementById("portalUserName");

  if (nameArea && currentUser) {
    nameArea.textContent = currentUser.employeeName + " さん";
  }
}
