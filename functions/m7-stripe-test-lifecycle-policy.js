"use strict";
const stripe=require("./m7-stripe-test-provider-policy");
const invoice=require("./m7-stripe-test-reservation-policy");
const EVENTS=new Set([
 "checkout.session.expired","checkout.session.async_payment_failed",
]);
const CLOSED_STATES={ "checkout.session.expired":"expired_test",
 "checkout.session.async_payment_failed":"payment_failed_test" };
function verifiedEnvelope({raw,header,secret,nowSeconds}={}){
 if(!stripe.webhookVerified(raw,header,secret,nowSeconds))return null;
 let e;
 try{e=JSON.parse(raw.toString("utf8"));}catch{return null;}
 if(!stripe.EVENT.test(e?.id||"")||!EVENTS.has(e?.type)||
    e.livemode!==false||!stripe.SESSION.test(e.data?.object?.id||"")||
    e.data.object.livemode!==false)return null;
 const m=e.data.object.metadata;
 if(m?.purpose!==stripe.PURPOSE||!invoice.TENANT.test(m.tenantId||"")||
    !invoice.UUID.test(m.attemptId||"")||
    !invoice.HEX.test(m.invoiceSignature||"")||
    !["monthly","delivery_daily"].includes(m.kind))return null;
 try{invoice.invoiceKey(m.invoiceId);}catch{return null;}
 return {eventId:e.id,type:e.type,sessionId:e.data.object.id,
  tenantId:m.tenantId,invoiceId:m.invoiceId,attemptId:m.attemptId,
  invoiceSignature:m.invoiceSignature,kind:m.kind,
  providerVerified:false,invoicePaid:false};
}
function boundSession(record,session){
 if(!record||!session||record.mode!=="test"||record.currency!=="THB"||
  !["provider_requesting","checkout_ready","expired_test","payment_failed_test"].includes(record.status)||
  record.providerCheckoutCreated===true&&record.status==="provider_requesting"||
  !invoice.TENANT.test(record.tenantId||"")||
  !invoice.UUID.test(record.attemptId||"")||
  !invoice.HEX.test(record.invoiceSignature||"")||
  !Number.isSafeInteger(record.amountSatang)||record.amountSatang<1000||
  record.amountSatang>99999999||
  !stripe.SESSION.test(session.id||"")||session.livemode!==false||
  session.mode!=="payment"||session.currency!=="thb"||
  session.amount_total!==record.amountSatang||
  session.client_reference_id!==record.attemptId||
  !stripe.metadata(session.metadata,record)||
  !Array.isArray(session.payment_method_types)||
  session.payment_method_types.length!==1||
  session.payment_method_types[0]!=="promptpay"||
  record.checkoutSessionId&&record.checkoutSessionId!==session.id)return false;
 return true;
}
// A provider event and independent session re-read must agree on a *terminal*
// unpaid condition. Never accept browser cancel/success_url as proof.
function terminalUnpaid(eventType,record,session,intent){
 if(!EVENTS.has(eventType)||!boundSession(record,session)||
    session.payment_status!=="unpaid"||
    (eventType==="checkout.session.expired"&&session.status!=="expired")||
    (eventType==="checkout.session.async_payment_failed"&&session.status!=="complete"))return false;
 if(session.payment_intent){
  if(!stripe.INTENT.test(session.payment_intent)||!intent||
      intent.id!==session.payment_intent||intent.livemode!==false||
      intent.currency!=="thb"||intent.amount!==record.amountSatang||
      intent.amount_received!==0||intent.status==="succeeded"||
      !["requires_payment_method","canceled"].includes(intent.status)||
      !stripe.metadata(intent.metadata,record))return false;
 }else if(intent!==null&&intent!==undefined)return false;
 return true;
}
function inspect(record,session,intent){
 if(!boundSession(record,session))return "needs_review";
 if(session.status==="open"&&session.payment_status==="unpaid")return "awaiting_payment";
 if(session.status==="complete"&&session.payment_status==="paid"&&
  stripe.verifiedTestSettlement({reservation:{
   ...record,status:"checkout_ready",providerCheckoutCreated:true,
   checkoutSessionId:session.id},session,intent,expectedAccount:record.accountId}))
  return "awaiting_signed_webhook";
 if(session.status==="expired"&&session.payment_status==="unpaid")
  return terminalUnpaid("checkout.session.expired",record,session,intent)?
   "provider_expired_unpaid":"needs_review";
 if(session.status==="complete"&&session.payment_status==="unpaid")
  return terminalUnpaid("checkout.session.async_payment_failed",record,session,intent)?
   "provider_failed_unpaid":"needs_review";
 return "needs_review";
}
function publicInspection(record,state){
 const allowed=new Set(["awaiting_payment","awaiting_signed_webhook",
  "provider_expired_unpaid","provider_failed_unpaid","needs_review",
  "provider_request_uncertain","already_recorded_test","provider_risk_review"]);
 if(!allowed.has(state))throw Error("M7_TEST_INSPECTION_INVALID");
 return {ok:true,invoiceId:record.invoiceId,attemptId:record.attemptId,
  amountSatang:record.amountSatang,currency:"THB",status:state,
  providerProofObserved:state==="awaiting_signed_webhook"||state==="already_recorded_test",
  operationalInvoicePaid:false,serviceCreditChanged:false,
  canRetry:false,providerTestModeOnly:true};
}
module.exports={EVENTS,CLOSED_STATES,verifiedEnvelope,boundSession,terminalUnpaid,inspect,publicInspection};
