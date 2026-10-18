import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const jsx=fs.readFileSync("react-app/src/pages/PosUsersPage.jsx","utf8");
const css=fs.readFileSync("react-app/public/parity/css/retail-pos-users-visual-dashboard.css","utf8");
const translations=JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json","utf8"));

test("All POS Users text action buttons have semantic icon preceding text",()=>{
 const checks=[
  ["newRoleBtn", "bi-plus-lg"],
  ["deleteRoleBtn","bi-trash3"],
  ["saveRoleBtn","bi-floppy"],
  ["newUserBtn","bi-person-plus"],
  ["data-user-id={user.uid}","bi-pencil-square"],
  ["pos_users.users.cancel","bi-x-circle"],
  ["pos_users.users.save","bi-floppy"],
 ];
 for(const [id,icon] of checks){
  const at=(id==="pos_users.users.cancel" || id==="pos_users.users.save") ? jsx.lastIndexOf(id) : jsx.indexOf(id);
  assert.ok(at>=0,"missing button anchor "+id);
  const nearby=jsx.slice(Math.max(0,at-160),at+400);
  assert.ok(nearby.includes(icon),id+" missing "+icon);
 }
 assert.match(jsx,/className=\{"permission-group-toggle "\+\(allChecked\?"is-clear":"is-select"\)\}/);
 assert.match(jsx,/allChecked\?"bi-x-circle":"bi-check-circle"/);
 assert.match(jsx,/className="icon-btn" aria-label=/);
});

test("POS Users icon spacing and select/clear colors are explicitly styled",()=>{
 assert.match(css,/\.permission-group-card \.permission-group-toggle\.is-select\s*\{[^}]*color:#08773c;[^}]*background:#e7f7ed/s);
 assert.match(css,/\.permission-group-card \.permission-group-toggle\.is-clear\s*\{[^}]*color:#b82333;[^}]*background:#fff0f1/s);
 assert.match(css,/display:inline-flex;align-items:center;justify-content:center;gap:9px/);
 assert.match(css,/\.permission-panel \.btn\[hidden\]/);
 assert.doesNotMatch(css,/\.pos-users-toast/);
 const globalPolicy=fs.readFileSync("react-app/public/parity/css/toast-global-policy.css","utf8");
 const layerPolicy=fs.readFileSync("react-app/public/parity/css/ui-layer-stack.css","utf8");
 assert.match(globalPolicy,/top: 75vh !important/);
 assert.match(globalPolicy,/background: #111 !important/);
 assert.match(globalPolicy,/color: #22c55e !important/);
 assert.match(globalPolicy,/color: #ef4444 !important/);
 assert.match(layerPolicy,/--ui-layer-toast-z: 2147483647/);
});

test("Saving a role shows success only after Firestore write resolves, failures produce error Toast",()=>{
 const start=jsx.indexOf("  const saveRoles=async()=>{");
 const end=jsx.indexOf("  const openUser=",start);
 const fn=jsx.slice(start,end);
 assert.ok(start>=0&&end>start);
 const call=fn.indexOf("await savePosRoleSettings(tenant.id,roles)");
 const success=fn.indexOf('showRoleToast(tr("pos_users.roles.save_success"');
 assert.ok(call>=0&&success>call,"success toast must follow awaited Firestore write");
 assert.match(fn,/showRoleToast\(message,"error"\)/);
 assert.match(fn,/finally\{setBusy\(""\)\}/);
 assert.match(jsx,/id="posUsersToast"/);
 assert.match(jsx,/import \{ createPortal \} from "react-dom"/);
 assert.match(jsx,/toast\.message \? createPortal\(/);
 assert.match(jsx,/document\.body\s*\)/);
 assert.match(jsx,/className=\{"app-toast " \+ \(toast\.variant==="error"\?"error":"success"\) \+ " show"\}/);
 assert.match(jsx,/data-ui-layer="toast"/);
 assert.match(jsx,/className="app-toast-icon"/);
 assert.match(jsx,/bi-x-circle":"bi-check-circle"/);
 assert.match(jsx,/className="app-toast-message"/);
 assert.match(jsx,/role=\{toast\.variant==="error"\?"alert":"status"\}/);
 assert.match(jsx,/window\.clearTimeout\(toastTimerRef\.current\)/);
 assert.match(jsx,/useEffect\(\(\)=>\(\)=>window\.clearTimeout\(toastTimerRef\.current\),\[\]\)/);
});

test("Role-save feedback is localized in TH/EN/MY/LO/KM",()=>{
 for(const lang of ["th","en","my","lo","km"]){
  for(const key of ["save_success","save_failed"]){
   const value=translations[lang]?.pos_users?.roles?.[key];
   assert.ok(typeof value==="string"&&value.length>10,lang+" "+key);
  }
 }
});
