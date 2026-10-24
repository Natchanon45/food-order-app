"use strict";

// Phase 10 private DEMO-only hand-off packet. SHA-256 detects content drift
// when independently compared with its original digest; it does NOT sign,
// authenticate the sender, attest a bank transfer, or permit settlement.
const { createHash } = require("node:crypto");
const { buildDemoHybridFinanceWorklist } =
  require("./hybrid-billing-finance-worklist");

const FORMAT = "hybrid_finance_review_packet_v1";
const PROJECT = "demo-penguin-hybrid";
const REASONS = Object.freeze([
  "EXTERNAL_BANK_STATEMENT_SOURCE_NOT_AUTHENTICATED",
  "LEGACY_OUTGOING_BANK_REFUNDS_NOT_MIGRATED",
  "CROSS_CHANNEL_AND_ARCHIVED_BANK_PAYOUTS_NOT_RECONCILED",
  "NO_ATOMIC_GLOBAL_HISTORICAL_COVERAGE_SNAPSHOT",
]);
const SOURCE_NAMES = Object.freeze([
  "hybridRefundReferenceClaims", "hybridRefundInstructionClaims",
  "financeSlipClaims", "hybridBillingRefundCandidates",
  "hybridBillingAdjustments", "hybridBillingPaymentAttempts",
  "revenueSharePayments", "lalamoveWalletTopups",
  "lalamoveWalletTransactions", "hybridBillingInvoices",
  "hybridBillingAdjustmentEvents", "hybridBillingAdjustmentBalances",
]);
const SHA = /^[a-f0-9]{64}$/;
const ownKeys = (obj, keys) => Boolean(obj && typeof obj === "object"
  && !Array.isArray(obj) && Object.keys(obj).length === keys.length
  && keys.every(key => Object.hasOwn(obj, key)));
const digest = content => createHash("sha256").update(
  "penguin-hybrid-finance-review-packet-v1\n" + JSON.stringify(content), "utf8",
).digest("hex");
const isIsoUtc = value => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;

// Rebuild a worklist from ONLY its known diagnostic codes and whitelisted
// aggregate counts. This prevents forged entries, arbitrary note strings or
// optimistic "settled" fields from passing simply by recalculating a hash.
function canonicalWorklist(input) {
  if (!input || input.kind !== "hybrid_finance_review_worklist"
    || !Array.isArray(input.items) || input.items.length < REASONS.length
    || !Number.isSafeInteger(input.unknownIntegrityCodeCount)
    || input.unknownIntegrityCodeCount < 0 || input.unknownIntegrityCodeCount > 100
    || input.items.length > 105 || !input.counts || typeof input.counts !== "object") {
    throw new Error("HYBRID_PACKET_INVALID_WORKLIST");
  }
  const actualCodes = input.items.map(item => item?.code);
  if (!REASONS.every((code, index) => actualCodes[index] === code)) {
    throw new Error("HYBRID_PACKET_REQUIRED_BLOCKERS_MISSING");
  }
  const knownIssues = actualCodes.slice(REASONS.length)
    .filter(code => code !== "UNKNOWN_INTEGRITY_CODE");
  const hasUnknown = actualCodes.includes("UNKNOWN_INTEGRITY_CODE");
  if (hasUnknown !== (input.unknownIntegrityCodeCount > 0)) {
    throw new Error("HYBRID_PACKET_UNKNOWN_ISSUE_COUNT_MISMATCH");
  }
  // The synthetic report contains no bank information. Its only role is to
  // validate that the packet matches the known immutable finance task map.
  const issues = [
    ...knownIssues,
    ...Array.from({ length: input.unknownIntegrityCodeCount },
      (_, i) => "SYNTHETIC_UNKNOWN_DIAGNOSTIC_" + i),
  ];
  const report = {
    mode: "demo_inventory_diagnostic_only",
    status: "blocked_manual_finance_reconciliation",
    releaseReady: false, settlementAllowed: false,
    bankSourceAuthenticated: false,
    historicalBankCoverageVerified: false,
    atomicSnapshot: false, writesPerformed: false,
    sourcesScanned: [...SOURCE_NAMES],
    counts: Object.fromEntries([
      ...SOURCE_NAMES.map(name => [name, input.counts[name]]),
      ["lalamoveWalletDeliveryRefundCredits",
        input.counts.lalamoveWalletDeliveryRefundCredits],
    ]),
    integrityIssueCodes: issues, integrityIssueCount: issues.length,
    blockers: [...REASONS, ...issues],
  };
  const canonical = buildDemoHybridFinanceWorklist(report);
  if (JSON.stringify(input) !== JSON.stringify(canonical)) {
    throw new Error("HYBRID_PACKET_NONCANONICAL_OR_UNSAFE_WORKLIST");
  }
  return canonical;
}

function createDemoHybridFinanceReviewPacket(worklist, {
  generatedAt = new Date().toISOString(),
} = {}) {
  if (!isIsoUtc(generatedAt)) {
    throw new Error("HYBRID_PACKET_TIMESTAMP_INVALID");
  }
  const valid = canonicalWorklist(worklist);
  const core = {
    format: FORMAT,
    projectId: PROJECT,
    generatedAt,
    reportKind: "synthetic_emulator_finance_triage",
    nonAtomicSources: true,
    bankSourceAuthenticated: false,
    bankPaymentConfirmed: false,
    historicalBankCoverageVerified: false,
    settlementAllowed: false,
    releaseReady: false,
    digitallySigned: false,
    worklist: valid,
  };
  const checksumSha256 = digest(core);
  return Object.freeze({
    ...core, checksumSha256,
    checksumIsBankAttestation: false,
  });
}

function verifyDemoHybridFinanceReviewPacket(packet) {
  const fields = [
    "format", "projectId", "generatedAt", "reportKind", "nonAtomicSources",
    "bankSourceAuthenticated", "bankPaymentConfirmed",
    "historicalBankCoverageVerified", "settlementAllowed", "releaseReady",
    "digitallySigned", "worklist", "checksumSha256", "checksumIsBankAttestation",
  ];
  if (!ownKeys(packet, fields)
    || packet.format !== FORMAT || packet.projectId !== PROJECT
    || packet.reportKind !== "synthetic_emulator_finance_triage"
    || packet.nonAtomicSources !== true
    || !isIsoUtc(packet.generatedAt)
    || packet.bankSourceAuthenticated !== false
    || packet.bankPaymentConfirmed !== false
    || packet.historicalBankCoverageVerified !== false
    || packet.settlementAllowed !== false || packet.releaseReady !== false
    || packet.digitallySigned !== false
    || packet.checksumIsBankAttestation !== false
    || !SHA.test(String(packet.checksumSha256 || ""))) {
    throw new Error("HYBRID_PACKET_SHAPE_OR_SAFETY_INVALID");
  }
  const sanitizedWorklist = canonicalWorklist(packet.worklist);
  const { checksumSha256, checksumIsBankAttestation, ...core } = packet;
  if (digest({ ...core, worklist: sanitizedWorklist }) !== checksumSha256) {
    throw new Error("HYBRID_PACKET_CHECKSUM_MISMATCH");
  }
  return Object.freeze({
    checksumConsistent: true,
    checksumSha256,
    reportIntegrityOnly: true,
    sourceAuthenticated: false,
    settlementAllowed: false,
    releaseReady: false,
    safeToTransferMoney: false,
    // A checksum is NOT a signature. If an attacker changes BOTH the body
    // and hash, authenticity requires an independent trusted record.
    independentlyAuthenticated: false,
  });
}

module.exports = {
  createDemoHybridFinanceReviewPacket,
  verifyDemoHybridFinanceReviewPacket,
};
