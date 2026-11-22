import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const p=require("../../functions/hybrid-issued-invoice-status-policy.js");
const tenantId="tenant-live-invoice-1234";
const id="2026-11-18:monthly:fixed";
const attemptId="paymentAttempt1234567890";
const signature="a".repeat(64);
const when=new Date("2026-11-19T10:00:00.000Z");
const invoice=(status="issued",overrides={})=>({
 id,tenantId,version:"hybrid-invoice-v1",signature,kind:"fixed_monthly",
 date:"2026-11-18",amount:590,status,...overrides,
});
const attempt=(status="pending_review",overrides={})=>({
 id:attemptId,tenantId,invoiceId:id,invoiceSignature:signature,
 amount:590,status,submittedBy:"owner123456",
 submittedAt:when,verification:{provider:"slip2go",bankVerified:true},
 ...overrides,
});
const review=(action="approve",overrides={})=>({
 tenantId,invoiceId:id,attemptId,reviewerId:"admin-reviewer-12345",
 action,resultStatus:action==="approve"?"paid":"rejected",
 note:"Verified manually against an independent bank statement.",
 bankVerified:true,verifiedExternally:false,reviewedAt:when,
 ...overrides,
});
const present=(saved,at=null,proof=null)=>p.present({
 tenantId,invoiceId:id,invoice:saved,attempt:at,review:proof});
test("actual issued Firebase Invoice is visible without private fields, no bank authority",()=>{
 const result=present(invoice());
 assert.deepEqual([result.paymentStatus,result.displayStatus,
   result.canSubmitPayment,result.canPrepareLocalFile],
   ["not_submitted","issued",false,true]);
 assert.equal(result.issuerSource,"firebase_hybrid_issued_ledger");
 assert.equal(result.amount,590);
 assert.equal(result.invoiceAmountCents,59000);
 assert.equal(result.sourceM7BankReconciled,false);
 assert.equal(result.independentBankStatementVerified,false);
 assert.equal(result.operationalCashSettled,false);
 assert.equal(result.canReleaseShop,false);
 assert.ok(!JSON.stringify(result).includes(signature));
});
test("pending proof is NOT paid, missing linkage/evidence makes needs_review",()=>{
 let r=present(invoice("pending_review",{
  pendingAttemptId:attemptId,latestAttemptId:attemptId}),attempt());
 assert.equal(r.paymentStatus,"pending_review");
 assert.equal(r.canPrepareLocalFile,false);
 r=present(invoice("pending_review",{
  pendingAttemptId:attemptId,latestAttemptId:attemptId}),
 attempt("pending_review",{invoiceSignature:"f".repeat(64)}));
 assert.equal(r.paymentStatus,"needs_review");
 r=present(invoice("pending_review",{
  pendingAttemptId:attemptId,latestAttemptId:attemptId}),null);
 assert.equal(r.paymentStatus,"needs_review");
 r=present(invoice("pending_review",{
  pendingAttemptId:attemptId,latestAttemptId:attemptId}),attempt(),review());
 assert.equal(r.paymentStatus,"needs_review");
});
test("Paid requires joined server review + attempt, correct immutable amount and decision",()=>{
 const inv=invoice("paid",{paidAttemptId:attemptId,latestAttemptId:attemptId});
 const at=attempt("paid",{reviewedBy:"admin-reviewer-12345",reviewedAt:when});
 let r=present(inv,at,review());
 assert.equal(r.paymentStatus,"recorded_paid");
 assert.equal(r.displayStatus,"paid");
 assert.equal(r.operationalCashSettled,false);
 assert.equal(r.independentBankStatementVerified,false);
 r=present(inv,at,review("approve",{bankVerified:false,
  verifiedExternally:false}));
 assert.equal(r.paymentStatus,"needs_review");
 r=present(inv,at,review("approve",{bankVerified:false,
  verifiedExternally:true,note:"short"}));
 assert.equal(r.paymentStatus,"needs_review");
 r=present(inv,at,review("approve",{bankVerified:false,
  verifiedExternally:true,note:"Bank statement reviewed by admin on Nov 19."}));
 assert.equal(r.paymentStatus,"recorded_paid");
 for(const patch of [
  {reviewerId:"bad"}, {tenantId:"other-tenant"},
  {invoiceId:"2026-11-17:monthly:fixed"}, {action:"reject"},
  {reviewedAt:null}, {resultStatus:"pending_review"},
 ]){
  r=present(inv,at,review("approve",patch));
  assert.equal(r.paymentStatus,"needs_review",JSON.stringify(patch));
 }
 r=present(inv,attempt("paid",{...at,amount:590.01}),review());
 assert.equal(r.paymentStatus,"needs_review");
 r=present(invoice("paid",{paidAttemptId:attemptId,
  latestAttemptId:"differentAttempt1234567890"}),at,review());
 assert.equal(r.paymentStatus,"needs_review");
});
test("rejected requires an immutable decision; mismatch blocks file preparation",()=>{
 const inv=invoice("rejected",{latestAttemptId:attemptId});
 const at=attempt("rejected",{reviewedBy:"admin-reviewer-12345",reviewedAt:when});
 let r=present(inv,at,review("reject",{note:"wrong amount"}));
 assert.equal(r.paymentStatus,"rejected");
 assert.equal(r.canPrepareLocalFile,true);
 r=present(inv,at,review("reject",{note:"no"}));
 assert.equal(r.paymentStatus,"needs_review");
 assert.equal(r.canPrepareLocalFile,false);
});
test("corrupted stored invoice id/currency/kind/amount/date and invalid selectors fail closed",()=>{
 for(const patch of [
  {tenantId:"another-tenant"},{id:"2026-11-19:monthly:fixed"},
  {version:"unsafe"},{signature:"not-a-hash"},
  {amount:0},{amount:590.001},{date:"2026-02-31"},
  {kind:"yearly"},{status:"paid",paidAttemptId:null},
 ]){
  if(patch.status){
   assert.equal(present(invoice("issued",patch)).paymentStatus,"needs_review");
  }else{
   assert.throws(()=>present(invoice("issued",patch)),/CORRUPT_IMMUTABLE_RECORD/);
  }
 }
 const threshold=p.present({tenantId,invoiceId:"2026-11-18:delivery:trigger",
  invoice:{...invoice("issued"),id:"2026-11-18:delivery:trigger",
   kind:"delivery_threshold"}});
 assert.equal(threshold.paymentStatus,"not_submitted");
 for(const invalid of [
  {cursor:"../../user"},{limit:0},{limit:31},{limit:2.2},
  {limit:20,tenantId:"forged"},{paid:true},[],null,
 ]){
  assert.throws(()=>p.validateRequest(invalid),/HYBRID_INVOICE_/);
 }
 assert.deepEqual(p.validateRequest({}),{limit:20,cursor:null});
});
