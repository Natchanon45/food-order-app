"use strict";

// PRIVATE / DEMO-ONLY portable 16-source report. A SHA-256 CHECKSUM checks
// bytes, NOT authorship, bank authenticity, or permission to settle money.
const { createHash } = require("node:crypto");
const { buildDemoHybridPhase10Readiness } =
  require("./hybrid-billing-phase10-readiness");

const VERSION = "hybrid_phase10_readiness_packet_v1";
const PROJECT = "demo-penguin-hybrid";
const DOMAIN = "PENGUIN-HYBRID-PHASE10-READINESS-CHECKSUM-V1\n";
const SHA = /^[a-f0-9]{64}$/;
const FINANCE = Object.freeze([
  "hybridRefundReferenceClaims", "hybridRefundInstructionClaims",
  "financeSlipClaims", "hybridBillingRefundCandidates",
  "hybridBillingAdjustments", "hybridBillingPaymentAttempts",
  "revenueSharePayments", "lalamoveWalletTopups",
  "lalamoveWalletTransactions", "hybridBillingInvoices",
  "hybridBillingAdjustmentEvents", "hybridBillingAdjustmentBalances",
]);
const KEYS = Object.freeze([
  "hybridBankKeyEnrollmentRequests", "hybridBankKeyEnrollmentReviews",
  "hybridBankKeyFingerprintClaims", "hybridBankKeySlotClaims",
]);
const FINANCE_BLOCKERS = Object.freeze([
  "EXTERNAL_BANK_STATEMENT_SOURCE_NOT_AUTHENTICATED",
  "LEGACY_OUTGOING_BANK_REFUNDS_NOT_MIGRATED",
  "CROSS_CHANNEL_AND_ARCHIVED_BANK_PAYOUTS_NOT_RECONCILED",
  "NO_ATOMIC_GLOBAL_HISTORICAL_COVERAGE_SNAPSHOT",
]);
const KEY_BLOCKERS = Object.freeze([
  "BANK_SIGNER_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED",
  "HISTORICAL_BANK_KEY_LIFECYCLE_NOT_RECONCILED",
  "NON_ATOMIC_EMULATOR_ONLY_SCAN",
]);
const keyCodes = new Set([
  "REQUEST_SHAPE_OR_TRUST_FLAG_INVALID",
  "FINGERPRINT_RESERVATION_MISMATCH",
  "KEY_SLOT_RESERVATION_MISMATCH",
  "ORPHAN_OR_SPOOFED_FINGERPRINT_CLAIM",
  "ORPHAN_OR_SPOOFED_KEY_SLOT_CLAIM",
  "ORPHAN_REVIEW_EVENT", "REVIEW_EVENT_MISMATCH",
]);
const own = (v,k) => Object.hasOwn(v,k);
const strictUtc = value => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
const fail = code => { throw new Error("HYBRID_PHASE10_PACKET_" + code); };
const sha = core => createHash("sha256")
  .update(DOMAIN+JSON.stringify(core), "utf8").digest("hex");
const counts = (input,names) => Object.fromEntries(
  names.map(name=>[name,input?.[name]]));
const filteredIssues = (items,area,unknown) => items
  .filter(t=>t?.area===area && t.priority==="integrity_exception"
    && t.code!==unknown).map(t=>t.code);

function validateCanonicalReport(report) {
  if (!report || typeof report!=="object" || Array.isArray(report)
    || report.kind!=="hybrid_phase10_unified_finance_release_readiness"
    || report.mode!=="local_demo_diagnostic_only"
    || report.status!=="blocked_real_bank_and_independent_settlement_approval"
    || report.sourcesScanned!==16 || !Array.isArray(report.tasks)
    || report.tasks.length<7 || report.tasks.length>128
    || !Number.isSafeInteger(report.financeIntegrityExceptionCount)
    || report.financeIntegrityExceptionCount<0
    || !Number.isSafeInteger(report.keyIntegrityExceptionCount)
    || report.keyIntegrityExceptionCount<0
    || !Number.isSafeInteger(report.unknownKeyIssueCount)
    || report.unknownKeyIssueCount<0
    || !Number.isSafeInteger(report.pendingInternalKeyReviews)
    || report.pendingInternalKeyReviews<0) fail("INVALID_REPORT");
  const financeKnown = filteredIssues(report.tasks,"hybrid_finance","UNKNOWN_INTEGRITY_CODE");
  const keyKnown = filteredIssues(report.tasks,"bank_signing_key","UNKNOWN_BANK_KEY_AUDIT_ISSUE");
  const financeUnknown = report.financeIntegrityExceptionCount-financeKnown.length;
  const keyUnknown = report.keyIntegrityExceptionCount-keyKnown.length;
  if (financeUnknown<0 || financeUnknown>100
    || keyUnknown!==report.unknownKeyIssueCount
    || keyUnknown<0 || keyUnknown>50
    || keyKnown.some(x=>!keyCodes.has(x))) fail("ISSUE_CARDINALITY");
  const financeIssues = [
    ...financeKnown,
    ...Array.from({length:financeUnknown},(_,i)=>"UNKNOWN_FINANCE_REPORT_"+i),
  ];
  const keyIssues = [
    ...keyKnown,
    ...Array.from({length:keyUnknown},(_,i)=>"UNKNOWN_KEY_REPORT_"+i),
  ];
  const financeAudit = {
    mode:"demo_inventory_diagnostic_only",
    status:"blocked_manual_finance_reconciliation",
    releaseReady:false,settlementAllowed:false,
    bankSourceAuthenticated:false,historicalBankCoverageVerified:false,
    atomicSnapshot:false,writesPerformed:false,
    sourcesScanned:[...FINANCE],
    counts:{...counts(report.sourceCounts?.hybridFinance,FINANCE),
      lalamoveWalletDeliveryRefundCredits:report.walletDeliveryRefundCredits},
    integrityIssueCodes:financeIssues,
    integrityIssueCount:financeIssues.length,
    blockers:[...FINANCE_BLOCKERS,...financeIssues],
  };
  const keyAudit = {
    kind:"demo_bank_key_enrollment_integrity_inventory",
    mode:"local_emulator_diagnostic_only",
    nonAtomicSnapshot:true,bankOriginAuthenticated:false,
    trustedRegistryPromoted:false,anyKeyActivated:false,
    historicalKeyCoverageVerified:false,settlementAllowed:false,
    releaseReady:false,writesPerformed:false,
    scannedCollections:[...KEYS],
    counts:counts(report.sourceCounts?.bankKeyEnrollment,KEYS),
    pendingInternalReviews:report.pendingInternalKeyReviews,
    integrityIssueCodes:keyIssues,
    integrityIssueCount:keyIssues.length,
    blockers:[...KEY_BLOCKERS,
      ...(report.pendingInternalKeyReviews?["PENDING_INTERNAL_KEY_REVIEWS"]:[]),
      ...keyIssues],
  };
  let rebuilt;
  try { rebuilt = buildDemoHybridPhase10Readiness({financeAudit,keyAudit}); }
  catch { fail("UNTRUSTED_REPORT"); }
  // Exact field ordering and allowlisted task text prohibit field injection,
  // unsupported "settled" flags, raw accounts and forged finance actions.
  if (JSON.stringify(rebuilt)!==JSON.stringify(report)) fail("NONCANONICAL_REPORT");
  return rebuilt;
}
function createDemoHybridPhase10ReviewPacket(report,{
  generatedAt=new Date().toISOString(),
}={}) {
  if (!strictUtc(generatedAt)) fail("INVALID_TIMESTAMP");
  const validated=validateCanonicalReport(report);
  const core={
    version:VERSION,projectId:PROJECT,generatedAt,
    reportKind:"local_emulator_readiness_triage_only",
    checksumIsDigitalSignature:false,
    independentlyAuthenticated:false,
    bankStatementSourceAuthenticated:false,
    finalSettlementAuthorized:false,
    realPayoutConfirmed:false,
    releaseReady:false,
    report:validated,
  };
  return Object.freeze({...core,checksumSha256:sha(core)});
}
function verifyDemoHybridPhase10ReviewPacket(packet) {
  const fields=["version","projectId","generatedAt","reportKind",
    "checksumIsDigitalSignature","independentlyAuthenticated",
    "bankStatementSourceAuthenticated","finalSettlementAuthorized",
    "realPayoutConfirmed","releaseReady","report","checksumSha256"];
  if (!packet || typeof packet!=="object" || Array.isArray(packet)
    || Object.keys(packet).length!==fields.length
    || !fields.every(x=>own(packet,x))
    || packet.version!==VERSION || packet.projectId!==PROJECT
    || packet.reportKind!=="local_emulator_readiness_triage_only"
    || !strictUtc(packet.generatedAt)
    || packet.checksumIsDigitalSignature!==false
    || packet.independentlyAuthenticated!==false
    || packet.bankStatementSourceAuthenticated!==false
    || packet.finalSettlementAuthorized!==false
    || packet.realPayoutConfirmed!==false
    || packet.releaseReady!==false
    || !SHA.test(String(packet.checksumSha256||""))) {
    fail("INVALID_PACKET_SHAPE");
  }
  const canonical=validateCanonicalReport(packet.report);
  const {checksumSha256,...core}=packet;
  if (sha({...core,report:canonical})!==checksumSha256) fail("CHECKSUM_MISMATCH");
  return Object.freeze({
    checksumConsistent:true,checksumSha256,
    independentlyAuthenticated:false,
    bankStatementSourceAuthenticated:false,
    bankPayoutConfirmed:false,
    settlementAllowed:false,productionReleaseAllowed:false,
    safeToTransferMoney:false,
  });
}
module.exports={
  createDemoHybridPhase10ReviewPacket,
  verifyDemoHybridPhase10ReviewPacket,
};
