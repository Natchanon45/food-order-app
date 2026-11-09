import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const REQUIRED = ["FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"];
for (const name of REQUIRED) {
  if (!/^(127\.0\.0\.1|localhost):[0-9]+$/.test(process.env[name] || "")) {
    throw Error("P1_DELIVERY_EMULATOR_ONLY_" + name);
  }
}
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
if (!getApps().length) initializeApp({
  projectId: "demo-penguin-hybrid", storageBucket: "demo-penguin-hybrid.appspot.com",
});
const db = getFirestore(), storage = getStorage();
const callable = require("./delivery-slip");
const tenantId = "merchant-quota-e2e-" + randomUUID().slice(0, 20);
const tenantRef = db.collection("tenants").doc(tenantId);
const usedSnapshots = [];
const menuId = "menu-p1-delivery";
const paymentPath = orderId =>
  "tenants/" + tenantId + "/payment-slips/" + orderId + "/image.png";
const endpoint = "https://slip2go.invalid/api/verify-slip/qr-image/info";
const sender = { ip: "127.0.0.1", headers: {} };
function record(id) {
  return { tenantId, orderId: id, slipPath: paymentPath(id),
    amount: 230, deliveryFee: 30, items: [{ id: menuId, qty: 1 }],
    deliveryProvider: "self", zoneId: "near" };
}
async function call(id) {
  return callable.verifyDeliveryPaymentSlip.run({
    data: record(id), rawRequest: sender,
  });
}
async function upload(id) {
  await storage.bucket().file(paymentPath(id)).save(
    Buffer.from("EMULATOR_ONLY_P1_DELIVERY_" + id),
    { contentType: "image/png" });
}
test.before(async () => {
  await tenantRef.set({ name: "P1 Quota Test", slug: tenantId, active: true,
    businessType: "restaurant_cafe",
    billingCycleAnchorAt: Timestamp.fromDate(new Date(Date.now() - 10 * 86400000)),
  });
  await tenantRef.collection("settings").doc("store").set({
    shopName: "P1 Quota Test",
    promptPayId: "0812345678",
    deliveryFeeOptions: [{ id: "near", fee: 30 }],
  });
  await tenantRef.collection("menus").doc(menuId).set({
    name: "Emulator item", active: true, price: 200,
  });
  const pricing = db.collection("platformSettings").doc("subscriptionPricing");
  const verifier = db.collection("platformPrivateSettings").doc("slipVerification");
  for (const ref of [pricing, verifier]) {
    const snap = await ref.get();
    usedSnapshots.push({ ref, exists: snap.exists, data: snap.data() });
  }
  await pricing.set({ monthlySlipQuota: 1, deliveryThreshold: 10000 });
  await verifier.set({
    provider: "slip2go", slip2GoApiUrl: "https://slip2go.invalid",
    slip2GoSecret: "EMULATOR_NEVER_REAL",
    receiverAccountNumber: "0812345678", receiverNameTh: "Emulator",
  });
});
test.after(async () => {
  // Dedicated demo project only. Do not leave fake provider settings there.
  for (const snap of usedSnapshots.reverse()) {
    if (snap.exists) await snap.ref.set(snap.data);
    else await snap.ref.delete().catch(() => {});
  }
});
test("public Delivery Callable consumes exactly one quota slot on one provider-checked bill", async () => {
  const id = "order-emulator-0001";
  await upload(id);
  let called = 0;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, endpoint);
    called++;
    return new Response(JSON.stringify({
      code: "200200", data: { amount: 230, transRef: "emulator-ref-" + id },
    }), { status: 200 });
  };
  try {
    const checked = await call(id);
    assert.equal(checked.status, "matched");
    assert.equal(called, 1);
    const replay = await call(id);
    assert.equal(replay.status, "matched");
    assert.equal(called, 1);
    const cycle = (await tenantRef.collection("merchantSlipQuotaCycles").get()).docs;
    assert.equal(cycle.length, 1);
    assert.equal(cycle[0].data().usedBills, 1);
  } finally { globalThis.fetch = oldFetch; }
});
test("second merchant bill is quota-exhausted below 10k: no provider, no approval proof", async () => {
  const id = "order-emulator-0002";
  await upload(id);
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw Error("PROVIDER_CALL_MUST_NOT_HAPPEN"); };
  try {
    const result = await call(id);
    assert.equal(result.status, "manual_review");
    assert.equal(result.reason, "merchant_slip_quota_exhausted");
    assert.equal((await tenantRef.collection("deliverySlipChecks").doc(id).get()).exists,
      false);
    assert.equal((await tenantRef.collection("merchantSlipBillChecks").get()).size, 1);
  } finally { globalThis.fetch = oldFetch; }
});
test("verified paid Delivery goods reaching exactly 10k activates unlimited merchant checks", async () => {
  await tenantRef.collection("orders").doc("paid-delivery-source").set({
    orderType: "delivery", paymentStatus: "paid", status: "delivered",
    paidAt: Timestamp.now(), subtotalAmount: 10000,
    totalAmount: 10030, deliveryFee: 30,
  });
  const id = "order-emulator-0003";
  await upload(id);
  let called = 0;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, endpoint);called++;
    return new Response(JSON.stringify({
      code: "200200", data: { amount: 230, transRef: "emulator-ref-" + id },
    }), { status: 200 });
  };
  try {
    const checked = await call(id);
    assert.equal(checked.status, "matched");
    assert.equal(called, 1);
    const stored = (await tenantRef.collection("merchantSlipQuotaCycles").get()).docs[0].data();
    assert.equal(stored.usedBills, 2);
  } finally { globalThis.fetch = oldFetch; }
});
test("invalid provider credential cannot consume an extra merchant free bill", async () => {
  const id = "order-emulator-0004";
  await upload(id);
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    code: "401001", message: "EMULATOR_INVALID_CREDENTIAL",
  }), { status: 200 });
  try {
    const checked = await call(id);
    assert.equal(checked.status, "manual_review");
    assert.equal((await tenantRef.collection("merchantSlipQuotaCycles").get())
      .docs[0].data().usedBills, 2);
    const replay = await call(id);
    assert.equal(replay.reason, "provider_key_invalid");
  } finally { globalThis.fetch = oldFetch; }
});
