import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backend = readFileSync("functions/hybrid-billing-cod-payment.js", "utf8");
const index = readFileSync("functions/index.js", "utf8");
const cashier = readFileSync("react-app/src/pages/CashierPage.jsx", "utf8");
const callableSource = readFileSync("functions/hybrid-billing-cod-callable.js", "utf8");

test("Phase3I COD remains internal: no Functions export or active front-end route", () => {
  assert.doesNotMatch(index, /hybrid-billing-cod-payment|settleHybridCodDeliveryPayment/);
  assert.doesNotMatch(cashier, /settleHybridCodDeliveryPayment/);
});
test("COD candidate uses trusted server clock; never parses client timestamps", () => {
  assert.match(backend, /paidAt:\s*serverTimestamp\(\)/);
  assert.match(backend, /lalamoveCodSettledAt\s*=\s*serverTimestamp\(\)/);
  assert.doesNotMatch(backend, /request\.data\.paidAt|new Date\(request/);
});
test("COD candidate fail-closes on actor, suspended tenant and previously-paid malformed receipts", () => {
  assert.match(backend, /profileRef\s*=\s*db\.collection\("users"\)\.doc\(actorUid\)/);
  assert.match(backend, /profile\.tenantId !== tenantId/);
  assert.match(backend, /tenant\.hybridBillingSuspended === true/);
  assert.match(backend, /HYBRID_COD_EXISTING_PAYMENT_REQUIRES_RECONCILIATION/);
});
test("Hybrid COD integration remains a release blocker until callable and rules are wired", () => {
  // Production-bound React still sends a client ISO paidAt; the callable
  // candidate MUST NOT be mistaken for a shipped fix.
  assert.match(cashier, /paymentStatus:\s*"paid",\s*paidAt:\s*now/);
  assert.match(cashier, /await updateOrder\(order\.id, patch\)/);
});

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { makeHybridCodCallableHandler, hybridCodCashierPaymentCandidate } =
  require("../../functions/hybrid-billing-cod-callable.js");
const valid = (data = {}) => ({ auth: { uid: "cashier-trusted-0001" }, data: {
  tenantId: "tenant-callable-001", orderId: "order-callable-001", ...data,
} });

test("Phase3J callable candidate is not registered in Functions exports or React", () => {
  assert.doesNotMatch(index, /hybrid-billing-cod-callable|hybridCodCashierPaymentCandidate/);
  assert.doesNotMatch(cashier, /hybridCodCashierPaymentCandidate/);
  assert.equal(typeof hybridCodCashierPaymentCandidate, "function");
  assert.match(callableSource, /enforceAppCheck: true/);
});
test("Phase3J handler passes only verified auth.uid; no browser-specified identity", async () => {
  let input;
  const handler = makeHybridCodCallableHandler({
    getDb: () => ({ fakeDb: true }),
    settle: async args => { input = args; return { ok: true, alreadyPaid: false }; },
  });
  assert.deepEqual(await handler(valid()), { ok: true, alreadyPaid: false });
  assert.equal(input.actorUid, "cashier-trusted-0001");
  assert.equal(input.tenantId, "tenant-callable-001");
  assert.equal(input.orderId, "order-callable-001");
  assert.deepEqual(input.db, { fakeDb: true });
});
test("Phase3J callable rejects unauthenticated, forged actor, dates, totals and status", async () => {
  const handler = makeHybridCodCallableHandler({
    getDb: () => ({}), settle: async () => { throw Error("MUST_NOT_BE_CALLED"); },
  });
  for (const request of [
    { data: valid().data },
    { auth: { uid: "" }, data: valid().data },
    valid({ actorUid: "victim-uid-001" }),
    valid({ paidAt: "2026-10-20T04:00:00Z" }),
    valid({ amount: 100 }),
    valid({ paymentStatus: "paid" }),
    valid({ role: "super_admin" }),
    { ...valid(), data: { tenantId: "tenant-callable-001" } },
    { ...valid(), data: { tenantId: "/tenants/bad", orderId: "order-callable-001" } },
    { ...valid(), data: { tenantId: 12345678901, orderId: "order-callable-001" } },
    { ...valid(), data: ["tenant-callable-001", "order-callable-001"] },
  ]) {
    await assert.rejects(handler(request), /HYBRID_COD_AUTH_REQUIRED|HYBRID_COD_ALLOWED_FIELDS_TENANT_AND_ORDER_ONLY/);
  }
});
test("Phase3J callable maps known failures to safe HTTPS categories without leaking internals", async () => {
  const samples = {
    HYBRID_COD_CASHIER_NOT_AUTHORIZED: "permission-denied",
    HYBRID_COD_TENANT_NOT_ENABLED: "failed-precondition",
    HYBRID_COD_DELIVERY_NOT_COMPLETED: "failed-precondition",
    HYBRID_COD_EXISTING_PAYMENT_REQUIRES_RECONCILIATION: "failed-precondition",
    HYBRID_COD_ORDER_NOT_FOUND: "not-found",
    HYBRID_COD_INVALID_REQUEST: "invalid-argument",
    "Firestore SDK secret endpoint error": "internal",
  };
  for (const [reason, expected] of Object.entries(samples)) {
    const handler = makeHybridCodCallableHandler({
      getDb: () => ({}),
      settle: async () => { throw Error(reason); },
    });
    await assert.rejects(handler(valid()), error => {
      assert.equal(error.code, expected);
      if (expected === "internal") {
        assert.equal(error.message, "HYBRID_COD_INTERNAL_ERROR");
      }
      return true;
    });
  }
});
