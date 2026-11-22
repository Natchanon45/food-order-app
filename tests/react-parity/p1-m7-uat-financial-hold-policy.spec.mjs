import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {fixture,H}=require("../fixtures/m7-source-migration.synthetic.cjs");
const p=require("../../functions/m7-uat-financial-hold-policy.js");
const clone=x=>structuredClone(x);
test("Bangkok day conversion is explicit and never assumes computer timezone",()=>{
 assert.equal(p.bangkokDay("2026-11-21T17:00:00.000Z"),"2026-11-22");
 assert.equal(p.bangkokDay("2026-11-21T16:59:59.000Z"),"2026-11-21");
 assert.throws(()=>p.bangkokDay("2026-11-22"),/TIME_INVALID/);
});
test("Source hold candidate: overdue debt is NOT an authorized automatic sales suspension",()=>{
 const out=p.assess(fixture());
 assert.equal(out.asOfBangkokDay,"2026-11-22");
 assert.equal(out.checkedInvoices,3);
 assert.equal(out.overdueCandidateCount,1);
 assert.equal(out.unsignedOrMissingApprovalCount,2);
 assert.equal(out.originalSourceHmacVerified,false);
 assert.equal(out.cutoffTimeCertified,false);
 assert.equal(out.tenantCanSell,null);
 assert.equal(out.tenantAccessReleaseAllowed,false);
 assert.equal(out.tenantOrderGateModified,false);
 const row=out.entries.find(x=>x.state==="overdue_candidate_no_enforcement");
 assert.equal(row.kind,"monthly");
 assert.equal(row.residualSourceReportedCents,15220);
 assert.equal(row.signedApprovalIndependentlyAuthenticated,false);
 assert.equal(row.tenantAccessReleaseAllowed,false);
});
test("on cutoff day is ambiguous without signed clock/grace, never assumes 00:20",()=>{
 const m=fixture();m.source.capturedAtUtc="2026-11-19T10:00:00.000Z";
 const row=p.assess(m).entries.find(x=>x.reportedHoldState==="open");
 assert.equal(row.state,"cutoff_hour_not_certified");
 m.source.capturedAtUtc="2026-11-18T10:00:00.000Z";
 assert.equal(p.assess(m).entries.find(x=>x.reportedHoldState==="open").state,
  "future_deadline_candidate");
});
test("pending slip and disputed hold retain review even after a hypothetical deadline",()=>{
 const m=fixture();
 m.tables.merchant_platform_invoice_journal[2].state="pending_review";
 let row=p.assess(m).entries.find(x=>x.reportedHoldState==="open");
 assert.equal(row.state,"pending_slip_never_pays_hold");
 assert.equal(p.assess(m).pendingSlipCount,1);
 m.tables.merchant_payment_obligation_holds[0].state="disputed";
 row=p.assess(m).entries.find(x=>x.reportedHoldState==="disputed");
 assert.equal(row.state,"disputed_hold_requires_review");
 assert.equal(row.tenantAccessReleaseAllowed,false);
});
test("resolved source hold still cannot override legacy/manual/security restrictions",()=>{
 const m=fixture();
 const invoice=m.tables.merchant_platform_invoice_journal[2];
 const hold=m.tables.merchant_payment_obligation_holds[0];
 // Set a consistent full credit bank amount locally for pure simulation.
 invoice.gross_cents=34780;
 invoice.state="settled_credit";hold.gross_cents=34780;hold.state="resolved";
 m.tables.merchant_service_credit_events[2].target_invoice_gross_cents=34780;
 const out=p.assess(m,{separateLegacyOrSecurityHold:true});
 const row=out.entries.find(x=>x.reportedHoldState==="resolved");
 assert.equal(row.state,"resolved_candidate_not_approved");
 assert.equal(out.resolvedCandidateCount,1);
 assert.equal(out.separateLegacyOrSecurityHold,true);
 assert.equal(out.tenantCanSell,null);
 assert.equal(out.tenantAccessReleaseAllowed,false);
 assert.equal(row.tenantOrderGateModified,false);
});
test("forged adjustment or tampered approved hold cannot assert waived/released",()=>{
 const m=fixture();
 m.tables.merchant_payment_obligation_holds[0].state="waived";
 m.tables.merchant_platform_invoice_journal[2].state="waived";
 let row=p.assess(m).entries.find(x=>x.reportedHoldState==="waived");
 assert.equal(row.state,"waiver_source_audit_required");
 assert.equal(row.tenantAccessReleaseAllowed,false);
 const inv=m.tables.merchant_platform_invoice_journal[2];
 m.tables.merchant_platform_invoice_adjustment_events.push({
  tenant_id:m.tenantId,id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  invoice_key:inv.invoice_key,event_kind:"fee_waived",
  prior_snapshot_sha256:inv.immutable_invoice_sha256,
  proposed_snapshot_sha256:inv.immutable_invoice_sha256,
  authorization_sha256:H("e"),event_digest:H("f"),
  actor_id:"operator-three"});
 m.source.inventory.merchant_platform_invoice_adjustment_events++;
 row=p.assess(m).entries.find(x=>x.reportedHoldState==="waived");
 assert.equal(row.state,"waiver_candidate_not_approved");
 assert.equal(row.signedApprovalIndependentlyAuthenticated,false);
});
