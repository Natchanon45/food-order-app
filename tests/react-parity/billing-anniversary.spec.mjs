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

test("Revenue report, payable slip and scheduled reconciliation use same anchor", () => {
  assert.match(revenueServer, /const anchor = tenantAnchorDate\(tenant\)/);
  assert.match(revenueServer, /cycleFromMonth\(anchor, month\)/);
  assert.match(revenueServer, /cycleForDate\(anniversary, currentDate\)/);
  assert.match(revenueServer, /setting\.deliveryThreshold, anniversary/);
  assert.match(revenueServer, /previousCompletedCycle\(anchor, today\)/);
  assert.match(revenueServer, /const due = previousPeriod\(setting\.billingCycle, tenant\)/);
  assert.match(revenueServer, /periodFromData\(request\.data \|\| \{\}, tenant\)/);
  assert.match(revenueServer, /anniversary_migration_pending/);
  assert.match(report, /monthlyDeliveryStartDate/);
  assert.match(report, /monthlyDeliveryEndDate/);
  assert.match(report, /Progress ยอด Delivery สะสมรอบบิลนี้/);
});
