"use strict";
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {__internal:{context}}=require("./delivery-notification-match");
const {preflight}=require("./delivery-bank-reconcile-policy");
const {flags}=require("./delivery-notification-match-policy");
const {HEX,ID}=require("./payment-companion-policy");
const fail=(code,msg)=>{throw new HttpsError(code,msg);};
function parse(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||Object.keys(data).length!==2||
  typeof data.orderId!=="string"||!ID.test(data.orderId)||
  typeof data.evidenceId!=="string"||!HEX.test(data.evidenceId))
  fail("invalid-argument","DELIVERY_BANK_INPUT_INVALID");
 return data;
}
async function record(db,tx,c,{orderId,evidenceId}){
 const auditRef=c.root.collection("notificationFirstReviews").doc(orderId);
 const receiptRef=c.root.collection("notificationFirstBankPreflights").doc(orderId);
 const evidenceRef=db.collection("deliveryDemoBankEvidence").doc(evidenceId);
 const [orderSnap,auditSnap,receiptSnap,evidenceSnap,registrySnap,store,meta]=await Promise.all([
  tx.get(c.tenant.collection("orders").doc(orderId)),tx.get(auditRef),tx.get(receiptRef),tx.get(evidenceRef),
  tx.get(db.collection("deliveryDemoBankKeys").doc("registry")),
  tx.get(c.tenant.collection("settings").doc("store")),tx.get(c.root)]);
 const audit=auditSnap.data(),evidence=evidenceSnap.data();
 if(!audit||!HEX.test(audit.notificationId||"")||!HEX.test(audit.observationFingerprint||"")||
    evidence?.tenantId!==c.tenantId||evidence?.orderId!==orderId||evidence?.environment!=="demo")
  fail("failed-precondition","DELIVERY_BANK_EVIDENCE_UNAVAILABLE");
 const [claim,collision,noticeSnap]=await Promise.all([
  tx.get(c.root.collection("reviewClaims").doc(audit.notificationId)),
  tx.get(c.root.collection("notificationFirstObservationClaims").doc(audit.observationFingerprint)),
  tx.get(c.root.collection("notices").doc(audit.notificationId))]);
 const n=noticeSnap.data();
 if(!n||typeof n.deviceId!=="string"||!ID.test(n.deviceId))fail("failed-precondition","DELIVERY_BANK_NOTICE_UNAVAILABLE");
 const deviceSnap=await tx.get(c.root.collection("devices").doc(n.deviceId));
 let checked;
 try{checked=preflight({tenantId:c.tenantId,orderId,order:orderSnap.data(),audit,
  claim:claim.data(),collision:collision.data(),notice:{...n,id:noticeSnap.id},
  device:{...deviceSnap.data(),id:deviceSnap.id},store,link:meta.data()?.receiver,
  envelope:evidence.envelope,registry:registrySnap.data()?.providers});}
 catch(e){fail("failed-precondition",String(e.message||"DELIVERY_BANK_EVIDENCE_INVALID"));}
 const ref=db.collection("deliveryDemoBankReferenceClaims").doc(checked.referenceHash);
 // Same hash encoding as legacy Slip2Go reference index. Synthetic claims
 // remain separate and never contaminate operational finance collections.
 const [claimed,legacy]=await Promise.all([tx.get(ref),tx.get(db.collection("platformSlipUsedReferences").doc(checked.referenceHash))]);
 const prior=receiptSnap.data(),existing=claimed.data();
 if(legacy.exists)fail("failed-precondition","DELIVERY_BANK_REFERENCE_REUSED");
 if(prior){
  if(prior.evidenceId!==evidenceId||prior.evidenceHash!==checked.evidenceHash||
    prior.referenceHash!==checked.referenceHash||existing?.tenantId!==c.tenantId||
    existing?.orderId!==orderId||existing?.evidenceId!==evidenceId)
   fail("failed-precondition","DELIVERY_BANK_PREFLIGHT_CONFLICT");
  return {recorded:true,alreadyRecorded:true,status:checked.status,...flags,settlementAllowed:false};
 }
 if(claimed.exists)fail("failed-precondition","DELIVERY_BANK_REFERENCE_REUSED");
 tx.create(receiptRef,{...checked,evidenceId,recordedByUid:c.uid,recordedByRole:c.role,recordedAt:FieldValue.serverTimestamp()});
 tx.create(ref,{tenantId:c.tenantId,orderId,evidenceId,evidenceHash:checked.evidenceHash,recordedAt:FieldValue.serverTimestamp()});
 return {recorded:true,alreadyRecorded:false,status:checked.status,...flags,settlementAllowed:false};
}
exports.recordDeliveryDemoBankEvidencePreflight=onCall({region:"asia-southeast1",timeoutSeconds:30},async request=>{
 const data=parse(request.data),db=getFirestore();
 return db.runTransaction(async tx=>record(db,tx,await context(db,tx,request),data));
});
exports.__test={parse,record};
