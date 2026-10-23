import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { tenantAnchorDate, cycleForDate } = require("../../functions/billing-anniversary.js");
const { eligibleDeliveryShareDays } = require("../../functions/revenue-share-policy.js");

const reportServer = fs.readFileSync("functions/revenue-share.js", "utf8");
const previewServer = fs.readFileSync("functions/hybrid-billing-preview.js", "utf8");
const signup = fs.readFileSync("functions/public-signup.js", "utf8");
const home = fs.readFileSync("react-app/src/pages/HomePage.jsx", "utf8");
const previewPage = fs.readFileSync("react-app/src/pages/HybridBillingReportPage.jsx", "utf8");
const hybridSettings = fs.readFileSync("functions/hybrid-billing-settings.js", "utf8");

test("all three prelaunch stores get anniversary cycles without migration flags", () => {
  const rows = [
    { label: "SHOP_1", createdAt: "2026-06-21T00:00:00+07:00",
      start: "2026-10-21", end: "2026-11-20" },
    { label: "SHOP_2", trialStartsAt: "2026-07-04T00:00:00+07:00",
      start: "2026-10-04", end: "2026-11-03", billingMode: "" },
    { label: "SHOP_3", createdAt: "2026-06-22T00:00:00+07:00",
      start: "2026-10-22", end: "2026-11-21", billingMode: "" },
  ];
  for (const row of rows) {
    const anchor = tenantAnchorDate(row);
    const cycle = cycleForDate(anchor, "2026-10-23");
    assert.deepEqual([cycle.startDate, cycle.endDate], [row.start, row.end], row.label);
  }
});

test("revenue report and scheduled monthly period never require Cutover fields", () => {
  assert.doesNotMatch(reportServer, /billingAnniversaryEffectiveAt|tenantAnniversaryEffectiveDate|cutoverDate/);
  assert.match(reportServer, /if \(month >= anchor\.slice\(0, 7\)\) return \{ type: period, \.\.\.cycleFromMonth\(anchor, month\) \}/);
  assert.match(reportServer, /const activeCycle = anniversary \? cycleForDate\(anniversary, currentDate\) : null/);
  assert.match(reportServer, /const previous = previousCompletedCycle\(anchor, today\)/);
  assert.match(reportServer, /if \(!anchor\) return null/);
  assert.doesNotMatch(signup, /billingAnniversaryEffectiveAt/);
  assert.match(signup, /billingCycleAnchorAt: now/);
});

test("all legacy tenant billing modes have one shared qualifying Delivery threshold", () => {
  const amounts = [
    { date: "2026-10-31", cents: 600000 },
    { date: "2026-11-01", cents: 400000 },
    { date: "2026-11-04", cents: 100000 },
  ];
  const days = eligibleDeliveryShareDays(amounts, 10000, "2026-10-22");
  assert.deepEqual([...days], ["2026-11-01", "2026-11-04"]);
  assert.match(reportServer, /const premiumDeliveryShare = centralDeliveryShare && !legacyChannels\.enabled/);
  assert.doesNotMatch(reportServer, /tenant\.billingMode === "subscription";/);
  assert.match(reportServer, /: new Set\(\); \/\/ Missing activation date must never create an invoice/);
});

test("Hybrid read-only preview is visible to every anchored tenant without converting master data", () => {
  assert.doesNotMatch(previewServer, /snap\.data\(\)\?\.billingPolicyVersion !== "hybrid_v1"/);
  assert.match(previewServer, /if \(!tenantAnchorDate\(snap\.data\(\)\)\)/);
  assert.match(previewServer, /firstMonth: month === anchor\.slice\(0, 7\)/);
  assert.match(previewServer, /const minMonth = tenantAnchorDate\(tenant\)\?\.slice\(0, 7\)/);
  assert.match(home, /\{tenant \? \(/);
  assert.doesNotMatch(previewPage, /tenant\?\.billingPolicyVersion !== "hybrid_v1"/);
  assert.match(previewPage, /tenantAnniversaryMonth\(tenant\)/);
  assert.doesNotMatch(previewServer, /(?:\.set\(|\.update\(|\.delete\(|runTransaction\()/);
});

test("real Hybrid registration and billing remain fail-closed until trusted payment engine is complete", () => {
  assert.match(hybridSettings, /HYBRID_REGISTRATION_READY = false/);
  assert.match(previewPage, /hybrid_report\.preview_only/);
  assert.match(previewPage, /hybrid_report\.not_invoice/);
});
