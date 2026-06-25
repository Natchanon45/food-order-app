import {hasPermission} from "./retail-pos-navigation.js?v=20260625-10";

const P={
  countPerform:"pos.stock_counts.perform",
  countValue:"pos.stock_counts.view_value",
  countHistory:"pos.stock_counts.view_history",
  movementQuantity:"pos.stock_movements.view_quantity",
  movementExport:"pos.stock_movements.export"
};

function hide(element,value){if(element&&element.hidden!==value)element.hidden=value}
function deny(message="คุณไม่มีสิทธิ์ดำเนินการนี้"){alert(message)}

function applyCountPermissions(){
  const canPerform=hasPermission(P.countPerform),canViewValue=hasPermission(P.countValue),canViewHistory=hasPermission(P.countHistory);
  ["#countName","#countDate","#countedBy","#countNote","#fillSystemBtn","#clearActualBtn","#resetCountBtn","#confirmCountBtn"].forEach(selector=>{
    const element=document.querySelector(selector);
    if(!element)return;
    if("disabled" in element)element.disabled=!canPerform;
    if(element.matches("button"))hide(element,!canPerform);
  });
  document.querySelectorAll(".actual-input").forEach(input=>input.disabled=!canPerform);
  if(!canViewValue){
    document.querySelectorAll(".count-table th:nth-child(5),.count-table td:nth-child(5),#varianceValue").forEach(element=>hide(element,true));
    document.querySelectorAll(".count-product span").forEach(element=>{
      const cleaned=element.textContent.replace(/\s*•\s*ทุน\s*[\d,.]+/g,"");
      if(cleaned!==element.textContent)element.textContent=cleaned;
    });
    document.querySelectorAll(".count-history-total strong").forEach(element=>hide(element,true));
  }
  const historyPanel=document.querySelector(".count-history-panel");
  hide(historyPanel,!canViewHistory);
}

function applyMovementPermissions(){
  hide(document.querySelector("#exportMovementCsv"),!hasPermission(P.movementExport));
  if(!hasPermission(P.movementQuantity)){
    ["#movementIn","#movementOut","#movementNet"].forEach(selector=>hide(document.querySelector(selector),true));
    document.querySelectorAll(".movement-table th:nth-child(5),.movement-table th:nth-child(6),.movement-table th:nth-child(7),.movement-table td:nth-child(5),.movement-table td:nth-child(6),.movement-table td:nth-child(7)").forEach(element=>hide(element,true));
  }
}

function apply(){applyCountPermissions();applyMovementPermissions()}

function permissionFor(target){
  if(target.closest("#confirmCountBtn")||target.closest("#fillSystemBtn")||target.closest("#clearActualBtn")||target.closest("#resetCountBtn"))return P.countPerform;
  if(target.closest("#exportMovementCsv"))return P.movementExport;
  return null;
}

document.addEventListener("click",event=>{
  const permission=permissionFor(event.target);
  if(permission&&!hasPermission(permission)){
    event.preventDefault();
    event.stopImmediatePropagation();
    deny();
  }
},true);

document.addEventListener("input",event=>{
  if(event.target.matches(".actual-input")&&!hasPermission(P.countPerform)){
    event.preventDefault();
    event.stopImmediatePropagation();
    deny();
  }
},true);

[document.querySelector("#countTableBody"),document.querySelector("#countHistory"),document.querySelector("#movementTableBody")].filter(Boolean).forEach(target=>{
  let scheduled=false;
  new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;apply()});
  }).observe(target,{childList:true});
});

apply();
setTimeout(apply,0);
