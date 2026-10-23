"use strict";

// PRIVATE server-only payment workflow. Not exported through bootstrap.js.
// Attaching a slip NEVER marks an invoice as paid. Review requires a trusted,
// separately authenticated Super Admin caller (not available in this module).
const {
  satang, validId, validInvoiceId, validateEvidencePath,
  validateEvidenceMetadata, fingerprintClaims,
  evaluateSlipVerification, assertManualReview,
} = require("./hybrid-billing-payment-policy");
const { LEDGER_VERSION } = require("./hybrid-billing-ledger");

function refs(tenantRef, invoiceId, attemptId) {
  validInvoiceId(invoiceId);
  validId(attemptId, "ATTEMPT_ID");
  return {
    invoiceRef: tenantRef.collection("hybridBillingInvoices").doc(invoiceId),
    attemptRef: tenantRef.collection("hybridBillingPaymentAttempts").doc(attemptId),
    reviewRef: tenantRef.collection("hybridBillingPaymentEvents").doc(attemptId + "-review"),
  };
}
function assertInvoicePayable(invoice, invoiceId) {
  if (!invoice || invoice.id !== invoiceId || invoice.version !== LEDGER_VERSION
    || !/^[a-f0-9]{64}$/.test(String(invoice.signature || ""))) {
    throw new Error("HYBRID_PAYMENT_INVALID_ISSUED_INVOICE");
  }
  satang(invoice.amount);
  if (!["issued", "rejected"].includes(invoice.status)) {
    throw new Error("HYBRID_PAYMENT_ALREADY_PENDING_OR_PAID");
  }
}
/**
 * Trusted server preflight: load the previously issued invoice and a storage
 * object at its exact tenant/invoice/attempt-scoped path. Never accept an
 * invoice amount or destination bank account from the client.
 */
async function prepareHybridInvoiceProof({
  tenantRef, invoiceId, attemptId, slipPath, bucket, inspectSlip,
}) {
  if (!tenantRef?.collection || !bucket?.file || typeof inspectSlip !== "function") {
    throw new TypeError("Trusted Admin Firestore, Storage and verifier are required");
  }
  const { filename } = validateEvidencePath({
    tenantId: tenantRef.id, invoiceId, attemptId, path: slipPath,
  });
  const { invoiceRef } = refs(tenantRef, invoiceId, attemptId);
  const snapshot = await invoiceRef.get();
  if (!snapshot.exists) throw new Error("HYBRID_PAYMENT_INVOICE_NOT_FOUND");
  const invoice = snapshot.data();
  assertInvoicePayable(invoice, invoiceId);
  const file = bucket.file(slipPath);
  const [exists] = await file.exists();
  if (!exists) throw new Error("HYBRID_PAYMENT_SLIP_NOT_FOUND");
  const [metadata] = await file.getMetadata();
  const { size, mime } = validateEvidenceMetadata(metadata);
  const [buffer] = await file.download();
  if (!Buffer.isBuffer(buffer) || buffer.length !== size) {
    throw new Error("HYBRID_PAYMENT_INVALID_SLIP_BYTES");
  }
  // Slip2Go's configured receiver is read server-side from private settings.
  // Even 200200 only qualifies for Super Admin review, never auto PAID.
  const verification = await inspectSlip(buffer, mime, filename, invoice.amount, {
    providerOverride: "slip2go",
  });
  const verdict = evaluateSlipVerification(verification, invoice.amount);
  return Object.freeze({
    tenantId: tenantRef.id, invoiceId, attemptId, slipPath,
    size, mime, invoiceSignature: invoice.signature,
    invoiceAmount: invoice.amount,
    verification: verdict,
    fingerprintIds: fingerprintClaims(buffer, verdict),
  });
}
/**
 * Called only after prepareHybridInvoiceProof succeeds. Claim the SHA256
 * content and all bank references globally within HYBRID, then create one
 * immutable attempt and set the invoice to pending_review atomically.
 *
 * A separate release gate must compare refs with legacy revenue-share
 * payments before authorizing cross-product AUTO payment approval.
 */
async function stageHybridInvoiceProof({
  db, tenantRef, prepared, actorId, serverTimestamp,
}) {
  if (!db?.runTransaction || !tenantRef?.collection || !serverTimestamp
    || !/^[a-zA-Z0-9_-]{3,160}$/.test(String(actorId || ""))) {
    throw new TypeError("Trusted Admin transaction, actor and server clock required");
  }
  if (!prepared || prepared.tenantId !== tenantRef.id
    || !Array.isArray(prepared.fingerprintIds)
    || prepared.fingerprintIds.length < 1 || prepared.fingerprintIds.length > 3
    || prepared.fingerprintIds.some(id => !/^[a-f0-9]{64}$/.test(id))) {
    throw new Error("HYBRID_PAYMENT_INVALID_PREPARED_EVIDENCE");
  }
  validateEvidencePath({
    tenantId: tenantRef.id, invoiceId: prepared.invoiceId,
    attemptId: prepared.attemptId, path: prepared.slipPath,
  });
  const { invoiceRef, attemptRef } = refs(tenantRef, prepared.invoiceId, prepared.attemptId);
  const claims = [...new Set(prepared.fingerprintIds)].sort()
    .map(id => db.collection("hybridBillingSlipReferences").doc(id));
  return db.runTransaction(async tx => {
    const invoiceSnap = await tx.get(invoiceRef);
    const attemptSnap = await tx.get(attemptRef);
    const claimSnaps = [];
    for (const claim of claims) claimSnaps.push(await tx.get(claim));
    if (!invoiceSnap.exists) throw new Error("HYBRID_PAYMENT_INVOICE_NOT_FOUND");
    const invoice = invoiceSnap.data();
    assertInvoicePayable(invoice, prepared.invoiceId);
    if (invoice.signature !== prepared.invoiceSignature
      || satang(invoice.amount) !== satang(prepared.invoiceAmount)) {
      throw new Error("HYBRID_PAYMENT_INVOICE_CHANGED_DURING_VERIFICATION");
    }
    if (attemptSnap.exists) throw new Error("HYBRID_PAYMENT_ATTEMPT_ALREADY_EXISTS");
    if (claimSnaps.some(snap => snap.exists)) {
      throw new Error("HYBRID_PAYMENT_DUPLICATE_SLIP_OR_BANK_REFERENCE");
    }
    for (let i = 0; i < claims.length; i++) {
      tx.create(claims[i], {
        tenantId: tenantRef.id, invoiceId: prepared.invoiceId,
        attemptId: prepared.attemptId, createdAt: serverTimestamp,
      });
    }
    tx.create(attemptRef, {
      id: prepared.attemptId, invoiceId: prepared.invoiceId,
      tenantId: tenantRef.id, invoiceSignature: prepared.invoiceSignature,
      amount: prepared.invoiceAmount, status: "pending_review",
      slipPath: prepared.slipPath, slipSize: prepared.size, slipMime: prepared.mime,
      verification: prepared.verification, submittedBy: actorId,
      submittedAt: serverTimestamp, updatedAt: serverTimestamp,
    });
    tx.update(invoiceRef, {
      status: "pending_review", pendingAttemptId: prepared.attemptId,
      latestAttemptId: prepared.attemptId, updatedAt: serverTimestamp,
    });
    return {
      invoiceId: prepared.invoiceId, attemptId: prepared.attemptId,
      status: "pending_review", bankVerified: prepared.verification.bankVerified,
    };
  });
}
/**
 * Manual finance decision — NO auto paid on upload, OCR or bank verification.
 * The caller MUST authenticate and authorize a real Super Admin before
 * reaching this private function. A manual override requires a substantive
 * external bank confirmation note.
 */
async function reviewHybridInvoiceProof({
  db, tenantRef, invoiceId, attemptId, action, note,
  verifiedExternally = false, reviewerId, serverTimestamp,
}) {
  if (!db?.runTransaction || !tenantRef?.collection || !serverTimestamp
    || !/^[a-zA-Z0-9_-]{3,160}$/.test(String(reviewerId || ""))) {
    throw new TypeError("Trusted Super Admin and Admin transaction required");
  }
  const { invoiceRef, attemptRef, reviewRef } = refs(tenantRef, invoiceId, attemptId);
  return db.runTransaction(async tx => {
    const invoiceSnap = await tx.get(invoiceRef);
    const attemptSnap = await tx.get(attemptRef);
    const eventSnap = await tx.get(reviewRef);
    if (!invoiceSnap.exists || !attemptSnap.exists) {
      throw new Error("HYBRID_PAYMENT_REVIEW_RECORD_NOT_FOUND");
    }
    if (eventSnap.exists) throw new Error("HYBRID_PAYMENT_ALREADY_REVIEWED");
    const invoice = { ...invoiceSnap.data(), id: invoiceId };
    const attempt = { ...attemptSnap.data(), id: attemptId };
    if (attempt.tenantId !== tenantRef.id || attempt.invoiceSignature !== invoice.signature
      || satang(attempt.amount) !== satang(invoice.amount)) {
      throw new Error("HYBRID_PAYMENT_REVIEW_FINANCIAL_MISMATCH");
    }
    const status = assertManualReview({
      invoice, attempt, action, note, verifiedExternally,
    });
    const trimmedNote = String(note || "").trim().slice(0, 2000);
    tx.create(reviewRef, {
      invoiceId, attemptId, tenantId: tenantRef.id, action,
      resultStatus: status, reviewerId, note: trimmedNote,
      verifiedExternally: verifiedExternally === true,
      bankVerified: attempt.verification?.bankVerified === true,
      reviewedAt: serverTimestamp,
    });
    tx.update(attemptRef, {
      status, reviewedBy: reviewerId, reviewedAt: serverTimestamp,
      reviewNote: trimmedNote, updatedAt: serverTimestamp,
    });
    tx.update(invoiceRef, {
      status, pendingAttemptId: null, latestAttemptId: attemptId,
      paidAttemptId: status === "paid" ? attemptId : null,
      reviewedAt: serverTimestamp, updatedAt: serverTimestamp,
    });
    return { invoiceId, attemptId, status };
  });
}

module.exports = {
  prepareHybridInvoiceProof,
  stageHybridInvoiceProof,
  reviewHybridInvoiceProof,
};
