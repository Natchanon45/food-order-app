import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { planHybridRefundReconciliation } =
  require("../../functions/hybrid-billing-refund-reconciliation.js");
const tenantId = "demo-shop";
const invoice = {
  id: "2026-10-24:monthly:fixed", tenantId, signature: "f".repeat(64),
  status: "paid", version: "hybrid-invoice-v1", amount: 590,
};
const adjustment = {
  id: "adjustment_12345678901234", invoiceId: invoice.id, tenantId,
  invoiceSignature: invoice.signature, status: "approved", kind: "refund_request",
  amount: 250, amountCents: 25000, proposedBy: "super-one",
  reviewedBy: "super-two", externallySettled: false,
};
const reviewEvent = {
  tenantId, invoiceId: invoice.id, adjustmentId: adjustment.id,
  invoiceSignature: invoice.signature, action: "approve",
  resultStatus: "approved", reviewerId: "super-two", externallySettled: false,
};
const disbursement = {
  tenantId, invoiceId: invoice.id, adjustmentId: adjustment.id,
  source: "trusted_finance_disbursement", state: "submitted",
  amountCents: 25000, currency: "THB",
  instructionId: "outgoing_20261024_123456",
  bankReferenceHash: "a".repeat(64), destinationFingerprint: "b".repeat(64),
  submittedAt: "2026-10-24T09:00:00Z",
};
const bankStatement = {
  tenantId, invoiceId: invoice.id, adjustmentId: adjustment.id,
  source: "trusted_bank_statement", direction: "debit",
  postingStatus: "posted", currency: "THB", amountCents: 25000,
  bankReferenceHash: disbursement.bankReferenceHash,
  destinationFingerprint: disbursement.destinationFingerprint,
  postedAt: "2026-10-24T09:30:00Z",
};
const caseData = () => ({
  tenantId, invoice, adjustment, reviewEvent, disbursement, bankStatement,
  existingBankReferenceHashes: [],
  at: "2026-10-24T10:00:00Z",
});

test("matched evidence is ONLY a finance candidate, never settled or refunded", () => {
  const before = structuredClone(caseData());
  const result = planHybridRefundReconciliation(caseData());
  assert.equal(result.status, "candidate_for_independent_finance_attestation");
  assert.equal(result.settlementConfirmed, false);
  assert.equal(result.bankSourceIntegrationReady, false);
  assert.equal(result.writesPerformed, false);
  assert.equal(result.currency, "THB");
  assert.equal(result.amount, 250);
  assert.equal(result.destinationMatched, true);
  assert.deepEqual(caseData(), before);
});

test("only previously paid, approved and independently reviewed refunds qualify", () => {
  for (const change of [
    { invoice: { ...invoice, status: "issued" } },
    { adjustment: { ...adjustment, kind: "credit_note" } },
    { adjustment: { ...adjustment, status: "proposed" } },
    { adjustment: { ...adjustment, externallySettled: true } },
    { adjustment: { ...adjustment, reviewedBy: "super-one" } },
    { reviewEvent: { ...reviewEvent, action: "reject" } },
    { reviewEvent: { ...reviewEvent, reviewerId: "super-three" } },
  ]) {
    assert.throws(() => planHybridRefundReconciliation({ ...caseData(), ...change }));
  }
});

test("untrusted disbursement, bank direction, pending posting or currency fail closed", () => {
  for (const change of [
    { disbursement: { ...disbursement, state: "draft" } },
    { disbursement: { ...disbursement, source: "browser" } },
    { disbursement: { ...disbursement, currency: "USD" } },
    { disbursement: { ...disbursement, amountCents: 25001 } },
    { bankStatement: { ...bankStatement, source: "fake-slip" } },
    { bankStatement: { ...bankStatement, direction: "credit" } },
    { bankStatement: { ...bankStatement, postingStatus: "pending" } },
    { bankStatement: { ...bankStatement, amountCents: 24999 } },
  ]) assert.throws(() => planHybridRefundReconciliation({ ...caseData(), ...change }));
});

test("original disbursement and posted bank hashes must match, never raw account", () => {
  for (const change of [
    { bankStatement: { ...bankStatement, bankReferenceHash: "c".repeat(64) } },
    { bankStatement: { ...bankStatement, destinationFingerprint: "d".repeat(64) } },
    { disbursement: { ...disbursement, bankReferenceHash: "raw-bank-transfer-ref" } },
    { bankStatement: { ...bankStatement, destinationFingerprint: "" } },
  ]) assert.throws(() => planHybridRefundReconciliation({ ...caseData(), ...change }));
});

test("duplicate global bank reference cannot be considered for payout twice", () => {
  assert.throws(() => planHybridRefundReconciliation({
    ...caseData(), existingBankReferenceHashes: ["a".repeat(64)],
  }), /DUPLICATE_BANK_REFERENCE/);
});

test("bank post time must follow instruction and cannot be in the future", () => {
  for (const change of [
    { bankStatement: { ...bankStatement, postedAt: "2026-10-24T08:30:00Z" } },
    { bankStatement: { ...bankStatement, postedAt: "2026-10-24T11:00:00Z" } },
    { disbursement: { ...disbursement, submittedAt: "not-a-timestamp" } },
  ]) assert.throws(() => planHybridRefundReconciliation({ ...caseData(), ...change }));
});

test("cross-tenant invoice, adjustment, review or bank record fails", () => {
  for (const field of ["invoice", "adjustment", "reviewEvent",
    "disbursement", "bankStatement"]) {
    assert.throws(() => planHybridRefundReconciliation({
      ...caseData(), [field]: { ...caseData()[field], tenantId: "other-shop" },
    }));
  }
});

test("refund reconciliation is private read-only and never exposes payout Callable", () => {
  const source = fs.readFileSync("functions/hybrid-billing-refund-reconciliation.js", "utf8");
  const prod = fs.readFileSync("functions/index.js", "utf8")
    + fs.readFileSync("functions/bootstrap.js", "utf8");
  assert.doesNotMatch(source, /require\("firebase-admin|fetch\(|runTransaction\(|tx\.create\(|tx\.update\(|onCall\(/);
  assert.doesNotMatch(prod, /hybrid-billing-refund-reconciliation/);
  assert.match(source, /settlementConfirmed: false/);
  assert.match(source, /bankSourceIntegrationReady: false/);
});
