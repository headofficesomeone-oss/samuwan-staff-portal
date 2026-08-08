let officeUser = null;
let shiftWeeks = { prev: null, current: null, next: null };
let activeShiftKey = "current";
let currentPdfObjectUrl = "";

const SHIFT_LABELS = {
  prev: "前週",
  current: "今週",
  next: "来週"
};

document.addEventListener("DOMContentLoaded", initializeOfficePage);

async function initializeOfficePage() {
  officeUser = getSavedPortalUser();

  if (!officeUser) {
    document.getElementById("officeAuthError").classList.remove("hidden");
    return;
  }

  document.getElementById("officeUserName").textContent = officeUser.employeeName;
  document.getElementById("openOfficeModalButton").classList.remove("hidden");
  document.getElementById("shiftArea").classList.remove("hidden");

  await loadShiftList();
}

async function loadShiftList() {
  showShiftLoading(true);

  try {
    const result = await postGas({
      action: "getShiftPdfList",
      employeeId: officeUser.employeeId,
      employeeName: officeUser.employeeName
    });

    if (!result || result.success !== true) {
      throw new Error(result && result.message ? result.message : "シフト一覧を取得できませんでした。");
    }

    shiftWeeks = result.weeks || { prev: null, current: null, next: null };
    updateShiftTabs();

    if (shiftWeeks.current) {
      activeShiftKey = "current";
    } else if (shiftWeeks.next) {
      activeShiftKey = "next";
    } else if (shiftWeeks.prev) {
      activeShiftKey = "prev";
    }

    await selectShiftTab(activeShiftKey);

  } catch (error) {
    showShiftLoading(false);
    showShiftEmpty(error.message || "シフトを取得できませんでした。");
  }
}

function updateShiftTabs() {
  ["prev", "current", "next"].forEach((key) => {
    const button = document.getElementById(
      key === "prev" ? "shiftTabPrev" : key === "current" ? "shiftTabCurrent" : "shiftTabNext"
    );

    button.disabled = !shiftWeeks[key];
    button.classList.toggle("has-file", !!shiftWeeks[key]);
  });
}

async function selectShiftTab(key) {
  activeShiftKey = key;

  document.querySelectorAll(".shift-tab").forEach((button) => {
    button.classList.remove("active");
  });

  const tabId = key === "prev" ? "shiftTabPrev" : key === "current" ? "shiftTabCurrent" : "shiftTabNext";
  document.getElementById(tabId).classList.add("active");

  const info = shiftWeeks[key];

  if (!info) {
    clearShiftPdf();
    document.getElementById("shiftTitle").textContent = SHIFT_LABELS[key] + "のシフト";
    document.getElementById("shiftUpdated").textContent = "";
    showShiftEmpty("この週のシフトPDFはありません。");
    return;
  }

  document.getElementById("shiftTitle").textContent = SHIFT_LABELS[key] + "のシフト（" + info.baseDateDisplay + "～）";
  document.getElementById("shiftUpdated").textContent = "更新：" + info.updatedDisplay;

  showShiftEmpty("");
  showShiftLoading(true);

  try {
    const result = await postGas({
      action: "getShiftPdfData",
      employeeId: officeUser.employeeId,
      employeeName: officeUser.employeeName,
      fileId: info.fileId
    });

    if (!result || result.success !== true) {
      throw new Error(result && result.message ? result.message : "PDFを取得できませんでした。");
    }

    setShiftPdfFromBase64(result.base64, result.mimeType || "application/pdf");
    showShiftLoading(false);

  } catch (error) {
    showShiftLoading(false);
    clearShiftPdf();
    showShiftEmpty(error.message || "PDFを表示できませんでした。");
  }
}

function setShiftPdfFromBase64(base64, mimeType) {
  if (currentPdfObjectUrl) {
    URL.revokeObjectURL(currentPdfObjectUrl);
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: mimeType });
  currentPdfObjectUrl = URL.createObjectURL(blob);

  document.getElementById("shiftPdfFrame").src = currentPdfObjectUrl + "#toolbar=0&navpanes=0";
  document.getElementById("shiftPdfTapArea").classList.remove("hidden");
}

function clearShiftPdf() {
  document.getElementById("shiftPdfFrame").src = "about:blank";
  document.getElementById("shiftPdfTapArea").classList.add("hidden");

  if (currentPdfObjectUrl) {
    URL.revokeObjectURL(currentPdfObjectUrl);
    currentPdfObjectUrl = "";
  }
}

function showShiftLoading(visible) {
  document.getElementById("shiftLoading").classList.toggle("hidden", !visible);
  if (visible) {
    document.getElementById("shiftPdfTapArea").classList.add("hidden");
  }
}

function showShiftEmpty(message) {
  const area = document.getElementById("shiftEmpty");
  area.textContent = message || "";
  area.classList.toggle("hidden", !message);
}

function openShiftFullscreen() {
  if (!currentPdfObjectUrl) return;

  document.getElementById("shiftFullFrame").src = currentPdfObjectUrl;
  document.getElementById("shiftFullscreen").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeShiftFullscreen() {
  document.getElementById("shiftFullscreen").classList.add("hidden");
  document.getElementById("shiftFullFrame").src = "about:blank";
  document.body.classList.remove("modal-open");
}

function openOfficeModal() {
  document.getElementById("officeResultArea").className = "office-message hidden";
  document.getElementById("officeResultArea").textContent = "";
  document.getElementById("officeModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeOfficeModal() {
  document.getElementById("officeModal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

async function sendSimpleOfficeAction(actionType) {
  if (!officeUser) return;

  if (!confirm(actionType + "を記録しますか？")) {
    return;
  }

  setButtonsDisabled(true);
  showSending(true);

  try {
    const result = await postGas({
      action: "recordOfficeAction",
      employeeId: officeUser.employeeId,
      employeeName: officeUser.employeeName,
      actionType: actionType,
      deviceTime: new Date().toISOString(),
      sendId: createSimpleOfficeSendId(officeUser.employeeId, actionType),
      registrationMethod: "簡易事務所画面",
      note: ""
    });

    showSending(false);
    showResult(result.message || "登録しました。", result.success);

    if (result.success) {
      setTimeout(closeOfficeModal, 1200);
    }

  } catch (error) {
    showSending(false);
    showResult(error.message, false);
  }

  setButtonsDisabled(false);
}

function setButtonsDisabled(disabled) {
  document.getElementById("simpleOfficeOpenButton").disabled = disabled;
  document.getElementById("simpleOfficeCloseButton").disabled = disabled;
}

function showSending(visible) {
  document.getElementById("officeSendingArea").classList.toggle("hidden", !visible);
}

function showResult(message, success) {
  const area = document.getElementById("officeResultArea");
  area.classList.remove("hidden");
  area.textContent = message;
  area.className = "office-message " + (success ? "office-success" : "office-error");
}

function createSimpleOfficeSendId(employeeId, actionType) {
  return [
    "OFFICE",
    employeeId,
    actionType,
    Date.now(),
    Math.random().toString(36).substring(2, 10)
  ].join("-");
}
