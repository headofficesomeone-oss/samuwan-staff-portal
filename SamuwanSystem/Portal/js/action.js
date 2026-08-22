document.addEventListener("DOMContentLoaded", initializeActionPage);

async function initializeActionPage() {
  const session = getSession();
  if (!session) {
    location.href = "./index.html";
    return;
  }

  setText("staffName", `職員：${session.employeeName}`);
  document.getElementById("startButton").addEventListener("click", () => sendAction("action.start"));
  document.getElementById("enterButton").addEventListener("click", () => sendAction("action.enter"));
  document.getElementById("finishButton").addEventListener("click", () => sendAction("action.finish"));
  document.getElementById("routeButton").addEventListener("click", () => {
    setText("actionMessage", "行程記録は次段階で、外出・買物・通院・散歩・有償運送等を実装します。");
  });

  await refreshActionStatus();
}

async function refreshActionStatus() {
  const session = getSession();
  try {
    const result = await apiPost("action.status", session);
    const status = result.status || {};
    setText("currentStatus", status.label || "行動記録なし");
    setText("currentDetail", status.detail || "");
    applyAllowedButtons(status.allowed || []);
  } catch (err) {
    setText("actionMessage", err.message);
  }
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
    btn.disabled = !allowed.includes(action);
  });
}

async function sendAction(action) {
  const session = getSession();
  setText("actionMessage", "登録しています...");

  try {
    await apiPost(action, session);
    setText("actionMessage", "登録しました。");
    await refreshActionStatus();
  } catch (err) {
    setText("actionMessage", err.message);
  }
}
