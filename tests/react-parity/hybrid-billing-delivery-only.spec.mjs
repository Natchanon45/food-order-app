import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { previewDeliveryOnlyMonth } = require("../../functions/hybrid-billing-delivery-only.js");
const { paidDeliverySale } = require("../../functions/hybrid-billing-orders.js");

const paidTime = iso => ({ toDate: () => new Date(iso) });
const order = (amount, overrides = {}) => ({
  orderType: "delivery",
  paymentStatus: "paid",
  status: "delivered",
  paidAt: paidTime("2026-10-20T08:00:00Z"),
  subtotalAmount: amount,
  totalAmount: amount + 40,
  deliveryFee: 40,
  ...overrides,
});
const preview = orders => previewDeliveryOnlyMonth({ orders, month: "2026-10" });

test("Delivery sales below the threshold retain fixed monthly fee", () => {
  const result = preview([order(9900)]);
  assert.equal(result.totalDeliverySales, 9900);
  assert.equal(result.mode, "fixed_monthly");
  assert.equal(result.totalFee, 590);
});
test("POS, table, takeaway, and walk-in never push Delivery across threshold", () => {
  const rows = [order(9900), ...["pos", "table", "takeaway", "walkin", "retail-pos"]
    .map(type => order(60000, { orderType: type }))];
  const result = preview(rows);
  assert.equal(result.totalDeliverySales, 9900);
  assert.equal(result.mode, "fixed_monthly");
});
test("only verified-paid eligible Delivery crosses threshold; shipping excluded", () => {
  const rows = [order(9700), order(300), order(50000, { paymentStatus: "pending_verification" }),
    order(50000, { status: "cancelled" })];
  const result = preview(rows);
  assert.equal(result.totalDeliverySales, 10000);
  assert.equal(result.mode, "delivery_share");
  assert.equal(result.totalFee, 500); // preserve existing threshold policy
  assert.equal(result.fixedFee, 0);
});
test("Delivery threshold day uses only that day's paid goods, excluding prior days", () => {
  const rows = [
    order(9000, { paidAt: paidTime("2026-10-19T08:00:00Z") }),
    order(4000, { paidAt: paidTime("2026-10-20T08:00:00Z") }),
    order(50000, { orderType: "pos" }),
  ];
  const result = preview(rows);
  assert.equal(result.totalDeliverySales, 13000);
  assert.equal(result.triggerDate, "2026-10-20");
  assert.equal(result.invoices[0].calculationBase, 4000);
  assert.equal(result.totalFee, 200);
});
test("partial Delivery refunds reduce qualifying sales without touching POS", () => {
  const result = preview([order(10000, { refundTotal: 501 }), order(30000, { orderType: "pos" })]);
  assert.equal(result.totalDeliverySales, 9499);
  assert.equal(result.mode, "fixed_monthly");
});
test("refund greater than Delivery goods is an explicit error, not a silent zero", () => {
  assert.throws(() => paidDeliverySale(order(200, { refundTotal: 201 })),
    /HYBRID_DELIVERY_REFUND_EXCEEDS_MERCHANDISE/);
  assert.equal(paidDeliverySale(order(200, { refundTotal: 200 })).amount, 0);
});
test("unknown paidAt on eligible Delivery fails closed instead of guessing a date", () => {
  assert.throws(() => preview([order(10000, { paidAt: "2026-10-20T08:00:00Z" })]),
    /HYBRID_PAID_DELIVERY_MISSING_SERVER_TIMESTAMP/);
});
test("adapter only reads existing orders: no new journal, settlement or cashier writer", () => {
  const source = fs.readFileSync("functions/hybrid-billing-delivery-only.js", "utf8");
  const report = fs.readFileSync("functions/hybrid-billing-preview.js", "utf8");
  assert.match(report, /previewDeliveryOnlyMonth\(/);
  assert.doesNotMatch(source, /\.set\(|\.update\(|\.delete\(|runTransaction|onSchedule/);
  assert.doesNotMatch(source, /lalamove|wallet|cashier|posSale/i);
});

const { billingCycle, anchorAtMonth } = require("../../functions/hybrid-billing-core.js");
const { previewDeliveryOnlyCycle } = require("../../functions/hybrid-billing-delivery-only.js");

test("anniversary 16 Oct -> 16 Nov; paid Delivery order on next boundary not included", () => {
  assert.equal(billingCycle("2026-10-16", "2026-11-15").id, "2026-10-16");
  assert.equal(billingCycle("2026-10-16", "2026-11-16").id, "2026-11-16");
  const rows = [order(9000, { paidAt: paidTime("2026-11-15T16:59:59Z") }),
    order(10000, { paidAt: paidTime("2026-11-15T17:00:00Z") })];
  const previous = previewDeliveryOnlyCycle({ orders: rows, signupDate: "2026-10-16", cycleId: "2026-10-16" });
  const current = previewDeliveryOnlyCycle({ orders: rows, signupDate: "2026-10-16", cycleId: "2026-11-16" });
  assert.equal(previous.totalDeliverySales, 9000);
  assert.equal(previous.mode, "trial_free");
  assert.equal(current.totalDeliverySales, 10000);
  assert.equal(current.totalFee, 500);
  assert.equal(previous.cycleLastDate, "2026-11-15");
});
test("31 January anniversary resumes March 31 without drifting after February", () => {
  assert.equal(anchorAtMonth("2027-01-31", 1), "2027-02-28");
  assert.equal(anchorAtMonth("2027-01-31", 2), "2027-03-31");
  assert.equal(anchorAtMonth("2028-01-31", 1), "2028-02-29");
});
test("second anniversary cycle below threshold remains fixed-fee", () => {
  const result = previewDeliveryOnlyCycle({
    orders: [order(9999, { paidAt: paidTime("2026-11-20T10:00:00Z") })],
    signupDate: "2026-10-16", cycleId: "2026-11-16",
  });
  assert.equal(result.totalFee, 590);
  assert.equal(result.invoices[0].date, "2026-12-15");
  assert.equal(result.invoices[0].issueAtCycleClose, true);
});
