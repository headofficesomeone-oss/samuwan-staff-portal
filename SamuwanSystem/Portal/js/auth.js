let currentLineProfile = null;
async function initLiffForPortal(){
  if(typeof liff==="undefined") throw new Error("LIFFを読み込めませんでした。");
  await Promise.race([liff.init({liffId:APP.LIFF_ID}),new Promise((_,reject)=>setTimeout(()=>reject(new Error("LIFF初期化がタイムアウトしました。")),8000))]);
  if(liff.isLoggedIn()){const p=await liff.getProfile();return {lineId:p.userId,lineName:p.displayName};}
  if(liff.isInClient()){liff.login();return null;}
  return null;
}
async function loginByLineId(lineId){return await apiPost("loginByLineId",{lineId});}
async function loadEmployeeList(){
  const select=document.getElementById("employeeName"); if(!select)return;
  select.innerHTML='<option value="">氏名一覧を読み込んでいます...</option>'; select.disabled=true;
  try{const result=await apiPost("getEmployeeList"); select.innerHTML='<option value="">氏名を選択してください</option>'; (result.employees||[]).forEach(e=>{const o=document.createElement("option");o.value=e.name;o.textContent=e.name;select.appendChild(o);});}
  finally{select.disabled=false;}
}
async function issueTempIdFromScreen(){
  const employeeName=document.getElementById("employeeName").value;
  if(!employeeName){setText("authMessage","氏名を選択してください。");return;}
  if(!currentLineProfile||!currentLineProfile.lineId){setText("authMessage","LINE情報を取得できません。LINEから開き直してください。");return;}
  setText("authMessage","仮登録IDを発行しています...");
  await apiPost("issueTempId",{employeeName,lineId:currentLineProfile.lineId});
  setText("authMessage","LINEに仮登録IDを送信しました。LINEのメッセージを確認してください。");
}
async function registerLineIdFromScreen(){
  const employeeName=document.getElementById("employeeName").value; const tempId=document.getElementById("tempId").value.trim();
  if(!employeeName||!tempId){setText("authMessage","氏名と仮登録IDを入力してください。");return null;}
  if(!currentLineProfile||!currentLineProfile.lineId){setText("authMessage","LINE情報を取得できません。LINEから開き直してください。");return null;}
  setText("authMessage","登録処理中です...");
  const result=await apiPost("registerLineId",{employeeName,tempId,lineId:currentLineProfile.lineId,lineName:currentLineProfile.lineName});
  const user={employeeId:result.employeeId,employeeName:result.employeeName}; savePortalUser(user); return {user,message:result.message||"LINE IDの登録が完了しました。"};
}
