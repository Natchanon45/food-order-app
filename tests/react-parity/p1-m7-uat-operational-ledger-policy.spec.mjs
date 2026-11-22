import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {fixture,H}=require("../fixtures/m7-source-migration.synthetic.cjs");
const p=require("../../functions/m7-uat-operational-ledger-policy.js");
const src=require("../../functions/m7-source-migration-contract.js");
test("M7 operational UAT simulation balances Source gross/credit/bank/unpaid, but never books money",()=>{
 const f=fixture(),{shadow,bankClaimIds,invoiceClaimIds}=p.plan(f);
 assert.equal(shadow.invoiceCount,3);
 assert.equal(shadow.sourceGrossCents,115220);
 assert.equal(shadow.sourceCreditAppliedCents,50000);
 assert.equal(shadow.sourceBankReportedCents,50000);
 assert.equal(shadow.sourceUnpaidForReviewCents,15220);
 assert.equal(shadow.sourceCreditAccountReportedCents,0);
 assert.equal(shadow.sourcePaidOrCreditSettledCount,1);
 assert.equal(shadow.sourceWaivedOrVoidedCount,1);
 assert.equal(shadow.sourceOpenOrPendingDebtCount,1);
 assert.equal(shadow.sourceHoldRecordCount,1);
 assert.equal(shadow.sourceHoldWithoutApprovalCount,0);
 assert.equal(bankClaimIds.length,1);
 assert.equal(invoiceClaimIds.length,3);
 assert.ok(bankClaimIds.every(x=>/^[a-f0-9]{64}$/.test(x)));
 assert.ok(invoiceClaimIds.every(x=>/^[a-f0-9]{64}$/.test(x)));
 assert.ok(!JSON.stringify(shadow).includes(f.tables.merchant_platform_invoice_journal[0].invoice_key));
 for(const key of ["bankStatementSourceAuthenticated","bankCashOperationallyVerified",
  "serviceCreditOperationallyAvailable","billingInvoicesMutated",
  "tenantAccessMutated","testStripeShadowCountedAsBankCash",
  "payoutOrRefundPerformed","financialPostingAuthorized","operationalReleaseAuthorized"])
  assert.equal(shadow[key],false,key);
 assert.equal(shadow.financialShadowOnly,true);
 assert.equal(shadow.sourceIdentityNotAttested,true);
 const s=p.safeView(shadow);
 assert.equal(s.mode,p.MODE);
 assert.match(p.digestShadow(shadow),/^[a-f0-9]{64}$/);
 assert.notEqual(p.digestShadow({...shadow,sourceGrossCents:0}),p.digestShadow(shadow));
});
test("per-invoice arithmetic remains exact for Source monthly-waived and daily-settled, without release authority",()=>{
 const {shadow}=p.plan(fixture());
 const monthlyWaived=shadow.financialItems.find(x=>x.state==="waived");
 const dailySettled=shadow.financialItems.find(x=>x.state==="settled_credit");
 const monthlyOpen=shadow.financialItems.find(x=>x.state==="issued");
 assert.deepEqual([monthlyWaived?.grossCents,monthlyWaived?.sourceBankReportedCents,
  monthlyWaived?.arithmeticResidualCents],[50000,50000,0]);
 assert.deepEqual([dailySettled?.grossCents,dailySettled?.appliedCreditCents,
  dailySettled?.arithmeticResidualCents],[15220,15220,0]);
 assert.deepEqual([monthlyOpen?.grossCents,monthlyOpen?.appliedCreditCents,
  monthlyOpen?.arithmeticResidualCents,monthlyOpen?.unpaidForReviewCents],
  [50000,34780,15220,15220]);
 assert.equal(monthlyOpen.hasHoldRecord,true);
 assert.equal(monthlyOpen.hasSyntacticHoldApproval,true);
 assert.equal(monthlyOpen.releaseAuthorized,false);
 assert.equal(dailySettled.operationalInvoicePaid,false);
});
test("Source structural drift/ref duplication, overlong snapshots and invalid money reject UAT stage planning",()=>{
 for(const mutator of [
  f=>{f.tables.merchant_platform_invoice_journal[0].gross_cents=1;},
  f=>{f.tables.merchant_service_credit_accounts[0].balance_cents=99999;},
  f=>{f.tables.merchant_platform_bank_reference_claims[0].payment_attempt_id="bad";},
  f=>{f.tables.merchant_platform_invoice_journal[0].invoice_key=H("f");},
  f=>{f.tables.merchant_platform_invoice_journal[2].gross_cents=5.1;},
 ]){
  const f=fixture();mutator(f);
  assert.throws(()=>p.plan(f),/M7_UAT_LEDGER_SOURCE_INTEGRITY_INCOMPLETE/);
 }
 const over=fixture();
 const template=over.tables.merchant_platform_invoice_journal[0];
 for(let i=0;i<61;i++)over.tables.merchant_platform_invoice_journal.push({
  ...template,invoice_key:("abcdef"+String(i).padStart(58,"0")).slice(0,64)});
 over.source.inventory.merchant_platform_invoice_journal=over.tables.merchant_platform_invoice_journal.length;
 assert.throws(()=>p.plan(over),/SOURCE_INTEGRITY_INCOMPLETE|ATOMIC_DOCUMENT_LIMIT/);
});
test("malformed private shadow read cannot be converted into operational paid/release",()=>{
 const s=p.plan(fixture()).shadow;
 for(const tampered of [
  {...s,financialPostingAuthorized:true},
  {...s,operationalReleaseAuthorized:true},
  {...s,bankCashOperationallyVerified:true},
  {...s,serviceCreditOperationallyAvailable:true},
  {...s,testStripeShadowCountedAsBankCash:true},
  {...s,financialShadowOnly:false},
  {...s,financialItems:[{id:H("a"),operationalInvoicePaid:true}]},
 ]){
  assert.throws(()=>p.safeView(tampered),/UNTRUSTED_SHADOW_VIEW/);
 }
 assert.equal(src.inspect(fixture()).structuralIssuesDetected,0);
});
