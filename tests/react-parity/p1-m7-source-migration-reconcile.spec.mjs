import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {fixture,H,T}=require("../fixtures/m7-source-migration.synthetic.cjs");
const p=require("../../functions/m7-source-migration-reconcile.js");
const mk=(id,amount,kind="fixed_monthly",status="issued")=>({
 tenantId:T,id,amount,kind,status,
 version:"hybrid-invoice-v1",signature:H("e")});
const documents=()=>[
 mk("2026-10-18:monthly:fixed",500),
 mk("2026-10-18:delivery:2026-10-18",152.20,"delivery_daily","paid"),
 mk("2026-11-18:monthly:fixed",500),
];
test("3 candidate Firebase Hybrid invoices share kind/day/cents with Source; no false cross-ledger certification",()=>{
 const r=p.compare(fixture(),documents());
 assert.equal(r.sourceInvoiceCount,3);
 assert.equal(r.inspectedFirebaseInvoices,3);
 assert.equal(r.matchingAmountAndKindCandidates,3);
 assert.equal(r.missingFirebaseInvoiceCandidates,0);
 assert.equal(r.conflictingInvoiceCandidates,0);
 assert.equal(r.unrepresentableSourceYearlyInvoices,0);
 assert.equal(r.extraFirebaseInvoiceCandidates,0);
 assert.ok(r.issueCodes.includes("SOURCE_TO_FIREBASE_IDS_NOT_AUTHENTICATED"));
 assert.ok(r.issueCodes.includes("SOURCE_CREDIT_ORIGIN_NOT_FIREBASE_PROVEN"));
 assert.equal(r.originalSourceProofAuthenticated,false);
 assert.equal(r.exactSourceToFirebaseSnapshotProven,false);
 assert.equal(r.financialMutationAllowed,false);
 assert.equal(r.tenantReleaseAllowed,false);
 assert.equal(r.crossChannelBankClaimsVerified,false);
 assert.equal(r.mappingOnlyAdvisory,true);
});
test("no matching target and different amount/kind/tenant/version are explicit blockers, never Paid",()=>{
 let r=p.compare(fixture(),[]);
 assert.equal(r.missingFirebaseInvoiceCandidates,3);
 assert.equal(r.financialMutationAllowed,false);
 const docs=documents();
 docs[0].amount=499;
 r=p.compare(fixture(),docs);
 assert.equal(r.conflictingInvoiceCandidates,1);
 assert.ok(r.issueCodes.includes("FIREBASE_INVOICE_AMOUNT_DRIFT"));
 docs[0].amount=500;docs[0].tenantId="another-tenant";
 r=p.compare(fixture(),docs);
 assert.equal(r.conflictingInvoiceCandidates,1);
 assert.ok(r.issueCodes.includes("FIREBASE_INVOICE_SCOPE_OR_SIGNATURE_INVALID"));
 docs[0].tenantId=T;docs[0].kind="delivery_daily";
 r=p.compare(fixture(),docs);
 assert.equal(r.conflictingInvoiceCandidates,1);
 docs[0].kind="fixed_monthly";docs[0].signature="forged";
 r=p.compare(fixture(),docs);
 assert.equal(r.conflictingInvoiceCandidates,1);
});
test("Source yearly and Firebase-only invoice are UNMAPPABLE, never inferred from amount",()=>{
 const manifest=fixture();
 const year=manifest.tables.merchant_platform_invoice_journal[2];
 year.kind="yearly";
 year.applied_service_credit_cents=0;
 const r=p.compare(manifest,documents());
 assert.equal(r.unrepresentableSourceYearlyInvoices,1);
 assert.ok(r.issueCodes.includes("SOURCE_YEARLY_HAS_NO_FIREBASE_EQUIVALENT"));
 assert.equal(r.extraFirebaseInvoiceCandidates,1);
 assert.ok(r.issueCodes.includes("FIREBASE_EXTRA_INVOICE_NEEDS_REVIEW"));
});
test("Firebase source credit manually inserted or status drift is a blocker, not a receipt",()=>{
 const docs=documents();
 docs[2].status="paid";docs[2].appliedServiceCreditCents=1;
 docs[1].status="issued";
 const r=p.compare(fixture(),docs);
 assert.ok(r.issueCodes.includes("FIREBASE_INVOICE_HAS_UNMIGRATED_CREDIT"));
 assert.ok(r.issueCodes.includes("FIREBASE_INVOICE_STATUS_DRIFT"));
 assert.equal(r.financialMutationAllowed,false);
});
test("truncated Firebase scan/duplicate local invoice cannot imply full coverage",()=>{
 const docs=documents();
 let r=p.compare(fixture(),docs,{truncated:true});
 assert.ok(r.issueCodes.includes("FIREBASE_INVOICE_SCAN_TRUNCATED"));
 docs.push({...docs[1]});
 r=p.compare(fixture(),docs);
 assert.ok(r.issueCodes.includes("FIREBASE_INVOICE_SCOPE_OR_SIGNATURE_INVALID"));
 assert.throws(()=>p.compare(fixture(),Array(202).fill(docs[0])),
  /UNBOUNDED/);
});
