import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const p=require("../../functions/m7-operational-readiness-policy");
const tenantId="tenant-operational-demo-1",invoiceId="2026-11-22:monthly:fixed";
const tenant={active:true,billingPolicyVersion:"hybrid_v1"};
const invoice={id:invoiceId,tenantId,version:"hybrid-invoice-v1",
 signature:"a".repeat(64),kind:"fixed_monthly",amount:500,status:"issued"};
const base=()=>({tenantId,tenant,invoiceId,invoice});
test("Firebase Invoice by itself cannot authenticate Source M7 ledger bank cash or credit even at Paid",()=>{
 const issued=p.assessInvoice(base());
 assert.equal(issued.grossCentsFromFirebase,50000);
 assert.equal(issued.sourceBankVerifiedCents,null);
 assert.equal(issued.remainingBankCashDueCents,null);
 assert.equal(issued.sourceCreditBalanceCents,null);
 assert.equal(issued.sourceOperationalPaid,false);
 assert.equal(issued.tenantAccessReleaseAllowed,false);
 assert.deepEqual(p.M7_GAPS.filter(x=>issued.blockerCodes.includes(x)),p.M7_GAPS);
 const paid=p.assessInvoice({...base(),invoice:{...invoice,status:"paid",
   paidAttemptId:"attempt-1234567890"}});
 assert.equal(paid.sourceOperationalPaid,false);
 assert.ok(paid.blockerCodes.includes(p.EXTRA.PAID_WITHOUT_MATCHING_REVIEW));
 assert.equal(paid.firebaseRecordedOnlyCents,0);
});
test("Superadmin-reviewed Firestore paid status is labeled recorded-only, never verified source bank cash",()=>{
 const attempt={id:"attempt-1234567890",tenantId,invoiceId,
   invoiceSignature:invoice.signature,amount:500,status:"paid",
   reviewedBy:"super-12345",verification:{bankVerified:true}};
 const review={tenantId,invoiceId,attemptId:attempt.id,resultStatus:"paid",
   action:"approve",reviewerId:"super-12345",bankVerified:true};
 const result=p.assessInvoice({...base(),invoice:{...invoice,status:"paid",
   paidAttemptId:attempt.id},attempts:[attempt],reviews:{[attempt.id]:review}});
 assert.equal(result.firebaseRecordedOnlyCents,50000);
 assert.equal(result.sourceBankVerifiedCents,null);
 assert.equal(result.ledgerCoverageVerified,false);
 assert.equal(result.creditPostingAllowed,false);
 assert.equal(result.invoicePaidWriterAuthorized,false);
});
test("Stripe TEST Shadow Ledger is never bank cash, and credit/hold reports fail closed",()=>{
 const row=p.assessInvoice({...base(),invoice:{...invoice,
  appliedServiceCreditCents:10000},tenant:{...tenant,revenueShareSuspended:true,
  subscriptionStatus:"suspended"},shadows:[{tenantId,invoiceId,status:"verified_test"}],
  adjustments:[{tenantId,invoiceId,status:"proposed"}],partialHistory:true});
 for(const code of [p.EXTRA.TEST_SHADOW_PRESENT,p.EXTRA.ADJUSTMENTS_PRESENT,
  p.EXTRA.SEPARATE_HOLD,p.EXTRA.CREDIT_FIELDS_PRESENT,p.EXTRA.HISTORY_TRUNCATED])
   assert.ok(row.blockerCodes.includes(code),code);
 assert.equal(row.stripeTestShadowCount,1);
 assert.equal(row.sourceServiceCreditAppliedCents,null);
 assert.equal(row.tenantAccessReleaseAllowed,false);
 const summary=p.report({tenantId,tenant,
  documents:[invoice],shadows:[{invoiceId,status:"verified_test"}]});
 assert.equal(summary.ok,true);
 assert.equal(summary.mode,"m7_source_finance_gap_read_only");
 assert.equal(summary.canPostOperationalInvoicePaid,false);
 assert.equal(summary.canApplyServiceCredit,false);
 assert.equal(summary.canReleaseTenant,false);
 assert.equal(summary.realCashReceivedNotProven,true);
 assert.equal(summary.stripeTestShadowIsBankCash,false);
 assert.equal(summary.invoiceCount,1);
 assert.equal(summary.writesPerformed,false);
 assert.ok(!JSON.stringify(summary).includes("slip2go"));
});
test("tampered invoice, wrong tenant, invalid money, pending proof and multiple attempts expose blockers",()=>{
 for(const patch of [
  {tenantId:"foreign-tenant"},
  {signature:"forged"},
  {version:"test"},
  {amount:50.001},
  {status:"weird"},
  {kind:"yearly"},
 ]){
  const row=p.assessInvoice({...base(),invoice:{...invoice,...patch}});
  assert.equal(row.grossCentsFromFirebase,null);
  assert.ok(row.blockerCodes.includes(p.EXTRA.INVOICE_INVALID));
 }
 const row=p.assessInvoice({...base(),attempts:[
  {tenantId,invoiceId,status:"pending_review"},
  {tenantId,invoiceId,status:"pending_review"}],
 });
 assert.ok(row.blockerCodes.includes(p.EXTRA.MULTIPLE_PAYMENT_ATTEMPTS));
 assert.ok(row.blockerCodes.includes(p.EXTRA.PENDING_PAYMENT));
 assert.equal(row.sourceBankVerifiedCents,null);
 assert.throws(()=>p.report({tenantId,tenant,documents:[invoice,invoice]}),
  /DUPLICATE_INVOICE/);
 assert.throws(()=>p.report({tenantId,tenant,documents:Array(31).fill(invoice)}),
  /TENANT_INVALID/);
});
