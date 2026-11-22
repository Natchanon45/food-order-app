"use strict";
const policy=require("./payment-companion-policy");
// This digest and Firestore revision remain server-private. A saved store
// revision change (including a change back to old values) requires reconsent.
// PromptPay and the actual receiving bank account are separate identities.
function receiverRevision(snapshot){
 const data=snapshot?.data()||{},recipient=policy.receiver(data);
 const time=snapshot?.updateTime;
 if(!recipient.storePaymentReady||!time||!Number.isInteger(time.seconds)||!Number.isInteger(time.nanoseconds))return "";
 return policy.digest(JSON.stringify(["payment-companion-receiver-v1",time.seconds,time.nanoseconds,data.bankName,data.bankAccountNumber,data.bankAccountName,data.promptPayId,data.promptPayName||"",data.deliveryPromptPayEnabled!==false]));
}
function receiverState(snapshot,link,pilotEnabled){
 const recipient=policy.receiver(snapshot?.data()),revision=receiverRevision(snapshot);
 const linked=link?.enabled===true;
 const current=linked&&!!revision&&link.revision===revision&&link.bankCode===recipient.bankCode&&link.accountLast4===recipient.accountLast4;
 return {...recipient,enabled:!!pilotEnabled&&current,requiresReconfirmation:linked&&!current,linked,confirmedAtMs:current?link.confirmedAtMs:null,autoKitchenUAT:false,autoVisionUAT:false,bankConfirmed:false,paymentVerified:false};
}
function allowedNotice(n,link,device){
 return link?.enabled===true&&device?.enabled===true&&!device.archivedMs&&typeof link.revision==="string"&&n.receiverRevision===link.revision&&n.bankMs>=link.confirmedAtMs&&n.receivedMs>=link.confirmedAtMs;
}
module.exports={receiverRevision,receiverState,allowedNotice};
