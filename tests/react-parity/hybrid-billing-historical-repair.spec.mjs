import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { verifyIndependentReceipt, reconcileHybridHistoricalPaidReceipt } =
  require("../../functions/hybrid-billing-historical-repair.js");
const now = new Date("2026-10-20T09:00:00Z");
const valid = () => ({
  verified: true, source: "independent_bank_record", reference: "BANK-TXN-TEST-123456",
  evidenceSha256: "a".repeat(64), grossAmountCents: 1550000,
  paidAt: new Date("2026-10-20T02:00:00Z"),
  checkedAt: new Date("2026-10-20T08:59:00Z"),
});
test("historical receipt correction accepts only fresh independent bank/provider attestations", () => {
  assert.equal(verifyIndependentReceipt(valid(), now).source, "independent_bank_record");
  assert.equal(verifyIndependentReceipt({ ...valid(), source: "lalamove_provider_api" }, now).grossAmountCents, 1550000);
  for (const proof of [
    { ...valid(), verified: false }, { ...valid(), source: "uploaded_slip" },
    { ...valid(), paidAt: "2026-10-20T02:00:00Z" },
    { ...valid(), checkedAt: new Date("2026-10-20T08:40:00Z") },
    { ...valid(), paidAt: new Date("2026-10-21T02:00:00Z") },
    { ...valid(), evidenceSha256: "unverified" }, { ...valid(), grossAmountCents: 1550000.2 },
  ]) assert.throws(() => verifyIndependentReceipt(proof, now), /INDEPENDENT_PROOF_REQUIRED/);
});
test("historical receipt correction refuses to start without a server-owned verifier", async () => {
  await assert.rejects(reconcileHybridHistoricalPaidReceipt({
    db: {}, tenantId: "tenant-hist-001", orderId: "old-order",
    caseId: "hist-case-001", reviewerUid: "super-user-001", now,
  }), /PROVIDER_NOT_CONNECTED/);
});
test("historical receipt correction validates tenant/order/case/actor IDs before contacting Firestore", async () => {
  await assert.rejects(reconcileHybridHistoricalPaidReceipt({
    db: {}, tenantId: "../outside", orderId: "old-order",
    caseId: "hist-case-001", reviewerUid: "super-user-001", now,
    resolveIndependentPayment: () => valid(),
  }), /BAD_REQUEST/);
});
test("historical repair is an unexported source-only candidate; no invoice or settlement mutations", () => {
  const index = readFileSync("functions/index.js", "utf8");
  const src = readFileSync("functions/hybrid-billing-historical-repair.js", "utf8");
  assert.doesNotMatch(index, /hybrid-billing-historical-repair/);
  assert.doesNotMatch(src, /hybridBillingInvoices.*(create|update)|hybridBillingSettlements.*(create|update)/);
  assert.match(src, /HYBRID_HISTORICAL_PROVIDER_NOT_CONNECTED/);
  assert.match(src, /review_sealed_day_before_any_credit_or_debit_no_automatic_settlement/);
});
