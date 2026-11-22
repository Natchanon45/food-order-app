"use strict";
const stripe=require("./m7-stripe-test-provider-policy");
const EVENTS=new Map([
 ["charge.refunded",{object:"charge",status:"refund_review"}],
 ["charge.dispute.created",{object:"dispute",status:"dispute_review"}],
]);
const CHARGE=/^ch_[A-Za-z0-9_]{8,240}$/;
const DISPUTE=/^dp_[A-Za-z0-9_]{8,240}$/;
function envelope({raw,header,secret,nowSeconds}={}){
 if(!stripe.webhookVerified(raw,header,secret,nowSeconds))return null;
 let e;
 try{e=JSON.parse(raw.toString("utf8"));}catch{return null;}
 const selected=EVENTS.get(e?.type);
 if(!stripe.EVENT.test(e?.id||"")||!selected||e.livemode!==false||
  e.data?.object?.object!==selected.object||
  e.data.object.livemode!==false||
  !(selected.object==="charge"?CHARGE:DISPUTE).test(e.data.object.id||""))
  return null;
 return {eventId:e.id,eventType:e.type,objectId:e.data.object.id,
  status:selected.status,providerVerified:false,financialChange:false};
}
function evidence({hint,event,charge,dispute}={}){
 if(!hint||!event||!charge||event.id!==hint.eventId||
  event.type!==hint.eventType||event.livemode!==false||
  event.data?.object?.id!==hint.objectId||
  event.data.object.livemode!==false||
  charge.object!=="charge"||!CHARGE.test(charge.id||"")||
  charge.livemode!==false||charge.currency!=="thb"||
  !stripe.INTENT.test(charge.payment_intent||"")||
  !Number.isSafeInteger(charge.amount)||charge.amount<1000||
  !Number.isSafeInteger(charge.amount_refunded)||charge.amount_refunded<0||
  charge.amount_refunded>charge.amount)return null;
 if(hint.eventType==="charge.refunded"){
  if(hint.objectId!==charge.id||charge.amount_refunded<=0)return null;
 }else if(hint.eventType==="charge.dispute.created"){
  if(!dispute||dispute.object!=="dispute"||dispute.id!==hint.objectId||
     dispute.livemode!==false||dispute.charge!==charge.id||
     dispute.currency!=="thb"||!Number.isSafeInteger(dispute.amount)||
     dispute.amount<1||dispute.amount>charge.amount)return null;
 }else return null;
 return {eventId:hint.eventId,eventType:hint.eventType,
  status:hint.status,chargeId:charge.id,intentId:charge.payment_intent,
  reversedSatang:hint.eventType==="charge.refunded"?charge.amount_refunded:dispute.amount,
  chargeTotalSatang:charge.amount,providerEvidenceVerified:true,
  operationalInvoicePaid:false};
}
module.exports={EVENTS,CHARGE,DISPUTE,envelope,evidence};
