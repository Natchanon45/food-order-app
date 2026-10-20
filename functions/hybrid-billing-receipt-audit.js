"use strict";

// Read-only reconciliation inventory for old paid Delivery receipts. No ISO
// string is converted into a Timestamp and no invoice is rewritten.
// Super Admin caller must independently verify provenance before any migration.
const { paidDeliverySale } = require("./hybrid-billing-orders");
const SAFE_TENANT_ID = /^[A-Za-z0-9_-]{8,128}$/;
const SAFE_ORDER_ID = /^[A-Za-z0-9_-]{1,256}$/;

function receiptIssue(order) {
  const stamp = order?.paidAt?.toDate?.();
  if (!(stamp instanceof Date) || !Number.isFinite(stamp.getTime())) {
    return "noncanonical_paid_at";
  }
  try {
    paidDeliverySale(order);
  } catch {
    return "invalid_financial_fields";
  }
  return null;
}

/** One stable document-ID page. Caller authorizes Super Admin separately. */
async function scanHybridPaidReceiptExceptions({
  db, tenantId, afterId = null, pageSize = 100,
}) {
  if (!db || typeof tenantId !== "string" || !SAFE_TENANT_ID.test(tenantId)
    || (afterId !== null && (typeof afterId !== "string" || !SAFE_ORDER_ID.test(afterId)))
    || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 250) {
    throw Error("HYBRID_RECEIPT_SCAN_INVALID_REQUEST");
  }
  const ref = db.collection("tenants").doc(tenantId);
  const tenant = await ref.get();
  if (!tenant.exists || tenant.data()?.billingPolicyVersion !== "hybrid_v1"
    || tenant.data()?.hybridBillingEnabled !== true) {
    throw Error("HYBRID_RECEIPT_SCAN_TENANT_NOT_ENABLED");
  }
  let query = ref.collection("orders")
    .where("orderType", "==", "delivery")
    .where("paymentStatus", "==", "paid")
    .orderBy("__name__").limit(pageSize + 1);
  if (afterId) query = query.startAfter(afterId);
  const page = await query.get();
  if (!Array.isArray(page?.docs) || page.size !== page.docs.length
    || page.size > pageSize + 1) {
    throw Error("HYBRID_RECEIPT_SCAN_INCOMPLETE");
  }
  const docs = page.docs.slice(0, pageSize);
  const issues = [];
  for (const doc of docs) {
    const order = doc.data();
    if (!order || order.orderType !== "delivery"
      || order.paymentStatus !== "paid") {
      throw Error("HYBRID_RECEIPT_SCAN_SOURCE_CONFLICT");
    }
    const reason = receiptIssue(order);
    if (reason) issues.push({ orderId: doc.id, reason });
  }
  const hasMore = page.docs.length > pageSize;
  const nextAfterId = hasMore ? docs.at(-1)?.id : null;
  if (hasMore && !nextAfterId) throw Error("HYBRID_RECEIPT_SCAN_CURSOR_MISSING");
  return {
    tenantId, scanned: docs.length, issueCount: issues.length,
    issues, hasMore, nextAfterId,
    note: "read_only_requires_verified_payment_provenance",
  };
}
module.exports = { receiptIssue, scanHybridPaidReceiptExceptions };
