import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { calculateCycle, billingCycle, billingCycleById, anchorAtMonth,
  normalizeSettings, overdueInvoices, dateKey } = require("../../functions/hybrid-billing-core.js");

const S = { monthlyFee: 590, deliveryThreshold: 10000, deliveryShareRate: 5, monthlySlipQuota: 100 };
const calc = (days, cycleId = "2026-10-16", signupDate = "2026-10-16", settings = S) =>
  calculateCycle({ signupDate, cycleId, dailyDeliverySales: days, settings });
const item = (date, amount) => ({ date, amount });

test("signup 16 Oct resets exactly 16 Nov and continues on 16 Dec", () => {
  assert.deepEqual([billingCycle("2026-10-16", "2026-11-15").id,
    billingCycle("2026-10-16", "2026-11-16").id,
    billingCycle("2026-10-16", "2026-12-16").id],
  ["2026-10-16", "2026-11-16", "2026-12-16"]);
  const first = billingCycle("2026-10-16", "2026-10-19");
  assert.equal(first.endDate, "2026-11-16");
  assert.equal(first.lastDate, "2026-11-15");
  assert.equal(first.firstCycle, true);
  assert.equal(billingCycle("2026-10-16", "2026-11-16").firstCycle, false);
});

test("31st signup anchors short months but never drifts after February; leap years too", () => {
  assert.equal(anchorAtMonth("2027-01-31", 1), "2027-02-28");
  assert.equal(anchorAtMonth("2027-01-31", 2), "2027-03-31");
  assert.equal(anchorAtMonth("2028-01-31", 1), "2028-02-29");
  assert.equal(anchorAtMonth("2026-08-31", 1), "2026-09-30");
  assert.equal(anchorAtMonth("2026-12-31", 1), "2027-01-31");
  assert.equal(billingCycle("2027-01-31", "2027-02-27").id, "2027-01-31");
  assert.equal(billingCycle("2027-01-31", "2027-02-28").id, "2027-02-28");
  assert.equal(billingCycle("2027-01-31", "2027-03-31").id, "2027-03-31");
  assert.throws(() => billingCycleById("2026-10-16", "2026-11-01"));
});

test("first signup cycle waives the fixed fee but not earned Delivery share", () => {
  const result = calc([item("2026-11-15", 9000)]);
  assert.equal(result.mode, "trial_free");
  assert.equal(result.totalFee, 0);
  assert.equal(result.slipQuota, 100);
  assert.equal(calc([item("2026-10-20", 15500)]).totalFee, 775);
});

test("second cycle below threshold pays fixed fee at anniversary close", () => {
  const result = calc([item("2026-11-20", 9999)], "2026-11-16");
  assert.equal(result.mode, "fixed_monthly");
  assert.equal(result.totalFee, 590);
  assert.deepEqual(result.invoices.map(x => x.id), ["2026-11-16:monthly:fixed"]);
  assert.equal(result.invoices[0].date, "2026-12-15");
  assert.equal(result.invoices[0].suspendFrom, "2026-12-16");
  assert.equal(result.invoices[0].issueAtCycleClose, true);
});

test("9am threshold followed by late orders: charge whole closed day 15500 x 5% = 775", () => {
  const result = calc([item("2026-10-20", 10000), item("2026-10-20", 5500)]);
  assert.equal(result.triggerDate, "2026-10-20");
  assert.equal(result.invoices[0].calculationBase, 15500);
  assert.equal(result.totalFee, 775);
  assert.equal(result.invoices.length, 1);
});

test("crossing threshold using prior days charges entire trigger DAY, not accumulated sales", () => {
  const result = calc([item("2026-10-17", 9000), item("2026-10-20", 4000)]);
  assert.equal(result.totalDeliverySales, 13000);
  assert.equal(result.totalFee, 200);
  assert.equal(result.invoices[0].calculationBase, 4000);
  assert.equal(result.invoices[0].date, "2026-10-20");
});

test("following days bill their own new paid Delivery, no re-bill of trigger day", () => {
  const result = calc([item("2026-10-17", 9000), item("2026-10-20", 4000),
    item("2026-10-21", 2000), item("2026-10-22", 3000)]);
  assert.equal(result.totalFee, 450);
  assert.deepEqual(result.invoices.map(x => x.amount), [200, 100, 150]);
  assert.equal(result.fixedFee, 0);
});

test("no Delivery sale on a day means no daily invoice", () => {
  assert.equal(calc([item("2026-10-20", 10000), item("2026-10-21", 0)]).invoices.length, 1);
});

test("admin-configurable settings change trigger day fee and fixed fee", () => {
  const settings = { monthlyFee: 799, deliveryThreshold: 15000, deliveryShareRate: 3, monthlySlipQuota: 80 };
  assert.equal(calc([item("2026-11-17", 14000)], "2026-11-16", "2026-10-16", settings).totalFee, 799);
  assert.equal(calc([item("2026-11-17", 16000)], "2026-11-16", "2026-10-16", settings).totalFee, 480);
  assert.equal(calc([], "2026-10-16", "2026-10-16", settings).slipQuota, 80);
});

test("reset 16 Nov clears threshold/slipUnlimited but not past due invoices", () => {
  const old = calc([item("2026-11-15", 15500)]);
  const fresh = calc([item("2026-11-16", 1000)], "2026-11-16");
  assert.equal(old.slipUnlimited, true);
  assert.equal(fresh.slipUnlimited, false);
  assert.equal(fresh.mode, "fixed_monthly");
  assert.equal(overdueInvoices({ invoices: old.invoices, onDate: "2026-11-17" }).length, 1);
});

test("anniversary boundary excludes next cycle's 16 Nov orders", () => {
  assert.throws(() => calc([item("2026-11-16", 1)]), /outside cycle/);
  assert.throws(() => calc([item("2026-10-15", 1)]), /outside cycle/);
  assert.equal(calc([item("2026-11-16", 1)], "2026-11-16").totalDeliverySales, 1);
});

test("overdue triggered invoice suspends next Bangkok day; confirmed payments unblock", () => {
  const invoices = calc([item("2026-10-20", 15500)]).invoices;
  assert.equal(overdueInvoices({ invoices, onDate: "2026-10-20" }).length, 0);
  assert.equal(overdueInvoices({ invoices, onDate: "2026-10-21" }).length, 1);
  assert.equal(overdueInvoices({ invoices, onDate: "2026-10-21", paidIds: [invoices[0].id] }).length, 0);
});

test("Bangkok timezone groups timestamps correctly", () => {
  assert.equal(dateKey("2026-10-31T18:00:00.000Z"), "2026-11-01");
  assert.equal(dateKey("2026-11-15T16:59:59.000Z"), "2026-11-15");
  assert.equal(dateKey("2026-11-15T17:00:00.000Z"), "2026-11-16");
});
test("reject invalid money, bad day, malformed cycle and impossible dates", () => {
  assert.throws(() => normalizeSettings({ deliveryThreshold: 0 }));
  assert.throws(() => normalizeSettings({ deliveryShareRate: 101 }));
  assert.throws(() => normalizeSettings({ monthlySlipQuota: 2.5 }));
  assert.throws(() => calc([item("2026-10-20", -1)]));
  assert.throws(() => calc([item("2026-10-20", 1.123)]));
  assert.throws(() => calc([item("2026-10-33", 5)]));
  assert.throws(() => billingCycle("2026-10-16", "2026-10-15"));
});
test("registration selects policy server-side, preserves original signup date, and remains disabled", () => {
  const page = fs.readFileSync("react-app/src/pages/RegisterPage.jsx", "utf8");
  const signup = fs.readFileSync("functions/public-signup.js", "utf8");
  assert.ok(page.includes("loadPublicHybridBillingSettings"));
  assert.ok(page.includes("hybrid-signup-grid"));
  assert.ok(!page.includes('name="billingMode"'));
  assert.ok(!page.includes('name="planCode"'));
  assert.ok(!page.includes('billingMode,'));
  assert.ok(signup.includes('billingMode: "hybrid"'));
  assert.ok(signup.includes('billingPolicyVersion: "hybrid_v1"'));
  assert.ok(signup.includes("hybridBillingEnabled: false"));
  assert.ok(signup.includes("hybridBillingStartDate"));
  assert.ok(signup.includes("pendingSignupSnap.data()?.hybridBillingStartDate || requestSignupDate"));
});
test("pricing editor and five locale texts expose four editable values", () => {
  const page = fs.readFileSync("react-app/src/pages/PlatformPricingPage.jsx", "utf8");
  for (const key of ["monthlyFee", "deliveryThreshold", "deliveryShareRate", "monthlySlipQuota"]) assert.ok(page.includes(key));
  const dictionaries = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json", "utf8"));
  for (const locale of ["th", "en", "my", "lo", "km"]) {
    assert.ok(dictionaries[locale]?.auth?.register?.hybrid?.share_detail);
    assert.ok(dictionaries[locale]?.hybrid_report?.cycle_range);
  }
});
test("legacy schedulers and pricing controls cannot alter Hybrid tenants", () => {
  const backend = fs.readFileSync("functions/subscription-admin.js", "utf8");
  const guard = fs.readFileSync("functions/hybrid-billing-legacy-access-guard.js", "utf8");
  assert.equal((backend.match(/await writeLegacySubscription\(db, /g) || []).length, 4);
  assert.match(backend, /require\("\.\/hybrid-billing-legacy-access-guard"\)/);
  assert.match(guard, /legacyDeliveryPaidWriterAllowed\(tenant\)/);
  assert.match(guard, /tx\.get\(tenantRef\)/);
  for (const filename of ["functions/subscription-admin.js", "functions/revenue-share.js"]) {
    const source = fs.readFileSync(filename, "utf8");
    assert.match(source, /Hybrid tenants cannot use legacy|HYBRID_LEGACY_ACCESS/);
  }
});
