"use strict";
// Account readiness for shared PG Connect, not bank verification or ingest consent.
const policy=require("./payment-companion-policy");
const codes=Object.freeze({"01002":"bbl","01004":"kbank","01006":"ktb","01014":"scb","01022":"cimb","01025":"krungsri","01030":"gsb","01034":"baac"});
const supported=new Set(Object.values(policy.sources).filter(Boolean));
function receiver(snapshot,scope){
 const data=snapshot?.data()||{},t=snapshot?.updateTime;
 const version=t&&Number.isInteger(t.seconds)&&Number.isInteger(t.nanoseconds)?t.seconds+"."+t.nanoseconds:"";
 const central=scope==="platform",r=central?data.receiver||{}:data;
 const bankCode=central?codes[r.accountType]||"":policy.receiver(r).bankCode;
 const account=String(central?r.accountNumber||"":r.bankAccountNumber||"").replace(/[ -]/g,"");
 const name=String(central?r.accountNameTH||r.accountNameEN||"":r.bankAccountName||"").trim();
 const ready=!!version&&supported.has(bankCode)&&/^\d{8,20}$/.test(account)&&!!name&&(!central||Number.isSafeInteger(data.revision)&&data.revision>0);
 const revision=ready?policy.digest(JSON.stringify(["pg-connect-receiver-v1",scope,version,bankCode,account,name])):"";
 return {ready,bankCode:ready?bankCode:"",accountLast4:ready?account.slice(-4):"",version:ready?version:"",revision};
}
function view(current,link){
 const confirmed=current.ready&&link?.revision===current.revision&&link?.confirmed===true;
 return {ready:current.ready,bankCode:current.bankCode,accountLast4:current.accountLast4,version:current.version,confirmed,
  requiresReconfirmation:link?.confirmed===true&&!confirmed,notificationEnabled:false,paymentVerified:false};
}
module.exports={receiver,view};
