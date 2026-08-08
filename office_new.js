let officeUser = null;
let shiftWeeks = { prev: null, current: null, next: null };
let activeShiftKey = "current";
let currentPdfBase64 = "";
let pdfRenderGeneration = 0;

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

  if (typeof pdfjsLib === "undefined") {
    document.getElementById("shiftArea").classList.remove("hidden");
    showShiftLoading(false);
    showShiftEmpty("PDF表示ライブラリを読み込めませんでした。通信状態を確認してください。");
    return;
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

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

  document.getElementById("shiftTitle").textContent =
    SHIFT_LABELS[key] + "のシフト（" + info.baseDateDisplay + "～）";
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

    await setShiftPdfFromBase64(result.base64);
    showShiftLoading(false);

  } catch (error) {
    showShiftLoading(false);
    clearShiftPdf();
    showShiftEmpty(error.message || "PDFを表示できませんでした。");
  }
}

async function setShiftPdfFromBase64(base64) {
  currentPdfBase64 = base64 || "";

  if (!currentPdfBase64) {
    throw new Error("PDFデータが空です。");
  }

  document.getElementById("shiftPdfTapArea").classList.remove("hidden");
  await renderPdfInto("shiftPdfViewer", currentPdfBase64);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function renderPdfInto(containerId, base64) {
  const container = document.getElementById(containerId);
  const generation = ++pdfRenderGeneration;

  container.innerHTML = "";

  const bytes = base64ToUint8Array(base64);
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {
    if (generation !== pdfRenderGeneration) return;

    const page = await pdf.getPage(pageNumber);

    const baseViewport =
      page.getViewport({ scale: 1 });

    const availableWidth = Math.max(
      280,
      (container.clientWidth || window.innerWidth) - 8
    );

    // 画面上での表示倍率
    const displayScale =
      availableWidth / baseViewport.width;

    const displayViewport =
      page.getViewport({
        scale: displayScale
      });

    /*
     * スマホの高密度ディスプレイ対策
     *
     * devicePixelRatio が 3 や 4 の端末でも、
     * 重くなりすぎないよう最大2.5倍に制限
     */
    const outputScale = Math.min(
      window.devicePixelRatio || 1,
      2.5
    );

    const renderViewport =
      page.getViewport({
        scale:
          displayScale *
          outputScale
      });

    const canvas =
      document.createElement("canvas");

    canvas.className =
      "pdf-page-canvas";

    /*
     * 実際の描画解像度は高くする
     */
    canvas.width =
      Math.ceil(renderViewport.width);

    canvas.height =
      Math.ceil(renderViewport.height);

    /*
     * 画面上の大きさは今まで通り
     */
    canvas.style.width =
      Math.ceil(displayViewport.width) +
      "px";

    canvas.style.height =
      Math.ceil(displayViewport.height) +
      "px";

    container.appendChild(canvas);

    const context =
      canvas.getContext(
        "2d",
        { alpha: false }
      );

    await page.render({
      canvasContext: context,
      viewport: renderViewport
    }).promise;
  }
}


function clearShiftPdf() {
  currentPdfBase64 = "";
  pdfRenderGeneration++;

  document.getElementById("shiftPdfViewer").innerHTML = "";
  document.getElementById("shiftFullViewer").innerHTML = "";
  document.getElementById("shiftPdfTapArea").classList.add("hidden");
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

async function openShiftFullscreen() {
  if (!currentPdfBase64) return;

  document.getElementById("shiftFullscreen").classList.remove("hidden");
  document.body.classList.add("modal-open");

  try {
    await renderPdfInto("shiftFullViewer", currentPdfBase64);
  } catch (error) {
    document.getElementById("shiftFullViewer").textContent =
      error.message || "PDFを全画面表示できませんでした。";
  }
}

function closeShiftFullscreen() {
  pdfRenderGeneration++;
  document.getElementById("shiftFullscreen").classList.add("hidden");
  document.getElementById("shiftFullViewer").innerHTML = "";
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
