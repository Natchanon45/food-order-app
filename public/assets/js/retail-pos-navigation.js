const ROLE_KEY="retail_pos_roles_v1",USER_KEY="retail_pos_users_v1",CURRENT_USER_KEY="retail_pos_current_user_v1";

export const MENU_GROUPS=[
  {id:"sales",label:"ขายหน้าร้าน",items:[
    {key:"pos.sale",label:"หน้าขาย",href:"/pos/"},
    {key:"pos.sales",label:"ประวัติการขาย",href:"/pos/sales/"},
    {key:"pos.returns",label:"คืนสินค้า",href:"/pos/returns/"},
    {key:"pos.shifts",label:"กะพนักงาน",href:"/pos/shifts/"}
  ]},
  {id:"stock",label:"สินค้าและสต็อก",items:[
    {key:"pos.products",label:"สินค้าและสต็อก",href:"/pos/products/"},
    {key:"pos.stock_movements",label:"เคลื่อนไหวสต็อก",href:"/pos/stock-movements/"},
    {key:"pos.stock_counts",label:"ตรวจนับสต็อก",href:"/pos/stock-counts/"}
  ]},
  {id:"purchase",label:"จัดซื้อ",items:[
    {key:"pos.purchases",label:"รับสินค้าเข้า",href:"/pos/purchases/"},
    {key:"pos.payables",label:"เจ้าหนี้",href:"/pos/payables/"},
    {key:"pos.suppliers",label:"ผู้จำหน่าย",href:"/pos/suppliers/"}
  ]},
  {id:"customer",label:"ลูกค้าและสมาชิก",items:[
    {key:"pos.customers",label:"ทะเบียนลูกค้า",href:"/pos/customers/"}
  ]},
  {id:"system",label:"ระบบ",items:[
    {key:"pos.settings",label:"ตั้งค่าร้าน",href:"/pos/settings/"},
    {key:"pos.backup",label:"สำรองและกู้คืน",href:"/pos/backup/"},
    {key:"pos.users",label:"ผู้ใช้และสิทธิ์",href:"/pos/users/"}
  ]}
];

const ALL_PERMISSIONS=MENU_GROUPS.flatMap(group=>group.items.map(item=>item.key));
const DEFAULT_ROLES=[
  {id:"owner",name:"เจ้าของร้าน",permissions:[...ALL_PERMISSIONS],locked:true},
  {id:"cashier",name:"พนักงานขาย",permissions:["pos.sale","pos.sales","pos.returns","pos.customers","pos.shifts"],locked:false},
  {id:"stock",name:"พนักงานสต็อก",permissions:["pos.products","pos.stock_movements","pos.stock_counts","pos.purchases","pos.suppliers"],locked:false},
  {id:"manager",name:"ผู้จัดการร้าน",permissions:ALL_PERMISSIONS.filter(key=>key!=="pos.backup"&&key!=="pos.users"),locked:false}
];
const DEFAULT_USERS=[{id:"owner",name:"เจ้าของร้าน",username:"owner",roleId:"owner",active:true,locked:true}];

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function esc(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char])}
function normalizePath(value){const url=new URL(value,location.origin);let path=url.pathname.replace(/\/index\.html$/,"/");if(!path.endsWith("/"))path+="/";return path}

export function ensureAccessData(){
  const roles=read(ROLE_KEY,[]),users=read(USER_KEY,[]);
  if(!roles.length)write(ROLE_KEY,DEFAULT_ROLES);
  if(!users.length)write(USER_KEY,DEFAULT_USERS);
  if(!localStorage.getItem(CURRENT_USER_KEY))write(CURRENT_USER_KEY,"owner");
}
export function getRoles(){ensureAccessData();return read(ROLE_KEY,DEFAULT_ROLES)}
export function getUsers(){ensureAccessData();return read(USER_KEY,DEFAULT_USERS)}
export function getCurrentUser(){ensureAccessData();const id=read(CURRENT_USER_KEY,"owner");return getUsers().find(user=>user.id===id&&user.active!==false)||getUsers().find(user=>user.id==="owner")||null}
export function getCurrentRole(){const user=getCurrentUser();return getRoles().find(role=>role.id===user?.roleId)||null}
export function hasPermission(permission){const role=getCurrentRole();return Boolean(role?.permissions?.includes(permission))}
export function permissionForPath(pathname=location.pathname){const current=normalizePath(pathname);for(const group of MENU_GROUPS){for(const item of group.items){if(normalizePath(item.href)===current)return item.key}}return null}

function guardPage(){
  const permission=permissionForPath();
  if(!permission||hasPermission(permission))return true;
  const next=encodeURIComponent(location.pathname+location.search);
  location.replace(`/pos/forbidden/?permission=${encodeURIComponent(permission)}&next=${next}`);
  return false;
}

function removeLegacyMenuLinks(header){
  const known=new Set(MENU_GROUPS.flatMap(group=>group.items.map(item=>normalizePath(item.href))));
  [...header.querySelectorAll("a[href]")].forEach(link=>{if(known.has(normalizePath(link.href)))link.remove()});
}

function renderMenu(){
  const header=document.querySelector(".pos-header .header-actions");
  if(!header||document.querySelector("#posMenuTrigger"))return;
  removeLegacyMenuLinks(header);
  const user=getCurrentUser(),role=getCurrentRole(),current=normalizePath(location.pathname);
  const trigger=document.createElement("button");
  trigger.id="posMenuTrigger";trigger.type="button";trigger.className="btn btn-secondary pos-menu-trigger";trigger.textContent="เมนู";
  header.prepend(trigger);
  const popover=document.createElement("div");popover.id="posMenuPopover";popover.className="pos-menu-popover";
  const groups=MENU_GROUPS.map(group=>{
    const items=group.items.filter(item=>hasPermission(item.key));
    if(!items.length)return"";
    const open=items.some(item=>normalizePath(item.href)===current);
    return`<section class="pos-menu-group ${open?"is-open":""}"><button type="button" data-menu-group="${esc(group.id)}">${esc(group.label)}</button><div class="pos-menu-links">${items.map(item=>`<a class="pos-menu-link ${normalizePath(item.href)===current?"is-current":""}" href="${esc(item.href)}"><span>${esc(item.label)}</span></a>`).join("")}</div></section>`;
  }).join("")||'<div class="pos-menu-empty">ไม่มีเมนูที่ได้รับอนุญาต</div>';
  popover.innerHTML=`<div class="pos-menu-backdrop" data-close-menu></div><aside class="pos-menu-panel"><div class="pos-menu-head"><h2>เมนู POS</h2><button class="icon-btn" type="button" data-close-menu>×</button></div><div class="pos-menu-user"><strong>${esc(user?.name||"-")}</strong><span>${esc(role?.name||"ไม่ระบุสิทธิ์")}</span></div><div class="pos-menu-groups">${groups}</div><div class="pos-menu-footer"><a class="btn btn-secondary header-link" href="/pos/">หน้าขาย</a>${hasPermission("pos.users")?'<a class="btn btn-secondary header-link" href="/pos/users/">จัดการสิทธิ์</a>':""}</div></aside>`;
  document.body.appendChild(popover);
  const close=()=>popover.classList.remove("is-open");
  trigger.addEventListener("click",()=>popover.classList.add("is-open"));
  popover.addEventListener("click",event=>{if(event.target.closest("[data-close-menu]"))close();const groupButton=event.target.closest("[data-menu-group]");if(groupButton)groupButton.closest(".pos-menu-group")?.classList.toggle("is-open")});
  document.addEventListener("keydown",event=>{if(event.key==="Escape")close()});
}

ensureAccessData();
if(guardPage()){
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",renderMenu);else renderMenu();
}
