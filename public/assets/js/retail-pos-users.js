import {MENU_GROUPS,ACTION_GROUPS,getRoles,getUsers,getCurrentUser,getCurrentRole} from "./retail-pos-navigation.js?v=20260625-10";
import {createPasswordRecord} from "./retail-pos-auth.js?v=20260629-037";
import {RetailCollections,listRecords,saveRecord,deleteRecord,getRecord} from "./retail-db.js?v=20260629-032";

const ROLE_KEY="retail_pos_roles_v1",USER_KEY="retail_pos_users_v1";
const $=selector=>document.querySelector(selector);
let roles=getRoles(),users=getUsers(),toastTimer;

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function esc(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char])}
function uid(prefix){return globalThis.crypto?.randomUUID?`${prefix}-${crypto.randomUUID()}`:`${prefix}-${Date.now()}`}
function toast(message){clearTimeout(toastTimer);$("#toast").textContent=message;$("#toast").classList.add("show");toastTimer=setTimeout(()=>$("#toast").classList.remove("show"),1800)}

function roleRecord(role){return {...role,id:String(role.id),permissions:Array.isArray(role.permissions)?role.permissions:[]}}
function userRecord(user){return {...user,id:String(user.id),username:String(user.username||user.email||"").trim(),roleId:String(user.roleId||user.role||"cashier")}}
async function persistRoles(){
  write(ROLE_KEY,roles);
  await saveRecord(RetailCollections.settings,{id:"roles",roles:roles.map(roleRecord),updatedAt:Date.now()});
  await Promise.all(roles.map(role=>saveRecord(RetailCollections.roles,roleRecord(role)).catch(error=>console.warn("[pos-users] save role failed",role.id,error))));
}
async function persistUsers(){
  write(USER_KEY,users);
  await saveRecord(RetailCollections.settings,{id:"users",users:users.map(userRecord),updatedAt:Date.now()});
  await Promise.all(users.map(user=>saveRecord(RetailCollections.users,userRecord(user)).catch(error=>console.warn("[pos-users] save user failed",user.id,error))));
}
async function hydrateAccessData(){
  try{
    const [roleRows,userRows,roleSettings,userSettings]=await Promise.all([
      listRecords(RetailCollections.roles).catch(()=>[]),
      listRecords(RetailCollections.users).catch(()=>[]),
      getRecord(RetailCollections.settings,"roles").catch(()=>null),
      getRecord(RetailCollections.settings,"users").catch(()=>null)
    ]);
    const nextRoles=(roleRows.length?roleRows:(roleSettings?.roles||roleSettings?.items||[])).map(roleRecord).filter(role=>role.id);
    const nextUsers=(userRows.length?userRows:(userSettings?.users||userSettings?.items||[])).map(userRecord).filter(user=>user.id);
    if(nextRoles.length)roles=nextRoles;
    if(nextUsers.length)users=nextUsers;
    write(ROLE_KEY,roles);
    write(USER_KEY,users);
  }catch(error){console.warn("[pos-users] hydrate firebase access data failed",error)}
}

function renderCurrent(){const user=getCurrentUser(),role=getCurrentRole();$("#currentUserText").textContent=`ผู้ใช้งานปัจจุบัน: ${user?.name||"-"} • ${role?.name||"-"}`}
function groupHtml(group,selected){const checkedCount=group.items.filter(item=>selected.includes(item.key)).length;return`<section class="permission-group-card" data-permission-group="${esc(group.id)}"><div class="permission-group-head"><strong>${esc(group.label)}</strong><button type="button" class="permission-group-toggle" data-toggle-group="${esc(group.id)}">${checkedCount===group.items.length?"ยกเลิกทั้งหมด":"เลือกทั้งหมด"}</button></div><div class="permission-group-items">${group.items.map(item=>`<label class="permission-checkbox"><input type="checkbox" value="${esc(item.key)}" ${selected.includes(item.key)?"checked":""}><span>${esc(item.label)}</span></label>`).join("")}</div></section>`}
function blockHtml(title,description,groups,selected){const total=groups.flatMap(group=>group.items).length;const checked=groups.flatMap(group=>group.items).filter(item=>selected.includes(item.key)).length;return`<section class="permission-block"><div class="permission-block-head"><div><h4>${esc(title)}</h4><p>${esc(description)}</p></div><span class="permission-block-count">เลือก ${checked}/${total}</span></div><div class="permission-group-grid">${groups.map(group=>groupHtml(group,selected)).join("")}</div></section>`}
function renderPermissions(selected=[]){$("#permissionCheckboxes").innerHTML=blockHtml("สิทธิ์เข้าเมนู","กำหนดว่าบทบาทนี้มองเห็นและเปิดหน้าใดได้บ้าง",MENU_GROUPS,selected)+blockHtml("สิทธิ์การทำงานภายในเมนู","กำหนดสิ่งที่ผู้ใช้ทำได้หลังจากเข้าเมนูแล้ว",ACTION_GROUPS,selected)}
function refreshPermissionSummary(){$("#permissionCheckboxes").querySelectorAll(".permission-block").forEach(block=>{const inputs=[...block.querySelectorAll('input[type="checkbox"]')],checked=inputs.filter(input=>input.checked).length;const badge=block.querySelector(".permission-block-count");if(badge)badge.textContent=`เลือก ${checked}/${inputs.length}`;block.querySelectorAll(".permission-group-card").forEach(card=>{const groupInputs=[...card.querySelectorAll('input[type="checkbox"]')],button=card.querySelector(".permission-group-toggle");if(button)button.textContent=groupInputs.length&&groupInputs.every(input=>input.checked)?"ยกเลิกทั้งหมด":"เลือกทั้งหมด"})})}
function renderRoles(){$("#roleList").innerHTML=roles.map(role=>`<article class="permission-card ${role.id===$("#roleId")?.value?"is-selected":""}"><div><strong>${esc(role.name)}</strong><span>${(role.permissions||[]).length} สิทธิ์${role.locked?" • บทบาทหลัก":""}</span></div><div class="permission-actions"><button type="button" data-role-id="${esc(role.id)}">แก้ไข</button></div></article>`).join("");$("#userRole").innerHTML=roles.map(role=>`<option value="${esc(role.id)}">${esc(role.name)}</option>`).join("")}
function renderUsers(){$("#userList").innerHTML=users.map(user=>{const role=roles.find(item=>item.id===user.roleId),passwordState=user.passwordHash?"ตั้งรหัสผ่านแล้ว":"บัญชี Firebase / ไม่มีรหัสผ่าน local";return`<article class="permission-card"><div><strong>${esc(user.name)}</strong><span>${esc(user.username||user.email||"")} • ${esc(role?.name||"ไม่พบบทบาท")} • ${user.active===false?"ระงับใช้งาน":"ใช้งาน"} • ${passwordState}</span></div><div class="permission-actions"><button type="button" data-user-id="${esc(user.id)}">แก้ไข</button></div></article>`}).join("")}
function openRole(id){const role=roles.find(item=>item.id===id);$("#roleId").value=role?.id||"";$("#roleName").value=role?.name||"";renderPermissions(role?.permissions||[]);$("#deleteRoleBtn").hidden=!role||role.locked;$("#roleError").textContent="";renderRoles()}
async function saveRole(event){event.preventDefault();const id=$("#roleId").value||uid("role"),name=$("#roleName").value.trim(),permissions=[...$("#permissionCheckboxes").querySelectorAll("input:checked")].map(input=>input.value);if(!name)return $("#roleError").textContent="กรุณากรอกชื่อบทบาท";const old=roles.find(role=>role.id===id);roles=old?roles.map(role=>role.id===id?{...role,name,permissions}:role):[...roles,{id,name,permissions,locked:false}];await persistRoles();renderRoles();renderUsers();openRole(id);toast("บันทึกบทบาทแล้ว")}
async function deleteRole(){const id=$("#roleId").value,role=roles.find(item=>item.id===id);if(!role||role.locked)return;if(users.some(user=>user.roleId===id))return alert("ยังมีผู้ใช้ที่ใช้บทบาทนี้อยู่");if(!confirm(`ลบบทบาท “${role.name}” หรือไม่?`))return;roles=roles.filter(item=>item.id!==id);write(ROLE_KEY,roles);await saveRecord(RetailCollections.settings,{id:"roles",roles:roles.map(roleRecord),updatedAt:Date.now()});await deleteRecord(RetailCollections.roles,id).catch(error=>console.warn("[pos-users] delete role failed",error));renderRoles();openRole(roles[0]?.id||"")}
function openUser(id){const user=users.find(item=>item.id===id);$("#userId").value=user?.id||"";$("#userDialogTitle").textContent=user?"แก้ไขผู้ใช้":"เพิ่มผู้ใช้";$("#userName").value=user?.name||"";$("#userUsername").value=user?.username||user?.email||"";$("#userPassword").value="";$("#userPasswordConfirm").value="";$("#userRole").value=user?.roleId||roles[0]?.id||"";$("#userActive").value=user?.active===false?"0":"1";$("#passwordHint").textContent=user?"เว้นว่างหากไม่ต้องการเปลี่ยนรหัสผ่าน":"ผู้ใช้ใหม่ต้องกำหนดรหัสผ่านอย่างน้อย 4 ตัวอักษร";$("#userError").textContent="";$("#userDialog").showModal()}
async function saveUser(event){event.preventDefault();const id=$("#userId").value||uid("user"),name=$("#userName").value.trim(),username=$("#userUsername").value.trim(),password=$("#userPassword").value,passwordConfirm=$("#userPasswordConfirm").value,roleId=$("#userRole").value,active=$("#userActive").value==="1",old=users.find(user=>user.id===id);$("#userError").textContent="";if(!name||!username)return $("#userError").textContent="กรุณากรอกชื่อและชื่อเข้าสู่ระบบ";if(users.some(user=>String(user.username||user.email||"").toLowerCase()===username.toLowerCase()&&user.id!==id))return $("#userError").textContent="ชื่อเข้าสู่ระบบซ้ำ";if(!old&&!password)return $("#userError").textContent="ผู้ใช้ใหม่ต้องกำหนดรหัสผ่าน";if(password&&password.length<4)return $("#userError").textContent="รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร";if(password!==passwordConfirm)return $("#userError").textContent="ยืนยันรหัสผ่านไม่ตรงกัน";let passwordRecord={};if(password)passwordRecord=await createPasswordRecord(password);const record=old?{...old,name,username,email:old.email||username,roleId,role:roleId,active,...passwordRecord}:{id,name,username,email:username,roleId,role:roleId,active,locked:false,...passwordRecord};users=old?users.map(user=>user.id===id?record:user):[...users,record];await persistUsers();$("#userDialog").close();renderUsers();toast(password?"บันทึกผู้ใช้และรหัสผ่านแล้ว":"บันทึกผู้ใช้แล้ว")}

$("#newRoleBtn").addEventListener("click",()=>openRole(""));$("#roleForm").addEventListener("submit",saveRole);$("#deleteRoleBtn").addEventListener("click",deleteRole);$("#roleList").addEventListener("click",event=>{const button=event.target.closest("[data-role-id]");if(button)openRole(button.dataset.roleId)});$("#permissionCheckboxes").addEventListener("click",event=>{const button=event.target.closest("[data-toggle-group]");if(!button)return;const card=button.closest(".permission-group-card"),inputs=[...card.querySelectorAll('input[type="checkbox"]')],next=!inputs.every(input=>input.checked);inputs.forEach(input=>input.checked=next);refreshPermissionSummary()});$("#permissionCheckboxes").addEventListener("change",refreshPermissionSummary);$("#newUserBtn").addEventListener("click",()=>openUser(""));$("#userForm").addEventListener("submit",saveUser);$("#closeUserDialog").addEventListener("click",()=>$("#userDialog").close());$("#cancelUserBtn").addEventListener("click",()=>$("#userDialog").close());$("#userList").addEventListener("click",event=>{const button=event.target.closest("[data-user-id]");if(button)openUser(button.dataset.userId)});
await hydrateAccessData();renderCurrent();renderRoles();renderUsers();openRole(roles[0]?.id||"");
