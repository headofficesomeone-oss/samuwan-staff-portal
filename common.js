const GAS_URL = "https://script.google.com/macros/s/AKfycbwoQp13Pi9DWYep8D-F9uUETF2YTjsXDBAwKTdGtclRqCZVuzfVtnJPPIbYhAV4b-YyZA/exec";
const LIFF_ID = "2009935343-GyNpF9lj";
const STAFF_PORTAL_USER_KEY = "staffPortalCurrentUser";

async function postGas2(data) {
  const response = await fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify(data)
  });
  return response.json();
}

function getSavedPortalUser() {
  const saved = localStorage.getItem(STAFF_PORTAL_USER_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error("保存済み利用者情報の読み込みに失敗しました。", error);
    localStorage.removeItem(STAFF_PORTAL_USER_KEY);
    return null;
  }
}

function savePortalUser(user) {
  localStorage.setItem(STAFF_PORTAL_USER_KEY, JSON.stringify(user));
}

function clearPortalUser() {
  localStorage.removeItem(STAFF_PORTAL_USER_KEY);
}

function setPageMessage(message, type, targetFormId = "") {
  let messageBox = document.getElementById("messageBox");
  if (!messageBox) {
    messageBox = document.createElement("div");
    messageBox.id = "messageBox";
    const targetForm = targetFormId
      ? document.getElementById(targetFormId)
      : document.querySelector("form");
    if (targetForm) targetForm.insertBefore(messageBox, targetForm.firstChild);
  }
  if (!messageBox) return;
  messageBox.textContent = message;
  messageBox.className = "message-box " + type;
}

function removePageMessage() {
  const messageBox = document.getElementById("messageBox");
  if (messageBox) messageBox.remove();
}
