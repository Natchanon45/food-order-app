"use strict";

// Phase 10 FINANCE DRY RUN. Never write a Firestore document, call a bank,
// change invoice paid status, credit a wallet or reactivate tenant.active.
const { validDate } = require("./hybrid-billing-core");
const { LEDGER_VERSION, STATES } = require("./hybrid-billing-ledger");
const { validInvoiceId, validId, satang } = require("./hybrid-billing-payment-policy");

const ADJUSTMENT_KINDS = Object.freeze(["credit_note", "refund_request", "chargeback_review"]);
const ADJUSTMENT_STATES = new Set(["proposed", "approved", "settled", "rejected"]);
const HASH = /^[a-f0-9]{64}$/;
function nextDay(date) {
  return new Date(Date.parse(validDate(date) + "T00:00:00Z") + 86400000)
    .toISOString().slice(0, 10);
}
function assertTenant(tenantId, tenant) {
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(tenantId || ""))
    || !tenant || typeof tenant !== "object"
    || (tenant.id != null && tenant.id !== tenantId)
    || (tenant.tenantId != null && tenant.tenantId !== tenantId)
    || tenant.billingPolicyVersion !== "hybrid_v1") {
    throw new Error("HYBRID_FINANCE_TENANT_SCOPE_INVALID");
  }
}
function assertInvoice(invoice, tenantId) {
  if (!invoice || typeof invoice !== "object"
    || (invoice.tenantId != null && invoice.tenantId !== tenantId)) {
    throw new Error("HYBRID_FINANCE_CROSS_TENANT_INVOICE");
  }
  validInvoiceId(invoice.id);
  if (invoice.version !== LEDGER_VERSION
    || !HASH.test(String(invoice.signature || ""))
    || !STATES.includes(invoice.status)) {
    throw new Error("HYBRID_FINANCE_LEDGER_INVALID");
  }
  satang(invoice.amount);
  return invoice;
}
function hasSeparateHold(tenant) {
  const reason = String(tenant.suspensionReason || "").trim().toLowerCase();
  return tenant.revenueShareSuspended === true
    || (tenant.active === false && tenant.hybridBillingSuspended !== true)
    || (reason !== "" && !["hybrid_billing", "hybrid_unpaid"].includes(reason))
    || ["expired", "suspended"].includes(String(tenant.subscriptionStatus || "").toLowerCase());
}

// Server-only, side-effect-free planner. coverageVerified MUST mean every
// historical billing period and invoice index was scanned via trusted Admin SDK.
// Without complete history it cannot propose releasing the Hybrid hold.
function planHybridAccessRecovery({
  tenantId, tenant, invoices, onDate, coverageVerified = false,
} = {}) {
  assertTenant(tenantId, tenant);
  validDate(onDate);
  if (!Array.isArray(invoices) || invoices.length > 4000
    || typeof coverageVerified !== "boolean") {
    throw new Error("HYBRID_ACCESS_INVALID_LEDGER_COVERAGE");
  }
  const seen = new Set(), open = [], overdue = [];
  let outstandingCents = 0;
  for (const raw of invoices) {
    const invoice = assertInvoice(raw, tenantId);
    if (seen.has(invoice.id)) throw new Error("HYBRID_ACCESS_DUPLICATE_INVOICE");
    seen.add(invoice.id);
    if (validDate(invoice.suspendFrom) !== nextDay(invoice.dueDate)) {
      throw new Error("HYBRID_ACCESS_INVALID_DUE_DATE");
    }
    if (invoice.status === "paid") continue;
    open.push(invoice.id);
    outstandingCents += satang(invoice.amount);
    if (!Number.isSafeInteger(outstandingCents)) {
      throw new Error("HYBRID_ACCESS_AMOUNT_OVERFLOW");
    }
    if (onDate >= invoice.suspendFrom) overdue.push(invoice.id);
  }
  const suspended = tenant.hybridBillingSuspended === true;
  let action = "unchanged", patch = null;
  if (overdue.length && !suspended) {
    action = "place_hybrid_hold";
    patch = Object.freeze({ hybridBillingSuspended: true });
  } else if (!overdue.length && suspended) {
    if (!coverageVerified) action = "incomplete_history_manual_review";
    else {
      action = "release_hybrid_hold_only";
      patch = Object.freeze({ hybridBillingSuspended: false });
    }
  }
  return Object.freeze({
    dryRun: true, writesPerformed: false,
    tenantId, onDate, coverageVerified, action, patch,
    separateHoldExists: hasSeparateHold(tenant),
    openAmount: outstandingCents / 100,
    openInvoiceIds: Object.freeze(open),
    overdueInvoiceIds: Object.freeze(overdue),
  });
}

// Candidate compensating record. This is NOT an approved credit, payout,
// refund or settlement. It cannot change any invoice or release a tenant.
function prepareHybridAdjustmentProposal({
  tenantId, tenant, invoice, request, priorAdjustments = [],
} = {}) {
  assertTenant(tenantId, tenant);
  const original = assertInvoice(invoice, tenantId);
  if (!request || typeof request !== "object" || Array.isArray(request)
    || Object.keys(request).some(key => !["id", "kind", "amount", "reason"].includes(key))) {
    throw new Error("HYBRID_ADJUSTMENT_UNTRUSTED_FIELDS");
  }
  validId(request.id, "ADJUSTMENT_ID");
  if (!ADJUSTMENT_KINDS.includes(request.kind)) {
    throw new Error("HYBRID_ADJUSTMENT_INVALID_KIND");
  }
  if (request.kind === "credit_note"
    ? !["issued", "rejected"].includes(original.status)
    : original.status !== "paid") {
    throw new Error("HYBRID_ADJUSTMENT_INVOICE_STATE_MISMATCH");
  }
  const amountCents = satang(request.amount);
  const reason = String(request.reason || "").trim();
  if (reason.length < 20 || reason.length > 500) {
    throw new Error("HYBRID_ADJUSTMENT_REASON_REQUIRED");
  }
  if (!Array.isArray(priorAdjustments) || priorAdjustments.length > 500) {
    throw new Error("HYBRID_ADJUSTMENT_HISTORY_INVALID");
  }
  let priorTotal = 0;
  const ids = new Set();
  for (const previous of priorAdjustments) {
    if (!previous || typeof previous !== "object"
      || previous.tenantId !== tenantId || previous.invoiceId !== original.id
      || previous.invoiceSignature !== original.signature
      || !ADJUSTMENT_KINDS.includes(previous.kind)
      || !ADJUSTMENT_STATES.has(previous.status)) {
      throw new Error("HYBRID_ADJUSTMENT_HISTORY_CONFLICT");
    }
    validId(previous.id, "ADJUSTMENT_ID");
    if (ids.has(previous.id)) throw new Error("HYBRID_ADJUSTMENT_DUPLICATE_ID");
    ids.add(previous.id);
    if (previous.status !== "rejected") priorTotal += satang(previous.amount);
    if (!Number.isSafeInteger(priorTotal)) throw new Error("HYBRID_ADJUSTMENT_AMOUNT_OVERFLOW");
  }
  if (ids.has(request.id)) throw new Error("HYBRID_ADJUSTMENT_DUPLICATE_ID");
  if (amountCents + priorTotal > satang(original.amount)) {
    throw new Error("HYBRID_ADJUSTMENT_EXCEEDS_INVOICE");
  }
  return Object.freeze({
    dryRun: true, writesPerformed: false, id: request.id,
    tenantId, invoiceId: original.id, invoiceSignature: original.signature,
    kind: request.kind, amount: amountCents / 100, status: "proposed",
    reasonSummary: reason.replace(/(?:[0-9๐-๙][\s.-]?){8,20}/g, "[redacted]").slice(0, 240),
    requiresFinanceApproval: true,
    requiresExternalSettlement: request.kind !== "credit_note",
    invoiceUnchanged: true, walletUnchanged: true, accessUnchanged: true,
  });
}

module.exports = { ADJUSTMENT_KINDS, planHybridAccessRecovery, prepareHybridAdjustmentProposal };
