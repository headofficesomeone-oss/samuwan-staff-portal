(() => {
  'use strict';

  const RC = window.RequestCommon;
  const $ = id => document.getElementById(id);
  const mobileQuery = window.matchMedia('(max-width: 720px)');

  const state = {
    step: 1,
    dateMode: 'single',
    masters: { clients: [], staffs: [] },
    user: RC.currentUser(),
    place: {
      destination: { inputName: '', placeId: '' },
      meeting: { inputName: '', placeId: '' }
    },
    searchTimers: {}
  };

  const E = {
    message: $('requestMessage'),
    form: $('requestForm'),
    reporter: $('reporterName'),
    headerReporter: $('headerReporter'),
    type: $('requestType'),
    targetField: $('targetShiftField'),
    targetShift: $('targetShiftId'),
    client: $('clientName'),
    system: $('system'),
    service: $('service'),
    singleDate: $('singleDate'),
    multiList: $('multiDateList'),
    addMultiDate: $('addMultiDate'),
    rangeStart: $('rangeStart'),
    rangeEnd: $('rangeEnd'),
    start: $('startTime'),
    duration: $('durationHours'),
    end: $('endTime'),
    endAutoNote: $('endAutoNote'),
    appt: $('appointmentTime'),
    destination: $('destination'),
    destinationId: $('destinationPlaceId'),
    destinationResults: $('destinationResults'),
    destinationStatus: $('destinationStatus'),
    meeting: $('meetingPlace'),
    meetingId: $('meetingPlaceId'),
    meetingResults: $('meetingPlaceResults'),
    meetingStatus: $('meetingPlaceStatus'),
    moveType: $('moveType'),
    mainStaff: $('mainStaffName'),
    staff2: $('staff2Name'),
    staff3: $('staff3Name'),
    staffChangeFields: $('staffChangeFields'),
    oldStaff: $('oldStaffName'),
    newStaff: $('newStaffName'),
    support: $('supportContent'),
    changeField: $('changeContentField'),
    change: $('changeContent'),
    reason: $('changeReason'),
    note: $('note'),
    confirmClient: $('confirmClient'),
    confirmService: $('confirmService'),
    confirmDateTime: $('confirmDateTime'),
    confirmDetail: $('confirmDetail'),
    pcClient: $('pcSummaryClient'),
    pcService: $('pcSummaryService'),
    pcTime: $('pcSummaryTime'),
    prev: $('prevStepButton'),
    next: $('nextStepButton'),
    desktopConfirm: $('desktopConfirmButton'),
    pcPreview: $('pcPreviewButton'),
    confirmActions: $('confirmActions'),
    edit: $('editButton'),
    save: $('saveRequestButton'),
    successPanel: $('successPanel'),
    successRequestId: $('successRequestId'),
    newRequest: $('newRequestButton'),
    toast: $('toast')
  };

  document.addEventListener('DOMContentLoaded', start);

  async function start() {
    bindEvents();

    E.reporter.value = state.user.name || '職員情報未取得';
    E.headerReporter.textContent =
      state.user.name ? `${state.user.name} さん` : '職員情報未取得';

    if (!state.user.id || !state.user.name) {
      showMessage(
        'ログイン職員情報を確認できません。職員ポータルから開き直してください。',
        true
      );
    }

    setToday();
    updateRequestMode();
    updateView();

    try {
      state.masters = await RC.loadMasters();
      renderMasterOptions();
    } catch (err) {
      showMessage(err.message || String(err), true);
    }

    updateSummary();
  }

  function bindEvents() {
    E.type.addEventListener('change', updateRequestMode);

    document.querySelectorAll('[data-date-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.dateMode = btn.dataset.dateMode;
        document.querySelectorAll('[data-date-mode]')
          .forEach(x => x.classList.toggle('active', x === btn));
        document.querySelectorAll('[data-date-area]')
          .forEach(area => area.classList.toggle(
            'hidden',
            area.dataset.dateArea !== state.dateMode
          ));
        updateSummary();
      });
    });

    E.addMultiDate.addEventListener('click', addMultiDateRow);

    document.querySelectorAll('[data-weekday]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        updateSummary();
      });
    });

    [E.start, E.duration].forEach(el => {
      el.addEventListener('input', calculateEnd);
      el.addEventListener('change', calculateEnd);
    });

    E.end.addEventListener('input', () => {
      E.endAutoNote.classList.add('hidden');
      updateSummary();
    });

    [
      E.client, E.system, E.service, E.singleDate,
      E.rangeStart, E.rangeEnd, E.appt, E.moveType,
      E.mainStaff, E.staff2, E.staff3, E.oldStaff,
      E.newStaff, E.support, E.change, E.reason, E.note
    ].forEach(el => {
      el?.addEventListener('input', updateSummary);
      el?.addEventListener('change', updateSummary);
    });

    wirePlaceSearch(
      'destination',
      E.destination,
      E.destinationId,
      E.destinationResults,
      E.destinationStatus
    );

    wirePlaceSearch(
      'meeting',
      E.meeting,
      E.meetingId,
      E.meetingResults,
      E.meetingStatus
    );

    E.prev.addEventListener('click', () => {
      if (state.step > 1) {
        state.step--;
        updateView();
      }
    });

    E.next.addEventListener('click', async () => {
      if (state.step < 4) {
        if (!validateStep(state.step)) return;
        state.step++;
        updateView();
        return;
      }
      await submit();
    });

    E.desktopConfirm.addEventListener('click', showConfirmDesktop);
    E.pcPreview.addEventListener('click', showConfirmDesktop);

    E.edit.addEventListener('click', () => {
      E.confirmActions.classList.add('hidden');
      E.desktopConfirm.classList.remove('hidden');
      if (mobileQuery.matches) {
        state.step = 1;
        updateView();
      } else {
        document.querySelector('[data-step="1"]')?.scrollIntoView({ behavior: 'smooth' });
      }
    });

    E.save.addEventListener('click', submit);
    E.newRequest?.addEventListener('click', resetForNewRequest);

    document.querySelectorAll('[data-step-jump]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!mobileQuery.matches) return;
        const target = Number(btn.dataset.stepJump || 1);
        if (target <= state.step || target === 4) {
          state.step = target;
          updateView();
        }
      });
    });

    mobileQuery.addEventListener?.('change', updateView);

    document.addEventListener('click', event => {
      if (!event.target.closest('.place-search-wrap')) {
        document.querySelectorAll('.place-results')
          .forEach(x => x.classList.add('hidden'));
      }
    });
  }

  function renderMasterOptions() {
    const clientHtml =
      '<option value="">利用者を選択してください</option>' +
      state.masters.clients.map(item =>
        `<option value="${escAttr(item.id)}" data-name="${escAttr(item.name)}">${esc(item.name)}</option>`
      ).join('');

    E.client.innerHTML = clientHtml;

    const staffHtml =
      '<option value="">指定なし</option>' +
      state.masters.staffs.map(item =>
        `<option value="${escAttr(item.id)}" data-name="${escAttr(item.name)}">${esc(item.name)}</option>`
      ).join('');

    [E.mainStaff, E.staff2, E.staff3, E.oldStaff, E.newStaff]
      .forEach(select => select.innerHTML = staffHtml);
  }

  function updateRequestMode() {
    const type = E.type.value;
    E.targetField.classList.toggle('hidden', type === '追加');
    E.staffChangeFields.classList.toggle('hidden', type !== '担当変更');
    E.changeField.classList.toggle('hidden', type !== '変更');
    updateSummary();
  }

  function setToday() {
    const now = new Date();
    const value =
      `${now.getFullYear()}-` +
      `${String(now.getMonth() + 1).padStart(2, '0')}-` +
      `${String(now.getDate()).padStart(2, '0')}`;
    E.singleDate.value = value;
  }

  function addMultiDateRow() {
    const rows = E.multiList.querySelectorAll('.multi-date-row');

    if (rows.length >= RC.MAX_DATES) {
      showToast(`一度に登録できる日付は${RC.MAX_DATES}日までです。`);
      return;
    }

    const row = document.createElement('div');
    row.className = 'multi-date-row';
    row.innerHTML = `
      <input type="date" class="multi-date">
      <button type="button" class="remove-date" aria-label="日付を削除">×</button>
    `;

    row.querySelector('.remove-date').addEventListener('click', () => {
      row.remove();
      updateSummary();
    });

    row.querySelector('.multi-date').addEventListener('change', updateSummary);
    E.multiList.appendChild(row);
  }

  function updateServiceOptions() {
    const system = E.system.value;

    let options = [];

    if (system === '障害福祉') {
      options = [
        '身体介護',
        '家事援助',
        '重度訪問介護',
        '同行援護',
        '移動支援',
        '通院介助'
      ];
    } else if (system === '介護保険') {
      options = [
        '身体介護',
        '生活援助',
        '身体生活',
        '総合事業'
      ];
    }

    const current = E.service.value;

    E.service.innerHTML =
      '<option value="">' +
      (system ? '選択してください' : '制度を先に選択してください') +
      '</option>' +
      options.map(name =>
        `<option value="${name}">${name}</option>`
      ).join('');

    if (options.includes(current)) {
      E.service.value = current;
    }
  }

  function calculateDurationFromEnd() {
    const duration = RC.calculateDurationHours(
      E.start.value,
      E.end.value
    );

    if (duration !== '') {
      E.duration.value = String(duration);
      E.endAutoNote.classList.add('hidden');
    }

    updateSummary();
  }

  function calculateEnd() {
    const end = RC.calculateEndTime(E.start.value, E.duration.value);

    if (end) {
      E.end.value = end;
      E.endAutoNote.classList.remove('hidden');
    } else {
      E.endAutoNote.classList.add('hidden');
    }

    updateSummary();
  }

  function getTargetDates() {
    if (state.dateMode === 'single') {
      return RC.uniqueDates([E.singleDate.value]);
    }

    if (state.dateMode === 'multi') {
      return RC.uniqueDates(
        [...E.multiList.querySelectorAll('.multi-date')]
          .map(input => input.value)
      );
    }

    const weekdays = [...document.querySelectorAll('[data-weekday].active')]
      .map(btn => Number(btn.dataset.weekday));

    return RC.datesFromRange(
      E.rangeStart.value,
      E.rangeEnd.value,
      weekdays
    );
  }

  function selected(select) {
    return RC.selectedMaster(select);
  }

  function validateStep(step) {
    try {
      if (step === 1) {
        const client = selected(E.client);
        if (!client.name) throw new Error('利用者を選択してください。');
        if (!E.service.value.trim()) throw new Error('サービスを入力してください。');

        if (E.type.value !== '追加' && !E.targetShift.value.trim()) {
          throw new Error('対象シフトIDを入力してください。');
        }
      }

      if (step === 2) {
        RC.validateDates(getTargetDates());
        if (!E.start.value) throw new Error('開始時刻を入力してください。');
      }

      if (step === 3 && E.type.value === '担当変更') {
        if (!selected(E.oldStaff).name || !selected(E.newStaff).name) {
          throw new Error('変更前担当・変更後担当を選択してください。');
        }
      }

      hideMessage();
      return true;
    } catch (err) {
      showMessage(err.message || String(err), true);
      return false;
    }
  }

  async function wirePlaceSearch(key, input, hidden, results, status) {
    input.addEventListener('input', () => {
      state.place[key] = {
        inputName: input.value.trim(),
        placeId: ''
      };
      hidden.value = '';
      setPlaceStatus(status, '', false);

      clearTimeout(state.searchTimers[key]);
      if (!input.value.trim()) {
        results.classList.add('hidden');
        updateSummary();
        return;
      }

      state.searchTimers[key] = setTimeout(async () => {
        try {
          const places = await RC.searchPlaces(input.value.trim(), 8);
          renderPlaceResults(key, input, hidden, results, status, places);
        } catch (err) {
          console.error(err);
          results.classList.add('hidden');
        }
      }, 250);

      updateSummary();
    });
  }

  function renderPlaceResults(key, input, hidden, results, status, places) {
    if (!places.length) {
      results.innerHTML = `
        <div class="place-result" data-temp="1">
          <strong>候補が見つかりません</strong>
          <small>登録時に仮登録できます</small>
        </div>
      `;
      results.classList.remove('hidden');
      results.querySelector('[data-temp]').addEventListener('click', () => {
        results.classList.add('hidden');
        setPlaceStatus(status, '仮登録予定', true);
      });
      return;
    }

    results.innerHTML = places.map((place, index) => `
      <div class="place-result" data-place-index="${index}">
        <strong>${esc(place.displayName || place.placeName || '')}</strong>
        <small>${esc([
          place.city || '',
          place.fullAddress || '',
          place.matchedAlias ? `別名：${place.matchedAlias}` : '',
          place.placeId || ''
        ].filter(Boolean).join(' ｜ '))}</small>
      </div>
    `).join('');

    results.classList.remove('hidden');

    results.querySelectorAll('[data-place-index]').forEach(el => {
      el.addEventListener('click', () => {
        const place = places[Number(el.dataset.placeIndex)];
        const name = String(
          place.displayName ||
          place.placeName ||
          input.value
        ).trim();
        const id = String(place.placeId || '').trim();

        input.value = name;
        hidden.value = id;
        state.place[key] = { inputName: name, placeId: id };
        setPlaceStatus(status, id ? `場所ID：${id}` : '未選択', !!id);
        results.classList.add('hidden');
        updateSummary();
      });
    });
  }

  function setPlaceStatus(element, text, selectedState) {
    element.textContent = text || '場所ID：未選択';
    element.classList.toggle('selected', !!selectedState);
  }

  function getPeopleCount() {
    let count = 0;

    if (selected(E.mainStaff).id) {
      count += 1;
    }

    if (selected(E.staff2).id) {
      count += 1;
    }

    return count;
  }

  function updatePeopleCount() {
    const count = getPeopleCount();

    if (E.peopleCount) {
      E.peopleCount.value = count > 0 ? String(count) : '';
    }

    return count;
  }

  function buildPayload() {
    const client = selected(E.client);
    const main = selected(E.mainStaff);
    const staff2 = selected(E.staff2);
    const staff3 = selected(E.staff3);
    const oldStaff = selected(E.oldStaff);
    const newStaff = selected(E.newStaff);

    return {
      requestType: E.type.value,
      targetShiftId: E.targetShift.value.trim(),

      reporterId: state.user.id,
      reporterName: state.user.name,

      clientId: client.id,
      clientName: client.name,

      system: E.system.value,
      service: E.service.value.trim(),

      targetDates: getTargetDates(),
      startTime: E.start.value,
      durationHours: E.duration.value ? Number(E.duration.value) : '',
      endTime: E.end.value,

      people: getPeopleCount() || '',

      mainStaffId: main.id,
      mainStaffName: main.name,
      staff2Id: staff2.id,
      staff2Name: staff2.name,
      staff3Id: staff3.id,
      staff3Name: staff3.name,

      oldStaffId: oldStaff.id,
      oldStaffName: oldStaff.name,
      newStaffId: newStaff.id,
      newStaffName: newStaff.name,

      destination: E.destination.value.trim(),
      destinationPlaceId: E.destinationId.value.trim(),
      appointmentTime: E.appt.value,
      meetingPlace: E.meeting.value.trim(),
      meetingPlaceId: E.meetingId.value.trim(),

      moveType: E.moveType.value,
      supportContent: E.support.value.trim(),
      changeContent: E.change.value.trim(),
      changeReason: E.reason.value.trim(),
      note: E.note.value.trim(),

      registerMethod: 'WEB'
    };
  }

  async function completePlaces(payload) {
    const destination = await RC.ensurePlace({
      inputName: payload.destination,
      placeId: payload.destinationPlaceId
    }, state.user);

    payload.destination = destination.displayName || payload.destination;
    payload.destinationPlaceId = destination.placeId || '';

    const meeting = await RC.ensurePlace({
      inputName: payload.meetingPlace,
      placeId: payload.meetingPlaceId
    }, state.user);

    payload.meetingPlace = meeting.displayName || payload.meetingPlace;
    payload.meetingPlaceId = meeting.placeId || '';

    return payload;
  }

  async function submit() {
    let payload;

    if (state.registered) {
      showToast('この依頼は登録済みです。');
      return;
    }

    try {
      if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

      payload = buildPayload();
      setSaving(true);

      payload = await completePlaces(payload);
      const result = await RC.saveRequest(payload);

      showMessage(
        result.count > 1
          ? `${result.count}日分の依頼を登録しました。`
          : '依頼を登録しました。',
        false
      );

      showToast(
        result.requestId
          ? `登録しました：${result.requestId}`
          : '登録しました'
      );

      state.registered = true;
      setSaving(false);
      lockAfterSuccess(result);
    } catch (err) {
      state.registered = false;
      showMessage(err.message || String(err), true);
      setSaving(false);
    }
  }


  function lockAfterSuccess(result) {
    E.next.disabled = true;
    E.save.disabled = true;
    E.desktopConfirm.disabled = true;
    E.edit.disabled = true;

    E.confirmActions.classList.add('hidden');
    E.desktopConfirm.classList.add('hidden');

    E.successRequestId.textContent =
      result.requestId
        ? `依頼ID：${result.requestId}`
        : (result.count > 1 ? `${result.count}日分登録` : '');

    E.successPanel.classList.remove('hidden');

    if (mobileQuery.matches) {
      E.next.textContent = '登録済み';
      E.prev.classList.add('hidden');
    }
  }

  function resetForNewRequest() {
    state.registered = false;
    state.step = 1;
    state.dateMode = 'single';
    state.place.destination = { inputName: '', placeId: '' };
    state.place.meeting = { inputName: '', placeId: '' };

    E.form.reset();

    E.type.value = '追加';
    E.reporter.value = state.user.name || '職員情報未取得';
    updateServiceOptions();
    setToday();

    document.querySelectorAll('[data-date-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.dateMode === 'single');
    });
    document.querySelectorAll('[data-date-area]').forEach(area => {
      area.classList.toggle('hidden', area.dataset.dateArea !== 'single');
    });
    document.querySelectorAll('[data-weekday]').forEach(btn => {
      btn.classList.remove('active');
    });

    const rows = [...E.multiList.querySelectorAll('.multi-date-row')];
    rows.slice(1).forEach(row => row.remove());
    const firstMulti = E.multiList.querySelector('.multi-date');
    if (firstMulti) firstMulti.value = '';

    E.destinationId.value = '';
    E.meetingId.value = '';
    E.destinationResults.classList.add('hidden');
    E.meetingResults.classList.add('hidden');
    setPlaceStatus(E.destinationStatus, '', false);
    setPlaceStatus(E.meetingStatus, '', false);
    E.endAutoNote.classList.add('hidden');
    updatePeopleCount();

    E.successPanel.classList.add('hidden');
    E.desktopConfirm.classList.remove('hidden');
    E.desktopConfirm.disabled = false;
    E.edit.disabled = false;
    E.save.disabled = false;
    E.next.disabled = false;

    hideMessage();
    updateRequestMode();
    updateView();
    updateSummary();
  }

  function showConfirmDesktop() {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    updateSummary();
    document.querySelector('[data-step="4"]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    E.desktopConfirm.classList.add('hidden');
    E.confirmActions.classList.remove('hidden');
  }

  function updateSummary() {
    const client = selected(E.client);
    const service = E.service.value.trim();
    const dates = getTargetDates();
    const start = E.start.value;
    const end = E.end.value;
    const duration = E.duration.value;

    const dateText = formatDates(dates);
    const timeText =
      start
        ? `開始 ${start}` +
          (end ? ` ／ 終了 ${end}` : '') +
          (duration ? ` ／ ${duration}時間` : '')
        : '時刻未入力';

    E.confirmClient.textContent = client.name || '未選択';
    E.confirmService.textContent = service || '未選択';
    E.confirmDateTime.textContent =
      `${dateText || '日付未選択'}　${timeText}`;

    E.pcClient.textContent = client.name || '利用者未選択';
    E.pcService.textContent = service || 'サービス未選択';
    E.pcTime.textContent =
      `${dateText || '日時未選択'}${start ? `　${start}${end ? `～${end}` : ''}` : ''}`;

    const detail = [
      ['依頼種別', E.type.value],
      ['制度', E.system.value],
      ['支援時間数', duration ? `${duration}時間` : ''],
      ['人数', getPeopleCount() ? `${getPeopleCount()}人` : ''],
      ['予約時間', E.appt.value],
      ['行き先', E.destination.value.trim()],
      ['行き先場所ID', E.destinationId.value.trim()],
      ['待合せ場所', E.meeting.value.trim()],
      ['待合せ場所ID', E.meetingId.value.trim()],
      ['移動区分', E.moveType.value],
      ['主担当', selected(E.mainStaff).name],
      ['担当2', selected(E.staff2).name],
      ['担当3', selected(E.staff3).name],
      ['変更前担当', selected(E.oldStaff).name],
      ['変更後担当', selected(E.newStaff).name],
      ['支援内容', E.support.value.trim()],
      ['変更内容', E.change.value.trim()],
      ['変更理由', E.reason.value.trim()],
      ['特記事項', E.note.value.trim()]
    ].filter(([,value]) => String(value || '').trim());

    E.confirmDetail.innerHTML = detail.length
      ? detail.map(([label, value]) =>
          `<div class="confirm-row"><b>${esc(label)}</b><span>${esc(value)}</span></div>`
        ).join('')
      : '<div class="confirm-row"><b>その他</b><span>入力なし</span></div>';

  }

  function formatDates(dates) {
    const list = RC.uniqueDates(dates);
    if (!list.length) return '';
    if (list.length === 1) return shortDate(list[0]);
    return `${shortDate(list[0])} ほか${list.length - 1}日`;
  }

  function shortDate(value) {
    const m = String(value || '').match(/^\d{4}-(\d{2})-(\d{2})$/);
    return m ? `${Number(m[1])}/${Number(m[2])}` : value;
  }

  function updateView() {
    const mobile = mobileQuery.matches;

    document.querySelectorAll('.step-screen').forEach(screen => {
      if (mobile) {
        screen.classList.toggle(
          'active',
          Number(screen.dataset.step) === state.step
        );
      } else {
        screen.classList.add('active');
      }
    });

    document.querySelectorAll('.progress-item').forEach((item, index) => {
      item.classList.toggle('active', index + 1 <= state.step);
    });

    E.prev.classList.toggle('hidden', state.step === 1);
    E.next.textContent = state.step === 4 ? '登録する' : '次へ';

    E.confirmActions.classList.add('hidden');

    if (mobile && state.step === 4) {
      updateSummary();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setSaving(saving) {
    E.next.disabled = saving;
    E.save.disabled = saving;
    E.desktopConfirm.disabled = saving;
    if (saving) {
      E.next.dataset.original = E.next.textContent;
      E.next.textContent = '登録中...';
      E.save.textContent = '登録中...';
    } else {
      E.next.textContent =
        state.step === 4 ? '登録する' : '次へ';
      E.save.textContent = '登録する';
    }
  }

  function showMessage(text, error) {
    E.message.textContent = text;
    E.message.className = `message ${error ? 'error' : 'success'}`;
    E.message.classList.remove('hidden');
    if (mobileQuery.matches) {
      E.message.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function hideMessage() {
    E.message.classList.add('hidden');
  }

  function showToast(text) {
    E.toast.textContent = text;
    E.toast.classList.remove('hidden');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(
      () => E.toast.classList.add('hidden'),
      2300
    );
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escAttr(value) {
    return esc(value);
  }
})();
