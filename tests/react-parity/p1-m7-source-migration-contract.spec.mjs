import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const p=require("../../functions/m7-source-migration-contract.js");
const {fixture,H,uuid,T}=require("../fixtures/m7-source-migration.synthetic.cjs");
const copy=x=>structuredClone(x);
const row=(x,name,i=0)=>x.tables[name][i];
const TABLE=p.TABLES;
test("real 2026-11-07 Source SQL M7 schema pinned, ten tables and no unearned production release",()=>{
 const x=fixture(),r=p.inspect(x);
 assert.equal(p.shape(x),14);
 assert.equal(p.SOURCE_SCHEMA_SHA256,"1b104bf624ce96997c577e3ccc78880bf8fec3e0b9ae108e492d77317afa3eb6");
 assert.equal(r.mode,p.VERSION);
 assert.equal(r.sourceRecordCounts.merchant_platform_invoice_journal,3);
 assert.equal(r.sourceRecordCounts.merchant_service_credit_events,3);
 assert.equal(r.totalRows,14);
 assert.equal(r.structuralIssuesDetected,0);
 assert.deepEqual(r.issueCodes,[
  "BANK_REFERENCE_CLAIMS_GLOBAL_COVERAGE_UNKNOWN",
  "FIREBASE_CROSS_LEDGER_CONFLICT_NOT_EVALUATED",
  "HOLD_RELEASE_CANNOT_BE_CERTIFIED",
  "SCHEMA_SOURCE_NOT_AUTHENTICATED",
 ]);
 for(const key of ["independentBankSourceAuthenticated",
  "sourceSignatureIndependentlyVerified","snapshotConsistencyIndependentlyVerified",
  "operationalCreditPostingAllowed","tenantAccessReleaseAllowed",
  "operationalPromotionAllowed","operationalInvoicePaid","writesPerformed",
  "globalBankReferenceCoverageVerified"])
  assert.equal(r[key],false,key);
 for(const key of ["verifiedBankPaidCents","verifiedServiceCreditBalanceCents",
  "outstandingDebtCents"])assert.equal(r[key],null);
});
test("repeated order or object property insertion order yields same stable digest",()=>{
 const x=fixture(),r=p.inspect(x);
 const y=copy(x);
 y.tables.merchant_platform_invoice_journal.reverse();
 y.tables.merchant_service_credit_events.reverse();
 y.source.inventory=Object.fromEntries(Object.entries(y.source.inventory).reverse());
 const rows=y.tables.merchant_platform_invoice_journal;
 rows[0]=Object.fromEntries(Object.entries(rows[0]).reverse());
 assert.equal(p.inspect(y).manifestDigest,r.manifestDigest);
 y.tables.merchant_platform_invoice_journal[0].gross_cents=50001;
 assert.notEqual(p.inspect(y).manifestDigest,r.manifestDigest);
});
test("partial, foreign, wrong revision, raw slip path, global table missing or oversized input fails BEFORE projection",()=>{
 for(const mutate of [
  x=>delete x.source.inventory[TABLE[0]],
  x=>x.source.sourceSchemaSha256=H("f"),
  x=>x.source.sourceCommit=H("a"),
  x=>x.tenantId="../../secret",
  x=>x.tables[TABLE[0]][0].private_slip_path="/private/bank/receipt.jpg",
  x=>x.tables[TABLE[0]][0].bank_account="123-456",
  x=>delete x.tables[TABLE[1]],
  x=>x.tables[TABLE[0]]=Array(251).fill(x.tables[TABLE[0]][0]),
  x=>x.source.operatorAttestedReadOnly=false,
  x=>x.source.capturedAtUtc="invalid",
 ]){
  const x=fixture();mutate(x);
  assert.throws(()=>p.inspect(x),/M7_SOURCE_MIGRATION_/);
 }
});
function expectIssue(name,fn,code){
 const x=fixture();fn(x);
 const r=p.inspect(x);
 assert.ok(r.issueCodes.includes(code),name+" : "+r.issueCodes.join(", "));
 assert.equal(r.operationalPromotionAllowed,false);
}
test("self-reported counts and invoice fraud/duplicate/invalid money/date have explicit blockers",()=>{
 expectIssue("snapshot missing",x=>x.tables[TABLE[0]].pop(),
  "SOURCE_SNAPSHOT_COUNTS_MISMATCH");
 expectIssue("duplicate invoice key",x=>row(x,TABLE[0],1).invoice_key=row(x,TABLE[0]).invoice_key,
  "INVOICE_DUPLICATE_KEY");
 expectIssue("source signature tampered",x=>row(x,TABLE[0]).source_snapshot_sha256="x",
  "INVOICE_SCOPE_OR_STRUCTURE_INVALID");
 expectIssue("invoice paid with remaining due",x=>row(x,TABLE[0],2).state="paid",
  "INVOICE_MONEY_INCONSISTENT");
 expectIssue("yearly credit forbidden",x=>{const r=row(x,TABLE[0]);r.kind="yearly";r.applied_service_credit_cents=1;},
  "INVOICE_MONEY_INCONSISTENT");
 expectIssue("bogus date",x=>row(x,TABLE[0]).cycle_start_day="2026-02-31",
  "INVOICE_DATE_OR_POLICY_INVALID");
 expectIssue("changed global tenant",x=>row(x,TABLE[0]).tenant_id="foreign",
  "INVOICE_SCOPE_OR_STRUCTURE_INVALID");
});
test("credit account sequence/balance, conversion and offset integrity checked from ordered ledger",()=>{
 expectIssue("overissued credit",x=>row(x,TABLE[2]).balance_cents=60000,
  "CREDIT_EVENT_SEQUENCE_OR_BALANCE_MISMATCH");
 expectIssue("missing credit sequence",x=>row(x,TABLE[4],1).account_sequence_no=5,
  "CREDIT_EVENT_SEQUENCE_OR_BALANCE_MISMATCH");
 expectIssue("negative credit offset",x=>row(x,TABLE[4],1).amount_cents=100000,
  "CREDIT_EVENT_SEQUENCE_OR_BALANCE_MISMATCH");
 expectIssue("tampered conversion source invoice",x=>row(x,TABLE[3]).source_invoice_digest=H("f"),
  "CREDIT_CONVERSION_INCONSISTENT");
 expectIssue("under-threshold conversion",x=>row(x,TABLE[3]).signed_delivery_goods_cents=1000000,
  "CREDIT_CONVERSION_INCONSISTENT");
 expectIssue("converted unrelated source invoice",x=>row(x,TABLE[3]).paid_monthly_invoice_id=H("f"),
  "CREDIT_CONVERSION_INCONSISTENT");
 expectIssue("event wrong conversion",x=>row(x,TABLE[4]).conversion_id=uuid(99),
  "CREDIT_EVENT_CONVERSION_MISSING");
 expectIssue("credit posted against changed gross",x=>row(x,TABLE[4],1).target_invoice_gross_cents=20000,
  "CREDIT_INVOICE_OFFSET_MISMATCH");
 expectIssue("offset sum does not equal invoice",x=>row(x,TABLE[0],1).applied_service_credit_cents=15000,
  "CREDIT_INVOICE_OFFSET_MISMATCH");
 expectIssue("daily credit event source snapshot mismatch",
  x=>row(x,TABLE[4],1).verified_source_digest=H("f"),
  "CREDIT_INVOICE_OFFSET_MISMATCH");
 expectIssue("duplicated credit event PK",
  x=>row(x,TABLE[4],2).id=row(x,TABLE[4],1).id,
  "CREDIT_EVENT_SEQUENCE_OR_BALANCE_MISMATCH");
 expectIssue("orphan credit event",x=>row(x,TABLE[4],2).reference_invoice_id=H("f"),
  "CREDIT_EVENT_ORIGINAL_INVOICE_MISSING");
});
test("approved payment and GLOBAL bank reference cannot be forged/reassigned",()=>{
 expectIssue("bank claim orphan",x=>row(x,TABLE[6]).payment_attempt_id=uuid(99),
  "BANK_REFERENCE_CLAIM_ORPHAN");
 expectIssue("export missing approved payment for bank-paid invoice",x=>{
  x.tables[TABLE[5]]=[];x.source.inventory[TABLE[5]]=0;
 }, "SOURCE_BANK_PAID_PAYMENT_PROOF_NOT_EXPORTED");
 expectIssue("attempt invoice mismatch",x=>row(x,TABLE[5]).immutable_invoice_snapshot_sha256=H("f"),
  "PAYMENT_AMOUNT_OR_STATE_MISMATCH");
 expectIssue("attempt amount mismatch",x=>row(x,TABLE[5]).bank_cash_due_cents=49999,
  "PAYMENT_AMOUNT_OR_STATE_MISMATCH");
 expectIssue("bank document unverified",x=>delete row(x,TABLE[5]).independent_bank_statement_sha256,
  "PAYMENT_PROOF_NOT_INDEPENDENT");
 expectIssue("duplicate slip hash",x=>{
  const a=copy(row(x,TABLE[5]));a.id=uuid(99);
  x.tables[TABLE[5]].push(a);x.source.inventory[TABLE[5]]++;
 }, "PAYMENT_DUPLICATE_SLIP_HASH");
 expectIssue("claim duplicate key",x=>{
  const a=copy(row(x,TABLE[6]));x.tables[TABLE[6]].push(a);x.source.inventory[TABLE[6]]++;
 }, "BANK_REFERENCE_CLAIM_DUPLICATE");
});
test("hold snapshot, approval and adjustment must reference same immutable tenant/invoice",()=>{
 expectIssue("hold missing invoice",x=>row(x,TABLE[7]).invoice_key=H("f"),
  "HOLD_ORIGINAL_INVOICE_MISSING");
 expectIssue("hold amount mismatch",x=>row(x,TABLE[7]).verified_bank_paid_cents=1,
  "HOLD_MONEY_OR_STATE_INCONSISTENT");
 expectIssue("orphan hold audit",x=>row(x,TABLE[8]).hold_id=uuid(99),
  "HOLD_EVENT_ORPHAN");
 expectIssue("forged hold approval",x=>row(x,TABLE[9]).immutable_invoice_sha256=H("f"),
  "HOLD_APPROVAL_POLICY_INVALID");
 expectIssue("cutoff earlier than due",x=>row(x,TABLE[9]).cutoff_bangkok_day="2026-11-17",
  "HOLD_APPROVAL_POLICY_INVALID");
 expectIssue("orphan adjustment",x=>row(x,TABLE[1]).invoice_key=H("f"),
  "ADJUSTMENT_ORIGINAL_INVOICE_MISSING");
 expectIssue("missing signed adjustment digest",x=>row(x,TABLE[1]).authorization_sha256="forged",
  "ADJUSTMENT_AUDIT_INVALID");
 expectIssue("unsupported adjustment action",x=>row(x,TABLE[1]).event_kind="tampered",
  "ADJUSTMENT_AUDIT_INVALID");
});
test("entirely empty source tenant cannot be called fully migrated or operational-ready",()=>{
 const x=fixture();
 for(const key of p.TABLES){x.tables[key]=[];x.source.inventory[key]=0;}
 const result=p.inspect(x);
 assert.equal(result.totalRows,0);
 assert.equal(result.structuralIssuesDetected,0);
 assert.equal(result.operationalPromotionAllowed,false);
 assert.equal(result.missingOperationalProof,true);
 assert.equal(result.globalBankReferenceCoverageVerified,false);
});
