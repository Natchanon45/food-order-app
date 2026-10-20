import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { verifyAdjustmentAttestation, recordHybridReviewedAdjustment } =
  require("../../functions/hybrid-billing-adjustments.js");
const now = new Date("2026-10-21T03:00:00Z");
const context = { tenantId: "tenant-adjust-test-001", cycleId: "2026-10-16",
  invoiceId: "2026-10-16:delivery:trigger" };
const proof = () => ({ ...context, verified: true, sourceType: "verified_refund",
  evidenceSha256: "a".repeat(64), originalSealDigest: "b".repeat(64),
  currentSealDigest: "c".repeat(64), checkedAt: new Date("2026-10-21T02:59:00Z") });
test("adjustment review requires fresh, exact independent source evidence, not browser money", () => {
  assert.equal(verifyAdjustmentAttestation(proof(), context, now).sourceType, "verified_refund");
  for (const p of [
    { ...proof(), verified: false }, { ...proof(), sourceType: "user_slip" },
    { ...proof(), tenantId: "wrong-tenant" }, { ...proof(), invoiceId: "other-invoice" },
    { ...proof(), evidenceSha256: "bad" }, { ...proof(), currentSealDigest: "bad" },
    { ...proof(), checkedAt: "2026-10-21T02:59:00Z" },
    { ...proof(), checkedAt: new Date("2026-10-21T02:40:00Z") },
  ]) assert.throws(() => verifyAdjustmentAttestation(p, context, now),
    /INDEPENDENT_REVIEW_REQUIRED/);
});
test("adjustment engine remains fail-closed without server-owned verification adapter", async () => {
  await assert.rejects(recordHybridReviewedAdjustment({
    db: {}, ...context, reviewId: "review-adjust-0001", reviewerUid: "super-admin-001", now,
  }), /HYBRID_ADJUSTMENT_REVIEW_ADAPTER_MISSING/);
});
test("adjustment engine rejects path and spoofed invoice selectors before Firestore", async () => {
  await assert.rejects(recordHybridReviewedAdjustment({
    db: {}, ...context, tenantId: "../outside", reviewId: "review-adjust-0001",
    reviewerUid: "super-admin-001", now, resolveIndependentAdjustment: async () => proof(),
  }), /HYBRID_ADJUSTMENT_BAD_REQUEST/);
});
test("approved accounting notes remain unapplied and unexported from production Functions", () => {
  const src = readFileSync("functions/hybrid-billing-adjustments.js", "utf8");
  const index = readFileSync("functions/index.js", "utf8");
  assert.doesNotMatch(index, /hybrid-billing-adjustments/);
  assert.match(src, /status: "approved_unapplied"/);
  assert.match(src, /refundInitiated: false, settlementChanged: false/);
  assert.doesNotMatch(src, /hybridBillingSettlements.*\.update\(|hybridBillingInvoices.*\.update\(/);
});
