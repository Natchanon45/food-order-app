"use strict";
// M7 SOURCE MIGRATION module (UAT staging only). This is NOT a database
// migration runner and is incapable of booking cash, applying credit or
// releasing a store. Raw source rows are never persisted in Firestore.
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {actor}=require("./m7-stripe-test-shadow-history")._privateForTests;
const contract=require("./m7-source-migration-contract");
const reconciliation=require("./m7-source-migration-reconcile");
const credit=require("./m7-operational-credit-policy");
const opts={region:"asia-southeast1",timeoutSeconds:80,memory:"512MiB"};
const fail=(code,message)=>new HttpsError(code,message);
function gate(env=process.env){
 const project=String(env.GCLOUD_PROJECT||env.GCP_PROJECT||
  env.GOOGLE_CLOUD_PROJECT||"");
 const target=String(env.PENGUIN_M7_SOURCE_MIGRATION_PROJECT_ID||"");
 const tenantId=String(env.PENGUIN_M7_SOURCE_MIGRATION_TENANT_ID||"");
 if(env.PENGUIN_M7_SOURCE_MIGRATION_PREFLIGHT_ENABLED!=="1"||
   !project||!target||project!==target||
   /(?:prod|production|demo|emulator)/i.test(project)||
   !/(?:^|[-_])(uat|test)(?:$|[-_])/i.test(project)||
   project==="penguin-food"||
   env.FIRESTORE_EMULATOR_HOST||env.FUNCTIONS_EMULATOR||
   !/^[-\w]{3,160}$/.test(tenantId))
  return null;
 return {project,tenantId};
}
function input(data,kind){
 const keys=kind==="history"?["tenantId"]:["manifest"];
 if(!data||typeof data!=="object"||Array.isArray(data)||
    Object.keys(data).sort().join(",")!==keys.sort().join(","))
  throw fail("invalid-argument","M7_SOURCE_PREFLIGHT_ARGUMENTS_INVALID");
 return data;
}
async function scoped({db,auth,tenantId,allowed=gate()}){
 if(!auth?.uid)throw fail("unauthenticated","Login required");
 let actorProfile;
 try{actorProfile=await actor(db,auth);}catch(e){
  if(e.code)throw e;
  throw fail("permission-denied","M7_SOURCE_PREFLIGHT_ROLE_INVALID");
 }
 if(actorProfile.role!=="super_admin")
  throw fail("permission-denied","M7_SOURCE_PREFLIGHT_SUPERADMIN_ONLY");
 if(!allowed||allowed.tenantId!==tenantId)
  throw fail("failed-precondition","M7_SOURCE_PREFLIGHT_UAT_ONLY");
 const tenantRef=db.collection("tenants").doc(tenantId);
 if(!(await tenantRef.get()).exists)
  throw fail("not-found","M7_SOURCE_PREFLIGHT_TENANT_NOT_FOUND");
 return tenantRef;
}
async function compareFirebase(tenantRef,manifest){
 const rows=await tenantRef.collection("hybridBillingInvoices").limit(201).get();
 const records=rows.docs.map(doc=>({...doc.data(),id:doc.id}));
 return reconciliation.compare(manifest,records,{truncated:rows.size>200});
}
function analyze(data){
 input(data,"manifest");
 let report;
 try{report=contract.inspect(data.manifest);}catch{
  throw fail("invalid-argument","M7_SOURCE_PREFLIGHT_MANIFEST_INVALID");
 }
 return report;
}
async function preview({db,auth,data,allowed=gate()}){
 const report=analyze(data);
 const tenantRef=await scoped({db,auth,tenantId:report.tenantId,allowed});
 const candidateComparison=await compareFirebase(tenantRef,data.manifest);
 return {...report,candidateComparison,authenticated:true,superadminOnly:true,staged:false};
}
function persisted(report,candidateComparison,operatorUid,createdAt){
 return {
  tenantId:report.tenantId,manifestDigest:report.manifestDigest,
  sourceSchemaSha256:report.sourceSchemaSha256,sourceCommit:contract.SOURCE_COMMIT,
  sourceRecordCounts:report.sourceRecordCounts,totalRows:report.totalRows,
  candidateComparison,
  issueCodes:report.issueCodes,structuralIssuesDetected:report.structuralIssuesDetected,
  sourceInventorySelfReported:true,
  sourceProvenanceAuthenticated:false,
  crossTenantBankClaimsVerified:false,
  reconciliationReady:false,bankCashApproved:false,serviceCreditPostApproved:false,
  operationalInvoicePaid:false,operationalPromotionAllowed:false,
  tenantAccessReleaseAllowed:false,mode:"m7_untrusted_source_preflight_audit",
  requestedBy:operatorUid,createdAt,
 };
}
async function stage({db,auth,data,allowed=gate()}){
 const report=analyze(data);
 const root=await scoped({db,auth,tenantId:report.tenantId,allowed});
 // Cross-ledger scan is intentionally advisory and NON-ATOMIC. It can never
 // certify financial migration or be used to release a hold.
 const candidateComparison=await compareFirebase(root,data.manifest);
 const ref=root.collection("m7SourceMigrationPreflightRuns").doc(report.manifestDigest);
 const actorRef=db.collection("users").doc(auth.uid);
 return db.runTransaction(async tx=>{
  const [who,tenant,previous]=await Promise.all([
   tx.get(actorRef),tx.get(root),tx.get(ref)]);
  if(who.data()?.active!==true||who.data()?.role!=="super_admin")
   throw fail("permission-denied","M7_SOURCE_PREFLIGHT_OPERATOR_CHANGED");
  if(!tenant.exists||tenant.id!==report.tenantId)
   throw fail("failed-precondition","M7_SOURCE_PREFLIGHT_TENANT_CHANGED");
  if(previous.exists){
   const p=previous.data();
   if(p.tenantId!==report.tenantId||
      p.mode!=="m7_untrusted_source_preflight_audit"||
      p.manifestDigest!==report.manifestDigest||
      p.sourceSchemaSha256!==report.sourceSchemaSha256||
      p.sourceCommit!==contract.SOURCE_COMMIT||
      p.operationalPromotionAllowed!==false||
      p.serviceCreditPostApproved!==false||
      p.bankCashApproved!==false||
      p.tenantAccessReleaseAllowed!==false||
      p.totalRows!==report.totalRows||
      JSON.stringify(p.sourceRecordCounts)!==JSON.stringify(report.sourceRecordCounts)||
      JSON.stringify(p.issueCodes)!==JSON.stringify(report.issueCodes)||
      JSON.stringify(p.candidateComparison)!==JSON.stringify(candidateComparison))
    throw fail("failed-precondition","M7_SOURCE_PREFLIGHT_REPLAY_CONFLICT");
   return {ok:true,mode:"m7_untrusted_source_preflight_audit",
    manifestDigest:report.manifestDigest,reused:true,staged:true,
    candidateComparison,
    structuralIssuesDetected:report.structuralIssuesDetected,
    operationalPromotionAllowed:false,serviceCreditPostApproved:false,
    operationalInvoicePaid:false,tenantAccessReleaseAllowed:false};
  }
  tx.create(ref,persisted(report,candidateComparison,
   auth.uid,FieldValue.serverTimestamp()));
  return {ok:true,mode:"m7_untrusted_source_preflight_audit",
   manifestDigest:report.manifestDigest,reused:false,staged:true,
   candidateComparison,
   structuralIssuesDetected:report.structuralIssuesDetected,
   operationalPromotionAllowed:false,serviceCreditPostApproved:false,
   operationalInvoicePaid:false,tenantAccessReleaseAllowed:false};
 });
}
async function history({db,auth,data,allowed=gate()}){
 input(data,"history");
 let tenantId;
 try{tenantId=credit.tenant(data.tenantId);}catch{
  throw fail("invalid-argument","M7_SOURCE_PREFLIGHT_TENANT_INVALID");
 }
 const root=await scoped({db,auth,tenantId,allowed});
 const snapshots=await root.collection("m7SourceMigrationPreflightRuns")
  .orderBy("createdAt","desc").limit(21).get();
 const items=snapshots.docs.slice(0,20).map(doc=>{
  const x=doc.data();
  if(x.tenantId!==tenantId||x.manifestDigest!==doc.id||
    x.mode!=="m7_untrusted_source_preflight_audit"||
    x.operationalPromotionAllowed!==false||x.bankCashApproved!==false||
    x.serviceCreditPostApproved!==false||x.tenantAccessReleaseAllowed!==false||
    !Array.isArray(x.issueCodes)||
    x.issueCodes.some(code=>!contract.ISSUE_CODES.includes(code))||
    x.candidateComparison?.mode!=="m7_source_firebase_candidate_mapping_read_only"||
    x.candidateComparison?.financialMutationAllowed!==false||
    x.candidateComparison?.tenantReleaseAllowed!==false)
   return {manifestDigest:doc.id,status:"needs_review",totalRows:null,
    structuralIssuesDetected:null,issueCodes:[]};
  return {manifestDigest:doc.id,status:"unauthenticated_source_preview",
   totalRows:x.totalRows,structuralIssuesDetected:x.structuralIssuesDetected,
   issueCodes:x.issueCodes,
   candidateMissing:x.candidateComparison.missingFirebaseInvoiceCandidates,
   candidateConflicts:x.candidateComparison.conflictingInvoiceCandidates,
   createdAt:x.createdAt?.toDate?.().toISOString()||"",
   operationalPromotionAllowed:false,tenantAccessReleaseAllowed:false};
 });
 return {ok:true,mode:"m7_source_migration_preflight_history",
  tenantId,hasMore:snapshots.size>20,
  bankCashApproved:false,serviceCreditPostApproved:false,
  tenantAccessReleaseAllowed:false,items};
}
exports.previewPlatformM7SourceMigrationPreflight=onCall(opts,async request=>
 preview({db:getFirestore(),auth:request.auth,data:request.data}));
exports.stagePlatformM7SourceMigrationPreflight=onCall(opts,async request=>
 stage({db:getFirestore(),auth:request.auth,data:request.data}));
exports.getPlatformM7SourceMigrationPreflightHistory=onCall(opts,async request=>
 history({db:getFirestore(),auth:request.auth,data:request.data}));
exports._privateForTests={gate,input,scoped,compareFirebase,
 analyze,persisted,preview,stage,history};
