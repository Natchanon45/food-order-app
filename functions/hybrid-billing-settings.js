"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { DEFAULT_SETTINGS, normalizeSettings } = require("./hybrid-billing-core");

const COLLECTION = "platformSettings";
const DOCUMENT = "hybridBilling";
// Fail closed until invoice issuance, payment confirmation, access recovery and quotas are integrated.
const HYBRID_REGISTRATION_READY = false;
async function loadHybridBillingSettings(db = getFirestore()) {
  const doc = await db.collection(COLLECTION).doc(DOCUMENT).get();
  return normalizeSettings(doc.exists ? { ...DEFAULT_SETTINGS, ...doc.data() } : DEFAULT_SETTINGS);
}
async function assertSuperAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const doc = await getFirestore().collection("users").doc(auth.uid).get();
  if (doc.data()?.active === false || doc.data()?.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Super Admin permission required");
  }
}
exports.loadHybridBillingSettings = loadHybridBillingSettings;
exports.HYBRID_REGISTRATION_READY = HYBRID_REGISTRATION_READY;
exports.getPublicHybridBillingSettings = onCall({ region: "asia-southeast1" }, async () => {
  const config = await loadHybridBillingSettings();
  return { ok: true, config, registrationReady: HYBRID_REGISTRATION_READY };
});
exports.getHybridBillingSettings = onCall({ region: "asia-southeast1" }, async request => {
  await assertSuperAdmin(request.auth);
  return { ok: true, config: await loadHybridBillingSettings() };
});
exports.updateHybridBillingSettings = onCall({ region: "asia-southeast1" }, async request => {
  await assertSuperAdmin(request.auth);
  let config;
  try {
    config = normalizeSettings(request.data || {});
  } catch (error) {
    throw new HttpsError("invalid-argument", String(error.message));
  }
  // Updates are prospective. Already-issued invoices must use a month-specific immutable snapshot.
  await getFirestore().collection(COLLECTION).doc(DOCUMENT).set({
    ...config, updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid,
  }, { merge: true });
  return { ok: true, config };
});
