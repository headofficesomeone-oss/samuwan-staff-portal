(() => {
  'use strict';

  const state = {
    weekStart: getMondayString_(new Date()),
    scope: 'all',
    employeeId: resolveEmployeeId_(),
    selectedDayIndex: getTodayWeekIndex_(),
    data: null
  };

  const el = {
    weekLabel: document.getElementById('weekLabel'),
    daysNav: document.getElementById('daysNav'),
    dayTitle: document.getElementById('dayTitle'),
    dayCount: document.getElementById('dayCount'),
    message: document.getElementById('message'),
    list: document.getElementById('requestList'),
    scopeButtons: [...document.querySelectorAll('.scope-btn')]
  };


  init_();


  async function init_() {
    bindEvents_();

    try {
      await loadWeek_();
    } catch (error) {
      console.error(error);
      showMessage_(
        '依頼情報を取得できませんでした。\n' +
        (error?.message || error)
      );
    }
  }


  function bindEvents_() {
    el.scopeButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const nextScope = button.dataset.scope;

        if (
          nextScope === 'mine' &&
          !state.employeeId
        ) {
          showMessage_(
            '「自分」を表示するには employeeId が必要です。\n' +
            'PORTAL組込時はログイン中の従業員IDを渡します。'
          );
          return;
        }

        state.scope = nextScope;

        el.scopeButtons.forEach(b => {
          b.classList.toggle(
            'active',
            b.dataset.scope === state.scope
          );
        });

        await loadWeek_();
      });
    });
  }


  async function loadWeek_() {
    showMessage_('依頼情報を取得しています...');

    const gasUrl =
      String(window.REQUEST_APP?.GAS_URL || '').trim();

    if (
      !gasUrl ||
      !gasUrl.startsWith('https://script.google.com/macros/s/') ||
      !gasUrl.endsWith('/exec')
    ) {
      throw new Error(
        'request_config.js の GAS_URL を設定してください。'
      );
    }

    const payload = {
      action: 'request.week',
      weekStart: state.weekStart,
      scope: state.scope,
      employeeId: state.employeeId
    };

    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(
        'HTTP ' + response.status
      );
    }

    const json = await response.json();

    if (!json?.ok) {
      throw new Error(
        json?.message ||
        json?.error ||
        'GASからエラーが返されました。'
      );
    }

    state.data = json;

    if (
      !json.days?.[state.selectedDayIndex]
    ) {
      state.selectedDayIndex = 0;
    }

    renderWeek_();
  }


  function renderWeek_() {
    const days = state.data?.days || [];

    if (!days.length) {
      showMessage_('対象週のデータがありません。');
      return;
    }

    const first = days[0];
    const last = days[6];

    el.weekLabel.textContent =
      `${formatDateLabel_(first.date)}〜${formatDateLabel_(last.date)}`;

    el.daysNav.innerHTML =
      days.map((day, index) => {
        const classes = ['day-btn'];

        if (index === state.selectedDayIndex) {
          classes.push('active');
        }

        if (index === 5) {
          classes.push('saturday');
        }

        if (index === 6) {
          classes.push('sunday');
        }

        if (day.date === todayString_()) {
          classes.push('today');
        }

        return `
          <button
            type="button"
            class="${classes.join(' ')}"
            data-index="${index}"
          >
            ${escapeHtml_(day.weekday)}
            <span class="date">
              ${escapeHtml_(day.dateLabel)}
            </span>
          </button>
        `;
      }).join('');

    [...el.daysNav.querySelectorAll('.day-btn')]
      .forEach(button => {
        button.addEventListener('click', () => {
          state.selectedDayIndex =
            Number(button.dataset.index);

          renderWeek_();
        });
      });

    renderSelectedDay_();
  }


  function renderSelectedDay_() {
    const day =
      state.data?.days?.[state.selectedDayIndex];

    if (!day) {
      showMessage_('対象日のデータがありません。');
      return;
    }

    const weekdayLong =
      ['月曜日','火曜日','水曜日','木曜日','金曜日','土曜日','日曜日']
      [state.selectedDayIndex];

    el.dayTitle.textContent = weekdayLong;
    el.dayCount.textContent =
      `${day.items.length}件`;

    el.message.hidden = true;

    if (!day.items.length) {
      el.list.innerHTML =
        `<div class="empty">${
          state.scope === 'mine'
            ? 'この日の自分に関係する依頼はありません'
            : 'この日の依頼情報はありません'
        }</div>`;
      return;
    }

    el.list.innerHTML =
      day.items.map(cardHtml_).join('');
  }


  function cardHtml_(x) {
    const metaRows = [];

		if (
		  x.requestType === '担当変更'
		) {
		  const staffChange = [
		    x.oldStaffName || '',
		    x.newStaffName || ''
		  ].filter(Boolean).join(' → ');

		  if (staffChange) {
		    metaRows.push([
		      '担当変更',
		      staffChange
		    ]);
		  }
		} else if (
      x.requestType === '変更'
    ) {
      if (x.changeContent) {
        metaRows.push([
          '変更内容',
          x.changeContent
        ]);
      }
    } else if (
      x.mainStaffName
    ) {
      metaRows.push([
        '担当',
        x.mainStaffName
      ]);
    }

    if (x.destination) {
      const destination =
        x.appointmentTime
          ? `${x.destination}　予約 ${x.appointmentTime}`
          : x.destination;

      metaRows.push([
        '行先',
        destination
      ]);
    }

    if (x.meetingPlace) {
      metaRows.push([
        '待合せ',
        x.meetingPlace
      ]);
    }

    if (x.moveType === '有償運送') {
      const outText =
        joinDriverVehicle_(
          x.outDriverName,
          x.outVehicle
        );

      const backText =
        joinDriverVehicle_(
          x.backDriverName,
          x.backVehicle
        );

      if (
        outText &&
        backText &&
        outText !== backText
      ) {
        metaRows.push([
          '有償運送 行き',
          outText
        ]);

        metaRows.push([
          '有償運送 帰り',
          backText
        ]);
      } else if (outText || backText) {
        metaRows.push([
          '有償運送',
          outText || backText
        ]);
      }
    }

    if (x.moveType === '送迎') {
      const driver =
        joinDriverVehicle_(
          x.outDriverName,
          x.outVehicle
        );

      metaRows.push([
        '送迎',
        driver
      ]);

      if (x.transportNote) {
        metaRows.push([
          '',
          x.transportNote
        ]);
      }
    }

    if (x.changeReason) {
      metaRows.push([
        '理由',
        x.changeReason
      ]);
    }

    const metaHtml =
      metaRows.length
        ? `
          <div class="meta">
            ${metaRows.map(([label, value]) => `
              <div class="meta-row">
                <span class="label">${escapeHtml_(label)}</span>
                <span class="value">${escapeHtml_(value)}</span>
              </div>
            `).join('')}
          </div>
        `
        : '';

    const note =
      x.note ||
      '';

    return `
      <article class="card">
        <div class="top">
          <div class="time">
            ${escapeHtml_(formatTimeRange_(x.startTime, x.endTime))}
          </div>

          <div class="name">
            ${escapeHtml_(x.clientName || '')}
          </div>

          <div class="badge ${badgeClass_(x.requestType)}">
            ${escapeHtml_(x.requestType || '')}
          </div>
        </div>

        <div class="service">
          <b>${escapeHtml_(x.service || '')}</b>
          ${escapeHtml_(x.supportContent || '')}
        </div>

        <div class="report">
          <span>報告者</span>
          <b>${escapeHtml_(x.reporterName || '')}</b>
        </div>

        ${metaHtml}

        ${note
          ? `<div class="memo">${escapeHtml_(note)}</div>`
          : ''
        }
      </article>
    `;
  }


  function badgeClass_(type) {
    if (type === '追加') {
      return 'add';
    }

    if (type === 'キャンセル') {
      return 'cancel';
    }

    if (type === '担当変更') {
      return 'staff';
    }

    return 'change';
  }


  function joinDriverVehicle_(driver, vehicle) {
    const parts = [];

    if (driver) {
      parts.push(driver);
    }

    if (vehicle) {
      parts.push(vehicle);
    }

    return parts.join('・');
  }


  function formatTimeRange_(start, end) {
    if (start && end) {
      return `${start}–${end}`;
    }

    return start || end || '時間未定';
  }


  function resolveEmployeeId_() {
    const params =
      new URLSearchParams(location.search);

    const queryEmployeeId =
      String(params.get('employeeId') || '').trim();

    if (queryEmployeeId) {
      return queryEmployeeId;
    }

    try {
      const currentUser =
        JSON.parse(
          localStorage.getItem('currentUser') || 'null'
        );

      return String(
        currentUser?.employeeId ||
        currentUser?.id ||
        ''
      ).trim();

    } catch (_) {
      return '';
    }
  }


  function getMondayString_(date) {
    const d =
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );

    const day = d.getDay();
    const diff =
      day === 0
        ? -6
        : 1 - day;

    d.setDate(d.getDate() + diff);

    return toDateString_(d);
  }


  function getTodayWeekIndex_() {
    const day = new Date().getDay();

    return day === 0
      ? 6
      : day - 1;
  }


  function todayString_() {
    return toDateString_(new Date());
  }


  function toDateString_(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    return `${y}-${m}-${d}`;
  }


  function formatDateLabel_(dateString) {
    const m =
      String(dateString || '')
        .match(/^\d{4}-(\d{2})-(\d{2})$/);

    if (!m) {
      return dateString || '';
    }

    return `${Number(m[1])}/${Number(m[2])}`;
  }


  function showMessage_(text) {
    el.list.innerHTML = '';
    el.message.hidden = false;
    el.message.textContent = text;
  }


  function escapeHtml_(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
})();
