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
const project = process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT || firebaseConfig.projectId;
if (project !== "demo-penguin-hybrid"
  || process.env.HYBRID_DEMO_FUNCTIONS_ONLY !== "1"
  || !localHost("FIRESTORE_EMULATOR_HOST")
  || !localHost("FIREBASE_AUTH_EMULATOR_HOST")
  || !localHost("FIREBASE_STORAGE_EMULATOR_HOST")) {
  throw new Error("HYBRID_DEMO_FUNCTIONS_FORBIDDEN_OUTSIDE_LOCAL_EMULATORS");
}

const { createHash } = require("node:crypto");
const { onCall } = require("firebase-functions/v2/https");
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
