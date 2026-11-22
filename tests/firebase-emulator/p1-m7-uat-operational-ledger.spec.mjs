import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import {initializeApp as initializeClient,deleteApp} from "firebase/app";
import {getFirestore as getClientFirestore,connectFirestoreEmulator,
 doc as clientDoc,getDoc as clientGet,setDoc as clientSet} from "firebase/firestore";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const imports=createRequire(import.meta.url);
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
   !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore();
const ledger=imports("../../functions/m7-uat-operational-ledger.js")._privateForTests;
const preflight=imports("../../functions/m7-source-migration-preflight.js")._privateForTests;
const policy=imports("../../functions/m7-uat-operational-ledger-policy.js");
const {fixture,H}=imports("../fixtures/m7-source-migration.synthetic.cjs");
const manifest=fixture();
const tenantId="m7-uat-ledger-"+randomUUID().replace(/-/g,"").slice(0,12);
manifest.tenantId=tenantId;
for(const list of Object.values(manifest.tables))
 for(const row of list)
  if(Object.hasOwn(row,"tenant_id"))row.tenant_id=tenantId;
const userId="super-"+randomUUID(),ownerId="owner-"+randomUUID(),
 inactiveId="inactive-"+randomUUID(),secondSuper="super-"+randomUUID();
const allowed={project:"penguin-isolated-uat",tenantId};
const root=db.collection("tenants").doc(tenantId);
const auth=uid=>({uid});
const context=(uid=userId,data={manifest},allow=allowed)=>({db,
 auth:auth(uid),data,allowed:allow});
test("UAT gate refuses production, emulators and arbitrary client-sent financial authorization",async()=>{
 for(const project of ["penguin-food","penguin-production-uat",
  "demo-penguin-m7-test","penguin-prod-m7-test"]){
  assert.equal(ledger.gate({
   GCLOUD_PROJECT:project,PENGUIN_M7_UAT_FINANCIAL_LEDGER_PROJECT_ID:project,
   PENGUIN_M7_UAT_FINANCIAL_LEDGER_TENANT_ID:tenantId,
   PENGUIN_M7_UAT_FINANCIAL_LEDGER_ENABLED:"1"}),null);
 }
 const good={GCLOUD_PROJECT:"penguin-isolated-uat",
  PENGUIN_M7_UAT_FINANCIAL_LEDGER_PROJECT_ID:"penguin-isolated-uat",
  PENGUIN_M7_UAT_FINANCIAL_LEDGER_TENANT_ID:tenantId,
  PENGUIN_M7_UAT_FINANCIAL_LEDGER_ENABLED:"1"};
 assert.deepEqual(ledger.gate(good),allowed);
 assert.equal(ledger.gate({...good,FIRESTORE_EMULATOR_HOST:"127.0.0.1:18080"}),null);
 await Promise.all([
  root.set({active:true,billingPolicyVersion:"hybrid_v1",
   revenueShareSuspended:true,manualSuspendReason:"Do not alter this hold"}),
  db.collection("users").doc(userId).set({active:true,role:"super_admin"}),
  db.collection("users").doc(secondSuper).set({active:true,role:"super_admin"}),
  db.collection("users").doc(ownerId).set({active:true,role:"owner",tenantId}),
  db.collection("users").doc(inactiveId).set({active:false,role:"super_admin"}),
 ]);
 for(const data of [{manifest,postPaid:true},
  {manifest,releaseTenant:true},{manifest,bankVerified:true},
  {manifest,sourceProvenanceVerified:true}])
  await assert.rejects(ledger.preview(context(userId,data)),
   {code:"invalid-argument"});
 for(const uid of [ownerId,inactiveId])
  await assert.rejects(ledger.preview(context(uid)),{code:"permission-denied"});
 await assert.rejects(ledger.preview({db,auth:null,data:{manifest},allowed}),
  {code:"unauthenticated"});
 await assert.rejects(ledger.preview(context(userId,{manifest},null)),
  {code:"failed-precondition"});
 assert.equal(ledger.gate(),null);
});
test("cannot create UAT ledger before independent UAT structural preflight audit is staged",async()=>{
 const r=await ledger.preview(context());
 assert.equal(r.ok,true);
 assert.equal(r.recordAllowed,false);
 assert.equal(r.preflightStagedAndConsistent,false);
 assert.equal(r.sourceBankReportedCents,50000);
 assert.equal(r.bankCashOperationallyVerified,false);
 await assert.rejects(ledger.stage(context()),{code:"failed-precondition"});
 assert.equal((await root.collection("m7UatFinancialShadowRuns").get()).size,0);
 assert.equal((await db.collection("m7UatFinancialBankClaims").get()).size,0);
});
test("after verified structural preflight, shadow simulation can be previewed; never authenticates the bank",async()=>{
 const p=await preflight.stage(context());
 assert.equal(p.ok,true);
 assert.equal(p.operationalPromotionAllowed,false);
 const r=await ledger.preview(context());
 assert.equal(r.recordAllowed,true);
 assert.equal(r.preflightStagedAndConsistent,true);
 assert.equal(r.recorded,false);
 assert.equal(r.sourceGrossCents,115220);
 assert.equal(r.sourceCreditAppliedCents,50000);
 assert.equal(r.sourceBankReportedCents,50000);
 assert.equal(r.sourceUnpaidForReviewCents,15220);
 assert.equal(r.bankCashOperationallyVerified,false);
 assert.equal(r.sourceIdentityNotAttested,true);
 assert.equal(r.operationalReleaseAuthorized,false);
 assert.equal(r.financialPostingAuthorized,false);
 assert.equal((await root.collection("hybridBillingInvoices").get()).size,0);
});
test("eight concurrent UAT shadow ledger commits are exactly-once and atomic with GLOBAL invoice and bank claims",async()=>{
 const before=(await root.get()).data();
 const result=await Promise.all(Array.from({length:8},()=>ledger.stage(context())));
 assert.equal(result.filter(x=>x.reused===false).length,1);
 assert.equal(result.filter(x=>x.reused===true).length,7);
 const projected=policy.plan(manifest);
 const runRef=root.collection("m7UatFinancialShadowRuns")
  .doc(projected.shadow.sourceManifestDigest);
 const run=(await runRef.get()).data();
 assert.equal(policy.safeView(run).mode,policy.MODE);
 assert.equal(run.financialSummaryDigest,policy.digestShadow(run));
 assert.equal(run.createdBy,userId);
 assert.equal(run.financialShadowOnly,true);
 assert.equal(run.financialPostingAuthorized,false);
 assert.equal(run.operationalReleaseAuthorized,false);
 assert.equal(run.sourceBankReportedCents,50000);
 assert.equal((await root.collection("m7UatFinancialShadowRuns").get()).size,1);
 assert.equal((await db.collection("m7UatFinancialBankClaims").get()).size,1);
 assert.equal((await db.collection("m7UatFinancialInvoiceClaims").get()).size,3);
 const lock=(await db.collection("m7UatFinancialTenantLocks").doc(tenantId).get()).data();
 assert.equal(lock.sourceManifestDigest,projected.shadow.sourceManifestDigest);
 assert.equal(lock.financialPostingAllowed,false);
 assert.equal(lock.operationalReleaseAuthorized,false);
 for(const ref of projected.bankClaimIds){
  const b=(await db.collection("m7UatFinancialBankClaims").doc(ref).get()).data();
  assert.equal(b.keyDigest,ref);
  assert.equal(b.tenantId,tenantId);
  assert.equal(b.operationalBankVerified,false);
  assert.equal(b.financialPostingAllowed,false);
 }
 assert.deepEqual((await root.get()).data(),before);
 assert.equal((await root.collection("hybridBillingInvoices").get()).size,0);
 assert.equal((await root.collection("hybridBillingPaymentAttempts").get()).size,0);
 assert.equal((await root.collection("m7OperationalCreditAccounts").get()).size,0);
 assert.equal((await root.collection("merchantPaymentHoldEvents").get()).size,0);
 assert.equal((await root.collection("lalamoveWalletTransactions").get()).size,0);
 const json=JSON.stringify(run);
 for(const secret of [
  manifest.tables.merchant_platform_invoice_journal[0].invoice_key,
  manifest.tables.merchant_platform_payment_attempts[0].slip_sha256,
  manifest.tables.merchant_platform_bank_reference_claims[0].ref_sha256,
  manifest.tables.merchant_platform_payment_attempts[0].independent_bank_statement_sha256,
 ])assert.equal(json.includes(secret),false);
});
test("UAT shadow history is Superadmin-only, sanitized, replay does not count TEST as paid",async()=>{
 const history=await ledger.history(context(userId,{tenantId}));
 assert.equal(history.ok,true);
 assert.equal(history.items.length,1);
 const a=history.items[0];
 assert.equal(a.status,"untrusted_shadow_only");
 assert.equal(a.sourceGrossCents,115220);
 assert.equal(a.sourceBankReportedCents,50000);
 assert.equal(a.sourceCreditAppliedCents,50000);
 assert.equal(a.sourceUnpaidForReviewCents,15220);
 assert.equal(a.bankCashOperationallyVerified,false);
 assert.equal(a.operationalReleaseAuthorized,false);
 assert.equal(history.financialPostingAuthorized,false);
 assert.equal(history.tenantAccessReleaseAllowed,false);
 await assert.rejects(ledger.history(context(ownerId,{tenantId})),
  {code:"permission-denied"});
 await assert.rejects(ledger.history(context(userId,{tenantId:"other-tenant"})),
  {code:"failed-precondition"});
 const again=await ledger.stage(context(secondSuper));
 assert.equal(again.reused,true);
 assert.equal((await root.collection("m7UatFinancialShadowRuns").get()).size,1);
});
test("changed source digest for same tenant requires manual reconciliation, never silently re-posts credit",async()=>{
 const changed=structuredClone(manifest);
 changed.source.capturedAtUtc="2026-11-22T03:00:00.000Z";
 const pre=await preflight.stage(context(userId,{manifest:changed}));
 assert.equal(pre.ok,true);
 await assert.rejects(ledger.stage(context(userId,{manifest:changed})),
  {code:"failed-precondition"});
 assert.equal((await root.collection("m7UatFinancialShadowRuns").get()).size,1);
});
test("global bank ref cannot be claimed by another tenant even if every invoice key differs",async()=>{
 const second=structuredClone(manifest);
 const anotherId="m7-uat-tenant-"+randomUUID().replace(/-/g,"").slice(0,10);
 second.tenantId=anotherId;
 for(const table of Object.values(second.tables))
  for(const row of table)
   if(row.tenant_id)row.tenant_id=anotherId;
 const replacements=new Map();
 for(let j=0;j<3;j++){
  const orig=second.tables.merchant_platform_invoice_journal[j].invoice_key;
  const modified="f"+orig.slice(1);
  replacements.set(orig,modified);
  second.tables.merchant_platform_invoice_journal[j].invoice_key=modified;
 }
 for(const table of Object.values(second.tables)){
  for(const item of table){
   for(const key of ["invoice_key","paid_monthly_invoice_id","reference_invoice_id"])
    if(replacements.has(item[key]))item[key]=replacements.get(item[key]);
  }
 }
 const other=db.collection("tenants").doc(anotherId);
 await other.set({active:true,billingPolicyVersion:"hybrid_v1"});
 const scoped={...allowed,tenantId:anotherId};
 const ctx={db,auth:auth(userId),data:{manifest:second},allowed:scoped};
 assert.equal((await preflight.stage(ctx)).ok,true);
 assert.equal((await ledger.preview(ctx)).recordAllowed,true);
 await assert.rejects(ledger.stage(ctx),{code:"failed-precondition"});
 assert.equal((await other.collection("m7UatFinancialShadowRuns").get()).size,0);
 assert.equal((await db.collection("m7UatFinancialTenantLocks").doc(anotherId).get()).exists,false);
 assert.equal((await db.collection("m7UatFinancialBankClaims").get()).size,1);
 assert.equal((await db.collection("m7UatFinancialInvoiceClaims").get()).size,3);
});
test("corrupt preflight, unauthorized proof or bank mismatch blocks and preserves source ledger",async()=>{
 const ref=root.collection("m7SourceMigrationPreflightRuns")
  .doc(policy.plan(manifest).shadow.sourceManifestDigest);
 const original=(await ref.get()).data();
 await ref.update({bankCashApproved:true});
 await assert.rejects(ledger.stage(context()),{code:"failed-precondition"});
 assert.equal((await root.collection("m7UatFinancialShadowRuns").get()).size,1);
 await ref.update({bankCashApproved:false,candidateComparison:{
  ...original.candidateComparison,
  matchingAmountAndKindCandidates:999}});
 await assert.rejects(ledger.stage(context()),{code:"failed-precondition"});
 await ref.update({candidateComparison:original.candidateComparison});
 const r=await ledger.stage(context());
 assert.equal(r.reused,true);
});
test("corrupt UAT shadow persisted checksum is downgraded for operator and replay is refused",async()=>{
 const digest=policy.plan(manifest).shadow.sourceManifestDigest;
 const ref=root.collection("m7UatFinancialShadowRuns").doc(digest);
 await ref.update({sourceGrossCents:1});
 const list=await ledger.history(context(userId,{tenantId}));
 assert.equal(list.items[0].status,"needs_review");
 await assert.rejects(ledger.stage(context()),{code:"failed-precondition"});
 assert.equal((await db.collection("m7UatFinancialBankClaims").get()).size,1);
});


test("Firestore Rules deny direct browser reads/writes of the UAT shadow, global bank/invoice claims and tenant lock",async()=>{
 const app=initializeClient({
  apiKey:"emulator-only-fake-key",projectId:"demo-penguin-hybrid",
  appId:"1:111:web:m7-uat-rule-"+randomUUID(),
 },"m7-uat-security-"+randomUUID());
 try{
  const browser=getClientFirestore(app);
  const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(browser,host,Number(port));
  const digest=policy.plan(manifest).shadow.sourceManifestDigest;
  const ids=policy.plan(manifest);
  const paths=[
   "tenants/"+tenantId+"/m7UatFinancialShadowRuns/"+digest,
   "m7UatFinancialTenantLocks/"+tenantId,
   "m7UatFinancialBankClaims/"+ids.bankClaimIds[0],
   "m7UatFinancialInvoiceClaims/"+ids.invoiceClaimIds[0],
  ];
  for(const path of paths){
   const ref=clientDoc(browser,path);
   await assert.rejects(clientGet(ref),err=>
    /permission-denied|insufficient permissions|missing or insufficient/i.test(
      String(err?.code||"")+" "+String(err?.message||"")));
   await assert.rejects(clientSet(ref,{operationalInvoicePaid:true,
    financialPostingAuthorized:true,tenantAccessReleaseAllowed:true}),err=>
    /permission-denied|insufficient permissions|missing or insufficient/i.test(
      String(err?.code||"")+" "+String(err?.message||"")));
  }
  const existing=(await db.collection("m7UatFinancialTenantLocks").doc(tenantId).get()).data();
  assert.equal(existing.financialPostingAllowed,false);
  assert.equal(existing.operationalReleaseAuthorized,false);
 }finally{await deleteApp(app);}
});
