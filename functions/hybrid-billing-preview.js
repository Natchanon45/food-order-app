"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { dateKey, validDate, normalizeSettings, billingCycle, cycleWindow } = require("./hybrid-billing-core");
const { previewDeliveryOnlyMonth, previewDeliveryOnlyCycle } = require("./hybrid-billing-delivery-only");
const { loadHybridBillingSettings } = require("./hybrid-billing-settings");

const REGION = "asia-southeast1";
const MAX_PAID_ORDERS = 50000;
const PAGE_LIMIT = 500;
// Bound read-only Delivery history scans; never silently truncate a preview.
const MAX_AUDIT_DELIVERY = 10000;

function monthWindow(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ""))) {
    throw new HttpsError("invalid-argument", "Invalid calendar month");
  }
  const [year, m] = month.split("-").map(Number);
  const next = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
  const start = new Date(`${month}-01T00:00:00+07:00`);
  const end = new Date(`${next}-01T00:00:00+07:00`);
  return { start, end, nextMonth: next };
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
  const { start, end } = monthWindow(month);
  const periodSnap = await tenantRef.collection("hybridBillingPeriods").doc(month).get();
  const locked = periodSnap.exists && periodSnap.data()?.configSnapshot;
  // Snapshot is immutable after first billing issuance. Without it, show a prospective estimate only.
  const config = normalizeSettings(locked
    ? periodSnap.data().configSnapshot
    : month === tenant.hybridTrialMonth && tenant.hybridBillingSnapshot
      ? tenant.hybridBillingSnapshot
      : await loadHybridBillingSettings(db));
  const orders = await paidOrdersInWindow(tenantRef, start, end);
  const result = previewDeliveryOnlyMonth({
    orders, month, firstMonth: month === tenant.hybridTrialMonth, settings: config,
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


function resolveHybridStartDate(tenant = {}) {
  if (tenant.hybridBillingStartDate) return validDate(tenant.hybridBillingStartDate);
  // Existing signup already sets a trusted server Timestamp on the Tenant;
  // derive the anniversary from it without modifying signup or historical data.
  const created = tenant.createdAt?.toDate?.();
  if (!(created instanceof Date) || !Number.isFinite(created.getTime())) {
    throw new Error("HYBRID_BILLING_START_DATE_UNVERIFIED");
  }
  return dateKey(created);
}

// Bounded, read-only audit to detect paid Delivery documents excluded by a
// Firestore paidAt Timestamp range (e.g. legacy ISO strings or missing paidAt).
// This is an anomaly check, NOT a transactionally consistent certification.
async function auditPaidDeliveryCoverage(tenantRef, { maxDocs = MAX_AUDIT_DELIVERY } = {}) {
  if (!Number.isSafeInteger(maxDocs) || maxDocs < 1 || maxDocs > MAX_AUDIT_DELIVERY) {
    throw new RangeError("Invalid coverage audit limit");
  }
  let scanned = 0, paidDeliveryCount = 0, cursor = null;
  for (;;) {
    const pageSize = Math.min(PAGE_LIMIT, maxDocs + 1 - scanned);
    // Existing single-field Delivery index; no new composite index or
    // payment-status writer change is required.
    let query = tenantRef.collection("orders")
      .where("orderType", "==", "delivery")
      .orderBy("__name__").limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    if (!snap || !Array.isArray(snap.docs) || snap.size !== snap.docs.length
      || snap.size > pageSize) throw new Error("HYBRID_DELIVERY_COVERAGE_SCAN_INCOMPLETE");
    scanned += snap.size;
    if (scanned > maxDocs) throw new Error("HYBRID_DELIVERY_COVERAGE_SCAN_LIMIT");
    for (const doc of snap.docs) {
      const order = doc.data();
      // Even in a filtered query, enforce the Delivery-only boundary locally.
      if (String(order.orderType || "").toLowerCase() !== "delivery") continue;
      if (String(order.paymentStatus || "").toLowerCase() !== "paid") continue;
      const status = String(order.status || "").toLowerCase();
      if (["cancelled", "canceled", "voided", "deleted", "refunded"].includes(status)) continue;
      paidDeliveryCount++;
      const paidAt = order.paidAt?.toDate?.();
      if (!(paidAt instanceof Date) || !Number.isFinite(paidAt.getTime())) {
        throw new Error("HYBRID_PAID_DELIVERY_NONCANONICAL_TIMESTAMP");
      }
    }
    if (snap.size < pageSize) break;
    if (!snap.docs.length) throw new Error("HYBRID_DELIVERY_COVERAGE_SCAN_STALLED");
    cursor = snap.docs.at(-1);
  }
  return { scanned, paidDeliveryCount, coverageCertified: false };
}

// Reuse the existing server-recorded signup request date without editing
// registration or Tenant records. For pre-existing Tenants with no matching
// request, use their trusted Tenant.createdAt activation day as a fallback.
async function signupStartDateForPreview(db, tenant = {}) {
  if (tenant.hybridBillingStartDate) return resolveHybridStartDate(tenant);
  const ownerUid = String(tenant.ownerUid || "").trim();
  if (!ownerUid) return resolveHybridStartDate(tenant);
  const pendingSnap = await db.collection("publicTenantSignups").doc(ownerUid).get();
  const pending = pendingSnap.exists ? pendingSnap.data() : null;
  if (!pending || pending.uid !== ownerUid || pending.tenantId !== tenant.id
    || pending.status !== "active") return resolveHybridStartDate(tenant);
  const created = pending.createdAt?.toDate?.();
  if (!(created instanceof Date) || !Number.isFinite(created.getTime())) {
    throw new Error("HYBRID_SIGNUP_REQUEST_DATE_UNVERIFIED");
  }
  const signupDate = dateKey(created);
  // If retries altered the request date after activation, do not claim a
  // trusted signup anniversary or silently shift a user's billing cycle.
  if (signupDate > resolveHybridStartDate(tenant)) {
    throw new Error("HYBRID_SIGNUP_REQUEST_DATE_AFTER_ACTIVATION");
  }
  return signupDate;
}

async function previewHybridCycle(tenantRef, tenant, onDate, db,
  signupDate = resolveHybridStartDate(tenant)) {
  const cycle = billingCycle(signupDate, onDate);
  const { start, end } = cycleWindow(cycle);
  // Fail closed rather than showing a plausible partial number when legacy
  // paid Delivery records lack canonical timestamps.
  const audit = await auditPaidDeliveryCoverage(tenantRef);
  const snapshot = await tenantRef.collection("hybridBillingPeriods").doc(cycle.id).get();
  const locked = snapshot.exists && snapshot.data()?.configSnapshot;
  const config = normalizeSettings(locked
    ? snapshot.data().configSnapshot
    : cycle.firstCycle && tenant.hybridBillingSnapshot
      ? tenant.hybridBillingSnapshot
      : await loadHybridBillingSettings(db));
  const orders = await paidOrdersInWindow(tenantRef, start, end);
  const result = previewDeliveryOnlyCycle({
    orders, signupDate, cycleId: cycle.id, settings: config,
  });
  const now = new Date(), ended = now >= end, today = dateKey(now);
  return {
    ...result, tenantId: tenantRef.id, orderCountRead: orders.length,
    paidDeliveryAuditCount: audit.paidDeliveryCount,
    priceLocked: Boolean(locked), source: locked ? "billing_snapshot" : "prospective_estimate",
    coverageCertified: false, canIssueInvoice: false, periodEnded: ended,
    projectedFixedFee: !ended && result.mode === "fixed_monthly" ? result.fixedFee : 0,
    payableInvoices: result.invoices.filter(row =>
      row.issueAtCycleClose ? ended : row.date < today),
  };
}

exports.getTenantHybridBillingPreview = onCall({ region: REGION, timeoutSeconds: 60 }, async request => {
  const db = getFirestore();
  const { tenantRef, tenant } = await assertViewer(request, db);
  const onDate = String(request.data?.onDate || dateKey(new Date()));
  try {
    validDate(onDate);
    const today = dateKey(new Date());
    const signupDate = await signupStartDateForPreview(db, tenant);
    if (onDate < signupDate || onDate > today) {
      throw new RangeError("Date outside Tenant billing history");
    }
    const result = await previewHybridCycle(tenantRef, tenant, onDate, db, signupDate);
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof RangeError) {
      throw new HttpsError("invalid-argument", String(error.message));
    }
    throw error;
  }
});

// For tests and a future server-only invoicing/suspension reconciler.
// Exported pure/database-reader functions; no write/scheduler is enabled in this candidate.
exports.monthWindow = monthWindow;
exports.paidOrdersInWindow = paidOrdersInWindow;
exports.previewHybridMonth = previewHybridMonth;
exports.previewHybridCycle = previewHybridCycle;
exports.resolveHybridStartDate = resolveHybridStartDate;
exports.signupStartDateForPreview = signupStartDateForPreview;
exports.auditPaidDeliveryCoverage = auditPaidDeliveryCoverage;
