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

// Phase3AO: ALL legacy Subscription active/slug writers MUST use this path.
// Patch computation happens AFTER reading the current tenant in a transaction.
// A failed Hybrid eligibility check NEVER writes (scheduled callers can skip).
const SUBSCRIPTION_FIELDS = new Set([
  "planCode", "subscriptionStatus", "subscriptionStartedAt",
  "subscriptionExpiresAt", "gracePeriodDays", "active",
  "suspensionReason", "suspendedAt", "subscriptionUpdatedBy", "updatedAt",
]);
async function mirrorLegacySubscriptionAccess({
  db, tenantRef, makePatch, makeSlugPatch,
} = {}) {
  if (!db || typeof db.runTransaction !== "function" || !tenantRef
    || typeof makePatch !== "function" || typeof makeSlugPatch !== "function")
    throw Error("HYBRID_LEGACY_SUBSCRIPTION_BAD_REQUEST");
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(tenantRef);
    if (!snapshot.exists) return { applied: false, reason: "missing" };
    const tenant = snapshot.data();
    if (!legacyDeliveryPaidWriterAllowed(tenant))
      return { applied: false, reason: "hybrid_blocked" };
    const patch = makePatch(tenant);
    if (patch === null) return { applied: false, reason: "unchanged" };
    if (!objectMap(patch) || typeof patch.active !== "boolean"
      || Object.keys(patch).some(k => !SUBSCRIPTION_FIELDS.has(k)))
      throw Error("HYBRID_LEGACY_SUBSCRIPTION_INVALID_PATCH");
    const slugPatch = makeSlugPatch(tenant, patch);
    if (!objectMap(slugPatch) || typeof slugPatch.active !== "boolean"
      || Object.keys(slugPatch).some(k =>
        !["active", "subscriptionStatus", "subscriptionExpiresAt",
          "gracePeriodDays", "updatedAt"].includes(k)))
      throw Error("HYBRID_LEGACY_SUBSCRIPTION_INVALID_SLUG_PATCH");
    tx.set(tenantRef, patch, { merge: true });
    const slug = String(tenant.slug || "").trim();
    if (slug) tx.set(db.collection("tenantSlugs").doc(slug), slugPatch,
      { merge: true });
    return { applied: true, patch };
  });
}
module.exports = { mirrorLegacyTenantAccess, mirrorLegacySubscriptionAccess };
