import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const projectId = "demo-penguin-hybrid";
for (const key of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST",
  "FIREBASE_STORAGE_EMULATOR_HOST"]) {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[key] || "")) {
    throw new Error("LOCAL_EMULATOR_ONLY: " + key);
  }
}
if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== projectId) {
  throw new Error("LOCAL_EMULATOR_PROJECT_MISMATCH");
}
const req = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = req("firebase-admin/app");
const { getFirestore, FieldValue } = req("firebase-admin/firestore");
const { getAuth } = req("firebase-admin/auth");
const { getStorage } = req("firebase-admin/storage");

const uid = "premium-e2e-" + randomUUID().slice(0, 12);
const adminUid = "premium-admin-" + randomUUID().slice(0, 12);
const tenantId = "premium-" + randomUUID().slice(0, 12);
const app = initializeApp({ projectId, storageBucket: projectId + ".appspot.com" }, "delivery-share-e2e-" + tenantId);
const db = getFirestore(app), auth = getAuth(app), storage = getStorage(app);
const tenantRef = db.collection("tenants").doc(tenantId);
const ownerRef = db.collection("users").doc(uid);
const adminRef = db.collection("users").doc(adminUid);
const slugRef = db.collection("tenantSlugs").doc(tenantId);
const sample = Buffer.from("FAKE-SLIP-UNTRUSTED-EMULATOR-ONLY");
const paymentId = "premium_day_" + randomUUID().replaceAll("-", "").slice(0, 22);
const slipPath = "tenants/" + tenantId + "/revenue-share-slips/" + paymentId + "/synthetic.png";
const file = storage.bucket().file(slipPath);
const cleanup = [];
const PRICE = { deliveryThreshold: 10000, deliveryShareRate: 5, monthlyPrice: 590 };

function loadRealModuleAt(day, slipResult = null) {
  const iso = day + "T00:20:00+07:00";
  const RealDate = Date;
  class Clock extends RealDate {
    constructor(...args) { super(...(args.length ? args : [iso])); }
    static now() { return RealDate.parse(iso); }
  }
  const source = fs.readFileSync(new URL("../../functions/revenue-share.js", import.meta.url), "utf8");
  const dependencies = {
    "firebase-functions/v2/https": {
      HttpsError: class extends Error { constructor(code, message) { super(message); this.code = code; } },
      onCall: (_opts, callback) => callback,
    },
    "firebase-functions/v2/scheduler": { onSchedule: (_opts, callback) => callback },
    "firebase-admin/firestore": { getFirestore: () => db, FieldValue },
    "firebase-admin/storage": { getStorage: () => storage },
    "node:crypto": req("node:crypto"),
    "./finance-slip-claims": req("./finance-slip-claims"),
    "./slip-verification": {
      // Provider unavailable: no network calls, manual-review-only.
      inspectSlip: async () => slipResult || ({
        provider: "slip2go", status: "config_required",
        reason: "slip2go_config_required", amountMatched: false,
      }),
    },
    "./subscription-pricing-core": {
      loadPricing: async () => PRICE,
      calculatePricing: () => ({ monthly: { payable: 590 }, annual: { payable: 5900 } }),
    },
    "./revenue-share-policy": req("./revenue-share-policy"),
    "./billing-anniversary": req("./billing-anniversary"),
  };
  const m = { exports: {} };
  new Function("module", "exports", "require", "Date",
    source + "\nmodule.exports.__reconcileTenant = reconcileTenant;"
      + "\nmodule.exports.__summary = summaryForTenant;"
      + "\nmodule.exports.__setting = revenueSetting;")(
    m, m.exports, name => {
      assert.ok(name in dependencies, "Disallowed dependency " + name);
      return dependencies[name];
    }, Clock);
  return m.exports;
}

test("actual Firestore/Auth/Storage Emulator: 75 THB due, hold, offline proof, admin release", async t => {
  t.after(async () => {
    await Promise.allSettled([file.delete(), auth.deleteUser(uid), auth.deleteUser(adminUid)]);
    for (const ref of cleanup.reverse()) {
      try { await ref.delete(); } catch {}
    }
    await deleteApp(app);
  });
  await auth.createUser({ uid, email: uid + "@demo.invalid", password: "EmulatorOnly123!" });
  await auth.createUser({ uid: adminUid, email: adminUid + "@demo.invalid", password: "EmulatorOnly123!" });
  await ownerRef.set({ role: "owner", active: true, tenantId });
  await adminRef.set({ role: "super_admin", active: true });
  cleanup.push(ownerRef, adminRef, tenantRef, slugRef);
  await tenantRef.set({
    active: true, slug: tenantId, name: "Emulator only Premium",
    businessType: "restaurant_cafe", billingMode: "subscription",
    subscriptionStatus: "active",
    billingCycleAnchorAt: "2026-10-03T08:30:00+07:00",
    createdAt: "2026-10-03T08:30:00+07:00",
  });
  await slugRef.set({ tenantId, active: true });
  for (const [date, value] of [["2026-10-03", 4000], ["2026-10-09", 6000], ["2026-10-10", 1500]]) {
    const ref = tenantRef.collection("orders").doc("paid-" + date);
    cleanup.push(ref);
    await ref.set({ orderType: "delivery", status: "delivered", paymentStatus: "paid",
      paidAt: new Date(date + "T12:00:00+07:00"),
      subtotalAmount: value, deliveryFee: 40, totalAmount: value + 40 });
  }
  const fn = loadRealModuleAt("2026-10-11");
  const setting = fn.__setting((await tenantRef.get()).data(), PRICE);
  assert.equal(setting.billingCycle, "daily");
  const summary = await fn.__summary(tenantId, {
    type: "daily", start: new Date("2026-10-10T00:00:00+07:00"),
    end: new Date("2026-10-11T00:00:00+07:00"),
    startDate: "2026-10-10", endDate: "2026-10-10",
  }, setting);
  assert.equal(summary.deliveryShareBase, 1500);
  assert.equal(summary.platformAmountDue, 75);
  const first = await fn.__reconcileTenant(tenantId);
  assert.equal(first.action, "suspended");
  const hold = (await tenantRef.get()).data();
  assert.equal(hold.active, false);
  assert.equal(hold.revenueShareSuspended, true);
  assert.equal(hold.revenueShareSuspendedPeriodStart, "2026-10-10");
  assert.equal((await slugRef.get()).data().active, false);
  const repeated = await fn.__reconcileTenant(tenantId);
  assert.equal(repeated.action, "none");

  await file.save(sample, { contentType: "image/png", resumable: false });
  const result = await fn.submitTenantRevenueSharePayment({
    auth: { uid },
    data: { period: "daily", date: "2026-10-10", paymentId,
      slipPath, slipName: "synthetic.png" },
  });
  assert.equal(result.autoApproved, false);
  const paymentRef = tenantRef.collection("revenueSharePayments").doc(paymentId);
  cleanup.push(paymentRef);
  const record = (await paymentRef.get()).data();
  assert.equal(record.status, "pending");
  assert.equal(record.platformAmountDue, 75);
  assert.equal(record.slipVerificationStatus, "config_required");
  const claims = await db.collection("financeSlipClaims").get();
  for (const doc of claims.docs) {
    if (doc.data().recordId === paymentId) cleanup.push(doc.ref);
  }
  assert.equal((await tenantRef.get()).data().revenueShareSuspended, true);
  const reviewed = await fn.reviewRevenueSharePayment({
    auth: { uid: adminUid },
    data: { tenantId, paymentId, action: "approve", note: "Local emulator manual verification only" },
  });
  assert.equal(reviewed.status, "approved");
  assert.equal((await paymentRef.get()).data().status, "approved");
  const released = (await tenantRef.get()).data();
  assert.equal(released.revenueShareSuspended, false);
  assert.equal(released.active, true);
  assert.equal((await slugRef.get()).data().active, true);
  assert.equal((await fn.__reconcileTenant(tenantId)).action, "none");

  // On the following business day, the same shop has another 2,000 THB
  // eligible Delivery sale. Exercise strict verified Slip2Go auto-approval,
  // real Firestore claims and immediate release with no Super Admin action.
  const nextOrder = tenantRef.collection("orders").doc("paid-2026-10-11");
  cleanup.push(nextOrder);
  await nextOrder.set({
    orderType: "delivery", status: "delivered", paymentStatus: "paid",
    paidAt: new Date("2026-10-11T12:00:00+07:00"),
    subtotalAmount: 2000, deliveryFee: 40, totalAmount: 2040,
  });
  const nextFn = loadRealModuleAt("2026-10-12", {
    provider: "slip2go", status: "matched", amountMatched: true,
    receiverValidated: true, referenceId: "emulator-" + paymentId,
    detectedAmount: 100,
  });
  assert.equal((await nextFn.__reconcileTenant(tenantId)).action, "suspended");
  const paymentId2 = "premium_day_" + randomUUID().replaceAll("-", "").slice(0, 22);
  const path2 = "tenants/" + tenantId + "/revenue-share-slips/" + paymentId2 + "/verified.png";
  const file2 = storage.bucket().file(path2);
  t.after(async () => { await file2.delete().catch(() => {}); });
  await file2.save(Buffer.from("FAKE-SECOND-SLIP-UNTRUSTED-EMULATOR"), {
    contentType: "image/png", resumable: false,
  });
  const approved = await nextFn.submitTenantRevenueSharePayment({
    auth: { uid },
    data: { period: "daily", date: "2026-10-11",
      paymentId: paymentId2, slipPath: path2, slipName: "verified.png" },
  });
  assert.equal(approved.autoApproved, true);
  const p2 = tenantRef.collection("revenueSharePayments").doc(paymentId2);
  cleanup.push(p2);
  assert.equal((await p2.get()).data().platformAmountDue, 100);
  assert.equal((await p2.get()).data().status, "approved");
  const moreClaims = await db.collection("financeSlipClaims").get();
  for (const claim of moreClaims.docs) {
    if (claim.data().recordId === paymentId2) cleanup.push(claim.ref);
  }
  assert.equal((await tenantRef.get()).data().revenueShareSuspended, false);
  assert.equal((await tenantRef.get()).data().active, true);
  assert.equal((await nextFn.__reconcileTenant(tenantId)).action, "none");
});
