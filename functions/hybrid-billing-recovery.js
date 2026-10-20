"use strict";

// Source-only guarded human recovery after verified Hybrid settlements.
// NOT exported by functions/index.js. A future callable MUST derive reviewerUid
// from verified request.auth.uid; the caller must never supply a role/profile.
const { FieldValue } = require("firebase-admin/firestore");
const { dateKey, validDate } = require("./hybrid-billing-core");

const ID = /^[A-Za-z0-9_-]{8,128}$/;
const assertId = (value, label) => {
  if (typeof value !== "string" || !ID.test(value)) throw Error(label);
};
async function approveHybridRecovery({
  db, tenantId, reviewerUid, reviewId, now = new Date(),
  maxInvoices = 350, serverTimestamp = () => FieldValue.serverTimestamp(),
}) {
  if (!db || !(now instanceof Date) || !Number.isFinite(now.getTime())
    || !Number.isSafeInteger(maxInvoices) || maxInvoices < 1 || maxInvoices > 1000) {
    throw Error("HYBRID_RECOVERY_INVALID_INPUT");
  }
  assertId(tenantId, "HYBRID_RECOVERY_INVALID_TENANT");
  assertId(reviewerUid, "HYBRID_RECOVERY_INVALID_ACTOR");
  assertId(reviewId, "HYBRID_RECOVERY_INVALID_REVIEW_ID");
  const today = dateKey(now);
  validDate(today);
  const tenantRef = db.collection("tenants").doc(tenantId);
  const reviewerRef = db.collection("users").doc(reviewerUid);
  const auditRef = tenantRef.collection("hybridBillingRecoveryReviews").doc(reviewId);
  return db.runTransaction(async tx => {
    const [tenantSnap, reviewerSnap, prior] = await Promise.all([
      tx.get(tenantRef), tx.get(reviewerRef), tx.get(auditRef),
    ]);
    const reviewer = reviewerSnap.data() || {};
    if (!reviewerSnap.exists || reviewer.active !== true
      || reviewer.role !== "super_admin") {
      throw Error("HYBRID_RECOVERY_SUPER_ADMIN_REQUIRED");
    }
    if (prior.exists) {
      const row = prior.data() || {};
      if (row.reviewedBy !== reviewerUid || row.tenantId !== tenantId
        || row.result !== "reactivated") throw Error("HYBRID_RECOVERY_REVIEW_ID_CONFLICT");
      return { status: "already_reviewed", changed: false, reviewId };
    }
    const tenant = tenantSnap.data() || {};
    if (!tenantSnap.exists || tenant.billingPolicyVersion !== "hybrid_v1"
      || tenant.hybridBillingEnabled !== true
      || tenant.hybridBillingSuspended !== true
      || tenant.hybridBillingSuspensionSource !== "hybrid_v1"
      || tenant.active !== false
      || tenant.hybridBillingRecoveryRequiresReview !== true
      || !tenant.hybridBillingSuspendedAt
      || tenant.hybridBillingManualHold === true
      || tenant.manuallyDisabled === true) {
      throw Error("HYBRID_RECOVERY_NOT_ELIGIBLE");
    }
    const q = tenantRef.collection("hybridBillingInvoices")
      .where("suspendFrom", "<=", today).orderBy("suspendFrom").limit(maxInvoices + 1);
    const invoiceSnap = await tx.get(q);
    if (!invoiceSnap || !Array.isArray(invoiceSnap.docs)
      || invoiceSnap.size !== invoiceSnap.docs.length) {
      throw Error("HYBRID_RECOVERY_SCAN_INCOMPLETE");
    }
    if (invoiceSnap.size > maxInvoices) throw Error("HYBRID_RECOVERY_SCAN_LIMIT");
    const invoices = invoiceSnap.docs.map(row => row.data());
    const settlementRefs = invoices.map(row =>
      tenantRef.collection("hybridBillingSettlements").doc(row.invoiceId));
    const settlements = await Promise.all(settlementRefs.map(ref => tx.get(ref)));
    const unpaid = [];
    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i], settled = settlements[i];
      if (!invoice || invoice.tenantId !== tenantId || invoice.policyVersion !== "hybrid_v1"
        || typeof invoice.invoiceId !== "string"
        || !Number.isSafeInteger(invoice.amountCents) || invoice.amountCents <= 0) {
        throw Error("HYBRID_RECOVERY_INVALID_INVOICE");
      }
      const s = settled.data() || {};
      if (!settled.exists) {
        unpaid.push(invoice.invoiceId);
      } else if (s.tenantId !== tenantId || s.invoiceId !== invoice.invoiceId
        || s.amountCents !== invoice.amountCents
        || typeof s.bankReferenceHash !== "string" || s.bankReferenceHash.length !== 64
        || !(s.approvedAt?.toDate?.() instanceof Date)) {
        throw Error("HYBRID_RECOVERY_INVALID_SETTLEMENT");
      }
    }
    if (unpaid.length) throw Error("HYBRID_RECOVERY_UNPAID:" + unpaid.join(","));
    const originallyDue = tenant.hybridBillingSuspendedDueIds;
    if (!Array.isArray(originallyDue) || originallyDue.length === 0
      || originallyDue.some(id => typeof id !== "string" || !invoices.some(inv => inv.invoiceId === id))) {
      throw Error("HYBRID_RECOVERY_ORIGINAL_DEBT_MISSING");
    }
    // Only a verified human reviewer may clear the exact Hybrid suspension;
    // a manual/admin hold remains out of scope. Do not clear other disable flags.
    tx.create(auditRef, {
      tenantId, reviewId, reviewedBy: reviewerUid, result: "reactivated",
      paidInvoiceIds: invoices.map(row => row.invoiceId).sort(),
      createdAt: serverTimestamp(),
    });
    tx.update(tenantRef, {
      active: true, hybridBillingSuspended: false,
      hybridBillingRecoveryRequiresReview: false,
      hybridBillingRecoveredBy: reviewerUid,
      hybridBillingRecoveredAt: serverTimestamp(),
      hybridBillingRecoveryReviewId: reviewId,
    });
    return { status: "reactivated", changed: true, reviewId };
  });
}
module.exports = { approveHybridRecovery };
