"use strict";

// Phase 10A: private SERVER-issued upload reservations.
// Not referenced by functions/index.js/bootstrap.js and not a Production callable.
// Storage Rules do not yet enforce these grants: no browser upload UI is enabled.
const { randomBytes } = require("node:crypto");
const { tenantAdmin } = require("./hybrid-billing-payment-service");
const { satang, validInvoiceId, validId, validateEvidencePath } =
  require("./hybrid-billing-payment-policy");
const { LEDGER_VERSION } = require("./hybrid-billing-ledger");

const MAX_BYTES = 10 * 1024 * 1024;
const MIME_EXTENSIONS = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
});
const RESERVATION_MS = 10 * 60 * 1000;
const TENANT_ID = /^[A-Za-z0-9_-]{3,160}$/;

function validatePrepareRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype
    || Object.keys(input).some(key =>
      !["tenantId", "invoiceId", "contentType", "fileSize"].includes(key))) {
    throw new Error("HYBRID_UPLOAD_INVALID_REQUEST");
  }
  const { tenantId, invoiceId, contentType, fileSize } = input;
  if (typeof tenantId !== "string" || !TENANT_ID.test(tenantId)
    || typeof invoiceId !== "string") throw new Error("HYBRID_UPLOAD_INVALID_SCOPE");
  try { validInvoiceId(invoiceId); }
  catch { throw new Error("HYBRID_UPLOAD_INVALID_SCOPE"); }
  if (typeof contentType !== "string"
    || !Object.hasOwn(MIME_EXTENSIONS, contentType)) {
    throw new Error("HYBRID_UPLOAD_INVALID_FILE");
  }
  if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_BYTES) {
    throw new Error("HYBRID_UPLOAD_INVALID_FILE");
  }
  return { tenantId, invoiceId, contentType, fileSize };
}

async function issueTrustedHybridUploadGrant({
  db, auth, input, generateAttemptId = () => randomBytes(24).toString("base64url"),
  now = () => new Date(),
}) {
  if (!db?.runTransaction || typeof generateAttemptId !== "function"
    || typeof now !== "function") throw new TypeError("HYBRID_UPLOAD_TRUSTED_SERVER_REQUIRED");
  const { tenantId, invoiceId, contentType, fileSize } = validatePrepareRequest(input);
  // The current billing owner/admin role is verified from trusted Firestore,
  // never the browser's claims about tenant or finance permissions.
  await tenantAdmin(db, auth, tenantId);
  const attemptId = generateAttemptId();
  try { validId(attemptId, "ATTEMPT_ID"); }
  catch { throw new Error("HYBRID_UPLOAD_INVALID_ATTEMPT_ID"); }
  const slipPath = "tenants/" + tenantId + "/hybrid-billing-slips/" + invoiceId
    + "/" + attemptId + "/evidence." + MIME_EXTENSIONS[contentType];
  validateEvidencePath({ tenantId, invoiceId, attemptId, path: slipPath });
  const created = now();
  if (!(created instanceof Date) || !Number.isFinite(created.getTime())) {
    throw new Error("HYBRID_UPLOAD_INVALID_SERVER_CLOCK");
  }
  const expiresAt = new Date(created.getTime() + RESERVATION_MS);
  const tenantRef = db.collection("tenants").doc(tenantId);
  const invoiceRef = tenantRef.collection("hybridBillingInvoices").doc(invoiceId);
  const grantRef = tenantRef.collection("hybridBillingUploadGrants").doc(attemptId);
  const actorRef = db.collection("users").doc(auth.uid);
  await db.runTransaction(async tx => {
    // Recheck authorization INSIDE the transaction so a concurrent profile
    // revoke or invoice settlement cannot create a new upload grant.
    const userSnap = await tx.get(actorRef);
    const profile = userSnap.exists ? userSnap.data() : null;
    if (!profile || profile.active === false || profile.tenantId !== tenantId
      || !["owner", "admin"].includes(profile.role)) {
      throw new Error("HYBRID_PAYMENT_TENANT_ADMIN_REQUIRED");
    }
    const invoiceSnap = await tx.get(invoiceRef);
    const invoice = invoiceSnap.exists ? invoiceSnap.data() : null;
    if (!invoice || invoice.id !== invoiceId || invoice.version !== LEDGER_VERSION
      || !/^[a-f0-9]{64}$/.test(String(invoice.signature || ""))) {
      throw new Error("HYBRID_UPLOAD_INVOICE_NOT_FOUND");
    }
    satang(invoice.amount); // Check trusted ledger value, never client amount.
    if (!["issued", "rejected"].includes(invoice.status)) {
      throw new Error("HYBRID_UPLOAD_INVOICE_NOT_PAYABLE");
    }
    tx.create(grantRef, {
      id: attemptId, tenantId, invoiceId, actorUid: auth.uid, slipPath,
      contentType, maxSize: fileSize, status: "reserved", createdAt: created,
      expiresAt, invoiceSignature: invoice.signature,
    });
  });
  // A reservation is NOT payment proof or a bank transfer. It neither
  // touches the invoice nor allocates a financeSlipClaims document.
  return {
    tenantId, invoiceId, attemptId, slipPath, contentType,
    maxSize: fileSize, expiresAt: expiresAt.toISOString(),
    uploadEnabled: false, // Production UI and Storage enforcement still locked.
  };
}

module.exports = {
  MAX_BYTES, MIME_EXTENSIONS, RESERVATION_MS,
  validatePrepareRequest, issueTrustedHybridUploadGrant,
};
