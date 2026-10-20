"use strict";

// Phase 3I trusted server-side COD cashier payment candidate.
// NOT exported by functions/index.js and NOT reachable by clients or deployed.
// Future callable MUST take actorUid exclusively from verified request.auth.uid;
// never pass a client-supplied uid, role, amount, timestamp, or payment state.
const { FieldValue } = require("firebase-admin/firestore");
const { prepareCodReceiptJournal, journalReceiptIssue } = require("./hybrid-billing-receipt-journal");
const {assertHybridEpochDemoOptIn,requireHybridEpochAdmissionCandidate} = require("./hybrid-billing-writer-epoch-candidate");

const SAFE_ID = /^[A-Za-z0-9_-]{8,128}$/;
const CASHIER_ROLES = new Set(["owner", "admin", "cashier", "manager"]);
const DELIVERED_STATUSES = new Set(["served", "delivered", "completed"]);
const fail = code => { throw new Error(code); };
const validAmount = number => typeof number === "number"
  && Number.isFinite(number) && number >= 0 && number <= 1000000000
  && Number.isInteger(Math.round(number * 100))
  && Math.abs(number * 100 - Math.round(number * 100)) < 0.00001;

async function settleHybridCodDeliveryPayment({
  db, tenantId, orderId, actorUid,
  serverTimestamp = () => FieldValue.serverTimestamp(),
  clock = () => new Date(),
  epochAdmissionDemo = false, // source-only, explicit localhost demo opt-in
}) {
  assertHybridEpochDemoOptIn(epochAdmissionDemo);
  if (!db || !SAFE_ID.test(String(tenantId || ""))
    || !SAFE_ID.test(String(orderId || ""))
    || !SAFE_ID.test(String(actorUid || ""))) {
    fail("HYBRID_COD_INVALID_REQUEST");
  }
  const tenantRef = db.collection("tenants").doc(tenantId);
  const profileRef = db.collection("users").doc(actorUid);
  const orderRef = tenantRef.collection("orders").doc(orderId);
  return db.runTransaction(async tx => {
    const [tenantDoc, profileDoc, orderDoc] = await Promise.all([
      tx.get(tenantRef), tx.get(profileRef), tx.get(orderRef),
    ]);
    const tenant = tenantDoc.data() || {};
    if (!tenantDoc.exists || tenant.billingPolicyVersion !== "hybrid_v1"
      || tenant.hybridBillingEnabled !== true || tenant.active !== true
      || tenant.hybridBillingSuspended === true
      || tenant.businessType === "retail") fail("HYBRID_COD_TENANT_NOT_ENABLED");
    const profile = profileDoc.data() || {};
    const isSuperAdmin = profile.role === "super_admin";
    if (!profileDoc.exists || profile.active !== true
      || !(CASHIER_ROLES.has(profile.role) || isSuperAdmin)
      || (!isSuperAdmin && profile.tenantId !== tenantId)) {
      fail("HYBRID_COD_CASHIER_NOT_AUTHORIZED");
    }
    if (!orderDoc.exists) fail("HYBRID_COD_ORDER_NOT_FOUND");
    const order = orderDoc.data() || {};
    if (order.orderType !== "delivery" || order.paymentMethod !== "cod"
      || !validAmount(order.totalAmount) || order.totalAmount <= 0
      || !validAmount(order.deliveryFee ?? 0)
      || order.deliveryFee > order.totalAmount
      || !validAmount(order.subtotalAmount)
      || !Array.isArray(order.items) || order.items.length === 0
      || ["cancelled", "canceled", "voided", "deleted", "refunded"].includes(order.status)) {
      fail("HYBRID_COD_ORDER_NOT_ELIGIBLE");
    }
    const isLalamove = String(order.deliveryProvider || "").toLowerCase() === "lalamove";
    if (isLalamove) {
      // COMPLETED means delivery finished; it is not proof of COD settlement.
      // The courier settlement must be independently reconciled to the
      // merchant's actual receipt, not advanced by a cashier click.
      fail("HYBRID_COD_LALAMOVE_PROVIDER_SETTLEMENT_REQUIRED");
    }
    if (order.paymentStatus === "paid") {
      // Only a canonical trusted Firestore timestamp permits idempotency.
      if (!(order.paidAt?.toDate?.() instanceof Date)
        || !Number.isFinite(order.paidAt.toDate().getTime())) {
        fail("HYBRID_COD_EXISTING_PAYMENT_REQUIRES_RECONCILIATION");
      }
      if (order.paymentReceiptSource !== "hybrid_cod_cashier_server") {
        fail("HYBRID_COD_EXISTING_PAYMENT_REQUIRES_RECONCILIATION");
      }
      const event = await tx.get(tenantRef.collection("hybridBillingReceiptEvents").doc("cod-" + orderId));
      let issue;
      try { issue = journalReceiptIssue(orderId, order, event.exists ? event.data() : null, tenantId); }
      catch { issue = "unreviewed_financial_state"; }
      if (issue) fail("HYBRID_COD_JOURNAL_MISSING");
      return { ok: true, alreadyPaid: true, tenantId, orderId };
    }
    if (order.paymentStatus !== "unpaid") fail("HYBRID_COD_PAYMENT_STATUS_CONFLICT");
    if (!isLalamove && !DELIVERED_STATUSES.has(order.status)) {
      fail("HYBRID_COD_DELIVERY_NOT_COMPLETED");
    }
    const journalWrites = await prepareCodReceiptJournal({
      tx, tenantRef, order, tenantId, orderId, actorUid, now: clock(), serverTimestamp,
    });
    if (epochAdmissionDemo) await requireHybridEpochAdmissionCandidate({
      tx,tenantRef,sourceKey:"cod_cashier"});
    const patch = {
      paymentStatus: "paid",
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      paymentReceivedByUid: actorUid,
      paymentReceiptSource: "hybrid_cod_cashier_server",
    };
    if (order.status === "served") {
      patch.status = "paid";
      patch.completedAt = serverTimestamp();
    }
    tx.update(orderRef, patch);
    journalWrites();
    return { ok: true, alreadyPaid: false, tenantId, orderId };
  });
}

module.exports = { settleHybridCodDeliveryPayment };
