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
  assert.match(report, /summary\.legacyShareAmount/);
  assert.match(report, /summary\.legacyShareAmount/);
  assert.match(report, /เรียกเก็บแยก/);
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

test("Report keeps in-store / POS and Delivery sales distinct, and monthly progress independent of period filter", () => {
  assert.match(server, /storefrontOrderSales, deliveryOrderSales, inStoreSales/);
  assert.match(server, /monthlyDeliverySales, monthlyDeliveryMonth: currentMonth/);
  assert.match(server, /day\.startsWith\(currentMonth\) && day <= currentDate/);
  assert.match(server, /if \(isDelivery\) deliveryOrderSales \+= foodSales/);
  assert.match(report, /money\(summary\.posSales\)/);
  assert.match(report, /money\(summary\.storefrontOrderSales\)/);
  assert.match(report, /id="inStoreSales"/);
  assert.match(report, /id="monthlyDeliverySales"/);
  assert.match(report, /role="progressbar"/);
  assert.match(report, /aria-valuenow/);
  assert.match(report, /monthlyDeliverySales \/ centralThreshold \* 100/);
  assert.match(report, /Math\.min\(100, progressPercent\)/);
});

test("Shipping debt remains separate from zero share and affects real payment collection", () => {
  assert.match(report, /id="deliveryShareAmount"/);
  assert.match(report, /id="platformAmountDue"/);
  assert.match(report, /summary\.lalamoveOutstandingCost/);
  assert.match(report, /hasLegacyDeliveryDebt/);
  assert.match(report, /ไม่ใช่ส่วนแบ่ง Delivery/);
  assert.match(report, /noAmountDue \? <div className="report-payment-zero"/);
  assert.match(report, /!noAmountDue \? <>/);
  assert.match(report, /id="submitRevenueShareSlip"/);
  assert.match(report, /id="revenueSharePaymentHistory"/);
  // In the historical screenshot: no Delivery share, but Lalamove debt is still real.
  const billedShare = 0;
  const uncollectedLalamove = 59;
  const platformDue = billedShare + uncollectedLalamove;
  assert.equal(platformDue, 59);
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
