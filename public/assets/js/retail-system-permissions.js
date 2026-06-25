import {hasPermission} from "./retail-pos-navigation.js?v=20260625-12";

const P={
  shiftOpen:"pos.shifts.open",shiftClose:"pos.shifts.close",shiftAmount:"pos.shifts.view_amount",shiftHistory:"pos.shifts.view_history",shiftClear:"pos.shifts.clear_history",
  settingsStore:"pos.settings.edit_store",settingsLoyalty:"pos.settings.edit_loyalty",settingsReset:"pos.settings.reset",
  backupExport:"pos.backup.export",backupRestore:"pos.backup.restore",
  roles:"pos.users.manage_roles",users:"pos.users.manage_users"
};
function hide(el,v){if(el&&el.hidden!==v)el.hidden=v}
function deny(){alert("คุณไม่มีสิทธิ์ดำเนินการนี้")}
function disableForm(form,disabled){if(form)[...form.elements].forEach(el=>el.disabled=disabled)}
function applyShifts(){
  disableForm(document.querySelector("#openShiftForm"),!hasPermission(P.shiftOpen));
  disableForm(document.querySelector("#closeShiftForm"),!hasPermission(P.shiftClose));
  hide(document.querySelector("#clearShiftHistory"),!hasPermission(P.shiftClear));
  hide(document.querySelector(".history-card"),!hasPermission(P.shiftHistory));
  if(!hasPermission(P.shiftAmount)){
    ["#openingCashDisplay","#shiftSalesTotal","#shiftCashSales","#shiftTransferSales","#expectedCash","#cashDifference"].forEach(s=>hide(document.querySelector(s),true));
    document.querySelectorAll(".shift-table th:nth-child(n+4),.shift-table td:nth-child(n+4)").forEach(el=>hide(el,true));
  }
}
function applySettings(){
  const storeForm=document.querySelector("#storeSettingsForm");
  if(storeForm){
    storeForm.querySelectorAll("input,textarea,select").forEach(el=>el.disabled=!hasPermission(P.settingsStore));
    hide(storeForm.querySelector('button[type="submit"]'),!hasPermission(P.settingsStore));
    hide(document.querySelector("#resetSettingsBtn"),!hasPermission(P.settingsReset));
  }
  const loyaltyForm=document.querySelector("#loyaltySettingsForm");
  if(loyaltyForm){disableForm(loyaltyForm,!hasPermission(P.settingsLoyalty));hide(loyaltyForm.querySelector('button[type="submit"]'),!hasPermission(P.settingsLoyalty))}
}
function applyBackup(){
  hide(document.querySelector("#exportBackupBtn"),!hasPermission(P.backupExport));
  const canRestore=hasPermission(P.backupRestore);
  ["#backupDropzone","#restoreSummary","#replaceConfirmRow","#clearSelectedBtn","#restoreBackupBtn"].forEach(s=>hide(document.querySelector(s),!canRestore));
}
function applyUsers(){
  const canRoles=hasPermission(P.roles),canUsers=hasPermission(P.users);
  hide(document.querySelector("#newRoleBtn"),!canRoles);
  hide(document.querySelector("#roleForm")?.closest(".permission-panel"),!canRoles);
  document.querySelectorAll("[data-role-id]").forEach(el=>hide(el,!canRoles));
  hide(document.querySelector("#newUserBtn"),!canUsers);
  document.querySelectorAll("[data-user-id]").forEach(el=>hide(el,!canUsers));
}
function apply(){applyShifts();applySettings();applyBackup();applyUsers()}
function required(target){
  if(target.closest("#openShiftForm button[type='submit']"))return P.shiftOpen;
  if(target.closest("#closeShiftForm button[type='submit']"))return P.shiftClose;
  if(target.closest("#clearShiftHistory"))return P.shiftClear;
  if(target.closest("#resetSettingsBtn"))return P.settingsReset;
  if(target.closest("#exportBackupBtn"))return P.backupExport;
  if(target.closest("#restoreBackupBtn")||target.closest("#backupDropzone"))return P.backupRestore;
  if(target.closest("#newRoleBtn")||target.closest("[data-role-id]"))return P.roles;
  if(target.closest("#newUserBtn")||target.closest("[data-user-id]"))return P.users;
  return null;
}
document.addEventListener("click",e=>{const p=required(e.target);if(p&&!hasPermission(p)){e.preventDefault();e.stopImmediatePropagation();deny()}},true);
document.addEventListener("submit",e=>{let p=null;if(e.target.matches("#openShiftForm"))p=P.shiftOpen;if(e.target.matches("#closeShiftForm"))p=P.shiftClose;if(e.target.matches("#storeSettingsForm"))p=P.settingsStore;if(e.target.matches("#loyaltySettingsForm"))p=P.settingsLoyalty;if(e.target.matches("#roleForm"))p=P.roles;if(e.target.matches("#userForm"))p=P.users;if(p&&!hasPermission(p)){e.preventDefault();e.stopImmediatePropagation();deny()}},true);
let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}).observe(document.body,{childList:true,subtree:true});
apply();setTimeout(apply,0);