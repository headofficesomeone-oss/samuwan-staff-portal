
(() => {
  'use strict';

  const GUARDED_IDS = new Set([
    'workToggleButton',
    'refreshButton',
    'todayShiftSelect',
    'instructionButton',
    'moveButton',
    'enterButton',
    'finishButton',
    'continueButton',
    'preCancelButton',
    'cancelButton',
    'actionRecordButton',
    'homeReturnButton',
    'temporaryChangeButton'
  ]);

  let stateReady = false;
  let unlockTimer = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function setGuarded(disabled) {
    GUARDED_IDS.forEach(id => {
      const el = byId(id);
      if (!el) return;

      if (disabled) {
        el.dataset.portalGuard = '1';

        if (
          el.tagName === 'BUTTON' ||
          el.tagName === 'SELECT' ||
          el.tagName === 'INPUT'
        ) {
          el.disabled = true;
        }
      } else {
        delete el.dataset.portalGuard;
        /*
         * disabled の最終状態は portal.js 側の
         * 既存状態判定に任せるため、ここでは一律に
         * enabled にしません。
         */
      }
    });

    document.body.classList.toggle(
      'portal-state-lock',
      disabled
    );

    const notice = byId('portalStateGuardNotice');
    if (notice) {
      notice.classList.toggle('hidden', !disabled);
    }
  }

  function ensureNotice() {
    if (byId('portalStateGuardNotice')) return;

    const currentStatus = byId('currentStatus');
    if (!currentStatus?.parentElement) return;

    const notice = document.createElement('div');
    notice.id = 'portalStateGuardNotice';
    notice.textContent =
      '勤務状態と本日のシフトを確認しています。確認完了まで操作できません。';

    currentStatus.parentElement.appendChild(notice);
  }

  function looksReady() {
    const portalView = byId('portalView');
    if (!portalView || portalView.classList.contains('hidden')) {
      return false;
    }

    const staffName = String(
      byId('staffName')?.textContent || ''
    ).trim();

    const currentStatus = String(
      byId('currentStatus')?.textContent || ''
    ).trim();

    if (
      !staffName ||
      staffName.includes('本人確認中')
    ) {
      return false;
    }

    if (
      !currentStatus ||
      currentStatus.includes('確認中') ||
      currentStatus.includes('読込') ||
      currentStatus.includes('読み込')
    ) {
      return false;
    }

    return true;
  }

  function tryRelease() {
    if (!looksReady()) return;

    /*
     * 状態表示が書き換わった直後に portal.js 側の
     * ボタン判定が続くため、少し待ってからロックだけ解除します。
     */
    clearTimeout(unlockTimer);

    unlockTimer = setTimeout(() => {
      stateReady = true;
      document.body.classList.remove('portal-state-lock');

      const notice = byId('portalStateGuardNotice');
      if (notice) notice.classList.add('hidden');

      /*
       * 既存ロジックに再判定を依頼。
       * 関数が存在する場合だけ呼びます。
       */
      try {
        if (
          typeof window.handleTodayShiftChange === 'function'
        ) {
          window.handleTodayShiftChange();
        }
      } catch (_) {}
    }, 120);
  }

  function lockNow() {
    stateReady = false;
    ensureNotice();
    setGuarded(true);
  }

  /*
   * 画面遷移直後は必ずロック。
   */
  document.documentElement.classList.add(
    'portal-guard-booting'
  );

  document.addEventListener('DOMContentLoaded', () => {
    lockNow();

    const observer = new MutationObserver(() => {
      /*
       * portal.js が途中で disabled を外しても、
       * 状態取得完了前なら再びガードします。
       */
      if (!stateReady) {
        document.body.classList.add('portal-state-lock');
      }

      tryRelease();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'disabled']
    });

    tryRelease();
  });

  /*
   * disabled が一瞬外れる競合があっても、
   * capture フェーズで操作を止めます。
   */
  document.addEventListener(
    'click',
    event => {
      if (stateReady) return;

      const target = event.target.closest(
        'button,select,input'
      );

      if (!target || !GUARDED_IDS.has(target.id)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );

  document.addEventListener(
    'change',
    event => {
      if (stateReady) return;

      if (GUARDED_IDS.has(event.target?.id)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  /*
   * 他画面から戻った場合も、pageshow で再ロックします。
   * bfcache 復帰対策です。
   */
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      lockNow();

      /*
       * 既存の更新ボタンを自動クリックはしません。
       * portal.js が通常の初期取得を終えるまで待ちます。
       */
      setTimeout(tryRelease, 50);
    }
  });
})();
