"use strict";
const {createHash}=require("node:crypto");
const digest=value=>createHash("sha256").update(value).digest("hex");
const HEX=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const LABEL=/^[\p{L}\p{M}\p{N} ._-]{1,100}$/u;
const sources=Object.freeze({line_kbank_live:"kbank",line_scb_connect:"scb",line_krungsri_simple:"krungsri",line_krungthai_connext:"ktb",line_gsb_now:"gsb",line_cimb_thai_connect:"cimb",line_baac_family:"baac",line_linebk_alerts:"linebk",bank_scb_easy:"scb",bank_kplus:"kbank",bank_ktb_next:"ktb",bank_bbl_mobile:"bbl",bank_other_installed:""});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const invalid=()=>{throw Error("COMPANION_NOTICE_INVALID");};
function iso(value,now){
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))invalid();
 const [y,m,d]=value.slice(0,10).split("-").map(Number);
 const calendar=new Date(Date.UTC(y,m-1,d));
 if(calendar.getUTCFullYear()!==y||calendar.getUTCMonth()!==m-1||calendar.getUTCDate()!==d||Number(value.slice(11,13))>23||Number(value.slice(14,16))>59||Number(value.slice(17,19))>59)invalid();
 const ms=Date.parse(value);
 if(!Number.isFinite(ms)||ms>now+600000||ms<now-2*365*86400000)invalid();
 return ms;
}
function notice(input,now=Date.now()){
 const fields=["kind","appPackage","notificationTitle","notificationText","eventId","source","amount","receiverSuffix","bankDisplayTime","deviceObservedAt"];
 if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k))||Object.values(input).some(v=>typeof v!=="string"))invalid();
 if(input.kind==="raw_notification")throw Error("COMPANION_RAW_NOT_SUPPORTED");
 // Structured data only. Never store bank text, OTP, full account numbers.
 if(input.kind||input.notificationTitle||input.notificationText||!HEX.test(input.eventId||"")||!own(sources,input.source)||!/^X-[0-9]{4}$/.test(input.receiverSuffix||"")||!/^\d{1,9}\.\d{2}$/.test(input.amount||""))invalid();
 if(input.source==="bank_other_installed"&&(!/^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(input.appPackage||"")||input.appPackage.length>150||/^(jp\.naver\.line\.android|org\.telegram\.|com\.whatsapp|com\.android\.|com\.google\.android\.apps\.messaging|com\.lukkaja\.companion)/.test(input.appPackage)))invalid();
 const [major,minor]=input.amount.split(".").map(Number),amountSatang=major*100+minor;
 if(major>100000000||amountSatang<=0)invalid();
 const bankMs=iso(input.bankDisplayTime,now),observedMs=iso(input.deviceObservedAt,now);
 if(observedMs<bankMs-600000||observedMs>bankMs+86400000)invalid();
 return {eventId:input.eventId,source:input.source,amountSatang,receiverSuffix:input.receiverSuffix,bankMs,observedMs};
}
function receiver(store={}){
 const name=String(store.bankName||"").trim(),canonical=name.toLowerCase().replace(/[\s.()_-]/g,"").replace(/ธนาคาร|bank/g,"");
 const pairs=[["scb",/ไทยพาณิชย์|scb|siamcommercial/],["kbank",/กสิกร|kasikorn|kplus|^k$/],["ktb",/กรุงไทย|krungthai|^ktb$/],["bbl",/กรุงเทพ|bangkok|^bbl$/],["krungsri",/กรุงศรี|อยุธยา|krungsri/],["gsb",/ออมสิน|gsb/],["cimb",/ซีไอเอ็มบี|cimb/],["baac",/เพื่อการเกษตร|ธกส|baac/],["linebk",/linebk/]];
 const bankCode=pairs.find(([,pattern])=>pattern.test(canonical))?.[0]||"";
 const account=String(store.bankAccountNumber||"").replace(/[ -]/g,""),prompt=String(store.promptPayId||"").replace(/[ -]/g,"");
 const ready=!!bankCode&&/^\d{8,20}$/.test(account)&&/^(?:\d{10}|\d{13}|\d{15})$/.test(prompt)&&!!String(store.bankAccountName||"").trim()&&store.deliveryPromptPayEnabled!==false;
 return {bankCode,bankName:name.slice(0,100),accountLast4:/^\d{8,20}$/.test(account)?account.slice(-4):"",promptPayLast4:/^\d{10,15}$/.test(prompt)?prompt.slice(-4):"",storePaymentReady:ready};
}
function rank(orders,notices,recipient,{truncated=false}={}){
 const eligible=notices.filter(n=>recipient.storePaymentReady&&n.receiverSuffix==="X-"+recipient.accountLast4&&sources[n.source]===recipient.bankCode);
 const matches=orders.map(order=>{
  const confirmed=order.paymentQrMode==="confirmed_order_5m"&&
    Number.isFinite(order.qrStartedMs)&&Number.isFinite(order.qrExpiryMs)&&
    order.qrExpiryMs-order.qrStartedMs===300000&&
    order.qrStartedMs>=order.createdMs-120000&&order.qrStartedMs<=order.createdMs+60000;
  const candidates=eligible.filter(n=>{
    if(n.amountSatang!==order.amountSatang)return false;
    if(!confirmed)return order.paymentQrMode!=="confirmed_order_5m"&&n.bankMs<order.createdMs&&order.createdMs-n.bankMs<=900000;
    const normal=n.bankMs>=order.createdMs&&n.bankMs<=order.qrExpiryMs&&
      n.receivedMs>=order.createdMs&&n.receivedMs<=order.qrExpiryMs+60000&&n.receivedMs>=n.bankMs;
    // SCB Connect may display only whole minutes. Flag for manual inspection:
    // it is NEVER a bank-authorized kitchen/settlement decision.
    const sameMinute=n.source==="line_scb_connect"&&n.bankMs===Math.floor(order.createdMs/60000)*60000&&
      n.bankMs<order.createdMs&&n.observedMs>=order.createdMs&&
      n.observedMs<=Math.min(order.qrExpiryMs,n.bankMs+120000)&&
      n.receivedMs>=n.observedMs&&n.receivedMs<=order.qrExpiryMs;
    return normal||sameMinute;
  });
  const minutePrecision=confirmed&&candidates.length===1&&candidates[0].bankMs<order.createdMs;
  const result={orderId:order.id,amountSatang:order.amountSatang,orderTimeUTC:new Date(order.createdMs).toISOString(),hasSlip:order.hasSlip,paymentVerified:false,status:!recipient.storePaymentReady||truncated?"unavailable":candidates.length>1?"ambiguous":candidates.length===1?minutePrecision?"time_precision_review":"candidate":"no_match"};
  if(["candidate","time_precision_review"].includes(result.status))Object.assign(result,{notificationId:candidates[0].id,source:candidates[0].source,timeDifferenceSeconds:Math.floor((order.createdMs-candidates[0].bankMs)/1000)});
  return result;
 });
 // Even when one order has multiple possibilities, any shared notice makes
 // another otherwise-single candidate ambiguous.
 for(const result of matches){
  if(result.notificationId&&orders.filter(o=>eligible.some(n=>n.id===result.notificationId&&n.amountSatang===o.amountSatang&&(
    (o.paymentQrMode==="confirmed_order_5m"&&(
      (n.bankMs>=o.createdMs&&n.bankMs<=o.qrExpiryMs&&n.receivedMs>=o.createdMs&&n.receivedMs<=o.qrExpiryMs+60000&&n.receivedMs>=n.bankMs)
      ||(n.source==="line_scb_connect"&&n.bankMs===Math.floor(o.createdMs/60000)*60000&&n.bankMs<o.createdMs&&
        n.observedMs>=o.createdMs&&n.observedMs<=Math.min(o.qrExpiryMs,n.bankMs+120000)&&
        n.receivedMs>=n.observedMs&&n.receivedMs<=o.qrExpiryMs)
    ))
    ||(o.paymentQrMode!=="confirmed_order_5m"&&n.bankMs<o.createdMs&&o.createdMs-n.bankMs<=900000)
   ))).length>1){
   result.status="ambiguous";delete result.notificationId;delete result.source;delete result.timeDifferenceSeconds;
  }
 }
 return matches;
}
module.exports={digest,HEX,ID,LABEL,notice,receiver,rank,sources};
