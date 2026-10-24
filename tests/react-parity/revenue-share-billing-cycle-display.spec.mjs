import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { formatBillingCycleRange } from "../../react-app/src/utils/billingCycleDisplay.js";

const component = fs.readFileSync("react-app/src/pages/RevenueShareReportPage.jsx", "utf8");
const server = fs.readFileSync("functions/revenue-share.js", "utf8");

test("billing cycle shown in DD/MM/YYYY is tied to the signup anniversary, not calendar month", () => {
  assert.equal(formatBillingCycleRange("2026-10-03", "2026-11-02"), "3/10/2026 - 2/11/2026");
  assert.equal(formatBillingCycleRange("2026-12-30", "2027-01-29"), "30/12/2026 - 29/1/2027");
  assert.equal(formatBillingCycleRange("2026-02-30", "2026-03-29"), "");
  assert.equal(formatBillingCycleRange("", "2026-11-02"), "");
  assert.equal(formatBillingCycleRange("2026-11-03", "2026-11-02"), "");
});
test("existing approved dashboard layout stays untouched and new label reads only server cycle fields", () => {
  assert.match(component, /formatBillingCycleRange\(\s*summary\.monthlyDeliveryStartDate, summary\.monthlyDeliveryEndDate/);
  assert.match(component, /id="revenueShareBillingPeriod"/);
  assert.match(component, /รอบคิดค่าบริการปัจจุบัน/);
  assert.match(component, /const monthLabel = billingCycleRange/);
  assert.match(server, /monthlyDeliveryStartDate: cycleStart, monthlyDeliveryEndDate: cycleEnd/);
  assert.match(server, /const activeCycle = anniversary \? cycleForDate\(anniversary, currentDate\) : null/);
  for (const section of ["revenue-share-hero", "report-filter-card", "report-channel-overview",
    "report-month-progress", "report-share-math", "report-related-amounts",
    "report-payment-card", "report-extra", "report-history-disclosure"]) {
    assert.ok(component.includes(section), section);
  }
  assert.match(component, /บาทแรกของรอบบิลได้รับยกเว้น/);
  assert.doesNotMatch(component, /threshold is a trigger, not a deduction/);
});
