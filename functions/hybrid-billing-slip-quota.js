"use strict";

// Phase 3D: isolated quota candidate, NOT active in live Delivery verification.
// Attempts use the signup-anniversary cycle, never a calendar-month bucket.
const { FieldValue } = require("firebase-admin/firestore");
const { dateKey, billingCycle, normalizeSettings } = require("./hybrid-billing-core");
const { previewHybridCycle } = require("./hybrid-billing-preview");

async function reserveHybridSlipVerification({ db, tenantId, orderId, attemptId,
  now = new Date(), providerAvailable = true,
  trustedPreview = previewHybridCycle,
  serverTimestamp = () => FieldValue.serverTimestamp() }) {
  if (!db || !/^[A-Za-z0-9_-]{8,128}$/.test(String(tenantId || ""))
    || !/^[A-Za-z0-9_-]{8,128}$/.test(String(orderId || ""))
    || !/^[A-Za-z0-9_-]{12,128}$/.test(String(attemptId || ""))
    || !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw Error("HYBRID_SLIP_QUOTA_BAD_REQUEST");
  }
  const today = dateKey(now);
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  const tenant = tenantSnap.data() || {};
  if (!tenantSnap.exists || tenant.billingPolicyVersion !== "hybrid_v1"
    || tenant.hybridBillingEnabled !== true || !tenant.hybridBillingStartDate
    || today < tenant.hybridBillingStartDate) {
    throw Error("HYBRID_TENANT_NOT_ACTIVATED");
  }
  const cycle = billingCycle(tenant.hybridBillingStartDate, today);
  const cycleId = cycle.id;
  if (providerAvailable !== true) {
    return { status: "manual_review", reason: "provider_unavailable", cycleId, counted: false };
  }
  // Read authoritative server-paid Delivery only, NEVER client threshold flags.
  const report = await trustedPreview(tenantRef, tenant, cycleId, db);
  if (report.cycleId !== cycleId || report.tenantId !== tenantId) {
    throw Error("HYBRID_TRUSTED_PREVIEW_REQUIRED");
  }
  const usageRef = tenantRef.collection("hybridSlipUsage").doc(cycleId);
  const attemptRef = tenantRef.collection("hybridSlipReservations").doc(attemptId);
  const periodRef = tenantRef.collection("hybridBillingPeriods").doc(cycleId);
  return db.runTransaction(async tx => {
    const [freshTenant, period, usage, prior] = await Promise.all([
      tx.get(tenantRef), tx.get(periodRef), tx.get(usageRef), tx.get(attemptRef),
    ]);
    if (freshTenant.data()?.billingPolicyVersion !== "hybrid_v1"
      || freshTenant.data()?.hybridBillingEnabled !== true
      || freshTenant.data()?.hybridBillingStartDate !== tenant.hybridBillingStartDate) {
      throw Error("HYBRID_TENANT_NOT_ACTIVATED");
    }
    if (prior.exists) {
      if (prior.data()?.tenantId !== tenantId || prior.data()?.orderId !== orderId
        || prior.data()?.cycleId !== cycleId) throw Error("HYBRID_SLIP_RESERVATION_CONFLICT");
      return { cycleId, status: prior.data().status, reason: prior.data().reason || "",
        counted: prior.data().counted === true, alreadyReserved: true };
    }
    if (period.exists && (period.data()?.cycleStart !== cycle.startDate
      || period.data()?.cycleEnd !== cycle.endDate || period.data()?.firstCycle !== cycle.firstCycle)) {
      throw Error("HYBRID_PERIOD_INVALID");
    }
    const config = normalizeSettings(period.exists ? period.data().configSnapshot : report.config);
    const alreadyUnlimited = usage.data()?.unlimited === true;
    const unlimited = alreadyUnlimited || Boolean(report.triggerDate);
    const count = Number(usage.data()?.count || 0);
    if (!Number.isSafeInteger(count) || count < 0) throw Error("HYBRID_SLIP_USAGE_INVALID");
    const allowed = unlimited || count < config.monthlySlipQuota;
    const result = { cycleId, status: allowed ? "reserved" : "manual_review",
      reason: allowed ? "" : "monthly_quota_exhausted", counted: allowed && !unlimited,
      alreadyReserved: false };
    if (!period.exists) tx.create(periodRef, {
      tenantId, cycleId, cycleStart: cycle.startDate, cycleEnd: cycle.endDate,
      policyVersion: "hybrid_v1", firstCycle: cycle.firstCycle, configSnapshot: config,
      daySeals: {}, issuedInvoiceIds: [], createdAt: serverTimestamp(),
    });
    tx.create(attemptRef, {
      tenantId, orderId, attemptId, cycleId, status: result.status, reason: result.reason,
      counted: result.counted, createdAt: serverTimestamp(),
    });
    if (allowed) {
      tx.set(usageRef, {
        tenantId, cycleId, count: count + (unlimited ? 0 : 1), unlimited,
        quotaSnapshot: config.monthlySlipQuota, updatedAt: serverTimestamp(),
      });
    }
    return result;
  });
}
module.exports = { reserveHybridSlipVerification };
