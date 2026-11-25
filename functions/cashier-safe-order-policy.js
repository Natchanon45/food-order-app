"use strict";
// P3.1: conservative server/cashier shared financial transition rules.
// Bank/LINE/PromptPay matching is never evidence of cash received.
// COD is disabled until an explicitly authorized bank/driver reconciliation.
const RETRYABLE=new Set(["CANCELED","CANCELLED","REJECTED","EXPIRED"]);
const ATTEMPT=new Set(["placing","confirmation_unknown","placed"]);
const CLOSED=new Set(["paid","cancelled","completed","delivered","voided","deleted"]);
const VALID_ID=/^[A-Za-z0-9_-]{1,128}$/;
const moneyCents=value=>{
 if(typeof value!=="number"||!Number.isFinite(value)||value<0||value>1e9)return null;
 const cents=Math.round(value*100);
 return Math.abs(value*100-cents)<0.0001?cents:null;
};
function hasCourierReservation(order={}){
 // An existing external reservation must remain a cancellation block even
 // if the order's displayed courier provider is subsequently changed.
 if(order.lalamoveDispatchReservation?.id||order.lalamoveWalletDebitPending===true)
   return true;
 if(order.orderType!=="delivery"||order.deliveryProvider!=="lalamove")return false;
 const status=String(order.lalamoveOrderStatus||"").toUpperCase();
 if(RETRYABLE.has(status))return false;
 const attempt=String(order.lalamoveDispatchAttemptState||"").toLowerCase();
 const dispatch=String(order.lalamoveDispatchStatus||"").toLowerCase();
 if(ATTEMPT.has(attempt)||ATTEMPT.has(dispatch))return true;
 return Boolean(String(order.lalamoveOrderId||"").trim());
}
function hasPaymentEvidence(order={}){
 return Boolean(order.paymentSlipPath||order.paymentSlipUrl||order.slipEvidenceSha256||
  order.paymentReviewRequired===true||order.bankTransferReviewFlow||
  order.companionKitchenRelease||order.companionAutoOCRReview||
  order.slipCheckStatus==="matched"||order.cashierSlipUnavailableManualEligible===true);
}
function isCashOnly(order={}){
 return ["","cash"].includes(String(order.paymentMethod||"").trim().toLowerCase())&&
   !hasPaymentEvidence(order)&&
   !["delivery","walkin"].includes(String(order.orderType||"").toLowerCase())&&
   moneyCents(order.totalAmount)!==null;
}
function canCashierReceiveCash(order={}){
 if(!isCashOnly(order))return false;
 if(CLOSED.has(String(order.status||"").toLowerCase()))return false;
 if(String(order.paymentStatus||"unpaid")!=="unpaid")return false;
 return true;
}
function canCashierCancel(order={}){
 // Bank/PromptPay/COD/Stripe might have funds in transit before a receipt
 // exists; never treat an empty slip field as authority to void such an order.
 if(!["","cash"].includes(String(order.paymentMethod||"").trim().toLowerCase()))
   return false;
 if(hasCourierReservation(order)||hasPaymentEvidence(order))return false;
 if(String(order.paymentStatus||"unpaid")!=="unpaid")return false;
 if(!["pending","new","unpaid"].includes(String(order.status||"pending").toLowerCase()))return false;
 if(Array.isArray(order.items)&&order.items.some(item=>item?.served||item?.cooking||item?.prepared))return false;
 return order.orderType!=="walkin"&&
   ["table","takeaway","delivery"].includes(String(order.orderType||"").toLowerCase());
}
function canCashierHandlePickup(order={},action=""){
 if(order.orderType!=="takeaway"||order.paymentStatus!=="paid"||
    order.pickupStatus==="picked_up")return false;
 if(!["ready","served"].includes(String(order.status||"").toLowerCase())&&
    order.pickupStatus!=="called")return false;
 return action==="call"||action==="handover";
}
module.exports={VALID_ID,moneyCents,hasCourierReservation,hasPaymentEvidence,
  isCashOnly,canCashierReceiveCash,canCashierCancel,canCashierHandlePickup};
