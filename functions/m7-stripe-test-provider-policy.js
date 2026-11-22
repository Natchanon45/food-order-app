"use strict";
// Pure future-provider contract only. Not a deployed webhook or payment writer.
// No client redirect, QR screenshot or unsigned event authorizes settlement.
const {createHmac,timingSafeEqual}=require("node:crypto");
const {HEX,UUID,TENANT,invoiceKey}=require("./m7-stripe-test-reservation-policy");
const TEST=/^sk_test_[A-Za-z0-9_]{8,240}$/;
const HOOK=/^whsec_[A-Za-z0-9_]{8,240}$/;
const ACCOUNT=/^acct_[A-Za-z0-9]{12,80}$/;
const SESSION=/^cs_test_[A-Za-z0-9_]{8,240}$/;
const INTENT=/^pi_[A-Za-z0-9_]{8,240}$/;
const EVENT=/^evt_[A-Za-z0-9_]{8,240}$/;
const PURPOSE="penguin_m7_invoice_test";
function webhookVerified(raw,header,secret,nowSeconds=Math.floor(Date.now()/1000)){
 if(!Buffer.isBuffer(raw)||raw.length<2||raw.length>256*1024||
   !HOOK.test(secret||"")||typeof header!=="string"||header.length>4096)return false;
 const parts=header.split(",").map(v=>v.trim()),times=parts.filter(v=>v.startsWith("t="));
 if(times.length!==1||!/^t=\d{1,12}$/.test(times[0]))return false;
 const time=Number(times[0].slice(2));
 if(!Number.isSafeInteger(time)||Math.abs(nowSeconds-time)>300)return false;
 const expected=createHmac("sha256",secret).update(String(time)+".").update(raw).digest();
 return parts.some(v=>/^v1=[a-f0-9]{64}$/.test(v)&&
   timingSafeEqual(expected,Buffer.from(v.slice(3),"hex")));
}
function metadata(row,record){
 return row?.purpose===PURPOSE&&row.tenantId===record.tenantId&&
  row.invoiceId===record.invoiceId&&row.attemptId===record.attemptId&&
  row.invoiceSignature===record.invoiceSignature&&row.kind===record.kind;
}
function verifiedTestSettlement({reservation,session,intent,expectedAccount}={}){
 if(!reservation||!TENANT.test(reservation.tenantId||"")||
  (()=>{try{invoiceKey(reservation.invoiceId);return true;}catch{return false;}})()!==true||
  reservation.currency!=="THB"||reservation.mode!=="test"||
  reservation.status!=="checkout_ready"||reservation.providerCheckoutCreated!==true||
  !UUID.test(reservation.attemptId||"")||
  !HEX.test(reservation.invoiceSignature||"")||
  !SESSION.test(reservation.checkoutSessionId||"")||
  !ACCOUNT.test(expectedAccount||"")||
  reservation.accountId!==expectedAccount||
  !Number.isSafeInteger(reservation.amountSatang)||
  reservation.amountSatang<1000||reservation.amountSatang>99999999||
  !["monthly","delivery_daily"].includes(reservation.kind))return false;
 return session?.id===reservation.checkoutSessionId&&
  session.livemode===false&&session.mode==="payment"&&
  session.status==="complete"&&session.payment_status==="paid"&&
  session.currency==="thb"&&session.amount_total===reservation.amountSatang&&
  session.client_reference_id===reservation.attemptId&&metadata(session.metadata,reservation)&&
  Array.isArray(session.payment_method_types)&&session.payment_method_types.length===1&&
  session.payment_method_types[0]==="promptpay"&&
  INTENT.test(intent?.id||"")&&session.payment_intent===intent.id&&
  intent.livemode===false&&intent.status==="succeeded"&&intent.currency==="thb"&&
  intent.amount===reservation.amountSatang&&
  intent.amount_received===reservation.amountSatang&&
  metadata(intent.metadata,reservation)&&
  Array.isArray(intent.payment_method_types)&&intent.payment_method_types.length===1&&
  intent.payment_method_types[0]==="promptpay";
}
function verifiedEventEnvelope({raw,header,secret,nowSeconds}={}){
 if(!webhookVerified(raw,header,secret,nowSeconds))return null;
 let event;
 try{event=JSON.parse(raw.toString("utf8"));}catch{return null;}
 if(!EVENT.test(event?.id||"")||event.livemode!==false||
    !["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(event.type)||
    !SESSION.test(event.data?.object?.id||"")||
    event.data.object.livemode!==false||
    event.data.object.metadata?.purpose!==PURPOSE)return null;
 const meta=event.data.object.metadata;
 if(!TENANT.test(meta.tenantId||"")||!UUID.test(meta.attemptId||"")||
    !HEX.test(meta.invoiceSignature||"")||
    !["monthly","delivery_daily"].includes(meta.kind))return null;
 try{invoiceKey(meta.invoiceId);}catch{return null;}
 // The Stripe event contains a *hint*. Only an independently retrieved
 // session and intent can satisfy verifiedTestSettlement.
 return {eventId:event.id,sessionId:event.data.object.id,
  tenantId:String(event.data.object.metadata.tenantId||""),
  invoiceId:String(event.data.object.metadata.invoiceId||""),
  attemptId:String(event.data.object.metadata.attemptId||""),
  providerVerified:false,settled:false};
}
module.exports={TEST,HOOK,ACCOUNT,SESSION,INTENT,EVENT,PURPOSE,
 webhookVerified,metadata,verifiedTestSettlement,verifiedEventEnvelope};
