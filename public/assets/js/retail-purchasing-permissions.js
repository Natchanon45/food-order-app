import {hasPermission} from "./retail-pos-navigation.js?v=20260625-12";

const P={
  purchaseCreate:"pos.purchases.create",
  purchaseCost:"pos.purchases.view_cost",
  payablePay:"pos.payables.pay",
  payableAmount:"pos.payables.view_amount",
  supplierCreate:"pos.suppliers.create",
  supplierEdit:"pos.suppliers.edit",
  supplierDelete:"pos.suppliers.delete",
  supplierPurchase:"pos.suppliers.view_purchase"
};

function hide(el,value){if(el&&el.hidden!==value)el.hidden=value}
function deny(message="คุณไม่มีสิทธิ์ดำเนินการนี้"){alert(message)}

function applyPurchases(){
  const canCreate=hasPermission(P.purchaseCreate),canCost=hasPermission(P.purchaseCost);
  const form=document.querySelector("#purchaseForm");
  if(form){
    [...form.elements].forEach(el=>el.disabled=!canCreate);
    hide(form.querySelector('button[type="submit"]'),!canCreate);
    hide(document.querySelector("#addPurchaseLineBtn"),!canCreate);
    hide(document.querySelector("#resetPurchaseBtn"),!canCreate);
  }
  if(!canCost){
    document.querySelectorAll(".line-cost,.line-total,#purchaseTotal,.purchase-history-total,.purchase-history-line strong,.average-cost-note").forEach(el=>hide(el,true));
    document.querySelectorAll(".purchase-table th:nth-child(4),.purchase-table th:nth-child(5)").forEach(el=>hide(el,true));
  }
}

function applyPayables(){
  const canPay=hasPermission(P.payablePay),canAmount=hasPermission(P.payableAmount);
  document.querySelectorAll("[data-pay-id],.payable-action").forEach(el=>hide(el,!canPay));
  if(!canAmount){
    ["#payableOutstanding","#payableDueSoon","#payableOverdue","#supplierPayableSummary"].forEach(s=>hide(document.querySelector(s),true));
    document.querySelectorAll(".payable-table th:nth-child(5),.payable-table th:nth-child(6),.payable-table th:nth-child(7),.payable-table td:nth-child(5),.payable-table td:nth-child(6),.payable-table td:nth-child(7)").forEach(el=>hide(el,true));
  }
}

function applySuppliers(){
  hide(document.querySelector("#addSupplierBtn"),!hasPermission(P.supplierCreate));
  document.querySelectorAll('[data-action="edit"]').forEach(el=>hide(el,!hasPermission(P.supplierEdit)));
  document.querySelectorAll('[data-action="delete"]').forEach(el=>hide(el,!hasPermission(P.supplierDelete)));
  if(!hasPermission(P.supplierPurchase)){
    document.querySelectorAll(".supplier-summary,#supplierPurchaseTotal,#supplierPurchaseCount").forEach(el=>hide(el,true));
  }
}

function apply(){applyPurchases();applyPayables();applySuppliers()}
function permissionFor(target){
  if(target.closest("#purchaseForm button[type='submit']")||target.closest("#addPurchaseLineBtn")||target.closest("#resetPurchaseBtn")||target.closest(".remove-line"))return P.purchaseCreate;
  if(target.closest("[data-pay-id]")||target.closest("#supplierPaymentForm button[type='submit']"))return P.payablePay;
  if(target.closest("#addSupplierBtn"))return P.supplierCreate;
  if(target.closest('[data-action="edit"]'))return P.supplierEdit;
  if(target.closest('[data-action="delete"]'))return P.supplierDelete;
  return null;
}

document.addEventListener("click",event=>{const permission=permissionFor(event.target);if(permission&&!hasPermission(permission)){event.preventDefault();event.stopImmediatePropagation();deny()}},true);
document.addEventListener("submit",event=>{
  let permission=null;
  if(event.target.matches("#purchaseForm"))permission=P.purchaseCreate;
  if(event.target.matches("#supplierPaymentForm"))permission=P.payablePay;
  if(event.target.matches("#supplierForm")){permission=document.querySelector("#editingSupplierId")?.value?P.supplierEdit:P.supplierCreate}
  if(permission&&!hasPermission(permission)){event.preventDefault();event.stopImmediatePropagation();deny()}
},true);

let scheduled=false;
new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply()})}).observe(document.body,{childList:true,subtree:true});
apply();