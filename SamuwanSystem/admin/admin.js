const API_URL = 'https://script.google.com/macros/s/AKfycbx6HJxTCT1uTzhdlkPBT68owOUl9ImKZo57_4bneZgRbH648VScKNGOglkk78_vURjt/exec';

const store = {
  master: { headers: [], rows: [] },
  alias: { headers: [], rows: [] },
  candidate: { headers: [], rows: [] }
};

let currentCandidate = null;
let currentPlace = null;
let mergeTargetPlace = null;

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav').forEach(btn => btn.onclick = () => switchView(btn.dataset.view, btn));
  document.getElementById('testBtn').onclick = testConnection;
  document.getElementById('placeSearch').oninput = e => renderTable('master', e.target.value);
  document.getElementById('aliasSearch').oninput = e => renderTable('alias', e.target.value);
  document.getElementById('candidateSearch').oninput = e => renderTable('candidate', e.target.value);
  document.getElementById('closeModal').onclick = closeConfirmModal;
  document.getElementById('confirmBtn').onclick = confirmCandidate;
  document.getElementById('closeEditModal').onclick = closePlaceEditModal;
  document.getElementById('savePlaceBtn').onclick = savePlaceEdit;

  document.getElementById('parseEditAddress').onclick = () => parseAddressToFields('e');
  document.getElementById('parseCandidateAddress').onclick = () => parseAddressToFields('f');

  document.getElementById('closeMergeModal').onclick = closeMergeModal;
  document.getElementById('mergeBtn').onclick = mergeCandidateToExisting;
  document.getElementById('mergeSearch').oninput = e => renderMergeCandidates(e.target.value);

  document.getElementById('confirmModal').onclick = e => { if (e.target.id === 'confirmModal') closeConfirmModal(); };
  document.getElementById('placeEditModal').onclick = e => { if (e.target.id === 'placeEditModal') closePlaceEditModal(); };
  document.getElementById('mergeModal').onclick = e => { if (e.target.id === 'mergeModal') closeMergeModal(); };

  if (API_URL.startsWith('https://')) loadSummary();
});

function switchView(view, button) {
  document.querySelectorAll('.nav').forEach(x => x.classList.remove('active'));
  if (button) button.classList.add('active');
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  if (view === 'master' && store.master.rows.length === 0) loadDataset('master', 'places');
  if (view === 'alias' && store.alias.rows.length === 0) loadDataset('alias', 'aliases');
  if (view === 'candidate' && store.candidate.rows.length === 0) loadDataset('candidate', 'candidates');
}

async function apiGet(action) {
  if (!API_URL.startsWith('https://')) throw new Error('API_URLを設定してください。');
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  const res = await fetch(url.toString(), { method:'GET', redirect:'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json.ok) throw new Error(json.message || 'APIエラー');
  return json;
}

async function apiPost(payload) {
  if (!API_URL.startsWith('https://')) throw new Error('API_URLを設定してください。');
  const res = await fetch(API_URL, {
    method:'POST', redirect:'follow',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json.ok) throw new Error(json.message || 'APIエラー');
  return json;
}

async function loadSummary() {
  try { const r = await apiGet('ping'); applySummary(r); setStatus('接続済み','ok'); }
  catch(e){ setStatus('未接続','ng'); }
}
async function testConnection() {
  const out = document.getElementById('testResult');
  try {
    out.textContent='接続しています...';
    const r=await apiGet('ping');
    applySummary(r);
    out.textContent=`接続成功\nSS: ${r.spreadsheetName}\n場所M: ${r.sheets.place.rows}件\n場所別名R: ${r.sheets.alias.rows}件\n場所登録候補R: ${r.sheets.candidate.rows}件`;
    setStatus('接続済み','ok');
  } catch(e){ out.textContent='エラー: '+e.message; setStatus('接続エラー','ng'); }
}
function applySummary(r) {
  document.getElementById('placeCount').textContent=r.sheets.place.rows;
  document.getElementById('aliasCount').textContent=r.sheets.alias.rows;
  document.getElementById('candidateCount').textContent=r.sheets.candidate.rows;
}

async function loadDataset(key,action) {
  const bodyId=key==='master'?'placeBody':key==='alias'?'aliasBody':'candidateBody';
  document.getElementById(bodyId).innerHTML='<tr><td>読み込み中...</td></tr>';
  try {
    const r=await apiGet(action);
    store[key].headers=r.headers||[];
    store[key].rows=r.data||[];
    renderTable(key,'');
    setStatus('接続済み','ok');
  } catch(e){
    document.getElementById(bodyId).innerHTML=`<tr><td>エラー: ${esc(e.message)}</td></tr>`;
    setStatus('接続エラー','ng');
  }
}

function renderTable(key,keyword) {
  const q=String(keyword||'').trim().toLowerCase();
  const headers=store[key].headers, rows=store[key].rows;
  const list=!q?rows:rows.filter(row=>Object.values(row).some(v=>String(v||'').toLowerCase().includes(q)));
  const ids=key==='master'?['placeHead','placeBody']:key==='alias'?['aliasHead','aliasBody']:['candidateHead','candidateBody'];
  const shownHeaders=[...headers];
  if(key==='master'||key==='candidate') shownHeaders.push('操作');

  document.getElementById(ids[0]).innerHTML='<tr>'+shownHeaders.map(h=>`<th>${esc(h)}</th>`).join('')+'</tr>';
  document.getElementById(ids[1]).innerHTML=list.length?list.map(row=>{
    let cells=headers.map(h=>`<td>${esc(row[h]??'')}</td>`).join('');
    if(key==='master'){
      cells+=`<td><button class="rowBtn" onclick='openPlaceEditModal(${JSON.stringify(JSON.stringify(row))})'>編集</button></td>`;
    }
    if(key==='candidate'){
      const canConfirm=String(row['確認状態']||'')!=='確認済';
      cells+=`<td>${canConfirm
        ? `<button class="rowBtn" onclick='openConfirmModal(${JSON.stringify(JSON.stringify(row))})'>新規場所として確定</button><button class="rowBtn mergeAction" onclick='openMergeModal(${JSON.stringify(JSON.stringify(row))})'>既存場所へ統合</button>`
        : '確認済'}</td>`;
    }
    return '<tr>'+cells+'</tr>';
  }).join(''):`<tr><td colspan="${Math.max(shownHeaders.length,1)}">該当データがありません。</td></tr>`;
}

function openPlaceEditModal(rowJson) {
  currentPlace=JSON.parse(rowJson);
  const map={
    ePlaceId:'場所ID', eStatus:'登録状態', ePlaceName:'場所名', eFormalName:'正式名称',
    eBaseName:'基本名称', eType:'種別', ePostal:'郵便番号', ePref:'都道府県',
    eCity:'市区町村', eTown:'町丁目', eStreet:'番地', eBuilding:'建物名',
    eAddress:'住所全文', eNote:'備考'
  };
  Object.entries(map).forEach(([id,key])=>setVal(id,currentPlace[key]));
  clearMessage('editMessage');
  document.getElementById('placeEditModal').classList.add('open');
}
function closePlaceEditModal(){document.getElementById('placeEditModal').classList.remove('open');currentPlace=null}

async function savePlaceEdit() {
  if(!currentPlace)return;
  const placeName=getVal('ePlaceName'), formalName=getVal('eFormalName');
  if(!placeName){showMessage('editMessage','場所名を入力してください。','ng');return}
  if(!formalName){showMessage('editMessage','正式名称を入力してください。','ng');return}
  const placeId=getVal('ePlaceId');
  if(!confirm(`場所ID ${placeId} の内容を更新しますか？`))return;

  const btn=document.getElementById('savePlaceBtn');
  btn.disabled=true;btn.textContent='保存中...';
  try{
    const r=await apiPost({
      action:'updatePlace', placeId, placeName, formalName,
      baseName:getVal('eBaseName'), type:getVal('eType'),
      postalCode:getVal('ePostal'), prefecture:getVal('ePref'),
      city:getVal('eCity'), town:getVal('eTown'), street:getVal('eStreet'),
      building:getVal('eBuilding'), fullAddress:getVal('eAddress'),
      note:getVal('eNote'), updaterId:'admin'
    });
    showMessage('editMessage',`更新しました：${r.placeId} ${r.formalName}`,'ok');
    store.master.rows=[];
    await loadDataset('master','places');
    await loadSummary();
    setTimeout(closePlaceEditModal,900);
  }catch(e){showMessage('editMessage','エラー: '+e.message,'ng')}
  finally{btn.disabled=false;btn.textContent='変更を保存'}
}

function openConfirmModal(rowJson) {
  currentCandidate=JSON.parse(rowJson);
  setVal('fPlaceId',currentCandidate['場所ID']);
  setVal('fCandidateId',currentCandidate['候補ID']);
  ['fFormalName','fBaseName','fType','fPostal','fCity','fTown','fStreet','fBuilding','fAddress','fNote'].forEach(id=>setVal(id,''));
  setVal('fPref','埼玉県');
  document.getElementById('candidateInfo').innerHTML=
    `<b>入力名称：</b>${esc(currentCandidate['入力名称']||'')}<br>`+
    `<b>登録元：</b>${esc(currentCandidate['登録元']||'')}<br>`+
    `<b>登録日時：</b>${esc(currentCandidate['登録日時']||'')}`;
  clearMessage('modalMessage');
  document.getElementById('confirmModal').classList.add('open');
}
function closeConfirmModal(){document.getElementById('confirmModal').classList.remove('open');currentCandidate=null}

async function confirmCandidate() {
  if(!currentCandidate)return;
  const formal=getVal('fFormalName');
  if(!formal){showMessage('modalMessage','正式名称を入力してください。','ng');return}
  const placeId=getVal('fPlaceId');
  if(!confirm(`場所ID ${placeId} を「${formal}」として確定しますか？`))return;

  const btn=document.getElementById('confirmBtn');
  btn.disabled=true;btn.textContent='更新中...';
  try{
    const r=await apiPost({
      action:'confirmCandidate', candidateId:getVal('fCandidateId'), placeId,
      formalName:formal, baseName:getVal('fBaseName'), type:getVal('fType'),
      postalCode:getVal('fPostal'), prefecture:getVal('fPref'),
      city:getVal('fCity'), town:getVal('fTown'), street:getVal('fStreet'),
      building:getVal('fBuilding'), fullAddress:getVal('fAddress'),
      note:getVal('fNote'), confirmerId:'admin'
    });
    showMessage('modalMessage',`確定しました：${r.placeId} ${r.formalName}`,'ok');
    store.master.rows=[];store.candidate.rows=[];
    await loadDataset('candidate','candidates');await loadSummary();
    setTimeout(closeConfirmModal,900);
  }catch(e){showMessage('modalMessage','エラー: '+e.message,'ng')}
  finally{btn.disabled=false;btn.textContent='正式名称として確定'}
}


async function openMergeModal(rowJson) {
  currentCandidate = JSON.parse(rowJson);
  mergeTargetPlace = null;

  document.getElementById('mergeCandidateInfo').innerHTML =
    `<b>候補ID：</b>${esc(currentCandidate['候補ID'] || '')}<br>` +
    `<b>仮場所ID：</b>${esc(currentCandidate['場所ID'] || '')}<br>` +
    `<b>入力名称：</b>${esc(currentCandidate['入力名称'] || '')}`;

  document.getElementById('mergeSearch').value =
    currentCandidate['入力名称'] || '';

  document.getElementById('selectedMergePlace').textContent =
    '統合先は未選択です。';

  document.getElementById('saveAliasOnMerge').checked = true;
  clearMessage('mergeMessage');

  try {
    if (store.master.rows.length === 0) {
      const r = await apiGet('places');
      store.master.headers = r.headers || [];
      store.master.rows = r.data || [];
    }

    if (store.alias.rows.length === 0) {
      const r = await apiGet('aliases');
      store.alias.headers = r.headers || [];
      store.alias.rows = r.data || [];
    }

    renderMergeCandidates(document.getElementById('mergeSearch').value);
    document.getElementById('mergeModal').classList.add('open');

  } catch (e) {
    showMessage('mergeMessage', '一覧の読み込みに失敗しました: ' + e.message, 'ng');
    document.getElementById('mergeModal').classList.add('open');
  }
}

function closeMergeModal() {
  document.getElementById('mergeModal').classList.remove('open');
  mergeTargetPlace = null;
  currentCandidate = null;
}

function renderMergeCandidates(keyword) {
  const body = document.getElementById('mergeResultBody');
  const q = normalizeSearchText(keyword);

  if (!q) {
    body.innerHTML = '<tr><td colspan="5">検索文字を入力してください。</td></tr>';
    return;
  }

  const aliasByPlace = {};
  store.alias.rows.forEach(a => {
    const pid = String(a['場所ID'] || '');
    if (!aliasByPlace[pid]) aliasByPlace[pid] = [];
    aliasByPlace[pid].push(String(a['別名'] || ''));
  });

  const tempPlaceId = String(currentCandidate?.['場所ID'] || '');

  const list = store.master.rows
    .filter(row => String(row['場所ID'] || '') !== tempPlaceId)
    .map(row => {
      const pid = String(row['場所ID'] || '');
      const text = [
        row['場所名'], row['正式名称'], row['基本名称'], row['住所全文'],
        row['市区町村'], row['町丁目'], ...(aliasByPlace[pid] || [])
      ].map(normalizeSearchText).join(' ');
      return { row, hit: text.includes(q) };
    })
    .filter(x => x.hit)
    .slice(0, 30)
    .map(x => x.row);

  body.innerHTML = list.length
    ? list.map(row => `
      <tr>
        <td><button class="rowBtn" onclick='selectMergeTarget(${JSON.stringify(JSON.stringify(row))})'>選択</button></td>
        <td>${esc(row['場所ID'] || '')}</td>
        <td>${esc(row['場所名'] || '')}</td>
        <td>${esc(row['正式名称'] || '')}</td>
        <td>${esc(row['住所全文'] || '')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="5">一致する既存場所がありません。</td></tr>';
}

function selectMergeTarget(rowJson) {
  mergeTargetPlace = JSON.parse(rowJson);
  document.getElementById('selectedMergePlace').innerHTML =
    `統合先：<b>${esc(mergeTargetPlace['場所ID'] || '')}</b>　` +
    `${esc(mergeTargetPlace['正式名称'] || mergeTargetPlace['場所名'] || '')}`;
  clearMessage('mergeMessage');
}

async function mergeCandidateToExisting() {
  if (!currentCandidate) return;

  if (!mergeTargetPlace) {
    showMessage('mergeMessage', '統合先の場所を選択してください。', 'ng');
    return;
  }

  const candidateId = String(currentCandidate['候補ID'] || '');
  const tempPlaceId = String(currentCandidate['場所ID'] || '');
  const targetPlaceId = String(mergeTargetPlace['場所ID'] || '');
  const inputName = String(currentCandidate['入力名称'] || '');

  const targetName =
    mergeTargetPlace['正式名称'] ||
    mergeTargetPlace['場所名'] ||
    targetPlaceId;

  if (!confirm(
    `「${inputName}」を\n${targetPlaceId} ${targetName}\nへ統合しますか？`
  )) return;

  const btn = document.getElementById('mergeBtn');
  btn.disabled = true;
  btn.textContent = '統合中...';

  try {
    const r = await apiPost({
      action: 'mergeCandidate',
      candidateId,
      tempPlaceId,
      targetPlaceId,
      inputName,
      saveAlias: document.getElementById('saveAliasOnMerge').checked,
      confirmerId: 'admin'
    });

    showMessage(
      'mergeMessage',
      `統合しました：${r.tempPlaceId} → ${r.targetPlaceId}` +
      (r.aliasCreated ? '（別名も登録しました）' : ''),
      'ok'
    );

    store.master.rows = [];
    store.alias.rows = [];
    store.candidate.rows = [];

    await loadDataset('candidate', 'candidates');
    await loadSummary();

    setTimeout(closeMergeModal, 1100);

  } catch (e) {
    showMessage('mergeMessage', 'エラー: ' + e.message, 'ng');

  } finally {
    btn.disabled = false;
    btn.textContent = 'この場所へ統合';
  }
}

function normalizeSearchText(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[　\s]/g, '')
    .replace(/[０-９]/g, c =>
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
    );
}

/* 住所全文 → 各欄へセット
   例: 〒350-1101 埼玉県川越市的場2丁目10番地3 ○○ビル101
*/
function parseAddressToFields(prefix) {
  const fullId=prefix==='e'?'eAddress':'fAddress';
  const raw=getVal(fullId);
  if(!raw){
    showMessage(prefix==='e'?'editMessage':'modalMessage','住所全文を入力してください。','ng');
    return;
  }

  const p=parseJapaneseAddress(raw);

  setVal(prefix+'Postal',p.postalCode);
  setVal(prefix+'Pref',p.prefecture);
  setVal(prefix+'City',p.city);
  setVal(prefix+'Town',p.town);
  setVal(prefix+'Street',p.street);
  setVal(prefix+'Building',p.building);

  showMessage(
    prefix==='e'?'editMessage':'modalMessage',
    '住所全文から各欄へセットしました。分割結果を確認してから保存してください。',
    'ok'
  );
}

function parseJapaneseAddress(input) {
  let s=normalizeAddressText(input);

  let postalCode='';
  const pm=s.match(/〒?\s*(\d{3})[-ー‐－]?\s*(\d{4})/);
  if(pm){
    postalCode=pm[1]+'-'+pm[2];
    s=s.replace(pm[0],'').trim();
  }

  let prefecture='';
  const prefMatch=s.match(/^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/);
  if(prefMatch){
    prefecture=prefMatch[1];
    s=s.slice(prefMatch[0].length);
  }

  let city='';
  // 市・区・郡＋町/村までを市区町村として取得
  let m=s.match(/^(.+?郡.+?[町村])/);
  if(!m) m=s.match(/^(.+?[市区町村])/);
  if(m){
    city=m[1];
    s=s.slice(m[0].length);
  }

  s=s.trim();

  let town='',street='',building='';

  // 「○丁目」までを町丁目に含める
  const townMatch=s.match(/^(.+?\d+丁目)/);
  if(townMatch){
    town=townMatch[1];
    s=s.slice(townMatch[0].length).trim();
  }else{
    // 丁目がない場合、最初の数字が始まる直前までを町丁目
    const n=s.search(/[0-9]/);
    if(n>0){
      town=s.slice(0,n).trim();
      s=s.slice(n).trim();
    }else{
      town=s;
      s='';
    }
  }

  if(s){
    // 番地表現・ハイフン数字列を番地として取得し、残りを建物名へ
    const sm=s.match(/^((?:\d+(?:番地?|番|号)?(?:[-－]\d+)*(?:番地?|番|号)?)+)\s*(.*)$/);
    if(sm){
      street=sm[1].trim();
      building=sm[2].trim();
    }else{
      street=s;
    }
  }

  return {postalCode,prefecture,city,town,street,building};
}

function normalizeAddressText(s) {
  return String(s||'')
    .replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0))
    .replace(/　/g,' ')
    .replace(/\s+/g,' ')
    .replace(/[‐‑‒–—―−ー－]/g,'-')
    .trim();
}

function setVal(id,v){const el=document.getElementById(id);if(el)el.value=v??''}
function getVal(id){const el=document.getElementById(id);return el?el.value.trim():''}
function showMessage(id,text,type){const el=document.getElementById(id);el.textContent=text;el.className='message '+type}
function clearMessage(id){const el=document.getElementById(id);el.textContent='';el.className='message'}
function setStatus(text,cls){const el=document.getElementById('apiStatus');el.textContent=text;el.className=`status ${cls||''}`}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
