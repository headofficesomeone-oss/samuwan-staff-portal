const APP = { GAS_URL: "https://script.google.com/macros/s/AKfycbzzjinunR8vsF83ZiPZ2g0v7rc5QoCYDmloBpMyvUMIey0oaMTYPKgG_7Zw1DMC-5T8/exec", LIFF_ID: "2009935343-GyNpF9lj", STORAGE_KEY: "samuwan_portal_user_v4" };
async function apiPost(action, payload = {}) {
  if (!APP.GAS_URL) throw new Error("common.js の APP.GAS_URL が未設定です");
  const response = await fetch(APP.GAS_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,...payload})});
  if (!response.ok) throw new Error(`通信エラー HTTP ${response.status}`);
  const data=await response.json();
  if (data && data.success === false) throw new Error(data.message || "処理に失敗しました");
  if (data && data.ok === false) throw new Error(data.error || "処理に失敗しました");
  return data;
}
function getSavedPortalUser(){try{return JSON.parse(localStorage.getItem(APP.STORAGE_KEY)||"null");}catch(_){return null;}}
function savePortalUser(user){localStorage.setItem(APP.STORAGE_KEY,JSON.stringify(user));}
function clearPortalUser(){localStorage.removeItem(APP.STORAGE_KEY);}
function show(el,visible){if(el)el.classList.toggle("hidden",!visible);}
function setText(id,text){const el=document.getElementById(id);if(el)el.textContent=text??"";}
function navigateTo(fileName){window.location.href=fileName;}
