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


  const WORK_SNAPSHOT_KEY =
    'samuwanPortalWorkSnapshotV1';

  function todayKey() {
    const d = new Date();

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }

  function readWorkSnapshot() {
    try {
      const raw =
        localStorage.getItem(
          WORK_SNAPSHOT_KEY
        );

      if (!raw) return {};

      return JSON.parse(raw) || {};

    } catch (_) {
      return {};
    }
  }

  function renderWorkSummary() {
    const snapshot =
      readWorkSnapshot();

    const today =
      document.getElementById(
        'mypageTodayWork'
      );

    const previous =
      document.getElementById(
        'mypagePreviousWork'
      );

    const sameDay =
      snapshot.date === todayKey();

    const commute =
      sameDay
        ? String(
            snapshot.commuteLabel ||
            ''
          ).trim()
        : '';

    if (today) {
      today.textContent =
        '勤務開始場所：' +
        (
          commute ||
          '未設定'
        );
    }

    if (previous) {
      previous.textContent =
        String(
          snapshot.previousWorkText ||
          '—'
        ).trim();
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
      renderWorkSummary();

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
