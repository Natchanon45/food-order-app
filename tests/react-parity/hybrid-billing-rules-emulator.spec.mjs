// Tests a TEMPORARY, uncommitted-as-production candidate from the real rules.
// Requires Auth AND Firestore localhost emulators; never connects to cloud.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp as initializeClient, deleteApp as deleteClient } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth";
import { getFirestore as clientFirestore, connectFirestoreEmulator,
  doc, getDoc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";

const require = createRequire(import.meta.url);
const functionsRequire = createRequire(new URL("../../functions/hybrid-billing-ledger.js", import.meta.url));
const { initializeApp, deleteApp } = functionsRequire("firebase-admin/app");
const { getFirestore } = functionsRequire("firebase-admin/firestore");
const PROJECT = "demo-penguin-hybrid-rules-uat";
if (process.env.GCLOUD_PROJECT !== PROJECT
  || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8188"
  || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9098") {
  throw Error("HYBRID_RULES_DEMO_EMULATOR_REQUIRED");
}
const server = initializeApp({ projectId: PROJECT }, "hybrid-rules-uat-server");
const db = getFirestore(server);
const client = initializeClient({ apiKey: "demo-fake-api-key", projectId: PROJECT,
  authDomain: "localhost" }, "hybrid-rules-uat-client");
const auth = getAuth(client);
connectAuthEmulator(auth, "http://127.0.0.1:9098", { disableWarnings: true });
const firestore = clientFirestore(client);
connectFirestoreEmulator(firestore, "127.0.0.1", 8188);
const hybrid = "tenant-rules-hybrid-01";
const legacy = "tenant-rules-legacy-02";
const ready = "tenant-rules-hybrid-ready-03";
let uid;
async function putOrder(tenantId) {
  await db.collection("tenants").doc(tenantId).collection("orders").doc("test-order").create({
    orderType: "delivery", paymentMethod: "cash", paymentStatus: "unpaid",
    status: "pending", totalAmount: 100, tenantId, items: [{ name: "tea", qty: 1 }],
  });
  await db.collection("tenants").doc(tenantId).collection("products").doc("p1").create({
    tenantId, shopId: tenantId, productName: "Demo tea", stock: 1,
  });
}
async function setMember(tenantId, role = "cashier") {
  await db.collection("users").doc(uid).set({
    uid, role, tenantId, active: true,
  }, { merge: true });
}
test.before(async () => {
  const credential = await signInAnonymously(auth);
  uid = credential.user.uid;
  for (const [tenantId, data] of [
    [hybrid, { billingPolicyVersion: "hybrid_v1", hybridBillingEnabled: true,
      hybridBillingSuspended: true, active: false }],
    [legacy, { billingPolicyVersion: "legacy", active: true }],
    [ready, { billingPolicyVersion: "hybrid_v1", hybridBillingEnabled: true,
      hybridBillingSuspended: false, active: true }],
  ]) {
    await db.collection("tenants").doc(tenantId).create({
      ownerUid: "real-demo-owner", businessType: "both", ...data,
    });
    await putOrder(tenantId);
  }
  await setMember(ready);
});
test.after(async () => {
  await deleteClient(client);
  await deleteApp(server);
});
test("candidate: enabled Hybrid cashier can use permitted order read/update", async () => {
  await setMember(ready);
  const ref = doc(firestore, "tenants", ready, "orders", "test-order");
  assert.equal((await getDoc(ref)).data().status, "pending");
  await updateDoc(ref, { status: "ready" });
  assert.equal((await getDoc(ref)).data().status, "ready");
});
test("candidate: financially suspended Hybrid cashier cannot read/update operational order", async () => {
  await setMember(hybrid);
  const ref = doc(firestore, "tenants", hybrid, "orders", "test-order");
  await assert.rejects(getDoc(ref), /permission/i);
  await assert.rejects(updateDoc(ref, { status: "ready" }), /permission/i);
  assert.equal((await db.collection("tenants").doc(hybrid).collection("orders").doc("test-order").get()).data().status, "pending");
});
test("candidate: suspended Hybrid cannot read POS product or write POS sale", async () => {
  await setMember(hybrid);
  await assert.rejects(getDoc(doc(firestore, "tenants", hybrid, "products", "p1")), /permission/i);
  await assert.rejects(setDoc(doc(firestore, "tenants", hybrid, "sales", "sale-test-001"), {
    tenantId: hybrid, shopId: hybrid, channel: "retail-pos", status: "completed",
    totalQty: 1, totalAmount: 100, items: [{ productId: "p1", qty: 1 }],
  }), /permission/i);
});
test("candidate: legacy cashier keeps existing order and product access", async () => {
  await setMember(legacy);
  const ref = doc(firestore, "tenants", legacy, "orders", "test-order");
  assert.equal((await getDoc(ref)).data().status, "pending");
  await updateDoc(ref, { status: "ready" });
  assert.equal((await getDoc(doc(firestore, "tenants", legacy, "products", "p1"))).data().productName, "Demo tea");
});
test("candidate: cashier cannot alter tenant billing suspension or financial invoices", async () => {
  await setMember(hybrid);
  await assert.rejects(updateDoc(doc(firestore, "tenants", hybrid),
    { hybridBillingSuspended: false, active: true }), /permission/i);
  await db.collection("tenants").doc(hybrid).collection("hybridBillingInvoices").doc("2026-10-16:delivery:trigger").set({
    policyVersion: "hybrid_v1", amountCents: 77500,
  });
  await assert.rejects(getDoc(doc(firestore, "tenants", hybrid,
    "hybridBillingInvoices", "2026-10-16:delivery:trigger")), /permission/i);
});

test("candidate: active Hybrid cashier cannot forge paidAt/paymentStatus or source amount from browser", async () => {
  await setMember(ready);
  const orderRef = doc(firestore, "tenants", ready, "orders", "test-order");
  for (const change of [
    { paymentStatus: "paid", paidAt: "2026-10-20T16:00:00Z" },
    { paymentMethod: "cod" },
    { totalAmount: 990000 },
    { items: [{ name: "forged", qty: 990 }] },
    { refundTotal: 990000 },
    { lalamoveOrderStatus: "COMPLETED" },
    { lalamoveCodDeliveryCompletedAt: "2026-10-20T12:00:00Z" },
    { deliveryProvider: "lalamove" },
  ]) {
    await assert.rejects(updateDoc(orderRef, change), /permission/i);
  }
  // A merge write must not bypass the same financial-field guard.
  await assert.rejects(setDoc(orderRef, {
    paymentStatus: "paid",
    paidAt: "2026-10-20T16:00:00Z",
  }, { merge: true }), /permission/i);
  // A legitimate nonfinancial kitchen/cashier status update remains allowed.
  await updateDoc(orderRef, { status: "completed" });
  assert.equal((await getDoc(orderRef)).data().status, "completed");
  const trusted = (await db.collection("tenants").doc(ready)
    .collection("orders").doc("test-order").get()).data();
  assert.equal(trusted.paymentStatus, "unpaid");
  assert.equal(trusted.totalAmount, 100);
  assert.equal(trusted.paidAt, undefined);
});
test("candidate: legacy cashier still retains old paidAt and paymentStatus write access", async () => {
  await setMember(legacy);
  const ref = doc(firestore, "tenants", legacy, "orders", "test-order");
  await updateDoc(ref, {
    paymentStatus: "paid", paidAt: "2026-10-20T02:00:00Z",
  });
  const value = (await getDoc(ref)).data();
  assert.equal(value.paymentStatus, "paid");
  assert.equal(value.paidAt, "2026-10-20T02:00:00Z");
});


test("Phase3AA Rules: Hybrid client cannot forge bank-reference, refund chain or settlement proof metadata", async () => {
  await setMember(ready, "owner");
  const ref = doc(firestore, "tenants", ready, "orders", "test-order");
  const forbidden = [
    { paymentBankReferenceHash: "f".repeat(64) },
    { refundReceiptSource: "hybrid_refund_bank_verified_server" },
    { refundBankReferenceHash: "b".repeat(64) },
    { refundChainCount: 7 },
    { refundChainHeadDigest: "a".repeat(64) },
    { refundAt: "2026-10-20T02:00:00Z" },
    { refundVerifiedAt: "2026-10-20T02:00:00Z" },
    { refundReviewedAt: "2026-10-20T02:00:00Z" },
  ];
  for (const change of forbidden) {
    await assert.rejects(updateDoc(ref, change), /permission/i,
      "Hybrid Owner cannot mutate finance metadata: " + Object.keys(change).join());
    await assert.rejects(setDoc(ref, change, { merge: true }), /permission/i);
  }
  const actual = (await db.collection("tenants").doc(ready)
    .collection("orders").doc("test-order").get()).data();
  for (const change of forbidden)
    assert.equal(actual[Object.keys(change)[0]], undefined);
  await updateDoc(ref, { status: "ready" });
});
test("Phase3AA Rules: paid Hybrid delivery deletion is blocked even for Owner; unpaid and legacy retain existing permissions", async () => {
  const live = db.collection("tenants").doc(ready).collection("orders");
  await live.doc("immutable-paid-3aa").set({
    orderType: "delivery", status: "delivered", paymentStatus: "paid",
    paidAt: "2026-10-20T02:00:00Z", totalAmount: 100,
    tenantId: ready, paymentReceiptSource: "hybrid_cod_cashier_server",
    items: [{ name: "tea", qty: 1 }],
  });
  await live.doc("unpaid-removable-3aa").set({
    orderType: "delivery", status: "pending", paymentStatus: "unpaid",
    totalAmount: 100, tenantId: ready, items: [{ name: "tea", qty: 1 }],
  });
  await setMember(ready, "owner");
  await assert.rejects(deleteDoc(doc(firestore, "tenants", ready,
    "orders", "immutable-paid-3aa")), /permission/i);
  assert.equal((await live.doc("immutable-paid-3aa").get()).exists, true);
  await deleteDoc(doc(firestore, "tenants", ready,
    "orders", "unpaid-removable-3aa"));
  assert.equal((await live.doc("unpaid-removable-3aa").get()).exists, false);
  const old = db.collection("tenants").doc(legacy).collection("orders");
  await old.doc("old-paid-removable-3aa").set({
    orderType: "delivery", status: "delivered", paymentStatus: "paid",
    paidAt: "2026-10-20T02:00:00Z", totalAmount: 100, tenantId: legacy,
    items: [{ name: "tea", qty: 1 }],
  });
  await setMember(legacy, "owner");
  await deleteDoc(doc(firestore, "tenants", legacy,
    "orders", "old-paid-removable-3aa"));
  assert.equal((await old.doc("old-paid-removable-3aa").get()).exists, false);
});

