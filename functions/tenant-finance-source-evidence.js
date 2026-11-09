"use strict";

// Source-backed, read-only single-cycle evidence for Super Admin.
// A Firestore document is NOT independently bank-certified M7 money evidence.
// Never use this module to bill, suspend, settle, claim credit or release access.
const { LEDGER_VERSION, STATES, invoiceSignature } = require("./hybrid-billing-ledger");
const PERIOD = /^\d{4}-\d{2}-\d{2}$/;
const MAX_INVOICES = 40;
const KINDS = new Set(["monthly", "yearly", "fixed_monthly", "delivery_threshold", "delivery_daily"]);
const moneyCents = amount => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0 || value > 100000000
    || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6)
    throw new Error("TENANT_FINANCE_EVIDENCE_AMOUNT_INVALID");
  return Math.round(value * 100);
};
function verifyOnePeriod(period, indexedRows, listedRows) {
  if (!period || period.version !== LEDGER_VERSION
    || !PERIOD.test(String(period.cycleStartDate || ""))
    || !PERIOD.test(String(period.cycleEndExclusiveDate || ""))
    || period.cycleEndExclusiveDate <= period.cycleStartDate
    || !Array.isArray(period.invoiceIds)
    || period.invoiceIds.length > MAX_INVOICES
    || new Set(period.invoiceIds).size !== period.invoiceIds.length
    || !/^[a-f0-9]{64}$/.test(String(period.sealedSalesDigest || ""))) {
    throw new Error("TENANT_FINANCE_EVIDENCE_PERIOD_UNVERIFIED");
  }
  const ids = new Set(period.invoiceIds);
  const rows = indexedRows || [];
  const listed = listedRows || [];
  if (rows.length !== ids.size || listed.length !== ids.size
    || rows.some(row => !ids.has(row.id))
    || listed.some(row => !ids.has(row.id))
    || new Set(rows.map(row => row.id)).size !== rows.length
    || new Set(listed.map(row => row.id)).size !== listed.length)
    throw new Error("TENANT_FINANCE_EVIDENCE_INDEX_MISMATCH");

  const normalized = rows.map(row => {
    const value = row.data || {};
    const id = String(row.id || "");
    if (!id.startsWith(period.cycleStartDate + ":")
      || id.length > 128 || String(value.id || "") !== id
      || value.version !== LEDGER_VERSION
      || value.cycleStartDate !== period.cycleStartDate
      || value.cycleEndExclusiveDate !== period.cycleEndExclusiveDate
      || !KINDS.has(String(value.kind || ""))
      || !STATES.includes(String(value.status || ""))
      || !PERIOD.test(String(value.date || ""))
      || !PERIOD.test(String(value.dueDate || ""))
      || value.date < period.cycleStartDate
      || value.date >= period.cycleEndExclusiveDate
      || !/^[a-f0-9]{64}$/.test(String(value.signature || ""))
      || value.signature !== invoiceSignature(value, period)) {
      throw new Error("TENANT_FINANCE_EVIDENCE_INVOICE_UNVERIFIED");
    }
    return Object.freeze({
      id, kind: value.kind, date: value.date, dueDate: value.dueDate,
      status: value.status, amountCents: moneyCents(value.amount),
      // Paid is a recorded status, NOT independent bank transfer evidence.
      bankVerified: false, settlementAuthority: false,
    });
  });
  return Object.freeze({
    cycleStartDate: period.cycleStartDate,
    cycleEndExclusiveDate: period.cycleEndExclusiveDate,
    invoiceCount: normalized.length,
    recordedAmountCents: normalized.reduce((sum, x) => sum + x.amountCents, 0),
    recordedOpenAmountCents: normalized.filter(x => x.status !== "paid")
      .reduce((sum, x) => sum + x.amountCents, 0),
    invoices: normalized.sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
  });
}
async function readTenantFinanceEvidence({tenantRef, tenant}) {
  if (!tenantRef?.id || !tenantRef.collection || !tenant) throw Error("FINANCE_TENANT_SCOPE_REQUIRED");
  const empty = {
    ok: true, tenantId: tenantRef.id, available: false,
    source: "hybrid_billing_period_firestore", status: "unverified",
    coverage: "single_cycle_only", bankSourceVerified: false,
    originalSignupVerified: false, canIssueRealInvoice: false,
    canSettleMoney: false, canReleaseTenant: false, invoiceEvidence: null,
  };
  // Never infer a Hybrid invoice from an older subscription/revenue-share record.
  if (tenant.billingPolicyVersion !== "hybrid_v1") {
    return { ...empty, reason: "HYBRID_SOURCE_NOT_ACTIVATED" };
  }
  const periods = tenantRef.collection("hybridBillingPeriods");
  const latest = await periods.orderBy("cycleStartDate", "desc").limit(1).get();
  if (latest.empty) return { ...empty, reason: "NO_INDEXED_PERIOD" };
  const selected = latest.docs[0];
  const period = selected.data() || {};
  if (selected.id !== period.cycleStartDate)
    throw Error("TENANT_FINANCE_EVIDENCE_PERIOD_ID_MISMATCH");
  if (!Array.isArray(period.invoiceIds) || period.invoiceIds.length > MAX_INVOICES)
    throw Error("TENANT_FINANCE_EVIDENCE_PERIOD_UNVERIFIED");
  const invoicesRef = tenantRef.collection("hybridBillingInvoices");
  const [docs, listed] = await Promise.all([
    Promise.all(period.invoiceIds.map(id => invoicesRef.doc(id).get())),
    invoicesRef.where("cycleStartDate", "==", period.cycleStartDate)
      .limit(MAX_INVOICES + 1).get(),
  ]);
  if (docs.some(snap => !snap.exists))
    throw Error("TENANT_FINANCE_EVIDENCE_INDEX_MISSING_INVOICE");
  const evidence = verifyOnePeriod(period,
    docs.map(snap => ({ id: snap.id, data: snap.data() })),
    listed.docs.map(snap => ({ id: snap.id })));
  return { ...empty, available: true, status: "source_records_only",
    reason: "NOT_BANK_OR_M7_CERTIFIED", invoiceEvidence: evidence };
}
module.exports = { verifyOnePeriod, readTenantFinanceEvidence };
