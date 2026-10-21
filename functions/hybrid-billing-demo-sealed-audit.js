"use strict";
// Phase 3Z SOURCE-ONLY, READ-ONLY demo sealed-epoch audit.
// A sealed opt-in epoch does NOT stop a bypassing legacy writer. This scan
// neither creates an immutable day snapshot nor authorizes invoice issuance.
const {assertHybridEpochDemoOptIn,REGISTRY_DIGEST}=
 require("./hybrid-billing-writer-epoch-candidate");
const {previewHybridJournalManifest}=require("./hybrid-billing-manifest-preview");
const {inspectHybridPaidWriterSourcesCandidate}=
 require("./hybrid-billing-paid-source-inventory");
const ID=/^[A-Za-z0-9_-]{8,128}$/;
async function readSealed(tenantRef){
 const s=await tenantRef.collection("hybridBillingEpochCandidates")
  .doc("active").get();
 const d=s.exists?s.data():null;
 if(!d||d.epoch!==1||d.status!=="sealed"
  ||d.registryDigest!==REGISTRY_DIGEST
  ||d.candidateOnly!==true||d.coverageCertified!==false
  ||d.canIssueInvoice!==false)
  throw Error("HYBRID_SEALED_AUDIT_EPOCH_NOT_SEALED");
 return {epoch:d.epoch,registryDigest:d.registryDigest,status:d.status};
}
async function auditHybridSealedEpochCandidate({
 db,tenantId,pageSize=100,maxPages=100,maxRows=10000
}={}){
 assertHybridEpochDemoOptIn(true);
 if(!db||!ID.test(String(tenantId||""))
  ||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>200
  ||!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>100
  ||!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>10000)
  throw Error("HYBRID_SEALED_AUDIT_BAD_REQUEST");
 const t=db.collection("tenants").doc(tenantId);
 const before=await readSealed(t);
 const manifest=await previewHybridJournalManifest({
  db,tenantId,pageSize,maxPages});
 const sourceInventory=await inspectHybridPaidWriterSourcesCandidate({
  db,tenantId,pageSize,maxRows});
 const after=await readSealed(t);
 if(before.registryDigest!==after.registryDigest
  ||before.epoch!==after.epoch||before.status!==after.status)
  throw Error("HYBRID_SEALED_AUDIT_EPOCH_CHANGED");
 if(manifest.scanned!==sourceInventory.scanned)
  throw Error("HYBRID_SEALED_AUDIT_MISMATCHED_SCANS");
 const issues=Object.freeze({
  journal:manifest.issueCount,
  unknownPaidSources:sourceInventory.unregisteredCount,
  noncanonicalPaidAt:sourceInventory.nonCanonicalPaidAtCount,
  totalPaidOrders:manifest.scanned
 });
 return {tenantId,epoch:before.epoch,registryDigest:before.registryDigest,
  observedIssues:issues,manifestRootDigest:manifest.rootDigest,
  sourceInventoryDigest:sourceInventory.advisoryDigest,
  diagnosticOnly:true,immutableFinancialDayManifest:false,
  writerParticipationComplete:false,sourceCompletenessProven:false,
  coverageCertified:false,canIssueInvoice:false,
  note:"demo_sealed_opt_in_epoch_does_not_block_unenrolled_writers_or_prove_atomic_snapshot"};
}
module.exports={auditHybridSealedEpochCandidate};
