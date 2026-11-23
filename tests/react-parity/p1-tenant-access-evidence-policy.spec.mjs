import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const p=require("./tenant-access-evidence-policy");
const id="p12e-tenant-"+randomUUID().slice(0,8);
const expiry="2027-11-17T16:59:59.999Z";
const start="2026-10-18T03:30:00.000Z";
const at=new Date("2026-11-23T10:00:00.000Z");
const base=()=>({
 id,name:"Example Shop",slug:"p12e-shop-01",
 active:true,planCode:"yearly",subscriptionStatus:"active",
 subscriptionExpiresAt:expiry,gracePeriodDays:3,
 firstActivatedAt:start,trialStartsAt:start,
 ownerUid:"example-owner",
 m7FinanceAccessStatus:"not_suspended",
 m7AdminTestOverrideMode:"auto",
 bankAccountNumber:"987654321",stripeSecretKey:"should-never-leak",
});
const slug=ten=>({
 tenantId:id,active:ten.active,subscriptionStatus:ten.subscriptionStatus,
 subscriptionExpiresAt:ten.subscriptionExpiresAt,gracePeriodDays:ten.gracePeriodDays,
});
const run=(change={},indexChange)=> {
 const tenant={...base(),...change};
 return p.inspect({tenantId:id,tenant,
  slugIndex:indexChange===null?null:{...slug(tenant),...indexChange},now:at});
};
const reason=(result,key)=>result.reasonCodes.includes(p.REASONS[key]);
test("all metadata valid -> no recorded hold, NEVER verified access or balance",()=>{
 const result=run();
 assert.equal(result.ok,true);
 assert.equal(result.readOnly,true);
 assert.equal(result.mode,"p12e_source_access_evidence_triage");
 assert.equal(result.state,"no_recorded_restriction_unverified");
 assert.equal(result.canSell,null);
 assert.equal(result.canReleaseTenant,false);
 assert.equal(result.canIssueInvoice,false);
 assert.equal(result.canSettleMoney,false);
 assert.equal(result.canApplyCredit,false);
 assert.equal(result.financialBalanceKnown,false);
 assert.equal(result.certifiedOpenInvoiceCount,null);
 assert.equal(result.certifiedOutstandingCents,null);
 assert.equal(result.sourceOriginalHoldSignatureVerified,false);
 assert.equal(result.independentBankCashVerified,false);
 assert.equal(result.originalInvoiceJournalCertified,false);
 assert.equal(result.sourceCreditLedgerCertified,false);
 assert.equal(result.tenantSlugCoherent,true);
 assert.deepEqual(result.reasonCodes,[]);
 assert.deepEqual(result.sourceProofGaps,p.SOURCE_GAPS);
 assert.match(result.snapshotDigest,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(result).includes("987654321"),false);
 assert.equal(JSON.stringify(result).includes("should-never-leak"),false);
});
test("money in arbitrary tenant fields never becomes bank cash nor certified M7 invoice debt",()=>{
 const result=run({m7FinanceAccessStatus:"suspended",
  m7FinanceAccessReason:"m7_overdue_invoice",m7MaturedInvoiceHolds:5,
  m7InvoiceUnpaidCents:9999999999999,hasVerifiedPayment:true,
  latestBankRef:"fake-bank-ref",stripeTestPaid:true});
 assert.equal(result.state,"recorded_restriction");
 assert.ok(reason(result,"M7_RECORDED_HOLD_UNVERIFIED"));
 assert.equal(result.certifiedOpenInvoiceCount,null);
 assert.equal(result.certifiedOutstandingCents,null);
 assert.equal(result.canReleaseTenant,false);
 for(const sensitive of ["9999999999999","fake-bank-ref","hasVerifiedPayment",
  "stripeTestPaid"])assert.ok(!JSON.stringify(result).includes(sensitive));
});
test("independent manual/security restriction outranks TEST allow metadata",()=>{
 const result=run({active:false,suspensionReason:"manual_security",
  m7AdminTestOverrideMode:"allow",
  m7FinanceAccessReason:"superadmin_test_open"});
 assert.equal(result.state,"recorded_restriction");
 assert.ok(reason(result,"TENANT_INACTIVE"));
 assert.ok(reason(result,"MANUAL_SECURITY_SUSPENSION"));
 assert.ok(reason(result,"TEST_OVERRIDE_METADATA_ONLY"));
 assert.equal(result.canSell,null);
});
test("explicit Revenue Share and Hybrid holds remain independent of invoice metadata",()=>{
 const rs=run({revenueShareSuspended:true});
 assert.ok(reason(rs,"LEGACY_DELIVERY_SHARE_HOLD"));
 assert.equal(rs.state,"recorded_restriction");
 const hybrid=run({hybridBillingSuspended:true});
 assert.ok(reason(hybrid,"HYBRID_BILLING_HOLD"));
 assert.equal(hybrid.state,"recorded_restriction");
 const combined=run({revenueShareSuspended:true,
  hybridBillingSuspended:true,m7FinanceAccessStatus:"suspended"});
 assert.ok(reason(combined,"LEGACY_DELIVERY_SHARE_HOLD"));
 assert.ok(reason(combined,"HYBRID_BILLING_HOLD"));
 assert.ok(reason(combined,"M7_RECORDED_HOLD_UNVERIFIED"));
});
test("membership suspended/expired is independent of finance invoice paid state",()=>{
 for(const status of ["suspended","expired","past_due","cancelled"]){
  const r=run({subscriptionStatus:status});
  assert.equal(r.state,"recorded_restriction");
  assert.ok(reason(r,"LEGACY_MEMBERSHIP_SUSPENDED"));
 }
 const r=run({subscriptionStatus:"active",subscriptionExpiresAt:
  "2026-11-01T16:59:59.999Z",gracePeriodDays:3});
 assert.ok(reason(r,"LEGACY_MEMBERSHIP_EXPIRED"));
});
test("exact expiry plus grace boundary requires strict integer, not float or string",()=>{
 const expiryAt="2026-11-20T10:00:00.000Z";
 const boundary=new Date("2026-11-23T10:00:00.000Z");
 const a={...base(),subscriptionExpiresAt:expiryAt};
 const atBoundary=p.inspect({tenantId:id,tenant:a,slugIndex:slug(a),
  now:boundary});
 assert.ok(!reason(atBoundary,"LEGACY_MEMBERSHIP_EXPIRED"));
 const over=p.inspect({tenantId:id,tenant:a,slugIndex:slug(a),
  now:new Date(boundary.getTime()+1)});
 assert.ok(reason(over,"LEGACY_MEMBERSHIP_EXPIRED"));
 for(const invalid of [-1,31,"3",1.5,NaN]){
  const r=run({gracePeriodDays:invalid});
  assert.ok(reason(r,"MEMBERSHIP_GRACE_INVALID"));
  assert.equal(r.state,"review_required");
 }
});
test("missing expiry/activation and unset Owner never create a free trial or fake active store",()=>{
 const r=run({ownerUid:"",firstActivatedAt:null,
  trialStartsAt:null,subscriptionExpiresAt:null});
 assert.equal(r.state,"review_required");
 assert.ok(reason(r,"MEMBERSHIP_EXPIRY_MISSING"));
 assert.ok(reason(r,"ORIGINAL_ACTIVATION_UNVERIFIED"));
 assert.equal(r.canSell,null);
 assert.equal(r.canReleaseTenant,false);
});
test("M7 manual financial review remains a review case, never apparent permission",()=>{
 const r=run({m7FinanceAccessStatus:"review_required"});
 assert.equal(r.state,"review_required");
 assert.ok(reason(r,"M7_FINANCE_REVIEW_REQUIRED"));
 assert.equal(r.canSell,null);
});

test("malformed subscription/M7/TEST values fail to claim unblocked access",()=>{
 const invalid=run({subscriptionStatus:"eternal",
  m7FinanceAccessStatus:"paid_and_unblocked",
  m7AdminTestOverrideMode:"production_force_allow"});
 assert.equal(invalid.state,"review_required");
 assert.ok(reason(invalid,"MEMBERSHIP_STATUS_UNKNOWN"));
 assert.ok(reason(invalid,"FINANCIAL_STATE_UNKNOWN"));
 assert.ok(reason(invalid,"TEST_OVERRIDE_MALFORMED"));
});
test("no tenantSlugs index or foreign tenant slug is mandatory manual review",()=>{
 const missing=run({},null);
 assert.equal(missing.state,"review_required");
 assert.ok(reason(missing,"TENANT_SLUG_INDEX_MISSING"));
 assert.equal(missing.tenantSlugCoherent,false);
 const foreign=run({},{tenantId:"other-tenant"});
 assert.equal(foreign.state,"review_required");
 assert.ok(reason(foreign,"TENANT_SLUG_INDEX_CONFLICT"));
 assert.equal(foreign.tenantSlugCoherent,false);
});
test("stale public slug finance/access fields cannot silently override canonical tenant",()=>{
 for(const indexChange of [
  {active:false},{subscriptionStatus:"suspended"},
  {subscriptionExpiresAt:"2028-01-02T00:00:00.000Z"},
  {gracePeriodDays:5},
 ]){
  const r=run({},indexChange);
  assert.equal(r.state,"review_required");
  assert.ok(reason(r,"TENANT_SLUG_INDEX_CONFLICT"));
  assert.equal(r.canSell,null);
 }
});
test("sha digest changes when a recorded restriction changes and never authenticates Source",()=>{
 const a=run(),b=run({revenueShareSuspended:true});
 assert.notEqual(a.snapshotDigest,b.snapshotDigest);
 assert.equal(a.sourceOriginalHoldSignatureVerified,false);
 assert.equal(b.sourceOriginalHoldSignatureVerified,false);
 assert.equal(a.canSell,null);
 assert.equal(b.canSell,null);
});
test("strict selector and clock, malformed input fail closed",()=>{
 for(const tenantId of ["","a","../../../tenants","abc@email","a".repeat(129)]){
  assert.throws(()=>p.inspect({tenantId,tenant:base(),now:at}),
   /TENANT_ACCESS_EVIDENCE_ID_INVALID/);
 }
 assert.throws(()=>p.inspect({tenantId:id,tenant:null,now:at}),
  /TENANT_ACCESS_EVIDENCE_TENANT_INVALID/);
 assert.throws(()=>p.inspect({tenantId:id,tenant:base(),now:new Date("not-date")}),
  /TENANT_ACCESS_EVIDENCE_CLOCK_INVALID/);
});
test("projection is independent of metadata insertion order and does not mutate input",()=>{
 const x=base(),y=Object.fromEntries(Object.entries(x).reverse()),
  index=slug(x);
 const prior=JSON.stringify(x);
 const a=p.inspect({tenantId:id,tenant:x,slugIndex:index,now:at});
 const b=p.inspect({tenantId:id,tenant:y,slugIndex:index,now:at});
 assert.equal(a.snapshotDigest,b.snapshotDigest);
 assert.equal(JSON.stringify(x),prior);
 assert.deepEqual(a.reasonCodes,b.reasonCodes);
 assert.deepEqual(a.reasonCodes,[...a.reasonCodes].sort());
 assert.equal(new Set(a.reasonCodes).size,a.reasonCodes.length);
});
