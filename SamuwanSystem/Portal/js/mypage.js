document.addEventListener("DOMContentLoaded", initializeMyPage);

async function initializeMyPage() {
  const user = getSavedPortalUser();

  if (!user) {
    location.href = "./index.html";
    return;
  }

  setText("staffName", `職員：${user.employeeName}`);
  setText("myEmployeeName", user.employeeName);
  setText("myEmployeeId", user.employeeId);

  document.getElementById("homeButton")?.addEventListener("click", () => {
    location.href = "./index.html";
  });

  document.getElementById("unregisterButton")?.addEventListener("click", async () => {
    const ok = confirm(
      "LINE登録を解除しますか？\n\n" +
      "解除すると、次回利用時に仮登録IDによる再登録が必要です。"
    );

    if (!ok) return;

    try {
      try {
        const lineProfile = await initLiffForPortal();
      } catch (_) {}

      await apiPost("unregisterLineId", {
        employeeId: user.employeeId,
        lineId: (typeof lineProfile !== "undefined" && lineProfile) ? lineProfile.lineId : ""
      });

      clearPortalUser();
      clearWorkStatusCache();
      clearActionStatusCache();

      alert("LINE登録を解除しました。");
      location.href = "./index.html";

    } catch (err) {
      alert("登録解除に失敗しました。\n" + err.message);
    }
  });
}
