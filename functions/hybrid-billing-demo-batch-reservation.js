"use strict";
// Phase3AG source-only DEMO reservation of synthetic Lalamove batch proof shapes.
// GLOBAL reference and order locks are candidates, NEVER real bank settlement,
// trustworthy attestation, payment receipt, financial journal, or invoice.
const {FieldValue}=require("firebase-admin/firestore");
const {assertHybridEpochDemoOptIn}=require("./hybrid-billing-writer-epoch-candidate");
const {previewHybridLalamoveCodBatch}=require("./hybrid-billing-lalamove-batch-preview");
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const SHA=/^[a-f0-9]{64}$/;
const money=x=>typeof x==="number"&&Number.isFinite(x)
  &&Math.abs(x*100-Math.round(x*100))<=0.00001?Math.round(x*100):null;
async function reserveHybridDemoCodBatchCandidate({
 db,tenantId,batchId,orderIds,reviewerUid,
 resolveProviderBatch,resolveIndependentBankCredit,now
}={}){
 assertHybridEpochDemoOptIn(true);
 const preview=await previewHybridLalamoveCodBatch({
  db,tenantId,batchId,orderIds,reviewerUid,
  resolveProviderBatch,resolveIndependentBankCredit,now
 });
 if(!SHA.test(preview.witnessDigest||"")
   ||!SHA.test(preview.transferReferenceSha256||"")
   ||preview.canMarkPaid!==false||preview.coverageCertified!==false
   ||preview.orderCount<2||preview.orderCount>20)
   throw Error("HYBRID_DEMO_BATCH_PREVIEW_UNSAFE");
 const t=db.collection("tenants").doc(tenantId);
 const candidate=t.collection("hybridBillingDemoCodBatchCandidates").doc(batchId);
 const transfer=db.collection("hybridBillingDemoBatchTransferClaims")
   .doc(preview.transferReferenceSha256);
 const user=db.collection("users").doc(reviewerUid);
 const lines=preview.allocations.map(a=>({
  info:a,order:t.collection("orders").doc(a.orderId),
  proof:t.collection("hybridLalamoveCodCompletionProof").doc(a.orderId),
  claim:t.collection("hybridBillingDemoCodOrderClaims").doc(a.orderId)
 }));
 return db.runTransaction(async tx=>{
  const [tenant,actor,oldCandidate,oldTransfer,...lookups]=await Promise.all([
   tx.get(t),tx.get(user),tx.get(candidate),tx.get(transfer),
   ...lines.flatMap(x=>[tx.get(x.order),tx.get(x.proof),tx.get(x.claim)])
  ]);
  if(!actor.exists||actor.data()?.role!=="super_admin"
    ||actor.data()?.active!==true)
    throw Error("HYBRID_DEMO_BATCH_SUPER_ADMIN_REQUIRED");
  if(!tenant.exists||tenant.data()?.billingPolicyVersion!=="hybrid_v1"
    ||tenant.data()?.hybridBillingEnabled!==true
    ||tenant.data()?.active!==true||tenant.data()?.hybridBillingSuspended===true)
    throw Error("HYBRID_DEMO_BATCH_TENANT_NOT_READY");
  const claims=[];
  for(let i=0;i<lines.length;i++){
   const l=lines[i],o=lookups[i*3],proof=lookups[i*3+1],
     claim=lookups[i*3+2],info=l.info;
   if(!o.exists||!proof.exists
     ||o.data()?.orderType!=="delivery"||o.data()?.paymentStatus!=="unpaid"
     ||o.data()?.paymentMethod!=="cod"||o.data()?.deliveryProvider!=="lalamove"
     ||o.data()?.lalamoveCodEnabled!==true
     ||o.data()?.lalamoveOrderId!==info.providerOrderId
     ||money(o.data()?.totalAmount)!==info.collectedCodCents
     ||proof.data()?.status!=="delivery_verified_settlement_pending"
     ||proof.data()?.deliveryVerified!==true
     ||proof.data()?.codSettlementVerified!==false
     ||proof.data()?.bankReconciled!==false
     ||proof.data()?.tenantId!==tenantId
     ||proof.data()?.orderId!==info.orderId
     ||proof.data()?.providerOrderId!==info.providerOrderId
     ||proof.data()?.eventHash!==info.deliveryEvidenceDigest)
     throw Error("HYBRID_DEMO_BATCH_ORDER_CHANGED");
   claims.push({ref:l.claim,snapshot:claim});
  }
  const prev=oldCandidate.exists?oldCandidate.data():null;
  const transferData=oldTransfer.exists?oldTransfer.data():null;
  const existingClaims=claims.filter(x=>x.snapshot.exists);
  if(prev||transferData||existingClaims.length){
   if(!prev||!transferData||existingClaims.length!==lines.length
     ||prev.witnessDigest!==preview.witnessDigest
     ||prev.transferReferenceSha256!==preview.transferReferenceSha256
     ||prev.status!=="pending_independent_review"
     ||prev.candidateOnly!==true||prev.canMarkPaid!==false
     ||transferData.tenantId!==tenantId||transferData.batchId!==batchId
     ||transferData.witnessDigest!==preview.witnessDigest
     ||claims.some(x=>x.snapshot.data()?.batchId!==batchId
       ||x.snapshot.data()?.witnessDigest!==preview.witnessDigest
       ||x.snapshot.data()?.candidateOnly!==true))
      throw Error("HYBRID_DEMO_BATCH_REFERENCE_OR_ORDER_REPLAY");
   return {tenantId,batchId,alreadyReserved:true,pending:true,
     canMarkPaid:false,canIssueInvoice:false,coverageCertified:false};
  }
  const createdAt=FieldValue.serverTimestamp();
  tx.create(candidate,{tenantId,batchId,witnessDigest:preview.witnessDigest,
   transferReferenceSha256:preview.transferReferenceSha256,
   orderIds:preview.allocations.map(x=>x.orderId),
   allocationDigest:preview.witnessDigest,
   collectedCodCents:preview.collectedCodCents,
   providerFeeCents:preview.providerFeeCents,
   matchedPostedCreditCents:preview.matchedPostedCreditCents,
   status:"pending_independent_review",candidateOnly:true,
   sourceAttested:false,bankCreditVerified:false,
   settlementPosted:false,paidOrdersChanged:false,
   canMarkPaid:false,canIssueInvoice:false,coverageCertified:false,
   createdAt});
  tx.create(transfer,{tenantId,batchId,witnessDigest:preview.witnessDigest,
   candidateOnly:true,createdAt});
  for(const x of claims){
   tx.create(x.ref,{tenantId,batchId,witnessDigest:preview.witnessDigest,
     candidateOnly:true,createdAt});
  }
  return {tenantId,batchId,alreadyReserved:false,pending:true,
   canMarkPaid:false,canIssueInvoice:false,coverageCertified:false};
 });
}
module.exports={reserveHybridDemoCodBatchCandidate};
