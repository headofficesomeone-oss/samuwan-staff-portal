let currentUser=null;
document.addEventListener("DOMContentLoaded",initializePortalPage);
async function initializePortalPage(){
  bindEvents(); currentUser=getSavedPortalUser(); if(currentUser){showPortalAreaDirect();return;}
  showOnly("loadingView");
  try{
    currentLineProfile=await initLiffForPortal();
    if(currentLineProfile&&currentLineProfile.lineId){
      try{const r=await loginByLineId(currentLineProfile.lineId); if(r.success){currentUser={employeeId:r.employeeId,employeeName:r.employeeName};savePortalUser(currentUser);showPortalAreaDirect();return;}}catch(_){}
    }
    showOnly("registerView"); setText("staffName","初回登録"); await loadEmployeeList();
  }catch(err){showOnly("registerView");setText("authMessage",err.message);try{await loadEmployeeList();}catch(_){}}
}
function bindEvents(){
  document.getElementById("issueTempButton")?.addEventListener("click",async()=>{try{await issueTempIdFromScreen();}catch(e){setText("authMessage",e.message);}});
  document.getElementById("registerButton")?.addEventListener("click",async()=>{try{const r=await registerLineIdFromScreen();if(!r)return;currentUser=r.user;setText("completeMessage",r.message);showOnly("completeView");}catch(e){setText("authMessage",e.message);}});
  document.getElementById("toPortalButton")?.addEventListener("click",showPortalAreaDirect);
  document.getElementById("logoutButton")?.addEventListener("click",()=>{clearPortalUser();currentUser=null;location.reload();});
  document.getElementById("refreshButton")?.addEventListener("click",loadPortalState);
  document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>{const r={action:"./action.html",request:"./request.html",office:"./office.html",meeting:"./meeting.html",leave:"./leave.html"};navigateTo(r[b.dataset.page]);}));
}
function showOnly(id){["loadingView","registerView","completeView","portalView"].forEach(v=>show(document.getElementById(v),v===id));show(document.getElementById("logoutButton"),id==="portalView");}
function showPortalAreaDirect(){if(!currentUser)return;showOnly("portalView");setText("staffName",`職員：${currentUser.employeeName}`);loadPortalState();}
async function loadPortalState(){if(!currentUser)return;setText("currentStatus","取得中...");setText("currentDetail","");try{const result=await apiPost("portal.initial",{employeeId:currentUser.employeeId});const s=result.currentStatus||{};setText("currentStatus",s.label||"行動記録なし");setText("currentDetail",s.detail||"");}catch(_){setText("currentStatus","待機中");setText("currentDetail","");}}
