import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync("functions/revenue-share.js", "utf8");
const policy = require("../../functions/revenue-share-policy.js");
const anniversaries = require("../../functions/billing-anniversary.js");

const pricing = { deliveryShareRate: 5, deliveryThreshold: 10000 };
const paid = (day, amount) => ({
  orderType: "delivery", paymentStatus: "paid", status: "delivered",
  paidAt: day + "T12:00:00+07:00",
  subtotalAmount: amount, totalAmount: amount + 40, deliveryFee: 40,
});
function serverAt(day, orders = []) {
  const nowISO = day + "T12:00:00+07:00";
  const NativeDate = Date;
  class DateAt extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [nowISO])); }
    static now() { return NativeDate.parse(nowISO); }
  }
  const docs = orders.map(data => ({ data: () => data }));
  const db = {
    collection: name => ({
      doc: id => ({
        id,
        collection: collection => ({
          get: async () => ({ docs: collection === "orders" ? docs : [] }),
        }),
      }),
    }),
  };
  const dependencies = {
    "firebase-functions/v2/https": {
      HttpsError: class extends Error {},
      onCall: (_options, fn) => fn,
    },
    "firebase-functions/v2/scheduler": { onSchedule: (_options, fn) => fn },
    "firebase-admin/firestore": { getFirestore: () => db, FieldValue: {} },
    "firebase-admin/storage": { getStorage: () => ({}) },
    "./slip-verification": { inspectSlip: async () => ({}) },
    "./subscription-pricing-core": {
      loadPricing: async () => pricing, calculatePricing: () => ({ monthly: {}, annual: {} }),
    },
    "./revenue-share-policy": policy,
    "./billing-anniversary": anniversaries,
  };
  const m = { exports: {} };
  const hooks = "\nmodule.exports.__revenueSetting = revenueSetting;" +
    "\nmodule.exports.__periodFromData = periodFromData;" +
    "\nmodule.exports.__previousPeriod = previousPeriod;" +
    "\nmodule.exports.__summaryForTenant = summaryForTenant;";
  new Function("module", "exports", "require", "Date", source + hooks)(
    m, m.exports, key => {
      assert.ok(key in dependencies, "Unexpected dependency " + key);
      return dependencies[key];
    }, DateAt
  );
  return m.exports;
}
const tenant = (effective = null) => ({
  billingMode: "subscription", businessType: "both",
  createdAt: "2026-06-21T00:00:00+07:00",
  ...(effective ? { billingAnniversaryEffectiveAt: effective + "T00:00:00+07:00" } : {}),
});

test("unapproved legacy store retains calendar-month reports and November threshold", async () => {
  const server = serverAt("2026-11-20", [
    paid("2026-11-01", 6000), paid("2026-11-10", 4000), paid("2026-11-20", 1000),
  ]);
  const t = tenant();
  const s = server.__revenueSetting(t, pricing);
  assert.equal(s.billingAnniversaryEffectiveDate, null);
  const p = server.__periodFromData({ period: "monthly", month: "2026-11" }, t);
  assert.equal(p.startDate, "2026-11-01");
  assert.equal(p.endDate, "2026-11-30");
  const sum = await server.__summaryForTenant("legacy", p, s);
  assert.equal(sum.monthlyDeliveryStartDate, "2026-11-01");
  assert.equal(sum.monthlyDeliverySales, 11000);
  assert.equal(sum.revenueShare, 250);
});

test("authorized future cutover does not rewrite October or November pre-cutover revenue", async () => {
  const server = serverAt("2026-11-20", [
    paid("2026-11-01", 6000), paid("2026-11-10", 4000), paid("2026-11-20", 1000),
  ]);
  const t = tenant("2026-11-21");
  const s = server.__revenueSetting(t, pricing);
  assert.equal(s.billingAnniversaryEffectiveDate, "2026-11-21");
  const before = server.__periodFromData({ period: "monthly", month: "2026-10" }, t);
  assert.deepEqual([before.startDate, before.endDate], ["2026-10-01", "2026-10-31"]);
  const november = server.__periodFromData({ period: "custom",
    startDate: "2026-11-01", endDate: "2026-11-20" }, t);
  const sum = await server.__summaryForTenant("legacy", november, s);
  assert.equal(sum.revenueShare, 250);
  assert.equal(sum.monthlyDeliveryStartDate, "2026-11-01");
  assert.equal(server.__previousPeriod("monthly", t).startDate, "2026-10-01");
});

test("on cutover only post-cutover sales enter first anniversary cycle", async () => {
  const rows = [
    paid("2026-11-01", 6000), paid("2026-11-10", 4000), paid("2026-11-20", 1000),
    paid("2026-11-21", 6000), paid("2026-11-22", 4000),
  ];
  const server = serverAt("2026-11-22", rows), t = tenant("2026-11-21");
  const p = server.__periodFromData({ period: "monthly", month: "2026-11" }, t);
  assert.deepEqual([p.startDate, p.endDate], ["2026-11-21", "2026-12-20"]);
  const sum = await server.__summaryForTenant("premium", p, server.__revenueSetting(t, pricing));
  assert.equal(sum.monthlyDeliveryStartDate, "2026-11-21");
  assert.equal(sum.monthlyDeliveryEndDate, "2026-12-20");
  assert.equal(sum.monthlyDeliverySales, 10000);
  assert.equal(sum.revenueShare, 200);
  assert.equal(server.__previousPeriod("monthly", t), null,
    "A partially completed new cycle must not become a payable monthly invoice");
});

test("first completed post-cutover period is collectible only from the following anniversary", () => {
  const server = serverAt("2026-12-21"), t = tenant("2026-11-21");
  const previous = server.__previousPeriod("monthly", t);
  assert.deepEqual([previous.startDate, previous.endDate], ["2026-11-21", "2026-12-20"]);
  const daily = server.__previousPeriod("daily", t);
  assert.equal(daily.startDate, "2026-12-20",
    "Legacy daily share collection remains daily even after threshold reset");
});
