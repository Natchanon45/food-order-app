import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
   !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),runtime=require("./m7-source-migration-preflight");
const contract=require("./m7-source-migration-contract");
const fixture=createRequire(import.meta.url)("../fixtures/m7-source-migration.synthetic.cjs");
const base=fixture.fixture(),tenantId=base.tenantId;
const root=db.collection("tenants").doc(tenantId);
const superId="super-"+randomUUID(),otherSuper="super-"+randomUUID(),
 ownerId="owner-"+randomUUID(),cashierId="cashier-"+randomUUID(),
 inactiveId="inactive-"+randomUUID();
const allowed={project:"penguin-m7-uat",tenantId};
const data={manifest:base};
const auth=uid=>({uid});
function context(uid=superId){return {db,auth:auth(uid),data,allowed};}
test("Role-scoped UAT preview: no writes, no bank or credit authority",async()=>{
 await Promise.all([
  root.set({active:false,billingPolicyVersion:"hybrid_v1"}),
  db.collection("users").doc(superId).set({active:true,role:"super_admin"}),
  db.collection("users").doc(otherSuper).set({active:true,role:"super_admin"}),
  db.collection("users").doc(ownerId).set({active:true,role:"owner",tenantId}),
  db.collection("users").doc(cashierId).set({active:true,role:"cashier",tenantId}),
  db.collection("users").doc(inactiveId).set({active:false,role:"super_admin"}),
 ]);
 const preview=await runtime._privateForTests.preview(context());
 assert.equal(preview.ok,true);
 assert.equal(preview.structuralIssuesDetected,0);
 assert.equal(preview.sourceInventorySelfReported,true);
 assert.equal(preview.sourceSignatureIndependentlyVerified,false);
 assert.equal(preview.operationalPromotionAllowed,false);
 assert.equal(preview.operationalCreditPostingAllowed,false);
 assert.equal(preview.operationalInvoicePaid,false);
 assert.equal(preview.tenantAccessReleaseAllowed,false);
 assert.equal(preview.staged,false);
 assert.equal(preview.authenticated,true);
 assert.equal((await root.collection("m7SourceMigrationPreflightRuns").get()).size,0);
 assert.equal((await root.collection("hybridBillingInvoices").get()).size,0);
 for(const uid of [ownerId,cashierId,inactiveId])
  await assert.rejects(runtime._privateForTests.preview(context(uid)),
    {code:"permission-denied"});
 await assert.rejects(runtime._privateForTests.preview({
  ...context(),auth:null}),{code:"unauthenticated"});
 await assert.rejects(runtime._privateForTests.preview({
  ...context(),allowed:{...allowed,tenantId:"foreign-tenant"}}),{code:"failed-precondition"});
});
test("6 concurrent UAT preflight stages create 1 append-only AUDIT, never raw rows or operational ledger",async()=>{
 const results=await Promise.all(Array.from({length:6},
  ()=>runtime._privateForTests.stage(context())));
 assert.equal(results.filter(x=>x.reused===false).length,1);
 assert.equal(results.filter(x=>x.reused===true).length,5);
 const digest=contract.digest(base),snap=await root
  .collection("m7SourceMigrationPreflightRuns").doc(digest).get();
 assert.equal(snap.exists,true);
 assert.equal(snap.data().mode,"m7_untrusted_source_preflight_audit");
 assert.equal(snap.data().requestedBy,superId);
 assert.equal(snap.data().operationalPromotionAllowed,false);
 assert.equal(snap.data().serviceCreditPostApproved,false);
 assert.equal(snap.data().bankCashApproved,false);
 assert.equal(snap.data().tenantAccessReleaseAllowed,false);
 assert.equal(snap.data().sourceProvenanceAuthenticated,false);
 assert.equal(snap.data().structuralIssuesDetected,0);
 assert.equal((await root.collection("m7SourceMigrationPreflightRuns").get()).size,1);
 const serialized=JSON.stringify(snap.data());
 for(const privateValue of [base.tables.merchant_platform_invoice_journal[0].invoice_key,
  base.tables.merchant_platform_payment_attempts[0].slip_sha256,
  base.tables.merchant_platform_payment_attempts[0].independent_bank_statement_sha256,
  base.tables.merchant_platform_invoice_journal[0].id])
  assert.ok(!serialized.includes(privateValue),"No underlying source row fields persisted");
 assert.equal((await root.collection("m7OperationalCreditAccounts").get()).size,0);
 assert.equal((await root.collection("hybridBillingInvoices").get()).size,0);
 assert.equal((await root.collection("merchantPaymentHoldEvents").get()).size,0);
});
test("exact same digest idempotent even from another active reviewer; history has sanitized counts",async()=>{
 const reused=await runtime._privateForTests.stage(context(otherSuper));
 assert.equal(reused.reused,true);
 const result=await runtime._privateForTests.history({
  db,auth:auth(otherSuper),data:{tenantId},allowed});
 assert.equal(result.ok,true);
 assert.equal(result.mode,"m7_source_migration_preflight_history");
 assert.equal(result.items.length,1);
 const r=result.items[0];
 assert.equal(r.manifestDigest,contract.digest(base));
 assert.equal(r.totalRows,14);
 assert.equal(r.status,"unauthenticated_source_preview");
 assert.equal(r.operationalPromotionAllowed,false);
 assert.equal(result.bankCashApproved,false);
 assert.equal(result.serviceCreditPostApproved,false);
 assert.equal(result.tenantAccessReleaseAllowed,false);
 assert.equal(JSON.stringify(result).includes("private_slip_path"),false);
});
test("tampered test-source manifest, extra PII, invalid tenant/gate are rejected, never persisted",async()=>{
 const original=(await root.collection("m7SourceMigrationPreflightRuns").get()).size;
 for(const [mutate,expectedCode] of [
  [x=>x.source.sourceCommit="untrusted","invalid-argument"],
  [x=>x.tables.merchant_platform_payment_attempts[0].private_slip_path="/unsafe/slip","invalid-argument"],
  [x=>x.tenantId="foreign-uat-tenant","failed-precondition"],
  [x=>x.source.sourceSchemaSha256="bad","invalid-argument"],
 ]){
  const x=structuredClone(base);mutate(x);
  await assert.rejects(runtime._privateForTests.stage({
   ...context(),data:{manifest:x}}),{code:expectedCode});
 }
 await assert.rejects(runtime._privateForTests.stage({
  ...context(),allowed:null}),{code:"failed-precondition"});
 await assert.rejects(runtime._privateForTests.stage({
  ...context(),data:{manifest:base,commit:true}}),{code:"invalid-argument"});
 assert.equal((await root.collection("m7SourceMigrationPreflightRuns").get()).size,original);
});
test("public Callables reject emulator and production/demo even when preflight enabled",async()=>{
 for(const project of ["penguin-food","demo-penguin-m7-uat",
   "penguin-m7-production","penguin-m7-test-production"]){
  const env={GCLOUD_PROJECT:project,
   PENGUIN_M7_SOURCE_MIGRATION_PROJECT_ID:project,
   PENGUIN_M7_SOURCE_MIGRATION_TENANT_ID:tenantId,
   PENGUIN_M7_SOURCE_MIGRATION_PREFLIGHT_ENABLED:"1"};
  assert.equal(runtime._privateForTests.gate(env),null,project);
 }
 const good={GCLOUD_PROJECT:"penguin-isolated-uat",
  PENGUIN_M7_SOURCE_MIGRATION_PROJECT_ID:"penguin-isolated-uat",
  PENGUIN_M7_SOURCE_MIGRATION_TENANT_ID:tenantId,
  PENGUIN_M7_SOURCE_MIGRATION_PREFLIGHT_ENABLED:"1"};
 assert.deepEqual(runtime._privateForTests.gate(good),
  {project:"penguin-isolated-uat",tenantId});
 assert.equal(runtime._privateForTests.gate({...good,FIRESTORE_EMULATOR_HOST:"127.0.0.1:18080"}),null);
 await assert.rejects(runtime.previewPlatformM7SourceMigrationPreflight.run({
  auth:auth(superId),data}),{code:"failed-precondition"});
 await assert.rejects(runtime.stagePlatformM7SourceMigrationPreflight.run({
  auth:auth(superId),data}),{code:"failed-precondition"});
 await assert.rejects(runtime.getPlatformM7SourceMigrationPreflightHistory.run({
  auth:auth(superId),data:{tenantId}}),{code:"failed-precondition"});
});
test("tampered stored audit is not presented as 'reviewed' and is never promoted",async()=>{
 const digest=contract.digest(base);
 const ref=root.collection("m7SourceMigrationPreflightRuns").doc(digest);
 await ref.update({serviceCreditPostApproved:true});
 const history=await runtime._privateForTests.history({
  db,auth:auth(superId),data:{tenantId},allowed});
 assert.equal(history.items[0].status,"needs_review");
 assert.equal(history.items[0].totalRows,null);
 await assert.rejects(runtime._privateForTests.stage(context()),
  {code:"failed-precondition"});
 assert.equal((await root.collection("hybridBillingInvoices").get()).size,0);
});
