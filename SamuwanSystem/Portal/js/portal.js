document.addEventListener("DOMContentLoaded", initializePage);

async function initializePage() {
  bindPortalEvents();

  const valid = await validateSavedSession();
  if (valid) {
    await openPortal();
    return;
  }

  openAuth();
  try {
    const result = await initializeLineAuth();
    if (result && result.registered) await openPortal();
  } catch (err) {
    setText("authMessage", err.message);
  }
}

function bindPortalEvents() {
  document.getElementById("issueTempButton").addEventListener("click", issueTempId);
  document.getElementById("registerLineButton").addEventListener("click", registerLineId);
  document.getElementById("logoutButton").addEventListener("click", logoutDevice);
  document.getElementById("refreshButton").addEventListener("click", loadPortalState);

  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      const routes = {
        action: "./action.html",
        request: "./request.html",
        office: "./office.html",
        meeting: "./meeting.html",
        leave: "./leave.html"
      };
      navigateTo(routes[button.dataset.page]);
    });
  });
}

function openAuth() {
  show(document.getElementById("authView"), true);
  show(document.getElementById("portalView"), false);
  show(document.getElementById("logoutButton"), false);
  setText("staffName", "LINE本人確認");
}

async function openPortal() {
  const session = getSession();
  if (!session) return openAuth();
  show(document.getElementById("authView"), false);
  show(document.getElementById("portalView"), true);
  show(document.getElementById("logoutButton"), true);
  setText("staffName", `職員：${session.employeeName}`);
  await loadPortalState();
}

async function loadPortalState() {
  const session = getSession();
  if (!session) return openAuth();

  setText("currentStatus", "取得中...");
  setText("currentDetail", "");

  try {
    const result = await apiPost("portal.initial", session);
    const status = result.currentStatus || {};
    setText("currentStatus", status.label || "行動記録なし");
    setText("currentDetail", status.detail || "");
  } catch (err) {
    setText("currentStatus", "取得できませんでした");
    setText("currentDetail", err.message);
  }
}
