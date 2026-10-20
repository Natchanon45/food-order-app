import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { paidDeliverySale, paidDeliveryByDay } = require("../../functions/hybrid-billing-orders.js");
const { calculateCycle, billingCycle, cycleWindow } = require("../../functions/hybrid-billing-core.js");
const { previewHybridCycle } = require("../../functions/hybrid-billing-preview.js");

const fakeTime = iso => ({ toDate: () => new Date(iso) });
const paid = (amount, overrides = {}) => ({
  orderType: "delivery", paymentStatus: "paid", status: "delivered",
  paidAt: fakeTime("2026-10-20T07:00:00.000Z"),
  subtotalAmount: amount, totalAmount: amount + 40, deliveryFee: 40,
  ...overrides,
});

test("paid Delivery goods exclude shipping from billed sales", () => {
  assert.deepEqual(paidDeliverySale(paid(500)), { date: "2026-10-20", amount: 500 });
});
test("POS/table/takeaway never enters Delivery base", () => {
  for (const type of ["pos", "table", "takeaway", "walkin", "retail-pos"]) {
    assert.equal(paidDeliverySale(paid(9000, { orderType: type })), null);
  }
});
test("unpaid and pending verification orders never enter Delivery base", () => {
  for (const status of ["unpaid", "pending_verification", "pending", "rejected"]) {
    assert.equal(paidDeliverySale(paid(10000, { paymentStatus: status })), null);
  }
});
test("cancelled, voided, deleted and fully refunded orders count nothing", () => {
  for (const status of ["cancelled", "voided", "deleted", "refunded"]) {
    assert.equal(paidDeliverySale(paid(10000, { status })), null);
  }
});
test("partially refunded merchandise subtracts only refunded part", () => {
  assert.equal(paidDeliverySale(paid(1000, { refundTotal: 250 })).amount, 750);
});
test("lower effective merchandise value used if discount reduces paid total", () => {
  assert.equal(paidDeliverySale(paid(1000, { totalAmount: 840, deliveryFee: 40 })).amount, 800);
});
test("fallback excludes shipping if subtotalAmount absent", () => {
  const order = paid(500);
  delete order.subtotalAmount;
  assert.equal(paidDeliverySale(order).amount, 500);
});
test("invalid monetary data or missing server paid timestamp fails closed", () => {
  assert.throws(() => paidDeliverySale(paid(100, { paidAt: "2026-10-20T00:00:00Z" })));
  assert.throws(() => paidDeliverySale(paid(100, { subtotalAmount: "NaN" })));
  assert.throws(() => paidDeliverySale(paid(100, { totalAmount: 20, deliveryFee: 40 })));
  assert.throws(() => paidDeliverySale(paid(100, { refundAmount: "-1" })));
  assert.throws(() => paidDeliverySale(paid(100, { totalAmount: 100.001 })));
});
test("Bangkok midnight determines correct monthly revenue window", () => {
  const prev = paid(100, { paidAt: fakeTime("2026-10-31T16:59:59Z") });
  const next = paid(400, { paidAt: fakeTime("2026-10-31T17:00:00Z") });
  assert.equal(paidDeliverySale(prev).date, "2026-10-31");
  assert.equal(paidDeliverySale(next).date, "2026-11-01");
  assert.deepEqual(paidDeliveryByDay([prev, next], "2026-10"), [{ date: "2026-10-31", amount: 100 }]);
});
test("aggregation is order-independent and combines many same-day paid orders exactly", () => {
  const rows = [
    paid(1100), paid(500), paid(8300), paid(1900, { paidAt: fakeTime("2026-10-21T05:00:00Z") }),
    paid(55000, { orderType: "pos" }), paid(11100, { paymentStatus: "pending_verification" }),
  ];
  const daily = paidDeliveryByDay(rows.reverse(), "2026-10");
  assert.deepEqual(daily, [{ date: "2026-10-20", amount: 9900 }, { date: "2026-10-21", amount: 1900 }]);
  const result = calculateCycle({ signupDate: "2026-09-16", cycleId: "2026-10-16", dailyDeliverySales: daily });
  assert.equal(result.mode, "delivery_share");
  assert.equal(result.triggerDate, "2026-10-21");
  assert.equal(result.totalFee, 95);
  assert.equal(result.fixedFee, 0);
});
test("billing cycle midnight uses Bangkok dates incl leap and year rollover", () => {
  assert.equal(cycleWindow(billingCycle("2026-12-31", "2027-01-31")).end.toISOString(), "2027-02-27T17:00:00.000Z");
  assert.equal(cycleWindow(billingCycle("2028-01-31", "2028-02-29")).end.toISOString(), "2028-03-30T17:00:00.000Z");
  assert.throws(() => billingCycle("2026-13-16", "2026-10-16"));
});
test("preview callable can only read orders and rejects cross tenant access", () => {
  const source = fs.readFileSync("functions/hybrid-billing-preview.js", "utf8");
  assert.match(source, /Cross-tenant access denied/);
  assert.match(source, /profile\.role/);
  assert.match(source, /MAX_PAID_ORDERS/);
  assert.match(source, /where\("paidAt", ">="/);
  assert.match(source, /priceLocked/);
  assert.doesNotMatch(source, /tx\.set\(|\.set\(\{|\.update\(\{|\.delete\(/);
});

test("read-only tenant preview uses stored period snapshot, ignores POS and never modifies docs", async () => {
  const changes = [];
  const rows = [paid(10000), paid(5000, { orderType: "pos" }),
    paid(2000, { paidAt: fakeTime("2026-10-21T05:00:00Z") })];
  const orderDocs = rows.map((row, i) => ({ id: `paid-${i}`, data: () => row }));
  const auditDocs = orderDocs.filter(doc => doc.data().orderType === "delivery"
    && doc.data().paymentStatus === "paid");
  const auditQuery = {
    where: () => auditQuery, orderBy: () => auditQuery, limit: () => auditQuery,
    startAfter: () => auditQuery,
    get: async () => ({ docs: auditDocs, size: auditDocs.length }),
  };
  const query = {
    where: field => field === "orderType" ? auditQuery : query,
    orderBy: () => query, limit: () => query, startAfter: () => query,
    get: async () => ({ docs: orderDocs, size: orderDocs.length }),
  };
  const tenantRef = {
    id: "tenant-preview-test",
    collection: name => name === "orders"
      ? query
      : { doc: () => ({
        get: async () => ({
          exists: true, data: () => ({
            configSnapshot: { monthlyFee: 777, deliveryThreshold: 10000, deliveryShareRate: 2, monthlySlipQuota: 9 }
          }),
        }),
        set: () => changes.push("set"),
      }) },
  };
  const result = await previewHybridCycle(tenantRef, { hybridBillingStartDate: "2026-10-16" }, "2026-10-16", {});
  assert.equal(result.priceLocked, true);
  assert.equal(result.source, "billing_snapshot");
  assert.equal(result.config.monthlyFee, 777);
  assert.equal(result.totalDeliverySales, 12000);
  assert.equal(result.totalFee, 240);
  assert.equal(result.fixedFee, 0);
  assert.deepEqual(changes, []);
});
