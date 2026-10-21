import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { _test } = require("../../functions/hybrid-billing-ledger.js");
const source = fs.readFileSync("functions/hybrid-billing-ledger.js", "utf8");
const index = fs.readFileSync("functions/index.js", "utf8");
const rules = fs.readFileSync("storage.rules", "utf8");

test("only closed daily and closed-cycle fixed fee lines may be issued", () => {
  const estimate = {
    cycleEnd: "2026-11-16",
    invoices: [
      { id: "early", date: "2026-10-21", amount: 200 },
      { id: "today", date: "2026-10-22", amount: 100 },
      { id: "fixed", date: "2026-11-15", amount: 590, issueAtCycleClose: true },
      { id: "zero", date: "2026-10-20", amount: 0 },
    ],
  };
  assert.deepEqual(_test.eligibleForIssuance(estimate, "2026-10-22").map(r => r.id), ["early"]);
  assert.deepEqual(_test.eligibleForIssuance(estimate, "2026-11-16").map(r => r.id),
    ["early", "today", "fixed"]);
});
test("invoice payment state and destination guard", () => {
  assert.equal(_test.stateForInvoice({ status: "paid" }), "paid");
  assert.equal(_test.stateForInvoice({ status: "issued", paymentStatus: "pending" }), "review");
  assert.equal(_test.stateForInvoice({ status: "issued" }), "outstanding");
  assert.equal(_test.stateForInvoice({ status: "void" }), "void");
  assert.deepEqual(_test.normalizedDestination({
    bankName: "Bank", accountName: "Penguin Ltd.", accountNumber: "123-456-7890",
  }), { bankName: "Bank", accountName: "Penguin Ltd.", accountNumber: "1234567890" });
  assert.throws(() => _test.normalizedDestination({ bankName: "Bank", accountName: "x", accountNumber: "bad" }));
});
test("issuance locks cycle price, never overwrites an invoice and detects changed history", () => {
  assert.match(source, /hybridBillingPeriods/);
  assert.match(source, /configSnapshot: estimate\.config/);
  assert.match(source, /HYBRID_CYCLE_PRICING_CHANGED_RETRY/);
  assert.match(source, /HYBRID_ISSUED_INVOICE_RECONCILIATION_REQUIRED/);
  assert.match(source, /await invoiceRef\.create\(payload\)/);
  assert.doesNotMatch(source, /invoiceRef\.set\(payload/);
});
test("payer slip is isolated by Tenant/invoice/payment and cannot be rewritten", () => {
  assert.match(source, /runTransaction\(async tx =>/);
  assert.match(source, /tx\.create\(paymentRef/);
  assert.match(source, /tx\.update\(invoiceRef/);
  assert.match(rules, /hybrid-billing-slips\/\{invoiceId\}\/\{paymentId\}/);
  assert.match(rules, /allow update: if false/);
  assert.match(rules, /hybridBillingInvoices\/\$\(invoiceId\)\/payments/);
});
test("payment review requires super admin and exact invoice/payment linkage", () => {
  assert.match(source, /request, \{ superAdmin: true \}/);
  assert.match(source, /payment\.data\(\)\.invoiceId !== invoiceId/);
  assert.match(source, /HYBRID_PAYMENT_REVIEW_CONFLICT/);
  assert.match(source, /await reconcileTenantAccess\(db, ref, tenant\)/);
});
test("Tenant must explicitly be enabled before issuance or payment; no default live rollout", () => {
  assert.match(source, /tenant\.hybridBillingLive !== true/);
  assert.match(source, /ENABLE_HYBRID_LIVE_BILLING/);
  assert.match(source, /HYBRID_REQUIRES_CLOSED_BANGKOK_DAY/);
  assert.match(source, /HYBRID_BANK_DESTINATION_REQUIRED/);
  assert.match(source, /HYBRID_DAILY_TENANT_SCAN_LIMIT/);
});
test("daily hybrid scheduler and API are isolated from old billing and POS", () => {
  for (const name of [
    "getTenantHybridInvoices", "getPlatformHybridInvoices", "submitTenantHybridPayment",
    "reviewTenantHybridPayment", "issueTenantHybridInvoices", "processHybridBillingDaily",
    "getHybridBillingPaymentDestination", "updateHybridBillingPaymentDestination",
  ]) assert.match(index, new RegExp(`exports\\.${name} = hybridLedger\\.${name}`));
  assert.doesNotMatch(source, /revenueSharePayments|lalamoveWallet|settleTableSession|createWalkInOrder/);
});
test("buyer-facing invoice and superadmin payment review are connected", () => {
  const tenant = fs.readFileSync("react-app/src/pages/HybridBillingReportPage.jsx", "utf8");
  const admin = fs.readFileSync("react-app/src/pages/PlatformPricingPage.jsx", "utf8");
  const data = fs.readFileSync("react-app/src/data/hybridBillingLedger.js", "utf8");
  assert.match(tenant, /submitTenantHybridPayment\(tenant\.id, invoice\.id, file\)/);
  assert.match(admin, /reviewTenantHybridPayment\(hybridTenantId\.trim\(\), invoice\.id/);
  assert.match(admin, /setTenantHybridBillingLive\(/);
  assert.match(data, /uploadBytes\(target, file/);
  assert.match(data, /getDownloadURL/);
});

test("paused Hybrid issuance still allows settling old invoices and releases only own suspension", () => {
  assert.match(source, /Existing issued invoices can still be settled if new billing is paused/);
  assert.match(source, /tenant\.hybridBillingLive === true && snap\.docs\.some/);
  assert.match(source, /tenant\.hybridBillingWasActive === true/);
  assert.match(source, /hybridBillingSuspended === true/);
});

test("locked cycle price equality is independent of Firestore field ordering", () => {
  const a = {
    monthlyFee: 590, deliveryThreshold: 10000, deliveryShareRate: 5,
    monthlySlipQuota: 100, timezone: "Asia/Bangkok", policyVersion: "hybrid_v1",
  };
  const b = Object.fromEntries(Object.entries(a).reverse());
  assert.equal(_test.sameBillingPrices(a, b), true);
  assert.equal(_test.sameBillingPrices(a, { ...b, deliveryShareRate: 6 }), false);
  assert.equal(_test.sameBillingPrices(null, b), false);
});
test("platform invoice administration loads the selected Tenant record", () => {
  assert.match(source, /const \{ ref, tenant \} = await viewer\(request, \{ superAdmin: true \}\)/);
  assert.match(source, /live: tenant\.hybridBillingLive === true/);
});
