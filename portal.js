let currentUser = null;
let currentLineProfile = null;

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("registerForm");
  if (form) form.addEventListener("submit", handleRegister);

  currentLineProfile = await initLiff();

  if (currentLineProfile && currentLineProfile.lineId) {
    const loginResult = await loginByLineId(currentLineProfile.lineId);
    if (loginResult.success) {
      currentUser = {
        employeeId: loginResult.employeeId,
        employeeName: loginResult.employeeName
      };
      savePortalUser(currentUser);
      showPortalAreaDirect();
      return;
    }
  }

  currentUser = getSavedPortalUser();
  if (currentUser) {
    showPortalAreaDirect();
  } else {
    loadEmployeeList();
  }
});

async function handleRegister(event) {
  event.preventDefault();
  const employeeName = document.getElementById("employeeName").value;
  const tempId = document.getElementById("tempId").value;

  if (!currentLineProfile || !currentLineProfile.lineId) {
    alert("LINE情報を取得できません。LINEから開き直してください。");
    return;
  }
  if (!employeeName || !tempId) {
    setPageMessage("氏名と仮登録IDを入力してください。", "error", "registerForm");
    return;
  }

  try {
    setPageMessage("登録処理中です。", "success", "registerForm");
    const result = await postGas({
      action: "registerLineId",
      employeeName,
      tempId,
      lineId: currentLineProfile.lineId,
      lineName: currentLineProfile.lineName
    });

    if (result.success) {
      currentUser = {
        employeeId: result.employeeId,
        employeeName: result.employeeName
      };
      savePortalUser(currentUser);
      showCompleteArea(result.message);
    } else {
      setPageMessage(result.message, "error", "registerForm");
    }
  } catch (error) {
    setPageMessage("通信に失敗しました。", "error", "registerForm");
    console.error(error);
  }
}

function showCompleteArea(message) {
  document.getElementById("registerArea")?.classList.add("hidden");
  document.getElementById("completeArea")?.classList.remove("hidden");
  const el = document.getElementById("registerCompleteMessage");
  if (el) el.textContent = message || "LINE IDの登録が完了しました。";
}

function showPortalArea() {
  document.getElementById("completeArea")?.classList.add("hidden");
  removePageMessage();
  showPortalAreaDirect();
}

function showPortalAreaDirect() {
  document.getElementById("registerArea")?.classList.add("hidden");
  document.getElementById("portalArea")?.classList.remove("hidden");
  showPortalUserName();
}

async function loadEmployeeList() {
  const select = document.getElementById("employeeName");
  if (!select) return;
  try {
    const result = await postGas({ action: "getEmployeeList" });
    select.innerHTML = '<option value="">氏名を選択してください</option>';
    if (!result.success) {
      setPageMessage(result.message || "職員一覧の取得に失敗しました。", "error", "registerForm");
      return;
    }
    (result.employees || []).forEach(employee => {
      const option = document.createElement("option");
      option.value = employee.name;
      option.textContent = employee.name;
      select.appendChild(option);
    });
  } catch (error) {
    select.innerHTML = '<option value="">取得失敗</option>';
    setPageMessage("職員一覧の取得に失敗しました。" + error.message, "error", "registerForm");
  }
}

function goShiftRequest() {
  location.href = "./irai.html";
}

function logoutPortal() {
  clearPortalUser();
  currentUser = null;
  location.reload();
}

function showPortalUserName() {
  const el = document.getElementById("portalUserName");
  if (el && currentUser) el.textContent = currentUser.employeeName + " さん";
}

async function initLiff() {
  try {
    await liff.init({ liffId: LIFF_ID });
    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile();
      return { lineId: profile.userId, lineName: profile.displayName };
    }
    liff.login();
    return null;
  } catch (error) {
    console.error("LIFF初期化エラー:", error);
    return null;
  }
}

async function loginByLineId(lineId) {
  try {
    return await postGas({ action: "loginByLineId", lineId });
  } catch (error) {
    console.error("LINE IDログインエラー:", error);
    return { success: false, message: "ログイン確認に失敗しました。" };
  }
}

async function issueTempIdFromScreen() {
  const employeeName = document.getElementById("employeeName").value;
  if (!employeeName) {
    alert("氏名を選択してください。");
    return;
  }
  if (!currentLineProfile || !currentLineProfile.lineId) {
    alert("LINE情報を取得できません。LINEから開き直してください。");
    return;
  }
  try {
    const result = await postGas({
      action: "issueTempId",
      employeeName,
      lineId: currentLineProfile.lineId
    });
    if (result.success) {
      alert("LINEに仮登録IDを送信しました。LINEのメッセージを確認してください。");
      if (liff.isInClient()) liff.closeWindow();
    } else {
      alert(result.message);
    }
  } catch (error) {
    alert("仮登録IDの発行に失敗しました：" + error.message);
  }
}
