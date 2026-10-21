"use strict";
// Phase 3Y SOURCE-ONLY. Read-only paid Delivery source inventory.
// This is a source-coverage RISK REPORT, never a proof of all writers.
// Does NOT enumerate unpaid/pending/refund/bank streams or prove authenticated provenance.
// NEVER export via functions/index.js and NEVER set a tenant readiness flag.
const {createHash}=require("node:crypto");
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const TRUSTED=new Set(["hybrid_cod_cashier_server",
 "hybrid_promptpay_bank_verified_server"]);
const MAX_ROWS=10000,MAX_PAGE=200;
const hash=s=>createHash("sha256").update(JSON.stringify(s)).digest("hex");
async function inspectHybridPaidWriterSourcesCandidate({
 db,tenantId,pageSize=200,maxRows=MAX_ROWS
}){
 if(!db||!ID.test(String(tenantId||""))||!Number.isSafeInteger(pageSize)
   ||pageSize<1||pageSize>MAX_PAGE
   ||!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>MAX_ROWS)
   throw Error("HYBRID_SOURCE_INVENTORY_BAD_REQUEST");
 const t=db.collection("tenants").doc(tenantId);
 const tenant=await t.get();
 if(!tenant.exists||tenant.data()?.hybridBillingEnabled!==true
   ||tenant.data()?.billingPolicyVersion!=="hybrid_v1")
   throw Error("HYBRID_SOURCE_INVENTORY_NOT_HYBRID");
 const approved=Object.create(null),unregistered=Object.create(null);
 let cursor=null,scanned=0,pages=0,legacy=0,nonCanonical=0;
 for(;;){
  // Query only real paid delivery documents; read-only source inventory.
  // Each page is a DIFFERENT read, not a globally stable snapshot.
  let q=t.collection("orders").where("orderType","==","delivery")
   .where("paymentStatus","==","paid").orderBy("__name__")
   .limit(Math.min(pageSize,maxRows-scanned+1));
  if(cursor)q=q.startAfter(cursor);
  const snap=await q.get();
  if(!Array.isArray(snap?.docs)||snap.size!==snap.docs.length
    ||snap.size>pageSize||snap.size===0&&snap.docs.length!==0)
   throw Error("HYBRID_SOURCE_INVENTORY_INCOMPLETE");
  if(scanned+snap.size>maxRows)throw Error("HYBRID_SOURCE_INVENTORY_LIMIT");
  for(const d of snap.docs){
   const order=d.data()||{};
   const source=typeof order.paymentReceiptSource==="string"
     &&order.paymentReceiptSource.length<100
     ?order.paymentReceiptSource:"(missing_or_invalid)";
   const known=TRUSTED.has(source);
   const bucket=known?approved:unregistered;
   bucket[source]=(bucket[source]||0)+1;
   if(!known)legacy++;
   if(!Number.isSafeInteger(order.paidAt?.toMillis?.()))nonCanonical++;
  }
  scanned+=snap.size;pages++;
  if(snap.size<Math.min(pageSize,maxRows-scanned+1))break;
  if(snap.docs.length===0)throw Error("HYBRID_SOURCE_INVENTORY_STALLED");
  cursor=snap.docs.at(-1);
  // At exact maxRows read a sentinel query on next loop to reject overflow.
 }
 const known=Object.keys(approved).sort().map(k=>[k,approved[k]]);
 const missing=Object.keys(unregistered).sort().map(k=>[k,unregistered[k]]);
 return {tenantId,scanned,pages,approvedSources:Object.fromEntries(known),
  unregisteredSources:Object.fromEntries(missing),
  unregisteredCount:legacy,nonCanonicalPaidAtCount:nonCanonical,
  advisoryDigest:hash(["hybrid_paid_source_inventory_v1",tenantId,scanned,known,missing,nonCanonical]),
  writerParticipationComplete:false,coverageCertified:false,
  canIssueInvoice:false,sourceCompletenessProven:false,
  note:"read_only_paid_delivery_only_not_atomic_no_unknown_writer_proof"};
}
module.exports={inspectHybridPaidWriterSourcesCandidate,MAX_ROWS,MAX_PAGE};
