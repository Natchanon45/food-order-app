"use strict";

// Read-only reconciliation inventory for old paid Delivery receipts. No ISO
// string is converted into a Timestamp and no invoice is rewritten.
// Super Admin caller must independently verify provenance before any migration.
const { paidDeliverySale } = require("./hybrid-billing-orders");
const { billingCycleById, cycleWindow, nextDate } = require("./hybrid-billing-core");
const { paidOrdersInWindow, auditPaidDeliveryReceiptCoverage } = require("./hybrid-billing-preview");
const { dailySeals } = require("./hybrid-billing-ledger");
const SAFE_TENANT_ID = /^[A-Za-z0-9_-]{8,128}$/;
const SAFE_ORDER_ID = /^[A-Za-z0-9_-]{1,256}$/;

function receiptIssue(order) {
  const stamp = order?.paidAt?.toDate?.();
  if (!(stamp instanceof Date) || !Number.isFinite(stamp.getTime())) {
    return "noncanonical_paid_at";
  }
  try {
    paidDeliverySale(order);
  } catch {
    return "invalid_financial_fields";
  }
  return null;
}

/** One stable document-ID page. Caller authorizes Super Admin separately. */
async function scanHybridPaidReceiptExceptions({
  db, tenantId, afterId = null, pageSize = 100,
}) {
  if (!db || typeof tenantId !== "string" || !SAFE_TENANT_ID.test(tenantId)
    || (afterId !== null && (typeof afterId !== "string" || !SAFE_ORDER_ID.test(afterId)))
    || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 250) {
    throw Error("HYBRID_RECEIPT_SCAN_INVALID_REQUEST");
  }
  const ref = db.collection("tenants").doc(tenantId);
  const tenant = await ref.get();
  if (!tenant.exists || tenant.data()?.billingPolicyVersion !== "hybrid_v1"
    || tenant.data()?.hybridBillingEnabled !== true) {
    throw Error("HYBRID_RECEIPT_SCAN_TENANT_NOT_ENABLED");
  }
  let query = ref.collection("orders")
    .where("orderType", "==", "delivery")
    .where("paymentStatus", "==", "paid")
    .orderBy("__name__").limit(pageSize + 1);
  if (afterId) query = query.startAfter(afterId);
  const page = await query.get();
  if (!Array.isArray(page?.docs) || page.size !== page.docs.length
    || page.size > pageSize + 1) {
    throw Error("HYBRID_RECEIPT_SCAN_INCOMPLETE");
  }
  const docs = page.docs.slice(0, pageSize);
  const issues = [];
  for (const doc of docs) {
    const order = doc.data();
    if (!order || order.orderType !== "delivery"
      || order.paymentStatus !== "paid") {
      throw Error("HYBRID_RECEIPT_SCAN_SOURCE_CONFLICT");
    }
    const reason = receiptIssue(order);
    if (reason) issues.push({ orderId: doc.id, reason });
  }
  const hasMore = page.docs.length > pageSize;
  const nextAfterId = hasMore ? docs.at(-1)?.id : null;
  if (hasMore && !nextAfterId) throw Error("HYBRID_RECEIPT_SCAN_CURSOR_MISSING");
  return {
    tenantId, scanned: docs.length, issueCount: issues.length,
    issues, hasMore, nextAfterId,
    note: "read_only_requires_verified_payment_provenance",
  };
}
/**
 * Read-only closed-day adjustment inventory. A refund or late receipt after a
 * sealed day must be reviewed by a human: never silently mutate prior invoices
 * or settle any bank money from this report.
 */
async function inspectHybridClosedDayAdjustments({
  db, tenantId, cycleId, maxRecords = 3000,
}) {
  if (!db || typeof tenantId !== "string" || !SAFE_TENANT_ID.test(tenantId)
    || typeof cycleId !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(cycleId)
    || !Number.isSafeInteger(maxRecords) || maxRecords < 1 || maxRecords > 3000) {
    throw Error("HYBRID_ADJUSTMENT_AUDIT_BAD_REQUEST");
  }
  const tenantRef = db.collection("tenants").doc(tenantId);
  const periodRef = tenantRef.collection("hybridBillingPeriods").doc(cycleId);
  return db.runTransaction(async tx => {
    const [tenantDoc, periodDoc] = await Promise.all([tx.get(tenantRef), tx.get(periodRef)]);
    const tenant = tenantDoc.data() || {}, period = periodDoc.data() || {};
    if (!tenantDoc.exists || tenant.billingPolicyVersion !== "hybrid_v1"
      || tenant.hybridBillingEnabled !== true || !tenant.hybridBillingStartDate) {
      throw Error("HYBRID_ADJUSTMENT_AUDIT_TENANT_NOT_ENABLED");
    }
    const cycle = billingCycleById(tenant.hybridBillingStartDate, cycleId);
    if (!periodDoc.exists) {
      return { tenantId, cycleId, changed: [], sealedDays: 0,
        note: "no_closed_period", requiresReview: false };
    }
    if (period.policyVersion !== "hybrid_v1" || period.cycleId !== cycleId
      || period.tenantId !== tenantId || !period.daySeals
      || typeof period.daySeals !== "object"
      || period.cycleStart !== cycle.startDate || period.cycleEnd !== cycle.endDate) {
      throw Error("HYBRID_ADJUSTMENT_AUDIT_PERIOD_INTEGRITY");
    }
    const days = Object.keys(period.daySeals).sort();
    if (!days.length) throw Error("HYBRID_ADJUSTMENT_AUDIT_MISSING_SEALS");
    const lastDay = days.at(-1);
    if (days[0] !== cycle.startDate || lastDay > cycle.lastDate) {
      throw Error("HYBRID_ADJUSTMENT_AUDIT_SEAL_RANGE");
    }
    // Exactly one day seal for each local date from the anniversary start.
    const expectedDays = [];
    for (let d = cycle.startDate; d <= lastDay; d = nextDate(d)) expectedDays.push(d);
    if (days.length !== expectedDays.length
      || days.some((day, i) => day !== expectedDays[i])) {
      throw Error("HYBRID_ADJUSTMENT_AUDIT_SEAL_GAP");
    }
    // Independent paid-status inventory catches ISO/missing paidAt even when
    // the Timestamp range query would silently omit them.
    await auditPaidDeliveryReceiptCoverage(tenantRef, { transaction: tx, maxRecords });
    const { start, end } = cycleWindow(cycle);
    const closedEnd = new Date(nextDate(lastDay) + "T00:00:00+07:00");
    const read = await paidOrdersInWindow(tenantRef, start,
      closedEnd < end ? closedEnd : end,
      { transaction: tx, includeIds: true, maxRecords });
    const actual = dailySeals(read, cycle, lastDay);
    const changed = days.flatMap(day => {
      const previous = period.daySeals[day], current = actual[day];
      if (!previous || !Number.isSafeInteger(previous.salesCents)
        || !Number.isSafeInteger(previous.receiptCount)
        || typeof previous.digest !== "string"
        || !/^[a-f0-9]{64}$/.test(previous.digest)) {
        throw Error("HYBRID_ADJUSTMENT_AUDIT_INVALID_SEAL");
      }
      return previous.digest === current.digest
        && previous.salesCents === current.salesCents
        && previous.receiptCount === current.receiptCount ? []
        : [{ day, originalBaseCents: previous.salesCents,
          currentBaseCents: current.salesCents,
          deltaCents: current.salesCents - previous.salesCents,
          originalReceiptCount: previous.receiptCount,
          currentReceiptCount: current.receiptCount }];
    });
    return { tenantId, cycleId, changed, sealedDays: days.length,
      requiresReview: changed.length > 0,
      note: "manual_credit_or_debit_review_required_no_auto_invoice_mutation" };
  });
}
module.exports = { receiptIssue, scanHybridPaidReceiptExceptions,
  inspectHybridClosedDayAdjustments };
