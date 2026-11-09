import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
if (!getApps().length) initializeApp({ projectId: "demo-penguin-hybrid" });
const db = getFirestore();
const fn = require("./delivery-slip");
const { normalizedItems } = require("./delivery-slip-policy");
const tenantId = "p1-review-" + randomUUID().slice(0, 17);
const tenantRef = db.collection("tenants").doc(tenantId);
const adminId = "p1-review-superadmin-" + randomUUID().slice(0, 6);
const cashierId = "p1-review-cashier-" + randomUUID().slice(0, 6);
const items = [{ id: "menu-simulated", qty: 1, price: 200 }];
const validTechnical = Object.freeze({
  provider: "slip2go", status: "manual_review",
  reason: "slip2go_bank_error", code: "200502",
  fallbackAllowed: true, amountMatched: null, receiverValidated: null,
});
const slug = "p1-review-store";
async function setupReview(id, proofPatch = {}, orderPatch = {}) {
  const slipPath = "tenants/" + tenantId + "/payment-slips/" + id + "/receipt.png";
  await tenantRef.collection("orders").doc(id).set({
    tenantId, id, orderType: "delivery", paymentMethod: "promptpay",
    paymentStatus: "pending_verification", paymentReviewRequired: true,
    status: "pending", items, subtotalAmount: 200, deliveryFee: 30,
    totalAmount: 230, paymentSlipPath: slipPath,
    ...orderPatch,
  });
  await tenantRef.collection("deliverySlipChecks").doc(id).set({
    tenantId, orderId: id, slipPath, amountCents: 23000,
    foodCents: 20000, feeCents: 3000,
    itemsSignature: normalizedItems(items), provider: "slip2go",
    status: "manual_review", providerAttempted: true,
    manualReviewEligible: true, manualReviewEvidence: validTechnical,
    ...proofPatch,
  });
}
test.before(async () => {
  await db.collection("users").doc(adminId).set({
    uid: adminId, role: "super_admin", active: true,
  });
  await db.collection("users").doc(cashierId).set({
    uid: cashierId, role: "cashier", tenantId, active: true,
  });
  await tenantRef.set({ slug, name: "Emulator Review Shop", active: true });
});
test("Super Admin worklist verifies proof and denies merchant Cashier scope", async () => {
  const id = "order-tech-001";
  await setupReview(id);
  await assert.rejects(fn.listPlatformDeliveryManualReviews.run({
    auth: { uid: cashierId }, data: { tenantId },
  }), e => e.code === "permission-denied");
  const res = await fn.listPlatformDeliveryManualReviews.run({
    auth: { uid: adminId }, data: { tenantId },
  });
  assert.equal(res.ok, true);
  assert.equal(res.paymentAuthority, false);
  assert.equal(res.items.find(row => row.id === id).eligible, true);
  await assert.rejects(fn.approveDeliveryPaymentReview.run({
    auth: { uid: cashierId }, data: { tenantId, orderId: id },
  }), e => e.code === "permission-denied");
  assert.equal((await tenantRef.collection("orders").doc(id).get()).data().paymentStatus,
    "pending_verification");
});
test("invalid, rejected, unverified and no-provider-call slips cannot settle", async () => {
  const cases = [
    { manualReviewEvidence: { ...validTechnical,
      reason: "amount_not_matched", status: "mismatch", fallbackAllowed: false }},
    { manualReviewEvidence: { ...validTechnical,
      reason: "slip2go_receiver_mismatch", status: "receiver_mismatch",
      fallbackAllowed: false }},
    { manualReviewEvidence: { ...validTechnical,
      reason: "slip2go_duplicate", status: "duplicate",
      fallbackAllowed: false }},
    { manualReviewEvidence: { ...validTechnical,
      reason: "slip2go_config_invalid", code: "401001", fallbackAllowed: true }},
    { providerAttempted: false },
    { manualReviewEligible: false },
    { manualReviewEvidence: null },
  ];
  for (let index = 0; index < cases.length; index++) {
    const id = "order-denied-" + String(index).padStart(3, "0");
    await setupReview(id, cases[index]);
    await assert.rejects(fn.approveDeliveryPaymentReview.run({
      auth: { uid: adminId }, data: { tenantId, orderId: id },
    }), e => e.code === "failed-precondition", id);
    assert.equal((await tenantRef.collection("orders").doc(id).get()).data().paymentStatus,
      "pending_verification", id);
    assert.equal((await tenantRef.collection("deliverySlipManualReviewAudit").doc(id).get()).exists,
      false);
  }
});
test("Super Admin technical fallback sets paid once with immutable audit and kitchen gate", async () => {
  const id = "order-tech-001";
  const res = await fn.approveDeliveryPaymentReview.run({
    auth: { uid: adminId }, data: { tenantId, orderId: id },
  });
  assert.equal(res.ok, true);
  const paid = (await tenantRef.collection("orders").doc(id).get()).data();
  assert.equal(paid.paymentStatus, "paid");
  assert.equal(paid.slipVerificationStatus, "superadmin_technical_fallback");
  assert.equal(paid.paymentReviewRequired, false);
  assert.ok(paid.kitchenReleasedAt);
  const audit = (await tenantRef.collection("deliverySlipManualReviewAudit").doc(id).get()).data();
  assert.equal(audit.kind, "slip2go_technical_fallback");
  assert.equal(audit.reviewerRole, "super_admin");
  assert.equal(audit.reviewedBy, adminId);
  const replay = await fn.approveDeliveryPaymentReview.run({
    auth: { uid: adminId }, data: { tenantId, orderId: id },
  });
  assert.equal(replay.alreadyPaid, true);
  assert.equal((await tenantRef.collection("deliverySlipManualReviewAudit").get()).size, 1);
});
