"use strict";
// Synthetic credit evidence only. A valid signature is not real bank provenance.
const {createHash,verify}=require("node:crypto");
const {validateHybridBankPinnedKey}=require("./hybrid-billing-bank-key-policy");
const {receiverRevision,receiverState}=require("./payment-companion-receiver");
const {payee}=require("./payment-companion-qr-policy");
const {cents}=require("./delivery-notification-intake");
const {validNotice,relation,fingerprint,flags}=require("./delivery-notification-match-policy");
const {HEX,ID}=require("./payment-companion-policy");
const VERSION="delivery_demo_bank_credit_v1",PROVIDER="demo_delivery_bank";
const FIELDS=["tenantId","orderId","notificationId","receiverRevision","accountFingerprint",
 "transactionReference","amountSatang","currency","direction","postingStatus","postedAt"];
const exact=(x,fields)=>x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).length===fields.length&&fields.every(k=>Object.hasOwn(x,k));
const hash=x=>createHash("sha256").update(x).digest("hex");
const utc=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const fail=code=>{throw Error("DELIVERY_BANK_"+code);};
function bytes(envelope){
 const {version,providerId,keyId,payload}=envelope||{};
 if(version!==VERSION||providerId!==PROVIDER||typeof keyId!=="string"||!/^[A-Za-z0-9_-]{3,80}$/.test(keyId)||
  !exact(payload,FIELDS)||![payload.tenantId,payload.orderId].every(v=>typeof v==="string"&&ID.test(v))||
  ![payload.notificationId,payload.receiverRevision,payload.accountFingerprint].every(v=>typeof v==="string"&&HEX.test(v))||
  typeof payload.transactionReference!=="string"||!/^demo-[A-Za-z0-9_-]{8,120}$/.test(payload.transactionReference)||
  !Number.isSafeInteger(payload.amountSatang)||payload.amountSatang<=0||payload.amountSatang>100000000||
  payload.currency!=="THB"||payload.direction!=="credit"||payload.postingStatus!=="posted"||!utc(payload.postedAt))
   fail("EVIDENCE_INVALID");
 const ordered=Object.fromEntries(FIELDS.map(k=>[k,payload[k]]));
 return Buffer.from("PENGUIN-DELIVERY-DEMO-BANK-CREDIT-V1\n"+JSON.stringify({version,providerId,keyId,payload:ordered}),"utf8");
}
function accountFingerprint(store,recipient){
 return hash(JSON.stringify(["delivery-bank-account-v1",recipient.bankCode,String(store.data()?.bankAccountNumber||"").replace(/[ -]/g,"")]));
}
function preflight({tenantId,orderId,order,audit,claim,collision,notice,device,store,link,envelope,registry,now=Date.now()}){
 if(!order||order.tenantId!==tenantId||order.orderType!=="delivery"||
  order.bankTransferReviewFlow!=="notification_first"||order.paymentMethod!=="promptpay"||
  order.paymentStatus!=="pending_verification"||order.status!=="pending"||order.kitchenReleasedAt||order.companionKitchenRelease)
  fail("ORDER_NOT_ELIGIBLE");
 const created=order.createdAt?.toMillis?.(),amount=cents(order.totalAmount);
 const revision=receiverRevision(store),recipient=receiverState(store,link,true);
 if(!Number.isSafeInteger(created)||created<=0||created>now||!recipient.enabled||!HEX.test(revision)||
  !Number.isSafeInteger(link?.confirmedAtMs)||link.confirmedAtMs>created||
  order.paymentReceiverRevision!==revision||payee(store.data())!==order.paymentRecipientId)
  fail("RECEIVER_CHANGED");
 if(!audit||audit.status!=="recorded_unverified"||audit.tenantId!==tenantId||audit.orderId!==orderId||
  audit.amountSatang!==amount||audit.receiverRevision!==revision||audit.paymentVerified!==false||
  !notice||audit.notificationId!==notice.id||claim?.orderId!==orderId||claim.notificationId!==notice.id||
  claim.flow!=="notification_first"||collision?.orderId!==orderId||collision.notificationId!==notice.id||
  audit.observationFingerprint!==fingerprint(notice)||!validNotice(notice,device,link,recipient,now)||
  relation(order,notice)!=="candidate")
   fail("OBSERVATION_NOT_CONFIRMED");
 if(!exact(envelope,["version","providerId","keyId","payload","signatureBase64"]))fail("ENVELOPE_INVALID");
 const signed=bytes(envelope),p=envelope.payload;
 if(p.tenantId!==tenantId||p.orderId!==orderId||p.notificationId!==notice.id||
  p.amountSatang!==amount||p.receiverRevision!==revision||p.accountFingerprint!==accountFingerprint(store,recipient))
   fail("EVIDENCE_SCOPE_MISMATCH");
 const posted=Date.parse(p.postedAt);
 // Match a bank posting to the original notice, not to the time of review.
 if(posted<created||posted>now||Math.abs(posted-notice.bankMs)>60000)fail("POSTING_TIME_MISMATCH");
 const key=validateHybridBankPinnedKey({trustedRegistry:registry,providerId:PROVIDER,keyId:envelope.keyId,
  postingAt:p.postedAt,checkedAt:new Date(now).toISOString()});
 const sig=envelope.signatureBase64;
 if(typeof sig!=="string"||!/^[A-Za-z0-9+/]{86}==$/.test(sig))fail("SIGNATURE_INVALID");
 const raw=Buffer.from(sig,"base64");
 if(raw.length!==64||raw.toString("base64")!==sig||!verify(null,signed,key,raw))fail("SIGNATURE_INVALID");
 return {status:"demo_evidence_preflight_passed",tenantId,orderId,notificationId:notice.id,amountSatang:amount,
  evidenceHash:hash(signed),referenceHash:hash(p.transactionReference),receiverRevision:revision,
  signatureCryptographicallyValid:true,realBankProviderAuthenticated:false,settlementAllowed:false,...flags};
}
module.exports={VERSION,PROVIDER,bytes,accountFingerprint,preflight};
