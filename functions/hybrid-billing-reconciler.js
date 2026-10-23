"use strict";

// PRIVATE SERVER MODULE. Not imported by Functions bootstrap, no scheduled
// trigger or public callable. The production issuance gate is intentionally
// CLOSED until trusted payment, refund adjustments, audit and access recovery
// are finished and release approval is explicit.
const { FieldValue } = require("firebase-admin/firestore");
const { tenantAnchorDate, cycleFromMonth, bangkokDateKey } = require("./billing-anniversary");
const { loadHybridBillingSettings } = require("./hybrid-billing-settings");
const { paidOrdersInWindow } = require("./hybrid-billing-preview");
const { paidDeliveryByDay } = require("./hybrid-billing-orders");
const { prepareInvoiceLedger } = require("./hybrid-billing-ledger");
const { persistHybridInvoiceLedger } = require("./hybrid-billing-persistence");

const HYBRID_INVOICE_ISSUANCE_READY = false;
const MAX_INVOICES_PER_CYCLE = 40;

/**
 * Read-only orchestration. Every value comes from authenticated server reads:
 * tenant activation timestamp, central admin settings/snapshot, server paidAt
 * and existing immutable invoice documents.
 */
async function prepareTrustedHybridLedger({
  db, tenantRef, tenant, month, now = new Date(),
}) {
  if (!db || !tenantRef?.collection || !tenant || !now) {
    throw new TypeError("Trusted Admin database, tenant and server timestamp required");
  }
  const anchor = tenantAnchorDate(tenant);
  if (!anchor) throw new Error("HYBRID_ACTIVATION_ANCHOR_REQUIRED");
  const cycle = cycleFromMonth(anchor, month);
  const asOfDate = bangkokDateKey(now);
  if (asOfDate < cycle.startDate) throw new Error("HYBRID_CANNOT_ISSUE_FUTURE_CYCLE");
  const periodRef = tenantRef.collection("hybridBillingPeriods").doc(cycle.startDate);
  const snapshot = await periodRef.get();
  const existingPeriod = snapshot.exists ? snapshot.data() : null;
  const config = existingPeriod?.configSnapshot || await loadHybridBillingSettings(db);
  const invoiceIds = existingPeriod?.invoiceIds || [];
  if (!Array.isArray(invoiceIds) || invoiceIds.length > MAX_INVOICES_PER_CYCLE) {
    throw new Error("HYBRID_PERIOD_INVOICE_INDEX_INVALID");
  }
  if (new Set(invoiceIds).size !== invoiceIds.length ||
    invoiceIds.some(id => typeof id !== "string" ||
      !/^20\d{2}-\d{2}-\d{2}:(delivery:(trigger|\d{4}-\d{2}-\d{2})|monthly:fixed)$/.test(id))) {
    throw new Error("HYBRID_PERIOD_INVOICE_REFERENCE_INVALID");
  }
  const existingInvoices = [];
  for (const id of invoiceIds) {
    const doc = await tenantRef.collection("hybridBillingInvoices").doc(id).get();
    if (!doc.exists) throw new Error("HYBRID_LEDGER_MISSING_PREVIOUS_INVOICE");
    existingInvoices.push({ id, ...doc.data() });
  }
  // Paged Admin SDK paidAt scan. Abort if scan exceeds the server-side cap.
  const orders = await paidOrdersInWindow(tenantRef, cycle.start, cycle.end);
  const dailyDeliverySales = paidDeliveryByDay(orders, {
    startDate: cycle.startDate,
    endExclusiveDate: cycle.endExclusiveDate,
  });
  const ledger = prepareInvoiceLedger({
    cycleStartDate: cycle.startDate,
    cycleEndExclusiveDate: cycle.endExclusiveDate,
    asOfDate,
    firstMonth: cycle.startDate === anchor,
    dailyDeliverySales,
    settings: config,
    existingInvoices,
    existingPeriod,
  });
  return {
    tenantId: tenantRef.id,
    invoicePlan: ledger,
    source: "server_paid_delivery_and_locked_period_config",
    readOrderCount: orders.length,
    writesPerformed: false,
  };
}

/**
 * Inert until the explicit production release switch is enabled in reviewed
 * code. This function is not exported by the Functions deployment bootstrap.
 * Never toggle in response to a client-side flag or a Firestore setting.
 */
async function issueTrustedHybridLedger({ db, tenantRef, tenant, month }) {
  if (!HYBRID_INVOICE_ISSUANCE_READY) {
    throw new Error("HYBRID_INVOICE_ISSUANCE_DISABLED");
  }
  const prepared = await prepareTrustedHybridLedger({
    db, tenantRef, tenant, month, now: new Date(),
  });
  return persistHybridInvoiceLedger({
    db, tenantRef, ledger: prepared.invoicePlan,
    serverTimestamp: FieldValue.serverTimestamp(),
  });
}

module.exports = { HYBRID_INVOICE_ISSUANCE_READY, prepareTrustedHybridLedger, issueTrustedHybridLedger };
