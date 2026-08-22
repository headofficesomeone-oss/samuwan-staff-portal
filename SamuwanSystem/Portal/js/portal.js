let currentUser = null;

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
      } catch (_) {
        // LINE ID未登録は初回登録へ
      }
    }

    showOnly("registerView");
    setText("staffName", "初回登録");
    await loadEmployeeList();

  } catch (err) {
    showOnly("registerView");
    setText("authMessage", err.message);
    try {
      await loadEmployeeList();
    } catch (_) {}
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

  document.getElementById("logoutButton")?.addEventListener("click", logoutPortalRegistration);

  document.getElementById("refreshButton")?.addEventListener("click", loadPortalState);

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

async function logoutPortalRegistration() {
  const savedUser = getSavedPortalUser();

  if (!savedUser) {
    clearPortalUser();
    location.reload();
    return;
  }

  const ok = confirm(
    "この端末の登録情報とLINE IDの登録を解除します。\n" +
    "次回は初回登録が必要になります。\n\n" +
    "解除してよろしいですか？"
  );

  if (!ok) return;

  try {
    // 現在のLIFFプロフィールが未取得なら取得を試す
    if (!currentLineProfile) {
      try {
        currentLineProfile = await initLiffForPortal();
      } catch (_) {}
    }

    await apiPost("unregisterLineId", {
      employeeId: savedUser.employeeId || "",
      lineId: currentLineProfile?.lineId || ""
    });
  } catch (err) {
    alert("登録解除に失敗しました。\n" + err.message);
    return;
  }

  clearPortalUser();
  currentUser = null;
  location.reload();
}

function showOnly(id) {
  ["loadingView", "registerView", "completeView", "portalView"].forEach(viewId => {
    show(document.getElementById(viewId), viewId === id);
  });
  show(document.getElementById("logoutButton"), id === "portalView");
}

function showPortalAreaDirect() {
  if (!currentUser) return;

  showOnly("portalView");
  setText("staffName", `職員：${currentUser.employeeName}`);
  loadPortalState();
}

async function loadPortalState() {
  if (!currentUser) return;

  setText("currentStatus", "取得中...");
  setText("currentDetail", "");

  try {
    const result = await apiPost("portal.initial", {
      employeeId: currentUser.employeeId
    });

    const status = result.currentStatus || {};
    setText("currentStatus", status.label || "行動記録なし");
    setText("currentDetail", status.detail || "");
  } catch (err) {
    setText("currentStatus", "待機中");
    setText("currentDetail", "");
  }
}
