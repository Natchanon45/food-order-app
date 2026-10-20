import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HYBRID_COD_CASHIER_CUTOVER_READY,
  hybridDeliveryCashierRoute,
} from "../../react-app/src/data/hybridCodCashierRoute.mjs";

const hybrid = { billingPolicyVersion: "hybrid_v1", hybridBillingEnabled: true,
  active: true, hybridBillingSuspended: false, id: "tenant-route-123" };
const legacy = { billingPolicyVersion: "legacy", id: "tenant-legacy-123" };
const cod = { orderType: "delivery", paymentMethod: "cod", id: "order-route-123" };

test("Phase3K: Hybrid COD source cutover is explicitly DISABLED", () => {
  assert.equal(HYBRID_COD_CASHIER_CUTOVER_READY, false);
  assert.equal(hybridDeliveryCashierRoute(hybrid, cod), "cutover_not_released");
});

test("Phase3K: legacy Delivery and other legacy cashier payments unchanged", () => {
  assert.equal(hybridDeliveryCashierRoute(legacy, cod), "legacy");
  assert.equal(hybridDeliveryCashierRoute(hybrid, { ...cod, orderType: "takeaway" }), "legacy");
  assert.equal(hybridDeliveryCashierRoute(null, cod), "legacy");
});

test("Phase3K: Hybrid PromptPay uses existing trusted slip review and all unknown payments block", () => {
  assert.equal(hybridDeliveryCashierRoute(hybrid, {
    ...cod, paymentMethod: "promptpay",
  }), "proof_review");
  for (const paymentMethod of ["cash", "bank_transfer", "", null]) {
    assert.equal(hybridDeliveryCashierRoute(hybrid, { ...cod, paymentMethod }),
      "unsupported_hybrid_payment");
  }
});

test("Phase3K: suspended, inactive and non-enabled Hybrid COD never accepts payment", () => {
  for (const override of [
    { hybridBillingEnabled: false },
    { active: false },
    { hybridBillingSuspended: true },
  ]) {
    assert.equal(hybridDeliveryCashierRoute({ ...hybrid, ...override }, cod),
      "hybrid_disabled");
  }
});

test("Phase3K: Cashier route cannot silently fall through to client paidAt for Hybrid", () => {
  const page = readFileSync("react-app/src/pages/CashierPage.jsx", "utf8");
  const adapter = readFileSync("react-app/src/data/hybridCodCashier.js", "utf8");
  const index = readFileSync("functions/index.js", "utf8");
  assert.match(page, /hybridDeliveryCashierRoute\(tenant, order\)/);
  assert.match(page, /!\["legacy", "proof_review", "server"\]\.includes\(hybridRoute\)/);
  assert.match(page, /if \(hybridRoute === "server"\)\s*\{\s*await settleHybridCodCashier\(tenant, order\)/);
  assert.match(page, /paymentStatus: "paid", paidAt: now/); // for Legacy ONLY
  assert.match(adapter, /if \(route !== "server"\) throw new Error\("HYBRID_COD_CASHIER_NOT_RELEASED"\)/);
  assert.match(adapter, /if \(typeof callable !== "function"\) throw new Error\("HYBRID_COD_CALLABLE_NOT_REGISTERED"\)/);
  assert.match(adapter, /tenantId: tenant.id, orderId: order.id/);
  assert.doesNotMatch(adapter, /httpsCallable\s*\(/);
  assert.doesNotMatch(adapter, /updateOperationalOrder|setDoc|paidAt\s*:/);
  assert.doesNotMatch(index, /hybrid-billing-cod-callable|hybridCodCashierPaymentCandidate/);
});

test("Phase3K: staged Cashier adapter never invokes an unregistered Callable", async () => {
  const { settleHybridCodCashier } = await import(
    "../../react-app/src/data/hybridCodCashier.js");
  let called = 0;
  const mockCallable = async () => { called += 1; return { data: { ok: true } }; };
  await assert.rejects(settleHybridCodCashier(hybrid, cod, mockCallable),
    /HYBRID_COD_CASHIER_NOT_RELEASED/);
  await assert.rejects(settleHybridCodCashier(legacy, cod, mockCallable),
    /HYBRID_COD_CASHIER_NOT_RELEASED/);
  assert.equal(called, 0);
});
