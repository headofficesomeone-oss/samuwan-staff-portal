let clientListCache = null;
let pendingShiftRequestData = null;
let currentUser = null;
let currentConflictResult = null;
let selectedConflictIndex = -1;

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = getSavedPortalUser();

  if (!currentUser || !currentUser.employeeName) {
    alert("本人情報を確認できません。職員ポータルから開き直してください。");
    location.href = "./index.html";
    return;
  }

  const nameArea = document.getElementById("iraiUserName");
  if (nameArea) {
    nameArea.textContent = currentUser.employeeName + " さん";
  }

  const form = document.getElementById("shiftRequestForm");
  if (form) {
    form.addEventListener("submit", handleShiftRequestSubmit);
  }

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

  document.getElementById("singleDateArea")
    .classList.toggle("hidden", checked.value !== "single");

  document.getElementById("repeatDateArea")
    .classList.toggle("hidden", checked.value === "single");
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
  const destination = document.getElementById("destination").value.trim();
  const meetingPlace = document.getElementById("meetingPlace").value.trim();
  const transportation = document.getElementById("transportation").value.trim();
  const specialNotes = document.getElementById("specialNotes").value.trim();

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
    const weekdays = Array.from(
      document.querySelectorAll('input[name="weekday"]:checked')
    ).map(cb => Number(cb.value));

    if (!startDate || !endDate || weekdays.length === 0) {
      setPageMessage("開始日、終了日、曜日を入力してください。", "error", "shiftRequestForm");
      return;
    }

    requests = createRepeatDates(startDate, endDate, weekdays);

    if (requests.length === 0) {
      setPageMessage("指定した期間と曜日に該当する日がありません。", "error", "shiftRequestForm");
      return;
    }
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
    requests,
    requestKind: "新規",
    relatedShiftId: "",
    conflictType: "なし",
    conflictConfirmation: "不要"
  };

  currentConflictResult = null;
  selectedConflictIndex = -1;
  removePageMessage();
  showShiftConfirm(pendingShiftRequestData);
}

function createRepeatDates(startDate, endDate, weekdays) {
  const result = [];
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  for (
    let date = new Date(start);
    date <= end;
    date.setDate(date.getDate() + 1)
  ) {
    if (weekdays.includes(date.getDay())) {
      result.push({ date: formatDate(date) });
    }
  }

  return result;
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function showShiftConfirm(data) {
  const datesHtml = data.requests
    .map(req => `<div>${escapeHtml(req.date)}</div>`)
    .join("");

  document.getElementById("shiftConfirmContent").innerHTML = `
    <div class="confirm-row"><div class="confirm-label">報告者</div><div>${escapeHtml(data.reporter)}</div></div>
    <div class="confirm-row"><div class="confirm-label">利用者</div><div>${escapeHtml(data.clientName)}</div></div>
    <div class="confirm-row"><div class="confirm-label">区分</div><div>${escapeHtml(data.requestType)}</div></div>
    <div class="confirm-row"><div class="confirm-label">対象日</div><div>${data.requests.length}件</div><div class="date-list">${datesHtml}</div></div>
    <div class="confirm-row"><div class="confirm-label">時間</div><div>${escapeHtml(data.startTime)} ～ ${escapeHtml(data.endTime || "未入力")}</div></div>
    <div class="confirm-row"><div class="confirm-label">行き先場所</div><div>${escapeHtml(data.destination || "未入力")}</div></div>
    <div class="confirm-row"><div class="confirm-label">待合せ場所</div><div>${escapeHtml(data.meetingPlace || "未入力")}</div></div>
    <div class="confirm-row"><div class="confirm-label">移動手段</div><div>${escapeHtml(data.transportation || "未入力")}</div></div>
    <div class="confirm-row"><div class="confirm-label">特記事項</div><div>${escapeHtml(data.specialNotes || "未入力")}</div></div>`;

  showOnlyArea("shiftConfirmArea");
}

async function checkAndSubmitShiftRequest() {
  if (!pendingShiftRequestData) {
    alert("登録するデータがありません。");
    return;
  }

  const button = document.getElementById("submitShiftRequestButton");
  setButtonLoading(button, true, "重複を確認中です…");

  try {
    const checkPayload = {
      ...pendingShiftRequestData,
      action: "checkShiftRequestConflicts"
    };

    const result = await postGas(checkPayload);

    if (!result.success) {
      alert(result.message || "重複確認に失敗しました。");
      return;
    }

    const conflicts = Array.isArray(result.conflicts)
      ? result.conflicts
      : [];

    if (conflicts.length === 0) {
      pendingShiftRequestData.requestKind = "新規";
      pendingShiftRequestData.relatedShiftId = "";
      pendingShiftRequestData.conflictType = "なし";
      pendingShiftRequestData.conflictConfirmation = "不要";
      await savePendingShiftRequest(button);
      return;
    }

    currentConflictResult = result;
    selectedConflictIndex = -1;
    showConflictArea(result);

  } catch (error) {
    alert("重複確認に失敗しました：" + error.message);

  } finally {
    setButtonLoading(button, false);
  }
}

function showConflictArea(result) {
  const conflicts = Array.isArray(result.conflicts)
    ? result.conflicts
    : [];

  const newRequest = pendingShiftRequestData;

  document.getElementById("shiftConflictSummary").innerHTML = `
    <strong>${conflicts.length}件の重複・近接予定が見つかりました。</strong><br>
    変更依頼として登録する場合は、対象となる基本シフトを1件選択してください。`;

  const newBox = `
    <div class="compare-new-box">
      <h3>今回入力した依頼</h3>
      <div>${escapeHtml(newRequest.clientName)}／${escapeHtml(newRequest.requestType)}</div>
      <div>${escapeHtml(newRequest.startTime)} ～ ${escapeHtml(newRequest.endTime || "未入力")}</div>
      <div>${escapeHtml(newRequest.destination || "行き先未入力")}／${escapeHtml(newRequest.transportation || "移動手段未入力")}</div>
    </div>`;

  const cards = conflicts.map((item, index) => {
    const canSelect = item.source === "基本シフト" && item.shiftId;
    const selectText = canSelect
      ? "変更依頼の対象として選択できます"
      : "依頼情報のため、変更依頼の対象シフトには選択できません";

    return `
      <article class="conflict-card" data-index="${index}" ${canSelect ? `onclick="selectConflict(${index})"` : ""}>
        <div class="conflict-card-header">
          <span class="conflict-source">${escapeHtml(item.source || "予定")}</span>
          <span class="conflict-badge">${escapeHtml(item.conflictType || "重複")}</span>
        </div>
        <dl class="conflict-grid">
          <dt>日付</dt><dd>${escapeHtml(item.date || "")}</dd>
          <dt>時間</dt><dd>${escapeHtml(item.startTime || "")} ～ ${escapeHtml(item.endTime || "")}</dd>
          <dt>サービス</dt><dd>${escapeHtml(item.service || "")}</dd>
          <dt>行き先</dt><dd>${escapeHtml(item.destination || "未入力")}</dd>
          <dt>移動手段</dt><dd>${escapeHtml(item.transport || "未入力")}</dd>
          <dt>シフトＩＤ</dt><dd>${escapeHtml(item.shiftId || "なし")}</dd>
        </dl>
        <div class="conflict-select-note">${escapeHtml(selectText)}</div>
      </article>`;
  }).join("");

  document.getElementById("shiftConflictList").innerHTML = newBox + cards;

  document.querySelectorAll('input[name="conflictAction"]').forEach(input => {
    input.checked = false;
  });

  showOnlyArea("shiftConflictArea");
}

function selectConflict(index) {
  const conflicts = currentConflictResult?.conflicts || [];
  const item = conflicts[index];

  if (!item || item.source !== "基本シフト" || !item.shiftId) {
    return;
  }

  selectedConflictIndex = index;

  document.querySelectorAll(".conflict-card").forEach(card => {
    card.classList.toggle(
      "selected",
      Number(card.dataset.index) === index
    );
  });
}

async function registerAfterConflictChoice() {
  if (!pendingShiftRequestData || !currentConflictResult) {
    alert("重複確認データがありません。");
    return;
  }

  const action = document.querySelector('input[name="conflictAction"]:checked')?.value;

  if (!action) {
    alert("登録方法を選択してください。");
    return;
  }

  const conflicts = currentConflictResult.conflicts || [];
  const conflictTypes = [...new Set(
    conflicts.map(item => item.conflictType).filter(Boolean)
  )];

  if (action === "change") {
    const selected = conflicts[selectedConflictIndex];

    if (!selected || selected.source !== "基本シフト" || !selected.shiftId) {
      alert("変更依頼の対象となる基本シフトを1件選択してください。");
      return;
    }

    pendingShiftRequestData.requestKind = "変更依頼";
    pendingShiftRequestData.relatedShiftId = selected.shiftId;
    pendingShiftRequestData.conflictConfirmation = "登録者確認済";

  } else {
    pendingShiftRequestData.requestKind = "新規";
    pendingShiftRequestData.relatedShiftId = "";
    pendingShiftRequestData.conflictConfirmation = "別依頼として確認済";
  }

  pendingShiftRequestData.conflictType =
    conflictTypes.join("・") || "重複あり";

  const button = document.getElementById("registerConflictButton");
  await savePendingShiftRequest(button);
}

async function savePendingShiftRequest(button) {
  const targetButton = button || document.getElementById("submitShiftRequestButton");
  setButtonLoading(targetButton, true, "登録中です…");

  try {
    const savePayload = {
      ...pendingShiftRequestData,
      action: "saveShiftRequest"
    };

    const result = await postGas(savePayload);

    if (!result.success) {
      alert(result.message || "登録に失敗しました。");
      return;
    }

    document.getElementById("shiftRequestForm").reset();
    changeRequestMode();
    pendingShiftRequestData = null;
    currentConflictResult = null;
    selectedConflictIndex = -1;

    document.getElementById("shiftCompleteMessage").textContent =
      result.message || "依頼内容を登録しました。";

    showOnlyArea("shiftCompleteArea");

  } catch (error) {
    alert("シフト依頼の登録に失敗しました：" + error.message);

  } finally {
    setButtonLoading(targetButton, false);
  }
}

function setButtonLoading(button, loading, loadingText) {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.classList.add("loading");
    button.textContent = loadingText || "処理中です…";
    return;
  }

  button.disabled = false;
  button.classList.remove("loading");

  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

function showOnlyArea(areaId) {
  [
    "shiftRequestArea",
    "shiftConfirmArea",
    "shiftConflictArea",
    "shiftCompleteArea"
  ].forEach(id => {
    document.getElementById(id)?.classList.toggle("hidden", id !== areaId);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function backToShiftRequest() {
  showOnlyArea("shiftRequestArea");
}

function backToConfirmFromConflict() {
  showOnlyArea("shiftConfirmArea");
}

function backToShiftRequestFromConflict() {
  currentConflictResult = null;
  selectedConflictIndex = -1;
  showOnlyArea("shiftRequestArea");
}

function continueShiftRequest() {
  showOnlyArea("shiftRequestArea");
  loadClientList();
}

function backToPortal() {
  location.href = "./index.html";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
