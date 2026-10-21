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
const { getStorage } = require("firebase-admin/storage");
const { getAuth } = require("firebase-admin/auth");
const { _test } = require("./hybrid-billing-ledger.js");

admin.initializeApp({
  projectId: process.env.GCLOUD_PROJECT || "demo-hybrid-ci",
  storageBucket: "demo-hybrid-ci.firebasestorage.app",
});
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
  await db.collection("platformSettings").doc("hybridBillingPayment").set({
    bankName: "Example Bank", accountName: "PENGUIN Tests", accountNumber: "1234567890",
  });
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
  assert.equal(snap.data().paymentDestination.accountNumber, "1234567890");
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
  // The invoice was created today even when the sale was in the past.
  const today = require("./hybrid-billing-core.js").dateKey(new Date());
  const issued = (await invoiceRef(ref).get()).data();
  assert.equal(issued.dueDate, today);
  assert.ok(issued.suspendFrom > today);
  const beforeDue = await _test.reconcileTenantAccess(db, ref, tenant);
  assert.equal(beforeDue.action, "none");
  assert.equal((await ref.get()).data().active, true);
  // Deliberately simulate an existing past-due invoice to test recovery.
  await invoiceRef(ref).update({ suspendFrom: "2024-10-12" });
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

test("Super Admin approval is transactional, verifies linkage and rejects duplicate review", async () => {
  const { tenant, ref } = await fixture();
  await _test.issueForTenant(db, ref, tenant, "2024-10-11", attest);
  const invoiceId = "2024-10-10:delivery:trigger";
  const paymentId = "payment-" + randomUUID();
  await db.collection("users").doc("hybrid-super-admin-test").set({
    role: "super_admin", active: true,
  });
  const paymentRef = invoiceRef(ref).collection("payments").doc(paymentId);
  await paymentRef.set({
    tenantId: tenant.id, invoiceId, paymentId, status: "pending",
    amount: 500, slipPath: "fake-emulator-proof",
  });
  await invoiceRef(ref).update({ paymentId, paymentStatus: "pending" });
  const { reviewTenantHybridPayment, getPlatformHybridInvoices } =
    require("./hybrid-billing-ledger.js");
  assert.equal(typeof reviewTenantHybridPayment.run, "function");
  const args = { auth: { uid: "hybrid-super-admin-test" }, data: {
    tenantId: tenant.id, invoiceId, paymentId, action: "approve",
  } };
  const approved = await reviewTenantHybridPayment.run(args);
  assert.equal(approved.status, "approved");
  assert.equal((await invoiceRef(ref).get()).data().status, "paid");
  assert.equal((await paymentRef.get()).data().status, "approved");
  await assert.rejects(reviewTenantHybridPayment.run(args),
    /HYBRID_PAYMENT_REVIEW_CONFLICT/);
  const listed = await getPlatformHybridInvoices.run({ auth: args.auth,
    data: { tenantId: tenant.id } });
  assert.equal(listed.live, true);
  assert.equal(listed.items[0].state, "paid");
});

test("only Super Admin may review Hybrid payment", async () => {
  const { tenant, ref } = await fixture();
  await _test.issueForTenant(db, ref, tenant, "2024-10-11", attest);
  await db.collection("users").doc("hybrid-tenant-owner-test").set({
    role: "owner", tenantId: tenant.id, active: true,
  });
  const { reviewTenantHybridPayment } = require("./hybrid-billing-ledger.js");
  await assert.rejects(reviewTenantHybridPayment.run({
    auth: { uid: "hybrid-tenant-owner-test" },
    data: { tenantId: tenant.id, invoiceId: "2024-10-10:delivery:trigger",
      paymentId: "payment-" + randomUUID(), action: "approve" },
  }), /SUPER_ADMIN_REQUIRED/);
});

test("submitted bank-slip and Super Admin review are transactional against emulated Storage and Firestore", async () => {
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    throw new Error("HYBRID_STORAGE_EMULATOR_REQUIRED");
  }
  const { tenant, ref } = await fixture();
  await _test.issueForTenant(db, ref, tenant, "2024-10-11", attest);
  const ownerUid = "owner-" + randomUUID();
  const adminUid = "admin-" + randomUUID();
  await Promise.all([
    db.collection("users").doc(ownerUid).set({ role: "owner", tenantId: tenant.id, active: true }),
    db.collection("users").doc(adminUid).set({ role: "super_admin", active: true }),
  ]);
  const { submitTenantHybridPayment, reviewTenantHybridPayment } =
    require("./hybrid-billing-ledger.js");
  const invoiceId = "2024-10-10:delivery:trigger";
  const tenantAuth = { auth: { uid: ownerUid } };
  const adminAuth = { auth: { uid: adminUid } };
  const paymentId = "pay-" + randomUUID();
  const slipPath = `tenants/${tenant.id}/hybrid-billing-slips/${invoiceId}/${paymentId}/proof.png`;
  await getStorage().bucket().file(slipPath).save(Buffer.from("test-proof-image"), {
    metadata: { contentType: "image/png" },
  });
  const submitted = await submitTenantHybridPayment.run({
    ...tenantAuth, data: { invoiceId, paymentId, slipPath, slipName: "proof.png" },
  });
  assert.equal(submitted.status, "pending");
  assert.equal((await invoiceRef(ref).get()).data().paymentStatus, "pending");
  const paymentRef = invoiceRef(ref).collection("payments").doc(paymentId);
  assert.equal((await paymentRef.get()).data().status, "pending");
  // A second submission can neither replace the proof nor produce a second payment.
  await assert.rejects(submitTenantHybridPayment.run({
    ...tenantAuth, data: { invoiceId, paymentId, slipPath, slipName: "proof.png" },
  }), /HYBRID_INVOICE_NOT_PAYABLE/);
  await assert.rejects(reviewTenantHybridPayment.run({
    ...tenantAuth, data: { tenantId: tenant.id, invoiceId, paymentId, action: "approve" },
  }), /SUPER_ADMIN_REQUIRED/);
  const reviewed = await reviewTenantHybridPayment.run({
    ...adminAuth, data: { tenantId: tenant.id, invoiceId, paymentId, action: "approve" },
  });
  assert.equal(reviewed.status, "approved");
  assert.equal((await invoiceRef(ref).get()).data().status, "paid");
  assert.equal((await paymentRef.get()).data().status, "approved");
});

test("Auth and Firestore emulators: signup is gated, first Bangkok request date is immutable, activation is idempotent", async () => {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("HYBRID_AUTH_EMULATOR_REQUIRED");
  const uid = "owner-" + randomUUID();
  const email = "hybrid-" + randomUUID().slice(0, 10) + "@example.test";
  const slug = "hybrid-new-" + randomUUID().slice(0, 14);
  const password = "Emulator-test-password-123!";
  await getAuth().createUser({ uid, email, emailVerified: true, password });
  const { requestTrialTenantSignup, activateTrialTenantSignup } =
    require("./public-signup.js");
  const request = {
    auth: { uid, token: { email } },
    data: {
      email, ownerName: "Emulator Tenant Owner", phone: "0812345678",
      businessType: "restaurant_cafe", orderDeliveryShopName: "Hybrid Test Cafe",
      retailPosShopName: "", slug, packageId: "premium",
    },
  };
  const configRef = db.collection("platformSettings").doc("hybridBilling");
  await configRef.set({ registrationReady: false }, { merge: true });
  await assert.rejects(requestTrialTenantSignup.run(request),
    /Hybrid registration is pending verified billing rollout/);
  await configRef.set({ registrationReady: true }, { merge: true });
  const created = await requestTrialTenantSignup.run(request);
  assert.equal(created.ok, true);
  const signupRef = db.collection("publicTenantSignups").doc(uid);
  const first = (await signupRef.get()).data();
  assert.equal(first.billingPolicyVersion, "hybrid_v1");
  const firstCreatedAt = first.createdAt.toMillis();
  const firstAnniversary = first.hybridBillingStartDate;
  await requestTrialTenantSignup.run(request);
  const retry = (await signupRef.get()).data();
  assert.equal(retry.createdAt.toMillis(), firstCreatedAt);
  assert.equal(retry.hybridBillingStartDate, firstAnniversary);
  const activation = await activateTrialTenantSignup.run({ auth: request.auth, data: {} });
  const tenant = (await db.collection("tenants").doc(activation.tenantId).get()).data();
  assert.equal(tenant.hybridBillingStartDate, firstAnniversary);
  assert.equal(tenant.billingPolicyVersion, "hybrid_v1");
  const again = await activateTrialTenantSignup.run({ auth: request.auth, data: {} });
  assert.equal(again.tenantId, activation.tenantId);
  await assert.rejects(requestTrialTenantSignup.run(request),
    /HYBRID_SIGNUP_ALREADY_ACTIVE/);
  // Exercise actual Storage security rules using an authenticated Web SDK,
  // rather than the Admin SDK (which bypasses client security rules).
  const [{ initializeApp: initializeClientApp, deleteApp },
    { getAuth: getWebAuth, connectAuthEmulator, signInWithEmailAndPassword },
    { getStorage: getWebStorage, connectStorageEmulator, ref: fileRef, uploadBytes }] =
    await Promise.all([import("firebase/app"), import("firebase/auth"), import("firebase/storage")]);
  const app = initializeClientApp({
    apiKey: "local-test-only", projectId: "demo-hybrid-ci",
    authDomain: "demo-hybrid-ci.firebaseapp.com",
    storageBucket: "demo-hybrid-ci.firebasestorage.app",
  }, "hybrid-auth-storage-" + randomUUID());
  const webAuth = getWebAuth(app);
  connectAuthEmulator(webAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const webStorage = getWebStorage(app);
  connectStorageEmulator(webStorage, "127.0.0.1", 9199);
  await signInWithEmailAndPassword(webAuth, email, password);
  const invoiceId = "2024-10-10:delivery:trigger";
  const paymentId = "proof-" + randomUUID();
  const ownPath = `tenants/${activation.tenantId}/hybrid-billing-slips/${invoiceId}/${paymentId}/proof.png`;
  const proof = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  await uploadBytes(fileRef(webStorage, ownPath), proof, { contentType: "image/png" });
  const otherTenantPath = `tenants/other-tenant-123456/hybrid-billing-slips/${invoiceId}/${paymentId}/proof.png`;
  await assert.rejects(uploadBytes(fileRef(webStorage, otherTenantPath), proof,
    { contentType: "image/png" }), /unauthorized|permission|403/);
  await deleteApp(app);
  await configRef.set({ registrationReady: false }, { merge: true });
});

test("Slip2Go allowance is charged once per order and rejects the next order at quota", async () => {
  const { tenant, ref } = await fixture();
  await db.collection("platformSettings").doc("hybridBilling").set({
    monthlyFee: 590, deliveryThreshold: 10000,
    deliveryShareRate: 5, monthlySlipQuota: 1,
  }, { merge: true });
  const ledger = require("./hybrid-billing-ledger.js");
  assert.equal(await ledger.reserveHybridSlipCredit(db, ref, tenant, "order-one"), true);
  assert.equal(await ledger.reserveHybridSlipCredit(db, ref, tenant, "order-one"), true);
  assert.equal(await ledger.reserveHybridSlipCredit(db, ref, tenant, "order-two"), false);
  const superUid = "quota-super-" + randomUUID();
  await db.collection("users").doc(superUid).set({ role: "super_admin", active: true });
  const status = await ledger.getTenantHybridSlipUsage.run({
    auth: { uid: superUid }, data: { tenantId: tenant.id },
  });
  assert.equal(status.used, 1);
  const counter = await ref.collection("hybridSlipUsage").doc(status.cycleId).get();
  assert.equal(counter.data().count, 1);
});

test("disabling Hybrid collection restores only Hybrid suspension without erasing the invoice", async () => {
  const { tenant, ref } = await fixture();
  await _test.issueForTenant(db, ref, tenant, "2024-10-11", attest);
  await invoiceRef(ref).update({ suspendFrom: "2024-10-12" });
  assert.equal((await _test.reconcileTenantAccess(db, ref, tenant)).action, "suspended");
  const adminUid = "pause-super-" + randomUUID();
  await db.collection("users").doc(adminUid).set({ role: "super_admin", active: true });
  const { setTenantHybridBillingLive, submitTenantHybridPayment } =
    require("./hybrid-billing-ledger.js");
  const pause = await setTenantHybridBillingLive.run({
    auth: { uid: adminUid }, data: { tenantId: tenant.id, enabled: false },
  });
  assert.equal(pause.enabled, false);
  const stored = (await ref.get()).data();
  assert.equal(stored.hybridBillingLive, false);
  assert.equal(stored.hybridBillingSuspended, false);
  assert.equal(stored.active, true);
  assert.equal((await invoiceRef(ref).get()).data().status, "issued");
});

test("Tenant billing callable rejects cross-shop invoice history access", async () => {
  const own = await fixture();
  const other = await fixture();
  const uid = "cross-tenant-" + randomUUID();
  await db.collection("users").doc(uid).set({
    role: "owner", active: true, tenantId: own.tenant.id,
  });
  const { getTenantHybridInvoices } = require("./hybrid-billing-ledger.js");
  const permitted = await getTenantHybridInvoices.run({
    auth: { uid }, data: {},
  });
  assert.deepEqual(permitted.items, []);
  await assert.rejects(getTenantHybridInvoices.run({
    auth: { uid }, data: { tenantId: other.tenant.id },
  }), /CROSS_TENANT_DENIED/);
});
