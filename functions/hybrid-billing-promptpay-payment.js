"use strict";

// Phase 3Q SOURCE-ONLY, UNEXPORTED candidate. No actual bank adapter or live
// payment endpoint is installed. Only server-side independent resolver outputs
// may ever enter this function; NEVER wire it to user/browser/slip fields.
const { createHash }=require("node:crypto");
const { Timestamp, FieldValue }=require("firebase-admin/firestore");
const { paidDeliverySale }=require("./hybrid-billing-orders");
const { prepareBankReceiptJournal }=require("./hybrid-billing-receipt-journal");

const ID=/^[A-Za-z0-9_-]{8,128}$/;
const REFERENCE=/^[A-Za-z0-9._/: -]{8,160}$/;
const HASH=/^[a-f0-9]{64}$/;
const SOURCE="hybrid_promptpay_bank_verified_server";
const referenceHash=ref=>createHash("sha256")
  .update("hybrid_v1:"+ref.trim().toUpperCase()).digest("hex");
function cents(n){
 if(typeof n!=="number" || !Number.isFinite(n) || n<0 || n>1e9
  || Math.abs(n*100-Math.round(n*100))>0.00001) return null;
 return Math.round(n*100);
}
function verifyPromptPayBankProof(proof,{tenantId,orderId,now}){
 // Independent bank record MUST be fetched by a privileged server adapter.
 // "verified:true" alone never establishes truth; resolver is NOT deployed.
 if(!proof || proof.verified!==true || proof.source!=="independent_bank_record"
   || proof.tenantId!==tenantId || proof.orderId!==orderId
   || proof.currency!=="THB" || proof.recipientConfirmed!==true
   || proof.platformBankAccountVerified!==true
   || typeof proof.reference!=="string" || !REFERENCE.test(proof.reference.trim())
   || !HASH.test(proof.evidenceSha256||"")
   || !Number.isSafeInteger(proof.grossAmountCents) || proof.grossAmountCents<=0
   || !(proof.paidAt instanceof Date) || !Number.isFinite(proof.paidAt.getTime())
   || proof.paidAt.getTime()<Date.UTC(2020,0,1) || proof.paidAt>now
   || !(proof.checkedAt instanceof Date) || !Number.isFinite(proof.checkedAt.getTime())
   || proof.checkedAt>now || now.getTime()-proof.checkedAt.getTime()>15*60*1000){
   throw Error("HYBRID_PROMPTPAY_INDEPENDENT_BANK_PROOF_REQUIRED");
 }
 return {referenceHash:referenceHash(proof.reference),
   evidenceSha256:proof.evidenceSha256,
   grossAmountCents:proof.grossAmountCents,paidAt:proof.paidAt};
}
/** SERVER-ONLY verified bank Payment Candidate. Never launch without
 * independently authenticated adapter + audited provider reconciliation.
 */
async function recordHybridVerifiedPromptPay({
 db,tenantId,orderId,reviewerUid,resolveIndependentBankPayment,
 now=new Date(),serverTimestamp=()=>FieldValue.serverTimestamp(),
}){
 if(!db || ![tenantId,orderId,reviewerUid].every(x=>typeof x==="string"&&ID.test(x))
   || !(now instanceof Date) || !Number.isFinite(now.getTime())){
   throw Error("HYBRID_PROMPTPAY_BAD_REQUEST");
 }
 if(typeof resolveIndependentBankPayment!=="function")
   throw Error("HYBRID_PROMPTPAY_BANK_ADAPTER_NOT_CONNECTED");
 const proof=verifyPromptPayBankProof(
   await resolveIndependentBankPayment({tenantId,orderId}),
   {tenantId,orderId,now});
 const tenantRef=db.collection("tenants").doc(tenantId);
 const orderRef=tenantRef.collection("orders").doc(orderId);
 const reviewerRef=db.collection("users").doc(reviewerUid);
 const bankRef=db.collection("platformHybridPaymentReferences").doc(proof.referenceHash);
 const eventRef=tenantRef.collection("hybridBillingReceiptEvents").doc("bank-"+orderId);
 return db.runTransaction(async tx=>{
   const [tenant,order,reviewer,bank,event]=await Promise.all([
     tx.get(tenantRef),tx.get(orderRef),tx.get(reviewerRef),tx.get(bankRef),tx.get(eventRef),
   ]);
   if(!reviewer.exists || reviewer.data()?.active!==true
       || reviewer.data()?.role!=="super_admin")
     throw Error("HYBRID_PROMPTPAY_SUPER_ADMIN_REQUIRED");
   if(!tenant.exists || tenant.data()?.billingPolicyVersion!=="hybrid_v1"
      || tenant.data()?.hybridBillingEnabled!==true
      || tenant.data()?.active!==true
      || tenant.data()?.hybridBillingSuspended===true
      || tenant.data()?.businessType==="retail")
     throw Error("HYBRID_PROMPTPAY_TENANT_NOT_ACTIVE");
   if(!order.exists) throw Error("HYBRID_PROMPTPAY_ORDER_MISSING");
   const o=order.data()||{};
   if(o.orderType!=="delivery" || o.paymentMethod!=="promptpay"
     || !["delivered","completed","served","paid"].includes(o.status)
     || !Array.isArray(o.items) || !o.items.length
     || cents(o.totalAmount)===null || cents(o.deliveryFee??0)===null
     || cents(o.subtotalAmount)===null || cents(o.totalAmount)<=0
     || cents(o.deliveryFee??0)>cents(o.totalAmount)
     || cents(o.totalAmount)!==proof.grossAmountCents)
     throw Error("HYBRID_PROMPTPAY_ORDER_PROOF_CONFLICT");
   const bankOwner=bank.data()||{};
   if(o.paymentStatus==="paid"){
     if(o.paymentReceiptSource!==SOURCE || !event.exists
        || event.data()?.tenantId!==tenantId || event.data()?.orderId!==orderId
        || event.data()?.referenceHash!==proof.referenceHash
        || event.data()?.evidenceSha256!==proof.evidenceSha256
        || o.paidAt?.toMillis?.()!==proof.paidAt.getTime()
        || !bank.exists || bankOwner.tenantId!==tenantId
        || bankOwner.orderId!==orderId || bankOwner.source!==SOURCE){
       throw Error("HYBRID_PROMPTPAY_EXISTING_PAYMENT_CONFLICT");
     }
     return {tenantId,orderId,alreadyPaid:true,source:SOURCE};
   }
   if(o.paymentStatus!=="unpaid" || event.exists)
     throw Error("HYBRID_PROMPTPAY_STATUS_CONFLICT");
   if(bank.exists) throw Error("HYBRID_PROMPTPAY_BANK_REFERENCE_ALREADY_USED");
   const stamp=Timestamp.fromDate(proof.paidAt);
   const sale=paidDeliverySale({...o,paymentStatus:"paid",paidAt:stamp});
   if(!sale || cents(sale.amount)===null || cents(sale.amount)<=0)
     throw Error("HYBRID_PROMPTPAY_INVALID_MERCHANDISE");
   // Transaction reads are completed before any writes. The journal helper
   // will read its shard fence and return deferred writes.
   const appendJournal=await prepareBankReceiptJournal({
     tx,tenantRef,tenantId,orderId,actorUid:reviewerUid,order:o,
     proof,serverTimestamp,
   });
   tx.create(bankRef,{tenantId,orderId,source:SOURCE,
     referenceHash:proof.referenceHash,evidenceSha256:proof.evidenceSha256,
     recordedAt:serverTimestamp()});
   tx.update(orderRef,{paymentStatus:"paid",paidAt:stamp,
     updatedAt:serverTimestamp(),paymentReceiptSource:SOURCE,
     paymentBankReferenceHash:proof.referenceHash,
     paymentEvidenceSha256:proof.evidenceSha256});
   appendJournal();
   return {tenantId,orderId,alreadyPaid:false,source:SOURCE};
 });
}
module.exports={verifyPromptPayBankProof,recordHybridVerifiedPromptPay};
