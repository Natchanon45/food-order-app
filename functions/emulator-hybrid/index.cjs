"use strict";

// *** TEST-ONLY ENTRYPOINT. NEVER import from functions/index.js/bootstrap.js ***
// Guard BEFORE importing Admin SDK or any billing code. No real Firebase project
// may load this source and the CLI command only selects "demo-penguin-hybrid".
function localHost(name) {
  return /^(?:127\.0\.0\.1|localhost):\d+$/.test(String(process.env[name] || ""));
}
let firebaseConfig = {};
try { firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || "{}"); }
catch { /* invalid config is rejected by project assertion below */ }
// During Firebase CLI function-discovery, emulator hosts and the selected
// project are not guaranteed to be injected automatically. The npm script
// explicitly sets them before starting the CLI. A conflicting project from
// any source still fails CLOSED even when another source says "demo".
const project = process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT || firebaseConfig.projectId;
const knownProjects = [process.env.GCLOUD_PROJECT,
  process.env.GCP_PROJECT, firebaseConfig.projectId].filter(Boolean);
// Classify failed conditions without logging environment variable values,
// project names, tokens, credentials, or service-account paths. Firebase CLI's
// definition discovery can override some values in its child process.
// Reporting the NAMES of failed checks lets UAT diagnose this safely.
const demoConditions = {
  demoProject: project === "demo-penguin-hybrid",
  noConflictingProject: !knownProjects.some(value => value !== "demo-penguin-hybrid"),
  explicitDemoFlag: process.env.HYBRID_DEMO_FUNCTIONS_ONLY === "1",
  localFirestore: localHost("FIRESTORE_EMULATOR_HOST"),
  localAuth: localHost("FIREBASE_AUTH_EMULATOR_HOST"),
  localStorage: localHost("FIREBASE_STORAGE_EMULATOR_HOST"),
  // Firebase CLI discovery has been observed to OMIT its own reserved
  // FIREBASE_FUNCTIONS_EMULATOR_HOST. A separate, non-reserved test-only
  // marker is loaded from emulator-hybrid/.env.local by Firebase itself.
  // It pins the same host/port as firebase.hybrid-functions-emulator.json.
  localFunctions: process.env.HYBRID_DEMO_FUNCTIONS_HOST === "127.0.0.1:5001",
  // Reject a conflicting native host whenever Firebase does supply one.
  nativeFunctionsHostSafe: !process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST
    || /^(?:127\.0\.0\.1|localhost):5001$/.test(
      process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST),
};
const unsafe = Object.entries(demoConditions)
  .filter(([, valid]) => !valid).map(([check]) => check);
if (unsafe.length) {
  throw new Error("HYBRID_DEMO_FUNCTIONS_FORBIDDEN_OUTSIDE_LOCAL_EMULATORS"
    + " [failed checks: " + unsafe.join(", ") + "]");
}

const { createHash } = require("node:crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
// The production module exposes its pure handler factory for isolated testing.
// No production callable export or release boolean is changed.
if (!getApps().length) initializeApp({
  projectId: project,
  storageBucket: "demo-penguin-hybrid.appspot.com",
});
const { makeHybridPaymentHandlersForTest, HYBRID_PAYMENT_CALLABLE_READY } =
  require("../hybrid-billing-payment-callables");
const { issueTrustedHybridUploadGrant } =
  require("../hybrid-billing-upload-grant");
if (HYBRID_PAYMENT_CALLABLE_READY !== false) {
  throw new Error("HYBRID_PRODUCTION_PAYMENT_GATE_MUST_REMAIN_DISABLED");
}

// Only synthetic emulator evidence is evaluated here. Never call Slip2Go,
// Google Vision or live banking APIs in this entire demo entrypoint.
async function fakeBankVerifier(buffer, mime, name, invoiceAmount) {
  const fingerprint = createHash("sha256").update(buffer).digest("hex");
  return {
    provider: "slip2go", status: "matched", code: "200200",
    amountMatched: true, detectedAmount: invoiceAmount,
    receiverValidated: true, // synthetic demo verifier ONLY
    referenceId: "DEMO-REF-" + fingerprint.slice(0, 24),
    transRef: "DEMO-TX-" + fingerprint.slice(24, 48),
  };
}
const handlers = makeHybridPaymentHandlersForTest({
  db: getFirestore(),
  bucket: getStorage().bucket(),
  inspect: fakeBankVerifier,
  timestamp: FieldValue.serverTimestamp(),
  enabled: true, // ONLY within the guarded demo entrypoint
});
const options = {
  region: "asia-southeast1",
  enforceAppCheck: false, // Test transport/Auth only. Production is TRUE.
  timeoutSeconds: 60,
};
// Names are deliberately different from production so they cannot be
// mistaken for payment endpoints in a real app.
exports.demoHybridSubmitProof = onCall(options, handlers.submit);
exports.demoHybridReviewProof = onCall(options, handlers.review);

// Phase 10A test-only upload grant. Never exported from Production bootstrap.
// This does not upload a file or submit any finance claim.
exports.demoHybridPrepareUpload = onCall(options, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "HYBRID_UPLOAD_AUTH_REQUIRED");
  try {
    return await issueTrustedHybridUploadGrant({
      db: getFirestore(), auth: request.auth, input: request.data,
    });
  } catch (error) {
    const code = String(error?.message || "");
    if (/HYBRID_PAYMENT_(TENANT_ADMIN_REQUIRED|SUPER_ADMIN_REQUIRED)/.test(code))
      throw new HttpsError("permission-denied", "HYBRID_UPLOAD_FORBIDDEN");
    if (/HYBRID_PAYMENT_(INACTIVE_PROFILE|AUTH_REQUIRED)/.test(code))
      throw new HttpsError("unauthenticated", "HYBRID_UPLOAD_AUTH_REQUIRED");
    if (/^HYBRID_UPLOAD_INVALID_|HYBRID_PAYMENT_INVALID_AMOUNT/.test(code))
      throw new HttpsError("invalid-argument", "HYBRID_UPLOAD_INVALID_REQUEST");
    if (/^HYBRID_UPLOAD_INVOICE_(?:NOT_FOUND|NOT_PAYABLE)/.test(code))
      throw new HttpsError("failed-precondition", "HYBRID_UPLOAD_INVOICE_UNAVAILABLE");
    // No internal stack, raw request, private tenant data or bank details leak.
    throw new HttpsError("failed-precondition", "HYBRID_UPLOAD_UNAVAILABLE");
  }
});

// Owner-facing Premium Delivery Revenue Share CALLABLES for local browser UAT.
// The fail-closed DEMO environment guard at file top runs first. Do not expose
// the production scheduler here: Super Admin runs reconciliation explicitly
// during UAT so an idle demo never locks an unsuspecting tenant overnight.
// Real provider requests are blocked by the local-only branch in
// revenue-share.inspectRevenueShareSlip, but live Production is unchanged.
const premiumRevenueShare = require("../revenue-share");
for (const name of [
  "getTenantRevenueShareAccess", "getTenantRevenueShareSummary",
  "listTenantRevenueSharePayments", "submitTenantRevenueSharePayment",
  "deleteTenantRevenueSharePayment", "getPlatformRevenueShareSummary",
  "listPlatformRevenueSharePayments", "reviewRevenueSharePayment",
  "reconcileRevenueShare",
]) {
  if (typeof premiumRevenueShare[name] !== "function") {
    throw new Error("LOCAL_PREMIUM_DEMO_MISSING_CALLABLE");
  }
  exports[name] = premiumRevenueShare[name];
}
