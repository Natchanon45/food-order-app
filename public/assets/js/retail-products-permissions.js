import {hasPermission} from "./retail-pos-navigation.js?v=20260624-5";

const ACTIONS={
  create:"pos.products.create",
  edit:"pos.products.edit",
  delete:"pos.products.delete",
  stock:"pos.products.adjust_stock",
  clearHistory:"pos.products.clear_history"
};

function deny(message="คุณไม่มีสิทธิ์ดำเนินการนี้"){
  alert(message);
}

function setHidden(element,hidden){
  if(element&&element.hidden!==hidden)element.hidden=hidden;
}

function applyVisibility(){
  setHidden(document.querySelector("#addProductBtn"),!hasPermission(ACTIONS.create));
  setHidden(document.querySelector("#clearMovementBtn"),!hasPermission(ACTIONS.clearHistory));

  document.querySelectorAll('[data-action="edit"]').forEach(button=>setHidden(button,!hasPermission(ACTIONS.edit)));
  document.querySelectorAll('[data-action="delete"]').forEach(button=>setHidden(button,!hasPermission(ACTIONS.delete)));
  document.querySelectorAll('[data-action="stock"]').forEach(button=>setHidden(button,!hasPermission(ACTIONS.stock)));

  const canViewCost=hasPermission("pos.products.view_cost");
  const costInput=document.querySelector("#productCost")?.closest("label");
  setHidden(costInput,!canViewCost);

  if(!canViewCost){
    document.querySelectorAll(".product-sub").forEach(element=>{
      const cleaned=element.textContent.replace(/\s*•\s*ทุน\s*[\d,.]+|\s*•\s*ยังไม่กำหนดทุน/g,"");
      if(cleaned!==element.textContent)element.textContent=cleaned;
    });
  }
}

function requiredPermission(target){
  if(target.closest("#addProductBtn"))return ACTIONS.create;
  if(target.closest("#clearMovementBtn"))return ACTIONS.clearHistory;
  const actionButton=target.closest("button[data-action]");
  if(!actionButton)return null;
  return ACTIONS[actionButton.dataset.action]||null;
}

document.addEventListener("click",event=>{
  const permission=requiredPermission(event.target);
  if(permission&&!hasPermission(permission)){
    event.preventDefault();
    event.stopImmediatePropagation();
    deny();
  }
},true);

document.addEventListener("submit",event=>{
  if(event.target.matches("#productForm")){
    const editing=Boolean(document.querySelector("#editingProductId")?.value);
    const permission=editing?ACTIONS.edit:ACTIONS.create;
    if(!hasPermission(permission)){
      event.preventDefault();
      event.stopImmediatePropagation();
      deny();
    }
  }
  if(event.target.matches("#stockForm")&&!hasPermission(ACTIONS.stock)){
    event.preventDefault();
    event.stopImmediatePropagation();
    deny();
  }
},true);

const tableBody=document.querySelector("#productTableBody");
if(tableBody){
  let scheduled=false;
  new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      applyVisibility();
    });
  }).observe(tableBody,{childList:true});
}

applyVisibility();
setTimeout(applyVisibility,0);
