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

test("Phase3AO: all four Subscription Admin writer paths use fresh-tenant transaction guard", () => {
  const backend = fs.readFileSync("functions/subscription-admin.js", "utf8");
  const helper = fs.readFileSync("functions/hybrid-billing-legacy-access-guard.js", "utf8");
  const paths = ["initializeTenantSubscription", "backfillTenantSubscriptions",
    "updateTenantSubscription", "syncExpiredTenants"];
  for (let i = 0; i < paths.length; i++) {
    const from = backend.indexOf("exports." + paths[i] + " =");
    const to = i + 1 < paths.length
      ? backend.indexOf("exports." + paths[i+1] + " =", from) : backend.length;
    assert.ok(from >= 0 && to > from);
    const section = backend.slice(from, to);
    assert.match(section, /writeLegacySubscription\(db,/);
    assert.doesNotMatch(section, /db\.batch\(|batch\.commit\(/);
  }
  assert.match(helper, /async function mirrorLegacySubscriptionAccess\(/);
  assert.match(helper, /db\.runTransaction\(async tx =>/);
  assert.match(helper, /tx\.get\(tenantRef\)/);
  assert.match(helper, /legacyDeliveryPaidWriterAllowed\(tenant\)/);
  assert.match(helper, /tx\.set\(tenantRef, patch/);
  assert.match(helper, /tx\.set\(db\.collection\("tenantSlugs"\)/);
  assert.equal((backend.match(/mirrorLegacySubscriptionAccess\(/g) || []).length, 1);
});

test("Release Gate W1: legacy SaaS import routes are transactionally tenant-gated", () => {
  const migration = fs.readFileSync("functions/saas-migration.js","utf8");
  const helper = fs.readFileSync("functions/hybrid-billing-legacy-migration-guard.js","utf8");
  for (const segment of ["async function ensureTenant(", "async function copyCollection(",
    "async function copySettings(", "async function finalizeMigration("]) {
    const start = migration.indexOf(segment);
    assert.ok(start >= 0);
    const end = migration.indexOf("\n}", start);
    assert.match(migration.slice(start, end + 2), /transactLegacyMigration\(/);
  }
  assert.match(helper, /db\.runTransaction\(async tx =>/);
  assert.match(helper, /tx\.get\(tenantRef\)/);
  assert.match(helper, /legacyDeliveryPaidWriterAllowed\(snap\.data\(\)\)/);
  const admin = fs.readFileSync("functions/tenant-admin.js", "utf8");
  const deleteSection = admin.slice(admin.indexOf("exports.deleteTenant ="));
  assert.match(deleteSection, /legacyDeliveryPaidWriterAllowed\(tenantSnapshot\.data\(\)\)/);
  for (const collection of ["hybridBillingInvoices","hybridBillingReceiptEvents",
    "hybridBillingRefundChains","hybridBillingDayManifestCandidates"])
    assert.ok(deleteSection.includes(collection), collection);
});

test("W1 grouped source contracts: Tenant metadata transaction cannot revive suspended Hybrid slug", () => {
  const backend = fs.readFileSync("functions/tenant-admin.js","utf8");
  const guard = fs.readFileSync("functions/hybrid-billing-tenant-admin-guard.js","utf8");
  const update = backend.slice(backend.indexOf("exports.updateTenant ="),
    backend.indexOf("exports.deleteTenant ="));
  assert.match(update, /updateTenantMetadataTransaction\(/);
  assert.doesNotMatch(update, /db\.batch\(/);
  assert.match(guard,/db\.runTransaction\(async tx =>/);
  assert.match(guard,/tx\.get\(tenantRef\)/);
  assert.match(guard,/tx\.get\(slugRef\)/);
  assert.match(guard,/hybridBillingSuspended !== true/);
  assert.match(guard,/hybridBillingManualHold !== true/);
});
test("W1 grouped source contracts: POS backup Restore is guarded per destructive chunk", () => {
  const s = fs.readFileSync("functions/retail-pos-backup.js", "utf8");
  assert.match(s, /require\("\.\/hybrid-billing-legacy-migration-guard"\)/);
  const restore=s.slice(s.indexOf("exports.restoreRetailPosBackup ="));
  assert.match(restore,/await transactLegacyMigration\(/);
  assert.match(restore,/clearCollection\(db, tenant, ref, name\)/);
  assert.match(restore,/restoreRows\(db, tenant, ref, prepared\[name\]\)/);
  assert.ok(restore.indexOf('const settings = preparedRows("settings"')
    < restore.indexOf("await clearCollection("));
  assert.doesNotMatch(s,/db\.batch\(/);
  assert.ok((s.match(/transactLegacyMigration\(/g)||[]).length>=4);
});

test("W1 Owner Admission: privileged createTenantOwner cannot bypass transactional finance tenant guard", () => {
  const src = fs.readFileSync("functions/tenant-admin.js","utf8");
  const helper = fs.readFileSync("functions/hybrid-billing-tenant-admin-guard.js","utf8");
  const call=src.slice(src.indexOf("exports.createTenantOwner ="),
    src.indexOf("exports.updateTenantOwner ="));
  assert.match(call,/createLegacyTenantOwnerTransaction\(/);
  assert.match(call,/getAuth\(\)\.deleteUser\(authUser\.uid\)/);
  assert.doesNotMatch(call,/batch\.commit\(|db\.batch\(/);
  assert.match(helper,/async function createLegacyTenantOwnerTransaction\(/);
  assert.match(helper,/tx\.get\(tenantRef\)/);
  assert.match(helper,/legacyDeliveryPaidWriterAllowed\(tenant\)/);
  assert.match(helper,/tx\.get\(tenantRef\.collection\("memberships"\)/);
  assert.match(helper,/tx\.create\(userRef, profile\)/);
  assert.ok(helper.indexOf('tx.get(tenantRef)',helper.indexOf('async function createLegacyTenantOwnerTransaction'))
    < helper.indexOf('tx.create(userRef',helper.indexOf('async function createLegacyTenantOwnerTransaction')));
});
