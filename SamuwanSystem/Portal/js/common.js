const APP = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbzzjinunR8vsF83ZiPZ2g0v7rc5QoCYDmloBpMyvUMIey0oaMTYPKgG_7Zw1DMC-5T8/exec",  // 新しいGAS WebアプリURL
  LIFF_ID: "2009935343-GyNpF9lj",
  STORAGE_KEY: "samuwan_portal_user_v5",
  WORK_STATUS_KEY: "samuwan_work_status_v1",
  ACTION_STATUS_KEY: "samuwan_action_status_v1",
  VERSION: "20260824-1534-phase7"
};

async function apiPost(action, payload = {}) {
  if (!APP.GAS_URL) {
    throw new Error("common.js の APP.GAS_URL が未設定です");
  }

  const gasUrl = String(APP.GAS_URL).trim();

  if (gasUrl.includes("script.googleusercontent.com")) {
    throw new Error(
      "GAS_URLに一時的なgoogleusercontent URLが設定されています。"
      + "GASのデプロイ画面に表示される https://script.google.com/macros/s/.../exec を設定してください。"
    );
  }

  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(gasUrl)) {
    throw new Error(
      "GAS_URLがWebアプリの /exec URLではありません。"
      + "デプロイ画面の「ウェブアプリURL」を設定してください。"
    );
  }

  const response = await fetch(gasUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      ...payload
    })
  });

  if (!response.ok) {
    throw new Error(`通信エラー HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data && data.success === false) {
    throw new Error(data.message || "処理に失敗しました");
  }

  if (data && data.ok === false) {
    throw new Error(data.error || "処理に失敗しました");
  }

  return data;
}

function getSavedPortalUser() {
  try {
    return JSON.parse(localStorage.getItem(APP.STORAGE_KEY) || "null");
  } catch (_) {
    return null;
  }
}

function savePortalUser(user) {
  localStorage.setItem(APP.STORAGE_KEY, JSON.stringify(user));
}

function clearPortalUser() {
  localStorage.removeItem(APP.STORAGE_KEY);
}

function saveWorkStatus(status) {
  try {
    sessionStorage.setItem(APP.WORK_STATUS_KEY, JSON.stringify(status || null));
  } catch (_) {}
}

function getWorkStatusCache() {
  try {
    return JSON.parse(sessionStorage.getItem(APP.WORK_STATUS_KEY) || "null");
  } catch (_) {
    return null;
  }
}

function clearWorkStatusCache() {
  try {
    sessionStorage.removeItem(APP.WORK_STATUS_KEY);
  } catch (_) {}
}

function saveActionStatusCache(status) {
  try {
    sessionStorage.setItem(APP.ACTION_STATUS_KEY, JSON.stringify({
      savedAt: Date.now(),
      status: status || null
    }));
  } catch (_) {}
}

function getActionStatusCache() {
  try {
    const raw = sessionStorage.getItem(APP.ACTION_STATUS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.savedAt || Date.now() - parsed.savedAt > 10 * 60 * 1000) {
      sessionStorage.removeItem(APP.ACTION_STATUS_KEY);
      return null;
    }
    return parsed.status || null;
  } catch (_) {
    return null;
  }
}

function clearActionStatusCache() {
  try {
    sessionStorage.removeItem(APP.ACTION_STATUS_KEY);
  } catch (_) {}
}

function show(el, visible) {
  if (el) el.classList.toggle("hidden", !visible);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text ?? "";
}

function navigateTo(fileName) {
  window.location.href = fileName;
}
