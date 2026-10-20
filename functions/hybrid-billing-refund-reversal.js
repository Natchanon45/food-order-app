"use strict";
// INTERNAL, UNEXPORTED. Records proof of a refund ALREADY SETTLED by an
// independently verified bank. Does NOT initiate refund, offset AR or amend
// immutable invoices. Limited to ONE refund per order until chained refunds
// have a reviewed design. No real bank provider adapter connected.
const {createHash}=require("node:crypto");
const {Timestamp,FieldValue}=require("firebase-admin/firestore");
const {paidDeliverySale}=require("./hybrid-billing-orders");
const {journalReceiptIssue,prepareRefundJournal}=require("./hybrid-billing-receipt-journal");
const {assertHybridEpochDemoOptIn,requireHybridEpochAdmissionCandidate}=require("./hybrid-billing-writer-epoch-candidate");
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const REFERENCE=/^[A-Za-z0-9._/: -]{8,160}$/;
const SHA=/^[a-f0-9]{64}$/;
const SOURCE="hybrid_refund_bank_verified_server";
const cents=n=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=1e9
 &&Math.abs(n*100-Math.round(n*100))<0.00001?Math.round(n*100):null;
const hash=s=>createHash("sha256").update("hybrid_v1:"+s.trim().toUpperCase()).digest("hex");
function verifyIndependentRefund(proof,{tenantId,orderId,now}){
 if(!proof||proof.source!=="independent_bank_refund_record"||proof.verified!==true
  ||proof.tenantId!==tenantId||proof.orderId!==orderId||proof.currency!=="THB"
  ||proof.refundSettled!==true||proof.recipientConfirmed!==true
  ||proof.platformDebitConfirmed!==true
  ||typeof proof.reference!=="string"||!REFERENCE.test(proof.reference.trim())
  ||!SHA.test(proof.evidenceSha256||"")
  ||!Number.isSafeInteger(proof.refundAmountCents)||proof.refundAmountCents<=0
  ||!(proof.refundAt instanceof Date)||!Number.isFinite(proof.refundAt.getTime())
  ||proof.refundAt.getTime()<Date.UTC(2020,0,1)||proof.refundAt>now
  ||!(proof.checkedAt instanceof Date)||!Number.isFinite(proof.checkedAt.getTime())
  ||proof.checkedAt>now||now.getTime()-proof.checkedAt.getTime()>15*60*1000)
    throw Error("HYBRID_REFUND_INDEPENDENT_SETTLEMENT_PROOF_REQUIRED");
 return {refundAt:proof.refundAt,refundAmountCents:proof.refundAmountCents,
  referenceHash:hash(proof.reference),evidenceSha256:proof.evidenceSha256};
}
async function recordHybridVerifiedRefund({db,tenantId,orderId,reviewerUid,
 resolveIndependentRefund,now=new Date(),
 serverTimestamp=()=>FieldValue.serverTimestamp(),
 epochAdmissionDemo=false}){
 assertHybridEpochDemoOptIn(epochAdmissionDemo);
 if(!db||![tenantId,orderId,reviewerUid].every(x=>typeof x==="string"&&ID.test(x))
  ||!(now instanceof Date)||!Number.isFinite(now.getTime()))
    throw Error("HYBRID_REFUND_BAD_REQUEST");
 if(typeof resolveIndependentRefund!=="function")
    throw Error("HYBRID_REFUND_PROVIDER_NOT_CONNECTED");
 const proof=verifyIndependentRefund(await resolveIndependentRefund({tenantId,orderId}),
  {tenantId,orderId,now});
 const t=db.collection("tenants").doc(tenantId);
 const oref=t.collection("orders").doc(orderId);
 const actor=db.collection("users").doc(reviewerUid);
 // SAME globally claimed reference namespace as other bank payments/settlements.
 const claimRef=db.collection("platformHybridPaymentReferences").doc(proof.referenceHash);
 const refundRef=t.collection("hybridBillingReceiptEvents").doc("refund-"+orderId);
 return db.runTransaction(async tx=>{
  const [tenant,order,user,claim,refund]=await Promise.all([
    tx.get(t),tx.get(oref),tx.get(actor),tx.get(claimRef),tx.get(refundRef)]);
  if(!user.exists||user.data()?.role!=="super_admin"||user.data()?.active!==true)
     throw Error("HYBRID_REFUND_SUPER_ADMIN_REQUIRED");
  if(!tenant.exists||tenant.data()?.billingPolicyVersion!=="hybrid_v1"
     ||tenant.data()?.hybridBillingEnabled!==true||tenant.data()?.active!==true
     ||tenant.data()?.hybridBillingSuspended===true)
     throw Error("HYBRID_REFUND_TENANT_NOT_ACTIVE");
  const o=order.data()||{};
  if(!order.exists||o.orderType!=="delivery"||o.paymentStatus!=="paid"
    ||!["hybrid_cod_cashier_server","hybrid_promptpay_bank_verified_server"]
       .includes(o.paymentReceiptSource)
    ||!(o.paidAt?.toDate?.() instanceof Date)
    ||cents(o.totalAmount)===null||cents(o.deliveryFee??0)===null)
     throw Error("HYBRID_REFUND_ORIGINAL_NOT_TRUSTED");
  const paidRef=t.collection("hybridBillingReceiptEvents").doc(
    (o.paymentReceiptSource==="hybrid_cod_cashier_server"?"cod-":"bank-")+orderId);
  const paid=await tx.get(paidRef);
  if(!paid.exists)throw Error("HYBRID_REFUND_ORIGINAL_JOURNAL_MISSING");
  // A refund cannot have settled before its original trusted payment.
  if(proof.refundAt.getTime()<o.paidAt.toDate().getTime())
     throw Error("HYBRID_REFUND_BEFORE_ORIGINAL_PAYMENT");
  const previous=refund.data()||{},owned=claim.data()||{};
  if(refund.exists){
    let invalid;
    try{invalid=journalReceiptIssue(orderId,o,paid.data(),tenantId,previous)}
    catch{invalid="corrupted"};
    if(invalid||o.refundReceiptSource!==SOURCE
      ||o.refundBankReferenceHash!==proof.referenceHash
      ||o.refundEvidenceSha256!==proof.evidenceSha256
      ||cents(o.refundTotal)!==proof.refundAmountCents
      ||previous.refundCents!==proof.refundAmountCents
      ||previous.refundAt?.toMillis?.()!==proof.refundAt.getTime()
      ||!claim.exists||owned.source!==SOURCE||owned.tenantId!==tenantId
      ||owned.orderId!==orderId)
      throw Error("HYBRID_REFUND_EXISTING_CONFLICT");
    return {tenantId,orderId,alreadyRecorded:true,refundCents:proof.refundAmountCents,
       refundInitiated:false,invoiceApplied:false};
  }
  if(claim.exists)throw Error("HYBRID_REFUND_REFERENCE_ALREADY_USED");
  if(o.refundReceiptSource||cents(o.refundTotal??0)!==0
     ||cents(o.refundedAmount??0)!==0||cents(o.refundAmount??0)!==0)
    throw Error("HYBRID_REFUND_MULTIPLE_OR_UNVERIFIED_NOT_SUPPORTED");
  let invalid;
  try{invalid=journalReceiptIssue(orderId,o,paid.data(),tenantId)}
  catch{invalid="corrupted"};
  if(invalid)throw Error("HYBRID_REFUND_ORIGINAL_JOURNAL_INVALID");
  const sale=paidDeliverySale(o),originalNet=sale?cents(sale.amount):null;
  if(originalNet===null||originalNet<=0||proof.refundAmountCents>originalNet)
     throw Error("HYBRID_REFUND_AMOUNT_EXCEEDS_MERCHANDISE");
  const apply=await prepareRefundJournal({tx,tenantRef:t,tenantId,orderId,
    actorUid:reviewerUid,proof,originalNet,serverTimestamp});
  if(epochAdmissionDemo)await requireHybridEpochAdmissionCandidate({
    tx,tenantRef:t,sourceKey:"refund_initial"});
  tx.create(claimRef,{tenantId,orderId,source:SOURCE,
    referenceHash:proof.referenceHash,evidenceSha256:proof.evidenceSha256,
    recordedAt:serverTimestamp()});
  tx.update(oref,{refundTotal:proof.refundAmountCents/100,
    refundReceiptSource:SOURCE,refundBankReferenceHash:proof.referenceHash,
    refundEvidenceSha256:proof.evidenceSha256,
    refundSettledAt:Timestamp.fromDate(proof.refundAt),
    updatedAt:serverTimestamp()});
  apply();
  return {tenantId,orderId,alreadyRecorded:false,refundCents:proof.refundAmountCents,
    refundInitiated:false,invoiceApplied:false};
 });
}
module.exports={verifyIndependentRefund,recordHybridVerifiedRefund};
