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
const tenant = (billingMode = "subscription") => ({
  billingMode, businessType: "both",
  createdAt: "2026-06-21T00:00:00+07:00",
  // No billingAnniversaryEffectiveAt or legacy migration flag is necessary.
});

test("all existing stores use their anniversary months even without cutover flags", async () => {
  const server = serverAt("2026-11-20", [
    paid("2026-11-01", 6000), paid("2026-11-10", 4000), paid("2026-11-20", 1000),
  ]);
  const t = tenant(), s = server.__revenueSetting(t, pricing);
  assert.equal(s.billingAnchorDate, "2026-06-21");
  const p = server.__periodFromData({ period: "monthly", month: "2026-10" }, t);
  assert.deepEqual([p.startDate, p.endDate], ["2026-10-21", "2026-11-20"]);
  const sum = await server.__summaryForTenant("store", p, s);
  assert.equal(sum.monthlyDeliveryStartDate, "2026-10-21");
  assert.equal(sum.monthlyDeliveryEndDate, "2026-11-20");
  assert.equal(sum.monthlyDeliverySales, 11000);
  assert.equal(sum.revenueShare, 250);
});

test("next store anniversary resets the threshold regardless of its previous billing mode", async () => {
  const rows = [
    paid("2026-11-01", 6000), paid("2026-11-10", 4000), paid("2026-11-20", 1000),
    paid("2026-11-21", 6000), paid("2026-11-22", 4000),
  ];
  const server = serverAt("2026-11-22", rows);
  for (const mode of ["subscription", "", "revenue_share"]) {
    const t = tenant(mode);
    const p = server.__periodFromData({ period: "monthly", month: "2026-11" }, t);
    assert.deepEqual([p.startDate, p.endDate], ["2026-11-21", "2026-12-20"]);
    const sum = await server.__summaryForTenant("store", p, server.__revenueSetting(t, pricing));
    assert.equal(sum.monthlyDeliveryStartDate, "2026-11-21");
    assert.equal(sum.monthlyDeliveryEndDate, "2026-12-20");
    assert.equal(sum.monthlyDeliverySales, 10000);
    // Only paid qualifying Delivery merchandise enters the new period.
    assert.equal(sum.deliveryShareBase, 4000);
  }
});

test("first completed anniversary cycle is collectible at the following anniversary", () => {
  const before = serverAt("2026-07-20");
  assert.equal(before.__previousPeriod("monthly", tenant()), null);
  const server = serverAt("2026-12-21");
  const previous = server.__previousPeriod("monthly", tenant());
  assert.deepEqual([previous.startDate, previous.endDate], ["2026-11-21", "2026-12-20"]);
  assert.equal(server.__previousPeriod("daily", tenant()).startDate, "2026-12-20");
});

test("missing store activation fails closed, never fabricates a monthly invoice", async () => {
  const server = serverAt("2026-11-22", [paid("2026-11-22", 15000)]);
  const noAnchor = { billingMode: "subscription", businessType: "both" };
  assert.throws(() => server.__periodFromData({ period: "monthly", month: "2026-11" }, noAnchor),
    /failed-precondition/);
  assert.equal(server.__previousPeriod("monthly", noAnchor), null);
  const s = server.__revenueSetting(noAnchor, pricing);
  const p = server.__periodFromData({ period: "daily", date: "2026-11-22" }, noAnchor);
  assert.equal((await server.__summaryForTenant("store", p, s)).revenueShare, 0);
});
