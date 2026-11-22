import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const project="demo-penguin-hybrid";
if(process.env.GCLOUD_PROJECT!==project||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore,Timestamp}=require("firebase-admin/firestore");
if(!getApps().length)initializeApp({projectId:project});
const db=getFirestore();
const funcs=require("./m7-evidence-history"),policy=require("./m7-evidence-history-policy");
const tenantId="m7-evidence-"+randomUUID(),foreignId="m7-foreign-"+randomUUID();
const tenant=db.collection("tenants").doc(tenantId),other=db.collection("tenants").doc(foreignId);
const owner="m7-owner-"+randomUUID(),admin="m7-admin-"+randomUUID(),cashier="m7-cashier-"+randomUUID(),superId="m7-super-"+randomUUID(),foreign="m7-foreign-user-"+randomUUID();
const actor=uid=>({uid}),call=(name,data,uid=owner)=>funcs[name].run({data,auth:actor(uid)});
const paidInvoice="2026-11-22:monthly:fixed",pendingInvoice="2026-11-23:delivery:2026-11-22",rejectedInvoice="2026-11-24:monthly:fixed",brokenInvoice="2026-11-25:monthly:fixed";
const paidId="paid-attempt-"+randomUUID(),pendingId="pending-attempt-"+randomUUID(),rejectedId="rejected-attempt-"+randomUUID(),badId="tampered-attempt-"+randomUUID();
const iso=s=>Timestamp.fromDate(new Date(s));
const signature="a".repeat(64);
async function seedAttempt(id,invoiceId,status,submittedAt,{bad=false}={}){
 const ref=tenant.collection("hybridBillingPaymentAttempts").doc(id);
 await ref.set({
  id,tenantId,invoiceId,invoiceSignature:signature,amount:180.5,status,
  submittedAt:iso(submittedAt),updatedAt:iso(submittedAt),
  ...(status==="paid"?{reviewedBy:"super-reviewer-12345"}:{}),
  slipPath:"NEVER_EXPOSE_PRIVATE_SLIP_PATH",verification:{referenceId:"SECRET_BANK_REF",bankVerified:true}
 });
 const inv=tenant.collection("hybridBillingInvoices").doc(invoiceId);
 await inv.set({id:invoiceId,version:"hybrid-invoice-v1",tenantId,signature,amount:bad?120:180.5,
  status:status==="paid"?"paid":status==="rejected"?"rejected":"pending_review",
  ...(status==="paid"?{paidAttemptId:id}:status==="pending_review"?{pendingAttemptId:id}:{})});
 if(status!=="pending_review"&&!bad)
  await tenant.collection("hybridBillingPaymentEvents").doc(id+"-review").set({
   tenantId,invoiceId,attemptId:id,action:status==="paid"?"approve":"reject",
   resultStatus:status,revisorRole:"super_admin",reviewerId:"super-reviewer-12345",
   note:"NEVER_EXPOSE_PRIVATE_NOTE",bankVerified:true,
   reviewedAt:iso("2026-11-22T09:00:00.000Z")});
}
test("read-only M7 provenance: validated invoice audit, legacy evidence, no fabricated Stripe settlement",async()=>{
 await Promise.all([
  tenant.set({name:"Synthetic M7 Shop",active:true}),
  other.set({name:"Other Shop",active:true}),
  db.collection("users").doc(owner).set({active:true,tenantId,role:"owner"}),
  db.collection("users").doc(admin).set({active:true,tenantId,role:"admin"}),
  db.collection("users").doc(cashier).set({active:true,tenantId,role:"cashier"}),
  db.collection("users").doc(superId).set({active:true,role:"super_admin"}),
  db.collection("users").doc(foreign).set({active:true,tenantId:foreignId,role:"owner"}),
 ]);
 await seedAttempt(paidId,paidInvoice,"paid","2026-11-21T18:30:00.000Z");
 await seedAttempt(pendingId,pendingInvoice,"pending_review","2026-11-22T17:15:00.000Z");
 await seedAttempt(rejectedId,rejectedInvoice,"rejected","2026-11-22T08:00:00.000Z");
 await seedAttempt(badId,brokenInvoice,"paid","2026-11-22T09:00:00.000Z",{bad:true});
 const legacy=tenant.collection("revenueSharePayments");
 await legacy.doc("share-approved-abc123").set({status:"approved",reviewedBy:"system:slip2go",
  platformAmountDue:75.55,createdAt:iso("2026-11-22T08:15:00.000Z"),
  slipPath:"VERY_PRIVATE_RECEIPT",ocr:{bankAccount:"NEVER_SEND_ACCOUNT"}});
 await legacy.doc("share-pending-abc123").set({status:"pending",platformAmountDue:41.2,
  createdAt:iso("2026-11-22T08:25:00.000Z")});
 await legacy.doc("share-unsafe-abc123").set({status:"approved",platformAmountDue:32,
  createdAt:iso("2026-11-22T08:35:00.000Z")});
 const res=await call("getOwnM7FinanceEvidenceHistory",{status:"all",kind:"all"});
 assert.equal(res.source,"firebase_m7_finance_evidence_not_stripe_settlements");
 assert.equal(res.currency,"THB");
 assert.equal(res.authenticated,true);assert.equal(res.readOnly,true);
 assert.equal(res.settlementSourceAvailable,false);assert.equal(res.items.length,7);
 assert.ok(res.items.every(x=>x.tenantId===tenantId&&x.stripeSettled===false&&x.bankSettlementVerified===false&&x.verifiedStripeCents===0));
 assert.ok(!JSON.stringify(res).includes("NEVER_"));
 assert.equal(res.items.find(x=>x.paymentId===paidId).status,"recorded");
 assert.equal(res.items.find(x=>x.paymentId===paidId).recordedCents,18050);
 assert.equal(res.items.find(x=>x.paymentId===badId).status,"needs_review");
 assert.equal(res.items.find(x=>x.paymentId===badId).recordedCents,0);
 assert.equal(res.items.find(x=>x.paymentId===pendingId).status,"pending");
 assert.equal(res.items.find(x=>x.paymentId===rejectedId).status,"rejected");
 assert.equal(res.items.find(x=>x.paymentId==="share-approved-abc123").status,"recorded");
 assert.equal(res.items.find(x=>x.paymentId==="share-unsafe-abc123").status,"needs_review");
 await tenant.collection("hybridBillingInvoices").doc(paidInvoice).update({version:"invalid-version"});
 assert.equal((await call("getOwnM7FinanceEvidenceHistory",{status:"all"})).items.find(x=>x.paymentId===paidId).status,"needs_review");
 await tenant.collection("hybridBillingInvoices").doc(paidInvoice).update({version:"hybrid-invoice-v1"});

 const pending=await call("getOwnM7FinanceEvidenceHistory",{status:"pending"});
 assert.equal(pending.items.length,2);
 assert.equal((await call("getOwnM7FinanceEvidenceHistory",{status:"recorded"})).items.length,2);
 assert.equal((await call("getOwnM7FinanceEvidenceHistory",{kind:"platform"})).items.length,3);
 assert.equal((await call("getOwnM7FinanceEvidenceHistory",{kind:"delivery_daily"})).items.length,4);
 assert.deepEqual((await call("getOwnM7FinanceEvidenceHistory",{start:"2026-11-22",end:"2026-11-22"})).items.some(x=>x.paymentId===paidId),true);
 assert.deepEqual((await call("getOwnM7FinanceEvidenceHistory",{start:"2026-11-22",end:"2026-11-22"})).items.some(x=>x.paymentId===pendingId),false);
 // Platform sees only explicit selected tenant, never leak another tenant.
 const platform=await call("getPlatformM7FinanceEvidenceHistory",{tenantId},superId);
 assert.equal(platform.items.length,7);
 const blank=await call("getPlatformM7FinanceEvidenceHistory",{tenantId:""},superId);
 assert.equal(blank.selectTenant,true);assert.equal(blank.items.length,0);
 const missing=await call("getPlatformM7FinanceEvidenceHistory",{tenantId:foreignId},superId);
 assert.equal(missing.items.length,0);
});
test("strong tenant scoping and strict filters remain fail-closed",async()=>{
 for(const p of [
  {status:"verified"}, {kind:"wallet"}, {status:"recorded",end:"2026-11-31"},
  {start:"2026-12-02",end:"2026-11-30"}, {status:"pending",start:"2026-2-01"},
  {tenantId}, {status:"all",tenantId:foreignId}
 ])await assert.rejects(call("getOwnM7FinanceEvidenceHistory",p),{code:"invalid-argument"});
 for(const invalid of [{status:"paid"},{kind:"stripe"},{tenantId:"evil/id"},{tenantId:123}])
  await assert.rejects(call("getPlatformM7FinanceEvidenceHistory",invalid,superId),{code:"invalid-argument"});
 await assert.rejects(call("getOwnM7FinanceEvidenceHistory",{},cashier),{code:"permission-denied"});
 await assert.rejects(call("getOwnM7FinanceEvidenceHistory",{},superId),{code:"permission-denied"});
 await assert.rejects(call("getPlatformM7FinanceEvidenceHistory",{tenantId},owner),{code:"permission-denied"});
 const foreignResult=await call("getOwnM7FinanceEvidenceHistory",{},foreign);
 assert.equal(foreignResult.items.length,0);
 await db.collection("users").doc(admin).update({active:false});
 await assert.rejects(call("getOwnM7FinanceEvidenceHistory",{},admin),{code:"permission-denied"});
 const before=(await tenant.collection("hybridBillingInvoices").doc(paidInvoice).get()).data();
 await call("getOwnM7FinanceEvidenceHistory",{},owner);
 const after=(await tenant.collection("hybridBillingInvoices").doc(paidInvoice).get()).data();
 assert.deepEqual(before,after);
});
test("bounded 200-item per-source scan signals truncation rather than completeness",async()=>{
 const batch=db.batch(),col=tenant.collection("revenueSharePayments");
 for(let i=0;i<202;i++){
  batch.set(col.doc("large-share-"+String(i).padStart(5,"0")),{status:"pending",platformAmountDue:20,
   createdAt:iso("2026-11-22T16:00:00.000Z")});
 }
 await batch.commit();
 const result=await call("getOwnM7FinanceEvidenceHistory",{kind:"delivery_daily"});
 assert.equal(result.hasMore,true);
 assert.equal(result.items.length,200);
 assert.ok(result.items.every(x=>x.stripeSettled===false));
});
test("pure policy uses payment event timestamps in Bangkok, refuses invalid money",()=>{
 assert.equal(policy.bangkokDay("2026-11-21T18:00:00.000Z"),"2026-11-22");
 assert.equal(policy.bangkokDay("2026-11-22T17:30:00.000Z"),"2026-11-23");
 assert.equal(policy.safeMoney(NaN),null);assert.equal(policy.safeMoney(1.001),null);
 assert.equal(policy.safeMoney(-1),null);assert.equal(policy.safeMoney(18.23),1823);
 assert.equal(policy.dayValid("2026-02-30"),false);
 assert.equal(policy.dayValid("2024-02-29"),true);
 const p=policy.normalizeShare({tenantId:"t-123",tenantName:"Synthetic",paymentId:"proof-1234",
  payment:{status:"approved",reviewedBy:"system:slip2go",platformAmountDue:100}});
 assert.equal(p.status,"needs_review");
 assert.equal(p.recordedCents,0);
 const orphan=policy.normalizeHybrid({tenantId:"t-123",tenantName:"Synthetic",attemptId:"attempt-1234",
  attempt:{id:"attempt-1234",tenantId:"t-123",status:"paid",amount:100,invoiceId:"2026-11-22:monthly:fixed",
   invoiceSignature:"a".repeat(64)},
  invoice:{id:"2026-11-22:monthly:fixed",tenantId:"t-123",amount:100,signature:"a".repeat(64),
   paidAttemptId:"attempt-1234",status:"paid",version:"hybrid-invoice-v1"},
  review:{tenantId:"t-123",invoiceId:"2026-11-22:monthly:fixed",attemptId:"attempt-1234",
   resultStatus:"paid",action:"approve",reviewerId:"system:slip2go",
   reviewedAt:iso("2026-11-22T10:00:00.000Z")}});
 assert.equal(orphan.status,"needs_review");
 assert.equal(orphan.verifiedStripeCents,0);

});

test("hybrid recorded payment requires bank-review witness or substantive external confirmation",()=>{
 const id="attempt-review-123456789",invoiceId="2026-11-22:monthly:fixed",sig="a".repeat(64);
 const attempt={id,tenantId:"tenant-123",invoiceId,invoiceSignature:sig,status:"paid",
  reviewedBy:"super-reviewer",amount:100,submittedAt:iso("2026-11-22T08:00:00Z"),
  verification:{bankVerified:false}};
 const invoice={id:invoiceId,tenantId:"tenant-123",version:"hybrid-invoice-v1",signature:sig,
  status:"paid",paidAttemptId:id,amount:100};
 const review={tenantId:"tenant-123",invoiceId,attemptId:id,resultStatus:"paid",
  action:"approve",reviewerId:"super-reviewer",reviewedAt:iso("2026-11-22T08:05:00Z"),
  verifiedExternally:true,note:"ธนาคารยืนยันยอดโอนเข้าบัญชีร้านแล้วก่อนอนุมัติ"};
 const build=(a,r,i=invoice)=>policy.normalizeHybrid({tenantId:"tenant-123",tenantName:"Test",
  attemptId:id,attempt:a,invoice:i,review:r});
 assert.equal(build(attempt,review).status,"recorded");
 assert.equal(build(attempt,{...review,verifiedExternally:false}).status,"needs_review");
 assert.equal(build(attempt,{...review,note:"short"}).status,"needs_review");
 assert.equal(build(attempt,{...review,verifiedExternally:false,bankVerified:true}).status,"needs_review");
 assert.equal(build({...attempt,verification:{bankVerified:true}},
  {...review,verifiedExternally:false,bankVerified:true}).status,"recorded");
 assert.equal(build(attempt,review,{...invoice,version:"legacy-unknown"}).status,"needs_review");
 assert.equal(build(attempt,review,{...invoice,amount:100.01}).status,"needs_review");
 assert.equal(build(attempt,review,{...invoice,tenantId:"foreign"}).status,"needs_review");
 assert.equal(build(attempt,review,{...invoice,tenantId:undefined}).status,"recorded");
 assert.equal(build(attempt,review).verifiedStripeCents,0);
});
