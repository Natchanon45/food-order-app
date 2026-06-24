import {hasPermission,getRoles} from "./retail-pos-navigation.js?v=20260625-6";

const ROLE_KEY="retail_pos_roles_v1";
const PERMISSIONS={
  viewBill:"pos.sales.view_bill",
  printBill:"pos.sales.print_bill",
  exportSales:"pos.sales.export",
  createReturn:"pos.returns.create",
  printReturn:"pos.returns.print"
};

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function setHidden(element,hidden){if(element&&element.hidden!==hidden)element.hidden=hidden}
function deny(message="คุณไม่มีสิทธิ์ดำเนินการนี้"){alert(message)}

function migrateDefaultRoles(){
  const roles=read(ROLE_KEY,[]);
  let changed=false;
  const next=roles.map(role=>{
    const permissions=new Set(role.permissions||[]);
    const add=key=>{if(!permissions.has(key)){permissions.add(key);changed=true}};
    if(role.id==="owner"||role.id==="manager")Object.values(PERMISSIONS).forEach(add);
    if(role.id==="cashier"){
      add(PERMISSIONS.viewBill);
      add(PERMISSIONS.printBill);
      add(PERMISSIONS.createReturn);
      add(PERMISSIONS.printReturn);
    }
    return{...role,permissions:[...permissions]};
  });
  if(changed)write(ROLE_KEY,next);
}

function applySalesPage(){
  setHidden(document.querySelector("#exportCsvBtn"),!hasPermission(PERMISSIONS.exportSales));
  setHidden(document.querySelector("#printReceiptBtn"),!hasPermission(PERMISSIONS.printBill));
  document.querySelectorAll(".view-sale,[data-sale-id]").forEach(button=>setHidden(button,!hasPermission(PERMISSIONS.viewBill)));
}

function applyReturnsPage(){
  const canCreate=hasPermission(PERMISSIONS.createReturn);
  setHidden(document.querySelector("#confirmReturnBtn"),!canCreate);
  document.querySelectorAll("[data-sale-id]").forEach(button=>setHidden(button,!canCreate));
  document.querySelectorAll("[data-return-receipt]").forEach(button=>setHidden(button,!hasPermission(PERMISSIONS.printReturn)));
  setHidden(document.querySelector("#printReturnReceipt"),!hasPermission(PERMISSIONS.printReturn));
}

function apply(){
  applySalesPage();
  applyReturnsPage();
}

function permissionForClick(target){
  if(target.closest("#exportCsvBtn"))return PERMISSIONS.exportSales;
  if(target.closest(".view-sale")||target.closest("#salesTableBody [data-sale-id]"))return PERMISSIONS.viewBill;
  if(target.closest("#printReceiptBtn"))return PERMISSIONS.printBill;
  if(target.closest("#confirmReturnBtn")||target.closest("#returnSaleResults [data-sale-id]"))return PERMISSIONS.createReturn;
  if(target.closest("[data-return-receipt]")||target.closest("#printReturnReceipt"))return PERMISSIONS.printReturn;
  return null;
}

document.addEventListener("click",event=>{
  const permission=permissionForClick(event.target);
  if(permission&&!hasPermission(permission)){
    event.preventDefault();
    event.stopImmediatePropagation();
    deny();
  }
},true);

migrateDefaultRoles();
apply();
let scheduled=false;
new MutationObserver(()=>{
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;apply()});
}).observe(document.body,{childList:true,subtree:true});
