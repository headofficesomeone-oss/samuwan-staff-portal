(() => {
  'use strict';

  function getUser() {
    try {
      const raw =
        localStorage.getItem('currentUser') ||
        localStorage.getItem('portalUser') ||
        '';

      if (!raw) return {};

      const user = JSON.parse(raw);

      return {
        id: String(
          user?.employeeId ||
          user?.id ||
          ''
        ).trim(),
        name: String(
          user?.employeeName ||
          user?.name ||
          ''
        ).trim()
      };
    } catch (_) {
      return {};
    }
  }

  function renderUser() {
    const user = getUser();

    const staff =
      document.getElementById('mypageStaffName');

    const name =
      document.getElementById('accountEmployeeName');

    const id =
      document.getElementById('accountEmployeeId');

    if (staff) {
      staff.textContent =
        user.name
          ? `職員：${user.name}`
          : '職員情報';
    }

    if (name) {
      name.textContent =
        user.name || '—';
    }

    if (id) {
      id.textContent =
        user.id || '—';
    }
  }

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      renderUser();

      document
        .getElementById('mypageLeaveButton')
        ?.addEventListener(
          'click',
          () => {
            /*
             * 休暇・届出は現在ホーム内の既存機能なので、
             * 勝手に別処理を作らずホームへ戻します。
             */
            location.href = './index.html';
          }
        );
    }
  );
})();
