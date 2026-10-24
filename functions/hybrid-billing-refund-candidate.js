"use strict";

// Final Phase 10 — guarded, DEMO-ONLY immutable reconciliation candidate.
// Does NOT prove transfer origin, disburse cash, mark settled/paid, modify a
// PAID invoice, consume Wallet credit or change tenant access. This is NOT a
// production refund writer; callers must independently ingest real bank data.
const { createHash } = require("node:crypto");
const { planHybridRefundReconciliation } = require("./hybrid-billing-refund-reconciliation");
const { validId, validInvoiceId } = require("./hybrid-billing-payment-policy");

// No production caller can opt-in with a boolean flag alone.
const HYBRID_REFUND_CANDIDATE_PRODUCTION_READY = false;
function requireDemoDatabase(db) {
  if (HYBRID_REFUND_CANDIDATE_PRODUCTION_READY) {
    throw new Error("HYBRID_REFUND_PRODUCTION_NOT_IMPLEMENTED");
  }
  const project = db?.app?.options?.projectId;
  const host = process.env.FIRESTORE_EMULATOR_HOST || "";
  if (project !== "demo-penguin-hybrid"
    || !/^(?:127\.0\.0\.1|localhost):[0-9]+$/.test(host)) {
    throw new Error("HYBRID_REFUND_DEMO_EMULATOR_ONLY");
  }
}
function assertSuperAdmin(snapshot) {
  const actor = snapshot?.exists ? snapshot.data() : null;
  if (!actor || actor.role !== "super_admin" || actor.active !== true) {
    throw new Error("HYBRID_REFUND_SUPER_ADMIN_REQUIRED");
  }
}
function verifyTrustedRead(doc, id, scopeLabel) {
  if (!doc?.exists || !doc.data() || doc.data().id !== id) {
    throw new Error("HYBRID_REFUND_" + scopeLabel + "_INVALID");
  }
  return doc.data();
}
/**
 * Atomic demo-only claim of a MATCHING, NOT YET TRUSTED bank refund candidate.
 * Caller supplies *synthetic* disbursement and statement snapshots. Their
 * source strings are NOT provider authentication; candidate stays unverified.
 * A real bank importer, global cross-channel duplicate integration and
 * final finance settlement are intentionally not implemented.
 */
async function recordDemoHybridRefundCandidate({
  db, tenantRef, invoiceId, adjustmentId, actorUid,
  disbursement, bankStatement, at, serverTimestamp,
} = {}) {
  requireDemoDatabase(db);
  if (!db?.runTransaction || !db?.collection || !tenantRef?.collection
    || !tenantRef?.id || !serverTimestamp) {
    throw new Error("HYBRID_REFUND_TRUSTED_TRANSACTION_REQUIRED");
  }
  validInvoiceId(invoiceId);
  validId(adjustmentId, "ADJUSTMENT_ID");
  if (!/^[a-zA-Z0-9_-]{3,160}$/.test(String(actorUid || ""))) {
    throw new Error("HYBRID_REFUND_ACTOR_INVALID");
  }
  // Disallow untrusted fields, notably arbitrary paid/settled overrides.
  const accepted = new Set(["tenantId", "invoiceId", "adjustmentId",
    "source", "state", "currency", "amountCents", "instructionId",
    "bankReferenceHash", "destinationFingerprint", "submittedAt"]);
  const bankAccepted = new Set(["tenantId", "invoiceId", "adjustmentId",
    "source", "direction", "postingStatus", "currency", "amountCents",
    "bankReferenceHash", "destinationFingerprint", "postedAt"]);
  if (!disbursement || typeof disbursement !== "object"
    || Array.isArray(disbursement)
    || !bankStatement || typeof bankStatement !== "object"
    || Array.isArray(bankStatement)
    || Object.keys(disbursement).some(key => !accepted.has(key))
    || Object.keys(bankStatement).some(key => !bankAccepted.has(key))) {
    throw new Error("HYBRID_REFUND_UNTRUSTED_EVIDENCE_FIELDS");
  }
  // Check cryptographic representation BEFORE referencing any Firestore ID.
  const hash = bankStatement.bankReferenceHash;
  if (!/^[a-f0-9]{64}$/.test(String(hash || ""))) {
    throw new Error("HYBRID_REFUND_INVALID_BANK_REFERENCE");
  }
  // An outgoing instruction is a different uniqueness dimension from its
  // posted bank reference. Hash it with a dedicated domain (no raw ID in
  // global documents). This is demo-only and not a bank authenticity check.
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(String(disbursement.instructionId || ""))) {
    throw new Error("HYBRID_REFUND_INVALID_INSTRUCTION_ID");
  }
  const instructionHash = createHash("sha256")
    .update("hybrid-refund-instruction-v1:" + disbursement.instructionId)
    .digest("hex");
  const reviewerRef = db.collection("users").doc(actorUid);
  const invoiceRef = tenantRef.collection("hybridBillingInvoices").doc(invoiceId);
  const adjustmentRef = tenantRef.collection("hybridBillingAdjustments").doc(adjustmentId);
  const reviewRef = tenantRef.collection("hybridBillingAdjustmentEvents")
    .doc(adjustmentId + "-review");
  const candidateRef = tenantRef.collection("hybridBillingRefundCandidates").doc(adjustmentId);
  const bankClaimRef = db.collection("hybridRefundReferenceClaims").doc(hash);
  const instructionClaimRef = db.collection("hybridRefundInstructionClaims")
    .doc(instructionHash);
  return db.runTransaction(async tx => {
    // All reads finish before ANY write, including actor revocation check.
    const [actor, tenantDoc, invoiceDoc, adjustmentDoc, reviewDoc,
      existingCandidate, existingClaim, existingInstruction] = await Promise.all([
        tx.get(reviewerRef), tx.get(tenantRef), tx.get(invoiceRef),
        tx.get(adjustmentRef), tx.get(reviewRef),
        tx.get(candidateRef), tx.get(bankClaimRef), tx.get(instructionClaimRef),
      ]);
    assertSuperAdmin(actor);
    if (!tenantDoc.exists || tenantDoc.data()?.billingPolicyVersion !== "hybrid_v1") {
      throw new Error("HYBRID_REFUND_TENANT_NOT_HYBRID");
    }
    const invoice = verifyTrustedRead(invoiceDoc, invoiceId, "INVOICE");
    const adjustment = verifyTrustedRead(adjustmentDoc, adjustmentId, "ADJUSTMENT");
    if (!reviewDoc.exists) throw new Error("HYBRID_REFUND_APPROVAL_MISSING");
    if (existingCandidate.exists) throw new Error("HYBRID_REFUND_CANDIDATE_ALREADY_EXISTS");
    if (existingClaim.exists) throw new Error("HYBRID_REFUND_BANK_REFERENCE_ALREADY_CLAIMED");
    if (existingInstruction.exists) {
      throw new Error("HYBRID_REFUND_INSTRUCTION_ALREADY_CLAIMED");
    }
    // Three separate active finance identities: proposer, reviewer, auditor.
    if ([adjustment.proposedBy, adjustment.reviewedBy].includes(actorUid)) {
      throw new Error("HYBRID_REFUND_SAME_ACTOR_ATTESTATION_FORBIDDEN");
    }
    const reviewEvent = reviewDoc.data();
    if (reviewDoc.id !== adjustmentId + "-review") {
      throw new Error("HYBRID_REFUND_APPROVAL_ID_CHANGED");
    }
    const preflight = planHybridRefundReconciliation({
      tenantId: tenantRef.id, invoice, adjustment, reviewEvent,
      disbursement, bankStatement, at,
      existingBankReferenceHashes: [], // atomic global claim checked above
    });
    if (preflight.settlementConfirmed !== false
      || preflight.bankSourceIntegrationReady !== false
      || preflight.writesPerformed !== false
      || preflight.bankReferenceHash !== hash) {
      throw new Error("HYBRID_REFUND_RECONCILIATION_UNSAFE");
    }
    tx.create(bankClaimRef, {
      bankReferenceHash: hash, tenantId: tenantRef.id,
      invoiceId, adjustmentId, kind: "hybrid_refund_candidate",
      createdAt: serverTimestamp, state: "unverified_candidate",
    });
    tx.create(instructionClaimRef, {
      instructionHash, tenantId: tenantRef.id,
      invoiceId, adjustmentId, kind: "hybrid_refund_candidate",
      createdAt: serverTimestamp, state: "unverified_candidate",
    });
    tx.create(candidateRef, {
      id: adjustmentId, tenantId: tenantRef.id, invoiceId,
      invoiceSignature: invoice.signature, kind: "refund_request",
      amount: preflight.amount, currency: "THB",
      instructionHash,
      bankReferenceHash: hash,
      destinationFingerprint: disbursement.destinationFingerprint,
      sourceIntegrationReady: false, settlementConfirmed: false,
      state: "awaiting_independent_bank_attestation",
      observedBy: actorUid, createdAt: serverTimestamp,
    });
    return Object.freeze({
      id: adjustmentId, invoiceId, state: "awaiting_independent_bank_attestation",
      settlementConfirmed: false, refundExecuted: false,
      bankSourceIntegrationReady: false, writesPerformed: true,
    });
  });
}
module.exports = { HYBRID_REFUND_CANDIDATE_PRODUCTION_READY,
  recordDemoHybridRefundCandidate };
