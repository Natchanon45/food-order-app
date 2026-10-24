import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  bangkokDateKey, tenantAnchorDate, anniversaryDate, cycleFromMonth,
  cycleForDate, previousCompletedCycle,
} = require("../../functions/billing-anniversary.js");
const { eligibleDeliveryShareDays } = require("../../functions/revenue-share-policy.js");
const { calculateCycle } = require("../../functions/hybrid-billing-core.js");
const { paidDeliveryByDay } = require("../../functions/hybrid-billing-orders.js");
const revenueServer = fs.readFileSync("functions/revenue-share.js", "utf8");
const report = fs.readFileSync("react-app/src/pages/RevenueShareReportPage.jsx", "utf8");

test("Bangkok activation day anchors every cycle: day 5, 8, 11, 15, 16 and 22", () => {
  for (const day of [5, 8, 11, 15, 16, 22]) {
    const anchor = "2026-10-" + String(day).padStart(2, "0");
    const a = cycleFromMonth(anchor, "2026-10");
    assert.equal(a.startDate, anchor);
    assert.equal(a.endExclusiveDate, "2026-11-" + String(day).padStart(2, "0"));
    assert.equal(cycleForDate(anchor, a.endDate).startDate, anchor);
    assert.equal(cycleForDate(anchor, a.endExclusiveDate).startDate, a.endExclusiveDate);
    assert.equal(previousCompletedCycle(anchor, a.endExclusiveDate).startDate, anchor);
    assert.equal(a.start.toISOString().slice(11, 16), "17:00", "Bangkok midnight is UTC-7h");
  }
});

test("29-31 day anchors clamp in short months without drift in later months", () => {
  const jan31 = "2026-01-31";
  assert.equal(cycleFromMonth(jan31, "2026-01").endExclusiveDate, "2026-02-28");
  assert.equal(cycleFromMonth(jan31, "2026-02").endExclusiveDate, "2026-03-31");
  assert.equal(cycleForDate(jan31, "2026-02-27").startDate, jan31);
  assert.equal(cycleForDate(jan31, "2026-02-28").startDate, "2026-02-28");
  const leap = "2024-01-31";
  assert.equal(cycleFromMonth(leap, "2024-01").endExclusiveDate, "2024-02-29");
  assert.equal(cycleFromMonth(leap, "2024-02").endExclusiveDate, "2024-03-31");
  assert.equal(anniversaryDate("2026-08-30", "2026-09"), "2026-09-30");
});

test("December 22 cycle crosses year boundary and resets only January 22", () => {
  const cycle = cycleFromMonth("2026-06-22", "2026-12");
  assert.equal(cycle.startDate, "2026-12-22");
  assert.equal(cycle.endDate, "2027-01-21");
  assert.equal(cycle.endExclusiveDate, "2027-01-22");
  assert.equal(cycleForDate("2026-06-22", "2027-01-21").startDate, "2026-12-22");
  assert.equal(cycleForDate("2026-06-22", "2027-01-22").startDate, "2027-01-22");
});

test("tenant signup uses trustworthy activation (createdAt), not unapproved signup date", () => {
  const t = { createdAt: { seconds: Date.parse("2026-10-22T20:30:00Z") / 1000 } };
  assert.equal(tenantAnchorDate(t), "2026-10-23", "server timestamp grouped by Bangkok date");
  assert.equal(tenantAnchorDate({ ...t, billingCycleAnchorAt: "2026-10-22T00:00:00+07:00" }), "2026-10-22");
  assert.equal(tenantAnchorDate({}), null, "old tenants without activation retain legacy calendar periods");
  assert.equal(bangkokDateKey(new Date("2026-10-21T17:00:00Z")), "2026-10-22");
});

test("Delivery threshold accumulation crosses calendar month but resets at tenant anniversary", () => {
  const anchor = "2026-10-22";
  const values = [
    ["2026-10-23", 400000],
    ["2026-10-31", 400000],
    ["2026-11-01", 250000],
    ["2026-11-21", 50000],
    ["2026-11-22", 100000],
    ["2026-11-23", 900000],
  ].map(([date, cents]) => ({ date, cents }));
  const days = eligibleDeliveryShareDays(values, 10000, anchor);
  assert.deepEqual([...days], ["2026-11-01", "2026-11-21", "2026-11-23"]);
  // No Delivery sale before store activation may help reach a threshold.
  const predates = [{ date: "2026-10-21", cents: 950000 }, { date: "2026-10-23", cents: 100000 }];
  assert.equal(eligibleDeliveryShareDays(predates, 10000, anchor).size, 0);
});

test("All stores use signup anniversary, without billing-mode or migration flags", () => {
  assert.match(revenueServer, /const anchor = tenantAnchorDate\(tenant\)/);
  assert.match(revenueServer, /cycleFromMonth\(anchor, month\)/);
  assert.match(revenueServer, /cycleForDate\(anniversary, currentDate\)/);
  assert.match(revenueServer, /setting\.deliveryThreshold, anniversary/);
  assert.match(revenueServer, /previousCompletedCycle\(anchor, today\)/);
  assert.match(revenueServer, /const due = previousPeriod\(setting\.billingCycle, tenant\)/);
  assert.match(revenueServer, /periodFromData\(request\.data \|\| \{\}, tenant\)/);
  assert.match(revenueServer, /if \(!anchor\) return null/);
  assert.doesNotMatch(revenueServer, /billingAnniversaryEffectiveAt|anniversary_migration_pending|cutoverDate/);
  assert.match(report, /resolveBillingCycleRange\(summary, tenant\)/);
  const cycleDisplay = fs.readFileSync("react-app/src/utils/billingCycleDisplay.js", "utf8");
  assert.match(cycleDisplay, /monthlyDeliveryStartDate/);
  assert.match(cycleDisplay, /monthlyDeliveryEndDate/);
  assert.match(report, /Progress ยอด Delivery สะสมรอบบิลนี้/);
});

test("Hybrid projected trigger spans calendar months but its threshold restarts on renewal", () => {
  const cycle = cycleFromMonth("2026-10-22", "2026-10");
  const result = calculateCycle({
    month: cycle.month, cycleStartDate: cycle.startDate,
    cycleEndExclusiveDate: cycle.endExclusiveDate,
    firstMonth: true, dailyDeliverySales: [
      { date: "2026-10-31", amount: 6000 },
      { date: "2026-11-01", amount: 5000 },
      { date: "2026-11-02", amount: 1000 },
    ],
  });
  assert.equal(result.triggerDate, "2026-11-01");
  assert.equal(result.cycleStartDate, "2026-10-22");
  assert.equal(result.cycleEndDate, "2026-11-21");
  assert.deepEqual(result.invoices.map(row => row.amount), [50, 50]);
  assert.equal(result.totalFee, 100);
  const renewal = cycleFromMonth("2026-10-22", "2026-11");
  const next = calculateCycle({
    cycleStartDate: renewal.startDate, cycleEndExclusiveDate: renewal.endExclusiveDate,
    dailyDeliverySales: [{ date: "2026-11-22", amount: 1000 }],
  });
  assert.equal(next.mode, "fixed_monthly");
  assert.equal(next.invoices[0].date, "2026-12-21");
  assert.equal(next.invoices[0].id, "2026-11-22:monthly:fixed");
});

test("Hybrid paid order projection filters by anniversary boundaries without client date tampering", () => {
  const mk = (iso, amount) => ({
    orderType: "delivery", paymentStatus: "paid", status: "delivered",
    paidAt: { toDate: () => new Date(iso) },
    totalAmount: amount + 40, deliveryFee: 40, subtotalAmount: amount,
  });
  const rows = [
    mk("2026-10-21T16:59:59Z", 1000), // just before 22nd Bangkok midnight
    mk("2026-10-21T17:00:00Z", 4000), // 22nd Bangkok midnight
    mk("2026-11-21T16:59:59Z", 6000), // 21st Bangkok
    mk("2026-11-21T17:00:00Z", 9000), // next cycle
  ];
  const daily = paidDeliveryByDay(rows, {
    startDate: "2026-10-22", endExclusiveDate: "2026-11-22",
  });
  assert.deepEqual(daily, [
    { date: "2026-10-22", amount: 4000 },
    { date: "2026-11-21", amount: 6000 },
  ]);
});

test("All active shops reset on their own renewal dates with no cutover approval", () => {
  const daily = [
    ["2026-11-01", 600000], ["2026-11-10", 400000],
    ["2026-11-20", 50000], ["2026-11-21", 600000],
    ["2026-11-22", 400000], ["2026-12-01", 10000],
    ["2026-12-21", 1000000],
  ].map(([date, cents]) => ({ date, cents }));
  const actual = eligibleDeliveryShareDays(daily, 10000, "2026-06-21");
  assert.deepEqual([...actual], [
    "2026-11-10", "2026-11-20", "2026-11-22",
    "2026-12-01", "2026-12-21",
  ]);
});

test("Missing activation cannot silently generate paid Delivery share", () => {
  const daily = [
    { date: "2026-10-31", cents: 800000 },
    { date: "2026-11-01", cents: 200000 },
  ];
  assert.deepEqual([...eligibleDeliveryShareDays(daily, 10000)], []);
  assert.match(revenueServer, /: new Set\(\); \/\/ Missing activation date must never create an invoice/);
});
