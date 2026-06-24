import {ensureAuthUsers,getAuthUsers,getSessionUser,logout,sessionRole} from "./retail-pos-auth.js?v=20260624-1";

const ROLE_KEY="retail_pos_roles_v1";

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

export const ACTION_GROUPS=[
  {id:"sale_actions",label:"การขายหน้าร้าน",items:[
    {key:"pos.sale.checkout",label:"ยืนยันการขาย"},
    {key:"pos.sale.discount",label:"ให้ส่วนลด"},
    {key:"pos.sale.hold",label:"พักและเรียกบิล"},
    {key:"pos.sale.clear",label:"ล้างบิลปัจจุบัน"},
    {key:"pos.sale.seed",label:"โหลดสินค้าตัวอย่าง"}
  ]},
  {id:"sales_history_actions",label:"ประวัติการขาย",items:[
    {key:"pos.sales.view_bill",label:"ดูรายละเอียดบิล"},
    {key:"pos.sales.print_bill",label:"พิมพ์ใบเสร็จย้อนหลัง"},
    {key:"pos.sales.export",label:"ส่งออกข้อมูลการขาย CSV"}
  ]},
  {id:"return_actions",label:"คืนสินค้า",items:[
    {key:"pos.returns.create",label:"ยืนยันคืนสินค้าและคืนเงิน"},
    {key:"pos.returns.print",label:"ดูและพิมพ์ใบรับคืน"}
  ]},
  {id:"product_actions",label:"การจัดการสินค้าและสต็อก",items:[
    {key:"pos.products.create",label:"เพิ่มสินค้า"},
    {key:"pos.products.edit",label:"แก้ไขสินค้า"},
    {key:"pos.products.delete",label:"ลบสินค้า"},
    {key:"pos.products.adjust_stock",label:"ปรับสต็อก"},
    {key:"pos.products.view_cost",label:"ดูราคาทุน"},
    {key:"pos.products.clear_history",label:"ล้างประวัติสต็อก"}
  ]}
];

const MENU_PERMISSIONS=MENU_GROUPS.flatMap(group=>group.items.map(item=>item.key));
const ACTION_PERMISSIONS=ACTION_GROUPS.flatMap(group=>group.items.map(item=>item.key));
const ALL_PERMISSIONS=[...MENU_PERMISSIONS,...ACTION_PERMISSIONS];
const SALE_ACTIONS=ACTION_GROUPS.find(group=>group.id==="sale_actions").items.map(item=>item.key);
const SALES_HISTORY_ACTIONS=ACTION_GROUPS.find(group=>group.id==="sales_history_actions").items.map(item=>item.key);
const RETURN_ACTIONS=ACTION_GROUPS.find(group=>group.id==="return_actions").items.map(item=>item.key);
const DEFAULT_ROLES=[
  {id:"owner",name:"เจ้าของร้าน",permissions:[...ALL_PERMISSIONS],locked:true},
  {id:"cashier",name:"พนักงานขาย",permissions:["pos.sale","pos.sales","pos.returns","pos.customers","pos.shifts",...SALE_ACTIONS.filter(key=>key!=="pos.sale.seed"),...SALES_HISTORY_ACTIONS.filter(key=>key!=="pos.sales.export"),...RETURN_ACTIONS],locked:false},
  {id:"stock",name:"พนักงานสต็อก",permissions:["pos.products","pos.stock_movements","pos.stock_counts","pos.purchases","pos.suppliers","pos.products.adjust_stock"],locked:false},
  {id:"manager",name:"ผู้จัดการร้าน",permissions:ALL_PERMISSIONS.filter(key=>key!=="pos.backup"&&key!=="pos.users"),locked:false}
];

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function esc(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char])}
function normalizePath(value){const url=new URL(value,location.origin);let path=url.pathname.replace(/\/index\.html$/,"/");if(!path.endsWith("/"))path+="/";return path}
function migrateRoles(roles){
  let changed=false;
  const migrated=roles.map(role=>{
    const permissions=new Set(role.permissions||[]);
    const add=key=>{if(!permissions.has(key)){permissions.add(key);changed=true}};
    if(role.id==="owner"||role.id==="manager")ACTION_PERMISSIONS.forEach(add);
    if(role.id==="cashier"){
      SALE_ACTIONS.filter(key=>key!=="pos.sale.seed").forEach(add);
      SALES_HISTORY_ACTIONS.filter(key=>key!=="pos.sales.export").forEach(add);
      RETURN_ACTIONS.forEach(add);
    }
    if(role.id==="stock")add("pos.products.adjust_stock");
    return{...role,permissions:[...permissions]};
  });
  if(changed)write(ROLE_KEY,migrated);
  return migrated;
}

export function ensureAccessData(){const roles=read(ROLE_KEY,[]);if(!roles.length)write(ROLE_KEY,DEFAULT_ROLES);else migrateRoles(roles);ensureAuthUsers()}
export function getRoles(){ensureAccessData();return migrateRoles(read(ROLE_KEY,DEFAULT_ROLES))}
export function getUsers(){ensureAccessData();return getAuthUsers()}
export function getCurrentUser(){ensureAccessData();return getSessionUser()}
export function getCurrentRole(){ensureAccessData();return sessionRole()}
export function hasPermission(permission){const role=getCurrentRole();return Boolean(role?.permissions?.includes(permission))}
export function permissionForPath(pathname=location.pathname){const current=normalizePath(pathname);for(const group of MENU_GROUPS){for(const item of group.items){if(normalizePath(item.href)===current)return item.key}}return null}
export function firstAllowedPage(user=getCurrentUser()){const role=getRoles().find(item=>item.id===user?.roleId),permissions=new Set(role?.permissions||[]);return MENU_GROUPS.flatMap(group=>group.items).find(item=>permissions.has(item.key))?.href||"/pos/forbidden/"}

function requireLogin(){if(getCurrentUser())return true;const next=encodeURIComponent(location.pathname+location.search);location.replace(`/pos/login/?next=${next}`);return false}
function guardPage(){const permission=permissionForPath();if(!permission||hasPermission(permission))return true;const allowedPage=firstAllowedPage(),currentPath=normalizePath(location.pathname);if(allowedPage!=="/pos/forbidden/"&&normalizePath(allowedPage)!==currentPath){location.replace(`${allowedPage}?from=permission`);return false}const next=encodeURIComponent(location.pathname+location.search);location.replace(`/pos/forbidden/?permission=${encodeURIComponent(permission)}&next=${next}`);return false}
function removeLegacyMenuLinks(header){const known=new Set(MENU_GROUPS.flatMap(group=>group.items.map(item=>normalizePath(item.href))));[...header.querySelectorAll("a[href]")].forEach(link=>{if(known.has(normalizePath(link.href)))link.remove()})}
function renderMenu(){
  const header=document.querySelector(".pos-header .header-actions");if(!header||document.querySelector("#posMenuTrigger"))return;
  removeLegacyMenuLinks(header);const user=getCurrentUser(),role=getCurrentRole(),current=normalizePath(location.pathname);
  const trigger=document.createElement("button");trigger.id="posMenuTrigger";trigger.type="button";trigger.className="btn btn-secondary pos-menu-trigger";trigger.textContent="เมนู";header.prepend(trigger);
  const popover=document.createElement("div");popover.id="posMenuPopover";popover.className="pos-menu-popover";
  const groups=MENU_GROUPS.map(group=>{const items=group.items.filter(item=>hasPermission(item.key));if(!items.length)return"";const open=items.some(item=>normalizePath(item.href)===current);return`<section class="pos-menu-group ${open?"is-open":""}"><button type="button" data-menu-group="${esc(group.id)}">${esc(group.label)}</button><div class="pos-menu-links">${items.map(item=>`<a class="pos-menu-link ${normalizePath(item.href)===current?"is-current":""}" href="${esc(item.href)}"><span>${esc(item.label)}</span></a>`).join("")}</div></section>`}).join("")||'<div class="pos-menu-empty">ไม่มีเมนูที่ได้รับอนุญาต</div>';
  popover.innerHTML=`<div class="pos-menu-backdrop" data-close-menu></div><aside class="pos-menu-panel"><div class="pos-menu-head"><h2>เมนู POS</h2><button class="icon-btn" type="button" data-close-menu>×</button></div><div class="pos-menu-user"><strong>${esc(user?.name||"-")}</strong><span>${esc(role?.name||"ไม่ระบุสิทธิ์")} • ${esc(user?.username||"")}</span></div><div class="pos-menu-groups">${groups}</div><div class="pos-menu-footer"><button class="btn btn-danger" type="button" data-logout>ออกจากระบบ</button>${hasPermission("pos.users")?'<a class="btn btn-secondary header-link" href="/pos/users/">จัดการสิทธิ์</a>':""}</div></aside>`;
  document.body.appendChild(popover);const close=()=>popover.classList.remove("is-open");trigger.addEventListener("click",()=>popover.classList.add("is-open"));popover.addEventListener("click",event=>{if(event.target.closest("[data-close-menu]"))close();const groupButton=event.target.closest("[data-menu-group]");if(groupButton)groupButton.closest(".pos-menu-group")?.classList.toggle("is-open");if(event.target.closest("[data-logout]")&&confirm("ต้องการออกจากระบบหรือไม่?")){logout();location.replace("/pos/login/")}});document.addEventListener("keydown",event=>{if(event.key==="Escape")close()})
}

ensureAccessData();
const isLoginPage=normalizePath(location.pathname)==="/pos/login/";
if(!isLoginPage&&requireLogin()&&guardPage()){if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",renderMenu);else renderMenu()}
