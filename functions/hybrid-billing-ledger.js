"use strict";

// Phase 3 server-only invoice candidate. NOT exported, scheduled, or deployed.
// Closed-day source receipts are read via Firestore Transaction.get(query)
// alongside pricing and invoice docs. Real emulator concurrency tests and
// immutable paid-order snapshots still gate a live financial rollout.
const { createHash } = require("node:crypto");
const { FieldValue } = require("firebase-admin/firestore");
const { calculateCycle, dateKey, normalizeSettings, DEFAULT_SETTINGS,
  validDate, nextDate, billingCycleById, cycleWindow } = require("./hybrid-billing-core");
const { paidDeliverySale, paidDeliveryByWindow } = require("./hybrid-billing-orders");
const { paidOrdersInWindow, auditPaidDeliveryReceiptCoverage } = require("./hybrid-billing-preview");

const cents = amount => Math.round(amount * 100);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function dailySeals(orders, cycle, throughDay) {
  const grouped = new Map();
  for (const { id, data } of orders) {
    if (typeof id !== "string" || !id || !data) throw new Error("HYBRID_ORDER_ID_REQUIRED");
    const sale = paidDeliverySale(data);
    if (!sale) continue;
    if (sale.date < cycle.startDate || sale.date > throughDay) {
      throw new Error("HYBRID_PAID_ORDER_OUTSIDE_CLOSED_WINDOW");
    }
    const row = grouped.get(sale.date) || [];
    const paidMillis = data.paidAt?.toMillis?.() ?? data.paidAt?.toDate?.().getTime();
    if (!Number.isFinite(paidMillis)) throw new Error("HYBRID_BAD_PAID_TIMESTAMP");
    row.push([id, paidMillis, cents(sale.amount)]);
    grouped.set(sale.date, row);
  }
  const seals = {};
  for (let day = cycle.startDate; day <= throughDay; day = nextDate(day)) {
    const entries = (grouped.get(day) || []).sort((a, b) => a[0].localeCompare(b[0]));
    const digest = createHash("sha256").update(JSON.stringify(entries)).digest("hex");
    seals[day] = { digest, receiptCount: entries.length,
      salesCents: entries.reduce((sum, row) => sum + row[2], 0) };
  }
  return seals;
}
function invoiceFields(tenantId, row) {
  return {
    tenantId, cycleId: row.id.slice(0, 10), invoiceId: row.id,
    policyVersion: "hybrid_v1", kind: row.kind, serviceDate: row.date,
    dueDate: row.dueDate, suspendFrom: row.suspendFrom,
    baseCents: cents(row.calculationBase), amountCents: cents(row.amount),
    currency: "THB",
  };
}
function planClosedDay({ orders, tenantId, signupDate, cycleId, throughDay, settings }) {
  const cycle = billingCycleById(signupDate, cycleId);
  validDate(throughDay);
  if (throughDay < cycle.startDate || throughDay >= cycle.endDate) {
    throw new Error("HYBRID_DAY_NOT_IN_CYCLE");
  }
  const seals = dailySeals(orders, cycle, throughDay);
  const calc = calculateCycle({
    signupDate, cycleId, settings,
    dailyDeliverySales: paidDeliveryByWindow(orders.map(row => row.data), cycle.startDate, cycle.endDate),
  });
  const ended = throughDay === cycle.lastDate;
  const invoices = calc.invoices
    .filter(row => row.date <= throughDay && (!row.issueAtCycleClose || ended))
    .map(row => invoiceFields(tenantId, row));
  return { seals, invoices, configSnapshot: calc.config,
    firstCycle: cycle.firstCycle, cycleStart: cycle.startDate,
    cycleEnd: cycle.endDate, throughDay };
}
function ensureUnchangedSeals(oldSeals, nextSeals) {
  for (const [day, original] of Object.entries(oldSeals || {})) {
    if (!nextSeals[day] || !same(original, nextSeals[day])) {
      throw new Error("HYBRID_CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT:" + day);
    }
  }
}

/** Trusted internal engine (NOT a client callable or scheduler). */
async function issueHybridInvoicesForClosedDay({ db, tenantId, cycleId, now = new Date(),
  readOrders = paidOrdersInWindow, auditReceipts = auditPaidDeliveryReceiptCoverage,
  serverTimestamp = () => FieldValue.serverTimestamp() }) {
  if (!db || !/^[A-Za-z0-9_-]{8,128}$/.test(String(tenantId || ""))) {
    throw new Error("HYBRID_TRUSTED_TENANT_REQUIRED");
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new RangeError("INVALID_HYBRID_NOW");
  const tenantRef = db.collection("tenants").doc(tenantId);
  const initialTenant = await tenantRef.get();
  const signupDate = initialTenant.data()?.hybridBillingStartDate;
  if (!initialTenant.exists || initialTenant.data()?.billingPolicyVersion !== "hybrid_v1"
    || initialTenant.data()?.hybridBillingEnabled !== true || !signupDate) {
    throw new Error("HYBRID_TENANT_NOT_ACTIVATED");
  }
  const cycle = billingCycleById(signupDate, cycleId);
  const previousDay = dateKey(new Date(now.getTime() - 86400000));
  const throughDay = previousDay < cycle.lastDate ? previousDay : cycle.lastDate;
  if (throughDay < cycle.startDate) {
    return { issued: [], skipped: true, reason: "DAY_NOT_CLOSED" };
  }
  const periodRef = tenantRef.collection("hybridBillingPeriods").doc(cycleId);
  const settingsRef = db.collection("platformSettings").doc("hybridBilling");
  const { start, end } = cycleWindow(cycle);
  const closedEnd = new Date(nextDate(throughDay) + "T00:00:00+07:00");
  return db.runTransaction(async tx => {
    const [tenantSnap, periodSnap, settingsSnap] = await Promise.all([
      tx.get(tenantRef), tx.get(periodRef), tx.get(settingsRef),
    ]);
    const tenant = tenantSnap.data() || {};
    if (!tenantSnap.exists || tenant.billingPolicyVersion !== "hybrid_v1"
      || tenant.hybridBillingEnabled !== true || tenant.hybridBillingStartDate !== signupDate) {
      throw new Error("HYBRID_TENANT_NOT_ACTIVATED");
    }
    const stored = periodSnap.exists ? periodSnap.data() || {} : {};
    if (periodSnap.exists && (stored.policyVersion !== "hybrid_v1"
      || stored.firstCycle !== cycle.firstCycle || !stored.configSnapshot
      || stored.cycleStart !== cycle.startDate || stored.cycleEnd !== cycle.endDate)) {
      throw new Error("HYBRID_PERIOD_INVALID");
    }
    const settings = normalizeSettings(periodSnap.exists ? stored.configSnapshot
      : cycle.firstCycle && tenant.hybridBillingSnapshot ? tenant.hybridBillingSnapshot
        : { ...DEFAULT_SETTINGS, ...(settingsSnap.data() || {}) });
    // A paidAt Timestamp query cannot return legacy paidAt ISO strings.
    // Audit an independent source index (ALL paid Delivery orders) before
    // trusting any closed-day revenue or creating immutable invoice records.
    await auditReceipts(tenantRef, { transaction: tx, maxRecords: 3000 });
    // IMPORTANT: Paid-order pagination happens inside this transaction. Any
    // omitted, stale, or oversize scan aborts before period/invoice writes.
    // Keep this before every tx.create/update; use the same tx on retries.
    const orderRows = await readOrders(tenantRef, start, closedEnd < end ? closedEnd : end, {
      includeIds: true, transaction: tx, maxRecords: 3000,
    });
    if (!Array.isArray(orderRows) || orderRows.some(row =>
      !row || !row.id || !row.data)) {
      throw new Error("HYBRID_PAID_ORDER_SCAN_INCOMPLETE");
    }
    const plan = planClosedDay({ orders: orderRows, tenantId, signupDate, cycleId, throughDay, settings });
    ensureUnchangedSeals(stored.daySeals, plan.seals);
    const known = new Set(stored.issuedInvoiceIds || []);
    const planned = new Set(plan.invoices.map(row => row.invoiceId));
    for (const id of known) {
      if (!planned.has(id)) throw new Error("HYBRID_ISSUED_INVOICE_NO_LONGER_MATCHES:" + id);
    }
    const invoiceRefs = plan.invoices.map(row => tenantRef.collection("hybridBillingInvoices").doc(row.invoiceId));
    const existing = await Promise.all(invoiceRefs.map(ref => tx.get(ref)));
    const newInvoices = [];
    for (let i = 0; i < plan.invoices.length; i++) {
      const record = plan.invoices[i], previous = existing[i];
      if (previous.exists) {
        if (!known.has(record.invoiceId) || !same(
          Object.fromEntries(Object.keys(record).map(key => [key, previous.data()?.[key]])), record,
        )) throw new Error("HYBRID_INVOICE_IMMUTABLE_CONFLICT:" + record.invoiceId);
      } else {
        if (known.has(record.invoiceId)) throw new Error("HYBRID_INVOICE_MISSING:" + record.invoiceId);
        newInvoices.push({ ref: invoiceRefs[i], data: record });
      }
    }
    for (const row of newInvoices) tx.create(row.ref, {
      ...row.data, createdAt: serverTimestamp(), configCycle: cycleId,
    });
    const ids = [...planned].sort(), sealCount = Object.keys(plan.seals).length;
    if (!periodSnap.exists) {
      tx.create(periodRef, {
        tenantId, cycleId, cycleStart: cycle.startDate, cycleEnd: cycle.endDate,
        policyVersion: "hybrid_v1", firstCycle: cycle.firstCycle,
        configSnapshot: plan.configSnapshot,
        daySeals: plan.seals, issuedInvoiceIds: ids,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    } else if (newInvoices.length || sealCount !== Object.keys(stored.daySeals || {}).length) {
      tx.update(periodRef, { daySeals: plan.seals, issuedInvoiceIds: ids, updatedAt: serverTimestamp() });
    }
    return { tenantId, cycleId, throughDay, issued: newInvoices.map(row => row.data.invoiceId),
      existing: plan.invoices.length - newInvoices.length, firstCycle: cycle.firstCycle, daySeals: sealCount };
  });
}
module.exports = { dailySeals, invoiceFields, planClosedDay,
  ensureUnchangedSeals, issueHybridInvoicesForClosedDay };
