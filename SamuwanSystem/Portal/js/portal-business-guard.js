(() => {
  'use strict';

  const BUSINESS_PAGES =
    new Set([
      'action',
      'office',
      'meeting'
    ]);

  const MESSAGE =
    '業務操作を利用するには、先に「始業」を行ってください。';

  function getWorkStateText() {
    return String(
      document
        .getElementById(
          'workStateLabel'
        )
        ?.textContent ||
      ''
    )
      .replace(/\s+/g, '')
      .trim();
  }

  function isWorking() {
    const text =
      getWorkStateText();

    /*
     * 現行表示は「未始業」と「始業中」を使う想定。
     * 「始業」の文字だけで判定すると「未始業」も含むため、
     * 明示的に未始業を除外します。
     */
    if (
      !text ||
      text.includes('確認中') ||
      text.includes('未始業') ||
      text.includes('終業')
    ) {
      return false;
    }

    return (
      text.includes('始業中') ||
      text.includes('勤務中')
    );
  }

  function updateReadyAttribute() {
    document.documentElement
      .setAttribute(
        'data-business-work-ready',
        isWorking()
          ? '1'
          : '0'
      );
  }

  function showWorkMessage() {
    /*
     * PC/スマホで確実に同じ挙動になるよう
     * native alert を使います。
     */
    alert(MESSAGE);

    const area =
      document.getElementById(
        'message'
      );

    if (area) {
      area.textContent =
        MESSAGE;
    }
  }

  function normalizeButtons() {
    document
      .querySelectorAll(
        '.portal-business-grid [data-page]'
      )
      .forEach(button => {
        const page =
          String(
            button.dataset.page ||
            ''
          );

        if (
          !BUSINESS_PAGES.has(
            page
          )
        ) {
          return;
        }

        /*
         * 既存 portal.js が disabled / hidden にしても、
         * 業務操作は常に表示してクリック可能にします。
         * 実際に遷移してよいかは capture で判定します。
         */
        button.disabled = false;
        button.hidden = false;
        button.classList.remove(
          'hidden'
        );
      });

    updateReadyAttribute();
  }

  /*
   * capture フェーズで止めるので、
   * スマホでも既存の data-page 処理より先に判定できます。
   */
  document.addEventListener(
    'click',
    event => {
      const button =
        event.target.closest(
          '.portal-business-grid [data-page]'
        );

      if (!button) return;

      const page =
        String(
          button.dataset.page ||
          ''
        );

      if (
        !BUSINESS_PAGES.has(
          page
        )
      ) {
        return;
      }

      if (
        isWorking()
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      showWorkMessage();
    },
    true
  );

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      normalizeButtons();

      const target =
        document.getElementById(
          'portalView'
        ) ||
        document.body;

      const observer =
        new MutationObserver(
          normalizeButtons
        );

      observer.observe(
        target,
        {
          subtree:true,
          childList:true,
          attributes:true,
          attributeFilter:[
            'class',
            'disabled',
            'hidden'
          ],
          characterData:true
        }
      );

      const state =
        document.getElementById(
          'workStateLabel'
        );

      if (state) {
        const stateObserver =
          new MutationObserver(
            updateReadyAttribute
          );

        stateObserver.observe(
          state,
          {
            subtree:true,
            childList:true,
            characterData:true
          }
        );
      }
    }
  );

  window.addEventListener(
    'pageshow',
    normalizeButtons
  );
})();
