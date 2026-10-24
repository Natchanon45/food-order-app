import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { planHybridAccessRecovery, prepareHybridAdjustmentProposal } =
  require("../../functions/hybrid-billing-finance-policy.js");

const tenantId = "demo-shop";
const tenant = { id: tenantId, billingPolicyVersion: "hybrid_v1",
  active: false, hybridBillingSuspended: true,
  suspensionReason: "manual_review", subscriptionStatus: "suspended",
  revenueShareSuspended: true };
const invoice = {
  id: "2026-10-20:monthly:fixed", version: "hybrid-invoice-v1",
  signature: "f".repeat(64), tenantId, amount: 590,
  status: "issued", dueDate: "2026-10-21", suspendFrom: "2026-10-22",
};
const adjustment = () => ({
  tenantId, tenant, invoice,
  request: { id: "adjustment_12345678901234", kind: "credit_note", amount: 100,
    reason: "Finance approved merchandise refund request" },
});

test("only tomorrow's unpaid invoices propose a Hybrid hold", () => {
  for (const status of ["issued", "rejected", "pending_review"]) {
    const result = planHybridAccessRecovery({
      tenantId, tenant: { ...tenant, hybridBillingSuspended: false },
      invoices: [{ ...invoice, status }], onDate: "2026-10-22",
    });
    assert.equal(result.action, "place_hybrid_hold");
    assert.deepEqual(result.patch, { hybridBillingSuspended: true });
    assert.deepEqual(result.overdueInvoiceIds, [invoice.id]);
    assert.equal(result.writesPerformed, false);
  }
  const onDue = planHybridAccessRecovery({
    tenantId, tenant: { ...tenant, hybridBillingSuspended: false },
    invoices: [invoice], onDate: "2026-10-21", coverageVerified: true,
  });
  assert.equal(onDue.action, "unchanged");
  assert.equal(onDue.overdueInvoiceIds.length, 0);
});

test("incomplete ledger cannot release suspension, even when rows are empty", () => {
  for (const invoices of [[], [{ ...invoice, status: "paid" }]]) {
    const result = planHybridAccessRecovery({
      tenantId, tenant, invoices, onDate: "2026-10-24",
    });
    assert.equal(result.action, "incomplete_history_manual_review");
    assert.equal(result.patch, null);
  }
});

test("complete history releases only Hybrid hold and retains manual/legacy restrictions", () => {
  const result = planHybridAccessRecovery({
    tenantId, tenant, invoices: [{ ...invoice, status: "paid" }],
    onDate: "2026-10-24", coverageVerified: true,
  });
  assert.equal(result.action, "release_hybrid_hold_only");
  assert.deepEqual(result.patch, { hybridBillingSuspended: false });
  assert.equal(result.separateHoldExists, true);
  for (const forbidden of ["active", "subscriptionStatus", "suspensionReason",
    "revenueShareSuspended", "walletBalance"]) {
    assert.equal(Object.hasOwn(result.patch, forbidden), false);
  }
});

test("unpaid past anniversary debt prevents recovery despite paid newer bill", () => {
  const result = planHybridAccessRecovery({
    tenantId, tenant, onDate: "2026-10-25", coverageVerified: true,
    invoices: [invoice, { ...invoice, id: "2026-10-21:delivery:trigger",
      dueDate: "2026-10-22", suspendFrom: "2026-10-23", status: "paid" }],
  });
  assert.equal(result.action, "unchanged");
  assert.deepEqual(result.overdueInvoiceIds, [invoice.id]);
});

test("missing, duplicate, tampered, stale or cross-tenant ledger fails closed", () => {
  for (const list of [
    [{ ...invoice, signature: "BAD" }], [{ ...invoice, version: "other" }],
    [{ ...invoice, amount: -590 }], [{ ...invoice, tenantId: "wrong" }],
    [{ ...invoice, dueDate: "2026-02-30" }],
    [{ ...invoice, suspendFrom: "2026-10-21" }], [invoice, invoice],
  ]) assert.throws(() => planHybridAccessRecovery({
    tenantId, tenant, onDate: "2026-10-24",
    invoices: list, coverageVerified: true,
  }));
  assert.throws(() => planHybridAccessRecovery({
    tenantId, tenant: { ...tenant, billingPolicyVersion: "legacy" },
    invoices: [], onDate: "2026-10-24",
  }));
  assert.throws(() => planHybridAccessRecovery({
    tenantId, tenant, invoices: [], coverageVerified: "yes", onDate: "2026-10-24",
  }));
});

test("credit note remains proposed and never changes an issued invoice", () => {
  const original = structuredClone(invoice);
  const proposed = prepareHybridAdjustmentProposal(adjustment());
  assert.equal(proposed.status, "proposed");
  assert.equal(proposed.requiresFinanceApproval, true);
  assert.equal(proposed.requiresExternalSettlement, false);
  assert.equal(proposed.invoiceUnchanged, true);
  assert.equal(proposed.walletUnchanged, true);
  assert.equal(proposed.accessUnchanged, true);
  assert.equal(proposed.writesPerformed, false);
  assert.deepEqual(invoice, original);
});

test("refund/chargeback requires paid invoice; both require external settlement", () => {
  for (const kind of ["refund_request", "chargeback_review"]) {
    const proposed = prepareHybridAdjustmentProposal({
      ...adjustment(), invoice: { ...invoice, status: "paid" },
      request: { ...adjustment().request, kind },
    });
    assert.equal(proposed.kind, kind);
    assert.equal(proposed.requiresExternalSettlement, true);
  }
  assert.throws(() => prepareHybridAdjustmentProposal({
    ...adjustment(), request: { ...adjustment().request, kind: "refund_request" },
  }), /INVOICE_STATE_MISMATCH/);
  assert.throws(() => prepareHybridAdjustmentProposal({
    ...adjustment(), invoice: { ...invoice, status: "paid" },
  }), /INVOICE_STATE_MISMATCH/);
});

test("over-credit, duplicate adjustment IDs, cross-tenant history and bank fields fail", () => {
  const prior = { id: "adjustment_prior_1234567", tenantId,
    invoiceId: invoice.id, invoiceSignature: invoice.signature,
    kind: "credit_note", status: "approved", amount: 500 };
  assert.throws(() => prepareHybridAdjustmentProposal({
    ...adjustment(), priorAdjustments: [prior],
  }), /EXCEEDS_INVOICE/);
  assert.throws(() => prepareHybridAdjustmentProposal({
    ...adjustment(), priorAdjustments: [prior, prior],
  }), /DUPLICATE_ID/);
  assert.throws(() => prepareHybridAdjustmentProposal({
    ...adjustment(), priorAdjustments: [{ ...prior, tenantId: "other-shop" }],
  }), /HISTORY_CONFLICT/);
  assert.throws(() => prepareHybridAdjustmentProposal({
    ...adjustment(), request: { ...adjustment().request, accountNumber: "123456789" },
  }), /UNTRUSTED_FIELDS/);
  assert.throws(() => prepareHybridAdjustmentProposal({
    ...adjustment(), request: { ...adjustment().request, amount: 0 },
  }));
});

test("rejected candidate is not counted; note redacts account-like numbers", () => {
  const result = prepareHybridAdjustmentProposal({
    ...adjustment(),
    request: { ...adjustment().request, amount: 590,
      reason: "Bank confirmed account 123-456-7890 requires adjustment" },
    priorAdjustments: [{ id: "adjustment_rejected_1234567", tenantId,
      invoiceId: invoice.id, invoiceSignature: invoice.signature,
      kind: "credit_note", status: "rejected", amount: 500 }],
  });
  assert.equal(result.amount, 590);
  assert.match(result.reasonSummary, /\[redacted\]/);
  assert.doesNotMatch(result.reasonSummary, /123-456/);
});

test("finance policy is private pure code, never a production writer", () => {
  const src = fs.readFileSync("functions/hybrid-billing-finance-policy.js", "utf8");
  const prod = fs.readFileSync("functions/bootstrap.js", "utf8") +
    fs.readFileSync("functions/index.js", "utf8");
  assert.doesNotMatch(src, /require\("firebase-admin|onCall\(|onSchedule\(|\.runTransaction\(|tx\.update\(|tx\.create\(/);
  assert.doesNotMatch(prod, /hybrid-billing-finance-policy/);
  assert.match(src, /dryRun: true/);
  assert.match(src, /writesPerformed: false/);
});
