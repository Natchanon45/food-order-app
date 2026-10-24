import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const { buildDemoHybridPhase10Readiness } =
  require("../../functions/hybrid-billing-phase10-readiness.js");
const { createDemoHybridPhase10ReviewPacket,
  verifyDemoHybridPhase10ReviewPacket } =
  require("../../functions/hybrid-billing-phase10-review-packet.js");

const FINANCE=["hybridRefundReferenceClaims","hybridRefundInstructionClaims",
  "financeSlipClaims","hybridBillingRefundCandidates",
  "hybridBillingAdjustments","hybridBillingPaymentAttempts",
  "revenueSharePayments","lalamoveWalletTopups",
  "lalamoveWalletTransactions","hybridBillingInvoices",
  "hybridBillingAdjustmentEvents","hybridBillingAdjustmentBalances"];
const KEYS=["hybridBankKeyEnrollmentRequests",
  "hybridBankKeyEnrollmentReviews",
  "hybridBankKeyFingerprintClaims","hybridBankKeySlotClaims"];
const FB=["EXTERNAL_BANK_STATEMENT_SOURCE_NOT_AUTHENTICATED",
  "LEGACY_OUTGOING_BANK_REFUNDS_NOT_MIGRATED",
  "CROSS_CHANNEL_AND_ARCHIVED_BANK_PAYOUTS_NOT_RECONCILED",
  "NO_ATOMIC_GLOBAL_HISTORICAL_COVERAGE_SNAPSHOT"];
const KB=["BANK_SIGNER_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED",
  "HISTORICAL_BANK_KEY_LIFECYCLE_NOT_RECONCILED",
  "NON_ATOMIC_EMULATOR_ONLY_SCAN"];
const timestamp="2026-10-24T11:11:11.000Z";
const copy=x=>JSON.parse(JSON.stringify(x));
function auditFixture({financeIssues=[],keyIssues=[],pending=0,
  financeCounts={},keyCounts={}}={}) {
  const financeAudit={
    mode:"demo_inventory_diagnostic_only",
    status:"blocked_manual_finance_reconciliation",
    releaseReady:false,settlementAllowed:false,
    bankSourceAuthenticated:false,historicalBankCoverageVerified:false,
    atomicSnapshot:false,writesPerformed:false,
    sourcesScanned:[...FINANCE],
    counts:{...Object.fromEntries(FINANCE.map(x=>[x,0])),
      lalamoveWalletDeliveryRefundCredits:0,...financeCounts},
    integrityIssueCodes:financeIssues,integrityIssueCount:financeIssues.length,
    blockers:[...FB,...financeIssues],
  };
  const keyAudit={
    kind:"demo_bank_key_enrollment_integrity_inventory",
    mode:"local_emulator_diagnostic_only",
    nonAtomicSnapshot:true,bankOriginAuthenticated:false,
    trustedRegistryPromoted:false,anyKeyActivated:false,
    historicalKeyCoverageVerified:false,settlementAllowed:false,
    releaseReady:false,writesPerformed:false,
    scannedCollections:[...KEYS],
    counts:{...Object.fromEntries(KEYS.map(x=>[x,0])),...keyCounts},
    pendingInternalReviews:pending,
    integrityIssueCodes:keyIssues,integrityIssueCount:keyIssues.length,
    blockers:[...KB,...(pending?["PENDING_INTERNAL_KEY_REVIEWS"]:[]),...keyIssues],
  };
  return buildDemoHybridPhase10Readiness({financeAudit,keyAudit});
}
const make=options=>createDemoHybridPhase10ReviewPacket(
  auditFixture(options),{generatedAt:timestamp},
);
const recalc=packet=>{
  const {checksumSha256,...core}=packet;
  return createHash("sha256").update(
    "PENGUIN-HYBRID-PHASE10-READINESS-CHECKSUM-V1\n"+
    JSON.stringify(core),"utf8").digest("hex");
};

test("empty 16-source packet always contains 7 mandatory release blockers",()=>{
  const p=make();
  assert.equal(p.version,"hybrid_phase10_readiness_packet_v1");
  assert.equal(p.projectId,"demo-penguin-hybrid");
  assert.equal(p.report.sourcesScanned,16);
  assert.equal(p.report.taskCount,7);
  assert.equal(p.checksumIsDigitalSignature,false);
  assert.equal(p.independentlyAuthenticated,false);
  assert.equal(p.bankStatementSourceAuthenticated,false);
  assert.equal(p.finalSettlementAuthorized,false);
  assert.equal(p.realPayoutConfirmed,false);
  assert.equal(p.releaseReady,false);
  const verified=verifyDemoHybridPhase10ReviewPacket(p);
  assert.equal(verified.checksumConsistent,true);
  assert.equal(verified.settlementAllowed,false);
  assert.equal(verified.productionReleaseAllowed,false);
  assert.equal(verified.safeToTransferMoney,false);
});

test("deterministic SHA256 packet and JSON-file roundtrip",()=>{
  const config={financeIssues:["CANDIDATE_AMOUNT_MISMATCH"],
    keyIssues:["ORPHAN_REVIEW_EVENT"],
    pending:1,
    keyCounts:{hybridBankKeyEnrollmentRequests:1},
  };
  const one=make(config),two=make(config);
  assert.deepEqual(one,two);
  assert.match(one.checksumSha256,/^[a-f0-9]{64}$/);
  assert.equal(one.checksumSha256,recalc(one));
  assert.equal(verifyDemoHybridPhase10ReviewPacket(copy(one)).checksumSha256,
    one.checksumSha256);
  assert.equal(one.report.taskCount,10);
});

test("tampering counts, priority, Thai task text, source list or timestamp breaks integrity",()=>{
  const original=make({financeCounts:{hybridBillingInvoices:2}});
  for(const change of [
    p=>{p.report.sourceCounts.hybridFinance.hybridBillingInvoices=3;},
    p=>{p.report.tasks[0].actionTH="ปล่อยเงินได้แล้ว";},
    p=>{p.report.tasks[0].priority="approved";},
    p=>{p.report.tasks.pop();},
    p=>{p.report.totalRecordsSeen=999;},
    p=>{p.generatedAt="2026-10-24T11:11:12.000Z";},
  ]){
    const bad=copy(original);change(bad);
    assert.throws(()=>verifyDemoHybridPhase10ReviewPacket(bad),
      /HYBRID_PHASE10_PACKET_/);
  }
});

test("recomputed hash does NOT legitimize forged money movement, bank identity, or signatures",()=>{
  const original=make();
  for(const change of [
    p=>{p.report.productionReleaseAllowed=true;},
    p=>{p.report.eligibleForBankSettlement=true;},
    p=>{p.report.bankStatementSourceAuthenticated=true;},
    p=>{p.report.walletCreditIsOutgoingBankRefund=true;},
    p=>{p.report.writesPerformed=true;},
    p=>{p.independentlyAuthenticated=true;},
    p=>{p.finalSettlementAuthorized=true;},
    p=>{p.realPayoutConfirmed=true;},
    p=>{p.checksumIsDigitalSignature=true;},
  ]){
    const bad=copy(original);change(bad);
    bad.checksumSha256=recalc(bad);
    assert.throws(()=>verifyDemoHybridPhase10ReviewPacket(bad),
      /HYBRID_PHASE10_PACKET_/);
  }
});

test("recomputed hash does not allow injected bank account or changed task descriptions",()=>{
  const original=make();
  for(const change of [
    p=>{p.rawBankAccount="1234567890";},
    p=>{p.report.rawSlip="1234567890";},
    p=>{p.report.tasks[0].actionTH="โอนเงิน 123-456-7890";},
    p=>{p.report.tasks[0].recipientAccount="1234567890";},
    p=>{p.report.tasks[0].resolved=true;},
    p=>{p.report.sourceCounts.bankKeyEnrollment.providerSecret="1234567890";},
  ]){
    const bad=copy(original);change(bad);
    bad.checksumSha256=recalc(bad);
    assert.throws(()=>verifyDemoHybridPhase10ReviewPacket(bad),
      /HYBRID_PHASE10_PACKET_/);
  }
});

test("unknown finance and key error strings stay redacted in exported JSON",()=>{
  const injected="<bank>123-456-7890</bank>";
  const packet=make({financeIssues:[injected],keyIssues:[injected]});
  const text=JSON.stringify(packet);
  assert.equal(text.includes(injected),false);
  assert.equal(text.includes("123-456-7890"),false);
  assert.ok(text.includes("UNKNOWN_INTEGRITY_CODE"));
  assert.ok(text.includes("UNKNOWN_BANK_KEY_AUDIT_ISSUE"));
  assert.equal(verifyDemoHybridPhase10ReviewPacket(packet).settlementAllowed,false);
});

test("synthetic Wallet delivery credit never becomes an external bank refund",()=>{
  const p=make({financeCounts:{lalamoveWalletTransactions:2,
    lalamoveWalletDeliveryRefundCredits:1}});
  assert.equal(p.report.walletDeliveryRefundCredits,1);
  assert.equal(p.report.walletCreditIsOutgoingBankRefund,false);
  assert.equal(p.report.bankTransferConfirmed,false);
  assert.equal(verifyDemoHybridPhase10ReviewPacket(p).safeToTransferMoney,false);
});

test("malformed UTC, invalid project and arbitrary bank-origin fields reject",()=>{
  const p=make();
  assert.throws(()=>createDemoHybridPhase10ReviewPacket(auditFixture(),
    {generatedAt:"2026-02-30T11:11:11.000Z"}),/INVALID_TIMESTAMP/);
  for(const mutate of [
    x=>{x.generatedAt="2026-10-24";},
    x=>{x.projectId="live-bank-prod";},
    x=>{x.bankProviderAuthenticated=true;},
  ]){
    const bad=copy(p);mutate(bad);bad.checksumSha256=recalc(bad);
    assert.throws(()=>verifyDemoHybridPhase10ReviewPacket(bad),
      /HYBRID_PHASE10_PACKET_/);
  }
  const malformedChecksum={...copy(p),checksumSha256:"AA"};
  assert.throws(()=>verifyDemoHybridPhase10ReviewPacket(malformedChecksum),
    /HYBRID_PHASE10_PACKET_INVALID_PACKET_SHAPE/);
});

test("source worklists are not mutated by packet generation or offline validation",()=>{
  const report=auditFixture({keyIssues:["REVIEW_EVENT_MISMATCH"]});
  const before=copy(report);
  const p=createDemoHybridPhase10ReviewPacket(report,{generatedAt:timestamp});
  assert.deepEqual(report,before);
  assert.equal(p.report.productionReleaseAllowed,false);
  assert.equal(p.report.bankTransferConfirmed,false);
  assert.equal(verifyDemoHybridPhase10ReviewPacket(p).checksumConsistent,true);
});

test("offline Node verifier yields exit 2 with only checksum-consistent status; corrupted file fails",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"hybrid-phase10-"));
  try{
    const pathname=path.join(dir,"readiness-packet.json");
    fs.writeFileSync(pathname,JSON.stringify(make()));
    const cmd=file=>spawnSync(process.execPath,
      ["tools/verify-hybrid-phase10-packet.mjs",file],{
        cwd:process.cwd(),encoding:"utf8",timeout:5000,
        env:{...process.env,GCLOUD_PROJECT:"production-live",
          FIRESTORE_EMULATOR_HOST:"",HYBRID_FINANCE_AUDIT_DEMO_ACK:""},
      });
    const good=cmd(pathname);
    assert.equal(good.status,2,good.stderr);
    const output=JSON.parse(good.stdout);
    assert.equal(output.status,"checksum_consistent_only");
    assert.equal(output.independentlyAuthenticated,false);
    assert.equal(output.bankPayoutConfirmed,false);
    assert.equal(output.productionReleaseAllowed,false);
    const bad=copy(make());bad.report.tasks[0].actionTH="APPROVE BANK PAYOUT";
    fs.writeFileSync(pathname,JSON.stringify(bad));
    const rejected=cmd(pathname);
    assert.notEqual(rejected.status,2);
    assert.equal(rejected.stdout.trim(),"");
    assert.match(rejected.stderr,/HYBRID_PHASE10_PACKET_/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test("CLI remains gated to local demo before SDK; old finance-packet format intact",()=>{
  const cli=fs.readFileSync("tools/audit-hybrid-finance-demo.mjs","utf8");
  assert.match(cli,/format=text\|json\|packet\|readiness\|readiness-packet/);
  assert.match(cli,/createDemoHybridPhase10ReviewPacket\(readiness\)/);
  assert.match(cli,/assertDemoEnvironment\(process\.env\)/);
  assert.ok(cli.indexOf("assertDemoEnvironment(process.env)")
    <cli.indexOf('fnRequire("firebase-admin/app")'));
  assert.match(cli,/createDemoHybridFinanceReviewPacket\(worklist\)/);
  assert.match(cli,/process\.exitCode = 2/);
});

test("no Production Cloud Functions or settlement writers export Phase 10 packets",()=>{
  const src=fs.readFileSync("functions/hybrid-billing-phase10-review-packet.js","utf8");
  const cli=fs.readFileSync("tools/verify-hybrid-phase10-packet.mjs","utf8");
  const production=fs.readFileSync("functions/index.js","utf8")
    +fs.readFileSync("functions/bootstrap.js","utf8");
  assert.doesNotMatch(production,/hybrid-billing-phase10-review-packet/);
  assert.doesNotMatch(src+cli,/onCall\(|onSchedule\(|runTransaction\(|tx\.create\(|tx\.update\(|fetch\(|uploadBytes\(/);
  assert.match(src,/releaseReady:false/);
  assert.match(src,/safeToTransferMoney:false/);
});
