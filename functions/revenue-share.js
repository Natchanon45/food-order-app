const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { inspectSlip } = require("./slip-verification");
const {
  normalizeBusinessType,
  normalizeRestaurantScope,
  revenueShareChannels,
  restaurantOrderEligible,
} = require("./revenue-share-policy");

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
  const channels = revenueShareChannels(tenant);
  return {
    enabled: channels.enabled,
    rate: Math.max(0, Math.min(100, Number(tenant.revenueShareRate || 0))),
    billingCycle: tenant.revenueShareBillingCycle === "daily" ? "daily" : "monthly",
    recipientName: String(tenant.revenueShareRecipientName || "").trim(),
    businessType: normalizeBusinessType(tenant.revenueShareBusinessType || tenant.businessType || "both"),
    restaurantScope: normalizeRestaurantScope(tenant.revenueShareRestaurantScope || "all"),
    channels,
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
  let customerDeliveryFees = 0, lalamoveDeliveryCost = 0, lalamoveWalletCoveredCost = 0, deliverySubsidy = 0;

  ordersSnapshot.docs.forEach(snapshot => {
    const row = snapshot.data();
    const date = orderDate(row);
    if (!date || date < period.start || date >= period.end || !validOrder(row)) return;

    const total = Math.max(0, Number(row.totalAmount ?? row.total ?? 0) || 0);
    const orderType = String(row.orderType || "").toLowerCase();
    const isDelivery = orderType === "delivery";
    const customerFee = isDelivery ? Math.max(0, Number(row.deliveryFee || 0) || 0) : 0;
    const foodSales = isDelivery && Number.isFinite(Number(row.subtotalAmount))
      ? Math.max(0, Number(row.subtotalAmount))
      : (isDelivery ? Math.max(0, total - customerFee) : total);

    const isLalamove = isDelivery && String(row.deliveryProvider || "").toLowerCase() === "lalamove";
    const accountMode = String(row.lalamoveAccountMode || "").trim().toLowerCase();
    const usesFodCentral = isLalamove && (!accountMode || accountMode === "fod_central");
    let lalamoveCost = 0;
    if (usesFodCentral) {
      if (Number.isFinite(Number(row.lalamoveDispatchFee))) lalamoveCost = Math.max(0, Number(row.lalamoveDispatchFee));
      else if (Number.isFinite(Number(row.deliveryBaseFee))) lalamoveCost = Math.max(0, Number(row.deliveryBaseFee));
    }
    const walletCovered = usesFodCentral && Number.isFinite(Number(row.lalamoveWalletDebitedAmount))
      ? Math.min(lalamoveCost, Math.max(0, Number(row.lalamoveWalletDebitedAmount)))
      : 0;

    const shareEligibleOrder = !setting.enabled
      || (setting.channels.includeRestaurant && restaurantOrderEligible(orderType, setting.channels.restaurantScope));
    if (shareEligibleOrder) {
      orderSales += foodSales;
      orderCount += 1;
    }
    customerDeliveryFees += isLalamove ? customerFee : 0;
    lalamoveDeliveryCost += lalamoveCost;
    lalamoveWalletCoveredCost += walletCovered;
    deliverySubsidy += usesFodCentral ? Math.max(0, lalamoveCost - customerFee) : 0;
  });

  salesSnapshot.docs.forEach(snapshot => {
    const row = snapshot.data();
    const date = saleDate(row);
    if (!date || date < period.start || date >= period.end || !validSale(row)) return;
    if (setting.enabled && !setting.channels.includeRetail) return;
    const gross = Number(row.totalAmount ?? row.total ?? 0) || 0;
    const refund = Number(row.refundTotal || 0) || 0;
    posSales += Math.max(0, gross - refund);
    posCount += 1;
  });

  const roundMoney = value => Math.round(Number(value || 0) * 100) / 100;
  orderSales = roundMoney(orderSales);
  posSales = roundMoney(posSales);
  customerDeliveryFees = roundMoney(customerDeliveryFees);
  lalamoveDeliveryCost = roundMoney(lalamoveDeliveryCost);
  lalamoveWalletCoveredCost = roundMoney(lalamoveWalletCoveredCost);
  deliverySubsidy = roundMoney(deliverySubsidy);
  const combinedSales = roundMoney(orderSales + posSales);
  const revenueShare = setting.enabled ? roundMoney(combinedSales * setting.rate / 100) : 0;
  const lalamoveOutstandingCost = roundMoney(Math.max(0, lalamoveDeliveryCost - lalamoveWalletCoveredCost));
  const platformAmountDue = setting.enabled ? roundMoney(revenueShare + lalamoveOutstandingCost) : 0;

  return {
    orderSales, orderCount, posSales, posCount, combinedSales,
    customerDeliveryFees, lalamoveDeliveryCost, lalamoveWalletCoveredCost,
    lalamoveOutstandingCost, deliverySubsidy,
    revenueShareEnabled: setting.enabled,
    revenueShareRate: setting.rate,
    revenueShareBillingCycle: setting.billingCycle,
    revenueShareBusinessType: setting.businessType,
    revenueShareRestaurantScope: setting.restaurantScope,
    revenueShareIncludeRestaurant: setting.channels.includeRestaurant,
    revenueShareIncludeRetail: setting.channels.includeRetail,
    revenueShare,
    platformAmountDue,
  };
}

const MONEY_PATTERN = /(?:฿\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g;
const AMOUNT_HINT = /(?:จำนวน|ยอด(?:เงิน|โอน|ชำระ|สุทธิ)?|amount|transfer(?:red)?\s*amount|total\s*amount)/i;
const FEE_HINT = /(?:ค่าธรรมเนียม|fee|fees|service\s*charge)/i;
const DATE_TIME_HINT = /(?:วันที่|date|เวลา|time|พ\.?ศ\.?|ค\.?ศ\.?|a\.?m\.?|p\.?m\.?|น\.)/i;
const REFERENCE_HINT = /(?:เลขที่รายการ|เลขอ้างอิง|reference|ref\.?|transaction|บัญชี|account)/i;

function normalizeOcrText(value = "") {
  return String(value || "").normalize("NFC").replace(/\u0e4d\u0e32/g, "\u0e33");
}

function normalizeRecipientText(value = "") {
  return normalizeOcrText(value).toLocaleLowerCase("th-TH").replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
}

function recipientCore(value = "") {
  return normalizeRecipientText(value)
    .replace(/^(?:นาย|นางสาว|นาง|คุณ|บริษัท|บจก|หจก)/, "")
    .replace(/(?:จำกัด|มหาชน)$/g, "");
}

function detectSlipRecipient(text = "", expectedRecipientName = "") {
  const expected = String(expectedRecipientName || "").trim();
  if (!expected) return { configured: false, matched: null, evidence: "" };
  const full = normalizeRecipientText(expected);
  const core = recipientCore(expected);
  const normalizedText = normalizeRecipientText(text);
  const variants = [full, core].filter(value => value.length >= 4);
  const matched = variants.some(value => normalizedText.includes(value));
  let evidence = "";
  if (matched) {
    const lines = normalizeOcrText(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    evidence = lines.find(line => {
      const normalizedLine = normalizeRecipientText(line);
      return variants.some(value => normalizedLine.includes(value) || value.includes(normalizedLine) && normalizedLine.length >= 4);
    }) || expected;
  }
  return { configured: true, matched, evidence: String(evidence).slice(0, 250) };
}

function evaluateOcrStatus({ detectedAmount, expectedAmount, recipientCheck }) {
  const amountMatched = detectedAmount !== null && detectedAmount !== undefined && Math.abs(Number(detectedAmount) - Number(expectedAmount || 0)) <= 0.05;
  if (detectedAmount !== null && detectedAmount !== undefined && !amountMatched) return { status: "mismatch", reason: "amount_not_matched", amountMatched };
  if (recipientCheck.configured && recipientCheck.matched === false) return { status: "mismatch", reason: "recipient_not_matched", amountMatched };
  if (detectedAmount === null || detectedAmount === undefined) return { status: "unreadable", reason: "no_amount_detected", amountMatched: false };
  if (!recipientCheck.configured) return { status: "manual_review", reason: "recipient_not_configured", amountMatched };
  return { status: "matched", reason: "amount_and_recipient_matched", amountMatched };
}

function moneyValuesFromLine(line = "") {
  const values = [];
  for (const match of String(line || "").matchAll(MONEY_PATTERN)) {
    const raw = `${match[1] || ""}${match[2] ? `.${match[2]}` : ""}`.replace(/,/g, "");
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0 || value > 10000000) continue;
    values.push(Math.round(value * 100) / 100);
  }
  return values;
}

function extractMoneyCandidates(text = "") {
  const values = [];
  const seen = new Set();
  for (const value of moneyValuesFromLine(String(text || ""))) {
    const key = value.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(value);
  }
  return values.slice(0, 40);
}

function detectSlipAmount(text = "") {
  const lines = normalizeOcrText(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const ranked = [];
  lines.forEach((line, index) => {
    const values = moneyValuesFromLine(line);
    if (!values.length) return;
    let score = 0;
    if (AMOUNT_HINT.test(line)) score += 120;
    if (/บาท|thb|฿/i.test(line)) score += 35;
    // Vision may place the amount far away from its label in bank-slip layouts.
    // A grouped decimal such as 3,000.00 is still strong standalone money evidence.
    if (/\b\d{1,3}(?:,\d{3})+\.\d{2}\b/.test(line)) score += 75;
    else if (/^\s*(?:฿\s*)?\d+\.\d{2}\s*(?:บาท|thb)?\s*$/i.test(line)) score += 45;
    if (FEE_HINT.test(line)) score -= 180;
    if (DATE_TIME_HINT.test(line)) score -= 100;
    if (REFERENCE_HINT.test(line)) score -= 90;
    if (/\d{1,2}[:.]\d{2}/.test(line) && !/,\d{3}\.\d{2}/.test(line)) score -= 60;
    values.forEach(value => ranked.push({ value, score, line, index }));
  });
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!AMOUNT_HINT.test(lines[index]) || FEE_HINT.test(lines[index])) continue;
    for (const value of moneyValuesFromLine(lines[index + 1])) {
      ranked.push({ value, score: 115 + (/บาท|thb|฿/i.test(lines[index + 1]) ? 25 : 0), line: `${lines[index]} ${lines[index + 1]}`, index });
    }
  }
  ranked.sort((a, b) => b.score - a.score || b.value - a.value || a.index - b.index);
  const best = ranked.find(candidate => candidate.score > 0) || null;
  return { amount: best?.value ?? null, ranked: ranked.slice(0, 20) };
}

async function inspectRevenueShareSlip(file, mime, expectedAmount) {
  const [buffer] = await file.download();
  return inspectSlip(buffer, mime, String(file.name || "slip"), expectedAmount);
}

function normalizedOcr(row = {}) {
  return row.ocr && typeof row.ocr === "object" ? { ...row.ocr } : null;
}

function paymentPayload(snapshot, tenant = null) {
  const row = snapshot.data();
  return {
    id: snapshot.id,
    tenant: tenant ? { id: tenant.id, name: tenant.name || "", slug: tenant.slug || "" } : undefined,
    period: { type: row.periodType, label: row.periodLabel, startDate: row.periodStart, endDate: row.periodEnd },
    orderSales: Number(row.orderSales || 0), posSales: Number(row.posSales || 0), combinedSales: Number(row.combinedSales || 0),
    customerDeliveryFees: Number(row.customerDeliveryFees || 0),
    lalamoveDeliveryCost: Number(row.lalamoveDeliveryCost || 0),
    lalamoveWalletCoveredCost: Number(row.lalamoveWalletCoveredCost || 0),
    lalamoveOutstandingCost: Number(row.lalamoveOutstandingCost || 0),
    deliverySubsidy: Number(row.deliverySubsidy || 0),
    revenueShareRate: Number(row.revenueShareRate || 0), revenueShareAmount: Number(row.revenueShareAmount || 0),
    platformAmountDue: Number(row.platformAmountDue ?? row.revenueShareAmount ?? 0),
    status: row.status || "pending",
    verificationProvider: String(row.slipVerificationProvider || ""),
    verificationStatus: String(row.slipVerificationStatus || ""),
    slip2GoReferenceId: String(row.slip2GoReferenceId || ""),
    slip2GoTransRef: String(row.slip2GoTransRef || ""),
    slip2GoCheckedAt: asDate(row.slip2GoCheckedAt)?.toISOString() || "",
    reviewNote: row.reviewNote || "", submittedAt: asDate(row.createdAt)?.toISOString() || "", reviewedAt: asDate(row.reviewedAt)?.toISOString() || "",
    ocr: normalizedOcr(row),
    slip: { name: row.slipName || "", mime: row.slipMime || "", size: Number(row.slipSize || 0), path: row.slipPath || "" }
  };
}

function subscriptionActive(tenant = {}, now = new Date()) {
  if (tenant.subscriptionStatus === "suspended") return false;
  const expiry = asDate(tenant.subscriptionExpiresAt);
  if (!expiry) return tenant.active !== false;
  return now <= addDays(expiry, Number(tenant.gracePeriodDays ?? 3));
}

async function mirrorTenantAccess(tenantRef, tenant, patch, tenantOnlyPatch = {}) {
  const db = getFirestore();
  const slug = String(tenant.slug || "").trim();
  const batch = db.batch();
  batch.set(tenantRef, { ...patch, ...tenantOnlyPatch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
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

async function duplicateSlipReferenceExists(referenceId = "", transRef = "") {
  const reference = String(referenceId || "").trim();
  const transaction = String(transRef || "").trim();
  if (!reference && !transaction) return false;
  const db = getFirestore();
  for (const collectionName of ["revenueSharePayments", "lalamoveWalletTopups"]) {
    for (const [field, value] of [["slip2GoReferenceId", reference], ["slip2GoTransRef", transaction]]) {
      if (!value) continue;
      const snapshot = await db.collectionGroup(collectionName).where(field, "==", value).limit(1).get();
      if (!snapshot.empty) return true;
    }
  }
  return false;
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

async function tenantWalletReport(tenantId, period) {
  const tenantRef = getFirestore().collection("tenants").doc(tenantId);
  const transactionsRef = tenantRef.collection("lalamoveWalletTransactions");
  const topupsRef = tenantRef.collection("lalamoveWalletTopups");
  const [walletSnapshot, periodSnapshot, topupTransactionsSnapshot, pendingTopupsSnapshot, recentSnapshot] = await Promise.all([
    tenantRef.collection("settings").doc("lalamoveWallet").get(),
    transactionsRef.where("createdAt", ">=", period.start).where("createdAt", "<", period.end).get(),
    transactionsRef.where("type", "==", "topup").get(),
    topupsRef.where("status", "==", "pending").get(),
    transactionsRef.orderBy("createdAt", "desc").limit(12).get(),
  ]);
  let periodTopup = 0, periodDeliveryDebit = 0, periodDeliveryRefund = 0;
  periodSnapshot.docs.forEach(snapshot => {
    const row = snapshot.data() || {};
    const type = String(row.type || "");
    const direction = String(row.direction || "");
    const amount = Math.max(0, Number(row.amount || 0));
    if (type === "topup" && direction === "credit") periodTopup += amount;
    if (type === "delivery_debit" && direction === "debit") periodDeliveryDebit += amount;
    if (type === "delivery_refund" && direction === "credit") periodDeliveryRefund += amount;
  });
  let approvedTopupTotal = 0;
  topupTransactionsSnapshot.docs.forEach(snapshot => {
    const row = snapshot.data() || {};
    if (String(row.direction || "") === "credit") approvedTopupTotal += Math.max(0, Number(row.amount || 0));
  });
  let pendingTopupAmount = 0;
  pendingTopupsSnapshot.docs.forEach(snapshot => {
    pendingTopupAmount += Math.max(0, Number(snapshot.data()?.amount || 0));
  });
  const wallet = walletSnapshot.data() || {};
  const recentTransactions = recentSnapshot.docs.map(snapshot => {
    const row = snapshot.data() || {};
    return {
      id: snapshot.id,
      type: String(row.type || "adjustment"),
      direction: String(row.direction || "credit"),
      amount: Math.round(Number(row.amount || 0) * 100) / 100,
      balanceBefore: Math.round(Number(row.balanceBefore || 0) * 100) / 100,
      balanceAfter: Math.round(Number(row.balanceAfter || 0) * 100) / 100,
      currency: String(row.currency || "THB"),
      orderId: String(row.orderId || ""),
      lalamoveOrderId: String(row.lalamoveOrderId || ""),
      quotationId: String(row.quotationId || ""),
      reference: String(row.reference || ""),
      note: String(row.note || ""),
      createdAt: asDate(row.createdAt)?.toISOString() || "",
    };
  });
  return {
    storageReady: true,
    currency: String(wallet.currency || "THB"),
    balance: Math.round(Number(wallet.balance || 0) * 100) / 100,
    approvedTopupTotal: Math.round(approvedTopupTotal * 100) / 100,
    periodTopup: Math.round(periodTopup * 100) / 100,
    periodDeliveryDebit: Math.round(periodDeliveryDebit * 100) / 100,
    periodDeliveryRefund: Math.round(periodDeliveryRefund * 100) / 100,
    pendingTopupCount: pendingTopupsSnapshot.size,
    pendingTopupAmount: Math.round(pendingTopupAmount * 100) / 100,
    recentTransactions,
  };
}

async function tenantLalamoveFailures(tenantId, period) {
  const ordersSnapshot = await getFirestore().collection("tenants").doc(tenantId)
    .collection("orders").orderBy("updatedAt", "desc").limit(300).get();
  const items = [];
  for (const snapshot of ordersSnapshot.docs) {
    const row = snapshot.data() || {};
    if (String(row.deliveryProvider || "").toLowerCase() !== "lalamove") continue;
    const history = Array.isArray(row.lalamoveDispatchFailureHistory)
      ? [...row.lalamoveDispatchFailureHistory] : [];
    if (!history.length && row.lalamoveLastDispatchFailure && typeof row.lalamoveLastDispatchFailure === "object") {
      history.push(row.lalamoveLastDispatchFailure);
    }
    const hasWalletDebitFailure = history.some(item => item && item.stage === "wallet_debit");
    if (row.lalamoveWalletDebitPending === true && row.lalamoveWalletDebitError && !hasWalletDebitFailure) {
      history.push({
        error: String(row.lalamoveWalletDebitError),
        stage: "wallet_debit",
        requiredAmount: Number.isFinite(Number(row.lalamoveWalletDebitAttemptedAmount)) ? Number(row.lalamoveWalletDebitAttemptedAmount) : null,
        walletBalance: Number.isFinite(Number(row.lalamoveWalletBalanceAfter)) ? Number(row.lalamoveWalletBalanceAfter) : null,
        occurredAt: row.lalamoveWalletDebitAttemptedAt || "",
      });
    }
    history.forEach(failure => {
      if (!failure || typeof failure !== "object") return;
      const occurred = asDate(failure.occurredAt);
      if (!occurred || occurred < period.start || occurred >= period.end) return;
      items.push({
        orderId: snapshot.id,
        lalamoveOrderId: String(row.lalamoveOrderId || ""),
        error: String(failure.error || "LALAMOVE_DISPATCH_FAILED"),
        stage: String(failure.stage || "dispatch"),
        providerError: String(failure.providerError || ""),
        requestId: String(failure.requestId || ""),
        requiredAmount: Number.isFinite(Number(failure.requiredAmount)) ? Math.round(Number(failure.requiredAmount) * 100) / 100 : null,
        walletBalance: Number.isFinite(Number(failure.walletBalance)) ? Math.round(Number(failure.walletBalance) * 100) / 100 : null,
        quoteFee: Number.isFinite(Number(failure.quoteFee)) ? Math.round(Number(failure.quoteFee) * 100) / 100 : null,
        currency: String(failure.currency || "THB"),
        occurredAt: occurred.toISOString(),
      });
    });
  }
  return items.sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt))).slice(0, 20);
}

exports.getTenantRevenueShareAccess = onCall({ region: REGION }, async request => {
  const { tenant } = await assertTenantAdmin(request.auth);
  return {
    ...revenueSetting(tenant),
    suspended: tenant.revenueShareSuspended === true,
    suspensionReason: String(tenant.revenueShareSuspensionReason || ""),
    suspendedAt: asDate(tenant.revenueShareSuspendedAt)?.toISOString() || null,
    suspendedPeriodType: String(tenant.revenueShareSuspendedPeriodType || ""),
    suspendedPeriodStart: String(tenant.revenueShareSuspendedPeriodStart || ""),
    suspendedPeriodEnd: String(tenant.revenueShareSuspendedPeriodEnd || ""),
  };
});

exports.getTenantRevenueShareSummary = onCall({ region: REGION }, async request => {
  const { tenant } = await assertTenantAdmin(request.auth);
  const setting = revenueSetting(tenant);
  if (!setting.enabled) throw new HttpsError("permission-denied", "Revenue share is disabled");
  const period = periodFromData(request.data || {});
  const [summary, wallet, lalamoveFailures] = await Promise.all([
    summaryForTenant(tenant.id, period, setting),
    tenantWalletReport(tenant.id, period),
    tenantLalamoveFailures(tenant.id, period),
  ]);
  return {
    period: { type: period.type, label: period.label, startDate: period.startDate, endDate: period.endDate },
    tenantId: tenant.id,
    summary,
    wallet,
    lalamoveFailures,
  };
});

exports.listTenantRevenueSharePayments = onCall({ region: REGION }, async request => {
  const { tenantRef, tenant } = await assertTenantAdmin(request.auth);
  const snapshot = await tenantRef.collection("revenueSharePayments").orderBy("createdAt", "desc").limit(50).get();
  return { items: snapshot.docs.map(doc => paymentPayload(doc, tenant)) };
});

exports.submitTenantRevenueSharePayment = onCall({ region: REGION, timeoutSeconds: 60, memory: "512MiB" }, async request => {
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
  const verification = await inspectRevenueShareSlip(file, mime, summary.platformAmountDue);
  const verificationStatus = String(verification?.status || "manual_review");
  const verificationReason = String(verification?.reason || "");
  const deleteUploadedSlip = async () => {
    try { await file.delete(); } catch (error) {
      if (Number(error?.code) !== 404) console.warn("REVENUE_SHARE_SLIP_CLEANUP_FAILED", slipPath, error?.message || error);
    }
  };
  if (verificationStatus === "config_required") {
    await deleteUploadedSlip();
    throw new HttpsError(
      "failed-precondition",
      verificationReason.startsWith("google_") ? "GOOGLE_VISION_API_KEY_REQUIRED" : "SLIP2GO_CONFIG_REQUIRED",
    );
  }
  if (verificationStatus === "config_invalid") {
    await deleteUploadedSlip();
    throw new HttpsError(
      "failed-precondition",
      verificationReason.startsWith("google_") ? "GOOGLE_VISION_API_KEY_INVALID" : "SLIP2GO_CONFIG_INVALID",
    );
  }
  if (verificationStatus === "duplicate") {
    await deleteUploadedSlip();
    throw new HttpsError("already-exists", "SLIP2GO_DUPLICATE_SLIP");
  }

  const referenceId = String(verification?.referenceId || "").trim();
  const transRef = String(verification?.transRef || "").trim();
  if (await duplicateSlipReferenceExists(referenceId, transRef)) {
    await deleteUploadedSlip();
    throw new HttpsError("already-exists", "SLIP2GO_DUPLICATE_SLIP");
  }

  const verificationProvider = String(verification?.provider || "google_vision");
  const autoApproved = verificationProvider === "slip2go"
    && verificationStatus === "matched"
    && verification?.amountMatched === true
    && Boolean(referenceId || transRef);

  await ref.set({
    id,
    tenantId: tenant.id,
    periodType: period.type,
    periodLabel: period.label,
    periodStart: period.startDate,
    periodEnd: period.endDate,
    orderSales: summary.orderSales,
    posSales: summary.posSales,
    combinedSales: summary.combinedSales,
    customerDeliveryFees: summary.customerDeliveryFees,
    lalamoveDeliveryCost: summary.lalamoveDeliveryCost,
    lalamoveWalletCoveredCost: summary.lalamoveWalletCoveredCost,
    lalamoveOutstandingCost: summary.lalamoveOutstandingCost,
    deliverySubsidy: summary.deliverySubsidy,
    revenueShareRate: setting.rate,
    revenueShareAmount: summary.revenueShare,
    platformAmountDue: summary.platformAmountDue,
    revenueShareRecipientName: setting.recipientName,
    slipPath,
    slipName: String(request.data?.slipName || metadata.name || "slip").slice(0, 255),
    slipMime: mime,
    slipSize: size,
    slipVerificationProvider: verificationProvider,
    slipVerificationStatus: verificationStatus,
    slip2GoReferenceId: referenceId,
    slip2GoTransRef: transRef,
    slip2GoCheckedAt: verificationProvider.includes("slip2go") ? FieldValue.serverTimestamp() : null,
    ocr: verification,
    status: autoApproved ? "approved" : "pending",
    reviewNote: autoApproved ? "Auto-approved by Slip2Go" : "",
    submittedBy: profile.uid,
    reviewedBy: autoApproved ? "system:slip2go" : "",
    reviewedAt: autoApproved ? FieldValue.serverTimestamp() : null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  let tenantAccess = null;
  if (
    autoApproved
    && tenant.revenueShareSuspended === true
    && tenant.revenueShareSuspendedPeriodStart === period.startDate
    && tenant.revenueShareSuspendedPeriodEnd === period.endDate
  ) {
    await mirrorTenantAccess(tenantRef, tenant, {
      active: true,
      revenueShareSuspended: false,
      revenueShareSuspendedAt: FieldValue.delete(),
      revenueShareSuspendedPeriodType: FieldValue.delete(),
      revenueShareSuspendedPeriodStart: FieldValue.delete(),
      revenueShareSuspendedPeriodEnd: FieldValue.delete(),
      revenueShareSuspensionReason: FieldValue.delete(),
    });
    tenantAccess = { active: true, revenueShareSuspended: false };
  }

  const saved = await ref.get();
  return { item: paymentPayload(saved), autoApproved, tenantAccess };
});

exports.deleteTenantRevenueSharePayment = onCall({ region: REGION }, async request => {
  const { profile, tenantRef, tenant } = await assertTenantAdmin(request.auth);
  const paymentId = String(request.data?.paymentId || "").trim();
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(paymentId)) throw new HttpsError("invalid-argument", "Invalid payment ID");
  const paymentRef = tenantRef.collection("revenueSharePayments").doc(paymentId);
  const db = getFirestore();
  let slipPath = "";
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(paymentRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "Payment not found");
    const row = snapshot.data() || {};
    if (row.status !== "pending") throw new HttpsError("failed-precondition", "Only pending payments can be deleted");
    slipPath = String(row.slipPath || "");
    transaction.delete(paymentRef);
  });
  let storageDeleted = true;
  if (slipPath) {
    try {
      await getStorage().bucket().file(slipPath).delete();
    } catch (error) {
      if (Number(error?.code) !== 404) {
        storageDeleted = false;
        console.error("[revenue-share] pending slip storage cleanup failed", { tenantId: tenant.id, paymentId, slipPath, error: error?.message || error });
      }
    }
  }
  console.log("Revenue-share pending payment deleted", { tenantId: tenant.id, paymentId, deletedBy: profile.uid, storageDeleted });
  return { ok: true, paymentId, storageDeleted };
});

exports.getPlatformRevenueShareSummary = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  const db = getFirestore();
  const period = periodFromData(request.data || {});
  const tenantFilter = String(request.data?.tenantId || "").trim();
  const tenantsSnapshot = await db.collection("tenants").get();
  const tenants = tenantsSnapshot.docs.filter(doc => !tenantFilter || doc.id === tenantFilter);
  const result = {}, totals = {
    orderSales: 0, orderCount: 0, posSales: 0, posCount: 0, combinedSales: 0,
    customerDeliveryFees: 0, lalamoveDeliveryCost: 0, lalamoveWalletCoveredCost: 0,
    lalamoveOutstandingCost: 0, deliverySubsidy: 0, revenueShare: 0, platformAmountDue: 0
  };
  for (const snapshot of tenants) {
    const tenant = { id: snapshot.id, ...snapshot.data() };
    const summary = await summaryForTenant(tenant.id, period, revenueSetting(tenant));
    result[tenant.id] = summary;
    Object.keys(totals).forEach(key => { totals[key] += Number(summary[key] || 0); });
  }
  [
    "orderSales", "posSales", "combinedSales", "customerDeliveryFees",
    "lalamoveDeliveryCost", "lalamoveWalletCoveredCost", "lalamoveOutstandingCost",
    "deliverySubsidy", "revenueShare", "platformAmountDue"
  ].forEach(key => { totals[key] = Math.round(totals[key] * 100) / 100; });
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
  const tenantSnapshot = await tenantRef.get();
  if (!tenantSnapshot.exists) throw new HttpsError("not-found", "Payment not found");
  const status = action === "approve" ? "approved" : "rejected";
  let payment = null;
  await db.runTransaction(async transaction => {
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists) throw new HttpsError("not-found", "Payment not found");
    if (paymentSnapshot.data().status !== "pending") throw new HttpsError("already-exists", "Payment already reviewed or deleted");
    payment = { ...paymentSnapshot.data(), status, reviewNote: note };
    transaction.set(paymentRef, { status, reviewNote: note, reviewedBy: reviewer.uid, reviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
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
  const recipientName = String(request.data?.recipientName || "").trim().slice(0, 160);
  if (!tenantId || !Number.isFinite(rate) || rate < 0 || rate > 100 || !billingCycle) throw new HttpsError("invalid-argument", "Invalid revenue-share settings");
  const db = getFirestore(), tenantRef = db.collection("tenants").doc(tenantId), snapshot = await tenantRef.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Tenant not found");
  const tenant = { id: snapshot.id, ...snapshot.data() };
  const businessType = normalizeBusinessType(request.data?.businessType || tenant.revenueShareBusinessType || tenant.businessType || "both");
  const restaurantScope = businessType === "retail"
    ? "all"
    : normalizeRestaurantScope(request.data?.restaurantScope || tenant.revenueShareRestaurantScope || "all");
  const active = enabled ? tenant.revenueShareSuspended !== true : subscriptionActive(tenant);
  await mirrorTenantAccess(
    tenantRef,
    tenant,
    {
      revenueShareEnabled: enabled,
      revenueShareRate: Math.round(rate * 10000) / 10000,
      revenueShareBillingCycle: billingCycle,
      revenueShareBusinessType: businessType,
      revenueShareRestaurantScope: restaurantScope,
      billingMode: enabled ? "revenue_share" : "subscription",
      active,
    },
    { revenueShareRecipientName: recipientName }
  );
  if (!enabled && tenant.revenueShareSuspended) await reconcileTenant(tenantId);
  return { ok: true, tenantId, enabled, rate, billingCycle, businessType, restaurantScope, recipientName, active };
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
