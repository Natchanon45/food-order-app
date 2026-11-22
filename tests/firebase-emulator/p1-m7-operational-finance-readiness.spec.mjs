import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const project="demo-penguin-hybrid";
if(process.env.GCLOUD_PROJECT!==project||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
if(!getApps().length)initializeApp({projectId:project});
const db=getFirestore();
const live=require("./m7-operational-finance-readiness");
const id="m7-bank-gap-"+randomUUID(),tenant=db.collection("tenants").doc(id);
const otherId="m7-bank-other-"+randomUUID();
const superId="super-"+randomUUID(),ownerId="owner-"+randomUUID(),
  cashierId="cashier-"+randomUUID(),inactiveId="inactive-"+randomUUID();
const invId="2026-11-22:monthly:fixed",sig="a".repeat(64);
const actor=uid=>({uid}),run=(uid=superId,tenantId=id)=>live._privateForTests.inspect({
 db,auth:actor(uid),data:{tenantId},allowedTenant:id});
test("isolated Superadmin read-only projection: Firestore paid + Shadow TEST is NOT Source bank cash",async()=>{
 await Promise.all([
  tenant.set({active:true,billingPolicyVersion:"hybrid_v1",name:"Synthetic finance gap"}),
  db.collection("tenants").doc(otherId).set({active:true}),
  db.collection("users").doc(superId).set({active:true,role:"super_admin"}),
  db.collection("users").doc(ownerId).set({active:true,role:"owner",tenantId:id}),
  db.collection("users").doc(cashierId).set({active:true,role:"cashier",tenantId:id}),
  db.collection("users").doc(inactiveId).set({active:false,role:"super_admin"}),
 ]);
 const paidId="test-paid-"+randomUUID();
 await tenant.collection("hybridBillingInvoices").doc(invId).set({
  id:invId,tenantId:id,signature:sig,version:"hybrid-invoice-v1",
  kind:"fixed_monthly",amount:500,status:"paid",paidAttemptId:paidId,date:"2026-11-22"});
 await tenant.collection("hybridBillingPaymentAttempts").doc(paidId).set({
  id:paidId,tenantId:id,invoiceId:invId,invoiceSignature:sig,
  amount:500,status:"paid",reviewedBy:"super-finance-reviewer",
  verification:{bankVerified:true,referenceId:"NEVER_EXPOSE_BANK_REF"},
  slipPath:"NEVER_EXPOSE_SLIP_PATH",
 });
 await tenant.collection("hybridBillingPaymentEvents").doc(paidId+"-review").set({
  tenantId:id,invoiceId:invId,attemptId:paidId,action:"approve",
  resultStatus:"paid",reviewerId:"super-finance-reviewer",
  bankVerified:true,note:"NEVER_EXPOSE_PRIVATE_NOTE",
 });
 await tenant.collection("m7StripeTestReservations").doc(randomUUID()).set({
  tenantId:id,invoiceId:invId,mode:"test",status:"verified_test",
  checkoutUrl:"NEVER_EXPOSE_TEST_CHECKOUT_URL",amountSatang:50000,
 });
 const before=(await tenant.collection("hybridBillingInvoices").doc(invId).get()).data();
 const report=await run();
 const after=(await tenant.collection("hybridBillingInvoices").doc(invId).get()).data();
 assert.deepEqual(after,before);
 assert.equal(report.ok,true);
 assert.equal(report.mode,"m7_source_finance_gap_read_only");
 assert.equal(report.invoiceCount,1);
 assert.equal(report.authenticated,true);
 assert.equal(report.superadminOnly,true);
 const row=report.invoices[0];
 assert.equal(row.grossCentsFromFirebase,50000);
 assert.equal(row.firebaseRecordedOnlyCents,50000);
 assert.equal(row.sourceBankVerifiedCents,null);
 assert.equal(row.sourceCreditBalanceCents,null);
 assert.equal(row.sourceServiceCreditAppliedCents,null);
 assert.equal(row.remainingBankCashDueCents,null);
 assert.equal(row.sourceOperationalPaid,false);
 assert.equal(row.tenantAccessReleaseAllowed,false);
 assert.equal(row.stripeTestShadowCount,1);
 assert.equal(report.canPostOperationalInvoicePaid,false);
 assert.equal(report.canApplyServiceCredit,false);
 assert.equal(report.canReleaseTenant,false);
 assert.equal(report.writesPerformed,false);
 const serialized=JSON.stringify(report);
 for(const prohibited of ["NEVER_EXPOSE","slipPath","verification","checkoutUrl","bankAccount"])
  assert.ok(!serialized.includes(prohibited),prohibited);
 assert.equal((await tenant.collection("m7OperationalCreditAccounts").get()).size,0);
});
test("owner, cashier, inactive Superadmin, foreign store, missing UAT gate and untrusted tenant selector rejected",async()=>{
 for(const uid of [ownerId,cashierId,inactiveId])
  await assert.rejects(run(uid),{code:"permission-denied"});
 await assert.rejects(run(superId,otherId),{code:"failed-precondition"});
 await assert.rejects(live.getPlatformM7OperationalFinanceReadiness.run({
  data:{tenantId:id},auth:{uid:superId}}),{code:"failed-precondition"});
 for(const input of [{tenantId:"../../secret"},{tenantId:id,amountSatang:1},
  {tenantId:""},{tenantId:1234},{},[]]){
  await assert.rejects(live._privateForTests.inspect({db,auth:actor(superId),
   data:input,allowedTenant:id}),{code:"invalid-argument"});
 }
 await assert.rejects(live._privateForTests.inspect({
  db,auth:null,data:{tenantId:id},allowedTenant:id}),{code:"unauthenticated"});
 assert.equal(live._privateForTests.gate(), "");
});
test("pending manual proof and suspended tenant never imply debt cleared; adjustments require review",async()=>{
 const invoiceId="2026-11-23:delivery:2026-11-22";
 await tenant.collection("hybridBillingInvoices").doc(invoiceId).set({
  id:invoiceId,tenantId:id,signature:"b".repeat(64),version:"hybrid-invoice-v1",
  kind:"delivery_daily",amount:152.2,status:"pending_review",date:"2026-11-23",
 });
 await tenant.collection("hybridBillingPaymentAttempts").doc("pending-"+randomUUID()).set({
  tenantId:id,invoiceId,status:"pending_review",amount:152.2,
  verification:{status:"manual_review"},slipPath:"SECRET_PENDING_PROOF",
 });
 await tenant.collection("hybridBillingAdjustments").doc("adjust-"+randomUUID()).set({
  tenantId:id,invoiceId,status:"proposed",amount:10,reason:"SECRET_REASON",
 });
 await tenant.update({revenueShareSuspended:true,hybridBillingSuspended:true});
 const result=await run();
 assert.equal(result.invoiceCount,2);
 const due=result.invoices.find(x=>x.invoiceId===invoiceId);
 assert.equal(due.firebaseStatus,"pending_review");
 assert.equal(due.grossCentsFromFirebase,15220);
 assert.equal(due.remainingBankCashDueCents,null);
 assert.equal(due.tenantAccessReleaseAllowed,false);
 for(const code of ["FIREBASE_PENDING_PAYMENT_UNSETTLED",
  "FIREBASE_ADJUSTMENT_CROSSCHECK_REQUIRED",
  "SEPARATE_TENANT_HOLD_BLOCKS_AUTOMATIC_RELEASE",
  "LEGACY_SUSPENSION_REQUIRES_INDEPENDENT_REVIEW"])
  assert.ok(due.blockerCodes.includes(code),code);
 assert.ok(!JSON.stringify(result).includes("SECRET_"));
});
test("bounded collection scans signal truncation and never claim complete source coverage",async()=>{
 const batch=db.batch();
 for(let i=0;i<202;i++)batch.set(tenant.collection("hybridBillingAdjustments")
  .doc("gap-"+String(i).padStart(4,"0")),{tenantId:id,
   invoiceId:invId,status:"proposed",amount:1});
 await batch.commit();
 const report=await run();
 assert.equal(report.partialHistory,true);
 assert.equal(report.periodAndSourceJournalCoverageVerified,false);
 assert.equal(report.canReleaseTenant,false);
 assert.ok(report.invoices.every(row=>
  row.blockerCodes.includes("FIRESTORE_FINANCE_READ_INCOMPLETE")));
});
