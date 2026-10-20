"use strict";
// Phase 3W. Source-only, UNEXPORTED, DEMO-FIRESTORE-ONLY epoch barrier.
// This is a coordination PROTOTYPE, NOT a global certified receipt/day manifest.
// Financial candidate writers can now OPT IN ONLY in the isolated demo Emulator.
// Production/default calls NEVER enroll; registry flags all remain wired:false.
// The non-participating legacy writers remain an explicit release blocker.
const {createHash}=require("node:crypto");
const {FieldValue}=require("firebase-admin/firestore");
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const DEMO="demo-penguin-hybrid-uat";
const SOURCES=Object.freeze([
 Object.freeze({key:"cod_cashier",source:"hybrid_cod_cashier_server",wired:false}),
 Object.freeze({key:"promptpay_bank",source:"hybrid_promptpay_bank_verified_server",wired:false}),
 Object.freeze({key:"refund_initial",source:"hybrid_refund_bank_verified_server",wired:false}),
 Object.freeze({key:"refund_partial",source:"hybrid_refund_bank_verified_server",wired:false}),
 Object.freeze({key:"lalamove_cod_remittance",source:"UNIMPLEMENTED",wired:false}),
 Object.freeze({key:"legacy_paid_delivery",source:"UNREGISTERED",wired:false})
]);
const ADMISSIBLE=new Set(["cod_cashier","promptpay_bank","refund_initial","refund_partial"]);
const hash=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const REGISTRY_DIGEST=hash(["hybrid_epoch_registry_candidate_v1",
 SOURCES.map(x=>[x.key,x.source,x.wired])]);
// Opt-in is deliberately boolean and only usable on isolated demo Firestore.
function assertHybridEpochDemoOptIn(mode){
 if(typeof mode!=="boolean")throw Error("HYBRID_EPOCH_OPT_IN_INVALID");
 if(mode)assertDemo();
 return mode;
}
function assertDemo(){
 if(process.env.GCLOUD_PROJECT!==DEMO
   || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
  throw Error("HYBRID_EPOCH_DEMO_EMULATOR_ONLY");
}
function epochRef(t){return t.collection("hybridBillingEpochCandidates").doc("active");}
function validateEpoch(data){
 if(!data||data.registryDigest!==REGISTRY_DIGEST||data.epoch!==1
   ||!["open","sealed"].includes(data.status)
   ||data.candidateOnly!==true||data.coverageCertified!==false
   ||data.canIssueInvoice!==false)
   throw Error("HYBRID_EPOCH_MISSING_OR_TAMPERED");
 return data;
}
async function requireHybridEpochAdmissionCandidate({tx,tenantRef,sourceKey}){
 assertDemo();
 if(!tx||!tenantRef||typeof sourceKey!=="string"||!ADMISSIBLE.has(sourceKey))
   throw Error("HYBRID_EPOCH_WRITER_NOT_REGISTERED");
 // This MUST execute inside the SAME transaction as the synthetic writer.
 // The close transaction updates the same doc, forcing stale writer retries.
 // Only explicitly opted-in demo candidate financial transactions call this guard.
 const snap=await tx.get(epochRef(tenantRef));
 const state=validateEpoch(snap.exists?snap.data():null);
 if(state.status!=="open")throw Error("HYBRID_EPOCH_CLOSED");
 return {epoch:state.epoch,registryDigest:REGISTRY_DIGEST,
   admittedForDemo:true,coverageCertified:false,canIssueInvoice:false};
}
async function initializeHybridEpochCandidate({db,tenantId,reviewerUid}){
 assertDemo();
 if(!db||![tenantId,reviewerUid].every(v=>typeof v==="string"&&ID.test(v)))
   throw Error("HYBRID_EPOCH_BAD_REQUEST");
 const t=db.collection("tenants").doc(tenantId),u=db.collection("users").doc(reviewerUid),
  ref=epochRef(t);
 return db.runTransaction(async tx=>{
  const [tenant,user,old]=await Promise.all([tx.get(t),tx.get(u),tx.get(ref)]);
  if(!user.exists||user.data()?.role!=="super_admin"||user.data()?.active!==true)
   throw Error("HYBRID_EPOCH_SUPER_ADMIN_REQUIRED");
  if(!tenant.exists||tenant.data()?.billingPolicyVersion!=="hybrid_v1"
    ||tenant.data()?.hybridBillingEnabled!==true)
   throw Error("HYBRID_EPOCH_TENANT_NOT_HYBRID");
  if(old.exists)throw Error("HYBRID_EPOCH_ALREADY_INITIALIZED");
  tx.create(ref,{epoch:1,status:"open",registryDigest:REGISTRY_DIGEST,
   candidateOnly:true,coverageCertified:false,canIssueInvoice:false,
   createdAt:FieldValue.serverTimestamp()});
  return {epoch:1,status:"open",coverageCertified:false,canIssueInvoice:false};
 });
}
async function sealHybridEpochCandidate({db,tenantId,reviewerUid}){
 assertDemo();
 if(!db||![tenantId,reviewerUid].every(v=>typeof v==="string"&&ID.test(v)))
   throw Error("HYBRID_EPOCH_BAD_REQUEST");
 const t=db.collection("tenants").doc(tenantId),u=db.collection("users").doc(reviewerUid),
   ref=epochRef(t);
 return db.runTransaction(async tx=>{
  const [tenant,user,snap]=await Promise.all([tx.get(t),tx.get(u),tx.get(ref)]);
  if(!user.exists||user.data()?.role!=="super_admin"||user.data()?.active!==true)
   throw Error("HYBRID_EPOCH_SUPER_ADMIN_REQUIRED");
  if(!tenant.exists||tenant.data()?.billingPolicyVersion!=="hybrid_v1"
     ||tenant.data()?.hybridBillingEnabled!==true)
   throw Error("HYBRID_EPOCH_TENANT_NOT_HYBRID");
  const state=validateEpoch(snap.exists?snap.data():null);
  if(state.status==="open")
   tx.update(ref,{status:"sealed",sealedAt:FieldValue.serverTimestamp()});
  // This is ONLY a DEMO write barrier for transactions that voluntarily
  // read this document. It is NOT an immutable financial day seal.
  return {epoch:1,status:"sealed",alreadySealed:state.status==="sealed",
    registryDigest:REGISTRY_DIGEST,writerParticipationComplete:false,
    coverageCertified:false,canIssueInvoice:false};
 });
}
function reviewHybridWriterRegistryCandidate(){
 return {registryDigest:REGISTRY_DIGEST,
   sources:SOURCES.map(x=>({...x})),
   admittedDemoOnly:[...ADMISSIBLE].sort(),
   sourcesActuallyWired:0,
   writerParticipationComplete:false,coverageCertified:false,
   canIssueInvoice:false,
   reason:"real_financial_writers_and_legacy_paths_do_not_participate"};
}
module.exports={SOURCES,REGISTRY_DIGEST,reviewHybridWriterRegistryCandidate,
 assertHybridEpochDemoOptIn,
 requireHybridEpochAdmissionCandidate,initializeHybridEpochCandidate,
 sealHybridEpochCandidate};
