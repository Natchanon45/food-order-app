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
  ["hybridBillingInvoices", "group"],
  ["hybridBillingAdjustmentEvents", "group"],
  ["hybridBillingAdjustmentBalances", "group"],
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
  const issues = new Set();
  const add = code => issues.add(code);
  const scopedKey = (tenantId, id) => tenantId + "/" + id;
  const scopedIndex = (collection, type, idField) => {
    const docs = new Map();
    for (const entry of rows[collection]) {
      const data = entry.value;
      const tenantId = data.tenantId, id = data[idField];
      if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(tenantId || ""))
        || typeof id !== "string" || id !== entry.id
        || entry.path !== "tenants/" + tenantId + "/" + collection + "/" + id
        || docs.has(scopedKey(tenantId, id))) {
        add(type + "_IDENTITY_OR_SCOPE_INVALID");
        continue;
      }
      docs.set(scopedKey(tenantId, id), data);
    }
    return docs;
  };
  const references = new Map(rows.hybridRefundReferenceClaims.map(doc => [doc.id, doc.value]));
  const instructions = new Map(rows.hybridRefundInstructionClaims.map(doc => [doc.id, doc.value]));
  const invoices = scopedIndex("hybridBillingInvoices", "INVOICE", "id");
  const adjustments = scopedIndex("hybridBillingAdjustments", "ADJUSTMENT", "id");
  // Events and balances historically had no id field in their payloads.
  // Index them by Firestore document ID with strict canonical paths.
  const indexByDocumentId = (collection, label) => {
    const docs = new Map();
    for (const entry of rows[collection]) {
      const v = entry.value, tenantId = v.tenantId;
      if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(tenantId || ""))
        || entry.path !== "tenants/" + tenantId + "/" + collection + "/" + entry.id
        || docs.has(scopedKey(tenantId, entry.id))) {
        add(label + "_IDENTITY_OR_SCOPE_INVALID");
        continue;
      }
      docs.set(scopedKey(tenantId, entry.id), v);
    }
    return docs;
  };
  const events = indexByDocumentId("hybridBillingAdjustmentEvents", "ADJUSTMENT_EVENT");
  const balances = indexByDocumentId("hybridBillingAdjustmentBalances", "ADJUSTMENT_BALANCE");
  const safeCents = amount => {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0
      || !Number.isSafeInteger(Math.round(amount * 100))
      || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) return null;
    return Math.round(amount * 100);
  };

  const candidateIndex = scopedIndex("hybridBillingRefundCandidates", "CANDIDATE", "id");
  for (const [key, c] of candidateIndex) {
    const inv = invoices.get(scopedKey(c.tenantId, c.invoiceId));
    const adj = adjustments.get(key);
    const event = events.get(scopedKey(c.tenantId, c.id + "-review"));
    if (!inv || inv.status !== "paid" || inv.signature !== c.invoiceSignature
      || !HASH.test(String(inv.signature || ""))) {
      add("CANDIDATE_PAID_INVOICE_PROVENANCE_MISSING");
    }
    if (!adj || adj.invoiceId !== c.invoiceId || adj.status !== "approved"
      || adj.kind !== "refund_request" || adj.invoiceSignature !== c.invoiceSignature
      || adj.externallySettled !== false) {
      add("CANDIDATE_APPROVED_ADJUSTMENT_MISSING");
    }
    if (!event || event.invoiceId !== c.invoiceId || event.adjustmentId !== c.id
      || event.resultStatus !== "approved" || event.action !== "approve"
      || event.invoiceSignature !== c.invoiceSignature
      || event.reviewerId !== adj?.reviewedBy
      || event.externallySettled !== false) {
      add("CANDIDATE_INDEPENDENT_REVIEW_MISSING");
    }
    const amount = safeCents(c.amount);
    if (amount === null || amount !== adj?.amountCents
      || amount !== safeCents(adj?.amount)
      || (inv && amount > safeCents(inv.amount))) {
      add("CANDIDATE_AMOUNT_MISMATCH");
    }
    if (!adj?.proposedBy || !adj?.reviewedBy || adj.proposedBy === adj.reviewedBy
      || !c.observedBy || [adj.proposedBy, adj.reviewedBy].includes(c.observedBy)) {
      add("CANDIDATE_SEPARATION_OF_DUTIES_MISSING");
    }
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
    const claim = record.value;
    const candidate = candidateIndex.get(scopedKey(claim.tenantId, claim.adjustmentId));
    if (!HASH.test(record.id) || claim[kind] !== record.id
      || !candidate || candidate[kind] !== record.id
      || claim.invoiceId !== candidate.invoiceId) {
      add(label + "_ORPHAN_OR_CONFLICT");
    }
  }

  const reservations = new Map();
  for (const [key, adj] of adjustments) {
    const inv = invoices.get(scopedKey(adj.tenantId, adj.invoiceId));
    const cents = safeCents(adj.amount);
    if (!inv || adj.invoiceSignature !== inv.signature
      || !HASH.test(String(inv.signature || ""))
      || cents === null || adj.amountCents !== cents
      || cents > safeCents(inv.amount)) {
      add("ADJUSTMENT_INVOICE_OR_AMOUNT_MISMATCH");
    }
    const ev = events.get(scopedKey(adj.tenantId, adj.id + "-review"));
    if (adj.status === "approved" || adj.status === "rejected") {
      if (!ev || ev.adjustmentId !== adj.id || ev.invoiceId !== adj.invoiceId
        || ev.invoiceSignature !== adj.invoiceSignature
        || ev.resultStatus !== adj.status
        || ev.reviewerId !== adj.reviewedBy
        || ev.action !== (adj.status === "approved" ? "approve" : "reject")
        || !adj.proposedBy || adj.proposedBy === adj.reviewedBy) {
        add("ADJUSTMENT_REVIEW_EVENT_INCOMPLETE");
      }
    } else if (adj.status !== "proposed" || ev) {
      add("ADJUSTMENT_INVALID_STATUS_OR_PREMATURE_REVIEW");
    }
    const reservationKey = scopedKey(adj.tenantId, adj.invoiceId);
    const current = reservations.get(reservationKey) || { count: 0, cents: 0 };
    if (adj.status !== "rejected" && cents != null) current.cents += cents;
    current.count += 1;
    reservations.set(reservationKey, current);
  }
  for (const [key, reservation] of reservations) {
    const balance = balances.get(key);
    const invoice = invoices.get(key);
    if (!balance || !invoice || balance.invoiceId !== invoice.id
      || balance.invoiceSignature !== invoice.signature
      || balance.invoiceAmountCents !== safeCents(invoice.amount)
      || balance.count !== reservation.count || balance.reservedCents !== reservation.cents
      || !Number.isSafeInteger(reservation.cents)
      || reservation.cents > safeCents(invoice.amount)) {
      add("ADJUSTMENT_RESERVED_BALANCE_MISMATCH");
    }
  }
  for (const [key] of balances) {
    if (!reservations.has(key)) add("ADJUSTMENT_BALANCE_ORPHAN");
  }
  for (const [key, event] of events) {
    const adj = adjustments.get(scopedKey(event.tenantId, event.adjustmentId));
    if (!adj || key !== scopedKey(event.tenantId, event.adjustmentId + "-review")) {
      add("ADJUSTMENT_REVIEW_EVENT_ORPHAN");
    }
  }
  return [...issues].sort();
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
    integrityIssueCodes: Object.freeze(issues),
    blockers: Object.freeze(blockers),
  });
}
module.exports = { auditDemoHybridRefundHistory };
