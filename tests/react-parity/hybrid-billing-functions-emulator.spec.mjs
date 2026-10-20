// Real Auth token -> v2 HTTPS Callable emulator -> Admin SDK Firestore
// transactions. Synthetic demo only; production App Check attestations and
// bank provider are NOT emulated by this wrapper.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
const require = createRequire(import.meta.url);
const adminRequire = createRequire(new URL("../../functions/hybrid-billing-ledger.js", import.meta.url));
const { initializeApp: adminInit, deleteApp: adminDelete } = adminRequire("firebase-admin/app");
const { getFirestore } = adminRequire("firebase-admin/firestore");

const PROJECT = "demo-penguin-hybrid-callable-uat";
if (process.env.GCLOUD_PROJECT !== PROJECT
  || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8192"
  || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9096") {
  throw Error("HYBRID_FUNCTIONS_EMULATOR_ISOLATION_REQUIRED");
}
const config = {
  apiKey: "demo-fake-key", projectId: PROJECT, authDomain: "localhost",
};
const app = initializeApp(config, "hybrid-real-functions-uat");
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9096", { disableWarnings: true });
const fns = getFunctions(app, "asia-southeast1");
connectFunctionsEmulator(fns, "127.0.0.1", 5007);
const cod = httpsCallable(fns, "hybridCodDemo");
const finance = httpsCallable(fns, "hybridFinanceDemo");
const adminApp = adminInit({ projectId: PROJECT }, "hybrid-functions-test-admin");
const db = getFirestore(adminApp);
const tenantId = "tenant-real-callable-001", orderId = "order-real-callable-001";
let uid;

test.before(async () => {
  uid = (await signInAnonymously(auth)).user.uid;
  await db.collection("users").doc(uid).set({
    uid, tenantId, active: true, role: "owner",
  });
  await db.collection("tenants").doc(tenantId).set({
    billingPolicyVersion: "hybrid_v1", hybridBillingEnabled: true,
    hybridBillingSuspended: false, active: true,
    businessType: "restaurant_cafe", hybridBillingStartDate: "2026-10-16",
  });
  await db.collection("tenants").doc(tenantId).collection("orders")
    .doc(orderId).set({
      orderType: "delivery", paymentMethod: "cod", paymentStatus: "unpaid",
      status: "delivered", totalAmount: 180, subtotalAmount: 180,
      deliveryFee: 0, items: [{ name: "test", qty: 1 }],
    });
});
test.after(async () => {
  await deleteApp(app);
  await adminDelete(adminApp);
});

test("actual HTTPS callable: verified Auth UID pays COD exactly once with server Timestamp", async () => {
  const first = (await cod({ tenantId, orderId })).data;
  assert.equal(first.ok, true);
  assert.equal(first.alreadyPaid, false);
  const snap = await db.collection("tenants").doc(tenantId)
    .collection("orders").doc(orderId).get();
  assert.equal(snap.data().paymentStatus, "paid");
  assert.equal(snap.data().paymentReceivedByUid, uid);
  assert.equal(snap.data().paymentReceiptSource, "hybrid_cod_cashier_server");
  assert.ok(snap.data().paidAt?.toDate?.() instanceof Date);
  const repeat = (await cod({ tenantId, orderId })).data;
  assert.equal(repeat.alreadyPaid, true);
});

test("actual HTTPS callable: forged actor / amount and cross-tenant caller denied", async () => {
  await assert.rejects(cod({ tenantId, orderId, actorUid: "another-user-uid" }),
    error => error.code === "functions/invalid-argument");
  await assert.rejects(cod({ tenantId, orderId, paidAt: "2035-01-01T00:00:00Z" }),
    error => error.code === "functions/invalid-argument");
  await assert.rejects(cod({ tenantId: "another-demo-tenant-123", orderId }),
    error => ["functions/failed-precondition", "functions/permission-denied"].includes(error.code));
});

test("actual HTTPS finance callable: tenant Owner sees own issued invoices but cannot review", async () => {
  const invoiceId = "2026-10-16:delivery:trigger";
  await db.collection("tenants").doc(tenantId)
    .collection("hybridBillingInvoices").doc(invoiceId).set({
      tenantId, invoiceId, policyVersion: "hybrid_v1",
      kind: "delivery_threshold", amountCents: 77500, currency: "THB",
      dueDate: "2026-10-20", serviceDate: "2026-10-20",
    });
  const listed = (await finance({ tenantId, action: "list" })).data;
  assert.equal(listed.ok, true);
  assert.equal(listed.rows.length, 1);
  assert.equal(listed.rows[0].amountCents, 77500);
  await assert.rejects(finance({ tenantId, action: "queue" }),
    error => error.code === "functions/permission-denied");
  await assert.rejects(finance({ tenantId, action: "recover", reviewId: "review-unauthorized-001" }),
    error => error.code === "functions/permission-denied");
});

test("actual HTTPS finance callable: cross-tenant list denied", async () => {
  await assert.rejects(finance({ tenantId: "tenant-other-callable-002", action: "list" }),
    error => error.code === "functions/permission-denied");
});
