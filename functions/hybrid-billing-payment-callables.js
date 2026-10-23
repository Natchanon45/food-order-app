"use strict";

// Phase 7: registered definitions remain PRIVATE, not imported by bootstrap.
// This entire payment write surface is hard-locked at the server boundary.
// Only a separately reviewed source-code release can enable it.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { inspectSlip } = require("./slip-verification");
const {
  submitTrustedHybridProof, reviewTrustedHybridProof,
} = require("./hybrid-billing-payment-service");
const {
  validInvoiceId, validId, validateEvidencePath,
} = require("./hybrid-billing-payment-policy");

const HYBRID_PAYMENT_CALLABLE_READY = false;
const REGION = "asia-southeast1";

function plainData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)
    || Object.keys(data).some(key => key === "__proto__" || key === "constructor")) {
    throw new HttpsError("invalid-argument", "HYBRID_PAYMENT_INVALID_REQUEST");
  }
  return data;
}
function tenantId(value) {
  const val = String(value ?? "");
  if (!/^[a-zA-Z0-9_-]{3,160}$/.test(val)) {
    throw new HttpsError("invalid-argument", "HYBRID_PAYMENT_INVALID_TENANT");
  }
  return val;
}
function str(value, max, field) {
  if (typeof value !== "string" || value.length > max || !value.trim()) {
    throw new HttpsError("invalid-argument", "HYBRID_PAYMENT_INVALID_" + field);
  }
  return value;
}
function exactFields(value, keys) {
  const extras = Object.keys(value).filter(k => !keys.includes(k));
  if (extras.length) throw new HttpsError("invalid-argument",
    "HYBRID_PAYMENT_UNEXPECTED_FIELDS");
}
function payloadForSubmit(value) {
  const data = plainData(value);
  exactFields(data, ["tenantId", "invoiceId", "attemptId", "slipPath"]);
  const id = tenantId(data.tenantId);
  const invoiceId = str(data.invoiceId, 80, "INVOICE");
  const attemptId = str(data.attemptId, 80, "ATTEMPT");
  const slipPath = str(data.slipPath, 512, "PATH");
  try {
    validInvoiceId(invoiceId);
    validId(attemptId, "ATTEMPT_ID");
    validateEvidencePath({ tenantId: id, invoiceId, attemptId, path: slipPath });
  } catch {
    throw new HttpsError("invalid-argument", "HYBRID_PAYMENT_INVALID_PROOF_LINK");
  }
  return { tenantId: id, invoiceId, attemptId, slipPath };
}
function payloadForReview(value) {
  const data = plainData(value);
  exactFields(data, ["tenantId", "invoiceId", "attemptId", "action",
    "note", "verifiedExternally"]);
  const id = tenantId(data.tenantId);
  const invoiceId = str(data.invoiceId, 80, "INVOICE");
  const attemptId = str(data.attemptId, 80, "ATTEMPT");
  if (!["approve", "reject"].includes(data.action)
    || (data.verifiedExternally !== undefined
      && typeof data.verifiedExternally !== "boolean")
    || (data.note !== undefined && typeof data.note !== "string")
    || String(data.note || "").length > 2000) {
    throw new HttpsError("invalid-argument", "HYBRID_PAYMENT_INVALID_REVIEW");
  }
  try { validInvoiceId(invoiceId); validId(attemptId, "ATTEMPT_ID"); }
  catch { throw new HttpsError("invalid-argument", "HYBRID_PAYMENT_INVALID_REVIEW_IDS"); }
  return {
    tenantId: id, invoiceId, attemptId, action: data.action,
    note: String(data.note || "").trim(),
    verifiedExternally: data.verifiedExternally === true,
  };
}
function mapError(error) {
  if (error instanceof HttpsError) return error;
  const msg = String(error?.message || "HYBRID_PAYMENT_FAILED");
  let code = "failed-precondition";
  if (/AUTH_REQUIRED|INACTIVE_PROFILE/.test(msg)) code = "unauthenticated";
  else if (/SUPER_ADMIN_REQUIRED|TENANT_ADMIN_REQUIRED|FORBIDDEN/.test(msg)) code = "permission-denied";
  else if (/INVALID_|REJECTION_REASON_REQUIRED|EXTERNAL_CONFIRMATION_REQUIRED/.test(msg)) code = "invalid-argument";
  else if (/ALREADY_|DUPLICATE_|CLAIMED/.test(msg)) code = "already-exists";
  // Client never sees secrets, raw bank references, storage bytes or stack.
  return new HttpsError(code, msg.startsWith("HYBRID_") || msg.startsWith("FINANCE_")
    ? msg : "HYBRID_PAYMENT_FAILED");
}
function makeHandlers({
  db, bucket, inspect, timestamp, enabled = false,
}) {
  const context = { db, bucket, inspectSlip: inspect, serverTimestamp: timestamp };
  async function requireReady(request) {
    if (!request?.auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
    if (!enabled) throw new HttpsError("failed-precondition", "HYBRID_PAYMENT_NOT_RELEASED");
  }
  return {
    async submit(request) {
      await requireReady(request);
      const input = payloadForSubmit(request.data);
      try {
        return await submitTrustedHybridProof({ ...context, auth: request.auth, ...input });
      } catch (e) { throw mapError(e); }
    },
    async review(request) {
      await requireReady(request);
      const input = payloadForReview(request.data);
      try {
        return await reviewTrustedHybridProof({
          db, auth: request.auth, serverTimestamp: timestamp, ...input,
        });
      } catch (e) { throw mapError(e); }
    },
  };
}
const handlers = makeHandlers({
  db: getFirestore(),
  bucket: getStorage().bucket(),
  inspect: inspectSlip,
  timestamp: FieldValue.serverTimestamp(),
  enabled: HYBRID_PAYMENT_CALLABLE_READY,
});
exports.HYBRID_PAYMENT_CALLABLE_READY = HYBRID_PAYMENT_CALLABLE_READY;
exports.submitTenantHybridPaymentProof = onCall({
  region: REGION, timeoutSeconds: 60, memory: "512MiB",
  enforceAppCheck: true,
}, handlers.submit);
exports.reviewHybridInvoicePaymentProof = onCall({
  region: REGION, timeoutSeconds: 30, memory: "256MiB",
  enforceAppCheck: true,
}, handlers.review);
// Only exported to allow deterministic role/security tests without live SDK;
// the two real callable handlers above are permanently bound to enabled:false.
exports.makeHybridPaymentHandlersForTest = makeHandlers;
