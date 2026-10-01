const SAMUWAN_ADMIN_API = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbzzjinunR8vsF83ZiPZ2g0v7rc5QoCYDmloBpMyvUMIey0oaMTYPKgG_7Zw1DMC-5T8/exec",
  STORAGE_KEY: "samuwan_portal_user_v5"
};

async function apiPost(action, payload = {}) {
  const response = await fetch(SAMUWAN_ADMIN_API.GAS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      ...payload
    })
  });

  if (!response.ok) {
    throw new Error(`通信エラー HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data && data.success === false) {
    throw new Error(data.message || "処理に失敗しました");
  }

  if (data && data.ok === false) {
    throw new Error(data.error || data.message || "処理に失敗しました");
  }

  return data;
}

function getSavedPortalUser() {
  try {
    return JSON.parse(
      localStorage.getItem(SAMUWAN_ADMIN_API.STORAGE_KEY) || "null"
    );
  } catch (_) {
    return null;
  }
}

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const WEEKDAYS = ['月','火','水','木','金','土','日'];

  const S = {rows:[],clients:[],staffs:[],systems:[],services:[],servicesBySystem:{},vehicles:[],user:getCurrentUser_()};
  const E = {
    reporter:$('headerReporter'),reload:$('reloadButton'),add:$('addRuleButton'),filter:$('filterText'),
    weekdayFilter:$('weekdayFilter'),systemFilter:$('systemFilter'),activeOnly:$('activeOnly'),
    count:$('rowCount'),status:$('saveStatus'),tbody:$('ruleTableBody'),empty:$('emptyState'),
    addDialog:$('addDialog'),addForm:$('addForm'),addWeekday:$('addWeekday'),addClient:$('addClient'),
    addSystem:$('addSystem'),addService:$('addService'),addStart:$('addStart'),addEnd:$('addEnd'),addSave:$('addSaveButton'),
    editDialog:$('basicEditDialog'),editForm:$('basicEditForm'),editTitle:$('basicEditTitle'),editRuleId:$('editRuleId'),
    editSystem:$('editSystem'),editService:$('editService'),editStart:$('editStart'),editEnd:$('editEnd'),editSave:$('basicEditSaveButton'),
    toast:$('toast')
  };

  document.addEventListener('DOMContentLoaded', start);

  async function start() {
    bind();
    E.reporter.textContent = S.user.name ? `${S.user.name} さん` : '職員情報未取得';
    await load();
  }

  function bind() {
    E.reload.addEventListener('click', load);
    E.add.addEventListener('click', openAdd);
    [E.filter,E.weekdayFilter,E.systemFilter,E.activeOnly].forEach(el => el.addEventListener(el === E.filter ? 'input' : 'change', render));
    E.addSystem.addEventListener('change', () => fillServiceSelect(E.addService, E.addSystem.value, ''));
    E.editSystem.addEventListener('change', () => fillServiceSelect(E.editService, E.editSystem.value, ''));
    E.addForm.addEventListener('submit', async ev => { ev.preventDefault(); await addRule(); });
    E.editForm.addEventListener('submit', async ev => { ev.preventDefault(); await saveBasicEdit(); });
    document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => $(btn.dataset.close)?.close()));
    E.tbody.addEventListener('click', ev => {
      const btn = ev.target.closest('[data-edit-rule]');
      if (btn) openBasicEdit(btn.dataset.editRule);
    });
    E.tbody.addEventListener('change', async ev => {
      const select = ev.target.closest('select[data-quick-field]');
      if (select) await saveQuick(select);
    });
  }

  async function load() {
    setStatus('規定値Mを読み込んでいます...');
    E.reload.disabled = true;
    try {
      const result = await apiPost('rule.pc.list', {});
      if (!result?.ok) throw new Error(result?.message || result?.error || '規定値を取得できませんでした。');
      S.rows = Array.isArray(result.rows) ? result.rows : [];
      S.clients = Array.isArray(result.clients) ? result.clients : [];
      S.staffs = Array.isArray(result.staffs) ? result.staffs : [];
      S.systems = Array.isArray(result.systems) ? result.systems : [];
      S.services = Array.isArray(result.services) ? result.services : [];
      S.servicesBySystem = result.servicesBySystem || {};
      S.vehicles = Array.isArray(result.vehicles) ? result.vehicles : [];
      fillFilters(); render(); setStatus('最新です');
    } catch (err) {
      setStatus('読込エラー', true); toast(err?.message || String(err), true);
    } finally { E.reload.disabled = false; }
  }

  function fillFilters() {
    E.systemFilter.innerHTML = '<option value="">全制度</option>' + S.systems.map(v => `<option value="${ea(v)}">${e(v)}</option>`).join('');
    E.addClient.innerHTML = '<option value="">選択してください</option>' + S.clients.map(x => `<option value="${ea(x.id)}" data-name="${ea(x.name)}">${e(x.name)}</option>`).join('');
    fillSystemSelect(E.addSystem, ''); fillSystemSelect(E.editSystem, '');
  }

  function fillSystemSelect(select, value) {
    select.innerHTML = '<option value="">選択してください</option>' + S.systems.map(v => `<option value="${ea(v)}">${e(v)}</option>`).join('');
    select.value = value || '';
  }

  function fillServiceSelect(select, system, value) {
    const list = (S.servicesBySystem[system] || []).length ? S.servicesBySystem[system] : S.services;
    select.innerHTML = '<option value="">選択してください</option>' + list.map(v => `<option value="${ea(v)}">${e(v)}</option>`).join('');
    if (value && !list.includes(value)) {
      const o = document.createElement('option'); o.value = value; o.textContent = value; select.appendChild(o);
    }
    select.value = value || '';
  }

  function render() {
    const q = normalize(E.filter.value), weekday = E.weekdayFilter.value, system = E.systemFilter.value, activeOnly = E.activeOnly.checked;
    const rows = S.rows.filter(row => {
      if (activeOnly && !row.active) return false;
      if (weekday && row.weekday !== weekday) return false;
      if (system && row.system !== system) return false;
      if (q) {
        const hay = normalize([row.clientName,row.system,row.service,row.mainStaffName,row.staff2Name,row.staff3Name,row.outDriverName,row.backDriverName,row.beforeTransportDriverName,row.afterTransportDriverName].join(' '));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    E.count.textContent = String(rows.length);
    E.empty.hidden = rows.length !== 0;
    E.tbody.innerHTML = rows.map(rowHtml).join('');
  }

  function rowHtml(row) {
    const id = ea(row.ruleId);
    return `<tr class="${row.active ? '' : 'inactive'}" data-rule-row="${id}">
      <td class="sticky c-weekday">${selectHtml('weekday', row.weekday, WEEKDAYS, id)}</td>
      <td class="sticky c-client text-cell" title="${ea(row.clientName)}">${e(row.clientName)}</td>
      <td class="sticky c-system text-cell ${systemClass(row.system)}" title="${ea(row.system)}">${e(row.system)}</td>
      <td class="sticky c-service text-cell ${serviceClass(row.service)}" title="${ea(row.service)}">${e(row.service)}</td>
      <td class="sticky c-start">${e(row.startTime)}</td>
      <td class="sticky c-end">${e(row.endTime)}</td>
      <td class="c-staff">${staffSelectHtml('mainStaff', row.mainStaffId, row.mainStaffName, id)}</td>
      <td class="c-staff">${staffSelectHtml('staff2', row.staff2Id, row.staff2Name, id)}</td>
      <td class="c-staff">${staffSelectHtml('staff3', row.staff3Id, row.staff3Name, id)}</td>
      <td class="c-driver">${staffSelectHtml('outDriver', row.outDriverId, row.outDriverName, id)}</td>
      <td class="c-vehicle">${vehicleSelectHtml('outVehicle', row.outVehicle, id)}</td>
      <td class="c-driver">${staffSelectHtml('backDriver', row.backDriverId, row.backDriverName, id)}</td>
      <td class="c-vehicle">${vehicleSelectHtml('backVehicle', row.backVehicle, id)}</td>
      <td class="c-driver">${staffSelectHtml('beforeTransportDriver', row.beforeTransportDriverId, row.beforeTransportDriverName, id)}</td>
      <td class="c-vehicle">${vehicleSelectHtml('beforeTransportVehicle', row.beforeTransportVehicle, id)}</td>
      <td class="c-driver">${staffSelectHtml('afterTransportDriver', row.afterTransportDriverId, row.afterTransportDriverName, id)}</td>
      <td class="c-vehicle">${vehicleSelectHtml('afterTransportVehicle', row.afterTransportVehicle, id)}</td>
      <td class="c-action"><button class="edit-basic-btn" type="button" data-edit-rule="${id}">変更</button></td>
    </tr>`;
  }

  function selectHtml(field, value, list, ruleId) {
    const options = list.map(x => `<option value="${ea(x)}" ${x === value ? 'selected' : ''}>${e(x)}</option>`).join('');
    return `<select data-rule-id="${ea(ruleId)}" data-quick-field="${ea(field)}" data-old-value="${ea(value || '')}">${options}</select>`;
  }

  function staffSelectHtml(field, idValue, nameValue, ruleId) {
    let options = '<option value="" data-name="">－</option>' + S.staffs.map(x => `<option value="${ea(x.id)}" data-name="${ea(x.name)}" ${String(x.id) === String(idValue) ? 'selected' : ''}>${e(x.name)}</option>`).join('');
    if (nameValue && !S.staffs.some(x => String(x.id) === String(idValue))) {
      options += `<option value="${ea(idValue || '')}" data-name="${ea(nameValue)}" selected>${e(nameValue)}</option>`;
    }
    return `<select data-rule-id="${ea(ruleId)}" data-quick-field="${ea(field)}" data-old-value="${ea(idValue || '')}">${options}</select>`;
  }

  function vehicleSelectHtml(field, value, ruleId) {
    const list = [...new Set([...(S.vehicles || []), value].filter(Boolean))];
    let options = '<option value="">－</option>' + list.map(x => `<option value="${ea(x)}" ${x === value ? 'selected' : ''}>${e(x)}</option>`).join('');
    return `<select data-rule-id="${ea(ruleId)}" data-quick-field="${ea(field)}" data-old-value="${ea(value || '')}">${options}</select>`;
  }

  async function saveQuick(select) {
    const ruleId = select.dataset.ruleId, field = select.dataset.quickField, oldValue = select.dataset.oldValue || '', value = select.value;
    const option = select.options[select.selectedIndex], name = option?.dataset?.name || option?.textContent || '';
    select.classList.add('saving'); select.disabled = true; setStatus('保存中...');
    try {
      const result = await apiPost('rule.pc.quick.update', {ruleId,field,value,name,updaterId:S.user.id,updaterName:S.user.name});
      if (!result?.ok) throw new Error(result?.message || result?.error || '保存できませんでした。');
      select.dataset.oldValue = value; patchLocal(ruleId, result.row || {}); setStatus('保存しました'); toast('保存しました'); render();
    } catch (err) {
      select.value = oldValue; setStatus('保存エラー', true); toast(err?.message || String(err), true);
    } finally { select.classList.remove('saving'); select.disabled = false; }
  }

  function openAdd() {
    E.addForm.reset(); fillSystemSelect(E.addSystem, S.systems[0] || ''); fillServiceSelect(E.addService, E.addSystem.value, ''); E.addClient.value = ''; E.addDialog.showModal();
  }

  async function addRule() {
    const clientOption = E.addClient.options[E.addClient.selectedIndex];
    const payload = {
      weekday:E.addWeekday.value,clientId:E.addClient.value,
      clientName:clientOption?.dataset?.name || clientOption?.textContent || '',
      system:E.addSystem.value,service:E.addService.value,startTime:E.addStart.value,endTime:E.addEnd.value,
      reporterId:S.user.id,reporterName:S.user.name
    };
    E.addSave.disabled = true; E.addSave.textContent = '登録中...';
    try {
      const result = await apiPost('rule.pc.add', payload);
      if (!result?.ok) throw new Error(result?.message || result?.error || '登録できませんでした。');
      E.addDialog.close(); toast('規定値を追加しました'); await load();
    } catch (err) { toast(err?.message || String(err), true); }
    finally { E.addSave.disabled = false; E.addSave.textContent = '登録'; }
  }

  function openBasicEdit(ruleId) {
    const row = S.rows.find(x => x.ruleId === ruleId); if (!row) return;
    E.editRuleId.value = row.ruleId; E.editTitle.textContent = `${row.weekday}曜日　${row.clientName}`;
    fillSystemSelect(E.editSystem, row.system); fillServiceSelect(E.editService, row.system, row.service);
    E.editStart.value = row.startTime || ''; E.editEnd.value = row.endTime || ''; E.editDialog.showModal();
  }

  async function saveBasicEdit() {
    const payload = {ruleId:E.editRuleId.value,system:E.editSystem.value,service:E.editService.value,startTime:E.editStart.value,endTime:E.editEnd.value,updaterId:S.user.id,updaterName:S.user.name};
    E.editSave.disabled = true; E.editSave.textContent = '変更中...';
    try {
      const result = await apiPost('rule.pc.basic.update', payload);
      if (!result?.ok) throw new Error(result?.message || result?.error || '変更できませんでした。');
      patchLocal(payload.ruleId, result.row || payload); E.editDialog.close(); render(); toast('基本情報を変更しました'); setStatus('保存しました');
    } catch (err) { toast(err?.message || String(err), true); setStatus('保存エラー', true); }
    finally { E.editSave.disabled = false; E.editSave.textContent = '変更する'; }
  }

  function patchLocal(ruleId, patch) { const row = S.rows.find(x => x.ruleId === ruleId); if (row) Object.assign(row, patch); }
  function systemClass(v){const s=String(v||'');if(s.includes('介護保険'))return'system-care';if(s.includes('障害福祉'))return'system-disability';return''}
  function serviceClass(v){const s=String(v||'');if(s.includes('身'))return'service-body';if(s.includes('家事')||s.includes('生活援助'))return'service-house';if(s.includes('通院介助'))return'service-hospital';if(s.includes('同行援護'))return'service-guide';return''}
  function setStatus(text,error=false){E.status.textContent=text;E.status.style.color=error?'#b3342c':'#246b47'}
  let toastTimer=null; function toast(text,error=false){clearTimeout(toastTimer);E.toast.textContent=text;E.toast.className=error?'toast error':'toast';E.toast.hidden=false;toastTimer=setTimeout(()=>{E.toast.hidden=true},2400)}
  function getCurrentUser_(){try{const u=getSavedPortalUser()||{};return{id:String(u.employeeId||u.id||'SAMUWAN_ADMIN').trim(),name:String(u.employeeName||u.name||'SamuwanAdmin').trim()}}catch(_){return{id:'SAMUWAN_ADMIN',name:'SamuwanAdmin'}}}
  function normalize(v){return String(v||'').replace(/[\s　]+/g,'').toLowerCase()}
  function e(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  function ea(v){return e(v)}
})();
