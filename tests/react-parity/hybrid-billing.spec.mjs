import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { calculateMonth, normalizeSettings, overdueInvoices, dateKey } = require("../../functions/hybrid-billing-core.js");

const S = { monthlyFee: 590, deliveryThreshold: 10000, deliveryShareRate: 5, monthlySlipQuota: 100 };
const calc = (days, firstMonth = false, settings = S, month = "2026-10") =>
  calculateMonth({ month, firstMonth, dailyDeliverySales: days, settings });
const item = (date, amount) => ({ date, amount });

test("trial first calendar month has no fixed fee when below threshold", () => {
  const result = calc([item("2026-10-04", 9000)], true);
  assert.equal(result.mode, "trial_free");
  assert.equal(result.totalFee, 0);
  assert.equal(result.slipQuota, 100);
});
test("later month below threshold pays only monthly fixed fee at month close", () => {
  const result = calc([item("2026-10-31", 9999)], false);
  assert.equal(result.mode, "fixed_monthly");
  assert.equal(result.totalFee, 590);
  assert.deepEqual(result.invoices.map(x => x.id), ["2026-10:monthly:fixed"]);
  assert.equal(result.invoices[0].issueAtMonthClose, true);
});
test("exact threshold in first month triggers share and never fixed fee", () => {
  const result = calc([item("2026-10-05", 10000)], true);
  assert.equal(result.mode, "delivery_share");
  assert.equal(result.totalFee, 500);
  assert.equal(result.fixedFee, 0);
  assert.equal(result.slipUnlimited, true);
});
test("threshold-day overshoot bills only the ceiling", () => {
  const result = calc([item("2026-10-04", 9000), item("2026-10-20", 4000)]);
  assert.equal(result.totalDeliverySales, 13000);
  assert.equal(result.totalFee, 500);
  assert.equal(result.invoices[0].calculationBase, 10000);
  assert.equal(result.invoices[0].date, "2026-10-20");
});
test("following days charge only same-day Delivery and do not rebill overshoot", () => {
  const result = calc([item("2026-10-04", 9000), item("2026-10-20", 4000), item("2026-10-21", 2000), item("2026-10-22", 3000)]);
  assert.equal(result.totalFee, 750);
  assert.deepEqual(result.invoices.map(x => x.amount), [500, 100, 150]);
  assert.equal(result.fixedFee, 0);
});
test("multiple same-day sales are combined and only one invoice is issued", () => {
  const result = calc([item("2026-10-11", 7000), item("2026-10-11", 5000), item("2026-10-12", 500)]);
  assert.deepEqual(result.invoices.map(x => x.id), ["2026-10:delivery:trigger", "2026-10:delivery:2026-10-12"]);
  assert.equal(result.totalFee, 525);
});
test("zero-selling days issue no revenue-share invoices", () => {
  const result = calc([item("2026-10-04", 10000), item("2026-10-05", 0)]);
  assert.equal(result.invoices.length, 1);
});
test("custom admin values drive all threshold/rate/fixed/quota results", () => {
  const settings = { monthlyFee: 799, deliveryThreshold: 15000, deliveryShareRate: 3, monthlySlipQuota: 80 };
  assert.equal(calc([item("2026-10-04", 14000)], false, settings).totalFee, 799);
  assert.equal(calc([item("2026-10-04", 16000)], false, settings).totalFee, 450);
  assert.equal(calc([], false, settings).slipQuota, 80);
});
test("new billing month does not inherit previous threshold state", () => {
  assert.equal(calc([item("2026-10-04", 10000)]).mode, "delivery_share");
  assert.equal(calc([item("2026-11-01", 1000)], false, S, "2026-11").mode, "fixed_monthly");
});
test("unpaid invoices suspend from next calendar day, confirmed payments unblock", () => {
  const invoices = calc([item("2026-10-20", 10000)]).invoices;
  assert.equal(overdueInvoices({ invoices, onDate: "2026-10-20" }).length, 0);
  assert.equal(overdueInvoices({ invoices, onDate: "2026-10-21" }).length, 1);
  assert.equal(overdueInvoices({ invoices, onDate: "2026-10-21", paidIds: [invoices[0].id] }).length, 0);
});
test("Bangkok timezone groups timestamps correctly", () => {
  assert.equal(dateKey("2026-10-31T18:00:00.000Z"), "2026-11-01");
});
test("reject invalid/malicious money, overlarge quota and impossible dates", () => {
  assert.throws(() => normalizeSettings({ deliveryThreshold: 0 }));
  assert.throws(() => normalizeSettings({ deliveryShareRate: 101 }));
  assert.throws(() => normalizeSettings({ monthlySlipQuota: 2.5 }));
  assert.throws(() => calc([item("2026-10-05", -1)]));
  assert.throws(() => calc([item("2026-10-05", 1.123)]));
  assert.throws(() => calc([item("2026-10-33", 5)]));
  assert.throws(() => calc([item("2026-11-01", 1)]));
});
test("retired Hybrid signup is not exposed and existing billing choices are restored", () => {
  const page = fs.readFileSync("react-app/src/pages/RegisterPage.jsx", "utf8");
  const signup = fs.readFileSync("functions/public-signup.js", "utf8");
  assert.ok(page.includes("loadPublicSubscriptionPricing"));
  assert.ok(page.includes('name="billingMode"'));
  assert.ok(page.includes('name="restaurantRevenueShareScope"'));
  assert.ok(signup.includes("signupBillingSelectionValid"));
  assert.ok(signup.includes('["subscription", "revenue_share"]'));
  assert.ok(signup.includes('pending.billingPolicyVersion === "hybrid_v1"'));
  assert.doesNotMatch(page, /loadPublicHybridBillingSettings|hybrid-signup-grid/);
  assert.doesNotMatch(signup, /billingMode: "hybrid"|loadHybridBillingSettings|HYBRID_REGISTRATION_READY/);
});
test("subscription pricing does not load inactive Hybrid Billing settings", () => {
  const page = fs.readFileSync("react-app/src/pages/PlatformPricingPage.jsx", "utf8");
  assert.match(page, /id="pricingForm"/);
  assert.match(page, /saveAdminSubscriptionPricing\(config\)/);
  assert.doesNotMatch(page, /loadAdminHybridBillingSettings|saveAdminHybridBillingSettings|hybridBillingForm|hybridConfig/);
});
test("legacy subscription schedulers skip new hybrid tenants", () => {
  const backend = fs.readFileSync("functions/subscription-admin.js", "utf8");
  assert.equal((backend.match(/billingPolicyVersion === "hybrid_v1"/g) || []).length, 4);
});

test("legacy pricing controls cannot override future hybrid tenants", () => {
  for (const filename of ["functions/subscription-admin.js", "functions/revenue-share.js"]) {
    const source = fs.readFileSync(filename, "utf8");
    assert.match(source, /Hybrid tenants cannot use legacy/);
  }
});
