let currentUser = null;
let currentWorkStatus = null;

document.addEventListener("DOMContentLoaded", initializePortalPage);

async function initializePortalPage() {
  bindEvents();

  currentUser = getSavedPortalUser();

  if (currentUser) {
    showPortalAreaDirect();
    return;
  }

  showOnly("loadingView");

  try {
    currentLineProfile = await initLiffForPortal();

    if (currentLineProfile && currentLineProfile.lineId) {
      try {
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
      } catch (_) {}
    }

    showOnly("registerView");
    setText("staffName", "初回登録");
    await loadEmployeeList();

  } catch (err) {
    showOnly("registerView");
    setText("authMessage", err.message);
    try { await loadEmployeeList(); } catch (_) {}
  }
}

function bindEvents() {
  document.getElementById("issueTempButton")?.addEventListener("click", async () => {
    try {
      await issueTempIdFromScreen();
    } catch (err) {
      setText("authMessage", err.message);
    }
  });

  document.getElementById("registerButton")?.addEventListener("click", async () => {
    try {
      const result = await registerLineIdFromScreen();
      if (!result) return;

      currentUser = result.user;
      setText("completeMessage", result.message);
      showOnly("completeView");
    } catch (err) {
      setText("authMessage", err.message);
    }
  });

  document.getElementById("toPortalButton")?.addEventListener("click", () => {
    showPortalAreaDirect();
  });

  document.getElementById("workToggleButton")?.addEventListener("click", toggleWorkStatus);
  document.getElementById("refreshButton")?.addEventListener("click", loadPortalInitial);

  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", async () => {
      const page = button.dataset.page;

      if (button.disabled) return;

      const routes = {
        action: "./action.html",
        request: "./request.html",
        office: "./office.html",
        meeting: "./meeting.html",
        leave: "./leave.html",
        mypage: "./mypage.html",
        home: "./index.html"
      };

      if (page === "action") {
        await openActionPage();
        return;
      }

      navigateTo(routes[page]);
    });
  });
}

function showOnly(id) {
  ["loadingView", "registerView", "completeView", "portalView"].forEach(viewId => {
    show(document.getElementById(viewId), viewId === id);
  });

  // 始業・終業ボタンは本人確認後のメインPORTALだけ表示
  show(document.getElementById("workToggleButton"), id === "portalView");
}

function showPortalAreaDirect() {
  if (!currentUser) return;

  showOnly("portalView");
  setText("staffName", `職員：${currentUser.employeeName}`);

  loadPortalInitial();
}

async function loadPortalInitial() {
  if (!currentUser) return;

  setText("currentStatus", "確認中...");
  setText("currentDetail", "");

  try {
    const result = await apiPost("portal.initial", {
      employeeId: currentUser.employeeId
    });

    currentWorkStatus = result.workStatus || {
      status: "OFF",
      label: "未始業"
    };

    saveWorkStatus(currentWorkStatus);

    const actionStatus = result.currentStatus || {};
    saveActionStatusCache(actionStatus);

    renderWorkStatus(currentWorkStatus);
    renderActionSummary(actionStatus);
    applyWorkPermissions(currentWorkStatus);

  } catch (err) {
    setText("currentStatus", "取得に失敗しました");
    setText("currentDetail", err.message);
  }
}

function renderWorkStatus(workStatus) {
  const isWorking = workStatus.status === "ON";

  setText("workStateLabel", isWorking ? "勤務中" : "未始業");

  const button = document.getElementById("workToggleButton");
  if (button) {
    button.textContent = isWorking ? "終業" : "始業";
    button.dataset.mode = isWorking ? "end" : "start";
  }

  if (isWorking && workStatus.startTime) {
    setText("workTimeDetail", `始業 ${workStatus.startTime}`);
  } else if (!isWorking && workStatus.endTime) {
    setText("workTimeDetail", `前回終業 ${workStatus.endTime}`);
  } else {
    setText("workTimeDetail", "");
  }
}

function renderActionSummary(actionStatus) {
  setText("currentStatus", actionStatus.label || "行動記録なし");
  setText("currentDetail", actionStatus.detail || "");
}

function applyWorkPermissions(workStatus) {
  const isWorking = workStatus.status === "ON";

  // 閲覧・申請系は未始業でも使用可
  setMenuEnabled("request", true);
  setMenuEnabled("leave", true);
  setMenuEnabled("mypage", true);

  // 勤務実績になる操作は始業後のみ
  setMenuEnabled("action", isWorking);
  setMenuEnabled("office", isWorking);
  setMenuEnabled("meeting", isWorking);

  const notice = document.getElementById("workPermissionNotice");
  if (notice) {
    notice.textContent = isWorking
      ? "勤務中です。業務記録を利用できます。"
      : "未始業です。行動記録・事務作業・会議記録は始業後に利用できます。";
  }
}

function setMenuEnabled(page, enabled) {
  const button = document.querySelector(`[data-page="${page}"]`);
  if (!button) return;

  button.disabled = !enabled;
  button.classList.toggle("disabled-menu", !enabled);
}

async function toggleWorkStatus() {
  if (!currentUser || !currentWorkStatus) return;

  const isWorking = currentWorkStatus.status === "ON";
  const action = isWorking ? "work.end" : "work.start";

  const button = document.getElementById("workToggleButton");
  if (button) button.disabled = true;

  try {
    const result = await apiPost(action, {
      employeeId: currentUser.employeeId
    });

    currentWorkStatus = result.workStatus;
    saveWorkStatus(currentWorkStatus);

    renderWorkStatus(currentWorkStatus);
    applyWorkPermissions(currentWorkStatus);

  } catch (err) {
    alert(err.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function openActionPage() {
  // 行動記録画面へ移動する前にメイン側で最新状態を取得完了。
  try {
    await loadPortalInitial();
  } catch (_) {}

  if (!currentWorkStatus || currentWorkStatus.status !== "ON") {
    alert("先に始業してください。");
    return;
  }

  navigateTo("./action.html");
}
