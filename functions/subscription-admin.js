const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { mirrorLegacySubscriptionAccess } =
  require("./hybrid-billing-legacy-access-guard");

const DEFAULT_TERM_DAYS = 30;
const DEFAULT_GRACE_DAYS = 3;

async function assertSuperAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const profile = (await getFirestore().collection("users").doc(auth.uid).get()).data();
  if (!profile || profile.active === false || profile.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Super admin permission required");
  }
}

function addDays(date, days) {
  return new Date(date.getTime() + Number(days || 0) * 86400000);
}

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function revenueShareEnabled(tenant = {}) {
  return tenant.revenueShareEnabled === true || tenant.billingMode === "revenue_share";
}

function effectiveStatus(tenant, now = new Date()) {
  if (revenueShareEnabled(tenant)) return tenant.revenueShareSuspended === true ? "revenue_share_suspended" : "revenue_share_active";
  if (tenant.subscriptionStatus === "suspended" || tenant.active === false && tenant.suspensionReason) return "suspended";
  const expiresAt = asDate(tenant.subscriptionExpiresAt);
  if (!expiresAt) return tenant.subscriptionStatus || "active";
  const graceDays = Number(tenant.gracePeriodDays ?? DEFAULT_GRACE_DAYS);
  const graceEndsAt = addDays(expiresAt, graceDays);
  if (now <= expiresAt) return "active";
  if (now <= graceEndsAt) return "grace";
  return "expired";
}

// Derived from the SAME transactional tenant state as the active patch.
function subscriptionSlugPatch(tenant, patch) {
  return {
    active: patch.active,
    subscriptionStatus: patch.subscriptionStatus,
    subscriptionExpiresAt: patch.subscriptionExpiresAt || null,
    gracePeriodDays: patch.gracePeriodDays ?? tenant.gracePeriodDays ?? DEFAULT_GRACE_DAYS,
    updatedAt: FieldValue.serverTimestamp()
  };
}
function writeLegacySubscription(db, tenantRef, makePatch) {
  return mirrorLegacySubscriptionAccess({
    db, tenantRef, makePatch, makeSlugPatch: subscriptionSlugPatch,
  });
}

function defaultPatch(now = new Date(), tenant = {}) {
  const planCode = tenant.planCode === "yearly" ? "yearly" : "monthly";
  const trialEndsAt = asDate(tenant.trialEndsAt);
  const trialStartsAt = asDate(tenant.trialStartsAt);
  const trialing = tenant.subscriptionStatus === "trialing" && trialEndsAt && trialEndsAt > now;
  return {
    planCode,
    subscriptionStatus: trialing ? "trialing" : "active",
    subscriptionStartedAt: Timestamp.fromDate(trialStartsAt || now),
    subscriptionExpiresAt: Timestamp.fromDate(trialing ? trialEndsAt : addDays(now, DEFAULT_TERM_DAYS)),
    gracePeriodDays: DEFAULT_GRACE_DAYS,
    active: true,
    updatedAt: FieldValue.serverTimestamp()
  };
}

exports.initializeTenantSubscription = onDocumentCreated(
  { document: "tenants/{tenantId}", region: "asia-southeast1" },
  async event => {
    if (!event.data) return;
    const db = getFirestore();
    await writeLegacySubscription(db, event.data.ref, tenant => {
      if (tenant.subscriptionExpiresAt || revenueShareEnabled(tenant)) return null;
      return defaultPatch(new Date(), tenant);
    });
  }
);

exports.backfillTenantSubscriptions = onCall(
  { region: "asia-southeast1" },
  async request => {
    await assertSuperAdmin(request.auth);
    const db = getFirestore();
    const snapshot = await db.collection("tenants").get();
    let updated = 0;
    for (const tenantDoc of snapshot.docs) {
      const result = await writeLegacySubscription(db, tenantDoc.ref, tenant => {
        if (tenant.subscriptionExpiresAt || revenueShareEnabled(tenant)) return null;
        return defaultPatch(new Date(), tenant);
      });
      if (result.applied) updated += 1;
    }
    return { ok: true, updated };
  }
);

exports.updateTenantSubscription = onCall(
  { region: "asia-southeast1" },
  async request => {
    await assertSuperAdmin(request.auth);
    const tenantId = String(request.data?.tenantId || "").trim();
    if (!tenantId) throw new HttpsError("invalid-argument", "Tenant ID is required");
    const db = getFirestore();
    const tenantRef = db.collection("tenants").doc(tenantId);
    const action = String(request.data?.action || "").trim();
    if (!["extend", "set-expiry", "suspend", "activate"].includes(action))
      throw new HttpsError("invalid-argument", "Unknown subscription action");
    const result = await writeLegacySubscription(db, tenantRef, tenant => {
      const now = new Date();
      let expiresAt = asDate(tenant.subscriptionExpiresAt) || now;
      let status = tenant.subscriptionStatus || "active";
      let active = tenant.active !== false;
      let suspensionReason = tenant.suspensionReason || "";
      if (action === "extend") {
        const days = Math.max(1, Math.min(3660, Number(request.data?.days || 0)));
        const base = expiresAt > now ? expiresAt : now;
        expiresAt = addDays(base, days);
        status = "active";
        active = true;
        suspensionReason = "";
      } else if (action === "set-expiry") {
        const requested = asDate(request.data?.expiresAt);
        if (!requested) throw new HttpsError("invalid-argument", "Expiry date is invalid");
        requested.setHours(23, 59, 59, 999);
        expiresAt = requested;
        status = requested >= now ? "active" : "expired";
        active = status !== "expired";
        suspensionReason = "";
      } else if (action === "suspend") {
        status = "suspended";
        active = false;
        suspensionReason = String(request.data?.reason || "ระงับโดย Super Admin").trim();
      } else {
        status = effectiveStatus({ ...tenant, subscriptionStatus: "active",
          active: true, subscriptionExpiresAt: Timestamp.fromDate(expiresAt),
          suspensionReason: "" }, now);
        active = status === "active" || status === "grace";
        suspensionReason = "";
      }
      const gracePeriodDays = Math.max(0, Math.min(30,
        Number(request.data?.gracePeriodDays ?? tenant.gracePeriodDays ?? DEFAULT_GRACE_DAYS)));
      if (revenueShareEnabled(tenant)) active = tenant.revenueShareSuspended !== true;
      return {
        planCode: String(request.data?.planCode || tenant.planCode || "monthly"),
        subscriptionStatus: status,
        subscriptionExpiresAt: Timestamp.fromDate(expiresAt),
        gracePeriodDays, active, suspensionReason,
        suspendedAt: status === "suspended" ? FieldValue.serverTimestamp() : null,
        subscriptionUpdatedBy: request.auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
      };
    });
    if (!result.applied)
      throw new HttpsError(result.reason === "missing" ? "not-found" : "failed-precondition",
        result.reason === "missing" ? "Tenant not found" :
          "Hybrid tenants cannot use legacy subscription controls");
    const patch = result.patch;
    return { ok: true, tenantId, status: patch.subscriptionStatus, active: patch.active,
      expiresAt: asDate(patch.subscriptionExpiresAt).toISOString(),
      gracePeriodDays: patch.gracePeriodDays };
  }
);

exports.syncExpiredTenants = onSchedule(
  { schedule: "every day 00:15", timeZone: "Asia/Bangkok", region: "asia-southeast1" },
  async () => {
    const db = getFirestore();
    const snapshot = await db.collection("tenants").get();
    let changed = 0;
    for (const tenantDoc of snapshot.docs) {
      const result = await writeLegacySubscription(db, tenantDoc.ref, tenant => {
        if (revenueShareEnabled(tenant)) return null;
        if (!tenant.subscriptionExpiresAt) return defaultPatch(new Date(), tenant);
        if (tenant.subscriptionStatus === "suspended") return null;
        const status = effectiveStatus(tenant);
        const active = status === "active" || status === "grace";
        if (status === tenant.subscriptionStatus && active === (tenant.active !== false))
          return null;
        return { subscriptionStatus: status, active,
          updatedAt: FieldValue.serverTimestamp() };
      });
      if (result.applied) changed += 1;
    }
    console.log("Tenant subscription sync completed", { changed });
  }
);
