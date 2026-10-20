import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  receiptIssue, scanHybridPaidReceiptExceptions,
  inspectHybridClosedDayAdjustments,
} = require("../../functions/hybrid-billing-receipt-audit.js");

const valid = () => ({
  orderType: "delivery", paymentStatus: "paid", status: "delivered",
  paidAt: { toDate: () => new Date("2026-10-20T02:00:00Z") },
  subtotalAmount: 100, deliveryFee: 5, totalAmount: 105,
});
test("read-only receipt auditor detects legacy ISO/missing Timestamp without parsing dates", () => {
  assert.equal(receiptIssue(valid()), null);
  assert.equal(receiptIssue({ ...valid(), paidAt: "2026-10-20T02:00:00Z" }),
    "noncanonical_paid_at");
  assert.equal(receiptIssue({ ...valid(), paidAt: null }),
    "noncanonical_paid_at");
  assert.equal(receiptIssue({ ...valid(), paidAt: { toDate: () => new Date("invalid") } }),
    "noncanonical_paid_at");
});
test("auditor exposes invalid merchandise/refunds without silently recalculating", () => {
  assert.equal(receiptIssue({ ...valid(), subtotalAmount: -12 }),
    "invalid_financial_fields");
  assert.equal(receiptIssue({ ...valid(), refundTotal: -0.01 }),
    "invalid_financial_fields");
  assert.equal(receiptIssue({ ...valid(), totalAmount: 1, deliveryFee: 10 }),
    "invalid_financial_fields");
});
test("receipt auditor rejects unsafe tenant and continuation cursor before Firestore reads", async () => {
  for (const options of [
    { tenantId: "tenant/another", afterId: null },
    { tenantId: "tenant-audit-001", afterId: "../evil" },
    { tenantId: "tenant-audit-001", afterId: null, pageSize: 0 },
    { tenantId: "tenant-audit-001", afterId: null, pageSize: 251 },
  ]) {
    await assert.rejects(scanHybridPaidReceiptExceptions({
      db: {}, ...options,
    }), /HYBRID_RECEIPT_SCAN_INVALID_REQUEST/);
  }
  await assert.rejects(inspectHybridClosedDayAdjustments({
    db: {}, tenantId: "tenant-audit-001", cycleId: "2026-02-31",
    maxRecords: 0,
  }), /HYBRID_ADJUSTMENT_AUDIT_BAD_REQUEST/);
});
test("historical receipt and sealed-day adjustment modules are review-only and unexported", () => {
  const source = readFileSync("functions/hybrid-billing-receipt-audit.js", "utf8");
  const index = readFileSync("functions/index.js", "utf8");
  assert.match(source, /note: "read_only_requires_verified_payment_provenance"/);
  assert.match(source, /manual_credit_or_debit_review_required_no_auto_invoice_mutation/);
  assert.doesNotMatch(source, /tx\.create\(|tx\.update\(|tx\.delete\(|\.set\(/);
  assert.doesNotMatch(index, /hybrid-billing-receipt-audit/);
});
