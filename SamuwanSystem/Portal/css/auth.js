let LINE_PROFILE = null;

async function initializeLineAuth() {
  setText("authMessage", "LINEを確認しています...");
  await liff.init({ liffId: APP.LIFF_ID });

  if (!liff.isLoggedIn()) {
    liff.login();
    return { pending: true };
  }

  LINE_PROFILE = await liff.getProfile();

  const loginResult = await apiPost("auth.line.login", {
    lineId: LINE_PROFILE.userId,
    lineDisplayName: LINE_PROFILE.displayName
  });

  if (loginResult.registered) {
    saveSession({
      employeeId: loginResult.staff.employeeId,
      employeeName: loginResult.staff.employeeName,
      lineId: LINE_PROFILE.userId,
      sessionToken: loginResult.sessionToken
    });
    return { registered: true };
  }

  await loadEmployeeChoices();
  show(document.getElementById("unregisteredView"), true);
  setText("authGuide", "このLINE IDは未登録です。職員を選択して仮登録IDを発行してください。");
  setText("authMessage", "");
  return { registered: false };
}

async function loadEmployeeChoices() {
  const result = await apiPost("auth.employee.list");
  const select = document.getElementById("employeeSelect");
  select.innerHTML = "";
  result.staffList.forEach(staff => {
    const option = document.createElement("option");
    option.value = staff.employeeId;
    option.textContent = staff.employeeName;
    select.appendChild(option);
  });
}

async function issueTempId() {
  if (!LINE_PROFILE) return;
  const employeeId = document.getElementById("employeeSelect").value;
  setText("authMessage", "仮登録IDを発行しています...");
  try {
    const result = await apiPost("auth.line.temp.issue", {
      employeeId,
      lineId: LINE_PROFILE.userId,
      lineDisplayName: LINE_PROFILE.displayName
    });
    setText("authMessage",
      result.linePushSent
        ? "LINEへ仮登録IDを送信しました。届いたIDを入力してください。"
        : "仮登録IDを発行しました。LINE送信設定が未完了のため、管理者側で確認してください。"
    );
  } catch (err) {
    setText("authMessage", err.message);
  }
}

async function registerLineId() {
  if (!LINE_PROFILE) return;
  const employeeId = document.getElementById("employeeSelect").value;
  const tempId = document.getElementById("tempId").value.trim();
  if (!tempId) {
    setText("authMessage", "仮登録IDを入力してください。");
    return;
  }

  setText("authMessage", "LINE IDを登録しています...");
  try {
    const result = await apiPost("auth.line.register", {
      employeeId,
      tempId,
      lineId: LINE_PROFILE.userId,
      lineDisplayName: LINE_PROFILE.displayName
    });

    saveSession({
      employeeId: result.staff.employeeId,
      employeeName: result.staff.employeeName,
      lineId: LINE_PROFILE.userId,
      sessionToken: result.sessionToken
    });
    await openPortal();
  } catch (err) {
    setText("authMessage", err.message);
  }
}

async function validateSavedSession() {
  const session = getSession();
  if (!session) return false;
  try {
    const result = await apiPost("auth.session", {
      employeeId: session.employeeId,
      lineId: session.lineId,
      sessionToken: session.sessionToken
    });
    saveSession({
      employeeId: result.staff.employeeId,
      employeeName: result.staff.employeeName,
      lineId: session.lineId,
      sessionToken: result.sessionToken
    });
    return true;
  } catch (_) {
    clearSession();
    return false;
  }
}

function logoutDevice() {
  clearSession();
  location.reload();
}
