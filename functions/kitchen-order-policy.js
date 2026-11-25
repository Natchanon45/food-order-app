"use strict";
// P3.2: canonical Firestore Kitchen actions. Never turn a bank notification,
// kitchen admission, or served item into proof of payment or a refund.
const {hasCourierReservation,moneyCents,VALID_ID}=require("./cashier-safe-order-policy");
const ACTIVE=new Set(["pending","accepted","cooking","ready"]);
const NEXT={pending:"accepted",accepted:"cooking",cooking:"ready",ready:"served"};
const TERMINAL=new Set(["cancelled","completed","voided","deleted","paid","served"]);
const cents=value=>moneyCents(value);
const activeItems=order=>Array.isArray(order.items)?
  order.items.filter(item=>item?.cancelled!==true):[];
function isLalamove(order={}){
 return order.orderType==="delivery"&&(
  String(order.deliveryProvider||"").toLowerCase()==="lalamove"||
  Boolean(order.lalamoveOrderId||order.lalamoveDispatchReservation?.id||
   order.lalamoveDispatchPlacedAt||order.lalamoveShareLink));
}
function locked(order={}){
 // A changed courier preference cannot erase evidence of an uncertain job.
 const attempt=String(order.lalamoveDispatchAttemptState||"").toLowerCase();
 const dispatch=String(order.lalamoveDispatchStatus||"").toLowerCase();
 if(["placing","confirmation_unknown","placed"].includes(attempt)||
    ["placing","confirmation_unknown","placed"].includes(dispatch))
   return true;
 const status=String(order.status||"").toLowerCase();
 const providerStatus=String(order.lalamoveOrderStatus||"").toUpperCase();
 const providerDefinitivelyRejected=["CANCELED","CANCELLED","REJECTED","EXPIRED"]
  .includes(providerStatus);
 return TERMINAL.has(status)||hasCourierReservation(order)||
  Boolean(order.lalamoveDispatchReservation?.id||
   order.lalamoveWalletDebitPending===true)||
  (isLalamove(order)&&!providerDefinitivelyRejected&&
   Boolean(order.lalamoveOrderId||order.lalamoveDispatchPlacedAt||
     order.lalamoveDriverId||order.lalamoveOrderStatus||order.lalamoveShareLink));
}
function admitted(order={}){
 if(order.orderType!=="delivery")return true;
 if(String(order.paymentMethod||"").toLowerCase()==="cod")return false;
 if(order.paymentStatus==="paid")return true;
 const proof=order.companionKitchenRelease||{};
 return String(order.paymentMethod||"").toLowerCase()==="promptpay"&&
  order.paymentStatus==="pending_verification"&&
  order.paymentQrMode==="confirmed_order_5m"&&
  order.deliveryProvider==="lalamove"&&
  proof.status==="admitted_unverified"&&
  proof.bankConfirmed===false&&proof.paymentVerified===false&&
  proof.canDispatchRider===false&&
  order.paymentQrSlipFallbackStatus==="not_required"&&
  !order.paymentSlipPath;
}
function eligible(order={},action=""){
 if(!["table","takeaway","delivery"].includes(String(order.orderType||"")))
  return false;
 if(locked(order)||!admitted(order))return false;
 if(!ACTIVE.has(order.status))return false;
 // A waiting queue placeholder or an empty draft is not a Kitchen order.
 if(activeItems(order).length===0)return false;
 if(action==="status")return true;
 return Array.isArray(order.items)&&order.items.length>0&&order.items.length<=100;
}
function validateStatus(order,next){
 if(!eligible(order,"status")||NEXT[order.status]!==next)return false;
 if(next==="served"&&isLalamove(order))return false;
 return true;
}
function itemEligible(order,index,action){
 if(!eligible(order,action)||!Number.isSafeInteger(index)||index<0||
   index>=order.items.length)return false;
 const item=order.items[index];
 if(!item||item.cancelled===true)return false;
 if(action==="serve_item")return order.status==="ready"&&
   ["table"].includes(order.orderType)&&item.served!==true&&
   item.kitchenPreviouslyServed!==true;
 return ["edit_item","cancel_item"].includes(action)&&
   (item.served!==true||order.status==="ready");
}
function nextFinancials(order={},items=[]){
 const live=items.filter(item=>!item.cancelled);
 const sum=live.reduce((acc,item)=>{
  const qty=Number(item.qty);
  const priceCents=cents(item.price);
  if(!Number.isSafeInteger(qty)||qty<1||qty>999||priceCents===null)throw Error("KITCHEN_INVALID_ITEM_PRICE");
  return acc+priceCents*qty;
 },0);
 if(!Number.isSafeInteger(sum)||sum>1e11)throw Error("KITCHEN_TOTAL_INVALID");
 const delivery=order.orderType==="delivery"&&live.length>0
   ?cents(Number(order.deliveryFee||0)):0;
 const discount=order.orderType==="delivery"&&live.length>0
   ?cents(Number(order.deliveryPromotionDiscount||0)):0;
 if(delivery===null||discount===null)throw Error("KITCHEN_DELIVERY_AMOUNT_INVALID");
 const final=sum+delivery-Math.min(discount,delivery);
 if(!Number.isSafeInteger(final)||final<0)throw Error("KITCHEN_TOTAL_INVALID");
 return {
  subtotalAmount:sum/100,
  deliveryFee:delivery/100,
  deliveryPromotionDiscount:Math.min(discount,delivery)/100,
  totalAmount:final/100,
 };
}
function isPaid(order){return String(order.paymentStatus||"").toLowerCase()==="paid";}
module.exports={VALID_ID,activeItems,locked,admitted,eligible,validateStatus,itemEligible,
 nextFinancials,isPaid,isLalamove};
