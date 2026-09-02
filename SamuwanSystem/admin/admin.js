// ★既に接続成功している SamuwanAdmin GAS の /exec URL を設定
const API_URL = 'https://script.google.com/macros/s/AKfycbx6HJxTCT1uTzhdlkPBT68owOUl9ImKZo57_4bneZgRbH648VScKNGOglkk78_vURjt/exec';

const store={master:{headers:[],rows:[]},alias:{headers:[],rows:[]},candidate:{headers:[],rows:[]}};
let currentCandidate=null;

document.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('.nav').forEach(btn=>btn.onclick=()=>switchView(btn.dataset.view,btn));
 document.getElementById('testBtn').onclick=testConnection;
 document.getElementById('placeSearch').oninput=e=>renderTable('master',e.target.value);
 document.getElementById('aliasSearch').oninput=e=>renderTable('alias',e.target.value);
 document.getElementById('candidateSearch').oninput=e=>renderTable('candidate',e.target.value);
 document.getElementById('closeModal').onclick=closeConfirmModal;
 document.getElementById('confirmBtn').onclick=confirmCandidate;
 document.getElementById('confirmModal').onclick=e=>{if(e.target.id==='confirmModal')closeConfirmModal()};
 if(API_URL.startsWith('https://'))loadSummary();
});

function switchView(view,button){
 document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active')); if(button)button.classList.add('active');
 document.querySelectorAll('.view').forEach(x=>x.classList.remove('active')); document.getElementById(`view-${view}`).classList.add('active');
 if(view==='master'&&store.master.rows.length===0)loadDataset('master','places');
 if(view==='alias'&&store.alias.rows.length===0)loadDataset('alias','aliases');
 if(view==='candidate'&&store.candidate.rows.length===0)loadDataset('candidate','candidates');
}

async function apiGet(action){
 if(!API_URL.startsWith('https://'))throw new Error('API_URLを設定してください。');
 const url=new URL(API_URL);url.searchParams.set('action',action);
 const res=await fetch(url.toString(),{method:'GET',redirect:'follow'});
 if(!res.ok)throw new Error('HTTP '+res.status);
 const json=await res.json();if(!json.ok)throw new Error(json.message||'APIエラー');return json;
}

async function apiPost(payload){
 if(!API_URL.startsWith('https://'))throw new Error('API_URLを設定してください。');
 const res=await fetch(API_URL,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
 if(!res.ok)throw new Error('HTTP '+res.status);
 const json=await res.json();if(!json.ok)throw new Error(json.message||'APIエラー');return json;
}

async function loadSummary(){try{const r=await apiGet('ping');applySummary(r);setStatus('接続済み','ok')}catch(e){setStatus('未接続','ng')}}
async function testConnection(){
 const out=document.getElementById('testResult');
 try{out.textContent='接続しています...';const r=await apiGet('ping');applySummary(r);out.textContent=`接続成功\nSS: ${r.spreadsheetName}\n場所M: ${r.sheets.place.rows}件\n場所別名R: ${r.sheets.alias.rows}件\n場所登録候補R: ${r.sheets.candidate.rows}件`;setStatus('接続済み','ok')}
 catch(e){out.textContent='エラー: '+e.message;setStatus('接続エラー','ng')}
}
function applySummary(r){placeCount.textContent=r.sheets.place.rows;aliasCount.textContent=r.sheets.alias.rows;candidateCount.textContent=r.sheets.candidate.rows}

async function loadDataset(key,action){
 const bodyId=key==='master'?'placeBody':key==='alias'?'aliasBody':'candidateBody';
 document.getElementById(bodyId).innerHTML='<tr><td>読み込み中...</td></tr>';
 try{const r=await apiGet(action);store[key].headers=r.headers||[];store[key].rows=r.data||[];renderTable(key,'');setStatus('接続済み','ok')}
 catch(e){document.getElementById(bodyId).innerHTML=`<tr><td>エラー: ${esc(e.message)}</td></tr>`;setStatus('接続エラー','ng')}
}

function renderTable(key,keyword){
 const q=String(keyword||'').trim().toLowerCase(), headers=store[key].headers, rows=store[key].rows;
 const list=!q?rows:rows.filter(row=>Object.values(row).some(v=>String(v||'').toLowerCase().includes(q)));
 const ids=key==='master'?['placeHead','placeBody']:key==='alias'?['aliasHead','aliasBody']:['candidateHead','candidateBody'];

 let shownHeaders=[...headers];
 if(key==='candidate')shownHeaders.push('操作');

 document.getElementById(ids[0]).innerHTML='<tr>'+shownHeaders.map(h=>`<th>${esc(h)}</th>`).join('')+'</tr>';
 document.getElementById(ids[1]).innerHTML=list.length?list.map(row=>{
   let cells=headers.map(h=>`<td>${esc(row[h]??'')}</td>`).join('');
   if(key==='candidate'){
     const canConfirm=String(row['確認状態']||'')!=='確認済';
     cells+=`<td>${canConfirm?`<button class="rowBtn" onclick='openConfirmModal(${JSON.stringify(JSON.stringify(row))})'>確認・編集</button>`:'確認済'}</td>`;
   }
   return '<tr>'+cells+'</tr>';
 }).join(''):`<tr><td colspan="${Math.max(shownHeaders.length,1)}">該当データがありません。</td></tr>`;
}

function openConfirmModal(rowJson){
 currentCandidate=JSON.parse(rowJson);
 fPlaceId.value=currentCandidate['場所ID']||'';
 fCandidateId.value=currentCandidate['候補ID']||'';
 fFormalName.value='';
 fBaseName.value='';
 fType.value='';
 fPostal.value='';fPref.value='埼玉県';fCity.value='';fTown.value='';fStreet.value='';fBuilding.value='';fAddress.value='';fNote.value='';
 candidateInfo.innerHTML=`<b>入力名称：</b>${esc(currentCandidate['入力名称']||'')}<br><b>登録元：</b>${esc(currentCandidate['登録元']||'')}<br><b>登録日時：</b>${esc(currentCandidate['登録日時']||'')}`;
 modalMessage.className='message';modalMessage.textContent='';
 confirmModal.classList.add('open');
}
function closeConfirmModal(){confirmModal.classList.remove('open');currentCandidate=null}

async function confirmCandidate(){
 if(!currentCandidate)return;
 const formal=fFormalName.value.trim();
 if(!formal){showModalMessage('正式名称を入力してください。','ng');return}
 if(!confirm(`場所ID ${fPlaceId.value} を「${formal}」として確定しますか？`))return;

 confirmBtn.disabled=true;confirmBtn.textContent='更新中...';
 try{
   const payload={
     action:'confirmCandidate',
     candidateId:fCandidateId.value,
     placeId:fPlaceId.value,
     formalName:formal,
     baseName:fBaseName.value.trim(),
     type:fType.value.trim(),
     postalCode:fPostal.value.trim(),
     prefecture:fPref.value.trim(),
     city:fCity.value.trim(),
     town:fTown.value.trim(),
     street:fStreet.value.trim(),
     building:fBuilding.value.trim(),
     fullAddress:fAddress.value.trim(),
     note:fNote.value.trim(),
     confirmerId:'admin'
   };
   const r=await apiPost(payload);
   showModalMessage(`確定しました：${r.placeId} ${r.formalName}`,'ok');
   store.master.rows=[];store.candidate.rows=[];
   await loadDataset('candidate','candidates');
   await loadSummary();
   setTimeout(closeConfirmModal,900);
 }catch(e){showModalMessage('エラー: '+e.message,'ng')}
 finally{confirmBtn.disabled=false;confirmBtn.textContent='正式名称として確定'}
}
function showModalMessage(text,type){modalMessage.textContent=text;modalMessage.className='message '+type}
function setStatus(text,cls){apiStatus.textContent=text;apiStatus.className=`status ${cls||''}`}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
