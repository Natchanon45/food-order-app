"use strict";

// Internal historical paid-Delivery receipt repair CANDIDATE (NOT exported).
// A client date or uploaded slip is not independent payment provenance.
// The only way to pass this guard is a server-owned live bank/provider verifier.
// No production verifier exists yet: default behavior is a hard rejection.
const { createHash } = require("node:crypto");
const { Timestamp, FieldValue } = require("firebase-admin/firestore");
const { paidDeliverySale } = require("./hybrid-billing-orders");

const ID = /^[A-Za-z0-9_-]{8,128}$/;
const ORDER_ID = /^[A-Za-z0-9_-]{1,256}$/;
const REFERENCE = /^[A-Za-z0-9._/: -]{8,160}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const ALLOWED_SOURCE = new Set(["independent_bank_record", "lalamove_provider_api"]);
const sha = value => createHash("sha256").update(value).digest("hex");
const cents = value => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e9) return null;
  const rounded = Math.round(value * 100);
  return Math.abs(value * 100 - rounded) < 0.00001 ? rounded : null;
};

function verifyIndependentReceipt(proof, now) {
  // proof must come from an independently queried bank/provider adapter, NOT
  // the web/Callable request, a slip filename, or user-supplied payment time.
  if (!proof || proof.verified !== true || !ALLOWED_SOURCE.has(proof.source)
    || typeof proof.reference !== "string" || !REFERENCE.test(proof.reference.trim())
    || !DIGEST.test(proof.evidenceSha256)
    || !Number.isSafeInteger(proof.grossAmountCents) || proof.grossAmountCents < 0
    || !(proof.paidAt instanceof Date) || !Number.isFinite(proof.paidAt.getTime())
    || proof.paidAt.getTime() < Date.UTC(2020, 0, 1) || proof.paidAt > now
    || !(proof.checkedAt instanceof Date) || !Number.isFinite(proof.checkedAt.getTime())
    || proof.checkedAt > now || now.getTime() - proof.checkedAt.getTime() > 15 * 60 * 1000) {
    throw Error("HYBRID_HISTORICAL_INDEPENDENT_PROOF_REQUIRED");
  }
  const reference = proof.reference.trim().toUpperCase();
  return { source: proof.source, referenceHash: sha("hybrid_history:" + proof.source + ":" + reference),
    bankSettlementHash: sha("hybrid_v1:" + reference),
    evidenceSha256: proof.evidenceSha256, paidAt: proof.paidAt,
    grossAmountCents: proof.grossAmountCents };
}

/**
 * Internal, non-callable correction. A future SERVER-OWNED adapter must first
 * independently verify real payment and return proof for this exact order.
 * Never wire resolveIndependentPayment to browser data or slip-only evidence.
 * Invoice/period seals and settlement are NEVER rewritten. Any already-sealed
 * period must be separately assessed for immutable credit/debit treatment.
 */
async function reconcileHybridHistoricalPaidReceipt({
  db, tenantId, orderId, caseId, reviewerUid, resolveIndependentPayment,
  now = new Date(), serverTimestamp = () => FieldValue.serverTimestamp(),
}) {
  if (!db || ![tenantId, caseId, reviewerUid].every(x => typeof x === "string" && ID.test(x))
    || typeof orderId !== "string" || !ORDER_ID.test(orderId)
    || !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw Error("HYBRID_HISTORICAL_BAD_REQUEST");
  }
  if (typeof resolveIndependentPayment !== "function") {
    throw Error("HYBRID_HISTORICAL_PROVIDER_NOT_CONNECTED");
  }
  // The resolver is server-only and cannot take payment timestamps or amounts
  // from a caller. Its independent answer is checked again against stored order.
  const proof = verifyIndependentReceipt(await resolveIndependentPayment({
    tenantId, orderId, caseId,
  }), now);
  const tenantRef = db.collection("tenants").doc(tenantId);
  const orderRef = tenantRef.collection("orders").doc(orderId);
  const caseRef = tenantRef.collection("hybridBillingReceiptCorrections").doc(caseId);
  const claimRef = db.collection("platformHybridHistoricalProofReferences").doc(proof.referenceHash);
  const bankClaimRef = db.collection("platformHybridPaymentReferences").doc(proof.bankSettlementHash);
  const reviewerRef = db.collection("users").doc(reviewerUid);
  return db.runTransaction(async tx => {
    const [tenant, order, prior, claim, bankClaim, reviewer] = await Promise.all([
      tx.get(tenantRef), tx.get(orderRef), tx.get(caseRef),
      tx.get(claimRef), tx.get(bankClaimRef), tx.get(reviewerRef),
    ]);
    if (!reviewer.exists || reviewer.data()?.active !== true || reviewer.data()?.role !== "super_admin") {
      throw Error("HYBRID_HISTORICAL_SUPER_ADMIN_REQUIRED");
    }
    if (!tenant.exists || tenant.data()?.billingPolicyVersion !== "hybrid_v1"
      || tenant.data()?.hybridBillingEnabled !== true) {
      throw Error("HYBRID_HISTORICAL_NOT_HYBRID");
    }
    if (!order.exists || order.data()?.orderType !== "delivery"
      || order.data()?.paymentStatus !== "paid") {
      throw Error("HYBRID_HISTORICAL_NOT_PAID_DELIVERY");
    }
    const original = order.data();
    if (prior.exists) {
      const old = prior.data() || {};
      if (old.tenantId !== tenantId || old.orderId !== orderId
        || old.referenceHash !== proof.referenceHash
        || old.evidenceSha256 !== proof.evidenceSha256
        || old.paidAt?.toMillis?.() !== proof.paidAt.getTime()
        || order.data()?.hybridPaidAtCorrectionCase !== caseId
        || order.data()?.paidAt?.toMillis?.() !== proof.paidAt.getTime()) {
        throw Error("HYBRID_HISTORICAL_CASE_CONFLICT");
      }
      return { caseId, orderId, corrected: false, alreadyCorrected: true,
        adjustmentReviewRequired: true };
    }
    if (original.paidAt?.toDate || original.hybridPaidAtCorrectionCase) {
      throw Error("HYBRID_HISTORICAL_CANONICAL_ALREADY_EXISTS");
    }
    const received = cents(original.totalAmount ?? original.total);
    const shipping = cents(original.deliveryFee ?? 0);
    if (received === null || shipping === null || shipping > received
      || received !== proof.grossAmountCents) {
      throw Error("HYBRID_HISTORICAL_ORDER_PROOF_AMOUNT_MISMATCH");
    }
    // Validate all existing financial fields with the independent time injected,
    // but never take the original ISO date as the proof of payment.
    paidDeliverySale({ ...original, paidAt: Timestamp.fromDate(proof.paidAt) });
    if (claim.exists || (proof.source === "independent_bank_record" && bankClaim.exists)) {
      throw Error("HYBRID_HISTORICAL_REFERENCE_ALREADY_USED");
    }
    const stamp = Timestamp.fromDate(proof.paidAt);
    tx.create(claimRef, { tenantId, orderId, caseId, source: proof.source,
      evidenceSha256: proof.evidenceSha256, createdAt: serverTimestamp() });
    tx.create(caseRef, {
      tenantId, orderId, caseId, policyVersion: "hybrid_v1",
      referenceHash: proof.referenceHash, evidenceSha256: proof.evidenceSha256,
      verificationSource: proof.source, paidAt: stamp,
      originalPaidAtType: original.paidAt == null ? "missing" : typeof original.paidAt,
      grossAmountCents: received, reviewedBy: reviewerUid,
      reviewedAt: serverTimestamp(), adjustmentReviewRequired: true,
      note: "review_sealed_day_before_any_credit_or_debit_no_automatic_settlement",
    });
    tx.update(orderRef, { paidAt: stamp, hybridPaidAtCorrectionCase: caseId });
    return { caseId, orderId, corrected: true, alreadyCorrected: false,
      adjustmentReviewRequired: true };
  });
}
module.exports = { verifyIndependentReceipt, reconcileHybridHistoricalPaidReceipt };
