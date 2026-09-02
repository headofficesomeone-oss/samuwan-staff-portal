/*
 * request-common.js
 * PC / スマホ共通の依頼ロジック
 *
 * 前提:
 *   common.js の apiPost() / getSavedPortalUser() を利用します。
 *
 * 現行Samuwan GAS:
 *   request.masters
 *   request.save
 *   searchPlaceDictionary
 *   resolvePlaceInput
 *   createTempPlaceCandidate
 */
window.RequestCommon = (() => {
  'use strict';

  const MAX_DATES = 5;

  function currentUser() {
    try {
      const user = typeof getSavedPortalUser === 'function'
        ? getSavedPortalUser()
        : null;

      return {
        id: String(user?.employeeId || user?.id || '').trim(),
        name: String(user?.employeeName || user?.name || '').trim()
      };
    } catch (_) {
      return { id: '', name: '' };
    }
  }

  async function api(payload) {
    if (typeof apiPost !== 'function') {
      throw new Error('common.js の apiPost() が見つかりません。');
    }

    const data = payload || {};
    const action = String(data.action || '').trim();

    if (!action) {
      throw new Error('API action が指定されていません。');
    }

    const body = { ...data };
    delete body.action;

    const result = await apiPost(action, body);

    if (!result) {
      throw new Error('GASから応答がありません。');
    }

    return result;
  }

  async function loadMasters() {
    const result = await api({ action: 'request.masters' });

    if (!result.ok) {
      throw new Error(
        result.message ||
        result.error ||
        '利用者・従業員マスタを取得できませんでした。'
      );
    }

    return {
      clients: Array.isArray(result.clients) ? result.clients : [],
      staffs: Array.isArray(result.staffs) ? result.staffs : []
    };
  }

  function selectedMaster(select) {
    const option = select?.options?.[select.selectedIndex];

    return {
      id: String(select?.value || '').trim(),
      name: String(
        option?.dataset?.name ||
        option?.textContent ||
        ''
      ).trim()
    };
  }

  function calculateEndTime(startTime, durationHours) {
    const start = String(startTime || '').trim();
    const hours = Number(durationHours);

    if (!/^\d{2}:\d{2}$/.test(start)) return '';
    if (!Number.isFinite(hours) || hours <= 0) return '';

    const [h, m] = start.split(':').map(Number);
    let minutes = (h * 60) + m + Math.round(hours * 60);
    minutes %= (24 * 60);

    const eh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const em = String(minutes % 60).padStart(2, '0');

    return `${eh}:${em}`;
  }

  function uniqueDates(dates) {
    return [...new Set(
      (dates || [])
        .map(v => String(v || '').trim())
        .filter(Boolean)
    )].sort();
  }

  function datesFromRange(startValue, endValue, weekdays) {
    const startText = String(startValue || '').trim();
    const endText = String(endValue || '').trim();

    if (!startText || !endText) return [];

    const start = new Date(`${startText}T00:00:00`);
    const end = new Date(`${endText}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return [];
    }

    const selected = new Set(
      (weekdays || []).map(Number)
    );

    const result = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (!selected.size || selected.has(d.getDay())) {
        result.push(localDateString(d));
      }
    }
    return uniqueDates(result);
  }

  function localDateString(date) {
    return (
      `${date.getFullYear()}-` +
      `${String(date.getMonth() + 1).padStart(2, '0')}-` +
      `${String(date.getDate()).padStart(2, '0')}`
    );
  }

  function validateDates(dates) {
    const list = uniqueDates(dates);

    if (!list.length) {
      throw new Error('対象日を入力してください。');
    }

    if (list.length > MAX_DATES) {
      throw new Error(`一度に登録できる対象日は${MAX_DATES}日までです。`);
    }

    return list;
  }

  async function searchPlaces(keyword, limit = 10) {
    const q = String(keyword || '').trim();
    if (!q) return [];

    const result = await api({
      action: 'searchPlaceDictionary',
      keyword: q,
      limit
    });

    if (result.success === false || result.ok === false) {
      throw new Error(result.message || result.error || '場所検索に失敗しました。');
    }

    return Array.isArray(result.places) ? result.places : [];
  }

  async function resolvePlace(inputName) {
    const value = String(inputName || '').trim();
    if (!value) {
      return { resolved: true, placeId: '', displayName: '' };
    }

    const result = await api({
      action: 'resolvePlaceInput',
      inputName: value
    });

    if (result.success === false || result.ok === false) {
      throw new Error(result.message || result.error || '場所の確認に失敗しました。');
    }

    if (result.resolved && result.place) {
      return {
        resolved: true,
        placeId: String(result.place.placeId || '').trim(),
        displayName: String(
          result.place.displayName ||
          result.place.placeName ||
          value
        ).trim(),
        place: result.place
      };
    }

    return {
      resolved: false,
      candidates: Array.isArray(result.candidates) ? result.candidates : []
    };
  }

  async function createTempPlace(inputName, user) {
    const value = String(inputName || '').trim();
    if (!value) {
      return { placeId: '', displayName: '' };
    }

    const result = await api({
      action: 'createTempPlaceCandidate',
      inputName: value,
      registrationSource: '新依頼入力',
      registrantId: String(user?.id || '').trim(),
      registrantName: String(user?.name || '').trim()
    });

    if (result.success === false || result.ok === false) {
      const error = new Error(
        result.message ||
        result.error ||
        '場所の仮登録に失敗しました。'
      );
      error.candidates = result.candidates || [];
      throw error;
    }

    return {
      placeId: String(result.placeId || '').trim(),
      displayName: String(result.displayName || value).trim(),
      existing: !!result.existing
    };
  }

  async function ensurePlace(placeState, user) {
    const inputName = String(placeState?.inputName || '').trim();
    const selectedId = String(placeState?.placeId || '').trim();

    if (!inputName) {
      return { placeId: '', displayName: '' };
    }

    if (selectedId) {
      return {
        placeId: selectedId,
        displayName: inputName
      };
    }

    const resolved = await resolvePlace(inputName);

    if (resolved.resolved) {
      return {
        placeId: resolved.placeId,
        displayName: resolved.displayName || inputName
      };
    }

    if (resolved.candidates?.length) {
      const error = new Error(
        `「${inputName}」には近い候補があります。候補から場所を選択してください。`
      );
      error.candidates = resolved.candidates;
      throw error;
    }

    const ok = window.confirm(
      `「${inputName}」は場所辞書に見つかりませんでした。\n仮登録して依頼を続けますか？`
    );

    if (!ok) {
      throw new Error('場所を選択してください。');
    }

    return await createTempPlace(inputName, user);
  }

  function validateBase(data) {
    if (!data.clientName) {
      throw new Error('利用者を選択してください。');
    }
    if (!data.service) {
      throw new Error('サービスを入力してください。');
    }
    if (!data.startTime) {
      throw new Error('開始時刻を入力してください。');
    }
    if (data.requestType !== '追加' && !data.targetShiftId) {
      throw new Error('追加以外では対象シフトIDが必要です。');
    }
    if (
      data.requestType === '担当変更' &&
      (!data.oldStaffName || !data.newStaffName)
    ) {
      throw new Error('担当変更では変更前担当・変更後担当を選択してください。');
    }
  }

  async function saveRequest(payload) {
    validateBase(payload);
    payload.targetDates = validateDates(payload.targetDates);

    const result = await api({
      action: 'request.save',
      ...payload,
      registerMethod: payload.registerMethod || 'WEB'
    });

    if (!result.ok) {
      throw new Error(
        result.message ||
        result.error ||
        '依頼を登録できませんでした。'
      );
    }

    return result;
  }

  return {
    MAX_DATES,
    currentUser,
    api,
    loadMasters,
    selectedMaster,
    calculateEndTime,
    datesFromRange,
    uniqueDates,
    validateDates,
    searchPlaces,
    resolvePlace,
    createTempPlace,
    ensurePlace,
    saveRequest
  };
})();
