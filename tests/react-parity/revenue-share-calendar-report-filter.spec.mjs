import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { calendarMonthRange, reportingQuery, monthlyReportLabel, formatReportDateRange }
  from "../../react-app/src/utils/revenueReportPeriod.mjs";

test("monthly October filter is 01/10/2026 - 31/10/2026, not tenant anniversary", () => {
  const selected = { period: "monthly", month: "2026-10" };
  assert.deepEqual(reportingQuery(selected), {
    period: "custom", startDate: "2026-10-01", endDate: "2026-10-31",
  });
  assert.equal(monthlyReportLabel(selected.month), "01/10/2026 - 31/10/2026");
  assert.deepEqual(selected, {period: "monthly", month: "2026-10"}, "invoice request must not be mutated");
});

test("monthly filters respect leap years, short months and year rollover", () => {
  for (const [month, expectedEnd] of [
    ["2024-02", "2024-02-29"], ["2026-02", "2026-02-28"],
    ["2026-04", "2026-04-30"], ["2026-12", "2026-12-31"],
    ["2027-01", "2027-01-31"],
  ]) {
    const range = calendarMonthRange(month);
    assert.equal(range.startDate, month + "-01");
    assert.equal(range.endDate, expectedEnd);
  }
  assert.equal(monthlyReportLabel("2024-02"), "01/02/2024 - 29/02/2024");
});

test("daily, yearly and custom filters preserve actual requested period", () => {
  for (const filter of [
    {period:"daily",date:"2026-10-31"},
    {period:"yearly",year:2026},
    {period:"custom",startDate:"2026-10-21",endDate:"2026-11-20"},
  ]) assert.equal(reportingQuery(filter),filter);
  assert.equal(formatReportDateRange("2026-10-21","2026-11-20"),"21/10/2026 - 20/11/2026");
});

test("reject invalid calendar month, invalid dates and reversed periods", () => {
  for (const month of ["2026-00","2026-13","2026-1","2026-02-03","0000-01","2026-XX",null]) {
    assert.equal(calendarMonthRange(month),null);
    assert.equal(monthlyReportLabel(month),"");
  }
  for (const [a,b] of [["2026-02-30","2026-03-31"],["2026-11-20","2026-10-21"]]) {
    assert.equal(formatReportDateRange(a,b),"");
  }
});

test("page derives summary via calendar query but payment uses original billing payload", () => {
  const src = fs.readFileSync("react-app/src/pages/RevenueShareReportPage.jsx","utf8");
  assert.match(src,/getRevenueShareReport\(reportingQuery\(periodPayload\)\)/);
  assert.match(src,/initializedFilterTenantRef\.current !== String\(tenant\?\.id \|\| ""\)/,
    "Refresh must not reset the selected report filter to the billing default");
  assert.match(src,/REVENUE_SHARE_BILLING_SUMMARY_FAILED/,
    "Failure to load separate billing data must not hide the calendar report");
  assert.match(src,/needsBillingSummary\s*\? getRevenueShareReport\(periodPayload\)\.catch\(billingError/);
  assert.match(src,/submitRevenueSharePayment\(tenant\.id, periodPayload, slip\)/);
  assert.match(src,/const paymentSharePayable = cycleMatches && period === "monthly"/);
  assert.match(src,/paymentPeriodLabel.*report\.billingPeriod/);
  assert.match(src,/const periodLabel = period === "monthly" \? monthlyReportLabel\(month\)/);
  assert.match(src,/id="reportPeriodLabel"/);
  assert.match(src,/id="paymentAmountDue">\{money\(paymentSharePayable\)\}/);
  assert.doesNotMatch(src,/period === "monthly" && report\.period\?\.label/);
});
