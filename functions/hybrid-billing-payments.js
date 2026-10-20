"use strict";

// Phase 3B server-only payment review primitives. Not callable/deployed.
// A submitted bank slip is evidence, NEVER a settlement or proof of payment.
const { createHash } = require("node:crypto");
const { FieldValue } = require("firebase-admin/firestore");
const { validDate } = require("./hybrid-billing-core");

const safeId = value => typeof value === "string" && /^[A-Za-z0-9_-]{12,128}$/.test(value);
const safeTenant = value => typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value);
// Invoice IDs use the FULL signup-anniversary cycle start YYYY-MM-DD.
// Never accept old calendar-month IDs or impossible dates in bank settlement.
const safeInvoice = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}:(?:delivery:(?:trigger|\d{4}-\d{2}-\d{2})|monthly:fixed)$/.test(value)) {
    return false;
  }
  try {
    validDate(value.slice(0, 10));
    if (value.includes(":delivery:") && !value.endsWith(":trigger")) {
      validDate(value.slice(-10));
    }
    return true;
  } catch {
    return false;
  }
};
const bankReference = value => typeof value === "string" && /^[A-Za-z0-9._/: -]{6,160}$/.test(value.trim());
const referenceHash = value => createHash("sha256").update("hybrid_v1:" + value.trim().toUpperCase()).digest("hex");

function assertTrustedActor(profile, { tenantId, superAdmin = false } = {}) {
  if (!profile || !profile.uid || profile.active === false) throw new Error("HYBRID_AUTH_REQUIRED");
  if (superAdmin) {
    if (profile.role !== "super_admin") throw new Error("HYBRID_SUPER_ADMIN_REQUIRED");
  } else if (profile.tenantId !== tenantId || !["owner", "admin"].includes(profile.role)) {
    throw new Error("HYBRID_OWNER_REQUIRED");
  }
}

function assertInvoice(invoice, tenantId, invoiceId) {
  if (!invoice || invoice.tenantId !== tenantId || invoice.invoiceId !== invoiceId
    || invoice.policyVersion !== "hybrid_v1" || !Number.isSafeInteger(invoice.amountCents)
    || invoice.amountCents <= 0 || invoice.currency !== "THB") {
    throw new Error("HYBRID_INVOICE_INVALID");
  }
}

/**
 * The caller (future callable) must load actor profile from Admin Firestore, not
 * accept a client-supplied profile. Storage metadata must also be checked by
 * the caller before invoking this function.
 */
async function submitHybridPaymentEvidence({ db, tenantId, invoiceId, attemptId, slipPath,
  verifiedStorage, actor, serverTimestamp = () => FieldValue.serverTimestamp() }) {
  if (!safeTenant(tenantId) || !safeInvoice(invoiceId) || !safeId(attemptId)
    || typeof slipPath !== "string"
    || !slipPath.startsWith("tenants/" + tenantId + "/hybrid-billing-slips/" + attemptId + "/")
    || slipPath.length > 550 || verifiedStorage !== true) {
    throw new Error("HYBRID_EVIDENCE_INVALID");
  }
  assertTrustedActor(actor, { tenantId });
  const tenantRef = db.collection("tenants").doc(tenantId);
  const invoiceRef = tenantRef.collection("hybridBillingInvoices").doc(invoiceId);
  const settlementRef = tenantRef.collection("hybridBillingSettlements").doc(invoiceId);
  const evidenceRef = tenantRef.collection("hybridBillingEvidence").doc(attemptId);
  return db.runTransaction(async tx => {
    const [tenant, invoice, settled, prior] = await Promise.all([
      tx.get(tenantRef), tx.get(invoiceRef), tx.get(settlementRef), tx.get(evidenceRef),
    ]);
    if (!tenant.exists || tenant.data()?.billingPolicyVersion !== "hybrid_v1"
      || tenant.data()?.hybridBillingEnabled !== true) throw new Error("HYBRID_TENANT_NOT_ACTIVATED");
    assertInvoice(invoice.data(), tenantId, invoiceId);
    if (prior.exists) {
      const old = prior.data() || {};
      if (old.tenantId !== tenantId || old.invoiceId !== invoiceId || old.slipPath !== slipPath
        || old.submittedBy !== actor.uid) throw new Error("HYBRID_EVIDENCE_ID_CONFLICT");
      return { attemptId, status: "pending_review", alreadySubmitted: true };
    }
    if (settled.exists) throw new Error("HYBRID_INVOICE_ALREADY_SETTLED");
    tx.create(evidenceRef, {
      tenantId, invoiceId, attemptId, slipPath, amountCents: invoice.data().amountCents,
      status: "pending_review", submittedBy: actor.uid, createdAt: serverTimestamp(),
    });
    return { attemptId, status: "pending_review", alreadySubmitted: false };
  });
}

/**
 * Manual acceptance represents a real Super Admin's independent reconciliation
 * with bank records: reference, exact amount AND recipient must be attested.
 * An untrusted caller may never pass a self-attested "verified" result. Future
 * callable MUST derive reviewer from Firestore and check authorization before
 * invoking this internal function; Slip2Go auto-approval is NOT wired yet.
 */
async function reviewHybridPaymentEvidence({ db, tenantId, attemptId, actor,
  decision, bankTxnRef = "", confirmedAmountCents, recipientConfirmed = false,
  verificationNote = "", serverTimestamp = () => FieldValue.serverTimestamp() }) {
  if (!safeTenant(tenantId) || !safeId(attemptId) || !["approve", "reject"].includes(decision)) {
    throw new Error("HYBRID_REVIEW_INVALID");
  }
  assertTrustedActor(actor, { superAdmin: true });
  if (decision === "approve" && (!bankReference(bankTxnRef)
    || !Number.isSafeInteger(confirmedAmountCents) || recipientConfirmed !== true)) {
    throw new Error("HYBRID_BANK_RECONCILIATION_REQUIRED");
  }
  const tenantRef = db.collection("tenants").doc(tenantId);
  const evidenceRef = tenantRef.collection("hybridBillingEvidence").doc(attemptId);
  const reviewRef = tenantRef.collection("hybridBillingReviews").doc(attemptId);
  const receiptRef = db.collection("platformHybridPaymentReferences").doc(referenceHash(bankTxnRef || attemptId));
  return db.runTransaction(async tx => {
    const [tenant, evidence, review, receipt] = await Promise.all([
      tx.get(tenantRef), tx.get(evidenceRef), tx.get(reviewRef), tx.get(receiptRef),
    ]);
    if (!tenant.exists || tenant.data()?.billingPolicyVersion !== "hybrid_v1") {
      throw new Error("HYBRID_TENANT_NOT_FOUND");
    }
    if (!evidence.exists || evidence.data()?.tenantId !== tenantId
      || evidence.data()?.attemptId !== attemptId) throw new Error("HYBRID_EVIDENCE_NOT_FOUND");
    const proof = evidence.data();
    if (!safeInvoice(proof.invoiceId)) throw new Error("HYBRID_INVOICE_INVALID");
    const invoiceRef = tenantRef.collection("hybridBillingInvoices").doc(proof.invoiceId);
    const settlementRef = tenantRef.collection("hybridBillingSettlements").doc(proof.invoiceId);
    const [invoice, settled] = await Promise.all([tx.get(invoiceRef), tx.get(settlementRef)]);
    assertInvoice(invoice.data(), tenantId, proof.invoiceId);
    if (proof.amountCents !== invoice.data().amountCents) throw new Error("HYBRID_EVIDENCE_AMOUNT_CHANGED");
    if (review.exists) {
      if (review.data()?.decision !== decision
        || (decision === "approve" && review.data()?.bankReferenceHash !== referenceHash(bankTxnRef))) {
        throw new Error("HYBRID_REVIEW_FINAL_DECISION_CONFLICT");
      }
      return { invoiceId: proof.invoiceId, attemptId, decision, alreadyReviewed: true };
    }
    if (decision === "approve") {
      if (confirmedAmountCents !== invoice.data().amountCents) throw new Error("HYBRID_PAYMENT_AMOUNT_MISMATCH");
      if (settled.exists) throw new Error("HYBRID_INVOICE_ALREADY_SETTLED");
      if (receipt.exists && (receipt.data()?.tenantId !== tenantId
        || receipt.data()?.invoiceId !== proof.invoiceId
        || receipt.data()?.attemptId !== attemptId)) throw new Error("HYBRID_DUPLICATE_BANK_REFERENCE");
      if (!receipt.exists) tx.create(receiptRef, {
        tenantId, invoiceId: proof.invoiceId, attemptId, referenceHash: referenceHash(bankTxnRef),
        recordedAt: serverTimestamp(),
      });
      tx.create(settlementRef, {
        tenantId, invoiceId: proof.invoiceId, amountCents: invoice.data().amountCents,
        bankReferenceHash: referenceHash(bankTxnRef), source: "manual_bank_reconciled",
        evidenceId: attemptId, approvedBy: actor.uid, approvedAt: serverTimestamp(),
      });
    }
    tx.create(reviewRef, {
      tenantId, invoiceId: proof.invoiceId, attemptId,
      decision, reviewedBy: actor.uid, reviewedAt: serverTimestamp(),
      verificationMethod: decision === "approve" ? "manual_bank_reconciled" : "rejected",
      bankReferenceHash: decision === "approve" ? referenceHash(bankTxnRef) : null,
      note: String(verificationNote || "").trim().slice(0, 500),
    });
    return { invoiceId: proof.invoiceId, attemptId, decision, alreadyReviewed: false };
  });
}
module.exports = {
  assertTrustedActor, submitHybridPaymentEvidence, reviewHybridPaymentEvidence,
};
