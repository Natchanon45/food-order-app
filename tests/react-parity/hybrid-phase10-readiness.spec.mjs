import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildDemoHybridPhase10Readiness, auditDemoHybridPhase10Readiness } =
  require("../../functions/hybrid-billing-phase10-readiness.js");

const FINANCE=[
  "hybridRefundReferenceClaims","hybridRefundInstructionClaims",
  "financeSlipClaims","hybridBillingRefundCandidates",
  "hybridBillingAdjustments","hybridBillingPaymentAttempts",
  "revenueSharePayments","lalamoveWalletTopups",
  "lalamoveWalletTransactions","hybridBillingInvoices",
  "hybridBillingAdjustmentEvents","hybridBillingAdjustmentBalances",
];
const KEY=[
  "hybridBankKeyEnrollmentRequests","hybridBankKeyEnrollmentReviews",
  "hybridBankKeyFingerprintClaims","hybridBankKeySlotClaims",
];
const FINANCE_REQUIRED=[
  "EXTERNAL_BANK_STATEMENT_SOURCE_NOT_AUTHENTICATED",
  "LEGACY_OUTGOING_BANK_REFUNDS_NOT_MIGRATED",
  "CROSS_CHANNEL_AND_ARCHIVED_BANK_PAYOUTS_NOT_RECONCILED",
  "NO_ATOMIC_GLOBAL_HISTORICAL_COVERAGE_SNAPSHOT",
];
const KEY_REQUIRED=[
  "BANK_SIGNER_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED",
  "HISTORICAL_BANK_KEY_LIFECYCLE_NOT_RECONCILED",
  "NON_ATOMIC_EMULATOR_ONLY_SCAN",
];
function finance({
  codes=[],counts={},overrides={},
}={}) {
  return {
    mode:"demo_inventory_diagnostic_only",
    status:"blocked_manual_finance_reconciliation",
    releaseReady:false,settlementAllowed:false,
    bankSourceAuthenticated:false,historicalBankCoverageVerified:false,
    atomicSnapshot:false,writesPerformed:false,
    sourcesScanned:[...FINANCE],
    counts:{...Object.fromEntries(FINANCE.map(k=>[k,0])),
      lalamoveWalletDeliveryRefundCredits:0,...counts},
    integrityIssueCodes:codes,integrityIssueCount:codes.length,
    blockers:[...FINANCE_REQUIRED,...codes],
    ...overrides,
  };
}
function key({
  codes=[],pending=0,counts={},overrides={},
}={}) {
  return {
    kind:"demo_bank_key_enrollment_integrity_inventory",
    mode:"local_emulator_diagnostic_only",
    nonAtomicSnapshot:true,bankOriginAuthenticated:false,
    trustedRegistryPromoted:false,anyKeyActivated:false,
    historicalKeyCoverageVerified:false,settlementAllowed:false,
    releaseReady:false,writesPerformed:false,
    scannedCollections:[...KEY],
    counts:{...Object.fromEntries(KEY.map(k=>[k,0])),...counts},
    pendingInternalReviews:pending,
    integrityIssueCodes:codes,integrityIssueCount:codes.length,
    blockers:[...KEY_REQUIRED,
      ...(pending?["PENDING_INTERNAL_KEY_REVIEWS"]:[]),...codes],
    ...overrides,
  };
}

test("empty 16-source Firestore audits always report 7 unresolved release blockers",()=>{
  const r=buildDemoHybridPhase10Readiness({
    financeAudit:finance(),keyAudit:key(),
  });
  assert.equal(r.kind,"hybrid_phase10_unified_finance_release_readiness");
  assert.equal(r.status,"blocked_real_bank_and_independent_settlement_approval");
  assert.equal(r.sourcesScanned,16);
  assert.equal(r.totalRecordsSeen,0);
  assert.equal(r.tasks.length,7);
  assert.equal(r.taskCount,7);
  assert.equal(r.bankSignerOwnerAuthenticated,false);
  assert.equal(r.bankStatementSourceAuthenticated,false);
  assert.equal(r.historicalBankSettlementCoverageVerified,false);
  assert.equal(r.independentFinalSettlementAuthorized,false);
  assert.equal(r.allSourcesAtomicSnapshot,false);
  assert.equal(r.bankTransferConfirmed,false);
  assert.equal(r.productionReleaseAllowed,false);
  assert.equal(r.eligibleForBankSettlement,false);
  assert.equal(r.writesPerformed,false);
  assert.ok(r.tasks.every(t=>t.resolved===false&&t.settlementAuthorized===false));
  assert.equal(Object.isFrozen(r),true);
  assert.equal(Object.isFrozen(r.tasks),true);
});

test("invoice exceptions and key exceptions coexist without allowing either report to override the other",()=>{
  const financialCode="CANDIDATE_PAID_INVOICE_PROVENANCE_MISSING";
  const bankCode="ORPHAN_OR_SPOOFED_FINGERPRINT_CLAIM";
  const r=buildDemoHybridPhase10Readiness({
    financeAudit:finance({codes:[financialCode],counts:{
      hybridBillingInvoices:2,
      hybridBillingAdjustments:1,
      lalamoveWalletTransactions:3,
      lalamoveWalletDeliveryRefundCredits:1,
    }}),
    keyAudit:key({codes:[bankCode],counts:{
      hybridBankKeyEnrollmentRequests:1,
      hybridBankKeyFingerprintClaims:1,
    }}),
  });
  assert.equal(r.totalRecordsSeen,8);
  assert.equal(r.financeIntegrityExceptionCount,1);
  assert.equal(r.keyIntegrityExceptionCount,1);
  assert.equal(r.taskCount,9);
  assert.ok(r.tasks.some(t=>t.area==="hybrid_finance"&&t.code===financialCode));
  assert.ok(r.tasks.some(t=>t.area==="bank_signing_key"&&t.code===bankCode));
  assert.equal(r.walletDeliveryRefundCredits,1);
  assert.equal(r.walletCreditIsOutgoingBankRefund,false);
  assert.equal(r.eligibleForBankSettlement,false);
});

test("pending internal bank review is not an integrity exception but blocks release",()=>{
  const r=buildDemoHybridPhase10Readiness({
    financeAudit:finance(),
    keyAudit:key({pending:1,counts:{hybridBankKeyEnrollmentRequests:1}}),
  });
  assert.equal(r.keyIntegrityExceptionCount,0);
  assert.equal(r.pendingInternalKeyReviews,1);
  assert.ok(r.tasks.some(t=>t.code==="PENDING_INTERNAL_KEY_REVIEWS"
    &&t.priority==="internal_review_pending"));
  assert.equal(r.productionReleaseAllowed,false);
});

test("malformed bank source flags and forged paid states are rejected",()=>{
  for(const patch of [
    {bankOriginAuthenticated:true},{trustedRegistryPromoted:true},
    {anyKeyActivated:true},{historicalKeyCoverageVerified:true},
    {settlementAllowed:true},{releaseReady:true},{writesPerformed:true},
    {nonAtomicSnapshot:false},{mode:"production_bank"},
    {scannedCollections:KEY.slice(1)},{counts:{hybridBankKeyEnrollmentRequests:501}},
  ]) assert.throws(()=>buildDemoHybridPhase10Readiness({
    financeAudit:finance(),keyAudit:key({overrides:patch}),
  }),/HYBRID_PHASE10_READINESS_/);
  for(const patch of [
    {releaseReady:true},{settlementAllowed:true},
    {bankSourceAuthenticated:true},{historicalBankCoverageVerified:true},
    {atomicSnapshot:true},{writesPerformed:true},
  ]) assert.throws(()=>buildDemoHybridPhase10Readiness({
    financeAudit:finance({overrides:patch}),keyAudit:key(),
  }),/HYBRID_FINANCE_WORKLIST_/);
});

test("missing or reordered mandatory blockers cannot be reclassified as all clear",()=>{
  const variants=[
    {blockers:[]},
    {blockers:[...KEY_REQUIRED].reverse()},
    {blockers:[...KEY_REQUIRED,"PENDING_INTERNAL_KEY_REVIEWS"]},
    {blockers:[...KEY_REQUIRED,"FAKE_BANK_APPROVED"]},
  ];
  for(const x of variants)assert.throws(()=>buildDemoHybridPhase10Readiness({
    financeAudit:finance(),keyAudit:key({overrides:x}),
  }),/HYBRID_PHASE10_READINESS_/);
  assert.throws(()=>buildDemoHybridPhase10Readiness({
    financeAudit:finance({overrides:{blockers:[]}}),keyAudit:key(),
  }),/HYBRID_FINANCE_WORKLIST_/);
});

test("inconsistent audit pending/count/issue cardinality fails closed",()=>{
  for(const patch of [
    {pendingInternalReviews:2},
    {pendingInternalReviews:-1},
    {integrityIssueCount:1},
    {integrityIssueCodes:["ORPHAN_REVIEW_EVENT","ORPHAN_REVIEW_EVENT"],
      integrityIssueCount:2,
      blockers:[...KEY_REQUIRED,"ORPHAN_REVIEW_EVENT","ORPHAN_REVIEW_EVENT"]},
    {integrityIssueCodes:["BANK_ACCOUNT:1234567890"],
      integrityIssueCount:1,blockers:[...KEY_REQUIRED]},
  ])assert.throws(()=>buildDemoHybridPhase10Readiness({
    financeAudit:finance(),keyAudit:key({overrides:patch}),
  }),/HYBRID_PHASE10_READINESS_/);
});

test("unrecognized key issue codes do not leak attacker text or source identifiers",()=>{
  const injected="<raw-bank-account>1234567890</raw-bank-account>";
  const r=buildDemoHybridPhase10Readiness({
    financeAudit:finance(),
    keyAudit:key({codes:[injected]}),
  });
  assert.equal(r.unknownKeyIssueCount,1);
  assert.ok(r.tasks.some(t=>t.code==="UNKNOWN_BANK_KEY_AUDIT_ISSUE"));
  assert.equal(JSON.stringify(r).includes(injected),false);
  assert.equal(JSON.stringify(r).includes("1234567890"),false);
  assert.equal(r.productionReleaseAllowed,false);
});

test("extra arbitrary records, bank references and private IDs never flow to sanitized output",()=>{
  const f=finance();
  f.rawBankReference="bank_1234567890";
  f.privatePayoutAccount="1234567890";
  const k=key();
  k.bankPrivateKey="-----BEGIN PRIVATE KEY-----";
  k.bankUserUID="internal_secret";
  const r=buildDemoHybridPhase10Readiness({financeAudit:f,keyAudit:k});
  for(const secret of ["bank_1234567890","1234567890",
    "BEGIN PRIVATE KEY","internal_secret","rawBankReference"]){
    assert.equal(JSON.stringify(r).includes(secret),false);
  }
  assert.equal(r.sourceCounts.hybridFinance.hybridBillingInvoices,0);
});

test("read-only combined scanner traverses all 16 sources and stays blocked on empty Emulator",async()=>{
  const observed=[];
  const emptyQuery=name=>({limit:n=>({get:async()=>{
    observed.push({name,limit:n});return {docs:[]};
  }})});
  const db={app:{options:{projectId:"demo-penguin-hybrid"}},
    collection:emptyQuery,collectionGroup:emptyQuery};
  const old=process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST="127.0.0.1:8080";
  try {
    const r=await auditDemoHybridPhase10Readiness({db,maxPerSource:50});
    assert.equal(r.sourcesScanned,16);
    assert.equal(observed.length,16);
    assert.ok(observed.every(o=>o.limit===51));
    assert.equal(r.taskCount,7);
    assert.equal(r.productionReleaseAllowed,false);
  }finally{
    if(old===undefined)delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST=old;
  }
});

test("combined scanner blocks wrong project and missing localhost Emulator host",async()=>{
  const make=projectId=>({app:{options:{projectId}},
    collection:()=>{throw Error("SHOULD_NOT_QUERY");},
    collectionGroup:()=>{throw Error("SHOULD_NOT_QUERY");}});
  const before=process.env.FIRESTORE_EMULATOR_HOST;
  try{
    process.env.FIRESTORE_EMULATOR_HOST="127.0.0.1:8080";
    await assert.rejects(auditDemoHybridPhase10Readiness({
      db:make("live-production"),
    }),/HYBRID_REFUND_HISTORY_DEMO_ONLY/);
    process.env.FIRESTORE_EMULATOR_HOST="remote:8080";
    await assert.rejects(auditDemoHybridPhase10Readiness({
      db:make("demo-penguin-hybrid"),
    }),/HYBRID_REFUND_HISTORY_DEMO_ONLY/);
  }finally{
    if(before===undefined)delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST=before;
  }
});

test("integration blocks incomplete bank-key scan after finance audit, no partial report",async()=>{
  const seen=[];
  const fakeQuery=name=>({limit:n=>({get:async()=>{
    seen.push(name);
    return {docs:name==="hybridBankKeySlotClaims" ? [
      {id:"a",ref:{path:name+"/a"},data:()=>({})},
      {id:"b",ref:{path:name+"/b"},data:()=>({})},
      {id:"c",ref:{path:name+"/c"},data:()=>({})},
    ]:[]};
  }})});
  const db={app:{options:{projectId:"demo-penguin-hybrid"}},
    collection:fakeQuery,collectionGroup:fakeQuery};
  const old=process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST="127.0.0.1:8080";
  try{
    await assert.rejects(auditDemoHybridPhase10Readiness({
      db,maxPerSource:2,
    }),/HYBRID_BANK_KEY_AUDIT_SCAN_OVERFLOW/);
    assert.equal(seen.length,16);
  }finally{
    if(old===undefined)delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST=old;
  }
});

test("new read-only readiness and CLI format are not exported from Production",()=>{
  const src=fs.readFileSync("functions/hybrid-billing-phase10-readiness.js","utf8");
  const cli=fs.readFileSync("tools/audit-hybrid-finance-demo.mjs","utf8");
  const bootstrap=fs.readFileSync("functions/bootstrap.js","utf8")
    +fs.readFileSync("functions/index.js","utf8");
  assert.doesNotMatch(bootstrap,/hybrid-billing-phase10-readiness/);
  assert.match(cli,/format=text\|json\|packet\|readiness/);
  assert.match(cli,/auditDemoHybridBankKeyHistory/);
  assert.match(cli,/buildDemoHybridPhase10Readiness/);
  assert.match(cli,/process\.exitCode = 2/);
  assert.doesNotMatch(src,/onCall\(|onSchedule\(|tx\.create\(|tx\.update\(|runTransaction\(/);
  assert.match(src,/eligibleForBankSettlement:false/);
  assert.match(src,/productionReleaseAllowed:false/);
});
