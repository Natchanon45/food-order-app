const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const DEFAULT_TERM_DAYS = 30;
const DEFAULT_GRACE_DAYS = 3;
const VALID_STATUSES = new Set(["active", "grace", "expired", "suspended"]);

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

function effectiveStatus(tenant, now = new Date()) {
  if (tenant.subscriptionStatus === "suspended" || tenant.active === false && tenant.suspensionReason) return "suspended";
  const expiresAt = asDate(tenant.subscriptionExpiresAt);
  if (!expiresAt) return tenant.subscriptionStatus || "active";
  const graceDays = Number(tenant.gracePeriodDays ?? DEFAULT_GRACE_DAYS);
  const graceEndsAt = addDays(expiresAt, graceDays);
  if (now <= expiresAt) return "active";
  if (now <= graceEndsAt) return "grace";
  return "expired";
}

async function mirrorSubscription(batch, db, tenantId, tenant, patch) {
  const slug = String(tenant.slug || "").trim();
  if (!slug) return;
  batch.set(db.collection("tenantSlugs").doc(slug), {
    active: patch.active,
    subscriptionStatus: patch.subscriptionStatus,
    subscriptionExpiresAt: patch.subscriptionExpiresAt || null,
    gracePeriodDays: patch.gracePeriodDays ?? tenant.gracePeriodDays ?? DEFAULT_GRACE_DAYS,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

exports.initializeTenantSubscription = onDocumentCreated(
  { document: "tenants/{tenantId}", region: "asia-southeast1" },
  async event => {
    const snapshot = event.data;
    if (!snapshot) return;
    const tenant = snapshot.data();
    if (tenant.subscriptionExpiresAt) return;

    const now = new Date();
    const expiresAt = addDays(now, DEFAULT_TERM_DAYS);
    const db = getFirestore();
    const batch = db.batch();
    const patch = {
      planCode: "monthly",
      subscriptionStatus: "active",
      subscriptionStartedAt: Timestamp.fromDate(now),
      subscriptionExpiresAt: Timestamp.fromDate(expiresAt),
      gracePeriodDays: DEFAULT_GRACE_DAYS,
      active: true,
      updatedAt: FieldValue.serverTimestamp()
    };
    batch.set(snapshot.ref, patch, { merge: true });
    await mirrorSubscription(batch, db, event.params.tenantId, tenant, patch);
    await batch.commit();
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
    const snapshot = await tenantRef.get();
    if (!snapshot.exists) throw new HttpsError("not-found", "Tenant not found");
    const tenant = snapshot.data();

    const action = String(request.data?.action || "").trim();
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
    } else if (action === "activate") {
      status = effectiveStatus({ ...tenant, subscriptionStatus: "active", active: true, subscriptionExpiresAt: Timestamp.fromDate(expiresAt), suspensionReason: "" }, now);
      active = status === "active" || status === "grace";
      suspensionReason = "";
    } else {
      throw new HttpsError("invalid-argument", "Unknown subscription action");
    }

    const gracePeriodDays = Math.max(0, Math.min(30, Number(request.data?.gracePeriodDays ?? tenant.gracePeriodDays ?? DEFAULT_GRACE_DAYS)));
    const patch = {
      planCode: String(request.data?.planCode || tenant.planCode || "monthly"),
      subscriptionStatus: status,
      subscriptionExpiresAt: Timestamp.fromDate(expiresAt),
      gracePeriodDays,
      active,
      suspensionReason,
      suspendedAt: status === "suspended" ? FieldValue.serverTimestamp() : null,
      subscriptionUpdatedBy: request.auth.uid,
      updatedAt: FieldValue.serverTimestamp()
    };

    const batch = db.batch();
    batch.set(tenantRef, patch, { merge: true });
    await mirrorSubscription(batch, db, tenantId, tenant, patch);
    await batch.commit();
    return { ok: true, tenantId, status, active, expiresAt: expiresAt.toISOString(), gracePeriodDays };
  }
);

exports.syncExpiredTenants = onSchedule(
  { schedule: "every day 00:15", timeZone: "Asia/Bangkok", region: "asia-southeast1" },
  async () => {
    const db = getFirestore();
    const snapshot = await db.collection("tenants").get();
    let changed = 0;

    for (const doc of snapshot.docs) {
      const tenant = doc.data();
      if (tenant.subscriptionStatus === "suspended") continue;
      const status = effectiveStatus(tenant);
      const active = status === "active" || status === "grace";
      if (status === tenant.subscriptionStatus && active === (tenant.active !== false)) continue;

      const patch = { subscriptionStatus: status, active, updatedAt: FieldValue.serverTimestamp() };
      const batch = db.batch();
      batch.set(doc.ref, patch, { merge: true });
      await mirrorSubscription(batch, db, doc.id, tenant, { ...patch, subscriptionExpiresAt: tenant.subscriptionExpiresAt || null, gracePeriodDays: tenant.gracePeriodDays ?? DEFAULT_GRACE_DAYS });
      await batch.commit();
      changed += 1;
    }

    console.log("Tenant subscription sync completed", { changed });
  }
);
