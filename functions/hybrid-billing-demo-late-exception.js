"use strict";
// Phase3AF: SOURCE-ONLY, UNEXPORTED, isolated DEMO Firestore candidate.
// This is a PENDING late-evidence EXCEPTION, not settlement, invoice, credit
// note, posted money, authenticated bank proof, or globally enforced routing.
const {createHash}=require("node:crypto");
const {FieldValue}=require("firebase-admin/firestore");
const {dateKey}=require("./hybrid-billing-core");
const {assertHybridEpochDemoOptIn}=require("./hybrid-billing-writer-epoch-candidate");
const {recheckHybridFrozenDayManifestCandidate}=
  require("./hybrid-billing-demo-day-manifest");
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const SHA=/^[a-f0-9]{64}$/;
const TYPES=new Set(["lalamove_cod_paid_out","promptpay_bank_posted","bank_refund_posted"]);
const hash=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
function validDay(day){
 if(typeof day!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
 const d=new Date(day+"T00:00:00Z");
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===day;
}
function exceptionPlan({tenantId,originalDay,bookingDay,sourceType,
 sourceAt,postedAt,amountCents,referenceHash,sourceEvidenceSha256,postedEvidenceSha256}={}){
 if(!ID.test(String(tenantId||""))||!validDay(originalDay)
  ||!validDay(bookingDay)||bookingDay<=originalDay||!TYPES.has(sourceType)
  ||!(sourceAt instanceof Date)||!Number.isFinite(sourceAt.getTime())
  ||!(postedAt instanceof Date)||!Number.isFinite(postedAt.getTime())
  ||sourceAt>postedAt||dateKey(sourceAt)!==originalDay
  ||dateKey(postedAt)!==bookingDay
  ||!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>100000000000
  ||![referenceHash,sourceEvidenceSha256,postedEvidenceSha256]
      .every(v=>typeof v==="string"&&SHA.test(v))
  ||sourceEvidenceSha256===postedEvidenceSha256)
    throw Error("HYBRID_DEMO_LATE_INVALID_SOURCE_DAYS_OR_PROOF");
 const key=hash(["hybrid_demo_late_ref_v1",referenceHash]);
 const sourceAtMillis=sourceAt.getTime(),postedAtMillis=postedAt.getTime();
 const payload={tenantId,originalDay,bookingDay,sourceType,sourceAtMillis,
  postedAtMillis,amountCents,referenceHash,sourceEvidenceSha256,postedEvidenceSha256};
 return {key,payload,planDigest:hash(["hybrid_demo_late_pending_v1",payload])};
}
async function recordHybridDemoLateExceptionCandidate({
 db,reviewerUid,tenantId,originalDay,bookingDay,sourceType,
 sourceAt,postedAt,amountCents,referenceHash,sourceEvidenceSha256,
 postedEvidenceSha256
}={}){
 // No caller in production may enable this through input or index.js.
 assertHybridEpochDemoOptIn(true);
 if(!db||!ID.test(String(reviewerUid||"")))
   throw Error("HYBRID_DEMO_LATE_BAD_REQUEST");
 const plan=exceptionPlan({tenantId,originalDay,bookingDay,sourceType,
   sourceAt,postedAt,amountCents,referenceHash,sourceEvidenceSha256,
   postedEvidenceSha256});
 // Independently re-scan all paid journals before proposing an exception;
 // this is STILL non-atomic across pages and not global enforcement.
 const checked=await recheckHybridFrozenDayManifestCandidate({
   db,tenantId,day:originalDay
 });
 if(checked.unchanged!==true||!SHA.test(checked.candidateDigest))
   throw Error("HYBRID_DEMO_LATE_MANIFEST_UNVERIFIED");
 const t=db.collection("tenants").doc(tenantId);
 const event=t.collection("hybridBillingLateExceptionCandidates").doc(plan.key);
 const claim=db.collection("hybridBillingDemoLateReferenceClaims").doc(plan.key);
 const manifest=t.collection("hybridBillingDayManifestCandidates").doc(originalDay);
 const cutoff=t.collection("hybridBillingDayCutoffCandidates").doc(originalDay);
 const actor=db.collection("users").doc(reviewerUid);
 return db.runTransaction(async tx=>{
   const [tenantSnap,actorSnap,manifestSnap,daySnap,existing,claimed]=await Promise.all([
     tx.get(t),tx.get(actor),tx.get(manifest),tx.get(cutoff),
     tx.get(event),tx.get(claim)
   ]);
   if(!actorSnap.exists||actorSnap.data()?.role!=="super_admin"
     ||actorSnap.data()?.active!==true)
     throw Error("HYBRID_DEMO_LATE_SUPER_ADMIN_REQUIRED");
   if(!tenantSnap.exists||tenantSnap.data()?.hybridBillingEnabled!==true
     ||tenantSnap.data()?.billingPolicyVersion!=="hybrid_v1")
     throw Error("HYBRID_DEMO_LATE_NOT_HYBRID");
   const m=manifestSnap.exists?manifestSnap.data():null;
   if(!m||m.candidateOnly!==true||m.candidateDigest!==checked.candidateDigest
     ||m.coverageCertified!==false||m.canIssueInvoice!==false
     ||daySnap.data()?.status!=="sealed"
     ||daySnap.data()?.candidateOnly!==true)
     throw Error("HYBRID_DEMO_LATE_MANIFEST_CHANGED");
   const prior=existing.exists?existing.data():null;
   const lock=claimed.exists?claimed.data():null;
   if(prior||lock){
     if(!prior||!lock||prior.planDigest!==plan.planDigest
       ||prior.originalManifestDigest!==checked.candidateDigest
       ||lock.tenantId!==tenantId||lock.planDigest!==plan.planDigest
       ||lock.eventPath!==event.path||prior.status!=="pending_independent_review"
       ||prior.candidateOnly!==true||prior.canIssueInvoice!==false)
       throw Error("HYBRID_DEMO_LATE_REFERENCE_REPLAY_OR_TAMPER");
     return {id:plan.key,alreadyRecorded:true,pending:true,
       coverageCertified:false,canIssueInvoice:false};
   }
   tx.create(event,{...plan.payload,planDigest:plan.planDigest,
     originalManifestDigest:checked.candidateDigest,reviewerUid,
     status:"pending_independent_review",candidateOnly:true,
     sourceAttested:false,bankCreditVerified:false,
     settlementPosted:false,financialDayReopened:false,
     coverageCertified:false,canIssueInvoice:false,
     createdAt:FieldValue.serverTimestamp()});
   tx.create(claim,{tenantId,eventPath:event.path,planDigest:plan.planDigest,
     candidateOnly:true,createdAt:FieldValue.serverTimestamp()});
   return {id:plan.key,alreadyRecorded:false,pending:true,
     coverageCertified:false,canIssueInvoice:false};
 });
}
module.exports={exceptionPlan,recordHybridDemoLateExceptionCandidate};
