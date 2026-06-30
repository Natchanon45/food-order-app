import {hasPermission} from "./retail-pos-navigation.js?v=20260630-076";

const PERMISSIONS={
  checkout:"pos.sale.checkout",
  discount:"pos.sale.discount",
  hold:"pos.sale.hold",
  clear:"pos.sale.clear",
  seed:"pos.sale.seed"
};

function deny(message="คุณไม่มีสิทธิ์ดำเนินการนี้"){
  alert(message);
}

function setHidden(element,hidden){
  if(element&&element.hidden!==hidden)element.hidden=hidden;
}

function applyPermissions(){
  const discount=document.querySelector("#discountInput");
  const discountLabel=discount?.closest("label");
  const canDiscount=hasPermission(PERMISSIONS.discount);
  if(discount){
    discount.disabled=!canDiscount;
    if(!canDiscount&&Number(discount.value||0)!==0){
      discount.value="0";
      discount.dispatchEvent(new Event("input",{bubbles:true}));
    }
  }
  if(discountLabel)discountLabel.classList.toggle("permission-disabled",!canDiscount);

  setHidden(document.querySelector("#holdBillBtn"),!hasPermission(PERMISSIONS.hold));
  setHidden(document.querySelector("#heldBillsBtn"),!hasPermission(PERMISSIONS.hold));
  setHidden(document.querySelector("#clearSaleBtn"),!hasPermission(PERMISSIONS.clear));
  setHidden(document.querySelector("#seedBtn"),!hasPermission(PERMISSIONS.seed));

  const payButton=document.querySelector("#payBtn");
  if(payButton&&!hasPermission(PERMISSIONS.checkout)){
    payButton.hidden=true;
  }
}

function permissionForClick(target){
  if(target.closest("#confirmPaymentBtn")||target.closest("#payBtn"))return PERMISSIONS.checkout;
  if(target.closest("#holdBillBtn")||target.closest("#heldBillsBtn")||target.closest("[data-resume-id]")||target.closest("[data-delete-id]"))return PERMISSIONS.hold;
  if(target.closest("#clearSaleBtn"))return PERMISSIONS.clear;
  if(target.closest("#seedBtn"))return PERMISSIONS.seed;
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

document.addEventListener("input",event=>{
  if(event.target.matches("#discountInput")&&!hasPermission(PERMISSIONS.discount)){
    event.preventDefault();
    event.stopImmediatePropagation();
    event.target.value="0";
    deny("บัญชีนี้ไม่มีสิทธิ์ให้ส่วนลด");
  }
},true);

document.addEventListener("keydown",event=>{
  if(event.target.matches("#discountInput")&&!hasPermission(PERMISSIONS.discount)){
    event.preventDefault();
  }
},true);

applyPermissions();
setTimeout(applyPermissions,0);
