"use strict";

// UNEXPORTED. Append an independently SETTLED refund after the first legacy
// refund-{orderId} anchor. Bounded immutable chain; no bank payout/AR/tax note.
const {FieldValue,Timestamp}=require("firebase-admin/firestore");
const {verifyIndependentRefund}=require("./hybrid-billing-refund-reversal");
const {paidDeliverySale}=require("./hybrid-billing-orders");
const {dateKey}=require("./hybrid-billing-core");
const {journalReceiptIssue,loadRefundChain,refundAnchorDigest,refundPartDigest,
 partRefFor,chainRefFor,MAX_REFUND_CHAIN,shardOf}=require("./hybrid-billing-receipt-journal");
const {assertHybridEpochDemoOptIn,requireHybridEpochAdmissionCandidate}=require("./hybrid-billing-writer-epoch-candidate");
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const SOURCE="hybrid_refund_bank_verified_server";
const cents=n=>typeof n==="number"&&Number.isFinite(n)&&n>=0
  &&n<=1e9&&Math.abs(n*100-Math.round(n*100))<0.00001?Math.round(n*100):null;
async function appendHybridVerifiedPartialRefund({db,tenantId,orderId,reviewerUid,
 resolveIndependentRefund,now=new Date(),serverTimestamp=()=>FieldValue.serverTimestamp(),
 epochAdmissionDemo=false}){
 assertHybridEpochDemoOptIn(epochAdmissionDemo);
 if(!db||![tenantId,orderId,reviewerUid].every(x=>typeof x==="string"&&ID.test(x))
    ||!(now instanceof Date)||!Number.isFinite(now.getTime()))
   throw Error("HYBRID_PARTIAL_REFUND_BAD_REQUEST");
 if(typeof resolveIndependentRefund!=="function")
   throw Error("HYBRID_PARTIAL_REFUND_PROVIDER_NOT_CONNECTED");
 const proof=verifyIndependentRefund(await resolveIndependentRefund({tenantId,orderId}),
   {tenantId,orderId,now});
 const t=db.collection("tenants").doc(tenantId),oRef=t.collection("orders").doc(orderId);
 const userRef=db.collection("users").doc(reviewerUid);
 const claimRef=db.collection("platformHybridPaymentReferences").doc(proof.referenceHash);
 const firstRef=t.collection("hybridBillingReceiptEvents").doc("refund-"+orderId);
 const chainRef=chainRefFor(t,orderId);
 const fenceRef=t.collection("hybridBillingReceiptFences").doc(
   "shard-"+String(shardOf(orderId)).padStart(2,"0"));
 return db.runTransaction(async tx=>{
   const [tenant,os,user,claim,first,headSnap,fence]=await Promise.all([
     tx.get(t),tx.get(oRef),tx.get(userRef),tx.get(claimRef),
     tx.get(firstRef),tx.get(chainRef),tx.get(fenceRef)]);
   if(!user.exists||user.data()?.role!=="super_admin"||user.data()?.active!==true)
     throw Error("HYBRID_PARTIAL_REFUND_SUPER_ADMIN_REQUIRED");
   if(!tenant.exists||tenant.data()?.billingPolicyVersion!=="hybrid_v1"
     ||tenant.data()?.hybridBillingEnabled!==true||tenant.data()?.active!==true
     ||tenant.data()?.hybridBillingSuspended===true)
     throw Error("HYBRID_PARTIAL_REFUND_TENANT_NOT_ACTIVE");
   const order=os.data()||{};
   if(!os.exists||order.orderType!=="delivery"||order.paymentStatus!=="paid"
     ||!["hybrid_cod_cashier_server","hybrid_promptpay_bank_verified_server"]
       .includes(order.paymentReceiptSource)
     ||order.refundReceiptSource!==SOURCE||!first.exists)
     throw Error("HYBRID_PARTIAL_REFUND_FIRST_VERIFIED_REFUND_REQUIRED");
   const originalRef=t.collection("hybridBillingReceiptEvents").doc(
     (order.paymentReceiptSource==="hybrid_cod_cashier_server"?"cod-":"bank-")+orderId);
   const original=await tx.get(originalRef);
   if(!original.exists)throw Error("HYBRID_PARTIAL_REFUND_MISSING_PAYMENT_JOURNAL");
   const chain=await loadRefundChain(ref=>tx.get(ref),t,orderId,order);
   let integrity;
   try{integrity=journalReceiptIssue(orderId,order,original.data(),tenantId,
     first.data(),chain)}
   catch{integrity="corrupted";}
   if(integrity)throw Error("HYBRID_PARTIAL_REFUND_CHAIN_INTEGRITY:"+integrity);
   const count=order.refundChainCount||1;
   const base=first.data(),anchor=refundAnchorDigest(base);
   const prior=chain?.parts?.at(-1)||base;
   const previousDigest=chain?.head?.headDigest||anchor;
   const previousAt=prior.refundAt?.toMillis?.();
   const recordedAt=proof.refundAt.getTime();
   const oldCents=cents(order.refundTotal);
   if(oldCents===null)throw Error("HYBRID_PARTIAL_REFUND_INVALID_TOTAL");
   const ownership=claim.data()||{};
   // Revalidate the COMPLETE immutable chain BEFORE allowing a retry. Do not
   // apply the new-amount limit or next-sequence cap to an unchanged replay.
   if(claim.exists){
     const replay=chain?.parts?.find(e=>e?.sequence===ownership.refundSequence
       && e.referenceHash===proof.referenceHash
       && e.evidenceSha256===proof.evidenceSha256
       && e.refundCents===proof.refundAmountCents
       && e.refundAt?.toMillis?.()===recordedAt);
     if(replay&&ownership.tenantId===tenantId&&ownership.orderId===orderId
       &&ownership.source===SOURCE && ownership.refundSequence===replay.sequence)
       return {tenantId,orderId,alreadyRecorded:true,sequence:replay.sequence,
         cumulativeRefundCents:oldCents,refundInitiated:false,invoiceApplied:false};
     throw Error("HYBRID_PARTIAL_REFUND_REFERENCE_ALREADY_USED");
   }
   if(count>=MAX_REFUND_CHAIN)throw Error("HYBRID_PARTIAL_REFUND_CHAIN_LIMIT");
   if(!Number.isSafeInteger(previousAt)||recordedAt<previousAt)
     throw Error("HYBRID_PARTIAL_REFUND_NONMONOTONIC_DATE");
   const baseMerchandise=original.data().merchandiseCents;
   const total=oldCents+proof.refundAmountCents;
   if(!Number.isSafeInteger(total)||total>baseMerchandise)
     throw Error("HYBRID_PARTIAL_REFUND_OVERREFUND");
   const seq=count+1,evRef=partRefFor(t,orderId,seq);
   const existing=await tx.get(evRef);
   if(existing.exists)throw Error("HYBRID_PARTIAL_REFUND_EVENT_CONFLICT");
   const stamp=Timestamp.fromDate(proof.refundAt);
   const event={tenantId,orderId,source:SOURCE,sequence:seq,
     previousDigest,shard:shardOf(orderId),sourceDay:dateKey(proof.refundAt),
     currency:"THB",actorUid:reviewerUid,
     originalMerchandiseCents:baseMerchandise,
     refundCents:proof.refundAmountCents,cumulativeCents:total,
     referenceHash:proof.referenceHash,evidenceSha256:proof.evidenceSha256,
     refundAt:stamp};
   event.digest=refundPartDigest(event);
   if(!event.digest)throw Error("HYBRID_PARTIAL_REFUND_EVENT_INVALID");
   const version=fence.exists?fence.data()?.version:0;
   if(!Number.isSafeInteger(version)||version<0||version>=Number.MAX_SAFE_INTEGER)
     throw Error("HYBRID_PARTIAL_REFUND_FENCE_INVALID");
   if(epochAdmissionDemo)await requireHybridEpochAdmissionCandidate({
     tx,tenantRef:t,sourceKey:"refund_partial"});
   const stampServer=serverTimestamp();
   tx.create(claimRef,{tenantId,orderId,source:SOURCE,
     refundSequence:seq,referenceHash:proof.referenceHash,
     evidenceSha256:proof.evidenceSha256,recordedAt:stampServer});
   tx.create(evRef,{...event,createdAt:stampServer});
   const head={tenantId,orderId,count:seq,anchorDigest:anchor,
     headDigest:event.digest,totalRefundCents:total,
     originalMerchandiseCents:baseMerchandise,lastRefundAt:stamp,
     lastReferenceHash:proof.referenceHash,updatedAt:stampServer};
   if(headSnap.exists)tx.update(chainRef,head);
   else tx.create(chainRef,{...head,createdAt:stampServer});
   tx.update(oRef,{refundTotal:total/100,refundChainCount:seq,
     refundChainHeadDigest:event.digest,refundBankReferenceHash:proof.referenceHash,
     refundEvidenceSha256:proof.evidenceSha256,refundSettledAt:stamp,
     updatedAt:stampServer});
   if(fence.exists)tx.update(fenceRef,{version:version+1,updatedAt:stampServer});
   else tx.create(fenceRef,{version:1,shard:shardOf(orderId),updatedAt:stampServer});
   return {tenantId,orderId,alreadyRecorded:false,sequence:seq,
     cumulativeRefundCents:total,refundInitiated:false,invoiceApplied:false};
 });
}
module.exports={appendHybridVerifiedPartialRefund};
