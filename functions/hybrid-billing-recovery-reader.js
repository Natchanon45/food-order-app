"use strict";

// PRIVATE read-only full-history collector. No release/suspend writer here.
// Never trust a client-provided coverageVerified flag for recovery decisions.
const { tenantAnchorDate, bangkokDateKey, cycleForDate,
  cycleFromMonth, offsetMonth } = require("./billing-anniversary");
const { LEDGER_VERSION } = require("./hybrid-billing-ledger");
const { planHybridAccessRecovery } = require("./hybrid-billing-finance-policy");

const MAX_CYCLES = 120;
const MAX_INVOICES = 4000;
async function prepareTrustedHybridRecoveryReview({
  tenantRef, tenant, now = new Date(),
} = {}) {
  if (!tenantRef?.id || !tenantRef?.collection || !tenant
    || tenant.billingPolicyVersion !== "hybrid_v1") {
    throw new Error("HYBRID_RECOVERY_TRUSTED_TENANT_REQUIRED");
  }
  const anchor = tenantAnchorDate(tenant);
  if (!anchor) throw new Error("HYBRID_RECOVERY_ACTIVATION_ANCHOR_REQUIRED");
  const today = bangkokDateKey(now);
  const current = cycleForDate(anchor, today);
  if (!current) throw new Error("HYBRID_RECOVERY_BEFORE_ACTIVATION");
  const periods = tenantRef.collection("hybridBillingPeriods");
  const invoicesCollection = tenantRef.collection("hybridBillingInvoices");
  const indexed = new Set();
  let month = anchor.slice(0, 7), periodCount = 0;
  while (month <= current.month) {
    if (++periodCount > MAX_CYCLES) {
      throw new Error("HYBRID_RECOVERY_PERIOD_LIMIT_MANUAL_REVIEW");
    }
    const expected = cycleFromMonth(anchor, month);
    const snapshot = await periods.doc(expected.startDate).get();
    if (!snapshot.exists) {
      // Never infer zero outstanding from an absent period (including trial).
      throw new Error("HYBRID_RECOVERY_INCOMPLETE_PERIOD_HISTORY");
    }
    const record = snapshot.data() || {};
    if (record.version !== LEDGER_VERSION
      || record.cycleStartDate !== expected.startDate
      || record.cycleEndExclusiveDate !== expected.endExclusiveDate
      || !Array.isArray(record.invoiceIds) || record.invoiceIds.length > 40
      || new Set(record.invoiceIds).size !== record.invoiceIds.length) {
      throw new Error("HYBRID_RECOVERY_PERIOD_INDEX_INVALID");
    }
    for (const id of record.invoiceIds) {
      if (typeof id !== "string" || !id.startsWith(expected.startDate + ":")
        || indexed.has(id)) throw new Error("HYBRID_RECOVERY_INVOICE_INDEX_CONFLICT");
      indexed.add(id);
      if (indexed.size > MAX_INVOICES) {
        throw new Error("HYBRID_RECOVERY_INVOICE_LIMIT_MANUAL_REVIEW");
      }
    }
    month = offsetMonth(month, 1);
  }

  // Also query ALL invoice documents, not only the period index: an extra
  // unindexed financial document could otherwise be silently ignored.
  const all = await invoicesCollection.get();
  if (!all || !Array.isArray(all.docs) || all.docs.length > MAX_INVOICES
    || all.docs.length !== indexed.size) {
    throw new Error("HYBRID_RECOVERY_INVOICE_COVERAGE_INCOMPLETE");
  }
  const invoices = [], readIds = new Set();
  for (const document of all.docs) {
    if (!indexed.has(document.id) || readIds.has(document.id)) {
      throw new Error("HYBRID_RECOVERY_UNINDEXED_OR_DUPLICATE_INVOICE");
    }
    readIds.add(document.id);
    const data = document.data() || {};
    if (data.id !== document.id) throw new Error("HYBRID_RECOVERY_INVOICE_ID_MISMATCH");
    invoices.push(data);
  }
  const plan = planHybridAccessRecovery({
    tenantId: tenantRef.id, tenant, invoices, onDate: today,
    coverageVerified: true,
  });
  return Object.freeze({
    ...plan, periodCount, invoiceCount: invoices.length,
    source: "trusted_admin_full_anniversary_period_and_invoice_index",
    writesPerformed: false,
  });
}
module.exports = { prepareTrustedHybridRecoveryReview };
