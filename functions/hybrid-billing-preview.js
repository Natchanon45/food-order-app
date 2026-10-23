"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { calculateCycle, dateKey, normalizeSettings } = require("./hybrid-billing-core");
const { tenantAnchorDate, cycleFromMonth } = require("./billing-anniversary");
const { paidDeliveryByDay } = require("./hybrid-billing-orders");
const { loadHybridBillingSettings } = require("./hybrid-billing-settings");

const REGION = "asia-southeast1";
const MAX_PAID_ORDERS = 50000;
const PAGE_LIMIT = 500;

function monthWindow(month, anchor = "") {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ""))) {
    throw new HttpsError("invalid-argument", "Invalid calendar month");
  }
  if (anchor) {
    const cycle = cycleFromMonth(anchor, month);
    return { start: cycle.start, end: cycle.end,
      startDate: cycle.startDate, endDate: cycle.endDate,
      endExclusiveDate: cycle.endExclusiveDate,
      nextMonth: cycle.endExclusiveDate.slice(0, 7) };
  }
  const [year, m] = month.split("-").map(Number);
  const next = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
  const start = new Date(`${month}-01T00:00:00+07:00`);
  const end = new Date(`${next}-01T00:00:00+07:00`);
  return { start, end, startDate: month + "-01", endExclusiveDate: next + "-01", nextMonth: next };
}

async function assertViewer(request, db) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign-in required");
  const profileSnap = await db.collection("users").doc(uid).get();
  const profile = profileSnap.data();
  if (!profile || profile.active === false) {
    throw new HttpsError("permission-denied", "Valid profile required");
  }
  const superAdmin = profile.role === "super_admin";
  const tenantId = superAdmin ? String(request.data?.tenantId || "").trim() : String(profile.tenantId || "").trim();
  if (!tenantId || (!superAdmin && !["owner", "admin"].includes(profile.role))) {
    throw new HttpsError("permission-denied", "Tenant owner or Super Admin required");
  }
  if (!superAdmin && request.data?.tenantId && request.data.tenantId !== tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied");
  }
  const tenantRef = db.collection("tenants").doc(tenantId);
  const snap = await tenantRef.get();
  if (!snap.exists || snap.data()?.billingPolicyVersion !== "hybrid_v1") {
    throw new HttpsError("failed-precondition", "Hybrid billing is not enabled for this tenant");
  }
  // Admin SDK trusted reads remain available to tenant owners during suspension.
  return { tenantId, tenantRef, tenant: snap.data(), superAdmin };
}

async function paidOrdersInWindow(tenantRef, start, end) {
  const orders = [];
  let cursor = null;
  do {
    let query = tenantRef.collection("orders")
      .where("paidAt", ">=", Timestamp.fromDate(start))
      .where("paidAt", "<", Timestamp.fromDate(end))
      .orderBy("paidAt")
      .limit(PAGE_LIMIT);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    for (const doc of snapshot.docs) orders.push(doc.data());
    if (orders.length > MAX_PAID_ORDERS) {
      throw new HttpsError("resource-exhausted", "Too many orders for preview");
    }
    if (snapshot.size < PAGE_LIMIT) break;
    cursor = snapshot.docs.at(-1);
  } while (cursor);
  return orders;
}

async function previewHybridMonth(tenantRef, tenant, month, db) {
  const anchor = tenantAnchorDate(tenant);
  const { start, end, startDate, endExclusiveDate } = monthWindow(month, anchor);
  const periodSnap = await tenantRef.collection("hybridBillingPeriods").doc(month).get();
  const locked = periodSnap.exists && periodSnap.data()?.configSnapshot;
  // Snapshot is immutable after first billing issuance. Without it, show a prospective estimate only.
  const config = normalizeSettings(locked
    ? periodSnap.data().configSnapshot
    : month === tenant.hybridTrialMonth && tenant.hybridBillingSnapshot
      ? tenant.hybridBillingSnapshot
      : await loadHybridBillingSettings(db));
  const orders = await paidOrdersInWindow(tenantRef, start, end);
  const daySales = paidDeliveryByDay(orders, { startDate, endExclusiveDate });
  const result = calculateCycle({
    month, cycleStartDate: startDate, cycleEndExclusiveDate: endExclusiveDate,
    firstMonth: month === tenant.hybridTrialMonth,
    dailyDeliverySales: daySales, settings: config,
  });
  const now = new Date();
  const ended = now >= end;
  return {
    ...result,
    tenantId: tenantRef.id,
    orderCountRead: orders.length,
    priceLocked: Boolean(locked),
    source: locked ? "billing_snapshot" : "prospective_estimate",
    periodEnded: ended,
    // Fixed monthly invoice exists in the calculator as a month-close projection only.
    projectedFixedFee: !ended && result.mode === "fixed_monthly" ? result.fixedFee : 0,
    payableInvoices: result.invoices.filter(row => !row.issueAtMonthClose || ended),
  };
}

exports.getTenantHybridBillingPreview = onCall({ region: REGION, timeoutSeconds: 60 }, async request => {
  const db = getFirestore();
  const { tenantRef, tenant } = await assertViewer(request, db);
  const month = String(request.data?.month || dateKey(new Date()).slice(0, 7));
  const todayMonth = dateKey(new Date()).slice(0, 7);
  // Prevent high-volume unrestricted historical order scans through callable requests.
  const minMonth = String(tenant.hybridTrialMonth || "");
  if (!minMonth || month < minMonth || month > todayMonth) {
    throw new HttpsError("invalid-argument", "Month outside tenant billing history");
  }
  const result = await previewHybridMonth(tenantRef, tenant, month, db);
  return { ok: true, ...result };
});

// For tests and a future server-only invoicing/suspension reconciler.
// Exported pure/database-reader functions; no write/scheduler is enabled in this candidate.
exports.monthWindow = monthWindow;
exports.paidOrdersInWindow = paidOrdersInWindow;
exports.previewHybridMonth = previewHybridMonth;
