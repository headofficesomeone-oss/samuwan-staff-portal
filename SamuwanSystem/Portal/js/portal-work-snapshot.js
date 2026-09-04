(() => {
  'use strict';

  const STORAGE_KEY =
    'samuwanPortalWorkSnapshotV1';

  let replayDone = false;
  let manualSelectionPending = false;

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

      if (!raw) {
        return {
          date: todayKey()
        };
      }

      const data =
        JSON.parse(raw) || {};

      if (
        data.date !== todayKey()
      ) {
        /*
         * 日付が変わったら、
         * 今日の勤務開始場所だけリセット。
         * 前回勤務情報は残します。
         */
        return {
          date: todayKey(),
          previousWorkText:
            String(
              data.previousWorkText ||
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
    const next = {
      ...readSnapshot(),
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

  function clearCommuteSnapshot() {
    const current =
      readSnapshot();

    delete current.commuteValue;
    delete current.commuteLabel;

    saveSnapshot(current);

    document.documentElement
      .removeAttribute(
        'data-commute-saved'
      );

    document.documentElement
      .removeAttribute(
        'data-commute-initializing'
      );
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

  function setInitializing(active) {
    if (active) {
      document.documentElement
        .setAttribute(
          'data-commute-initializing',
          '1'
        );
    } else {
      document.documentElement
        .removeAttribute(
          'data-commute-initializing'
        );
    }
  }

  function selectedCommute(select) {
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

  function commuteResultReady() {
    const result =
      document.getElementById(
        'commuteResult'
      );

    if (!result) return false;

    const text =
      String(
        result.textContent || ''
      )
        .replace(/\s+/g, ' ')
        .trim();

    if (!text) return false;

    const waitingWords = [
      '勤務開始場所を選択してください',
      '読み込み中',
      '取得中',
      '計算中',
      '確認中'
    ];

    return !waitingWords.some(
      word => text.includes(word)
    );
  }

  function finishCommuteReady() {
    /*
     * 通勤距離など既存 portal.js 側の計算が終わった後で、
     * カードを非表示にし、始業操作を解放します。
     */
    setInitializing(false);
    setCommuteSaved(true);
    manualSelectionPending = false;
  }

  function findSavedOption(
    select,
    snapshot
  ) {
    const options =
      Array.from(
        select.options || []
      );

    /*
     * まず value で一致、
     * 次に表示名で一致。
     */
    return (
      options.find(
        option =>
          String(option.value || '').trim() ===
          String(snapshot.commuteValue || '').trim()
      ) ||
      options.find(
        option =>
          String(option.textContent || '').trim() ===
          String(snapshot.commuteLabel || '').trim()
      ) ||
      null
    );
  }

  function optionsAreLoaded(select) {
    if (!select) return false;

    const options =
      Array.from(
        select.options || []
      );

    if (!options.length) return false;

    return options.some(option => {
      const text =
        String(
          option.textContent || ''
        ).trim();

      return (
        option.value &&
        !text.includes('読み込み') &&
        !text.includes('取得中')
      );
    });
  }

  function replaySavedCommuteIfPossible() {
    if (replayDone) return;

    const snapshot =
      readSnapshot();

    if (
      !snapshot.commuteLabel
    ) {
      setCommuteSaved(false);
      setInitializing(false);
      return;
    }

    /*
     * 保存済みならポータル上のカードは最初から隠しますが、
     * portal.js には通常どおり候補を読み込ませます。
     */
    setCommuteSaved(true);
    setInitializing(true);

    const select =
      document.getElementById(
        'commuteDestination'
      );

    if (
      !select ||
      !optionsAreLoaded(select)
    ) {
      return;
    }

    const option =
      findSavedOption(
        select,
        snapshot
      );

    if (!option) {
      /*
       * 今日の候補から消えている場合は
       * 古い保存情報と判断して再選択させます。
       */
      clearCommuteSnapshot();
      replayDone = true;
      return;
    }

    select.value =
      option.value;

    replayDone = true;

    /*
     * portal.js の既存 change 処理を動かして、
     * 通勤距離等の内部状態を再構築します。
     */
    select.dispatchEvent(
      new Event(
        'change',
        {
          bubbles: true
        }
      )
    );

    /*
     * すでに結果が復元されている場合。
     */
    if (commuteResultReady()) {
      finishCommuteReady();
    }
  }

  function saveManualSelection() {
    const select =
      document.getElementById(
        'commuteDestination'
      );

    const selected =
      selectedCommute(select);

    if (!selected) return;

    saveSnapshot({
      commuteValue:
        selected.value,
      commuteLabel:
        selected.label
    });

    /*
     * 選択直後には消さず、
     * portal.js の通勤距離計算が終わるまで表示を残します。
     */
    manualSelectionPending = true;
    setInitializing(true);
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
      !stateText.includes(
        '確認中'
      )
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

    const result =
      document.getElementById(
        'commuteResult'
      );

    /*
     * 保存済みの勤務開始場所がある場合は
     * 最初からカードを見せない。
     * ただし裏側では portal.js の通常取得を邪魔しません。
     */
    const snapshot =
      readSnapshot();

    if (
      snapshot.commuteLabel
    ) {
      setCommuteSaved(true);
      setInitializing(true);
    }

    select?.addEventListener(
      'change',
      event => {
        /*
         * replay 時も portal.js の処理は走ります。
         * 保存値は同じなので再保存して問題ありません。
         */
        const selected =
          selectedCommute(select);

        if (!selected) return;

        saveSnapshot({
          commuteValue:
            selected.value,
          commuteLabel:
            selected.label
        });

        if (!replayDone) {
          /*
           * 初回の手動選択
           */
          manualSelectionPending = true;
        }

        setInitializing(true);
      }
    );

    const observer =
      new MutationObserver(
        () => {
          replaySavedCommuteIfPossible();

          if (
            commuteResultReady() &&
            (
              replayDone ||
              manualSelectionPending
            )
          ) {
            finishCommuteReady();
          }

          savePortalWorkTexts();
        }
      );

    [
      select,
      result,
      document.getElementById(
        'workStateLabel'
      ),
      document.getElementById(
        'workTimeDetail'
      )
    ]
      .filter(Boolean)
      .forEach(
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

    replaySavedCommuteIfPossible();
    savePortalWorkTexts();
  }

  document.addEventListener(
    'DOMContentLoaded',
    bind
  );

  window.addEventListener(
    'pageshow',
    () => {
      /*
       * ホーム再表示でも表示上は選択済みのまま。
       * bfcache 復帰時には既存状態をそのまま利用します。
       */
      const snapshot =
        readSnapshot();

      if (
        snapshot.commuteLabel
      ) {
        setCommuteSaved(true);
      }

      savePortalWorkTexts();
    }
  );
})();
