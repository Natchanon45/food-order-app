import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const policy = require("../../functions/delivery-slip-policy.js");

test("Slip2Go auto-match requires trusted amount + transaction reference", () => {
  assert.equal(policy.slipDecision({
    provider: "slip2go",
    status: "matched",
    reason: "slip2go_verified",
    amountMatched: true,
    transRef: "TX-001",
  }), "matched");
  assert.equal(policy.slipDecision({
    provider: "slip2go",
    status: "matched",
    reason: "slip2go_verified",
    amountMatched: false,
    transRef: "TX-001",
  }), "mismatch");
  assert.equal(policy.slipDecision({
    provider: "slip2go",
    status: "matched",
    reason: "slip2go_verified",
    amountMatched: true,
    transRef: "",
    referenceId: "",
  }), "manual_review");
});

test("Slip2Go unavailable/config problems fall back to cashier manual review", () => {
  for (const row of [
    { status: "manual_review", reason: "slip2go_unavailable", fallbackAllowed: true },
    { status: "config_required", reason: "slip2go_config_required", fallbackAllowed: true },
    { status: "config_invalid", reason: "slip2go_config_invalid", fallbackAllowed: true },
  ]) {
    assert.equal(policy.slipDecision(row), "manual_review");
  }
});

test("proof can release kitchen only when it exactly matches pending PromptPay order", () => {
  const now = Date.now();
  const order = {
    orderType: "delivery",
    paymentMethod: "promptpay",
    paymentStatus: "pending_verification",
    paymentSlipPath: "tenants/t/payment-slips/o/s.jpg",
    subtotalAmount: 120,
    deliveryFee: 30,
    totalAmount: 150,
    items: [{ menuId: "m1", qty: 1, price: 120, cancelled: false }],
  };
  const proof = {
    status: "matched",
    provider: "slip2go",
    transRef: "TX-002",
    slipPath: order.paymentSlipPath,
    foodCents: 12000,
    feeCents: 3000,
    amountCents: 15000,
    itemsSignature: policy.normalizedItems([{ id: "m1", qty: 1, priceCents: 12000 }]),
    checkedAtMillis: now - 1000,
  };
  assert.equal(policy.proofValidForOrder(order, proof, now), true);
  assert.equal(policy.proofValidForOrder({ ...order, totalAmount: 149 }, proof, now), false);
  assert.equal(policy.proofValidForOrder({ ...order, paymentStatus: "paid" }, proof, now), false);
});

test("cashier manual review approval is a trusted callable, not a client payment patch", () => {
  const backend = fs.readFileSync("functions/delivery-slip.js", "utf8");
  const exportsSource = fs.readFileSync("functions/index.js", "utf8");
  const cashier = fs.readFileSync("react-app/src/pages/CashierPage.jsx", "utf8");
  assert.ok(backend.includes("exports.approveDeliveryPaymentReview = onCall"));
  assert.ok(backend.includes("CASHIER_PERMISSION_REQUIRED"));
  assert.ok(backend.includes('slipVerificationProvider: "cashier_manual"'));
  assert.ok(exportsSource.includes("exports.approveDeliveryPaymentReview"));
  assert.ok(cashier.includes('httpsCallable(functions, "approveDeliveryPaymentReview"'));
  assert.ok(!cashier.includes('patch.slipVerificationProvider = "cashier_manual"'));
});

test("delivery checkout exposes localized Slip2Go outcomes and customer can switch to COD", () => {
  const delivery = fs.readFileSync("react-app/src/pages/DeliveryPage.jsx", "utf8");
  for (const key of [
    "slip_duplicate",
    "slip_mismatch",
    "slip_receiver_mismatch",
    "slip_invalid",
    "slip_manual",
  ]) assert.ok(delivery.includes(key), `missing ${key}`);
  assert.ok(delivery.includes('disabled={submitting} onChange={event => { setPaymentMethod(event.target.value)'));
  assert.ok(!delivery.includes("สลิปนี้ถูกใช้แล้ว"));
});

test("Slip2Go customer/cashier copy is localized in every supported locale", () => {
  const dictionary = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json", "utf8"));
  for (const locale of ["th", "en", "my", "lo", "km"]) {
    const customer = dictionary?.[locale]?.delivery?.checkout?.payment || {};
    const cashier = dictionary?.[locale]?.cashier?.payment || {};
    for (const key of ["slip_duplicate", "slip_mismatch", "slip_receiver_mismatch", "slip_invalid", "slip_manual"]) {
      assert.ok(customer[key], `${locale} missing delivery payment ${key}`);
    }
    assert.ok(cashier.slip_manual_release, `${locale} missing cashier slip_manual_release`);
    assert.ok(cashier.slip_manual_approved, `${locale} missing cashier slip_manual_approved`);
  }
});

test("server owns manual-review state and expired proofs cannot strand cashier approval", () => {
  const backend = fs.readFileSync("functions/delivery-slip.js", "utf8");
  assert.ok(backend.includes('return manualProof("verification_expired")'));
  assert.ok(backend.includes('proof.status === "manual_review" && proofBoundToOrder(current, proof)'));
  assert.ok(backend.includes("paymentReviewRequired: true"));
  assert.ok(backend.includes('slipVerificationStatus: "manual_review"'));
});

test("delivery slip backend has no undefined verification guard and exports all flow triggers", () => {
  const backend = fs.readFileSync("functions/delivery-slip.js", "utf8");
  const exportsSource = fs.readFileSync("functions/index.js", "utf8");
  assert.ok(!backend.includes("verified &&"));
  for (const name of [
    "verifyDeliveryPaymentSlip",
    "finalizeDeliveryPaymentSlip",
    "approveDeliveryPaymentReview",
    "notifyKitchenDeliveryAdmitted",
  ]) assert.ok(exportsSource.includes(`exports.${name}`), `missing export ${name}`);
});

test("non-service verification paths preserve a server proof for cashier approval", () => {
  const backend = fs.readFileSync("functions/delivery-slip.js", "utf8");
  assert.match(backend, /const manualProof = async reason =>/);
  assert.match(backend, /return manualProof\("verification_expired"\)/);
  assert.match(backend, /return manualProof\("merchant_promptpay_receiver_not_supported"\)/);
  assert.match(backend, /return manualProof\("slip2go_request_rate_limit"\)/);
  assert.match(backend, /proof.status === "manual_review"/);
  assert.match(backend, /proofBoundToOrder\(order, proof\)/);
});

test("server blocks unapproved staff payment changes while a Delivery slip needs manual review", () => {
  const rules = fs.readFileSync("firestore.rules", "utf8");
  assert.match(rules, /function protectedDeliveryManualReview\(\)/);
  assert.match(rules, /function deliveryPaymentReviewFieldsUnchanged\(\)/);
  const scoped = rules.split("match /tenants/{tenantId} {")[1];
  const orderRule = scoped?.split("match /orders/{orderId} {")[1]?.split("}")[0] || "";
  assert.match(orderRule, /tenantKitchenRole\(tenantId\)/);
  assert.match(orderRule, /tenantCashierRole\(tenantId\)/);
  assert.match(orderRule, /tenantAdminRole\(tenantId\)/);
  assert.match(rules, /resource\.data\.get\('paymentMethod', ''\) == 'promptpay'/);
  assert.match(orderRule, /deliveryPaymentReviewFieldsUnchanged\(\)/);
});

test("legacy pre-Slip2Go cashier approval is audited and bounded to historical slip orders", () => {
  const source = fs.readFileSync("functions/delivery-slip.js", "utf8");
  assert.match(source, /!proofSnap.exists && created > 0/);
  assert.match(source, /created < Date.parse\("2026-10-08T00:00:00\+07:00"\)/);
  assert.match(source, /order.paymentSlipPath \|\| order.paymentSlipUrl/);
  assert.match(source, /Number\(order.totalAmount\) > 0/);
  assert.match(source, /slipVerificationStatus: legacySlip \? "legacy_cashier_approved"/);
  assert.match(source, /paymentReviewedByUid: actor.uid/);
  const cashier = fs.readFileSync("react-app/src/pages/CashierPage.jsx", "utf8");
  assert.match(cashier, /const manualDeliveryReview = order.orderType === "delivery"/);
  assert.match(cashier, /approveDeliveryPaymentReview\(\{ tenantId: tenant.id, orderId: order.id \}\)/);
});
test("kitchen audio notifies on payment admission rather than on unpaid order creation", () => {
  const source = fs.readFileSync("react-app/src/components/CashierOrderNotifier.jsx", "utf8");
  assert.match(source, /surface !== "kitchen" \|\| deliveryKitchenAdmitted\(order\)/);
  assert.match(source, /createOrderAlertAudioController/);
  assert.match(source, /announcementChainRef/);
});

test("Delivery slip verification review note wraps inside the checkout card", () => {
  const jsx=fs.readFileSync("react-app/src/pages/DeliveryPage.jsx","utf8");
  const css=fs.readFileSync("react-app/public/parity/css/payment-slip.css","utf8");
  assert.match(jsx,/className="menu-category delivery-payment-slip-review-note" id="paymentSlipReviewNote"/);
  assert.match(css,/body\.delivery-page #promptPaySection \.delivery-payment-slip-review-note \{[\s\S]*?display: block;/);
  assert.match(css,/body\.delivery-page #promptPaySection \.delivery-payment-slip-review-note \{[\s\S]*?max-width: 100%;/);
  assert.match(css,/body\.delivery-page #promptPaySection \.delivery-payment-slip-review-note \{[\s\S]*?white-space: normal;/);
  assert.match(css,/body\.delivery-page #promptPaySection \.delivery-payment-slip-review-note \{[\s\S]*?overflow-wrap: anywhere;/);
});

test("uploaded slip preview filename wraps without pushing file size or card wider", () => {
  const jsx=fs.readFileSync("react-app/src/pages/DeliveryPage.jsx","utf8");
  const css=fs.readFileSync("react-app/public/parity/css/payment-slip.css","utf8");
  assert.match(jsx,/id="paymentSlipFileName"/);
  assert.match(jsx,/id="paymentSlipFileSize"/);
  assert.match(css,/#promptPaySection #paymentSlipFileName \{[\s\S]*?overflow-wrap: anywhere;/);
  assert.match(css,/#promptPaySection #paymentSlipFileSize \{[\s\S]*?white-space: nowrap;/);
  assert.match(css,/#promptPaySection \.payment-slip-preview \{[\s\S]*?min-width: 0;/);
});
