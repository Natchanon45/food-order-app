"use strict";
// Phase3AJ read-only quarantine inventory for legacy, non-canonical paidAt.
// Does not parse ISO strings into trusted timestamps or patch historic orders.
// Paged lookups are not atomic; findings are advisory, NEVER invoice eligibility.
const {createHash}=require("node:crypto");
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
function classifyPaidAt(row){
 if(!row||row.orderType!=="delivery"||row.paymentStatus!=="paid")
  return "outside_paid_delivery";
 const value=row.paidAt;
 if(value&&typeof value.toMillis==="function"
  &&Number.isSafeInteger(value.toMillis())
  &&value.toMillis()>=Date.UTC(2020,0,1))
  return "canonical_timestamp_unverified_source";
 if(typeof value==="string")return "legacy_string_requires_independent_review";
 if(value===null||value===undefined)return "missing_timestamp_requires_independent_review";
 return "invalid_timestamp_requires_independent_review";
}
async function previewHybridLegacyPaidAtQuarantineCandidate({
 db,tenantId,reviewerUid,pageSize=30,maxRows=300
}={}){
 if(!db||![tenantId,reviewerUid].every(v=>ID.test(String(v||"")))
  ||!Number.isInteger(pageSize)||pageSize<1||pageSize>50
  ||!Number.isInteger(maxRows)||maxRows<1||maxRows>300)
  throw Error("HYBRID_PAIDAT_QUARANTINE_INVALID_REQUEST");
 const t=db.collection("tenants").doc(tenantId);
 const [tenant,reviewer]=await Promise.all([t.get(),db.collection("users").doc(reviewerUid).get()]);
 if(!reviewer.exists||reviewer.data()?.role!=="super_admin"
  ||reviewer.data()?.active!==true)
  throw Error("HYBRID_PAIDAT_QUARANTINE_SUPER_ADMIN_REQUIRED");
 if(!tenant.exists||tenant.data()?.hybridBillingEnabled!==true
  ||tenant.data()?.billingPolicyVersion!=="hybrid_v1")
  throw Error("HYBRID_PAIDAT_QUARANTINE_NOT_HYBRID");
 let cursor=null,scanned=0,pages=0;const exceptions=[];
 while(true){
  const limit=Math.min(pageSize,maxRows-scanned+1);
  let q=t.collection("orders").where("orderType","==","delivery")
   .where("paymentStatus","==","paid").orderBy("__name__").limit(limit);
  if(cursor)q=q.startAfter(cursor);
  const snap=await q.get();
  if(!Array.isArray(snap.docs)||snap.size!==snap.docs.length
   ||snap.size>limit)throw Error("HYBRID_PAIDAT_QUARANTINE_INCOMPLETE");
  if(scanned+snap.size>maxRows)throw Error("HYBRID_PAIDAT_QUARANTINE_LIMIT");
  for(const doc of snap.docs){
   const reason=classifyPaidAt(doc.data());
   if(reason!=="canonical_timestamp_unverified_source")
    exceptions.push({orderId:doc.id,reason});
  }
  scanned+=snap.size;pages++;
  if(snap.size<limit)break;
  cursor=snap.docs.at(-1);
 }
 exceptions.sort((a,b)=>a.orderId.localeCompare(b.orderId,"en"));
 return {tenantId,scanned,pages,exceptions,
  quarantineRequired:exceptions.length>0,
  advisoryDigest:hash(["hybrid_paidat_quarantine_v1",tenantId,scanned,exceptions]),
  historicalPaymentsRepaired:false,providerEvidenceVerified:false,
  runtimeWriterCoverageProven:false,coverageCertified:false,
  canIssueInvoice:false,sourceCompletenessProven:false,
  note:"read_only_limited_nonatomic_original_paidAt_unchanged"};
}
module.exports={classifyPaidAt,previewHybridLegacyPaidAtQuarantineCandidate};
