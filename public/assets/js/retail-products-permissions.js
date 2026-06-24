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

function applyVisibility(){
  const addButton=document.querySelector("#addProductBtn");
  if(addButton)addButton.hidden=!hasPermission(ACTIONS.create);

  const clearButton=document.querySelector("#clearMovementBtn");
  if(clearButton)clearButton.hidden=!hasPermission(ACTIONS.clearHistory);

  document.querySelectorAll('[data-action="edit"]').forEach(button=>button.hidden=!hasPermission(ACTIONS.edit));
  document.querySelectorAll('[data-action="delete"]').forEach(button=>button.hidden=!hasPermission(ACTIONS.delete));
  document.querySelectorAll('[data-action="stock"]').forEach(button=>button.hidden=!hasPermission(ACTIONS.stock));

  if(!hasPermission("pos.products.view_cost")){
    document.querySelectorAll(".product-sub").forEach(element=>{
      element.textContent=element.textContent.replace(/\s*•\s*ทุน\s*[\d,.]+|\s*•\s*ยังไม่กำหนดทุน/g,"");
    });
    const costInput=document.querySelector("#productCost")?.closest("label");
    if(costInput)costInput.hidden=true;
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

new MutationObserver(applyVisibility).observe(document.body,{childList:true,subtree:true});
applyVisibility();
