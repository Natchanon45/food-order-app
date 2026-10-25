import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { formatBillingCycleRange, billingCycleFromTenant, resolveBillingCycleRange, firstTenantRegistrationDate } from "../../react-app/src/utils/billingCycleDisplay.js";
import { cycleForDate, tenantAnchorDate } from "../../functions/billing-anniversary.js";

const component = fs.readFileSync("react-app/src/pages/RevenueShareReportPage.jsx", "utf8");
const server = fs.readFileSync("functions/revenue-share.js", "utf8");

test("billing cycle shown in DD/MM/YYYY is tied to the signup anniversary, not calendar month", () => {
  assert.equal(formatBillingCycleRange("2026-10-03", "2026-11-02"), "03/10/2026 - 02/11/2026");
  assert.equal(formatBillingCycleRange("2026-12-30", "2027-01-29"), "30/12/2026 - 29/01/2027");
  assert.equal(formatBillingCycleRange("2026-02-30", "2026-03-29"), "");
  assert.equal(formatBillingCycleRange("", "2026-11-02"), "");
  assert.equal(formatBillingCycleRange("2026-11-03", "2026-11-02"), "");
});
test("existing approved dashboard layout stays untouched and reads server/tenant anniversary data", () => {
  assert.match(component, /resolveBillingCycleRange\(summary, tenant\)/);
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

test("old production callable without cycle dates falls back to tenant Firestore activation for DISPLAY ONLY", () => {
  const tenant = { createdAt: { seconds: Date.parse("2026-10-03T08:30:00+07:00") / 1000 } };
  assert.equal(resolveBillingCycleRange({ monthlyDeliverySales: 11500 }, tenant, new Date("2026-10-25T03:00:00+07:00")),
    "03/10/2026 - 02/11/2026");
  assert.equal(resolveBillingCycleRange(
    { monthlyDeliveryStartDate: "2026-09-03", monthlyDeliveryEndDate: "2026-10-02" },
    tenant, new Date("2026-10-25T03:00:00+07:00")), "03/09/2026 - 02/10/2026");
  assert.equal(resolveBillingCycleRange({}, {}, new Date("2026-10-25T03:00:00+07:00")), "");
  assert.equal(resolveBillingCycleRange({}, { createdAt: "invalid" }, new Date("2026-10-25T03:00:00+07:00")), "");
  assert.equal(resolveBillingCycleRange({}, { createdAt: "2026-11-03T00:00:00+07:00" },
    new Date("2026-10-25T03:00:00+07:00")), "");
});

test("browser display-only fallback exactly matches canonical server cycles and anchor priority", () => {
  const cases = [
    ["2026-10-03T08:30:00+07:00", "2026-10-25T03:00:00+07:00"],
    ["2026-10-03T08:30:00+07:00", "2026-11-03T00:15:00+07:00"],
    ["2026-01-31T10:00:00+07:00", "2026-02-28T09:00:00+07:00"],
    ["2026-01-31T10:00:00+07:00", "2026-03-01T09:00:00+07:00"],
    ["2024-02-29T10:00:00+07:00", "2025-03-01T09:00:00+07:00"],
    ["2026-12-22T10:00:00+07:00", "2027-01-07T09:00:00+07:00"],
  ];
  const bangkokDay = date => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(date)).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
  for (const [start, now] of cases) {
    const tenant = { billingCycleAnchorAt: start, createdAt: "2020-01-01T00:00:00+07:00" };
    const canonical = cycleForDate(tenantAnchorDate(tenant), bangkokDay(now));
    assert.deepEqual(billingCycleFromTenant(tenant, new Date(now)),
      { startDate: canonical.startDate, endDate: canonical.endDate });
  }
  const priority = { billingCycleAnchorAt: "2026-10-03T00:00:00+07:00",
    createdAt: "2026-10-10T00:00:00+07:00" };
  assert.equal(resolveBillingCycleRange({}, priority, new Date("2026-10-25T12:00:00+07:00")),
    "03/10/2026 - 02/11/2026");
});

test("first-registration label reflects Firestore tenant.createdAt, not billing anniversary or latest activation", () => {
  const tenant = {
    createdAt: { seconds: Date.parse("2026-10-03T23:40:00+07:00") / 1000 },
    billingCycleAnchorAt: "2026-10-22T08:00:00+07:00",
    trialStartsAt: "2026-10-25T08:00:00+07:00",
    activatedAt: "2026-11-01T08:00:00+07:00",
    subscriptionStartedAt: "2026-11-20T08:00:00+07:00",
  };
  assert.equal(firstTenantRegistrationDate(tenant), "03/10/2026");
  assert.equal(resolveBillingCycleRange({}, tenant, new Date("2026-10-25T12:00:00+07:00")),
    "22/10/2026 - 21/11/2026", "billing cycle remains independent");
  assert.equal(firstTenantRegistrationDate({
    createdAt: { toDate: () => new Date("2026-10-03T23:40:00+07:00") },
  }), "03/10/2026");
  assert.equal(firstTenantRegistrationDate({
    createdAt: "2026-10-03T20:30:00Z",
  }), "04/10/2026", "registration timezone must be Asia/Bangkok");
  assert.equal(firstTenantRegistrationDate({ createdAt: "2026-02-30" }), "");
  assert.equal(firstTenantRegistrationDate({ createdAt: "not-a-date" }), "");
  assert.equal(firstTenantRegistrationDate({ billingCycleAnchorAt: "2026-10-03T08:00:00+07:00" }), "",
    "do not mislabel an invoice cycle as first registration for legacy tenants");
  assert.equal(firstTenantRegistrationDate(null), "");
});

test("registration is displayed directly under current billing period without changing report layout", () => {
  assert.ok(component.includes("const firstRegisteredDate = firstTenantRegistrationDate(tenant);"));
  assert.ok(component.includes('id="revenueShareFirstRegistered"'));
  assert.ok(component.includes("วันที่สมัคร/เปิดใช้งานครั้งแรก"));
  assert.ok(component.includes('firstRegisteredDate || rc("ไม่มีข้อมูล"'));
  const rangePos = component.indexOf('id="revenueShareBillingPeriod"');
  const signupPos = component.indexOf('id="revenueShareFirstRegistered"');
  assert.ok(rangePos > 0 && signupPos > rangePos);
  assert.ok(component.includes('id="reportPeriodTitle"'));
});
