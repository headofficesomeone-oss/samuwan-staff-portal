(() => {
  'use strict';

  const STORAGE_KEY =
    'samuwanPortalWorkSnapshotV1';

  function todayKey() {
    const d = new Date();

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }

  function readSnapshot() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) return {};

      const data =
        JSON.parse(raw);

      if (
        !data ||
        data.date !== todayKey()
      ) {
        /*
         * 日付が変わったら、
         * 今日の勤務開始場所は未設定に戻します。
         * 前回勤務文字列だけは残して新しい日へ引き継ぎます。
         */
        return {
          date: todayKey(),
          previousWorkText:
            String(
              data?.previousWorkText ||
              ''
            ).trim()
        };
      }

      return data;

    } catch (_) {
      return {
        date: todayKey()
      };
    }
  }

  function saveSnapshot(patch) {
    const current =
      readSnapshot();

    const next = {
      ...current,
      ...patch,
      date: todayKey(),
      updatedAt: Date.now()
    };

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(next)
      );
    } catch (_) {}

    return next;
  }

  function setCommuteSaved(saved) {
    if (saved) {
      document.documentElement
        .setAttribute(
          'data-commute-saved',
          '1'
        );
    } else {
      document.documentElement
        .removeAttribute(
          'data-commute-saved'
        );
    }
  }

  function validSelectedCommute(
    select
  ) {
    if (!select) return null;

    const value =
      String(
        select.value || ''
      ).trim();

    const option =
      select.options[
        select.selectedIndex
      ];

    const label =
      String(
        option?.textContent || ''
      ).trim();

    if (!value) return null;

    if (
      !label ||
      label.includes('読み込み') ||
      label.includes('取得中') ||
      label.includes('選択してください')
    ) {
      return null;
    }

    return {
      value,
      label
    };
  }

  function restoreSavedCommute() {
    const select =
      document.getElementById(
        'commuteDestination'
      );

    const snapshot =
      readSnapshot();

    if (
      !select ||
      !snapshot.commuteLabel
    ) {
      setCommuteSaved(false);
      return;
    }

    /*
     * portal.js がポータル再表示時に
     * 「読み込み中...」へ戻しても、
     * 保存済みの勤務開始場所を画面上では保持します。
     */
    const current =
      validSelectedCommute(
        select
      );

    if (
      !current ||
      current.label !==
        snapshot.commuteLabel
    ) {
      select.innerHTML = '';

      const option =
        document.createElement(
          'option'
        );

      option.value =
        snapshot.commuteValue ||
        snapshot.commuteLabel;

      option.textContent =
        snapshot.commuteLabel;

      option.selected = true;

      select.appendChild(
        option
      );

      select.disabled = false;
    }

    setCommuteSaved(true);
  }

  function saveCommuteFromSelect() {
    const select =
      document.getElementById(
        'commuteDestination'
      );

    const selected =
      validSelectedCommute(
        select
      );

    if (!selected) {
      return false;
    }

    saveSnapshot({
      commuteValue:
        selected.value,
      commuteLabel:
        selected.label
    });

    setCommuteSaved(true);

    return true;
  }

  function savePortalWorkTexts() {
    const stateText =
      String(
        document.getElementById(
          'workStateLabel'
        )?.textContent ||
        ''
      ).trim();

    const previousText =
      String(
        document.getElementById(
          'workTimeDetail'
        )?.textContent ||
        ''
      )
        .replace(/\s+/g, ' ')
        .trim();

    const patch = {};

    if (
      stateText &&
      !stateText.includes('確認中')
    ) {
      patch.workState =
        stateText;
    }

    if (previousText) {
      patch.previousWorkText =
        previousText;
    }

    if (
      Object.keys(patch)
        .length
    ) {
      saveSnapshot(patch);
    }
  }

  function bind() {
    const select =
      document.getElementById(
        'commuteDestination'
      );

    if (select) {
      /*
       * 保存済みなら、
       * ポータルを再表示しても再選択は要求しません。
       */
      restoreSavedCommute();

      select.addEventListener(
        'change',
        () => {
          if (
            saveCommuteFromSelect()
          ) {
            /*
             * 一度選択したら
             * 勤務開始場所のカードは
             * ポータルから消します。
             */
            setCommuteSaved(true);
          }
        }
      );
    }

    savePortalWorkTexts();

    const observer =
      new MutationObserver(
        () => {
          /*
           * portal.js が再度
           * 「読み込み中...」に変更した場合でも、
           * 当日の選択済み情報を復元します。
           */
          restoreSavedCommute();
          savePortalWorkTexts();
        }
      );

    const targets = [
      document.getElementById(
        'commuteDestination'
      ),
      document.getElementById(
        'workStateLabel'
      ),
      document.getElementById(
        'workTimeDetail'
      )
    ].filter(Boolean);

    targets.forEach(
      target => {
        observer.observe(
          target,
          {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true
          }
        );
      }
    );
  }

  document.addEventListener(
    'DOMContentLoaded',
    bind
  );

  /*
   * bfcache からホームへ戻った場合も
   * 保存済み状態を即時復元します。
   */
  window.addEventListener(
    'pageshow',
    () => {
      restoreSavedCommute();
      savePortalWorkTexts();
    }
  );
})();
