let currentUser = null;
let currentWorkStatus = null;
let currentCommute = null;

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

  document.getElementById("commuteDestination")?.addEventListener("change", calculateSelectedCommute);
  document.getElementById("refreshButton")?.addEventListener("click", loadPortalInitial);

  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", async () => {
      const page = button.dataset.page;

      const businessPages = new Set(["action", "office", "meeting"]);

      if (
        businessPages.has(page) &&
        (!currentWorkStatus || currentWorkStatus.status !== "ON")
      ) {
        alert("業務操作を利用するには、先に「始業」または「再開」を行ってください。");
        return;
      }

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

  // 始業・終業ボタンと下部ナビは本人確認後のメインPORTALだけ表示
  show(document.getElementById("workToggleButton"), id === "portalView");
  show(document.getElementById("bottomNav"), id === "portalView");
}

function getPortalWorkDayKey_() {
  const d = new Date();

  // 1日の区切りは午前5時
  if (d.getHours() < 5) {
    d.setDate(
      d.getDate() - 1
    );
  }

  return [
    d.getFullYear(),
    String(
      d.getMonth() + 1
    ).padStart(2, "0"),
    String(
      d.getDate()
    ).padStart(2, "0")
  ].join("-");
}

function getValidWorkStatusCache_() {
  const cached =
    getWorkStatusCache();

  if (!cached) {
    return null;
  }

  const today =
    getPortalWorkDayKey_();

  const cachedWorkDate =
    String(
      cached.workDate || ""
    ).trim();

  /*
   * 新しいWork.gsではworkDateが返る。
   * 午前5時をまたいだ古いキャッシュは使わない。
   */
  if (
    cachedWorkDate &&
    cachedWorkDate !== today
  ) {
    clearWorkStatusCache();
    return null;
  }

  /*
   * 旧キャッシュでworkDateが無いものは、
   * 誤表示防止のため利用しない。
   */
  if (!cachedWorkDate) {
    return null;
  }

  return cached;
}

function renderCachedPortalState_() {
  const cachedWork =
    getValidWorkStatusCache_();

  const cachedAction =
    getActionStatusCache();

  if (cachedWork) {
    currentWorkStatus =
      cachedWork;

    renderWorkStatus(
      currentWorkStatus
    );

    applyWorkPermissions(
      currentWorkStatus
    );
  } else {
    setText(
      "workStateLabel",
      "確認中..."
    );

    const button =
      document.getElementById(
        "workToggleButton"
      );

    if (button) {
      button.textContent =
        "確認中";
      button.disabled =
        true;
    }
  }

  if (cachedAction) {
    renderActionSummary(
      cachedAction
    );
  }
}

function showPortalAreaDirect() {
  if (!currentUser) return;

  showOnly("portalView");
  setText(
    "staffName",
    `職員：${currentUser.employeeName}`
  );

  /*
   * まず保存済みの勤務状態を即表示。
   * その後、裏でGASの最新状態を確認する。
   */
  renderCachedPortalState_();

  loadPortalInitial();
}

async function loadPortalInitial() {
  if (!currentUser) return;

  /*
   * キャッシュが無い場合だけ「確認中...」を表示。
   * 有効なキャッシュがある場合は、その表示を維持したまま
   * バックグラウンドで最新状態を取得する。
   */
  if (!getActionStatusCache()) {
    setText(
      "currentStatus",
      "確認中..."
    );
    setText(
      "currentDetail",
      ""
    );
  }

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

    const workButton =
      document.getElementById(
        "workToggleButton"
      );

    if (workButton) {
      /*
       * 通勤計算中の制御はloadCommuteOptions /
       * calculateSelectedCommute側で改めて設定する。
       */
      workButton.disabled = false;
    }

    await loadCommuteOptions();

  } catch (err) {
    setText("currentStatus", "取得に失敗しました");
    setText("currentDetail", err.message);
  }
}

function renderWorkStatus(workStatus) {
  const phase = String(workStatus.phase || "").trim();
  const isWorking = workStatus.status === "ON";

  const label =
    workStatus.label ||
    (isWorking ? "勤務中" : phase === "ENDED" ? "退勤" : "未始業");

  setText("workStateLabel", label);

  const button = document.getElementById("workToggleButton");
  if (button) {
    const buttonLabel =
      workStatus.buttonLabel ||
      (isWorking ? "終業" : phase === "ENDED" ? "再開" : "始業");

    const buttonMode =
      workStatus.buttonMode ||
      (isWorking ? "end" : phase === "ENDED" ? "resume" : "start");

    button.textContent = buttonLabel;
    button.dataset.mode = buttonMode;
  }

  if (isWorking && workStatus.startTime) {
    setText("workTimeDetail", `始業 ${workStatus.startTime}`);
  } else if (phase === "ENDED" && workStatus.endTime) {
    setText("workTimeDetail", `退勤 ${workStatus.endTime}`);
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

  // 閲覧・申請系は常時利用可
  setMenuEnabled("request", true);
  setMenuEnabled("leave", true);
  setMenuEnabled("mypage", true);

  // 業務操作は常時表示・クリック可。
  // 未始業/退勤時は bindEvents 側でメッセージを出して遷移を止める。
  setMenuEnabled("action", true);
  setMenuEnabled("office", true);
  setMenuEnabled("meeting", true);

  const notice = document.getElementById("workPermissionNotice");
  if (notice) {
    if (isWorking) {
      notice.textContent = "勤務中です。業務記録を利用できます。";
    } else if (workStatus.phase === "ENDED") {
      notice.textContent = "退勤済みです。業務を再開する場合は、右上の「再開」を押してください。";
    } else {
      notice.textContent = "未始業です。業務操作を利用する場合は、先に「始業」を行ってください。";
    }
  }
}

function setMenuEnabled(page, enabled) {
  const button = document.querySelector(`[data-page="${page}"]`);
  if (!button) return;

  button.disabled = !enabled;
  button.classList.toggle("disabled-menu", !enabled);
}

async function loadCommuteOptions() {
  const select = document.getElementById("commuteDestination");
  if (!select) return;

  const phase = String(currentWorkStatus?.phase || "").trim();

  // 勤務中は既に確定済みの勤務開始場所を使う
  if (currentWorkStatus?.status === "ON") {
    select.disabled = true;
    select.innerHTML = `<option>${currentWorkStatus.destinationName || "勤務中"}</option>`;
    setText(
      "commuteResult",
      `${currentWorkStatus.destinationName || ""} / ${currentWorkStatus.distanceKm || 0}km / 約${currentWorkStatus.durationMinutes || 0}分`
    );
    return;
  }

  // 同じ勤務日の退勤後は再開扱い。勤務開始場所は再選択させない。
  if (phase === "ENDED") {
    select.disabled = true;
    select.innerHTML = `<option>${currentWorkStatus.destinationName || "本日の勤務開始場所"}</option>`;
    setText("commuteResult", "");
    return;
  }

  currentCommute = null;
  select.disabled = true;
  select.innerHTML = '<option value="">読み込み中...</option>';

  const workButton =
    document.getElementById("workToggleButton");

  if (
    workButton &&
    (
      !currentWorkStatus?.phase ||
      currentWorkStatus.phase === "BEFORE"
    )
  ) {
    workButton.disabled = true;
  }

  try {
    const result = await apiPost("commute.options", {
      employeeId: currentUser.employeeId
    });

    select.innerHTML = '<option value="">勤務開始場所を選択してください</option>';

    (result.options || []).forEach(o => {
      const el = document.createElement("option");
      el.value = o.type + "|" + o.id;
      el.textContent = o.name;
      select.appendChild(el);
    });

    setText("commuteResult", "勤務開始場所を選択してください。");
  } catch (err) {
    setText("commuteMessage", err.message);
  } finally {
    select.disabled = false;

    const workButton =
      document.getElementById("workToggleButton");

    if (
      workButton &&
      currentWorkStatus?.phase !== "BEFORE"
    ) {
      workButton.disabled = false;
    }
  }
}

async function calculateSelectedCommute() {
  const select =
    document.getElementById("commuteDestination");

  const button =
    document.getElementById("workToggleButton");

  currentCommute = null;

  const value =
    String(
      select?.value || ""
    ).trim();

  if (!value) {
    setText(
      "commuteResult",
      "勤務開始場所を選択してください。"
    );
    return;
  }

  const [type, id] =
    value.split("|");

  /*
   * 通勤距離計算中に「始業」を押せないようにする。
   * これで currentCommute がまだ null の状態で
   * 始業処理へ進むのを防ぐ。
   */
  if (button) {
    button.disabled = true;
    button.dataset.commuteChecking = "1";
  }

  setText(
    "commuteResult",
    "通勤距離を計算しています..."
  );

  setText(
    "commuteMessage",
    ""
  );

  try {
    const r =
      await apiPost(
        "commute.calculate",
        {
          employeeId:
            currentUser.employeeId,
          destinationType:
            type,
          destinationId:
            id
        }
      );

    currentCommute =
      r.commute;

    if (
      !currentCommute ||
      !currentCommute.destinationId ||
      !currentCommute.destinationName
    ) {
      throw new Error(
        "通勤情報を確認できませんでした。"
      );
    }

    setText(
      "commuteResult",
      `${currentCommute.destinationName}まで ${currentCommute.distanceKm}km / 車で約${currentCommute.durationMinutes}分`
    );

  } catch (err) {

    currentCommute =
      null;

    setText(
      "commuteResult",
      "通勤距離を取得できませんでした。"
    );

    setText(
      "commuteMessage",
      err.message
    );

  } finally {

    if (button) {
      button.dataset.commuteChecking = "0";

      /*
       * 初回始業前なら、計算成功時だけ押せる。
       * 再開/終業は通勤計算と無関係。
       */
      const mode =
        currentWorkStatus?.buttonMode ||
        (
          currentWorkStatus?.status === "ON"
            ? "end"
            : currentWorkStatus?.phase === "ENDED"
              ? "resume"
              : "start"
        );

      if (mode === "start") {
        button.disabled =
          !currentCommute;
      } else {
        button.disabled =
          false;
      }
    }
  }
}
async function toggleWorkStatus() {
  if (!currentUser || !currentWorkStatus) return;

  const workButton =
    document.getElementById("workToggleButton");

  if (
    workButton?.dataset.commuteChecking === "1"
  ) {
    alert(
      "通勤距離を確認しています。計算が終わるまでお待ちください。"
    );
    return;
  }

  const mode =
    currentWorkStatus.buttonMode ||
    (currentWorkStatus.status === "ON"
      ? "end"
      : currentWorkStatus.phase === "ENDED"
        ? "resume"
        : "start");

  if (mode === "start" && !currentCommute) {
    alert("勤務開始場所を選択して、通勤距離を確認してから始業してください。");
    return;
  }

  const action =
    mode === "end"
      ? "work.end"
      : "work.start";

  const button = document.getElementById("workToggleButton");
  if (button) button.disabled = true;

  try {
    const payload = {
      employeeId: currentUser.employeeId
    };

    // 初回始業だけ通勤情報を送る。再開は同日の情報を引き継ぐ。
    if (mode === "start") {
      payload.commute = currentCommute;
    }

    const result = await apiPost(action, payload);

    currentWorkStatus = result.workStatus;
    saveWorkStatus(currentWorkStatus);

    renderWorkStatus(currentWorkStatus);
    applyWorkPermissions(currentWorkStatus);

    /*
     * 以前はここで loadCommuteOptions() を再実行していたため、
     * 始業・終業のたびに追加通信が発生していました。
     * 状態変更のレスポンスだけで画面更新し、追加通信はしません。
     */
    if (currentWorkStatus.status === "ON") {
      currentCommute = null;
    }

  } catch (err) {
    alert(err.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function openActionPage() {
  if (!currentWorkStatus || currentWorkStatus.status !== "ON") {
    alert("先に「始業」または「再開」を行ってください。");
    return;
  }

  navigateTo("./action.html");
}
