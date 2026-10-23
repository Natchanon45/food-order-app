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
const { createHash } = require("node:crypto");
const { assertTrustedHybridUploadGrant } = require("./hybrid-billing-upload-grant");
const { claimIds, checkClaimsInTransaction, createClaimsInTransaction } = require("./finance-slip-claims");

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
    providerOverride: "slip2go", requireVerifiedReceiver: true,
  });
  const verdict = evaluateSlipVerification(verification, invoice.amount, {
    requireVerifiedReceiver: true,
  });
  return Object.freeze({
    tenantId: tenantRef.id, invoiceId, attemptId, slipPath,
    size, mime, invoiceSignature: invoice.signature,
    invoiceAmount: invoice.amount,
    verification: verdict,
    fingerprintIds: fingerprintClaims(buffer, verdict),
    sharedClaimIds: claimIds({
      sha256: createHash("sha256").update(buffer).digest("hex"),
      referenceId: verdict.referenceId, transRef: verdict.transRef,
    }),
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
  requireUploadGrant = true,
}) {
  if (!db?.runTransaction || !tenantRef?.collection || !serverTimestamp
    || !/^[a-zA-Z0-9_-]{3,160}$/.test(String(actorId || ""))) {
    throw new TypeError("Trusted Admin transaction, actor and server clock required");
  }
  if (!prepared || prepared.tenantId !== tenantRef.id
    || !Array.isArray(prepared.fingerprintIds)
    || prepared.fingerprintIds.length < 1 || prepared.fingerprintIds.length > 3
    || prepared.fingerprintIds.some(id => !/^[a-f0-9]{64}$/.test(id))
    || !Array.isArray(prepared.sharedClaimIds)
    || prepared.sharedClaimIds.length < 1 || prepared.sharedClaimIds.length > 3
    || prepared.sharedClaimIds.some(id => !/^(file_[a-f0-9]{64}|bank_[a-f0-9]{64})$/.test(id))) {
    throw new Error("HYBRID_PAYMENT_INVALID_PREPARED_EVIDENCE");
  }
  validateEvidencePath({
    tenantId: tenantRef.id, invoiceId: prepared.invoiceId,
    attemptId: prepared.attemptId, path: prepared.slipPath,
  });
  const { invoiceRef, attemptRef } = refs(tenantRef, prepared.invoiceId, prepared.attemptId);
  const grantRef = tenantRef.collection("hybridBillingUploadGrants").doc(prepared.attemptId);
  const actorRef = db.collection("users").doc(actorId);
  const claims = [...new Set(prepared.fingerprintIds)].sort()
    .map(id => db.collection("hybridBillingSlipReferences").doc(id));
  const sharedClaims = [...new Set(prepared.sharedClaimIds)].sort()
    .map(id => db.collection("financeSlipClaims").doc(id));
  return db.runTransaction(async tx => {
    const invoiceSnap = await tx.get(invoiceRef);
    const attemptSnap = await tx.get(attemptRef);
    // Authorization is checked *inside* the same transaction as the
    // invoice update and globally atomic slip-claim reservations.
    const grantSnap = requireUploadGrant ? await tx.get(grantRef) : null;
    const actorSnap = requireUploadGrant ? await tx.get(actorRef) : null;
    const claimSnaps = [];
    for (const claim of claims) claimSnaps.push(await tx.get(claim));
    await checkClaimsInTransaction(tx, sharedClaims);
    if (!invoiceSnap.exists) throw new Error("HYBRID_PAYMENT_INVOICE_NOT_FOUND");
    const invoice = invoiceSnap.data();
    assertInvoicePayable(invoice, prepared.invoiceId);
    if (invoice.signature !== prepared.invoiceSignature
      || satang(invoice.amount) !== satang(prepared.invoiceAmount)) {
      throw new Error("HYBRID_PAYMENT_INVOICE_CHANGED_DURING_VERIFICATION");
    }
    if (requireUploadGrant) {
      const profile = actorSnap?.exists ? actorSnap.data() : null;
      if (!profile || profile.active === false
        || profile.tenantId !== tenantRef.id
        || !["owner", "admin"].includes(profile.role)) {
        throw new Error("HYBRID_PAYMENT_TENANT_ADMIN_REQUIRED");
      }
      assertTrustedHybridUploadGrant({
        grant: grantSnap?.exists ? grantSnap.data() : null,
        tenantId: tenantRef.id, invoiceId: prepared.invoiceId,
        attemptId: prepared.attemptId, actorUid: actorId,
        slipPath: prepared.slipPath, invoiceSignature: invoice.signature,
        contentType: prepared.mime, fileSize: prepared.size,
      });
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
    createClaimsInTransaction(tx, sharedClaims, {
      channel: "hybrid", tenantId: tenantRef.id, recordId: prepared.attemptId,
    }, serverTimestamp);
    if (requireUploadGrant) tx.update(grantRef, {
      status: "consumed", usedAt: serverTimestamp,
    });
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
  const reviewerRef = db.collection("users").doc(reviewerId);
  return db.runTransaction(async tx => {
    // The Super Admin can be deactivated/demoted between the callable's
    // preflight role check and the finance transaction. Re-read that actor
    // atomically with the invoice/attempt to make revocation effective.
    const reviewerSnap = await tx.get(reviewerRef);
    const reviewerProfile = reviewerSnap.exists ? reviewerSnap.data() : null;
    if (!reviewerProfile || reviewerProfile.active === false
      || reviewerProfile.role !== "super_admin") {
      throw new Error("HYBRID_PAYMENT_SUPER_ADMIN_REQUIRED");
    }
    const invoiceSnap = await tx.get(invoiceRef);
    const attemptSnap = await tx.get(attemptRef);
    const eventSnap = await tx.get(reviewRef);
    if (!invoiceSnap.exists || !attemptSnap.exists) {
      throw new Error("HYBRID_PAYMENT_REVIEW_RECORD_NOT_FOUND");
    }
    if (eventSnap.exists) throw new Error("HYBRID_PAYMENT_ALREADY_REVIEWED");
    const rawInvoice = invoiceSnap.data() || {};
    const rawAttempt = attemptSnap.data() || {};
    // Never mask corrupted stored identity with the document reference.
    if (rawInvoice.id !== invoiceId || rawInvoice.version !== LEDGER_VERSION
      || !/^[a-f0-9]{64}$/.test(String(rawInvoice.signature || ""))
      || rawAttempt.id !== attemptId || rawAttempt.invoiceId !== invoiceId
      || (rawInvoice.tenantId != null && rawInvoice.tenantId !== tenantRef.id)) {
      throw new Error("HYBRID_PAYMENT_REVIEW_LEDGER_INVALID");
    }
    const invoice = { ...rawInvoice };
    const attempt = { ...rawAttempt };
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
