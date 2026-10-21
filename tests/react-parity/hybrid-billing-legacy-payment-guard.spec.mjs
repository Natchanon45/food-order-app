import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { legacyDeliveryPaidWriterAllowed } =
  require("../../functions/hybrid-billing-legacy-payment-guard.js");

test("legacy payment guard fails closed for Hybrid, migrating and unknown tenant", () => {
  assert.equal(legacyDeliveryPaidWriterAllowed(null), false);
  assert.equal(legacyDeliveryPaidWriterAllowed(undefined), false);
  for (const data of [
    {billingPolicyVersion:"hybrid_v1", hybridBillingEnabled:false},
    {billingPolicyVersion:"subscription_v1", hybridBillingEnabled:true},
    {hybridReceiptJournalCoverageReady:true},
    {hybridReceiptJournalMode:"strict"},
    {hybridReceiptJournalMode:""},
    {billingPolicyVersion:"hybrid_v1", hybridReceiptJournalCoverageReady:false},
  ]) assert.equal(legacyDeliveryPaidWriterAllowed(data), false);
});

test("legacy non-Hybrid tenants retain old server payment route", () => {
  for (const data of [
    {}, {billingPolicyVersion:"legacy_v1"},
    {billingPolicyVersion:"subscription_v1", hybridBillingEnabled:false},
    {billingPolicyVersion:null,hybridReceiptJournalCoverageReady:false},
  ]) assert.equal(legacyDeliveryPaidWriterAllowed(data), true);
});

test("both exported legacy paid Delivery Admin SDK transaction writes are fenced", () => {
  const backend = fs.readFileSync("functions/delivery-slip.js", "utf8");
  assert.match(backend, /require\("\.\/hybrid-billing-legacy-payment-guard"\)/);
  const auto = backend.slice(backend.indexOf("exports.finalizeDeliveryPaymentSlip ="),
    backend.indexOf("exports.approveDeliveryPaymentReview ="));
  const manual = backend.slice(backend.indexOf("exports.approveDeliveryPaymentReview ="),
    backend.indexOf("exports.notifyKitchenDeliveryAdmitted ="));
  for (const route of [auto, manual]) {
    assert.match(route, /tx\.get\(tenantRef\)/);
    assert.match(route, /legacyDeliveryPaidWriterAllowed\(/);
    assert.match(route, /HYBRID_TRUSTED_JOURNAL_WRITER_REQUIRED/);
    assert.match(route, /paymentStatus: "paid"/);
    assert.ok(route.indexOf("legacyDeliveryPaidWriterAllowed(") < route.lastIndexOf('paymentStatus: "paid"'),
      "guard must precede privileged paid-status write");
  }
  const exportsSource = fs.readFileSync("functions/index.js", "utf8");
  assert.ok(exportsSource.includes("exports.finalizeDeliveryPaymentSlip"));
  assert.ok(exportsSource.includes("exports.approveDeliveryPaymentReview"));
  assert.ok(!exportsSource.includes("hybrid-billing-demo-enforced-writer"));
});

test("Phase3AN: Revenue Share access mirror is an atomic tenant-read guard, not an unguarded batch", () => {
  const revenue = fs.readFileSync("functions/revenue-share.js", "utf8");
  const guard = fs.readFileSync("functions/hybrid-billing-legacy-access-guard.js", "utf8");
  const start = revenue.indexOf("async function mirrorTenantAccess(");
  const end = revenue.indexOf("\nfunction overrideMatches(", start);
  assert.ok(start > 0 && end > start);
  const mirror = revenue.slice(start, end);
  assert.match(revenue, /require\("\.\/hybrid-billing-legacy-access-guard"\)/);
  assert.match(mirror, /return mirrorLegacyTenantAccess\(/);
  assert.doesNotMatch(mirror, /db\.batch\(|\.commit\(/);
  assert.match(guard, /db\.runTransaction\(async tx =>/);
  assert.match(guard, /tx\.get\(tenantRef\)/);
  assert.match(guard, /legacyDeliveryPaidWriterAllowed\(snapshot\.data\(\)\)/);
  assert.match(guard, /tx\.set\(tenantRef/);
  assert.ok(guard.indexOf("tx.get(tenantRef)") <
    guard.indexOf("tx.set(tenantRef"), "read guard must precede all writes");
  // Explicitly not yet globally covered; a second legacy admin file still
  // holds independent tenant-active writers for the next review.
  const subscription = fs.readFileSync("functions/subscription-admin.js", "utf8");
  assert.match(subscription, /exports\.updateTenantSubscription/);
});
