let clientListCache = null;
let pendingShiftRequestData = null;
let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = getSavedPortalUser();
  if (!currentUser || !currentUser.employeeName) {
    alert("本人情報を確認できません。職員ポータルから開き直してください。");
    location.href = "./index.html";
    return;
  }

  const nameArea = document.getElementById("iraiUserName");
  if (nameArea) nameArea.textContent = currentUser.employeeName + " さん";

  const form = document.getElementById("shiftRequestForm");
  if (form) form.addEventListener("submit", handleShiftRequestSubmit);

  await loadClientList();
  changeRequestMode();
});

async function loadClientList() {
  const select = document.getElementById("clientName");
  if (!select) return;
  if (clientListCache) {
    setClientOptions(clientListCache);
    return;
  }
  select.innerHTML = '<option value="">読み込み中...</option>';
  select.disabled = true;
  try {
    const result = await postGas({ action: "getClientList" });
    if (!result.success) {
      setPageMessage("利用者一覧の取得に失敗しました。", "error", "shiftRequestForm");
      return;
    }
    clientListCache = result.clients || [];
    setClientOptions(clientListCache);
  } catch (error) {
    select.innerHTML = '<option value="">取得失敗</option>';
    setPageMessage("利用者一覧の取得に失敗しました。", "error", "shiftRequestForm");
  } finally {
    select.disabled = false;
  }
}

function setClientOptions(clients) {
  const select = document.getElementById("clientName");
  if (!select) return;
  select.innerHTML = '<option value="">利用者を選択してください</option>';
  clients.forEach(client => {
    const option = document.createElement("option");
    option.value = client.clientId;
    option.textContent = client.name;
    select.appendChild(option);
  });
}

function changeRequestMode() {
  const checked = document.querySelector('input[name="requestMode"]:checked');
  if (!checked) return;
  document.getElementById("singleDateArea").classList.toggle("hidden", checked.value !== "single");
  document.getElementById("repeatDateArea").classList.toggle("hidden", checked.value === "single");
}

async function handleShiftRequestSubmit(event) {
  event.preventDefault();
  if (!currentUser || !currentUser.employeeName) {
    alert("本人情報を確認できません。職員ポータルから開き直してください。");
    return;
  }

  const mode = document.querySelector('input[name="requestMode"]:checked').value;
  const clientSelect = document.getElementById("clientName");
  const clientId = clientSelect.value;
  const clientName = clientSelect.options[clientSelect.selectedIndex]?.text || "";
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
      setPageMessage("日時を入力してください。", "error", "shiftRequestForm");
      return;
    }
    requests.push({ date: requestDate });
  } else {
    const startDate = document.getElementById("periodStartDate").value;
    const endDate = document.getElementById("periodEndDate").value;
    const weekdays = Array.from(document.querySelectorAll('input[name="weekday"]:checked')).map(cb => Number(cb.value));
    if (!startDate || !endDate || weekdays.length === 0) {
      setPageMessage("開始日、終了日、曜日を入力してください。", "error", "shiftRequestForm");
      return;
    }
    requests = createRepeatDates(startDate, endDate, weekdays);
  }

  pendingShiftRequestData = {
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
  removePageMessage();
  showShiftConfirm(pendingShiftRequestData);
}

function createRepeatDates(startDate, endDate, weekdays) {
  const result = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    if (weekdays.includes(date.getDay())) result.push({ date: formatDate(date) });
  }
  return result;
}

function formatDate(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function showShiftConfirm(data) {
  const datesHtml = data.requests.map(req => `<div>${req.date}</div>`).join("");
  document.getElementById("shiftConfirmContent").innerHTML = `
    <div class="confirm-row"><div class="confirm-label">報告者</div><div>${data.reporter}</div></div>
    <div class="confirm-row"><div class="confirm-label">利用者</div><div>${data.clientName}</div></div>
    <div class="confirm-row"><div class="confirm-label">区分</div><div>${data.requestType}</div></div>
    <div class="confirm-row"><div class="confirm-label">対象日</div><div>${data.requests.length}件</div><div class="date-list">${datesHtml}</div></div>
    <div class="confirm-row"><div class="confirm-label">時間</div><div>${data.startTime} ～ ${data.endTime || "未入力"}</div></div>
    <div class="confirm-row"><div class="confirm-label">行き先場所</div><div>${data.destination || "未入力"}</div></div>
    <div class="confirm-row"><div class="confirm-label">待合せ場所</div><div>${data.meetingPlace || "未入力"}</div></div>
    <div class="confirm-row"><div class="confirm-label">移動手段</div><div>${data.transportation || "未入力"}</div></div>
    <div class="confirm-row"><div class="confirm-label">特記事項</div><div>${data.specialNotes || "未入力"}</div></div>`;
  document.getElementById("shiftRequestArea").classList.add("hidden");
  document.getElementById("shiftConfirmArea").classList.remove("hidden");
}

async function submitShiftRequest() {
  if (!pendingShiftRequestData) {
    alert("登録するデータがありません。");
    return;
  }
  const button = document.getElementById("submitShiftRequestButton");
  const originalText = button.textContent;
  button.disabled = true;
  button.classList.add("loading");
  button.textContent = "登録中です…";
  try {
    const result = await postGas(pendingShiftRequestData);
    if (result.success) {
      document.getElementById("shiftRequestForm").reset();
      changeRequestMode();
      pendingShiftRequestData = null;
      document.getElementById("shiftConfirmArea").classList.add("hidden");
      document.getElementById("shiftCompleteMessage").textContent = result.message;
      document.getElementById("shiftCompleteArea").classList.remove("hidden");
    } else {
      alert(result.message);
    }
  } catch (error) {
    alert("シフト依頼の登録に失敗しました：" + error.message);
  } finally {
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

function backToPortal() {
  location.href = "./index.html";
}
