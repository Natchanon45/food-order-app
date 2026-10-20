"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { calculateCycle, dateKey, normalizeSettings, billingCycle,
  billingCycleById, cycleWindow, validDate } = require("./hybrid-billing-core");
const { paidDeliveryByWindow } = require("./hybrid-billing-orders");
const { loadHybridBillingSettings } = require("./hybrid-billing-settings");

const REGION = "asia-southeast1";
const MAX_PAID_ORDERS = 50000;
const PAGE_LIMIT = 500;

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

async function paidOrdersInWindow(tenantRef, start, end, {
  includeIds = false, transaction = null, maxRecords = MAX_PAID_ORDERS,
} = {}) {
  if (!(start instanceof Date) || !(end instanceof Date)
    || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())
    || start >= end || !Number.isSafeInteger(maxRecords) || maxRecords < 1
    || maxRecords > MAX_PAID_ORDERS) {
    throw new Error("HYBRID_INVALID_PAID_ORDER_WINDOW");
  }
  const orders = [];
  let cursor = null;
  do {
    const pageSize = Math.min(PAGE_LIMIT, maxRecords + 1 - orders.length);
    let query = tenantRef.collection("orders")
      .where("paidAt", ">=", Timestamp.fromDate(start))
      .where("paidAt", "<", Timestamp.fromDate(end))
      .orderBy("paidAt")
      .limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    // The read-only preview can use normal queries. Invoice issuance MUST use
    // Firestore Transaction.get(query), keeping ALL order reads inside the
    // same transaction and before every invoice/period write.
    if (transaction && typeof transaction.get !== "function") {
      throw new Error("HYBRID_TRANSACTION_READ_REQUIRED");
    }
    const snapshot = transaction ? await transaction.get(query) : await query.get();
    if (!snapshot || !Array.isArray(snapshot.docs) || snapshot.size !== snapshot.docs.length
      || snapshot.size > pageSize) {
      throw new Error("HYBRID_PAID_ORDER_SCAN_INCOMPLETE");
    }
    for (const doc of snapshot.docs) orders.push(
      includeIds ? { id: doc.id, data: doc.data() } : doc.data(),
    );
    if (orders.length > maxRecords) {
      throw new HttpsError("resource-exhausted", "Paid Delivery order scan exceeds safe limit");
    }
    if (snapshot.size < pageSize) break;
    if (!snapshot.docs.length) throw new Error("HYBRID_PAID_ORDER_SCAN_STALLED");
    cursor = snapshot.docs.at(-1);
  } while (cursor);
  return orders;
}

/**
 * Guard against silently underbilling Delivery payments whose paidAt was
 * persisted as an ISO string (or omitted). A Timestamp range would never
 * return these documents, even though paymentStatus='paid'.
 *
 * Deliberately scans ALL paid Delivery documents for this tenant, not only
 * indexed Timestamp rows. Large/unmigrated shops fail closed until canonical
 * server receipts + scalable coverage are implemented. No client date parsing.
 */
async function auditPaidDeliveryReceiptCoverage(tenantRef, {
  transaction = null, maxRecords = 3000,
} = {}) {
  if (!Number.isSafeInteger(maxRecords) || maxRecords < 1 || maxRecords > MAX_PAID_ORDERS) {
    throw new Error("HYBRID_RECEIPT_AUDIT_BAD_LIMIT");
  }
  const invalid = [];
  let cursor = null;
  let scanned = 0;
  for (;;) {
    const pageSize = Math.min(PAGE_LIMIT, maxRecords + 1 - scanned);
    let query = tenantRef.collection("orders")
      .where("orderType", "==", "delivery")
      .where("paymentStatus", "==", "paid")
      .orderBy("__name__")
      .limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = transaction ? await transaction.get(query) : await query.get();
    if (!snapshot || !Array.isArray(snapshot.docs)
      || snapshot.size !== snapshot.docs.length || snapshot.size > pageSize) {
      throw new Error("HYBRID_RECEIPT_AUDIT_INCOMPLETE");
    }
    scanned += snapshot.size;
    if (scanned > maxRecords) throw new Error("HYBRID_RECEIPT_AUDIT_LIMIT");
    for (const doc of snapshot.docs) {
      const order = doc.data();
      const paidDate = order?.paidAt?.toDate?.();
      if (!(paidDate instanceof Date) || !Number.isFinite(paidDate.getTime())
        || order.orderType !== "delivery" || order.paymentStatus !== "paid") {
        invalid.push(doc.id);
      }
    }
    if (invalid.length) {
      throw new Error("HYBRID_PAID_DELIVERY_NONCANONICAL_TIMESTAMP:" + invalid[0]);
    }
    if (snapshot.size < pageSize) break;
    if (!snapshot.docs.length) throw new Error("HYBRID_RECEIPT_AUDIT_STALLED");
    cursor = snapshot.docs.at(-1);
  }
  return { scanned, source: "all_paid_delivery" };
}

async function previewHybridCycle(tenantRef, tenant, cycleId, db) {
  const cycle = billingCycleById(tenant.hybridBillingStartDate, cycleId);
  const { start, end } = cycleWindow(cycle);
  const periodSnap = await tenantRef.collection("hybridBillingPeriods").doc(cycleId).get();
  const locked = periodSnap.exists && periodSnap.data()?.configSnapshot;
  const config = normalizeSettings(locked
    ? periodSnap.data().configSnapshot
    : cycle.firstCycle && tenant.hybridBillingSnapshot
      ? tenant.hybridBillingSnapshot
      : await loadHybridBillingSettings(db));
  // Do not display a plausible but incomplete estimate while a paid
  // Delivery receipt lacks canonical Firestore Timestamp provenance.
  const coverage = await auditPaidDeliveryReceiptCoverage(tenantRef);
  const orders = await paidOrdersInWindow(tenantRef, start, end);
  const daySales = paidDeliveryByWindow(orders, cycle.startDate, cycle.endDate);
  const result = calculateCycle({
    signupDate: tenant.hybridBillingStartDate, cycleId,
    dailyDeliverySales: daySales, settings: config,
  });
  const now = new Date();
  const ended = now >= end;
  const lastClosedDate = dateKey(now);
  return {
    ...result,
    tenantId: tenantRef.id,
    orderCountRead: orders.length,
    paidReceiptAuditCount: coverage.scanned,
    priceLocked: Boolean(locked),
    source: locked ? "billing_snapshot" : "prospective_estimate",
    periodEnded: ended,
    projectedFixedFee: !ended && result.mode === "fixed_monthly" ? result.fixedFee : 0,
    // Today's in-progress turnover is preview ONLY, not collectible until day close.
    payableInvoices: result.invoices.filter(row =>
      (row.issueAtCycleClose ? ended : row.date < lastClosedDate)),
  };
}

exports.getTenantHybridBillingPreview = onCall({ region: REGION, timeoutSeconds: 60 }, async request => {
  const db = getFirestore();
  const { tenantRef, tenant } = await assertViewer(request, db);
  const onDate = String(request.data?.onDate || dateKey(new Date()));
  const today = dateKey(new Date());
  try {
    validDate(onDate);
    if (onDate > today || onDate < tenant.hybridBillingStartDate) throw Error("Date outside billing history");
    const cycleId = billingCycle(tenant.hybridBillingStartDate, onDate).id;
    const result = await previewHybridCycle(tenantRef, tenant, cycleId, db);
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof RangeError || error.message === "Date outside billing history") {
      throw new HttpsError("invalid-argument", "Date outside tenant billing history");
    }
    throw error;
  }
});

// For tests and future internal billing service; no writes or scheduler enabled.
exports.paidOrdersInWindow = paidOrdersInWindow;
exports.auditPaidDeliveryReceiptCoverage = auditPaidDeliveryReceiptCoverage;
exports.previewHybridCycle = previewHybridCycle;
