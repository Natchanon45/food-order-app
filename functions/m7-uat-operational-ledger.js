"use strict";
// M7 operational arithmetic UAT SHADOW. Never an operational money writer.
// The Source manifest is operator-provided, untrusted, and stays in memory.
// All Firestore records are private diagnostics with immutable NOT-PAID flags.
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const policy=require("./m7-uat-operational-ledger-policy");
const contract=require("./m7-source-migration-contract");
const source=require("./m7-source-migration-preflight");
const {actor}=require("./m7-stripe-test-shadow-history")._privateForTests;
const {tenant}=require("./m7-operational-credit-policy");
const fail=(code,message)=>new HttpsError(code,message);
const opts={region:"asia-southeast1",timeoutSeconds:90,memory:"512MiB"};
function gate(env=process.env){
 const project=String(env.GCLOUD_PROJECT||env.GCP_PROJECT||
  env.GOOGLE_CLOUD_PROJECT||"");
 const target=String(env.PENGUIN_M7_UAT_FINANCIAL_LEDGER_PROJECT_ID||"");
 const tenantId=String(env.PENGUIN_M7_UAT_FINANCIAL_LEDGER_TENANT_ID||"");
 if(env.PENGUIN_M7_UAT_FINANCIAL_LEDGER_ENABLED!=="1"||
   !project||project!==target||project==="penguin-food"||
   /(?:prod|production|demo|emulator)/i.test(project)||
   !/(?:^|[-_])(uat|test)(?:$|[-_])/i.test(project)||
   env.FIRESTORE_EMULATOR_HOST||env.FUNCTIONS_EMULATOR||
   !/^[A-Za-z0-9_-]{3,160}$/.test(tenantId))
  return null;
 return {project,tenantId};
}
function select(data,kind){
 const keys=kind==="history"?["tenantId"]:["manifest"];
 if(!data||typeof data!=="object"||Array.isArray(data)||
    Object.keys(data).sort().join(",")!==keys.join(","))
  throw fail("invalid-argument","M7_UAT_LEDGER_ARGUMENTS_INVALID");
 if(kind==="history"){
  try{tenant(data.tenantId);}catch{
   throw fail("invalid-argument","M7_UAT_LEDGER_TENANT_INVALID");
  }
  return {tenantId:data.tenantId};
 }
 try{
  const projection=policy.plan(data.manifest);
  return {tenantId:projection.shadow.tenantId,projection};
 }catch{
  throw fail("invalid-argument","M7_UAT_LEDGER_SOURCE_NOT_RECONCILED");
 }
}
async function scoped({db,auth,tenantId,allowed=gate()}){
 if(!auth?.uid)throw fail("unauthenticated","Login required");
 const profile=await actor(db,auth);
 if(profile.role!=="super_admin")
  throw fail("permission-denied","Active Superadmin required");
 if(!allowed||allowed.tenantId!==tenantId)
  throw fail("failed-precondition","UAT_ONLY_NO_OPERATIONAL_LEDGER");
 const tenantRef=db.collection("tenants").doc(tenantId);
 if(!(await tenantRef.get()).exists)
  throw fail("not-found","Tenant missing");
 return tenantRef;
}
function checkPreflight(pre,projection,comparison){
 const r=projection.shadow;
 return !!pre&&pre.mode==="m7_untrusted_source_preflight_audit"&&
  pre.tenantId===r.tenantId&&
  pre.manifestDigest===r.sourceManifestDigest&&
  pre.sourceSchemaSha256===contract.SOURCE_SCHEMA_SHA256&&
  pre.sourceCommit===contract.SOURCE_COMMIT&&
  pre.structuralIssuesDetected===0&&
  pre.sourceProvenanceAuthenticated===false&&
  pre.reconciliationReady===false&&
  pre.operationalInvoicePaid===false&&
  pre.operationalPromotionAllowed===false&&
  pre.bankCashApproved===false&&
  pre.serviceCreditPostApproved===false&&
  pre.tenantAccessReleaseAllowed===false&&
  JSON.stringify(pre.candidateComparison)===JSON.stringify(comparison);
}
async function readCandidate(tenantRef,manifest){
 return source._privateForTests.compareFirebase(tenantRef,manifest);
}
function summaryView(projection){
 const v=policy.safeView(projection.shadow);
 return {ok:true,...v,financialShadowOnly:true,
  preflightRequired:true,bankAndSourceEvidenceStillUnverified:true};
}
async function preview({db,auth,data,allowed=gate()}){
 const {tenantId,projection}=select(data);
 const root=await scoped({db,auth,tenantId,allowed});
 const preflight=await root.collection("m7SourceMigrationPreflightRuns")
  .doc(projection.shadow.sourceManifestDigest).get();
 const compare=await readCandidate(root,data.manifest);
 const ready=checkPreflight(preflight.data(),projection,compare);
 return {...summaryView(projection),preflightStagedAndConsistent:ready,
  recordAllowed:ready,recorded:false};
}
function globalRefs(db,projection){
 const bank=projection.bankClaimIds.map(id=>
  db.collection("m7UatFinancialBankClaims").doc(id));
 const invoices=projection.invoiceClaimIds.map(id=>
  db.collection("m7UatFinancialInvoiceClaims").doc(id));
 return {bank,invoices};
}
function isShadowDoc(a,projection){
 try{
  const b=policy.safeView(a);
  return b.sourceManifestDigest===projection.shadow.sourceManifestDigest&&
   b.tenantId===projection.shadow.tenantId&&
   b.sourceSchemaSha256===contract.SOURCE_SCHEMA_SHA256&&
   a.financialSummaryDigest===policy.digestShadow(b)&&
   JSON.stringify(b.financialItems)===
   JSON.stringify(projection.shadow.financialItems)&&
   b.sourceGrossCents===projection.shadow.sourceGrossCents&&
   b.sourceBankReportedCents===projection.shadow.sourceBankReportedCents&&
   b.sourceCreditAppliedCents===projection.shadow.sourceCreditAppliedCents&&
   b.sourceUnpaidForReviewCents===projection.shadow.sourceUnpaidForReviewCents;
 }catch{return false;}
}
async function stage({db,auth,data,allowed=gate()}){
 const {tenantId,projection}=select(data);
 const root=await scoped({db,auth,tenantId,allowed});
 const digest=projection.shadow.sourceManifestDigest;
 const comparison=await readCandidate(root,data.manifest);
 const preflightRef=root.collection("m7SourceMigrationPreflightRuns").doc(digest);
 const runRef=root.collection("m7UatFinancialShadowRuns").doc(digest);
 const lockRef=db.collection("m7UatFinancialTenantLocks").doc(tenantId);
 const reviewerRef=db.collection("users").doc(auth.uid);
 const global=globalRefs(db,projection);
 return db.runTransaction(async tx=>{
  // All reads BEFORE any write; conflicts/replays roll back all claims.
  const [who,tenantSnap,preflight,run,lock,...claims]=await Promise.all([
   tx.get(reviewerRef),tx.get(root),tx.get(preflightRef),tx.get(runRef),
   tx.get(lockRef),
   ...global.bank.map(r=>tx.get(r)),
   ...global.invoices.map(r=>tx.get(r)),
  ]);
  if(who.data()?.active!==true||who.data()?.role!=="super_admin")
   throw fail("permission-denied","UAT_OPERATOR_CHANGED");
  if(!tenantSnap.exists||tenantSnap.id!==tenantId)
   throw fail("failed-precondition","UAT_TENANT_CHANGED");
  if(!checkPreflight(preflight.data(),projection,comparison))
   throw fail("failed-precondition","UAT_PREFLIGHT_EVIDENCE_REQUIRED");
  const expectedClaims=[
   ...global.bank.map((r,i)=>({ref:r,snap:claims[i],kind:"bank"})),
   ...global.invoices.map((r,i)=>({ref:r,
    snap:claims[global.bank.length+i],kind:"invoice"})),
  ];
  for(const {ref,snap,kind} of expectedClaims){
   if(!snap.exists)continue;
   const c=snap.data();
   if(c.mode!==policy.MODE||c.kind!==kind||
     c.tenantId!==tenantId||c.sourceManifestDigest!==digest||
     c.keyDigest!==ref.id||c.operationalBankVerified!==false||
     c.financialPostingAllowed!==false)
    throw fail("failed-precondition","UAT_GLOBAL_CLAIM_CONFLICT");
  }
  if(run.exists||lock.exists){
   const current=run.data(),l=lock.data();
   if(!run.exists||!lock.exists||
      !isShadowDoc(current,projection)||
      l.tenantId!==tenantId||l.sourceManifestDigest!==digest||
      l.mode!==policy.MODE||l.financialPostingAllowed!==false||
      l.operationalReleaseAuthorized!==false||
      expectedClaims.some(x=>!x.snap.exists))
    throw fail("failed-precondition","UAT_SHADOW_REPLAY_CONFLICT");
   return {ok:true,mode:policy.MODE,tenantId,sourceManifestDigest:digest,
    reused:true,recorded:true,financialShadowOnly:true,
    financialPostingAuthorized:false,operationalReleaseAuthorized:false,
    billingInvoicesMutated:false,tenantAccessMutated:false};
  }
  // NEVER update the real tenant, Hybrid Invoice, operational credit or holds.
  tx.create(runRef,{
   ...projection.shadow,
   financialSummaryDigest:policy.digestShadow(projection.shadow),
   createdAt:FieldValue.serverTimestamp(),
   createdBy:auth.uid,preflightAuditDigest:digest,
   nonAtomicFirebaseCandidateComparison:true,
   comparisonIssueCodes:comparison.issueCodes,
  });
  tx.create(lockRef,{mode:policy.MODE,tenantId,sourceManifestDigest:digest,
   financialPostingAllowed:false,operationalReleaseAuthorized:false,
   createdBy:auth.uid,createdAt:FieldValue.serverTimestamp()});
  for(const {ref,snap,kind} of expectedClaims){
   if(snap.exists)throw fail("failed-precondition","UAT_UNEXPECTED_CLAIM");
   tx.create(ref,{mode:policy.MODE,kind,keyDigest:ref.id,
    tenantId,sourceManifestDigest:digest,operationalBankVerified:false,
    financialPostingAllowed:false,createdAt:FieldValue.serverTimestamp()});
  }
  return {ok:true,mode:policy.MODE,tenantId,sourceManifestDigest:digest,
   reused:false,recorded:true,financialShadowOnly:true,
   financialPostingAuthorized:false,operationalReleaseAuthorized:false,
   billingInvoicesMutated:false,tenantAccessMutated:false};
 });
}
async function history({db,auth,data,allowed=gate()}){
 const {tenantId}=select(data,"history");
 const root=await scoped({db,auth,tenantId,allowed});
 const rows=await root.collection("m7UatFinancialShadowRuns")
  .orderBy("createdAt","desc").limit(21).get();
 return {ok:true,mode:"m7_uat_financial_shadow_history",
  tenantId,hasMore:rows.size>20,financialPostingAuthorized:false,
  tenantAccessReleaseAllowed:false,
  items:rows.docs.slice(0,20).map(doc=>{
   const r=doc.data();
   if(r.sourceManifestDigest!==doc.id||r.tenantId!==tenantId||
      !isShadowDoc(r,{shadow:{...r,
       sourceManifestDigest:doc.id,tenantId}}))
    return {sourceManifestDigest:doc.id,status:"needs_review"};
   return {
    sourceManifestDigest:doc.id,status:"untrusted_shadow_only",
    invoiceCount:r.invoiceCount,
    sourceGrossCents:r.sourceGrossCents,
    sourceBankReportedCents:r.sourceBankReportedCents,
    sourceCreditAppliedCents:r.sourceCreditAppliedCents,
    sourceUnpaidForReviewCents:r.sourceUnpaidForReviewCents,
    sourceCreditAccountReportedCents:r.sourceCreditAccountReportedCents,
    sourceHoldWithoutApprovalCount:r.sourceHoldWithoutApprovalCount,
    bankCashOperationallyVerified:false,operationalReleaseAuthorized:false,
    createdAt:r.createdAt?.toDate?.().toISOString()||"",
   };
  }),
 };
}
exports.previewPlatformM7UatFinancialShadow=onCall(opts,async request=>
 preview({db:getFirestore(),auth:request.auth,data:request.data}));
exports.stagePlatformM7UatFinancialShadow=onCall(opts,async request=>
 stage({db:getFirestore(),auth:request.auth,data:request.data}));
exports.getPlatformM7UatFinancialShadowHistory=onCall(opts,async request=>
 history({db:getFirestore(),auth:request.auth,data:request.data}));
exports._privateForTests={gate,select,scoped,checkPreflight,readCandidate,
 globalRefs,isShadowDoc,summaryView,preview,stage,history};
