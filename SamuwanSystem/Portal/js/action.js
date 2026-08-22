document.addEventListener("DOMContentLoaded", initializeActionPage);

async function initializeActionPage() {
  const currentUser = getSavedPortalUser();

  if (!currentUser) {
    location.href = "./index.html";
    return;
  }

  const workStatus = getWorkStatusCache();

  if (!workStatus || workStatus.status !== "ON") {
    alert("行動記録は始業後に利用できます。");
    location.href = "./index.html";
    return;
  }

  setText("staffName", `職員：${currentUser.employeeName}`);

  document.getElementById("startButton")?.addEventListener("click", () => sendAction("action.start"));
  document.getElementById("enterButton")?.addEventListener("click", () => sendAction("action.enter"));
  document.getElementById("finishButton")?.addEventListener("click", () => sendAction("action.finish"));
  document.getElementById("routeButton")?.addEventListener("click", () => {
    setText("actionMessage", "行程記録は次段階で実装します。");
  });

  const cachedStatus = getActionStatusCache();

  if (cachedStatus) {
    renderActionStatus(cachedStatus);
  } else {
    setText("currentStatus", "状態を確認します");
  }

  refreshActionStatus({ silent: !!cachedStatus });
}

async function refreshActionStatus({ silent = false } = {}) {
  const currentUser = getSavedPortalUser();
  if (!currentUser) return;

  try {
    const result = await apiPost("action.status", {
      employeeId: currentUser.employeeId
    });

    const status = result.status || {};
    saveActionStatusCache(status);
    renderActionStatus(status);

    if (!silent) setText("actionMessage", "");
  } catch (err) {
    if (!silent) setText("actionMessage", err.message);
  }
}

function renderActionStatus(status) {
  setText("currentStatus", status.label || "行動記録なし");
  setText("currentDetail", status.detail || "");
  applyAllowedButtons(status.allowed || []);
}

function applyAllowedButtons(allowed) {
  const map = {
    "action.start": "startButton",
    "action.enter": "enterButton",
    "action.route": "routeButton",
    "action.finish": "finishButton"
  };

  Object.entries(map).forEach(([action, id]) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !allowed.includes(action);
  });
}

async function sendAction(action) {
  const currentUser = getSavedPortalUser();
  if (!currentUser) {
    location.href = "./index.html";
    return;
  }

  setText("actionMessage", "登録しています...");

  try {
    await apiPost(action, {
      employeeId: currentUser.employeeId
    });

    setText("actionMessage", "登録しました。");
    await refreshActionStatus();
  } catch (err) {
    setText("actionMessage", err.message);
  }
}
