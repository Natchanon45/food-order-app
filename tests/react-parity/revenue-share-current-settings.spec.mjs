import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const report = fs.readFileSync("react-app/src/pages/RevenueShareReportPage.jsx", "utf8");
const server = fs.readFileSync("functions/revenue-share.js", "utf8");
const css = fs.readFileSync("public/react/parity/css/revenue-share-report.css", "utf8");
const sourceCss = fs.readFileSync("react-app/public/parity/css/revenue-share-report.css", "utf8");

test("Revenue report reads central monthly, yearly, threshold and rate from authenticated access", () => {
  assert.match(server, /const pricing = await loadPricing\(getFirestore\(\)\)/);
  assert.match(server, /const membership = calculatePricing\(pricing\)/);
  assert.match(server, /premiumMonthlyPrice: membership\.monthly\.payable/);
  assert.match(server, /premiumAnnualPrice: membership\.annual\.payable/);
  assert.match(report, /access\?\.premiumMonthlyPrice/);
  assert.match(report, /access\?\.premiumAnnualPrice/);
  assert.match(report, /access\?\.deliveryThreshold/);
  assert.match(report, /access\?\.deliveryShareRate/);
  assert.match(report, /access\?\.centralDeliveryShare/);
});
test("Share calculation displays actual server figures, not hypothetical arithmetic or fabricated totals", () => {
  for (const field of ["deliveryShareBase", "deliveryShareAmount", "revenueShare", "platformAmountDue"]) {
    assert.ok(report.includes("money(summary." + field + ")"), field);
  }
  assert.match(report, /access\?\.legacyEnabled/);
  assert.match(report, /summary\.legacyShareAmount/);
  assert.match(report, /ค่าบริการ Premium แยกชำระ/);
  assert.match(report, /ไม่ย้อนหลังวันก่อนหน้า/);
  assert.doesNotMatch(report, /925\.00|1,635\.00|28,500\.00/);
});
test("Report shows POS and food sales independently from chargeable share, without expanding charges", () => {
  assert.match(server, /sharePosSales/);
  assert.match(server, /posSales \+= net/);
  assert.match(server, /if \(setting\.legacyEnabled && setting\.channels\.includeRetail\) sharePosSales \+= net/);
  assert.match(server, /shareOrderSales \+ sharePosSales/);
  assert.doesNotMatch(server, /setting\.enabled && !setting\.channels\.includeRetail\) return/);
  assert.match(server, /orderSales \+= foodSales/);
});

test("Report keeps the period picker, payment review/history, and keeps Wallet/Lalamove optional", () => {
  assert.match(report, /data-report-period=\{value\}/);
  assert.match(report, /<details className="report-extra">/);
  assert.match(report, /<section className="card report-wallet-card"/);
  assert.match(report, /<\/details>/);
  assert.match(report, /id="submitRevenueShareSlip"/);
  assert.match(report, /id="revenueSharePaymentHistory"/);
  assert.match(css, /\.report-rules-grid\{display:grid/);
  assert.equal(css, sourceCss, "built parity CSS must match canonical React source");
  assert.match(css, /@media\(max-width:620px\)/);
});
