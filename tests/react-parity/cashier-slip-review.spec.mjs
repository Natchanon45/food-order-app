import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cashierSlipReviewSummary } from "../../react-app/src/utils/cashierSlipReview.js";

const t = key => key;
const base = {
  orderType: "delivery",
  paymentMethod: "promptpay",
  paymentStatus: "pending_verification",
  paymentReviewRequired: true,
};

test("old Cashier bill explains unresolved Lalamove quotation without claiming the slip is verified", () => {
  const result = cashierSlipReviewSummary({
    ...base,
    paymentReviewReason: "delivery_fee_requires_cashier_review",
  }, t);
  assert.equal(result.reason, "delivery_fee_requires_cashier_review");
  assert.equal(result.text, "delivery.checkout.payment.slip_manual_fee");
});

test("cashier sees primary Slip2Go failure and safe six digit provider code on fallback", () => {
  const result = cashierSlipReviewSummary({
    ...base,
    paymentReviewReason: "slip2go_fallback_vision",
    paymentReviewPrimaryReason: "slip2go_quota_exhausted",
    paymentReviewProviderCode: "401005",
  }, t);
  assert.equal(result.reason, "slip2go_quota_exhausted");
  assert.equal(result.code, "401005");
  assert.equal(result.text, "delivery.checkout.payment.slip_manual_quota");
});

test("paid and non-manual orders never show an invalid review warning", () => {
  assert.equal(cashierSlipReviewSummary({ ...base, paymentStatus: "paid" }, t), null);
  assert.equal(cashierSlipReviewSummary({ ...base, paymentReviewRequired: false }, t), null);
  assert.equal(cashierSlipReviewSummary({ ...base, orderType: "takeaway" }, t), null);
});

test("backend preserves fallback original error in server proof and Cashier order; UI reads it", () => {
  const server = readFileSync("functions/delivery-slip.js", "utf8");
  const engine = readFileSync("functions/slip-verification.js", "utf8");
  const cashier = readFileSync("react-app/src/pages/CashierPage.jsx", "utf8");
  assert.ok(server.includes('paymentReviewPrimaryReason: clean(proof.primaryReason'));
  assert.ok(server.includes('paymentReviewProviderCode: clean(proof.providerCode'));
  assert.ok(server.includes('slip2go_verified_payload_incomplete'));
  assert.ok(engine.includes('primaryReason: String(primary?.reason'));
  assert.ok(engine.includes('primaryCode: String(primary?.code'));
  assert.ok(cashier.includes('data-cashier-slip-review-reason'));
});

test("Slip2Go 401004 is package expiration, not invalid credentials or empty quota", () => {
  const review = cashierSlipReviewSummary({ ...base,
    paymentReviewReason: "slip2go_fallback_vision",
    paymentReviewPrimaryReason: "slip2go_package_expired",
    paymentReviewProviderCode: "401004",
  }, t);
  assert.equal(review.reason, "slip2go_package_expired");
  assert.equal(review.code, "401004");
  assert.equal(review.text, "delivery.checkout.payment.slip_manual_package_expired");
  const platform = readFileSync("functions/platform-settings.js", "utf8");
  assert.ok(platform.includes('if (normalized === "401004") return "package_expired";'));
  for (const path of ["functions/slip-verification.js", "functions/tenant-lalamove-wallet.js"]) {
    const source = readFileSync(path, "utf8");
    assert.ok(source.includes('"401004": ["manual_review", "slip2go_package_expired", true]'), path);
    assert.ok(!source.includes('"401004": ["config_invalid"'), path);
  }
});
