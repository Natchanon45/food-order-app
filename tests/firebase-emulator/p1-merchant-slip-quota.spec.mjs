import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";

const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
if (!getApps().length) initializeApp({ projectId: "demo-penguin-hybrid" });
const db = getFirestore();
const policy = require("./merchant-slip-quota");
const tenantId = "p1-slipquota-" + randomUUID().slice(0, 18);
const tenantRef = db.collection("tenants").doc(tenantId);
const anchor = new Date("2026-07-18T01:00:00Z");
const today = new Date("2026-11-01T05:00:00Z");
const tenant = { billingCycleAnchorAt: Timestamp.fromDate(anchor), active: true };
const digest = value => createHash("sha256").update(String(value)).digest("hex");
function input(orderId, suffix = "A", goodsCents = 0, freeBills = 2) {
  return { db, tenantRef, tenant, orderId, now: today,
    slipSha256: digest(orderId + suffix),
    orderFingerprint: digest("binding-" + orderId),
    goodsCents, freeBills, thresholdCents: 1000000 };
}
function id(n) { return "test-slip-order-" + String(n).padStart(5, "0"); }

test("source policy: 100 free UNIQUE bills, exact 10k unlimited and reset on the 18th", () => {
  const p = policy.entitlement({ anchor: "2026-07-18", today: "2026-11-01",
    goodsCents: 999999, usedBills: 99, freeBills: 100,
    thresholdCents: 1000000 });
  assert.equal(p.allowed, true);
  assert.equal(p.remainingFreeBills, 1);
  assert.equal(p.cycleStartDate, "2026-10-18");
  assert.equal(p.cycleResetDate, "2026-11-18");
  const blocked = policy.entitlement({ anchor: "2026-07-18", today: "2026-11-01",
    goodsCents: 999999, usedBills: 100, freeBills: 100,
    thresholdCents: 1000000 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.unlimited, false);
  const exact = policy.entitlement({ anchor: "2026-07-18", today: "2026-11-01",
    goodsCents: 1000000, usedBills: 100, freeBills: 100,
    thresholdCents: 1000000 });
  assert.equal(exact.allowed, true);
  assert.equal(exact.unlimited, true);
  const renewed = policy.entitlement({ anchor: "2026-07-18", today: "2026-11-18",
    goodsCents: 0, usedBills: 0, freeBills: 100,
    thresholdCents: 1000000 });
  assert.equal(renewed.cycleStartDate, "2026-11-18");
  assert.equal(renewed.remainingFreeBills, 100);
  assert.throws(() => policy.entitlement({ anchor: "2026-07-18",
    today: "2026-11-31", goodsCents: 0, usedBills: 0,
    freeBills: 100, thresholdCents: 1000000 }));
});
test("server scans only paid and non-refunded Delivery goods in Bangkok anniversary window", async () => {
  await tenantRef.set(tenant);
  const rows = [
    ["paid-goods", { orderType: "delivery", paymentStatus: "paid",
      status: "delivered", paidAt: Timestamp.fromDate(
        new Date("2026-10-20T12:00:00+07:00")), totalAmount: 1550,
      deliveryFee: 50, subtotalAmount: 1500 }],
    ["refunded-goods", { orderType: "delivery", paymentStatus: "paid",
      status: "delivered", paidAt: Timestamp.fromDate(
        new Date("2026-10-30T12:00:00+07:00")), totalAmount: 1050,
      deliveryFee: 50, subtotalAmount: 1000, refundTotal: 300 }],
    ["past-cycle", { orderType: "delivery", paymentStatus: "paid",
      status: "delivered", paidAt: Timestamp.fromDate(
        new Date("2026-10-17T12:00:00+07:00")), totalAmount: 5000, deliveryFee: 0 }],
    ["walkin", { orderType: "walk_in", paymentStatus: "paid",
      status: "completed", paidAt: Timestamp.fromDate(
        new Date("2026-10-27T12:00:00+07:00")), totalAmount: 20000 }],
    ["unpaid", { orderType: "delivery", paymentStatus: "pending",
      status: "pending", totalAmount: 30000 }],
  ];
  for (const [name, record] of rows)
    await tenantRef.collection("orders").doc(name).set(record);
  const outcome = await policy.verifiedCycleGoods({ tenantRef,
    start: new Date("2026-10-18T00:00:00+07:00"),
    end: new Date("2026-11-18T00:00:00+07:00") });
  assert.equal(outcome.goodsCents, 220000);
  assert.equal(outcome.source, "server_persisted_paid_delivery_goods");
});
test("Firestore transactions admit two unique bills, block 3rd, and replay one without provider call", async () => {
  const a = await policy.reserveMerchantBillCheck(input(id(1)));
  assert.equal(a.submitted, true);
  const replay = await policy.reserveMerchantBillCheck(input(id(1)));
  assert.equal(replay.submitted, false);
  assert.equal(replay.reused, true);
  assert.equal(replay.prior.status, "manual_review");
  const b = await policy.reserveMerchantBillCheck(input(id(2)));
  assert.equal(b.submitted, true);
  const third = await policy.reserveMerchantBillCheck(input(id(3)));
  assert.equal(third.quotaExhausted, true);
  assert.equal(third.submitted, false);
  const used = (await a.cycleRef.get()).data();
  assert.equal(used.usedBills, 2);
  assert.equal(used.freeBills, 2);
  await assert.rejects(policy.reserveMerchantBillCheck({
    ...input(id(2)), orderFingerprint: digest("tampered-cart"),
  }), /MERCHANT_SLIP_QUOTA_ORDER_CHANGED/);
});
test("rejected retry with new image keeps one bill slot; ambiguous outcome blocks replacement", async () => {
  const base = input(id(1));
  const [bill, cycle] = [policy.quotaRefs(tenantRef,
    "2026-10-18", id(1)).billRef,
    policy.quotaRefs(tenantRef, "2026-10-18", id(1)).cycleRef];
  await policy.completeMerchantBillCheck({
    db, billRef: bill, cycleRef: cycle, slipSha256: base.slipSha256,
    result: { provider: "slip2go", reason: "amount_not_matched" },
    publicResult: { status: "mismatch", reason: "amount_not_matched" },
  });
  const changed = await policy.reserveMerchantBillCheck(input(id(1), "B"));
  assert.equal(changed.submitted, true);
  assert.equal(changed.usedBills, 2);
  await assert.rejects(policy.reserveMerchantBillCheck(input(id(1), "C")),
    /MERCHANT_SLIP_QUOTA_PRIOR_CHECK_UNRESOLVED/);
  await assert.rejects(policy.reserveMerchantBillCheck({
    ...input(id(4)), slipSha256: base.slipSha256,
  }), /MERCHANT_SLIP_QUOTA_IMAGE_ALREADY_USED/);
  assert.equal((await cycle.get()).data().usedBills, 2);
});
test("provider credential failure releases merchant quota once while keeping audit", async () => {
  const a = await policy.reserveMerchantBillCheck({
    ...input(id(5)), freeBills: 2,
    goodsCents: 1000000,
  });
  assert.equal(a.submitted, true);
  const completed = await policy.completeMerchantBillCheck({
    db, billRef: a.billRef, cycleRef: a.cycleRef,
    slipSha256: input(id(5)).slipSha256,
    result: { provider: "slip2go", reason: "slip2go_config_invalid" },
    publicResult: { status: "manual_review", reason: "slip2go_config_invalid" },
  });
  assert.equal(completed.charged, false);
  assert.equal((await a.cycleRef.get()).data().usedBills, 2);
  await assert.rejects(policy.completeMerchantBillCheck({
    db, billRef: a.billRef, cycleRef: a.cycleRef,
    slipSha256: input(id(5)).slipSha256,
    result: { provider: "slip2go", reason: "slip2go_config_invalid" },
    publicResult: { status: "manual_review", reason: "slip2go_config_invalid" },
  }), /MERCHANT_SLIP_QUOTA_SETTLEMENT_UNCERTAIN/);
  const replay = await policy.reserveMerchantBillCheck(input(id(5)));
  assert.equal(replay.reused, true);
  assert.equal(replay.prior.reason, "provider_key_invalid");
});
test("unlimited entitlement still reserves unique provider checks without creating purchased provider credits", async () => {
  const r = await policy.reserveMerchantBillCheck({
    ...input(id(7)), goodsCents: 1000000,
  });
  assert.equal(r.submitted, true);
  assert.equal(r.unlimited, true);
  assert.equal((await r.cycleRef.get()).data().usedBills, 3);
});
test("same order concurrent reservation cannot spend twice; another tenant cannot reuse slip image", async () => {
  const [first, second] = await Promise.all([
    policy.reserveMerchantBillCheck(input(id(8), "A", 1000000)),
    policy.reserveMerchantBillCheck(input(id(8), "A", 1000000)),
  ]);
  assert.equal([first, second].filter(r => r.submitted).length, 1);
  assert.equal([first, second].filter(r => r.reused).length, 1);
  const otherTenant = db.collection("tenants").doc("p1-slip-other-" + randomUUID());
  await assert.rejects(policy.reserveMerchantBillCheck({
    ...input(id(9), "A", 1000000), tenantRef: otherTenant,
    slipSha256: input(id(8)).slipSha256,
  }), /MERCHANT_SLIP_QUOTA_IMAGE_ALREADY_USED/);
});
