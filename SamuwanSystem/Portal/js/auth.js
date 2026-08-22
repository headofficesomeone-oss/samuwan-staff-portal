async function verifyAndRegisterDevice() {
  const employeeId = document.getElementById("employeeId").value.trim();
  const verifyCode = document.getElementById("verifyCode").value.trim();

  if (!employeeId || !verifyCode) {
    setText("authMessage", "従業員IDと確認コードを入力してください。");
    return;
  }

  setText("authMessage", "確認しています...");

  try {
    const result = await apiPost("auth.verify", {
      employeeId,
      verifyCode
    });

    saveSession({
      employeeId: result.staff.employeeId,
      employeeName: result.staff.employeeName,
      sessionToken: result.sessionToken
    });

    document.getElementById("verifyCode").value = "";
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
      sessionToken: session.sessionToken
    });

    saveSession({
      employeeId: result.staff.employeeId,
      employeeName: result.staff.employeeName,
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
