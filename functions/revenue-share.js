const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const REGION = "asia-southeast1";
const TZ_OFFSET = "+07:00";
const MAX_SLIP_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const PAID_ORDER_STATUSES = new Set(["paid", "completed", "served", "delivered", "closed"]);
const CANCELLED_STATUSES = new Set(["cancelled", "voided", "deleted"]);

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "object" && Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function dateAtBangkok(value) {
  return new Date(`${value}T00:00:00${TZ_OFFSET}`);
}

function addDays(date, days) {
  return new Date(date.getTime() + Number(days || 0) * 86400000);
}

function periodFromData(data = {}) {
  const now = new Date();
  const today = dateKey(now);
  const period = ["daily", "monthly", "yearly", "custom"].includes(String(data.period || "")) ? String(data.period) : "daily";
  if (period === "monthly") {
    const month = /^\d{4}-\d{2}$/.test(String(data.month || "")) ? String(data.month) : today.slice(0, 7);
    const [year, monthNo] = month.split("-").map(Number);
    const start = new Date(`${month}-01T00:00:00${TZ_OFFSET}`);
    const nextMonth = monthNo === 12 ? `${year + 1}-01` : `${year}-${String(monthNo + 1).padStart(2, "0")}`;
    const end = new Date(`${nextMonth}-01T00:00:00${TZ_OFFSET}`);
    return { type: period, start, end, startDate: dateKey(start), endDate: dateKey(addDays(end, -1)), label: start.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", month: "long", year: "numeric" }) };
  }
  if (period === "yearly") {
    const year = Math.max(2000, Math.min(2200, Number(data.year || today.slice(0, 4))));
    const start = new Date(`${year}-01-01T00:00:00${TZ_OFFSET}`);
    const end = new Date(`${year + 1}-01-01T00:00:00${TZ_OFFSET}`);
    return { type: period, start, end, startDate: `${year}-01-01`, endDate: `${year}-12-31`, label: `ปี ${year}` };
  }
  if (period === "custom") {
    let startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(data.startDate || "")) ? String(data.startDate) : today;
    let endDate = /^\d{4}-\d{2}-\d{2}$/.test(String(data.endDate || "")) ? String(data.endDate) : startDate;
    if (endDate < startDate) [startDate, endDate] = [endDate, startDate];
    const start = dateAtBangkok(startDate);
    let end = addDays(dateAtBangkok(endDate), 1);
    if ((end - start) / 86400000 > 3661) end = addDays(start, 3661);
    endDate = dateKey(addDays(end, -1));
    return { type: period, start, end, startDate, endDate, label: `${startDate} – ${endDate}` };
  }
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(String(data.date || "")) ? String(data.date) : today;
  const start = dateAtBangkok(selected);
  return { type: "daily", start, end: addDays(start, 1), startDate: selected, endDate: selected, label: selected };
}

async function profileFor(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const snapshot = await getFirestore().collection("users").doc(auth.uid).get();
  const profile = snapshot.data();
  if (!profile || profile.active === false) throw new HttpsError("permission-denied", "Active user profile required");
  return { uid: auth.uid, ...profile };
}

async function assertSuperAdmin(auth) {
  const profile = await profileFor(auth);
  if (profile.role !== "super_admin") throw new HttpsError("permission-denied", "Super admin permission required");
  return profile;
}

async function assertTenantAdmin(auth) {
  const profile = await profileFor(auth);
  if (!["owner", "admin"].includes(profile.role) || !profile.tenantId) throw new HttpsError("permission-denied", "Owner or admin permission required");
  const tenantRef = getFirestore().collection("tenants").doc(String(profile.tenantId));
  const tenantSnapshot = await tenantRef.get();
  if (!tenantSnapshot.exists) throw new HttpsError("not-found", "Tenant not found");
  return { profile, tenantRef, tenant: { id: tenantSnapshot.id, ...tenantSnapshot.data() } };
}

function revenueSetting(tenant = {}) {
  return {
    enabled: tenant.revenueShareEnabled === true || tenant.billingMode === "revenue_share",
    rate: Math.max(0, Math.min(100, Number(tenant.revenueShareRate || 0))),
    billingCycle: tenant.revenueShareBillingCycle === "daily" ? "daily" : "monthly"
  };
}

function orderDate(order = {}) {
  return asDate(order.paidAt) || asDate(order.completedAt) || asDate(order.updatedAt) || asDate(order.createdAt) || asDate(order.createdAtText);
}

function saleDate(sale = {}) {
  return asDate(sale.completedAt) || asDate(sale.createdAt) || asDate(sale.updatedAt);
}

function validOrder(order = {}) {
  const status = String(order.status || "").toLowerCase();
  const payment = String(order.paymentStatus || "").toLowerCase();
  if (CANCELLED_STATUSES.has(status)) return false;
  return payment === "paid" || PAID_ORDER_STATUSES.has(status);
}

function validSale(sale = {}) {
  const status = String(sale.status || "completed").toLowerCase();
  return !["voided", "cancelled", "deleted"].includes(status);
}

async function summaryForTenant(tenantId, period, setting) {
  const db = getFirestore();
  const [ordersSnapshot, salesSnapshot] = await Promise.all([
    db.collection("tenants").doc(tenantId).collection("orders").get(),
    db.collection("tenants").doc(tenantId).collection("sales").get()
  ]);
  let orderSales = 0, orderCount = 0, posSales = 0, posCount = 0;
  ordersSnapshot.docs.forEach(snapshot => {
    const row = snapshot.data();
    const date = orderDate(row);
    if (!date || date < period.start || date >= period.end || !validOrder(row)) return;
    orderSales += Number(row.totalAmount ?? row.total ?? 0) || 0;
    orderCount += 1;
  });
  salesSnapshot.docs.forEach(snapshot => {
    const row = snapshot.data();
    const date = saleDate(row);
    if (!date || date < period.start || date >= period.end || !validSale(row)) return;
    const gross = Number(row.totalAmount ?? row.total ?? 0) || 0;
    const refund = Number(row.refundTotal || 0) || 0;
    posSales += Math.max(0, gross - refund);
    posCount += 1;
  });
  orderSales = Math.round(orderSales * 100) / 100;
  posSales = Math.round(posSales * 100) / 100;
  const combinedSales = Math.round((orderSales + posSales) * 100) / 100;
  const revenueShare = setting.enabled ? Math.round(combinedSales * setting.rate) / 100 : 0;
  return { orderSales, orderCount, posSales, posCount, combinedSales, revenueShareEnabled: setting.enabled, revenueShareRate: setting.rate, revenueShareBillingCycle: setting.billingCycle, revenueShare };
}

function paymentPayload(snapshot, tenant = null) {
  const row = snapshot.data();
  return {
    id: snapshot.id,
    tenant: tenant ? { id: tenant.id, name: tenant.name || "", slug: tenant.slug || "" } : undefined,
    period: { type: row.periodType, label: row.periodLabel, startDate: row.periodStart, endDate: row.periodEnd },
    orderSales: Number(row.orderSales || 0), posSales: Number(row.posSales || 0), combinedSales: Number(row.combinedSales || 0),
    revenueShareRate: Number(row.revenueShareRate || 0), revenueShareAmount: Number(row.revenueShareAmount || 0),
    status: row.status || "pending", reviewNote: row.reviewNote || "", submittedAt: asDate(row.createdAt)?.toISOString() || "", reviewedAt: asDate(row.reviewedAt)?.toISOString() || "",
    slip: { name: row.slipName || "", mime: row.slipMime || "", size: Number(row.slipSize || 0), path: row.slipPath || "" }
  };
}

function subscriptionActive(tenant = {}, now = new Date()) {
  if (tenant.subscriptionStatus === "suspended") return false;
  const expiry = asDate(tenant.subscriptionExpiresAt);
  if (!expiry) return tenant.active !== false;
  return now <= addDays(expiry, Number(tenant.gracePeriodDays ?? 3));
}

async function mirrorTenantAccess(tenantRef, tenant, patch) {
  const db = getFirestore();
  const slug = String(tenant.slug || "").trim();
  const batch = db.batch();
  batch.set(tenantRef, { ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (slug) batch.set(db.collection("tenantSlugs").doc(slug), { ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
}

function overrideMatches(tenant = {}, startDate, endDate) {
  const overrides = Array.isArray(tenant.revenueShareUnlockOverrides) ? tenant.revenueShareUnlockOverrides : [];
  return overrides.some(item => item && item.periodStart === startDate && item.periodEnd === endDate);
}

function previousPeriod(cycle) {
  const today = dateKey(new Date());
  if (cycle === "daily") {
    const start = addDays(dateAtBangkok(today), -1);
    const key = dateKey(start);
    return { type: "daily", startDate: key, endDate: key, start, end: addDays(start, 1) };
  }
  const [year, month] = today.slice(0, 7).split("-").map(Number);
  const py = month === 1 ? year - 1 : year;
  const pm = month === 1 ? 12 : month - 1;
  const startKey = `${py}-${String(pm).padStart(2, "0")}-01`;
  const nextKey = `${year}-${String(month).padStart(2, "0")}-01`;
  const start = dateAtBangkok(startKey), end = dateAtBangkok(nextKey);
  return { type: "monthly", startDate: startKey, endDate: dateKey(addDays(end, -1)), start, end };
}

async function latestPaymentForPeriod(tenantRef, startDate, endDate) {
  const snapshot = await tenantRef.collection("revenueSharePayments").orderBy("createdAt", "desc").limit(100).get();
  return snapshot.docs.find(doc => {
    const row = doc.data();
    return row.periodStart === startDate && row.periodEnd === endDate;
  }) || null;
}

async function reconcileTenant(tenantId) {
  const db = getFirestore();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnapshot = await tenantRef.get();
  if (!tenantSnapshot.exists) return { state: "tenant_missing", action: "none" };
  let tenant = { id: tenantSnapshot.id, ...tenantSnapshot.data() };
  const setting = revenueSetting(tenant);
  if (!setting.enabled) {
    if (!tenant.revenueShareSuspended) return { state: "subscription", action: "none" };
    const active = subscriptionActive(tenant);
    await mirrorTenantAccess(tenantRef, tenant, { active, revenueShareSuspended: false, revenueShareSuspendedAt: FieldValue.delete(), revenueShareSuspendedPeriodType: FieldValue.delete(), revenueShareSuspendedPeriodStart: FieldValue.delete(), revenueShareSuspendedPeriodEnd: FieldValue.delete(), revenueShareSuspensionReason: FieldValue.delete() });
    return { state: active ? "active" : "subscription_inactive", action: "released" };
  }
  if (tenant.revenueShareSuspended) {
    const payment = await latestPaymentForPeriod(tenantRef, tenant.revenueShareSuspendedPeriodStart || "", tenant.revenueShareSuspendedPeriodEnd || "");
    if (!payment || payment.data().status !== "approved") return { state: "suspended", action: "none" };
    await mirrorTenantAccess(tenantRef, tenant, { active: true, revenueShareSuspended: false, revenueShareSuspendedAt: FieldValue.delete(), revenueShareSuspendedPeriodType: FieldValue.delete(), revenueShareSuspendedPeriodStart: FieldValue.delete(), revenueShareSuspendedPeriodEnd: FieldValue.delete(), revenueShareSuspensionReason: FieldValue.delete() });
    tenant = { ...tenant, active: true, revenueShareSuspended: false };
  }
  const due = previousPeriod(setting.billingCycle);
  if (overrideMatches(tenant, due.startDate, due.endDate)) return { state: "manual_override", action: "none" };
  const payment = await latestPaymentForPeriod(tenantRef, due.startDate, due.endDate);
  if (payment?.data().status === "approved") return { state: "approved", action: "none" };
  if (payment?.data().status === "pending") return { state: "pending", action: "none" };
  const summary = await summaryForTenant(tenantId, due, setting);
  if (summary.revenueShare <= 0) return { state: "not_due", action: "none" };
  const reason = payment?.data().status === "rejected" ? "rejected_payment" : "missing_payment";
  await mirrorTenantAccess(tenantRef, tenant, { active: false, revenueShareSuspended: true, revenueShareSuspendedAt: FieldValue.serverTimestamp(), revenueShareSuspendedPeriodType: due.type, revenueShareSuspendedPeriodStart: due.startDate, revenueShareSuspendedPeriodEnd: due.endDate, revenueShareSuspensionReason: reason });
  return { state: "suspended", action: "suspended", periodStart: due.startDate, periodEnd: due.endDate };
}

exports.getTenantRevenueShareAccess = onCall({ region: REGION }, async request => {
  const { tenant } = await assertTenantAdmin(request.auth);
  return revenueSetting(tenant);
});

exports.getTenantRevenueShareSummary = onCall({ region: REGION }, async request => {
  const { tenant } = await assertTenantAdmin(request.auth);
  const setting = revenueSetting(tenant);
  if (!setting.enabled) throw new HttpsError("permission-denied", "Revenue share is disabled");
  const period = periodFromData(request.data || {});
  return { period: { type: period.type, label: period.label, startDate: period.startDate, endDate: period.endDate }, tenantId: tenant.id, summary: await summaryForTenant(tenant.id, period, setting) };
});

exports.listTenantRevenueSharePayments = onCall({ region: REGION }, async request => {
  const { tenantRef } = await assertTenantAdmin(request.auth);
  const snapshot = await tenantRef.collection("revenueSharePayments").orderBy("createdAt", "desc").limit(50).get();
  return { items: snapshot.docs.map(doc => paymentPayload(doc)) };
});

exports.submitTenantRevenueSharePayment = onCall({ region: REGION }, async request => {
  const { profile, tenantRef, tenant } = await assertTenantAdmin(request.auth);
  const setting = revenueSetting(tenant);
  if (!setting.enabled) throw new HttpsError("failed-precondition", "Revenue share is disabled");
  const period = periodFromData(request.data || {});
  if (period.type !== setting.billingCycle) throw new HttpsError("failed-precondition", `Billing cycle is ${setting.billingCycle}`);
  const existing = await latestPaymentForPeriod(tenantRef, period.startDate, period.endDate);
  if (existing && ["pending", "approved"].includes(existing.data().status)) throw new HttpsError("already-exists", "This period already has a pending or approved payment");
  const id = String(request.data?.paymentId || "").trim();
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(id)) throw new HttpsError("invalid-argument", "Invalid payment ID");
  const slipPath = String(request.data?.slipPath || "");
  const prefix = `tenants/${tenant.id}/revenue-share-slips/${id}/`;
  if (!slipPath.startsWith(prefix)) throw new HttpsError("invalid-argument", "Invalid slip path");
  const file = getStorage().bucket().file(slipPath);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "Slip file not found");
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size || 0), mime = String(metadata.contentType || "").toLowerCase();
  if (size <= 0 || size > MAX_SLIP_SIZE || !ALLOWED_MIME.has(mime)) throw new HttpsError("invalid-argument", "Slip file is invalid");
  const summary = await summaryForTenant(tenant.id, period, setting);
  const ref = tenantRef.collection("revenueSharePayments").doc(id);
  if ((await ref.get()).exists) throw new HttpsError("already-exists", "Payment ID already exists");
  await ref.set({ id, tenantId: tenant.id, periodType: period.type, periodLabel: period.label, periodStart: period.startDate, periodEnd: period.endDate, orderSales: summary.orderSales, posSales: summary.posSales, combinedSales: summary.combinedSales, revenueShareRate: setting.rate, revenueShareAmount: summary.revenueShare, slipPath, slipName: String(request.data?.slipName || metadata.name || "slip").slice(0, 255), slipMime: mime, slipSize: size, status: "pending", reviewNote: "", submittedBy: profile.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  const saved = await ref.get();
  return { item: paymentPayload(saved) };
});

exports.getPlatformRevenueShareSummary = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  const db = getFirestore();
  const period = periodFromData(request.data || {});
  const tenantFilter = String(request.data?.tenantId || "").trim();
  const tenantsSnapshot = await db.collection("tenants").get();
  const tenants = tenantsSnapshot.docs.filter(doc => !tenantFilter || doc.id === tenantFilter);
  const result = {}, totals = { orderSales: 0, orderCount: 0, posSales: 0, posCount: 0, combinedSales: 0, revenueShare: 0 };
  for (const snapshot of tenants) {
    const tenant = { id: snapshot.id, ...snapshot.data() };
    const summary = await summaryForTenant(tenant.id, period, revenueSetting(tenant));
    result[tenant.id] = summary;
    Object.keys(totals).forEach(key => { totals[key] += Number(summary[key] || 0); });
  }
  ["orderSales", "posSales", "combinedSales", "revenueShare"].forEach(key => { totals[key] = Math.round(totals[key] * 100) / 100; });
  return { period: { type: period.type, label: period.label, startDate: period.startDate, endDate: period.endDate }, totals, tenants: result };
});

exports.listPlatformRevenueSharePayments = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  const db = getFirestore();
  const status = ["pending", "approved", "rejected", "all"].includes(String(request.data?.status || "")) ? String(request.data.status) : "pending";
  const tenantFilter = String(request.data?.tenantId || "").trim();
  const tenantsSnapshot = await db.collection("tenants").get();
  const items = [], counts = { pending: 0, approved: 0, rejected: 0 };
  for (const tenantSnapshot of tenantsSnapshot.docs) {
    if (tenantFilter && tenantSnapshot.id !== tenantFilter) continue;
    const tenant = { id: tenantSnapshot.id, ...tenantSnapshot.data() };
    const payments = await tenantSnapshot.ref.collection("revenueSharePayments").orderBy("createdAt", "desc").limit(200).get();
    payments.docs.forEach(doc => {
      const rowStatus = doc.data().status || "pending";
      if (counts[rowStatus] !== undefined) counts[rowStatus] += 1;
      if (status === "all" || status === rowStatus) items.push(paymentPayload(doc, tenant));
    });
  }
  items.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
  return { status, counts, items: items.slice(0, 200) };
});

exports.reviewRevenueSharePayment = onCall({ region: REGION }, async request => {
  const reviewer = await assertSuperAdmin(request.auth);
  const tenantId = String(request.data?.tenantId || "").trim(), paymentId = String(request.data?.paymentId || "").trim();
  const action = String(request.data?.action || "");
  const note = String(request.data?.note || "").trim();
  if (!tenantId || !paymentId || !["approve", "reject"].includes(action)) throw new HttpsError("invalid-argument", "Invalid review request");
  if (action === "reject" && !note) throw new HttpsError("invalid-argument", "Reject note is required");
  const db = getFirestore(), tenantRef = db.collection("tenants").doc(tenantId), paymentRef = tenantRef.collection("revenueSharePayments").doc(paymentId);
  const [tenantSnapshot, paymentSnapshot] = await Promise.all([tenantRef.get(), paymentRef.get()]);
  if (!tenantSnapshot.exists || !paymentSnapshot.exists) throw new HttpsError("not-found", "Payment not found");
  if (paymentSnapshot.data().status !== "pending") throw new HttpsError("already-exists", "Payment already reviewed");
  const status = action === "approve" ? "approved" : "rejected";
  await paymentRef.set({ status, reviewNote: note, reviewedBy: reviewer.uid, reviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const payment = { ...paymentSnapshot.data(), status, reviewNote: note };
  const tenant = { id: tenantSnapshot.id, ...tenantSnapshot.data() };
  if (status === "approved" && tenant.revenueShareSuspended && tenant.revenueShareSuspendedPeriodStart === payment.periodStart && tenant.revenueShareSuspendedPeriodEnd === payment.periodEnd) {
    await mirrorTenantAccess(tenantRef, tenant, { active: true, revenueShareSuspended: false, revenueShareSuspendedAt: FieldValue.delete(), revenueShareSuspendedPeriodType: FieldValue.delete(), revenueShareSuspendedPeriodStart: FieldValue.delete(), revenueShareSuspendedPeriodEnd: FieldValue.delete(), revenueShareSuspensionReason: FieldValue.delete() });
  } else if (status === "rejected") {
    await mirrorTenantAccess(tenantRef, tenant, { active: false, revenueShareSuspended: true, revenueShareSuspendedAt: FieldValue.serverTimestamp(), revenueShareSuspendedPeriodType: payment.periodType, revenueShareSuspendedPeriodStart: payment.periodStart, revenueShareSuspendedPeriodEnd: payment.periodEnd, revenueShareSuspensionReason: "rejected_payment" });
  }
  return { ok: true, status };
});

exports.updateTenantRevenueShare = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  const tenantId = String(request.data?.tenantId || "").trim();
  const enabled = request.data?.enabled === true;
  const rate = Number(request.data?.rate || 0);
  const billingCycle = request.data?.billingCycle === "daily" ? "daily" : request.data?.billingCycle === "monthly" ? "monthly" : "";
  if (!tenantId || !Number.isFinite(rate) || rate < 0 || rate > 100 || !billingCycle) throw new HttpsError("invalid-argument", "Invalid revenue-share settings");
  const db = getFirestore(), tenantRef = db.collection("tenants").doc(tenantId), snapshot = await tenantRef.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Tenant not found");
  const tenant = { id: snapshot.id, ...snapshot.data() };
  const active = enabled ? tenant.revenueShareSuspended !== true : subscriptionActive(tenant);
  await mirrorTenantAccess(tenantRef, tenant, { revenueShareEnabled: enabled, revenueShareRate: Math.round(rate * 10000) / 10000, revenueShareBillingCycle: billingCycle, billingMode: enabled ? "revenue_share" : "subscription", active });
  if (!enabled && tenant.revenueShareSuspended) await reconcileTenant(tenantId);
  return { ok: true, tenantId, enabled, rate, billingCycle, active };
});

exports.unlockTenantRevenueShare = onCall({ region: REGION }, async request => {
  const actor = await assertSuperAdmin(request.auth);
  const tenantId = String(request.data?.tenantId || "").trim();
  const db = getFirestore(), tenantRef = db.collection("tenants").doc(tenantId), snapshot = await tenantRef.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Tenant not found");
  const tenant = { id: snapshot.id, ...snapshot.data() }, setting = revenueSetting(tenant);
  if (!setting.enabled || !tenant.revenueShareSuspended) throw new HttpsError("failed-precondition", "Tenant is not revenue-share suspended");
  const overrides = Array.isArray(tenant.revenueShareUnlockOverrides) ? [...tenant.revenueShareUnlockOverrides] : [];
  overrides.push({ periodType: tenant.revenueShareSuspendedPeriodType || setting.billingCycle, periodStart: tenant.revenueShareSuspendedPeriodStart || "", periodEnd: tenant.revenueShareSuspendedPeriodEnd || "", suspensionReason: tenant.revenueShareSuspensionReason || "manual_unlock", unlockedAt: new Date().toISOString(), unlockedBy: actor.uid });
  await mirrorTenantAccess(tenantRef, tenant, { active: true, revenueShareSuspended: false, revenueShareUnlockOverrides: overrides.slice(-50), revenueShareSuspendedAt: FieldValue.delete(), revenueShareSuspendedPeriodType: FieldValue.delete(), revenueShareSuspendedPeriodStart: FieldValue.delete(), revenueShareSuspendedPeriodEnd: FieldValue.delete(), revenueShareSuspensionReason: FieldValue.delete() });
  return { ok: true, tenantId, active: true };
});

exports.reconcileRevenueShare = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  const db = getFirestore(), tenantId = String(request.data?.tenantId || "").trim();
  if (tenantId) return { ok: true, tenantId, result: await reconcileTenant(tenantId) };
  const snapshot = await db.collection("tenants").get();
  let checked = 0, suspended = 0, released = 0;
  for (const doc of snapshot.docs) {
    if (!revenueSetting(doc.data()).enabled) continue;
    const result = await reconcileTenant(doc.id); checked += 1;
    if (result.action === "suspended") suspended += 1;
    if (result.action === "released") released += 1;
  }
  return { ok: true, checked, suspended, released };
});

exports.syncRevenueShareTenants = onSchedule({ schedule: "every day 00:20", timeZone: "Asia/Bangkok", region: REGION }, async () => {
  const snapshot = await getFirestore().collection("tenants").get();
  let checked = 0;
  for (const doc of snapshot.docs) {
    if (!revenueSetting(doc.data()).enabled) continue;
    await reconcileTenant(doc.id); checked += 1;
  }
  console.log("Revenue-share reconciliation completed", { checked });
});
