"use strict";

// Merchant free-Slip2Go entitlement is a unique CHECKED DELIVERY BILL count,
// not number of uploads, HTTP retries or Platform's purchased provider tokens.
// The cycle follows the original Bangkok activation anniversary.
// This module does NOT approve an order, release a kitchen or settle money.
const { createHash } = require("node:crypto");
const { Timestamp, FieldValue } = require("firebase-admin/firestore");
const { tenantAnchorDate, bangkokDateKey, cycleForDate } =
  require("./billing-anniversary");
const { paidDeliverySale } = require("./hybrid-billing-orders");

const MAX_PAID_ORDERS = 50000;
const PAGE = 500;
const MAX_USAGE = 1000000000;
const MAX_FREE = 1000000;
const ORDER_ID = /^[A-Za-z0-9_-]{8,128}$/;
const HASH = /^[a-f0-9]{64}$/;
const COUNTED = new Set(["request_sent", "matched", "rejected", "unknown"]);
const NON_BILLABLE = new Set([
  "slip2go_config_invalid", "slip2go_quota_exhausted",
  "slip2go_package_expired", "slip2go_rate_limited",
]);

function checkedInt(value, max, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max)
    throw new Error("MERCHANT_SLIP_QUOTA_" + label + "_INVALID");
  return value;
}
function entitlement({ anchor, today, goodsCents, usedBills, freeBills,
  thresholdCents, alreadyRecorded = false }) {
  checkedInt(goodsCents, Number.MAX_SAFE_INTEGER, "GOODS");
  checkedInt(usedBills, MAX_USAGE, "USED");
  checkedInt(freeBills, MAX_FREE, "PRICE");
  checkedInt(thresholdCents, Number.MAX_SAFE_INTEGER, "THRESHOLD");
  if (thresholdCents <= 0) throw Error("MERCHANT_SLIP_QUOTA_THRESHOLD_INVALID");
  if (typeof alreadyRecorded !== "boolean") throw Error("MERCHANT_SLIP_QUOTA_REPLAY_INVALID");
  const cycle = cycleForDate(anchor, today);
  if (!cycle) throw Error("MERCHANT_SLIP_QUOTA_ACTIVATION_REQUIRED");
  const remaining = Math.max(0, freeBills - usedBills);
  const unlimited = goodsCents >= thresholdCents;
  return Object.freeze({
    cycleStartDate: cycle.startDate, cycleEndDate: cycle.endDate,
    cycleResetDate: cycle.endExclusiveDate, freeBills,
    usedBills, remainingFreeBills: remaining, unlimited,
    allowed: alreadyRecorded || unlimited || remaining > 0,
    goodsCents, thresholdCents,
  });
}

// Read source data even when delivery is not yet settled, but count ONLY paid
// and non-refunded Delivery merchandise. Historical invalid paidAt must not
// silently create "zero sales" authority to block merchant entitlement.
async function verifiedCycleGoods({ tenantRef, start, end }) {
  if (!tenantRef?.collection || !(start instanceof Date)
    || !(end instanceof Date) || !(end > start)) {
    throw Error("MERCHANT_SLIP_QUOTA_SOURCE_REQUIRED");
  }
  let cursor = null, scanned = 0, goodsCents = 0;
  do {
    let query = tenantRef.collection("orders").where("paymentStatus", "==", "paid")
      .limit(PAGE);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    for (const item of snap.docs) {
      scanned++;
      if (scanned > MAX_PAID_ORDERS)
        throw Error("MERCHANT_SLIP_QUOTA_SOURCE_TOO_LARGE");
      const row = item.data() || {};
      if (row.orderType !== "delivery") continue;
      const sale = paidDeliverySale(row);
      if (!sale) continue;
      const paid = typeof row.paidAt?.toDate === "function"
        ? row.paidAt.toDate() : row.paidAt;
      if (!(paid instanceof Date) || !Number.isFinite(paid.getTime())) {
        throw Error("MERCHANT_SLIP_QUOTA_INVALID_PAID_AT");
      }
      if (paid < start || paid >= end) continue;
      goodsCents += Math.round(sale.amount * 100);
      if (!Number.isSafeInteger(goodsCents))
        throw Error("MERCHANT_SLIP_QUOTA_GOODS_OVERFLOW");
    }
    if (snap.size < PAGE) break;
    cursor = snap.docs.at(-1);
  } while (true);
  return Object.freeze({ goodsCents, scannedOrders: scanned,
    source: "server_persisted_paid_delivery_goods" });
}

function fingerprintOrder({ orderId, amountCents, foodCents, feeCents,
  itemsSignature, receiverAccount }) {
  if (!ORDER_ID.test(String(orderId || "")) || typeof itemsSignature !== "string"
    || itemsSignature.length > 16000
    || typeof receiverAccount !== "string"
    || !/^[0-9]{10}$|^[0-9]{13}$/.test(receiverAccount)) {
    throw Error("MERCHANT_SLIP_QUOTA_BINDING_INVALID");
  }
  [amountCents, foodCents, feeCents].forEach(v =>
    checkedInt(v, Number.MAX_SAFE_INTEGER, "AMOUNT"));
  if (foodCents + feeCents !== amountCents)
    throw Error("MERCHANT_SLIP_QUOTA_BINDING_INVALID");
  return createHash("sha256").update(JSON.stringify([
    orderId, amountCents, foodCents, feeCents, itemsSignature, receiverAccount,
  ])).digest("hex");
}
function quotaRefs(tenantRef, cycleStartDate, orderId) {
  if (!ORDER_ID.test(orderId) || !/^\d{4}-\d{2}-\d{2}$/.test(cycleStartDate))
    throw Error("MERCHANT_SLIP_QUOTA_REFERENCE_INVALID");
  return {
    cycleRef: tenantRef.collection("merchantSlipQuotaCycles").doc(cycleStartDate),
    billRef: tenantRef.collection("merchantSlipBillChecks").doc(cycleStartDate + "-" + orderId),
  };
}
function previousResponse(row = {}) {
  if (row.status === "matched")
    return { status: "manual_review", reason: "prior_matched_proof_must_be_confirmed" };
  if (row.status === "rejected") return row.publicResult || {
    status: "invalid", reason: "prior_provider_rejection",
  };
  return { status: "manual_review",
    reason: row.status === "auth_invalid" ? "provider_key_invalid"
      : "prior_provider_check_unresolved" };
}
async function reserveMerchantBillCheck({
  db, tenantRef, tenant, orderId, slipSha256, orderFingerprint,
  goodsCents, freeBills, thresholdCents, now = new Date(),
}) {
  if (!db?.runTransaction || !tenantRef?.id
    || !ORDER_ID.test(orderId) || !HASH.test(slipSha256)
    || !HASH.test(orderFingerprint))
    throw Error("MERCHANT_SLIP_QUOTA_REQUEST_INVALID");
  const anchor = tenantAnchorDate(tenant);
  if (!anchor) throw Error("MERCHANT_SLIP_QUOTA_ACTIVATION_REQUIRED");
  const day = bangkokDateKey(now);
  const calculated = entitlement({ anchor, today: day, goodsCents,
    usedBills: 0, freeBills, thresholdCents });
  const { cycleRef, billRef } = quotaRefs(tenantRef, calculated.cycleStartDate, orderId);
  const imageRef = db.collection("merchantSlipImageClaims").doc(slipSha256);
  return db.runTransaction(async tx => {
    // The transaction is the single serialization point for every unique
    // tenant bill in the activation-anniversary cycle.
    const [cycleSnap, billSnap, imageSnap] = await Promise.all([
      tx.get(cycleRef), tx.get(billRef), tx.get(imageRef),
    ]);
    const saved = cycleSnap.data() || {};
    const used = cycleSnap.exists
      ? checkedInt(saved.usedBills, MAX_USAGE, "USED") : 0;
    if (cycleSnap.exists && (
      saved.cycleStartDate !== calculated.cycleStartDate
      || saved.cycleResetDate !== calculated.cycleResetDate
      || !Number.isSafeInteger(saved.freeBills)
      || !Number.isSafeInteger(saved.thresholdCents)
      || saved.freeBills < 0 || saved.thresholdCents <= 0
    )) throw Error("MERCHANT_SLIP_QUOTA_CYCLE_UNTRUSTED");
    const frozenFree = cycleSnap.exists ? saved.freeBills : freeBills;
    const frozenThreshold = cycleSnap.exists ? saved.thresholdCents : thresholdCents;
    const prior = billSnap.data() || {};
    const already = billSnap.exists;
    if (already && prior.orderFingerprint !== orderFingerprint)
      throw Error("MERCHANT_SLIP_QUOTA_ORDER_CHANGED");
    if (imageSnap.exists && (
      imageSnap.data()?.tenantId !== tenantRef.id
      || imageSnap.data()?.orderId !== orderId
    )) throw Error("MERCHANT_SLIP_QUOTA_IMAGE_ALREADY_USED");
    if (already && prior.slipSha256 === slipSha256)
      return { submitted: false, prior: previousResponse(prior),
        usedBills: used, cycleStartDate: calculated.cycleStartDate,
        reused: true };
    if (already && (prior.status !== "rejected"
      || !Number.isSafeInteger(prior.attempts)
      || prior.attempts >= 3 || !Array.isArray(prior.priorHashes)
      || prior.priorHashes.includes(slipSha256)))
      throw Error("MERCHANT_SLIP_QUOTA_PRIOR_CHECK_UNRESOLVED");
    const allowance = entitlement({ anchor, today: day,
      goodsCents, usedBills: used, freeBills: frozenFree,
      thresholdCents: frozenThreshold, alreadyRecorded: already });
    if (!allowance.allowed)
      return { submitted: false, quotaExhausted: true,
        usedBills: used, cycleStartDate: allowance.cycleStartDate };
    const nextBill = {
      tenantId: tenantRef.id, orderId,
      cycleStartDate: allowance.cycleStartDate,
      orderFingerprint, slipSha256, status: "request_sent",
      attempts: already ? prior.attempts + 1 : 1,
      priorHashes: already ? [...prior.priorHashes, slipSha256] : [slipSha256],
      updatedAt: FieldValue.serverTimestamp(),
      publicResult: null,
    };
    if (already) tx.update(billRef, nextBill);
    else tx.create(billRef, { ...nextBill, createdAt: FieldValue.serverTimestamp() });
    if (!imageSnap.exists) tx.create(imageRef, {
      tenantId: tenantRef.id, orderId,
      cycleStartDate: allowance.cycleStartDate,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (cycleSnap.exists) tx.update(cycleRef, {
      usedBills: used + (already ? 0 : 1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    else tx.create(cycleRef, {
      tenantId: tenantRef.id,
      cycleStartDate: allowance.cycleStartDate,
      cycleResetDate: allowance.cycleResetDate,
      freeBills: frozenFree, thresholdCents: frozenThreshold,
      usedBills: used + 1, createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { submitted: true, billRef, cycleRef, usedBills: used + (already ? 0 : 1),
      cycleStartDate: allowance.cycleStartDate, unlimited: allowance.unlimited };
  });
}
async function completeMerchantBillCheck({
  db, billRef, cycleRef, slipSha256, result, publicResult,
}) {
  if (!db?.runTransaction || !billRef?.id || !cycleRef?.id
    || !HASH.test(String(slipSha256)) || !publicResult
    || !["matched", "invalid", "duplicate", "mismatch", "receiver_mismatch",
      "manual_review"].includes(publicResult.status))
    throw Error("MERCHANT_SLIP_QUOTA_RESULT_INVALID");
  const reason = String(result?.reason || "");
  const authInvalid = NON_BILLABLE.has(reason) && result?.provider === "slip2go";
  const state = authInvalid ? "auth_invalid"
    : publicResult.status === "matched" ? "matched"
    : ["invalid", "duplicate", "mismatch", "receiver_mismatch"].includes(publicResult.status)
      ? "rejected" : "unknown";
  return db.runTransaction(async tx => {
    const [snap, cycleSnap] = await Promise.all([
      tx.get(billRef), tx.get(cycleRef),
    ]);
    const bill = snap.data() || {}, cycle = cycleSnap.data() || {};
    if (!snap.exists || bill.status !== "request_sent"
      || bill.slipSha256 !== slipSha256 || !cycleSnap.exists) {
      throw Error("MERCHANT_SLIP_QUOTA_SETTLEMENT_UNCERTAIN");
    }
    const used = checkedInt(cycle.usedBills, MAX_USAGE, "USED");
    if (authInvalid && used < 1)
      throw Error("MERCHANT_SLIP_QUOTA_COUNTER_INVALID");
    tx.update(billRef, {
      status: state,
      reason: reason.slice(0, 80),
      publicResult,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (authInvalid) tx.update(cycleRef, {
      usedBills: used - 1, updatedAt: FieldValue.serverTimestamp(),
    });
    return { state, charged: !authInvalid };
  });
}
module.exports = { entitlement, verifiedCycleGoods, fingerprintOrder,
  reserveMerchantBillCheck, completeMerchantBillCheck, quotaRefs, COUNTED };
