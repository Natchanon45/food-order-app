"use strict";
const {digest,HEX,ID,sources}=require("./payment-companion-policy");
const {receiverState,receiverRevision}=require("./payment-companion-receiver");
const {payee}=require("./payment-companion-qr-policy");
const {cents,FLOW}=require("./delivery-notification-intake");
const WINDOW=15*60000,GRACE=60000;
const flags=Object.freeze({bankConfirmed:false,paymentVerified:false,canReleaseKitchen:false,canDispatchRider:false,canSettleInvoice:false});
const time=o=>o?.createdAt?.toMillis?.()||0;
function amount(o){try{return cents(o.totalAmount);}catch{return 0;}}
function fingerprint(n){
 // A conservative observation collision key, NOT a bank transaction ID.
 return digest(JSON.stringify(["delivery-notice-minute-v1",n.receiverRevision,n.receiverSuffix,n.amountSatang,Math.floor(n.bankMs/60000)]));
}
function validNotice(n,device,link,recipient,now){
 return !!n&&HEX.test(n.id||"")&&HEX.test(n.eventId||"")&&ID.test(n.deviceId||"")&&
  n.id===digest(n.deviceId+":"+n.eventId)&&device?.id===n.deviceId&&device.enabled===true&&!device.archivedMs&&
  n.verificationStatus==="unverified"&&n.receiverRevision===link.revision&&
  n.receiverSuffix==="X-"+recipient.accountLast4&&Object.hasOwn(sources,n.source)&&sources[n.source]===recipient.bankCode&&
  Number.isSafeInteger(n.amountSatang)&&n.amountSatang>0&&n.amountSatang<=100000000&&
  [n.bankMs,n.observedMs,n.receivedMs].every(Number.isSafeInteger)&&
  n.bankMs>=link.confirmedAtMs&&n.observedMs>=n.bankMs&&n.receivedMs>=n.observedMs&&
  n.receivedMs<=now&&n.receivedMs-n.bankMs<=WINDOW+GRACE;
}
function relation(o,n){
 const created=time(o);
 if(!created||amount(o)!==n.amountSatang)return "";
 if(n.bankMs>=created&&n.bankMs<=created+WINDOW&&n.observedMs>=created&&n.receivedMs<=created+WINDOW+GRACE)return "candidate";
 // Whole-minute SCB timestamp can precede creation. Never claim it.
 if(n.source==="line_scb_connect"&&n.bankMs===Math.floor(created/60000)*60000&&n.bankMs<created&&
    n.observedMs>=created&&n.observedMs<=n.bankMs+120000&&n.receivedMs<=created+WINDOW+GRACE)return "time_precision_review";
 return "";
}
function evaluate({tenantId,orderId,orders,notices,devices,store,link,truncated=false,now=Date.now()}){
 const result=(status,more={})=>({orderId,status,...flags,...more});
 if(truncated)return result("bounded_unavailable");
 const o=orders.find(row=>row.id===orderId);
 if(!o||o.tenantId!==tenantId||o.orderType!=="delivery"||o.bankTransferReviewFlow!==FLOW||
    o.paymentMethod!=="promptpay"||o.paymentStatus!=="pending_verification"||o.status!=="pending"||
    o.companionKitchenRelease||o.kitchenReleasedAt||!amount(o)||!time(o)||time(o)>now)
  return result("order_unavailable");
 const recipient=receiverState(store,link,true),revision=receiverRevision(store);
 if(!recipient.enabled||!HEX.test(revision)||!Number.isSafeInteger(link?.confirmedAtMs)||
    link.confirmedAtMs>time(o)||o.paymentReceiverRevision!==revision)
  return result("receiver_unconfirmed");
 try{if(payee(store.data())!==o.paymentRecipientId)return result("receiver_unconfirmed");}
 catch{return result("receiver_unconfirmed");}
 if(now>time(o)+WINDOW+GRACE)return result("window_expired");
 const active=new Map(devices.map(d=>[d.id,d]));
 const candidates=notices.filter(n=>validNotice(n,active.get(n.deviceId),link,recipient,now)&&relation(o,n));
 if(!candidates.length)return result("no_match");
 if(candidates.length!==1)return result("ambiguous");
 const n=candidates[0];
 // Include other rails and even paid/cancelled orders as potential consumers.
 // Conservative overlap avoids reusing a notice that might belong elsewhere.
 if(orders.some(other=>other.id!==orderId&&other.paymentMethod==="promptpay"&&
    amount(other)===n.amountSatang&&time(other)&&Math.abs(time(other)-n.bankMs)<=WINDOW+GRACE))
  return result("ambiguous");
 const status=relation(o,n);
 return result(status,{notificationId:n.id,amountSatang:n.amountSatang,receiverRevision:revision,
  source:n.source,observationFingerprint:fingerprint(n)});
}
module.exports={evaluate,validNotice,relation,fingerprint,WINDOW,GRACE,flags};
