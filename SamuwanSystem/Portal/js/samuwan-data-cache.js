window.SamuwanLocalData = (() => {
  'use strict';

  const PREFIX = 'samuwan_local_data_v2:';
  const LEGACY_PREFIX = 'samuwan_local_data_v1:';

  function storageKey(key) {
    return PREFIX + String(key || '');
  }

  function getEntry(key) {
    try {
      const raw = localStorage.getItem(storageKey(key));
      if (!raw) return null;

      const entry = JSON.parse(raw);

      if (!entry || typeof entry !== 'object') {
        return null;
      }

      return entry;
    }
    catch (_) {
      return null;
    }
  }

  function get(key) {
    return getEntry(key)?.data ?? null;
  }

  function getVersion(key) {
    return String(
      getEntry(key)?.version || ''
    );
  }

  function fingerprint(data) {
    try {
      return JSON.stringify(data);
    }
    catch (_) {
      return '';
    }
  }

  function setIfChanged(
    key,
    data,
    version = ''
  ) {
    try {
      const oldEntry = getEntry(key);
      const nextFingerprint = fingerprint(data);
      const nextVersion = String(version || '');

      if (
        oldEntry &&
        oldEntry.fingerprint === nextFingerprint &&
        String(oldEntry.version || '') === nextVersion
      ) {
        return {
          changed: false,
          savedAt: oldEntry.savedAt || 0
        };
      }

      const entry = {
        savedAt: Date.now(),
        version: nextVersion,
        fingerprint: nextFingerprint,
        data
      };

      localStorage.setItem(
        storageKey(key),
        JSON.stringify(entry)
      );

      return {
        changed: true,
        savedAt: entry.savedAt
      };
    }
    catch (_) {
      return {
        changed: false,
        savedAt: 0
      };
    }
  }

  function setVersion(
    key,
    version
  ) {
    try {
      const entry = getEntry(key);

      if (!entry) {
        return;
      }

      entry.version =
        String(version || '');

      localStorage.setItem(
        storageKey(key),
        JSON.stringify(entry)
      );
    }
    catch (_) {}
  }

  function remove(key) {
    try {
      localStorage.removeItem(storageKey(key));
    }
    catch (_) {}
  }

  function removePrefix(prefix) {
    const fullPrefix = storageKey(prefix);
    const removeKeys = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (
          key &&
          key.startsWith(fullPrefix)
        ) {
          removeKeys.push(key);
        }
      }

      removeKeys.forEach(
        key => localStorage.removeItem(key)
      );
    }
    catch (_) {}
  }

  function clearLegacyV1() {
    try {
      const removeKeys = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (
          key &&
          key.startsWith(LEGACY_PREFIX)
        ) {
          removeKeys.push(key);
        }
      }

      removeKeys.forEach(
        key => localStorage.removeItem(key)
      );
    }
    catch (_) {}
  }

  function monday(dateValue) {
    const d = new Date(dateValue);
    d.setHours(0,0,0,0);

    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    d.setDate(d.getDate() + diff);

    return d;
  }

  function addDays(dateValue, days) {
    const d = new Date(dateValue);
    d.setDate(d.getDate() + days);
    return d;
  }

  function addMonths(dateValue, months) {
    const d = new Date(dateValue);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  function ymd(dateValue) {
    const d = new Date(dateValue);

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2,'0'),
      String(d.getDate()).padStart(2,'0')
    ].join('-');
  }

  function requestRangeBounds() {
    const todayWeek = monday(new Date());

    const start =
      ymd(
        addDays(
          todayWeek,
          -7
        )
      );

    const threeMonthsLater =
      addMonths(
        todayWeek,
        3
      );

    const end =
      ymd(
        addDays(
          monday(
            threeMonthsLater
          ),
          6
        )
      );

    return {
      start,
      end
    };
  }

  function requestRangeKey(
    start,
    end
  ) {
    return (
      'request-range:' +
      String(start || '') +
      ':' +
      String(end || '')
    );
  }

  function shiftWeekKey(weekStart) {
    return (
      'shift-week:' +
      String(weekStart || '')
    );
  }

  async function post(url, payload) {
    const response =
      await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'text/plain;charset=utf-8'
          },
          body:
            JSON.stringify(payload),
          redirect: 'follow'
        }
      );

    if (!response.ok) {
      throw new Error(
        'HTTP ' +
        response.status
      );
    }

    return response.json();
  }

  function resolveGasUrl() {
    try {
      if (
        window.REQUEST_APP?.GAS_URL
      ) {
        return String(
          window.REQUEST_APP.GAS_URL
        ).trim();
      }

      if (
        window.APP?.GAS_URL
      ) {
        return String(
          window.APP.GAS_URL
        ).trim();
      }

      if (
        typeof APP !== 'undefined' &&
        APP?.GAS_URL
      ) {
        return String(
          APP.GAS_URL
        ).trim();
      }
    }
    catch (_) {}

    return '';
  }

  async function getServerVersions(
    url = resolveGasUrl()
  ) {
    if (
      !url ||
      !url.endsWith('/exec')
    ) {
      throw new Error(
        'GAS_URLを確認できません。'
      );
    }

    const result =
      await post(
        url,
        {
          action:
            'data.version'
        }
      );

    if (!result?.ok) {
      throw new Error(
        result?.message ||
        result?.error ||
        '更新番号を取得できませんでした。'
      );
    }

    return {
      requestVersion:
        String(
          result.requestVersion || '0'
        ),

      shiftVersion:
        String(
          result.shiftVersion || '0'
        ),

      masterVersion:
        String(
          result.masterVersion || '0'
        )
    };
  }

  async function prefetchPortalInitial() {
    const url =
      resolveGasUrl();

    if (
      !url ||
      !url.endsWith('/exec')
    ) {
      return;
    }

    let versions;

    try {
      versions =
        await getServerVersions(
          url
        );
    }
    catch (_) {
      /*
       * バージョンAPIが未反映でも
       * 既存キャッシュを壊さない。
       */
      return;
    }

    const bounds =
      requestRangeBounds();

    const currentMonday =
      monday(
        new Date()
      );

    const weekStarts = [
      ymd(addDays(currentMonday,-7)),
      ymd(currentMonday),
      ymd(addDays(currentMonday,7))
    ];

    const jobs = [];

    const masterKey =
      'masters';

    if (
      !get(masterKey) ||
      getVersion(masterKey) !==
        versions.masterVersion
    ) {
      jobs.push(
        post(
          url,
          {
            action:
              'request.masters'
          }
        )
          .then(result => {
            if (result?.ok) {
              setIfChanged(
                masterKey,
                result,
                versions.masterVersion
              );
            }
          })
      );
    }

    const rangeKey =
      requestRangeKey(
        bounds.start,
        bounds.end
      );

    if (
      !get(rangeKey) ||
      getVersion(rangeKey) !==
        versions.requestVersion
    ) {
      jobs.push(
        post(
          url,
          {
            action:
              'request.range',
            startDate:
              bounds.start,
            endDate:
              bounds.end
          }
        )
          .then(result => {
            if (result?.ok) {
              setIfChanged(
                rangeKey,
                result,
                versions.requestVersion
              );
            }
          })
      );
    }

    weekStarts.forEach(
      weekStart => {
        const key =
          shiftWeekKey(
            weekStart
          );

        if (
          get(key) &&
          getVersion(key) ===
            versions.shiftVersion
        ) {
          return;
        }

        jobs.push(
          post(
            url,
            {
              action:
                'shift.week.list',
              weekStart
            }
          )
            .then(result => {
              if (result?.ok) {
                setIfChanged(
                  key,
                  result,
                  versions.shiftVersion
                );
              }
            })
        );
      }
    );

    if (!jobs.length) {
      return;
    }

    await Promise.allSettled(
      jobs
    );
  }

  clearLegacyV1();

  return {
    getEntry,
    get,
    getVersion,
    setIfChanged,
    setVersion,
    remove,
    removePrefix,
    requestRangeBounds,
    requestRangeKey,
    shiftWeekKey,
    getServerVersions,
    prefetchPortalInitial
  };
})();
