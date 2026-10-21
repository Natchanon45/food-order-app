"use strict";
// Phase3AN: narrow source-only candidate wired to the pre-existing Revenue
// Share tenant access mirror. NOT global Admin SDK enforcement, NOT a release.
const { legacyDeliveryPaidWriterAllowed } = require("./hybrid-billing-legacy-payment-guard");

function objectMap(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
const FORBIDDEN = new Set([
  "billingPolicyVersion", "hybridBillingEnabled", "hybridBillingSuspended",
  "hybridReceiptJournalCoverageReady", "hybridReceiptJournalMode",
]);
async function mirrorLegacyTenantAccess({
  db, tenantRef, patch, tenantOnlyPatch = {}, serverTimestamp,
} = {}) {
  if (!db || typeof db.runTransaction !== "function" || !tenantRef
      || typeof tenantRef.get !== "function" || typeof serverTimestamp !== "function"
      || !objectMap(patch) || !objectMap(tenantOnlyPatch)
      || ![...Object.keys(patch), ...Object.keys(tenantOnlyPatch)]
        .some(key => key === "active" || key.startsWith("revenueShare"))) {
    throw Error("HYBRID_LEGACY_ACCESS_BAD_REQUEST");
  }
  for (const key of [...Object.keys(patch), ...Object.keys(tenantOnlyPatch)]) {
    if (FORBIDDEN.has(key)) throw Error("HYBRID_LEGACY_ACCESS_FINANCE_FIELD_FORBIDDEN");
  }
  // A transaction makes the tenant marker read an optimistic precondition.
  // If a Hybrid migration races this legacy batch, Firestore retries and
  // re-evaluates the marker before any tenant or slug access mutation.
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(tenantRef);
    if (!snapshot.exists || !legacyDeliveryPaidWriterAllowed(snapshot.data()))
      throw Error("HYBRID_LEGACY_ACCESS_TRUSTED_WRITER_REQUIRED");
    const tenant = snapshot.data();
    const slug = String(tenant.slug || "").trim();
    const now = serverTimestamp();
    tx.set(tenantRef, { ...patch, ...tenantOnlyPatch, updatedAt: now },
      { merge: true });
    if (slug) tx.set(db.collection("tenantSlugs").doc(slug),
      { ...patch, updatedAt: now }, { merge: true });
    return { legacyAccessUpdated: true };
  });
}
module.exports = { mirrorLegacyTenantAccess };
