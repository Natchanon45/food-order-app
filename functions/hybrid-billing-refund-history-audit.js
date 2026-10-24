"use strict";

// FINAL Phase 10 — private, read-only historical finance inventory.
// This is a DIAGNOSTIC, never certification of actual bank payout history.
// Matching Firestore claims does not authenticate historical bank statements.
const HASH = /^[a-f0-9]{64}$/;
const MAX_PER_SOURCE = 500;
const SOURCES = Object.freeze([
  ["hybridRefundReferenceClaims", "global"],
  ["hybridRefundInstructionClaims", "global"],
  ["financeSlipClaims", "global"],
  ["hybridBillingRefundCandidates", "group"],
  ["hybridBillingAdjustments", "group"],
  ["hybridBillingPaymentAttempts", "group"],
  ["revenueSharePayments", "group"],
  ["lalamoveWalletTopups", "group"],
  ["lalamoveWalletTransactions", "group"],
]);

function requireDemoInventory(db) {
  const project = db?.app?.options?.projectId;
  const host = process.env.FIRESTORE_EMULATOR_HOST || "";
  if (project !== "demo-penguin-hybrid"
    || !/^(?:localhost|127\.0\.0\.1):[0-9]+$/.test(host)
    || !db?.collection || !db?.collectionGroup) {
    throw new Error("HYBRID_REFUND_HISTORY_DEMO_ONLY");
  }
}
async function scanBounded(query, max, name) {
  const snapshot = await query.limit(max + 1).get();
  if (!snapshot || !Array.isArray(snapshot.docs)
    || snapshot.docs.length > max) {
    throw new Error("HYBRID_REFUND_HISTORY_LIMIT_" + name);
  }
  const seen = new Set();
  return snapshot.docs.map(doc => {
    if (!doc || !doc.id || seen.has(doc.id + "|" + (doc.ref?.path || ""))
      || typeof doc.data !== "function") {
      throw new Error("HYBRID_REFUND_HISTORY_INVALID_" + name);
    }
    seen.add(doc.id + "|" + (doc.ref?.path || ""));
    return { id: doc.id, path: doc.ref?.path || "", value: doc.data() || {} };
  });
}
function countsOnly(rows) {
  return Object.fromEntries(SOURCES.map(([name]) => [name, rows[name].length]));
}
function recordIntegrityIssues(rows) {
  const issues = [];
  const add = code => { if (!issues.includes(code)) issues.push(code); };
  const references = new Map(rows.hybridRefundReferenceClaims.map(doc => [doc.id, doc.value]));
  const instructions = new Map(rows.hybridRefundInstructionClaims.map(doc => [doc.id, doc.value]));
  const candidates = new Map();
  for (const entry of rows.hybridBillingRefundCandidates) {
    const c = entry.value;
    const key = c.tenantId + "/" + c.id;
    if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(c.tenantId || ""))
      || !/^[A-Za-z0-9_-]{16,80}$/.test(String(c.id || ""))
      || c.id !== entry.id
      || entry.path !== "tenants/" + c.tenantId + "/hybridBillingRefundCandidates/" + c.id
      || candidates.has(key)) {
      add("CANDIDATE_IDENTITY_OR_SCOPE_INVALID");
      continue;
    }
    candidates.set(key, c);
    if (!HASH.test(String(c.bankReferenceHash || ""))
      || !HASH.test(String(c.instructionHash || ""))) {
      add("CANDIDATE_HASH_MISSING_OR_INVALID");
    }
    if (c.state !== "awaiting_independent_bank_attestation"
      || c.settlementConfirmed !== false || c.sourceIntegrationReady !== false) {
      add("CANDIDATE_UNTRUSTED_SETTLEMENT_FLAG");
    }
    for (const [hash, claim, label] of [
      [c.bankReferenceHash, references.get(c.bankReferenceHash), "BANK_REFERENCE"],
      [c.instructionHash, instructions.get(c.instructionHash), "OUTGOING_INSTRUCTION"],
    ]) {
      if (!HASH.test(String(hash || ""))
        || !claim || claim.tenantId !== c.tenantId || claim.adjustmentId !== c.id
        || claim.invoiceId !== c.invoiceId || claim.state !== "unverified_candidate") {
        add(label + "_INDEX_INCOMPLETE");
      }
    }
  }
  for (const [claimRows, kind, label] of [
    [rows.hybridRefundReferenceClaims, "bankReferenceHash", "BANK_REFERENCE"],
    [rows.hybridRefundInstructionClaims, "instructionHash", "OUTGOING_INSTRUCTION"],
  ]) for (const record of claimRows) {
    const claim = record.value, matching = candidates.get(claim.tenantId + "/" + claim.adjustmentId);
    if (!HASH.test(record.id)
      || claim[kind] !== record.id || !matching
      || matching[kind] !== record.id || claim.invoiceId !== matching.invoiceId) {
      add(label + "_ORPHAN_OR_CONFLICT");
    }
  }
  return issues.sort();
}

/**
 * Server-driven bounded read of *known* Firestore collections. This does
 * NOT scan banks, old manual refunds, external payment providers, other DBs
 * or archives; no amount of empty Firestore collections proves completeness.
 * Returned counts & issue codes contain no raw bank/account/user records.
 */
async function auditDemoHybridRefundHistory({ db, maxPerSource = 100 } = {}) {
  requireDemoInventory(db);
  if (!Number.isSafeInteger(maxPerSource)
    || maxPerSource < 1 || maxPerSource > MAX_PER_SOURCE) {
    throw new Error("HYBRID_REFUND_HISTORY_SCAN_LIMIT_INVALID");
  }
  const rows = {};
  // Avoid parallel queries making expensive, partially observed reports.
  // These reads are NOT an atomic snapshot; no release decision is possible.
  for (const [name, kind] of SOURCES) {
    rows[name] = await scanBounded(
      kind === "global" ? db.collection(name) : db.collectionGroup(name),
      maxPerSource, name);
  }
  const issues = recordIntegrityIssues(rows);
  const walletRefundCount = rows.lalamoveWalletTransactions.filter(row =>
    row.value.type === "delivery_refund" && row.value.direction === "credit").length;
  const blockers = [
    "EXTERNAL_BANK_STATEMENT_SOURCE_NOT_AUTHENTICATED",
    "LEGACY_OUTGOING_BANK_REFUNDS_NOT_MIGRATED",
    "CROSS_CHANNEL_AND_ARCHIVED_BANK_PAYOUTS_NOT_RECONCILED",
    "NO_ATOMIC_GLOBAL_HISTORICAL_COVERAGE_SNAPSHOT",
    ...issues,
  ];
  return Object.freeze({
    mode: "demo_inventory_diagnostic_only",
    status: "blocked_manual_finance_reconciliation",
    releaseReady: false, settlementAllowed: false,
    historicalBankCoverageVerified: false, bankSourceAuthenticated: false,
    writesPerformed: false, atomicSnapshot: false,
    sourcesScanned: Object.freeze(SOURCES.map(([name]) => name)),
    counts: Object.freeze({
      ...countsOnly(rows),
      // Wallet credit is not an outgoing bank transfer.
      lalamoveWalletDeliveryRefundCredits: walletRefundCount,
    }),
    integrityIssueCount: issues.length,
    blockers: Object.freeze(blockers),
  });
}
module.exports = { auditDemoHybridRefundHistory };
