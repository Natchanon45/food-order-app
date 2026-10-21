import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("HYBRID_FIRESTORE_EMULATOR_REQUIRED");
}
// Resolve the already-installed Functions dependencies, not a production app.
const require = createRequire(new URL("../../functions/bootstrap.js", import.meta.url));
const admin = require("firebase-admin");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { _test } = require("./hybrid-billing-ledger.js");

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-hybrid-ci" });
const db = getFirestore();
const paidDate = iso => Timestamp.fromDate(new Date(iso));
let counter = 0;
async function fixture() {
  const id = "tenant-" + String(++counter) + "-" + randomUUID().slice(0, 12);
  const slug = "hybrid-test-" + randomUUID().slice(0, 14);
  const ref = db.collection("tenants").doc(id);
  const tenant = {
    id, slug, ownerUid: "owner-test", billingPolicyVersion: "hybrid_v1",
    hybridBillingLive: true, hybridBillingStartDate: "2024-10-10",
    createdAt: paidDate("2024-10-10T00:00:00.000Z"),
    active: true, hybridBillingSuspended: false,
    hybridBillingSnapshot: {
      monthlyFee: 590, deliveryThreshold: 10000,
      deliveryShareRate: 5, monthlySlipQuota: 100,
    },
  };
  await ref.set(tenant);
  await db.collection("tenantSlugs").doc(slug).set({ tenantId: id, active: true });
  const orderRef = ref.collection("orders").doc("paid-delivery-1");
  await orderRef.set({
    orderType: "delivery", paymentStatus: "paid", status: "delivered",
    paidAt: paidDate("2024-10-11T09:00:00.000Z"),
    subtotalAmount: 10000, totalAmount: 10040, deliveryFee: 40,
  });
  return { id, tenant, ref, orderRef };
}
function invoiceRef(ref) {
  return ref.collection("hybridBillingInvoices")
    .doc("2024-10-10:delivery:trigger");
}
const attest = { attest: "RECONCILED_DELIVERY_SOURCE", actor: "emulator:test" };

test("real Firestore invoice write is idempotent and immutable across order corrections", async () => {
  const { tenant, ref, orderRef } = await fixture();
  const first = await _test.issueForTenant(db, ref, tenant, "2024-10-11", attest);
  assert.equal(first.inserted.length, 1);
  assert.equal(first.skipped.length, 0);
  let snap = await invoiceRef(ref).get();
  assert.equal(snap.data().amount, 500);
  assert.equal(snap.data().status, "issued");
  assert.equal(snap.data().cycleId, "2024-10-10");
  const period = await ref.collection("hybridBillingPeriods").doc("2024-10-10").get();
  assert.equal(period.data().configSnapshot.deliveryThreshold, 10000);
  // Fetch through the Firestore backend: object insertion order may change.
  assert.equal(_test.sameBillingPrices(period.data().configSnapshot, {
    timezone: "Asia/Bangkok", policyVersion: "hybrid_v1",
    deliveryThreshold: 10000, monthlyFee: 590, monthlySlipQuota: 100, deliveryShareRate: 5,
  }), true);
  const repeated = await _test.issueForTenant(db, ref, tenant, "2024-10-11", attest);
  assert.equal(repeated.inserted.length, 0);
  assert.deepEqual(repeated.skipped, ["2024-10-10:delivery:trigger"]);

  // Corrected receipts cannot silently mutate an already-issued charge.
  await orderRef.update({ subtotalAmount: 11000, totalAmount: 11040 });
  await assert.rejects(
    _test.issueForTenant(db, ref, tenant, "2024-10-11", attest),
    /HYBRID_ISSUED_INVOICE_RECONCILIATION_REQUIRED/,
  );
  snap = await invoiceRef(ref).get();
  assert.equal(snap.data().amount, 500);
});

test("real Firestore invoice reconciliation suspends then restores tenant and slug", async () => {
  const { tenant, ref, slug } = await fixture();
  await _test.issueForTenant(db, ref, tenant, "2024-10-11", attest);
  const suspended = await _test.reconcileTenantAccess(db, ref, tenant);
  assert.equal(suspended.action, "suspended");
  let current = (await ref.get()).data();
  assert.equal(current.active, false);
  assert.equal(current.hybridBillingSuspended, true);
  assert.equal((await db.collection("tenantSlugs").doc(tenant.slug).get()).data().active, false);

  await invoiceRef(ref).update({ status: "paid", paymentStatus: "approved" });
  const restored = await _test.reconcileTenantAccess(db, ref, { id: tenant.id, ...current });
  assert.equal(restored.action, "restored");
  current = (await ref.get()).data();
  assert.equal(current.hybridBillingSuspended, false);
  assert.equal(current.active, true);
  assert.equal((await db.collection("tenantSlugs").doc(tenant.slug).get()).data().active, true);
});
