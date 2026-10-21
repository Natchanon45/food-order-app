import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cashierPaidAt } from "../../react-app/src/utils/hybridCashierPaidAt.js";

const serverClock = Object.freeze({ type: "firestore_serverTimestamp" });
const capture = () => serverClock;
const browserIso = "2026-10-15T16:59:59.999Z";

test("Hybrid Delivery cashier payment uses Firestore server-assigned timestamp", () => {
  assert.equal(cashierPaidAt({ orderType: "delivery" },
    { billingPolicyVersion: "hybrid_v1" }, browserIso, capture), serverClock);
});
test("Lalamove COD is still Delivery and receives server timestamp on cashier confirmation", () => {
  assert.equal(cashierPaidAt({
    orderType: "delivery", paymentMethod: "cod", lalamoveCodEnabled: true,
  }, { billingPolicyVersion: "hybrid_v1" }, browserIso, capture), serverClock);
});
test("legacy Delivery and all other channels preserve previous ISO timestamp", () => {
  for (const orderType of ["table", "takeaway", "walkin", "pos", "retail-pos"]) {
    assert.equal(cashierPaidAt({ orderType },
      { billingPolicyVersion: "hybrid_v1" }, browserIso, capture), browserIso);
  }
  assert.equal(cashierPaidAt({ orderType: "delivery" },
    { billingPolicyVersion: "legacy" }, browserIso, capture), browserIso);
  assert.equal(cashierPaidAt({ orderType: "delivery" }, {}, browserIso, capture), browserIso);
});
test("hybrid cashier cannot fall back to browser timestamp if server sentinel is missing", () => {
  assert.throws(() => cashierPaidAt({ orderType: "delivery" },
    { billingPolicyVersion: "hybrid_v1" }, browserIso), /HYBRID_SERVER_TIMESTAMP_REQUIRED/);
});
test("only one regular cashier payment path is wired to the hybrid timestamp policy", () => {
  const cashier = fs.readFileSync("react-app/src/pages/CashierPage.jsx", "utf8");
  const orderWriter = fs.readFileSync("react-app/src/data/operationalData.js", "utf8");
  assert.match(cashier, /import \{ serverTimestamp \} from "firebase\/firestore";/);
  assert.match(cashier, /paidAt: cashierPaidAt\(order, tenant, now, serverTimestamp\)/);
  assert.match(cashier, /const manualDeliveryReview = order\.orderType === "delivery"/);
  assert.match(cashier, /approveDeliveryPaymentReview\(\{ tenantId: tenant\.id, orderId: order\.id \}\)/);
  assert.match(cashier, /patch\.lalamoveCodSettledAt = now/);
  assert.match(cashier, /const patch = \{ paymentStatus: "paid", paidAt: now \}/);
  assert.match(cashier, /status: "paid", paymentStatus: "paid", paidAt: now, completedAt: now/);
  assert.match(orderWriter, /await setDoc\(ref, \{/);
  assert.match(orderWriter, /updatedAt: serverTimestamp\(\)/);
});
test("new timestamp policy doesn't export a fee payment or settlement callable", () => {
  const index = fs.readFileSync("functions/index.js", "utf8");
  assert.doesNotMatch(index, /confirmHybridDeliveryCashierPayment|issueHybridInvoice|settleHybridInvoice/);
});
