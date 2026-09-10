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
    searchTimers: {},
    registered: false,
    operationContext: 'request',
    processMode: '追加',
    selectedTarget: null,
    targetCandidates: []
  };

  const E = {
    message: $('requestMessage'),
    footerMessage: $('desktopFooterMessage'),
    form: $('requestForm'),
    reporter: $('reporterName'),
    headerReporter: $('headerReporter'),
    type: $('requestType'),
    operationContextSelect: $('operationContextSelect'),
    processModeChoices: $('processModeChoices'),
    operationContextNote: $('operationContextNote'),
    modeTestBadge: $('modeTestBadge'),
    selectedModeSummary: $('selectedModeSummary'),
    ruleWeekdayArea: $('ruleWeekdayArea'),
    requestDateModeArea: $('requestDateModeArea'),
    todayFixedArea: $('todayFixedArea'),
    todayFixedDate: $('todayFixedDate'),
    targetShift: $('targetShiftId'),
    openTargetSearch: $('openTargetSearchButton'),
    selectedTargetCard: $('selectedTargetCard'),
    selectedTargetTitle: $('selectedTargetTitle'),
    selectedTargetMeta: $('selectedTargetMeta'),
    selectedTargetShiftId: $('selectedTargetShiftId'),
    reselectTarget: $('reselectTargetButton'),
    targetSearchDialog: $('targetSearchDialog'),
    closeTargetSearchDialog: $('closeTargetSearchDialog'),
    targetSearchClient: $('targetSearchClient'),
    targetSearchDate: $('targetSearchDate'),
    targetSearchDateField: $('targetSearchDateField'),
    targetSearchWeekdayField: $('targetSearchWeekdayField'),
    targetSearchWeekday: $('targetSearchWeekday'),
    targetSearchService: $('targetSearchService'),
    targetSearchStart: $('targetSearchStart'),
    targetCandidateFilters: $('targetCandidateFilters'),
    runTargetSearch: $('runTargetSearchButton'),
    targetSearchStatus: $('targetSearchStatus'),
    targetSearchResults: $('targetSearchResults'),
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
    apptPurpose: $('appointmentPurpose'),
    peopleCount: $('peopleCount'),
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
    outDriver: $('outDriverName'),
    backDriver: $('backDriverName'),
    outVehicle: $('outVehicle'),
    backVehicle: $('backVehicle'),

    beforeTransportMeeting: $('beforeTransportMeeting'),
    beforeTransportMeetingTime: $('beforeTransportMeetingTime'),
    beforeTransportDriver: $('beforeTransportDriverName'),
    beforeTransportVehicle: $('beforeTransportVehicle'),

    afterTransportDestination: $('afterTransportDestination'),
    afterTransportDepartureTime: $('afterTransportDepartureTime'),
    afterTransportDriver: $('afterTransportDriverName'),
    afterTransportVehicle: $('afterTransportVehicle'),

    transportNote: $('transportNote'),
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
    successSummaryBody: $('successSummaryBody'),
    newRequest: $('newRequestButton'),
    viewRegistered: $('viewRegisteredButton'),
    successPortal: $('successPortalButton'),
    toast: $('toast')
  };

  document.addEventListener('DOMContentLoaded', start);

  async function start() {
    bindEvents();

		if (E.operationContextSelect) {
		  E.operationContextSelect.value =
		    state.operationContext;
		}

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
    updateServiceOptions();
    renderProcessModes();
    updateOperationModeUi();
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

		E.operationContextSelect?.addEventListener(
		  'change',
		  () => {
		    state.operationContext =
		      E.operationContextSelect.value;

		    state.processMode =
		      getProcessModes_()[0];

		    clearSelectedTarget_();
		    renderProcessModes();
		    updateOperationModeUi();
		  }
		);

    document.querySelectorAll('[data-rule-weekday]')
      .forEach(button => {
        button.addEventListener('click', () => {
          button.classList.toggle('active');
        });
      });

    E.openTargetSearch?.addEventListener(
      'click',
      openTargetSearchDialog_
    );

    E.reselectTarget?.addEventListener(
      'click',
      openTargetSearchDialog_
    );

    E.closeTargetSearchDialog?.addEventListener(
      'click',
      () => E.targetSearchDialog?.close()
    );

    E.runTargetSearch?.addEventListener(
      'click',
      searchTargetShifts_
    );

    E.targetSearchService?.addEventListener(
      'change',
      updateTargetCandidateFilters_
    );

    E.targetSearchStart?.addEventListener(
      'change',
      renderFilteredTargetCandidates_
    );

    document.querySelectorAll('[data-date-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) {
          return;
        }

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

    E.end.addEventListener('input', calculateDurationFromEnd);
    E.end.addEventListener('change', calculateDurationFromEnd);

    E.system.addEventListener('change', () => {
      updateServiceOptions();
      updateSummary();
    });

    [
      E.client, E.service, E.singleDate,
      E.rangeStart, E.rangeEnd, E.appt, E.apptPurpose, E.moveType,
      E.outVehicle, E.backVehicle,
      E.beforeTransportMeeting, E.beforeTransportMeetingTime,
      E.beforeTransportVehicle,
      E.afterTransportDestination, E.afterTransportDepartureTime,
      E.afterTransportVehicle,
      E.transportNote,
      E.mainStaff, E.staff2, E.staff3, E.oldStaff,
      E.newStaff, E.support, E.change, E.reason, E.note
    ].forEach(el => {
      el?.addEventListener('input', updateSummary);
      el?.addEventListener('change', updateSummary);
    });

    [E.mainStaff, E.staff2].forEach(el => {
      el?.addEventListener('change', () => {
        updatePeopleCount();
        updateSummary();
      });
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
    E.viewRegistered?.addEventListener('click', () => {
      window.location.href = './request-view.html';
    });
    E.successPortal?.addEventListener('click', () => {
      window.location.href = './index.html';
    });

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

    [E.mainStaff, E.staff2, E.staff3, E.oldStaff, E.newStaff,
      E.outDriver, E.backDriver,
      E.beforeTransportDriver, E.afterTransportDriver]
      .forEach(select => {
        if (select) {
          select.innerHTML = staffHtml;
        }
      });

    updatePeopleCount();
  }

  const OPERATION_CONTEXTS_ = {
    rule: {
      label: '規定値',
      note: '今後も繰り返す基本予定を登録・変更する想定です。現在は画面動作確認のみです。',
      modes: ['追加', '変更', '担当変更', '取消']
    },
    request: {
      label: '支援予定依頼',
      note: '未来の支援予定を登録・変更します。「追加」「変更」「キャンセル」「担当変更」「依頼取消」は実際に依頼情報Rへ登録できます。',
      modes: ['追加', '変更', 'キャンセル', '担当変更', '依頼取消']
    },
    today: {
      label: '当日支援変更',
      note: '本日の確定済み支援を変更する想定です。現在は画面動作確認のみです。',
      modes: ['追加', '変更', 'キャンセル', '担当変更']
    }
  };

  function getProcessModes_() {
    return (
      OPERATION_CONTEXTS_[state.operationContext]?.modes ||
      ['追加']
    );
  }

  function isLiveRegistrationMode_() {
    return (
      state.operationContext === 'request' &&
      (
        state.processMode === '追加' ||
        state.processMode === '変更' ||
        state.processMode === 'キャンセル' ||
        state.processMode === '担当変更' ||
        state.processMode === '依頼取消'
      )
    );
  }

  function isRequestCancelMode_() {
    return (
      state.operationContext === 'request' &&
      state.processMode === '依頼取消'
    );
  }

  function isSingleTargetRegistrationMode_() {
    return (
      state.operationContext === 'request' &&
      (
        state.processMode === '変更' ||
        state.processMode === 'キャンセル' ||
        state.processMode === '担当変更' ||
        state.processMode === '依頼取消'
      )
    );
  }

  function updateDateModeAvailability_() {
    const singleOnly =
      isSingleTargetRegistrationMode_();

    if (singleOnly) {
      state.dateMode = 'single';
    }

    document
      .querySelectorAll('[data-date-mode]')
      .forEach(btn => {
        const isSingle =
          btn.dataset.dateMode === 'single';

        btn.disabled =
          singleOnly &&
          !isSingle;

        if (singleOnly) {
          btn.classList.toggle(
            'active',
            isSingle
          );
        }
      });

    if (singleOnly) {
      document
        .querySelectorAll('[data-date-area]')
        .forEach(area => {
          area.classList.toggle(
            'hidden',
            area.dataset.dateArea !== 'single'
          );
        });
    }
  }

  function renderProcessModes() {
    const modes = getProcessModes_();

    if (!modes.includes(state.processMode)) {
      state.processMode = modes[0];
    }

    if (!E.processModeChoices) return;

    E.processModeChoices.innerHTML =
      modes.map(mode => `
        <label class="mode-radio">
          <input
            type="radio"
            name="processMode"
            value="${escAttr(mode)}"
            ${mode === state.processMode ? 'checked' : ''}
          >
          <span>${esc(mode)}</span>
        </label>
      `).join('');

    E.processModeChoices
      .querySelectorAll('input[name="processMode"]')
      .forEach(input => {
        input.addEventListener('change', () => {
          state.processMode = input.value;
          clearSelectedTarget_();
          updateOperationModeUi();
        });
      });
  }

  function updateOperationModeUi() {
    const cfg =
      OPERATION_CONTEXTS_[state.operationContext] ||
      OPERATION_CONTEXTS_.request;

    if (E.operationContextNote) {
      E.operationContextNote.textContent = cfg.note;
    }

    /*
     * 既存のrequest.js / request-common.jsを壊さないため、
     * hiddenのrequestTypeへ現在の処理モードを同期します。
     */
    if (E.type) {
      const optionExists =
        [...E.type.options]
          .some(option => option.value === state.processMode);

      if (!optionExists) {
        const option = document.createElement('option');
        option.value = state.processMode;
        option.textContent = state.processMode;
        E.type.appendChild(option);
      }

      E.type.value = state.processMode;
    }

    const live =
      isLiveRegistrationMode_();

    E.modeTestBadge?.classList.toggle(
      'hidden',
      live
    );

    if (E.selectedModeSummary) {
      E.selectedModeSummary.innerHTML =
        `<span>選択中</span><strong>${esc(cfg.label)} ＞ ${esc(state.processMode)}</strong>`;
    }

    const needsTarget =
      state.processMode !== '追加';

    E.openTargetSearch?.classList.toggle(
      'hidden',
      !needsTarget
    );

    if (!needsTarget) {
      clearSelectedTarget_();
    }

    renderSelectedTarget_();

    /*
     * 日付入力表示
     */
    E.ruleWeekdayArea?.classList.toggle(
      'hidden',
      state.operationContext !== 'rule'
    );

    E.requestDateModeArea?.classList.toggle(
      'hidden',
      state.operationContext !== 'request'
    );

    E.todayFixedArea?.classList.toggle(
      'hidden',
      state.operationContext !== 'today'
    );

    if (E.todayFixedDate) {
      const d = new Date();
      E.todayFixedDate.textContent =
        `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    }

    updateDateModeAvailability_();
    updateRequestMode();
    updateRegistrationAvailability_();
    updateSummary();
  }

  function updateRegistrationAvailability_() {
    const live =
      isLiveRegistrationMode_();

    /*
     * PCは確認画面までは見られる。
     * 実際の「登録する」だけ、未実装モードでは無効化。
     */
    if (E.save) {
      E.save.disabled =
        !live ||
        state.registered;

      E.save.textContent =
        live
          ? '登録する'
          : '動作確認のみ';
    }

    if (E.modeTestBadge) {
      E.modeTestBadge.textContent =
        live
          ? ''
          : '動作確認中';
    }

    if (E.footerMessage && !live) {
      E.footerMessage.textContent =
        `${OPERATION_CONTEXTS_[state.operationContext]?.label || ''} ＞ ${state.processMode} は現在、対象検索と画面表示の動作確認のみです。`;
      E.footerMessage.className =
        'desktop-footer-message mode-check';
      E.footerMessage.classList.remove('hidden');
    } else if (live && E.footerMessage?.classList.contains('mode-check')) {
      E.footerMessage.classList.add('hidden');
      E.footerMessage.textContent = '';
    }

    if (mobileQuery.matches && state.step === 4) {
      E.next.disabled =
        !live ||
        state.registered;

      E.next.textContent =
        live
          ? '登録する'
          : '動作確認のみ';
    }
  }


  function copyClientOptionsToSearch_() {
    if (!E.targetSearchClient || !E.client) return;

    const current =
      E.targetSearchClient.value;

    E.targetSearchClient.innerHTML =
      E.client.innerHTML;

    if (
      current &&
      [...E.targetSearchClient.options]
        .some(option => option.value === current)
    ) {
      E.targetSearchClient.value =
        current;
    }
  }

  function openTargetSearchDialog_() {
    if (!E.targetSearchDialog) return;

    copyClientOptionsToSearch_();

    if (state.selectedTarget) {
      E.targetSearchClient.value =
        state.selectedTarget.clientId ||
        state.selectedTarget.userId ||
        '';

      E.targetSearchDate.value =
        state.selectedTarget.targetDate ||
        state.selectedTarget.date ||
        '';
    } else {
      E.targetSearchDate.value =
        E.singleDate?.value || '';
    }

    state.targetCandidates = [];

    E.targetSearchService.innerHTML =
      '<option value="">すべて</option>';

    E.targetSearchStart.innerHTML =
      '<option value="">すべて</option>';

    E.targetCandidateFilters?.classList.add(
      'hidden'
    );

		if (E.targetSearchWeekday) {
		  E.targetSearchWeekday.value = '';
		}

		updateTargetSearchContextUi_();

    E.targetSearchResults.innerHTML = '';

    E.targetSearchDialog.showModal();
  }

	async function searchTargetShifts_() {
	  const option =
	    E.targetSearchClient
	      ?.options[
	        E.targetSearchClient.selectedIndex
	      ];

	  const clientId =
	    String(
	      E.targetSearchClient?.value || ''
	    ).trim();

	  const clientName =
	    String(
	      option?.dataset?.name ||
	      option?.textContent ||
	      ''
	    ).trim();

	  const isRule =
	    state.operationContext === 'rule';

	  const isRequestCancel =
	    isRequestCancelMode_();

	  const targetDate =
	    String(
	      E.targetSearchDate?.value || ''
	    ).trim();

	  const weekday =
	    String(
	      E.targetSearchWeekday?.value || ''
	    ).trim();

	  if (!clientId && !clientName) {
	    E.targetSearchStatus.textContent =
	      '利用者を選択してください。';
	    return;
	  }


	  if (
	    !isRule &&
	    !targetDate
	  ) {
	    E.targetSearchStatus.textContent =
	      '日付を入力してください。';
	    return;
	  }

	  if (
	    isRule &&
	    !weekday
	  ) {
	    E.targetSearchStatus.textContent =
	      '曜日を選択してください。';
	    return;
	  }


	  E.runTargetSearch.disabled = true;
	  E.runTargetSearch.textContent = '検索中...';

	  E.targetSearchStatus.textContent =
	    isRule
	      ? 'その曜日の規定値を取得しています...'
	      : isRequestCancel
	        ? 'その日の未反映依頼を取得しています...'
	        : 'その日の支援候補を取得しています...';

	  E.targetSearchResults.innerHTML = '';

	  try {
	  const result =
	    await apiPost(
    	      'request.shift.search',
	      {
	        clientId,
      		clientName,
	        searchMode:
        	  isRule
          	    ? 'rule'
          	    : isRequestCancel
          	      ? 'request'
          	      : 'date',
      	        targetDate:
        	  isRule
          	    ? ''
          	    : targetDate,
      	        weekday:
        	  isRule
          	    ? weekday
          	    : '',
      	        service: '',
      	        startTime: ''
	      }
	    );
  
	    if (
	      !result ||
	      result.ok === false
	    ) {
	      throw new Error(
	        result?.message ||
	        result?.error ||
	        '検索できませんでした。'
	      );
	    }

	    const targets =
	      result.targets ||
	      result.items ||
	      result.shifts ||
	      [];

	    state.targetCandidates =
	      targets;

	    populateTargetCandidateFilters_(
	      targets
	    );

	    renderFilteredTargetCandidates_();
	  }
	  catch (err) {
	    state.targetCandidates = [];

	    E.targetCandidateFilters?.classList.add(
	      'hidden'
	    );

	    E.targetSearchStatus.textContent =
	      err?.message ||
	      String(err);
	  }
	  finally {
	    E.runTargetSearch.disabled = false;
	    E.runTargetSearch.textContent = '候補を表示';
	  }
	}

  function uniqueSorted_(values) {
    return [
      ...new Set(
        values
          .map(value =>
            String(value || '').trim()
          )
          .filter(Boolean)
      )
    ].sort(
      (a, b) =>
        a.localeCompare(
          b,
          'ja',
          {
            numeric: true,
            sensitivity: 'base'
          }
        )
    );
  }

  function populateTargetCandidateFilters_(
    targets
  ) {
    const services =
      uniqueSorted_(
        targets.map(
          item =>
            item.service || ''
        )
      );

    E.targetSearchService.innerHTML =
      '<option value="">すべて</option>' +
      services
        .map(
          service =>
            `<option value="${escAttr(service)}">${esc(service)}</option>`
        )
        .join('');

    E.targetSearchStart.innerHTML =
      '<option value="">すべて</option>';

    E.targetCandidateFilters?.classList.toggle(
      'hidden',
      !targets.length
    );
  }

  function updateTargetCandidateFilters_() {
    const selectedService =
      String(
        E.targetSearchService?.value || ''
      ).trim();

    const startTimes =
      uniqueSorted_(
        state.targetCandidates
          .filter(item =>
            !selectedService ||
            String(item.service || '').trim() ===
              selectedService
          )
          .map(item =>
            String(
              item.startTime || ''
            ).slice(0, 5)
          )
      );

    const currentStart =
      String(
        E.targetSearchStart?.value || ''
      ).trim();

    E.targetSearchStart.innerHTML =
      '<option value="">すべて</option>' +
      startTimes
        .map(
          time =>
            `<option value="${escAttr(time)}">${esc(time)}</option>`
        )
        .join('');

    if (
      currentStart &&
      startTimes.includes(
        currentStart
      )
    ) {
      E.targetSearchStart.value =
        currentStart;
    }

    renderFilteredTargetCandidates_();
  }

  function renderFilteredTargetCandidates_() {
    const selectedService =
      String(
        E.targetSearchService?.value || ''
      ).trim();

    const selectedStart =
      String(
        E.targetSearchStart?.value || ''
      ).trim();

    const targets =
      state.targetCandidates
        .filter(item => {
          if (
            selectedService &&
            String(
              item.service || ''
            ).trim() !==
              selectedService
          ) {
            return false;
          }

          if (
            selectedStart &&
            String(
              item.startTime || ''
            ).slice(0, 5) !==
              selectedStart
          ) {
            return false;
          }

          return true;
        });

    renderTargetSearchResults_(
      targets
    );
  }

	function renderTargetSearchResults_(targets) {
	  if (!state.targetCandidates.length) {
	    E.targetSearchStatus.textContent =
	      'この利用者の支援は見つかりませんでした。';
	    E.targetSearchResults.innerHTML = '';
	    return;
	  }

	  if (!targets.length) {
	    E.targetSearchStatus.textContent =
	      '選択したサービス・時間に一致する支援はありません。';
	    E.targetSearchResults.innerHTML = '';
	    return;
	  }

	  E.targetSearchStatus.textContent =
	    `${state.targetCandidates.length}件の候補があります。` +
	    (
	      targets.length !== state.targetCandidates.length
	        ? `　絞り込み表示：${targets.length}件`
	        : ''
	    );

	  E.targetSearchResults.innerHTML =
	    targets.map((item, index) => {
	      const isRule =
	        String(
	          item.sourceType || ''
	        ) === 'RULE';

	      const isRequest =
	        String(
	          item.sourceType || ''
	        ) === 'REQUEST';

	      const date =
	        item.targetDate ||
	        item.date ||
	        '';

	      const start =
	        String(
	          item.startTime || ''
	        ).slice(0, 5);

	      const end =
	        String(
	          item.endTime || ''
	        ).slice(0, 5);

	      const sourceLabel =
	        item.sourceLabel ||
	        (
	          isRule
	            ? '規定値'
	            : ''
	        );

	      const applyText =
	        isRule
	          ? [
	              item.applyStartDate || '開始日なし',
	              item.applyEndDate || '終了日なし'
	            ].join(' ～ ')
	          : '';

	      return `
	        <div class="target-search-result-card">
	          <div>
	            <strong>${esc(item.clientName || item.userName || item.user || '')}</strong>
	            <p class="target-result-service">${esc(item.service || 'サービス未設定')}</p>

	            ${
	              isRule
	                ? `<span class="target-result-time">${esc(item.weekday || '')}曜日　${esc(start)}${end ? '～' + esc(end) : ''}</span>`
	                : `<span class="target-result-time">${esc(date)}　${esc(start)}${end ? '～' + esc(end) : ''}</span>`
	            }

	            ${sourceLabel ? `<small>参照：${esc(sourceLabel)}</small>` : ''}

	            ${
	              isRule
	                ? `<small>適用期間：${esc(applyText)}</small>`
	                : isRequest
	                  ? `<small>依頼ID：${esc(item.requestId || '')} ／ ${esc(item.requestType || '')} ／ 未反映</small>`
	                  : `<small>シフトID：${esc(item.shiftId || '')}</small>`
	            }

	          </div>

	          <button
	            type="button"
	            class="primary-button"
	            data-target-index="${index}"
	          >
	            ${
	              isRule
	                ? 'この規定値を選択'
	                : isRequest
	                  ? 'この依頼を選択'
	                  : 'この支援を選択'
	            }
	          </button>
	        </div>
	      `;
	    }).join('');

	  E.targetSearchResults
	    .querySelectorAll(
	      '[data-target-index]'
	    )
	    .forEach(button => {
	      button.addEventListener(
	        'click',
	        async () => {
	          const index =
	            Number(
	              button.dataset.targetIndex
	            );

	          const item =
	            targets[index];

	          if (!item) {
	            return;
	          }

	          let ruleTargetDate = '';

	          if (
	            String(
	              item.sourceType || ''
	            ) === 'RULE'
	          ) {
	            const input =
	              E.targetSearchResults
	                .querySelector(
	                  `[data-rule-target-date-index="${index}"]`
	                );

	            ruleTargetDate =
	              String(
	                input?.value || ''
	              ).trim();

	            if (!ruleTargetDate) {
	              E.targetSearchStatus.textContent =
	                '今回変更・取消する具体的な対象日を選択してください。';
	              input?.focus();
	              return;
	            }
	          }

		  if (
		    String(
		      item.sourceType || ''
		    ) === 'RULE'
		  ) {
		    state.selectedTarget = {
		      ...item
		    };

		    if (E.targetShift) {
		      E.targetShift.value = '';
		    }

		    renderSelectedTarget_();
		    E.targetSearchDialog.close();
		    updateSummary();
		    return;
		  }

		  if (
		    String(
		      item.sourceType || ''
		    ) === 'REQUEST'
		  ) {
		    state.selectedTarget = {
		      ...item
		    };

		    if (E.targetShift) {
		      E.targetShift.value =
		        String(
		          item.shiftId || ''
		        ).trim();
		    }

		    applyTargetShiftToForm_(
		      state.selectedTarget
		    );

		    renderSelectedTarget_();
		    E.targetSearchDialog.close();
		    updateSummary();
		    return;
		  }

	          await selectTargetShift_(
	            item,
	            ruleTargetDate
	          );
	        }
	      );
	    });
	}

	function updateTargetSearchContextUi_() {
  	const isRule =
	    state.operationContext === 'rule';

	  E.targetSearchDateField?.classList.toggle(
	    'hidden',
	    isRule
	  );

	  E.targetSearchWeekdayField?.classList.toggle(
	    'hidden',
	    !isRule
	  );

	  state.targetCandidates = [];

	  E.targetCandidateFilters?.classList.add(
    		'hidden'
	  );

	  E.targetSearchResults.innerHTML = '';

	  E.targetSearchStatus.textContent =
	    isRule
	      ? '利用者と曜日を選んで「候補を表示」を押してください。'
	      : isRequestCancelMode_()
	        ? '利用者と日付を選んで、取り消す未反映依頼を選択してください。'
	        : '利用者と日付を選んで「候補を表示」を押してください。';
	}

	async function selectTargetShift_(item) {
	  let shiftId =
	    String(
	      item?.shiftId || ''
	    ).trim();

	  E.targetSearchStatus.textContent =
	    '登録済み情報を読み込んでいます...';

	  try {

	    if (!shiftId) {
	      throw new Error(
	        'シフトIDを確認できませんでした。'
	      );
	    }

	    const result =
	      await apiPost(
	        'request.shift.detail',
	        {
	          shiftId
	        }
	      );

	    if (
	      !result ||
	      result.ok === false
	    ) {
	      throw new Error(
	        result?.message ||
	        result?.error ||
	        'シフト情報を取得できません。'
	      );
	    }

	    const shift =
	      result.shift ||
	      item;

	    state.selectedTarget = {
	      ...item,
	      ...shift,
	      shiftId
	    };

	    E.targetShift.value =
	      shiftId;

	    applyTargetShiftToForm_(
	      state.selectedTarget
	    );

	    renderSelectedTarget_();

	    E.targetSearchDialog.close();

	    updateSummary();
	  }
	  catch (err) {
	    E.targetSearchStatus.textContent =
	      err?.message ||
	      String(err);
	  }
	}

  function selectOptionByIdOrName_(
    select,
    id,
    name
  ) {
    if (!select) return;

    const idText =
      String(id || '').trim();

    const nameText =
      String(name || '').trim();

    const options =
      [...select.options];

    const match =
      options.find(option =>
        idText &&
        String(option.value || '').trim() === idText
      ) ||
      options.find(option =>
        nameText &&
        (
          String(option.dataset?.name || '').trim() === nameText ||
          String(option.textContent || '').trim() === nameText
        )
      );

    if (match) {
      select.value =
        match.value;
    }
  }

  function applyTargetShiftToForm_(shift) {
    selectOptionByIdOrName_(
      E.client,
      shift.clientId ||
      shift.userId,
      shift.clientName ||
      shift.userName ||
      shift.user
    );

    if (shift.system) {
      E.system.value =
        shift.system;

      updateServiceOptions();
    }

    if (shift.service) {
      const serviceOptions =
        [...E.service.options];

      if (
        !serviceOptions.some(
          option =>
            option.value ===
            shift.service
        )
      ) {
        const option =
          document.createElement(
            'option'
          );

        option.value =
          shift.service;

        option.textContent =
          shift.service;

        E.service.appendChild(
          option
        );
      }

      E.service.value =
        shift.service;
    }

    const date =
      shift.targetDate ||
      shift.date ||
      '';

		if (date && E.singleDate) {
		  state.dateMode = 'single';

		  E.singleDate.value = date;

		  document
		    .querySelectorAll('[data-date-mode]')
		    .forEach(btn => {
		      btn.classList.toggle(
		        'active',
		        btn.dataset.dateMode === 'single'
		      );
		    });

		  document
		    .querySelectorAll('[data-date-area]')
		    .forEach(area => {
		      area.classList.toggle(
		        'hidden',
		        area.dataset.dateArea !== 'single'
		      );
		    });
		}

    E.start.value =
      String(
        shift.startTime || ''
      ).slice(0, 5);

    E.end.value =
      String(
        shift.endTime || ''
      ).slice(0, 5);

    if (E.duration) {
      E.duration.value =
        shift.durationHours ??
        shift.supportHours ??
        '';
    }

    if (E.peopleCount) {
      E.peopleCount.value =
        shift.people ??
        shift.peopleCount ??
        '';
    }

    if (E.appt) {
      E.appt.value =
        String(
          shift.appointmentTime ||
          ''
        ).slice(0, 5);
    }

    if (E.apptPurpose) {
      E.apptPurpose.value =
        shift.appointmentPurpose ||
        '';
    }

    if (E.destination) {
      E.destination.value =
        shift.destination ||
        shift.destinationName ||
        '';
    }

    if (E.meeting) {
      E.meeting.value =
        shift.meetingPlace ||
        shift.meeting ||
        '';
    }

    if (E.moveType) {
      E.moveType.value =
        shift.moveType ||
        shift.transportMethod ||
        '';
    }

    selectOptionByIdOrName_(
      E.mainStaff,
      shift.mainStaffId,
      shift.mainStaffName
    );

    selectOptionByIdOrName_(
      E.staff2,
      shift.staff2Id,
      shift.staff2Name
    );

    selectOptionByIdOrName_(
      E.staff3,
      shift.staff3Id,
      shift.staff3Name
    );

    selectOptionByIdOrName_(
      E.outDriver,
      shift.outDriverId,
      shift.outDriverName
    );

    selectOptionByIdOrName_(
      E.backDriver,
      shift.backDriverId,
      shift.backDriverName
    );

    selectOptionByIdOrName_(
      E.beforeTransportDriver,
      shift.beforeTransportDriverId ||
        shift.supportBeforeTransportDriverId,
      shift.beforeTransportDriverName ||
        shift.supportBeforeTransportDriverName
    );

    selectOptionByIdOrName_(
      E.afterTransportDriver,
      shift.afterTransportDriverId ||
        shift.supportAfterTransportDriverId,
      shift.afterTransportDriverName ||
        shift.supportAfterTransportDriverName
    );

    if (E.beforeTransportMeeting) {
      E.beforeTransportMeeting.value =
        shift.beforeTransportMeeting ||
        shift.supportBeforeTransportMeeting ||
        '';
    }

    if (E.beforeTransportMeetingTime) {
      E.beforeTransportMeetingTime.value =
        String(
          shift.beforeTransportMeetingTime ||
          shift.supportBeforeTransportMeetingTime ||
          ''
        ).slice(0, 5);
    }

    if (E.beforeTransportVehicle) {
      E.beforeTransportVehicle.value =
        shift.beforeTransportVehicle ||
        shift.supportBeforeTransportVehicle ||
        '';
    }

    if (E.afterTransportDestination) {
      E.afterTransportDestination.value =
        shift.afterTransportDestination ||
        shift.supportAfterTransportDestination ||
        '';
    }

    if (E.afterTransportDepartureTime) {
      E.afterTransportDepartureTime.value =
        String(
          shift.afterTransportDepartureTime ||
          shift.supportAfterTransportDepartureTime ||
          ''
        ).slice(0, 5);
    }

    if (E.afterTransportVehicle) {
      E.afterTransportVehicle.value =
        shift.afterTransportVehicle ||
        shift.supportAfterTransportVehicle ||
        '';
    }

    if (E.outVehicle) {
      E.outVehicle.value =
        shift.outVehicle ||
        shift.outboundVehicle ||
        '';
    }

    if (E.backVehicle) {
      E.backVehicle.value =
        shift.backVehicle ||
        shift.returnVehicle ||
        '';
    }

    if (E.transportNote) {
      E.transportNote.value =
        shift.transportNote ||
        shift.transportSupplement ||
        '';
    }

    if (E.support) {
      E.support.value =
        shift.supportContent ||
        shift.support ||
        '';
    }

    if (E.note) {
      E.note.value =
        shift.note ||
        '';
    }

    updateSummary();
  }

  function renderSelectedTarget_() {
    const target =
      state.selectedTarget;

    const visible =
      !!target &&
      state.processMode !==
        '追加';

    E.selectedTargetCard?.classList.toggle(
      'hidden',
      !visible
    );

    if (!visible) {
      return;
    }

    const client =
      target.clientName ||
      target.userName ||
      target.user ||
      '';

    const service =
      target.service ||
      '';

    const date =
      target.targetDate ||
      target.date ||
      '';

    const start =
      target.startTime ||
      '';

    const end =
      target.endTime ||
      '';

    E.selectedTargetTitle.textContent =
      client ||
      '対象支援';

    E.selectedTargetMeta.textContent =
      [
        date,
        start
          ? (
              start +
              (
                end
                  ? '～' + end
                  : ''
              )
            )
          : '',
        service
      ]
        .filter(Boolean)
        .join('　');

    E.selectedTargetShiftId.textContent =
      'シフトID：' +
      (
        target.shiftId ||
        ''
      );
  }

  function clearSelectedTarget_() {
    state.selectedTarget =
      null;

    if (E.targetShift) {
      E.targetShift.value =
        '';
    }

    renderSelectedTarget_();
  }

  function updateRequestMode() {
    const type = E.type.value;
    E.staffChangeFields.classList.toggle('hidden', type !== '担当変更');
    E.changeField.classList.toggle('hidden', type !== '変更');
    updateRegistrationAvailability_();
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
    const system = String(E.system?.value || '').trim();

    const serviceMap = {
      '障害福祉': [
        '身体介護',
        '家事援助',
        '重度訪問介護',
        '同行援護',
        '移動支援',
        '通院介助'
      ],
      '介護保険': [
        '身体介護',
        '生活援助',
        '身体生活',
        '総合事業'
      ]
    };

    const options = serviceMap[system] || [];
    const current = String(E.service?.value || '').trim();

    E.service.innerHTML =
      '<option value="">' +
      (system ? '選択してください' : '制度を先に選択してください') +
      '</option>' +
      options.map(name =>
        `<option value="${escAttr(name)}">${esc(name)}</option>`
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

	function getRuleWeekdays_() {
	  return [
	    ...document.querySelectorAll(
	      '[data-rule-weekday].active'
	    )
	  ]
	    .map(button =>
	      String(
	        button.dataset.ruleWeekday || ''
	      ).trim()
	    )
	    .filter(Boolean);
	}

  function selected(select) {
    if (!select) {
      return {
        id: '',
        name: ''
      };
    }

    // 「指定なし」等の未選択optionは、
    // 表示文字ではなく空欄として扱う。
    if (!String(select.value || '').trim()) {
      return {
        id: '',
        name: ''
      };
    }

    const item =
      RC.selectedMaster(select) || {};

    return {
      id:
        String(
          item.id || ''
        ).trim(),
      name:
        requestOptionalSelectionText_(
          item.name
        )
    };
  }

  function requestOptionalSelectionText_(value) {
    const text =
      String(
        value || ''
      ).trim();

    if (
      !text ||
      text === '指定なし' ||
      text === '選択してください'
    ) {
      return '';
    }

    return text;
  }

  function validateStep(step) {
    try {
      if (step === 1) {
        const client = selected(E.client);
        if (!client.name) throw new Error('利用者を選択してください。');
        if (!E.service.value.trim()) throw new Error('サービスを入力してください。');

        if (
          isLiveRegistrationMode_() &&
          E.type.value !== '追加'
        ) {
          if (
            isRequestCancelMode_()
          ) {
            if (
              !String(
                state.selectedTarget?.requestId || ''
              ).trim()
            ) {
              throw new Error(
                '取り消す依頼を検索して選択してください。'
              );
            }
          }
          else if (
            !E.targetShift.value.trim()
          ) {
            throw new Error(
              '対象支援を検索して選択してください。'
            );
          }
        }
      }

			if (step === 2) {
			  if (state.operationContext === 'rule') {
			    const weekdays =
			      getRuleWeekdays_();

			    if (!weekdays.length) {
			      throw new Error(
			        '曜日を1つ以上選択してください。'
			      );
			    }

			    if (!E.start.value) {
			      throw new Error(
			        '開始時刻を入力してください。'
			      );
			    }
			  }
			  else if (isLiveRegistrationMode_()) {
			    RC.validateDates(
			      getTargetDates()
			    );

			    if (!E.start.value) {
			      throw new Error(
			        '開始時刻を入力してください。'
			      );
			    }
			  }
			}

      if (
        step === 3 &&
        isLiveRegistrationMode_() &&
        E.type.value === '担当変更'
      ) {
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
          const keyword = input.value.trim();
          const places = await RC.searchPlaces(keyword, 8);

          const exact = places.filter(place => {
            const names = [
              place.displayName,
              place.placeName,
              place.matchedAlias
            ]
              .map(v => String(v || '').trim())
              .filter(Boolean);

            return names.some(name => name === keyword);
          });

          if (exact.length === 1) {
            applyPlaceSelection(
              key,
              input,
              hidden,
              results,
              status,
              exact[0]
            );
            return;
          }

          renderPlaceResults(
            key,
            input,
            hidden,
            results,
            status,
            places
          );
        } catch (err) {
          console.error(err);
          results.classList.add('hidden');
        }
      }, 250);

      updateSummary();
    });

    input.addEventListener('blur', async () => {
      const value = input.value.trim();

      if (!value || hidden.value.trim()) return;

      await new Promise(resolve => setTimeout(resolve, 180));

      if (hidden.value.trim() || !input.value.trim()) return;

      try {
        const resolved = await RC.resolvePlace(input.value.trim());

        if (resolved?.resolved && resolved?.placeId) {
          applyPlaceSelection(
            key,
            input,
            hidden,
            results,
            status,
            resolved.place || {
              placeId: resolved.placeId,
              displayName: resolved.displayName
            }
          );
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  function applyPlaceSelection(key, input, hidden, results, status, place) {
    const name = String(
      place?.displayName ||
      place?.placeName ||
      input.value ||
      ''
    ).trim();

    const id = String(place?.placeId || '').trim();

    input.value = name;
    hidden.value = id;

    state.place[key] = {
      inputName: name,
      placeId: id
    };

    setPlaceStatus(
      status,
      id ? `場所ID：${id}` : '場所ID：未選択',
      !!id
    );

    results.classList.add('hidden');
    updateSummary();
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
        applyPlaceSelection(
          key,
          input,
          hidden,
          results,
          status,
          place
        );
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
    if (
      isSingleTargetRegistrationMode_() &&
      getTargetDates().length > 1
    ) {
      throw new Error(
        'この処理は対象シフト1件につき1日で登録してください。'
      );
    }

    const client = selected(E.client);
    const main = selected(E.mainStaff);
    const staff2 = selected(E.staff2);
    const staff3 = selected(E.staff3);
    const outDriver = selected(E.outDriver);
    const backDriver = selected(E.backDriver);
    const beforeTransportDriver = selected(E.beforeTransportDriver);
    const afterTransportDriver = selected(E.afterTransportDriver);
    const oldStaff = selected(E.oldStaff);
    const newStaff = selected(E.newStaff);

    return {
      requestType: E.type.value,
      targetShiftId: E.targetShift.value.trim(),
      sourceRequestId:
        isRequestCancelMode_()
          ? String(
              state.selectedTarget?.requestId || ''
            ).trim()
          : '',

      reporterId: state.user.id,
      reporterName: state.user.name,

      clientId: client.id,
      clientName: client.name,

      system: E.system.value,
      service: E.service.value.trim(),

			targetDates:
			  state.operationContext === 'rule'
			    ? []
			    : getTargetDates(),

			ruleWeekdays:
			  state.operationContext === 'rule'
			    ? getRuleWeekdays_()
			    : [],
    
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

      outDriverId: outDriver.id,
      outDriverName: outDriver.name,
      backDriverId: backDriver.id,
      backDriverName: backDriver.name,
      outVehicle: E.outVehicle.value.trim(),
      backVehicle: E.backVehicle.value.trim(),

      beforeTransportMeeting:
        E.beforeTransportMeeting?.value.trim() || '',
      beforeTransportMeetingTime:
        E.beforeTransportMeetingTime?.value || '',
      beforeTransportDriverId:
        beforeTransportDriver.id,
      beforeTransportDriverName:
        beforeTransportDriver.name,
      beforeTransportVehicle:
        E.beforeTransportVehicle?.value.trim() || '',

      afterTransportDestination:
        E.afterTransportDestination?.value.trim() || '',
      afterTransportDepartureTime:
        E.afterTransportDepartureTime?.value || '',
      afterTransportDriverId:
        afterTransportDriver.id,
      afterTransportDriverName:
        afterTransportDriver.name,
      afterTransportVehicle:
        E.afterTransportVehicle?.value.trim() || '',

      transportNote: E.transportNote.value.trim(),

      oldStaffId: oldStaff.id,
      oldStaffName: oldStaff.name,
      newStaffId: newStaff.id,
      newStaffName: newStaff.name,

      destination: E.destination.value.trim(),
      destinationPlaceId: E.destinationId.value.trim(),
      appointmentTime: E.appt.value,
      appointmentPurpose: E.apptPurpose.value.trim(),
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

    if (payload.destinationPlaceId) {
      E.destination.value = payload.destination;
      E.destinationId.value = payload.destinationPlaceId;
      state.place.destination = {
        inputName: payload.destination,
        placeId: payload.destinationPlaceId
      };
      setPlaceStatus(
        E.destinationStatus,
        `場所ID：${payload.destinationPlaceId}`,
        true
      );
    }

    const meeting = await RC.ensurePlace({
      inputName: payload.meetingPlace,
      placeId: payload.meetingPlaceId
    }, state.user);

    payload.meetingPlace = meeting.displayName || payload.meetingPlace;
    payload.meetingPlaceId = meeting.placeId || '';

    if (payload.meetingPlaceId) {
      E.meeting.value = payload.meetingPlace;
      E.meetingId.value = payload.meetingPlaceId;
      state.place.meeting = {
        inputName: payload.meetingPlace,
        placeId: payload.meetingPlaceId
      };
      setPlaceStatus(
        E.meetingStatus,
        `場所ID：${payload.meetingPlaceId}`,
        true
      );
    }

    return payload;
  }

  async function submit() {
    let payload;

    if (!isLiveRegistrationMode_()) {
      showMessage(
        'このモードは現在、画面動作確認のみです。登録処理はまだ行いません。',
        false
      );
      showToast('動作確認モードです');
      return;
    }

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

      const successLabel =
        state.processMode === '変更'
          ? '変更依頼'
          : state.processMode === 'キャンセル'
            ? 'キャンセル依頼'
            : state.processMode === '担当変更'
              ? '担当変更依頼'
              : state.processMode === '依頼取消'
                ? '依頼取消'
                : '依頼';

      showMessage(
        result.count > 1
          ? `${result.count}日分の${successLabel}を登録しました。`
          : `${successLabel}を登録しました。`,
        false
      );

      showToast(
        result.requestId
          ? `${successLabel}を登録しました：${result.requestId}`
          : `${successLabel}を登録しました`
      );

      state.registered = true;
      setSaving(false);
      lockAfterSuccess(result, payload);
    } catch (err) {
      state.registered = false;
      showMessage(err.message || String(err), true);
      setSaving(false);
    }
  }


  function lockAfterSuccess(result, payload) {
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

    renderSuccessSummary(payload, result);
    E.successPanel.classList.remove('hidden');

    if (mobileQuery.matches) {
      E.next.textContent = '登録済み';
      E.prev.classList.add('hidden');
    }
  }

  function effectiveAfterTransportDeparture_(source) {
    const explicit =
      String(
        source?.afterTransportDepartureTime || ''
      ).trim();

    if (explicit) {
      return explicit;
    }

    const hasAfterTransport =
      [
        source?.afterTransportDestination,
        source?.afterTransportDriverName,
        source?.afterTransportVehicle
      ]
        .some(
          value =>
            String(value || '').trim()
        );

    if (!hasAfterTransport) {
      return '';
    }

    const supportEnd =
      String(
        source?.endTime || ''
      ).trim();

    return supportEnd
      ? `${supportEnd}（支援終了時刻）`
      : '支援終了時刻';
  }

  function renderSuccessSummary(payload, result) {
    if (!E.successSummaryBody) return;

    const dates = RC.uniqueDates(payload?.targetDates || []);
    const dateText = formatDates(dates);
    const timeText =
      payload?.startTime
        ? `${payload.startTime}${payload.endTime ? `～${payload.endTime}` : ''}`
        : '';

    const rows = [
      ['利用者', payload?.clientName],
      ['制度', payload?.system],
      ['サービス', payload?.service],
      ['日時', [dateText, timeText].filter(Boolean).join('　')],
      ['支援時間数',
        payload?.durationHours !== '' && payload?.durationHours != null
          ? `${payload.durationHours}時間`
          : ''
      ],
      ['人数', payload?.people ? `${payload.people}人` : ''],
      ['行き先', payload?.destination],
      ['行き先場所ID', payload?.destinationPlaceId],
      ['待合せ場所', payload?.meetingPlace],
      ['待合せ場所ID', payload?.meetingPlaceId],
      ['予約内容', payload?.appointmentPurpose],
      ['移動手段', payload?.moveType],
      ['主担当', payload?.mainStaffName],
      ['担当2', payload?.staff2Name],
      ['担当3', payload?.staff3Name],
      ['行きドライバー', payload?.outDriverName],
      ['行き車両', payload?.outVehicle],
      ['帰りドライバー', payload?.backDriverName],
      ['帰り車両', payload?.backVehicle],

      ['支援前送迎・待合せ', payload?.beforeTransportMeeting],
      ['支援前送迎・待合せ時間', payload?.beforeTransportMeetingTime],
      ['支援前送迎・ドライバー', payload?.beforeTransportDriverName],
      ['支援前送迎・車両', payload?.beforeTransportVehicle],

      ['支援後送迎・行き先', payload?.afterTransportDestination],
      [
        '支援後送迎・出発時間',
        effectiveAfterTransportDeparture_(payload)
      ],
      ['支援後送迎・ドライバー', payload?.afterTransportDriverName],
      ['支援後送迎・車両', payload?.afterTransportVehicle],

      ['送迎補足', payload?.transportNote],
      ['支援内容', payload?.supportContent],
      ['特記事項', payload?.note]
    ].filter(([, value]) => String(value ?? '').trim());

    E.successSummaryBody.innerHTML = rows.length
      ? rows.map(([label, value]) =>
          `<div class="success-summary-row"><b>${esc(label)}</b><span>${esc(value)}</span></div>`
        ).join('')
      : '<div class="success-summary-row"><b>内容</b><span>登録済み</span></div>';
  }

  function resetForNewRequest() {
    state.registered = false;
    state.step = 1;
    state.dateMode = 'single';
    state.operationContext = 'request';
    state.processMode = '追加';
    state.selectedTarget = null;
    state.place.destination = { inputName: '', placeId: '' };
    state.place.meeting = { inputName: '', placeId: '' };

    E.form.reset();

		state.operationContext = 'request';

		if (E.operationContextSelect) {
		  E.operationContextSelect.value = 'request';
		}
      
    E.type.value = '追加';
    renderProcessModes();
    E.reporter.value = state.user.name || '職員情報未取得';
    updateServiceOptions();
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
    if (E.successSummaryBody) E.successSummaryBody.innerHTML = '';
    E.desktopConfirm.classList.remove('hidden');
    E.desktopConfirm.disabled = false;
    E.edit.disabled = false;
    E.save.disabled = false;
    E.next.disabled = false;

    hideMessage();
    updateOperationModeUi();
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

	  const isRule =
	    state.operationContext === 'rule';

	  const dates =
	    isRule
	      ? []
	      : getTargetDates();

	  const ruleWeekdays =
	    isRule
	      ? getRuleWeekdays_()
	      : [];

	  const start = E.start.value;
	  const end = E.end.value;
	  const duration = E.duration.value;

	  const dateText =
	    isRule
	      ? ruleWeekdays
	          .map(day => `${day}曜日`)
	          .join('・')
	      : formatDates(dates);
      
    const timeText =
      start
        ? `開始 ${start}` +
          (end ? ` ／ 終了 ${end}` : '') +
          (duration ? ` ／ ${duration}時間` : '')
        : '時刻未入力';

    E.confirmClient.textContent = client.name || '未選択';
    E.confirmService.textContent = service || '未選択';
    E.confirmDateTime.textContent =
      `${dateText || (isRule ? '曜日未選択' : '日付未選択')}　${timeText}`;

    E.pcClient.textContent = client.name || '利用者未選択';
    E.pcService.textContent = service || 'サービス未選択';

		E.pcTime.textContent =
		  `${
		    dateText ||
		    (
		      isRule
		        ? '曜日未選択'
		        : '日時未選択'
		    )
		  }${
		    start
		      ? `　${start}${end ? `～${end}` : ''}`
		      : ''
		  }`;
  

    const afterTransportSummarySource = {
      afterTransportDestination:
        E.afterTransportDestination?.value.trim() || '',
      afterTransportDepartureTime:
        E.afterTransportDepartureTime?.value || '',
      afterTransportDriverName:
        selected(E.afterTransportDriver).name,
      afterTransportVehicle:
        E.afterTransportVehicle?.value.trim() || '',
      endTime:
        E.end.value
    };

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
      ['予約内容', E.apptPurpose.value.trim()],
      ['移動手段', E.moveType.value],
      ['主担当', selected(E.mainStaff).name],
      ['担当2', selected(E.staff2).name],
      ['担当3', selected(E.staff3).name],
      ['行きドライバー', selected(E.outDriver).name],
      ['行き車両', E.outVehicle.value.trim()],
      ['帰りドライバー', selected(E.backDriver).name],
      ['帰り車両', E.backVehicle.value.trim()],

      ['支援前送迎・待合せ', E.beforeTransportMeeting?.value.trim() || ''],
      ['支援前送迎・待合せ時間', E.beforeTransportMeetingTime?.value || ''],
      ['支援前送迎・ドライバー', selected(E.beforeTransportDriver).name],
      ['支援前送迎・車両', E.beforeTransportVehicle?.value.trim() || ''],

      ['支援後送迎・行き先', E.afterTransportDestination?.value.trim() || ''],
      [
        '支援後送迎・出発時間',
        effectiveAfterTransportDeparture_(afterTransportSummarySource)
      ],
      ['支援後送迎・ドライバー', selected(E.afterTransportDriver).name],
      ['支援後送迎・車両', E.afterTransportVehicle?.value.trim() || ''],

      ['送迎補足', E.transportNote.value.trim()],
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

    if (state.step === 4) {
      E.next.textContent =
        isLiveRegistrationMode_()
          ? '登録する'
          : '動作確認のみ';

      E.next.disabled =
        !isLiveRegistrationMode_() ||
        state.registered;
    } else {
      E.next.textContent = '次へ';
      E.next.disabled = false;
    }

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
        state.step === 4
          ? (
              isLiveRegistrationMode_()
                ? '登録する'
                : '動作確認のみ'
            )
          : '次へ';

      E.save.textContent =
        isLiveRegistrationMode_()
          ? '登録する'
          : '動作確認のみ';

      updateRegistrationAvailability_();
    }
  }

  function showMessage(text, error) {
    E.message.textContent = text;
    E.message.className = `message ${error ? 'error' : 'success'}`;

    if (mobileQuery.matches) {
      E.message.classList.remove('hidden');
      E.message.scrollIntoView({ behavior: 'smooth', block: 'start' });

      if (E.footerMessage) {
        E.footerMessage.classList.add('hidden');
      }
      return;
    }

    E.message.classList.add('hidden');

    if (E.footerMessage) {
      E.footerMessage.textContent = text;
      E.footerMessage.className =
        `desktop-footer-message ${error ? 'error' : 'success'}`;
      E.footerMessage.classList.remove('hidden');
    }
  }

  function hideMessage() {
    E.message.classList.add('hidden');

    if (E.footerMessage) {
      E.footerMessage.classList.add('hidden');
      E.footerMessage.textContent = '';
    }
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
