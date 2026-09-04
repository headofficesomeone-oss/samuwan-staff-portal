(() => {
  'use strict';

  /*
   * 今日最初に向かう場所の取得結果を短時間だけ端末保存します。
   *
   * 目的:
   * - request / request-view / shift-view 以外からポータルへ戻った時、
   *   毎回「読み込み中...」にしない
   * - 既存 portal.js / GAS は変更しない
   *
   * 動き:
   * - commute.options の成功結果を localStorage へ保存
   * - 3分以内のキャッシュがあれば、その結果を即時返す
   * - 3分を超えたら通常どおりGASから再取得
   * - request / request-view / shift-view から戻った場合は
   *   シフト変更の可能性があるためキャッシュを破棄して再取得
   */

  const CACHE_PREFIX = 'samuwanCommuteOptionsV1';
  const CACHE_MAX_AGE_MS = 3 * 60 * 1000;

  function todayKey_() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }

  function readSavedUser_() {
    const keys = [
      'currentUser',
      'portalUser'
    ];

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const user = JSON.parse(raw);
        const employeeId = String(
          user?.employeeId ||
          user?.id ||
          ''
        ).trim();

        const employeeName = String(
          user?.employeeName ||
          user?.name ||
          ''
        ).trim();

        if (employeeId || employeeName) {
          return {
            employeeId,
            employeeName
          };
        }
      } catch (_) {}
    }

    return {
      employeeId: '',
      employeeName: ''
    };
  }

  function cacheKey_(payload) {
    const saved = readSavedUser_();

    const employeeId = String(
      payload?.employeeId ||
      saved.employeeId ||
      ''
    ).trim();

    const employeeName = String(
      payload?.employeeName ||
      saved.employeeName ||
      ''
    ).trim();

    return [
      CACHE_PREFIX,
      todayKey_(),
      employeeId || employeeName || 'unknown'
    ].join(':');
  }

  function readCache_(payload) {
    try {
      const key = cacheKey_(payload);
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const cache = JSON.parse(raw);

      if (
        !cache ||
        !cache.savedAt ||
        !cache.result
      ) {
        return null;
      }

      const age =
        Date.now() -
        Number(cache.savedAt || 0);

      if (
        age < 0 ||
        age > CACHE_MAX_AGE_MS
      ) {
        localStorage.removeItem(key);
        return null;
      }

      return cache.result;

    } catch (_) {
      return null;
    }
  }

  function saveCache_(payload, result) {
    try {
      if (!result) return;

      localStorage.setItem(
        cacheKey_(payload),
        JSON.stringify({
          savedAt: Date.now(),
          result
        })
      );
    } catch (_) {}
  }

  function clearTodayCache_() {
    try {
      const prefix =
        CACHE_PREFIX +
        ':' +
        todayKey_() +
        ':';

      const removeKeys = [];

      for (
        let i = 0;
        i < localStorage.length;
        i++
      ) {
        const key =
          localStorage.key(i);

        if (
          key &&
          key.startsWith(prefix)
        ) {
          removeKeys.push(key);
        }
      }

      removeKeys.forEach(
        key => localStorage.removeItem(key)
      );

    } catch (_) {}
  }

  function cameFromSchedulePage_() {
    const ref =
      String(
        document.referrer || ''
      );

    return (
      ref.includes('/request.html') ||
      ref.includes('/request-view.html') ||
      ref.includes('/shift-view.html')
    );
  }

  /*
   * 依頼・シフト画面から戻った場合は
   * 最新シフトを優先するためキャッシュを使いません。
   */
  if (cameFromSchedulePage_()) {
    clearTodayCache_();
  }

  /*
   * common.js が定義した postGas を包みます。
   * portal.js が読み込まれる前に実行されるため、
   * portal.js 自体は変更不要です。
   */
  const originalPostGas =
    window.postGas;

  if (
    typeof originalPostGas !== 'function'
  ) {
    console.warn(
      'portal-commute-cache: postGas が見つかりません。'
    );
    return;
  }

  window.postGas =
    async function(payload) {

      const action =
        String(
          payload?.action || ''
        ).trim();

      if (
        action !== 'commute.options'
      ) {
        return originalPostGas(
          payload
        );
      }

      const cached =
        readCache_(payload);

      if (cached) {
        console.log(
          'commute.options: 端末キャッシュを使用'
        );

        return cached;
      }

      const result =
        await originalPostGas(
          payload
        );

      /*
       * APIは現在のレスポンス形式をそのまま保存します。
       * success / ok どちらの形式でも、
       * 明確な失敗でなければキャッシュ対象にします。
       */
      if (
        result &&
        result.success !== false &&
        result.ok !== false
      ) {
        saveCache_(
          payload,
          result
        );
      }

      return result;
    };

  /*
   * シフト関連画面へ移動する時も削除します。
   * ブラウザのreferrerが残らない場合への保険です。
   */
  document.addEventListener(
    'click',
    event => {
      const link =
        event.target.closest('a');

      if (!link) return;

      const href =
        String(
          link.getAttribute('href') || ''
        );

      if (
        href.includes('request.html') ||
        href.includes('request-view.html') ||
        href.includes('shift-view.html')
      ) {
        clearTodayCache_();
      }
    },
    true
  );

  /*
   * 日付をまたいだブラウザ復帰時は
   * 古い日付のキャッシュを利用しないため、
   * key自体が別日になるので追加処理は不要です。
   */
})();
