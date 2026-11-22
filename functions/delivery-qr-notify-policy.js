"use strict";
// Source confirmed-order QR keeps the new pending order invisible to delivery
// notifications until a specific, audited review transition occurs.
function suppressCreated(order){
 return order?.orderType==="delivery"&&order.paymentQrMode==="confirmed_order_5m"&&
   order.paymentMethod==="promptpay"&&order.paymentStatus==="pending_verification";
}
function cashierEvent(before,after){
 if(!before||!after||after.orderType!=="delivery"||
   after.paymentQrMode!=="confirmed_order_5m"||
   after.paymentMethod!=="promptpay"||
   after.paymentStatus!=="pending_verification"||after.status!=="pending")return "";
 const uat=before.companionKitchenRelease?.status!=="admitted_unverified"&&
   after.companionKitchenRelease?.status==="admitted_unverified"&&
   after.companionKitchenRelease.paymentVerified===false&&
   after.companionKitchenRelease.bankConfirmed===false&&
   after.companionKitchenRelease.canDispatchRider===false;
 if(uat)return "uat_kitchen";
 const slip=before.paymentQrSlipFallbackStatus!=="submitted"&&
   after.paymentQrSlipFallbackStatus==="submitted"&&
   after.paymentReviewRequired===true&&after.slipCheckStatus==="manual_review"&&
   typeof after.paymentSlipPath==="string"&&after.paymentSlipPath.length>0;
 return slip?"original_slip":"";
}
module.exports={suppressCreated,cashierEvent};
