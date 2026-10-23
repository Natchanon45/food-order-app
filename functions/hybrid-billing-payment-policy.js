"use strict";

// Pure rules only: no client may dictate invoice amount, beneficiary or PAID.
const { createHash } = require("node:crypto");

const REVIEW_STATUSES = new Set(["issued", "pending_review", "rejected", "paid"]);
const UNSAFE_SLIP_RESULTS = new Set([
  "duplicate", "invalid", "mismatch", "receiver_mismatch",
  "config_invalid", "config_required",
]);
const ALLOWED_PROOF_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf",
]);

function satang(value) {
  const n = Number(value);
  if (value === null || value === undefined || value === ""
    || !Number.isFinite(n) || n <= 0 || n > 1000000000
    || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
    throw new RangeError("HYBRID_PAYMENT_INVALID_AMOUNT");
  }
  return Math.round(n * 100);
}
function validId(id, label = "id") {
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(String(id || ""))) {
    throw new RangeError("HYBRID_PAYMENT_INVALID_" + label);
  }
  return id;
}
function validInvoiceId(id) {
  if (!/^20\d{2}-\d{2}-\d{2}:(?:delivery:(?:trigger|20\d{2}-\d{2}-\d{2})|monthly:fixed)$/.test(String(id || ""))) {
    throw new RangeError("HYBRID_PAYMENT_INVALID_INVOICE_ID");
  }
  return id;
}
function validateEvidencePath({ tenantId, invoiceId, attemptId, path }) {
  if (!/^[a-zA-Z0-9_-]{3,160}$/.test(String(tenantId || ""))) throw new RangeError("HYBRID_PAYMENT_INVALID_TENANT");
  validInvoiceId(invoiceId);
  validId(attemptId, "ATTEMPT_ID");
  const prefix = "tenants/" + tenantId + "/hybrid-billing-slips/"
    + invoiceId + "/" + attemptId + "/";
  const filename = String(path || "").slice(prefix.length);
  if (!String(path || "").startsWith(prefix) || !/^[a-zA-Z0-9_.-]{1,160}$/.test(filename)
    || filename === "." || filename === "..") {
    throw new RangeError("HYBRID_PAYMENT_INVALID_SLIP_PATH");
  }
  return { path, filename };
}
function validateEvidenceMetadata(metadata = {}) {
  const size = Number(metadata.size);
  const mime = String(metadata.contentType || "").toLowerCase();
  if (!Number.isSafeInteger(size) || size < 1 || size > 10 * 1024 * 1024
    || !ALLOWED_PROOF_MIME.has(mime)) throw new RangeError("HYBRID_PAYMENT_INVALID_SLIP_FILE");
  return { size, mime };
}
function normalizeReference(value) {
  const ref = String(value ?? "").trim().normalize("NFKC");
  if (!ref) return "";
  if (ref.length > 180 || /[\x00-\x1f\x7f]/.test(ref)) throw new RangeError("HYBRID_PAYMENT_INVALID_BANK_REFERENCE");
  return ref;
}
function proofFingerprint(type, value) {
  if (!["sha256", "referenceId", "transRef"].includes(type) || !value) {
    throw new TypeError("HYBRID_PAYMENT_INVALID_FINGERPRINT");
  }
  return createHash("sha256").update("hybrid-proof-v1:" + type + ":" + value).digest("hex");
}
function fingerprintClaims(buffer, verification = {}) {
  const claims = new Set([proofFingerprint("sha256",
    createHash("sha256").update(buffer).digest("hex"))]);
  const referenceId = normalizeReference(verification.referenceId);
  const transRef = normalizeReference(verification.transRef);
  if (referenceId) claims.add(proofFingerprint("referenceId", referenceId));
  if (transRef) claims.add(proofFingerprint("transRef", transRef));
  return [...claims].sort();
}
function evaluateSlipVerification(verification = {}, invoiceAmount) {
  const expectedCents = satang(invoiceAmount);
  const status = String(verification.status || "manual_review");
  if (UNSAFE_SLIP_RESULTS.has(status)) {
    throw new Error("HYBRID_PAYMENT_VERIFICATION_REJECTED_" + status);
  }
  const matchedAmount = verification.detectedAmount === null
    || verification.detectedAmount === undefined ? false
    : (() => { try { return satang(verification.detectedAmount) === expectedCents; } catch { return false; } })();
  const provider = String(verification.provider || "").slice(0, 48);
  const referenceId = normalizeReference(verification.referenceId);
  const transRef = normalizeReference(verification.transRef);
  // Slip2Go 200200 acknowledges receiver, duplicate, amount and bank date.
  // A generic OCR "matched", code 200000 or configured Vision fallback
  // DOES NOT constitute a bank-verified transfer.
  const bankVerified = provider === "slip2go" && status === "matched"
    && String(verification.code || "") === "200200" && matchedAmount
    && verification.amountMatched === true && Boolean(referenceId || transRef);
  if (status === "matched" && !matchedAmount) throw new Error("HYBRID_PAYMENT_AMOUNT_MISMATCH");
  return Object.freeze({
    provider, status, reason: String(verification.reason || "").slice(0, 100),
    bankVerified, referenceId, transRef,
    detectedAmount: matchedAmount ? expectedCents / 100 : null,
    // Never persist raw OCR text, full account numbers, API secrets or
    // personal bank account details in invoice/payment docs.
  });
}
function assertManualReview({ invoice, attempt, action, note, verifiedExternally }) {
  if (!["approve", "reject"].includes(action)) throw new Error("HYBRID_PAYMENT_INVALID_REVIEW_ACTION");
  if (invoice.status !== "pending_review" || attempt.status !== "pending_review"
    || invoice.pendingAttemptId !== attempt.id || attempt.invoiceId !== invoice.id) {
    throw new Error("HYBRID_PAYMENT_NOT_PENDING_REVIEW");
  }
  if (action === "approve"
    && !(attempt.verification?.bankVerified === true
      || (verifiedExternally === true && String(note || "").trim().length >= 20))) {
    throw new Error("HYBRID_PAYMENT_EXTERNAL_CONFIRMATION_REQUIRED");
  }
  if (action === "reject" && String(note || "").trim().length < 6) {
    throw new Error("HYBRID_PAYMENT_REJECTION_REASON_REQUIRED");
  }
  if (!REVIEW_STATUSES.has(invoice.status)) throw new Error("HYBRID_PAYMENT_INVALID_INVOICE_STATE");
  return action === "approve" ? "paid" : "rejected";
}
module.exports = {
  satang, validId, validInvoiceId, validateEvidencePath,
  validateEvidenceMetadata, proofFingerprint, fingerprintClaims,
  evaluateSlipVerification, assertManualReview,
};
