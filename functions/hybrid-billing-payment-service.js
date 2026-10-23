"use strict";

// PRIVATE SERVICE, excluded from bootstrap.js; no Cloud Function or public
// action is registered. The existing legacy finance/reference registries
// still need shared atomic deduplication before any payment go-live.
const {
  prepareHybridInvoiceProof, stageHybridInvoiceProof, reviewHybridInvoiceProof,
} = require("./hybrid-billing-payment");
const { validInvoiceId } = require("./hybrid-billing-payment-policy");

async function actorProfile(db, auth) {
  const uid = String(auth?.uid || "");
  if (!/^[a-zA-Z0-9_-]{3,160}$/.test(uid)) {
    throw new Error("HYBRID_PAYMENT_AUTH_REQUIRED");
  }
  const snap = await db.collection("users").doc(uid).get();
  const profile = snap.exists ? snap.data() : null;
  if (!profile || profile.active === false) throw new Error("HYBRID_PAYMENT_INACTIVE_PROFILE");
  return { uid, ...profile };
}
async function tenantAdmin(db, auth, tenantId) {
  const actor = await actorProfile(db, auth);
  if (!["owner", "admin"].includes(actor.role)
    || String(actor.tenantId || "") !== tenantId) {
    throw new Error("HYBRID_PAYMENT_TENANT_ADMIN_REQUIRED");
  }
  return actor;
}
async function financeReviewer(db, auth) {
  const reviewer = await actorProfile(db, auth);
  if (reviewer.role !== "super_admin") throw new Error("HYBRID_PAYMENT_SUPER_ADMIN_REQUIRED");
  return reviewer;
}
async function assertNoLegacyReferenceUse(db, verification = {}) {
  // Fail closed if the Firestore collection-group checks cannot be completed.
  // This is a compatibility check, NOT a shared atomic registry with the
  // legacy revenue-share writer. It does not authorize AUTO payment release.
  if (!db?.collectionGroup) throw new Error("HYBRID_PAYMENT_LEGACY_DUPLICATE_SCAN_UNAVAILABLE");
  for (const collection of ["revenueSharePayments", "lalamoveWalletTopups"]) {
    for (const [field, val] of [
      ["slip2GoReferenceId", verification.referenceId],
      ["slip2GoTransRef", verification.transRef],
    ]) {
      if (!val) continue;
      const snapshot = await db.collectionGroup(collection)
        .where(field, "==", val).limit(1).get();
      if (!snapshot.empty) {
        throw new Error("HYBRID_PAYMENT_ALREADY_USED_BY_LEGACY_BILLING_OR_WALLET");
      }
    }
  }
}
/**
 * Authenticated but privately invoked. Does not accept totals, paid status,
 * recipient bank details or verifier outcomes from the request body.
 */
async function submitTrustedHybridProof({
  db, bucket, auth, tenantId, invoiceId, attemptId, slipPath,
  inspectSlip, serverTimestamp,
}) {
  await tenantAdmin(db, auth, tenantId);
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) throw new Error("HYBRID_PAYMENT_TENANT_NOT_FOUND");
  const prepared = await prepareHybridInvoiceProof({
    tenantRef, invoiceId, attemptId, slipPath, bucket, inspectSlip,
  });
  await assertNoLegacyReferenceUse(db, prepared.verification);
  return stageHybridInvoiceProof({
    db, tenantRef, prepared, actorId: auth.uid, serverTimestamp,
  });
}
/**
 * Only an ACTIVE Super Admin may review. First re-check legacy bank
 * references; an approved payment is a financial event, not account unlock.
 */
async function reviewTrustedHybridProof({
  db, auth, tenantId, invoiceId, attemptId,
  action, note, verifiedExternally, serverTimestamp,
}) {
  const actor = await financeReviewer(db, auth);
  validInvoiceId(invoiceId);
  const tenantRef = db.collection("tenants").doc(tenantId);
  const attemptSnap = await tenantRef.collection("hybridBillingPaymentAttempts")
    .doc(attemptId).get();
  if (!attemptSnap.exists) throw new Error("HYBRID_PAYMENT_REVIEW_RECORD_NOT_FOUND");
  const record = attemptSnap.data();
  if (record.invoiceId !== invoiceId || record.tenantId !== tenantId) {
    throw new Error("HYBRID_PAYMENT_CROSS_TENANT_ATTEMPT");
  }
  await assertNoLegacyReferenceUse(db, record.verification);
  return reviewHybridInvoiceProof({
    db, tenantRef, invoiceId, attemptId, action, note,
    verifiedExternally, reviewerId: actor.uid, serverTimestamp,
  });
}
async function listTrustedTenantHybridInvoices({
  db, auth, tenantId, limit = 50,
}) {
  const actor = await actorProfile(db, auth);
  if (actor.role !== "super_admin"
    && (!["owner", "admin"].includes(actor.role) || actor.tenantId !== tenantId)) {
    throw new Error("HYBRID_PAYMENT_INVOICE_LIST_FORBIDDEN");
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError("HYBRID_PAYMENT_INVALID_LIST_LIMIT");
  }
  const invoices = await db.collection("tenants").doc(tenantId)
    .collection("hybridBillingInvoices")
    .orderBy("date", "desc").limit(limit).get();
  return invoices.docs.map(doc => ({
    id: doc.id, ...doc.data(),
    // Do not expose secrets or internal slip-verification raw payload here.
  }));
}

module.exports = {
  actorProfile, tenantAdmin, financeReviewer, assertNoLegacyReferenceUse,
  submitTrustedHybridProof, reviewTrustedHybridProof, listTrustedTenantHybridInvoices,
};
