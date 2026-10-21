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
