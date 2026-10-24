"use strict";

// PRIVATE PHASE 10 FINANCE RECORDS, NOT a payment/refund runner.
// No Production callables, payout, Wallet writes, invoice mutation or tenant
// access changes. A finance approval only approves a proposed adjustment.
const { prepareHybridAdjustmentProposal } = require("./hybrid-billing-finance-policy");
const { satang, validId, validInvoiceId } = require("./hybrid-billing-payment-policy");

function actorId(uid) {
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(uid || ""))) {
    throw new Error("HYBRID_ADJUSTMENT_AUTH_REQUIRED");
  }
  return uid;
}
function bounds({ db, tenantRef, invoiceId, adjustmentId, actorUid, serverTimestamp }) {
  if (!db?.runTransaction || !db.collection || !tenantRef?.collection
    || !tenantRef?.get || !serverTimestamp) {
    throw new Error("HYBRID_ADJUSTMENT_TRUSTED_TRANSACTION_REQUIRED");
  }
  validInvoiceId(invoiceId);
  validId(adjustmentId, "ADJUSTMENT_ID");
  actorId(actorUid);
  return {
    userRef: db.collection("users").doc(actorUid),
    invoiceRef: tenantRef.collection("hybridBillingInvoices").doc(invoiceId),
    adjustmentRef: tenantRef.collection("hybridBillingAdjustments").doc(adjustmentId),
    balanceRef: tenantRef.collection("hybridBillingAdjustmentBalances").doc(invoiceId),
    decisionRef: tenantRef.collection("hybridBillingAdjustmentEvents")
      .doc(adjustmentId + "-review"),
  };
}
function requireReviewer(snap) {
  const person = snap?.exists ? snap.data() : null;
  if (!person || person.active !== true || person.role !== "super_admin") {
    throw new Error("HYBRID_ADJUSTMENT_SUPER_ADMIN_REQUIRED");
  }
}
function readTrustedInvoice(snapshot, tenantId, invoiceId) {
  if (!snapshot?.exists) throw new Error("HYBRID_ADJUSTMENT_INVOICE_NOT_FOUND");
  const record = snapshot.data() || {};
  if (record.id !== invoiceId || (record.tenantId != null && record.tenantId !== tenantId)) {
    throw new Error("HYBRID_ADJUSTMENT_INVOICE_IDENTITY_CHANGED");
  }
  return record;
}
function validateBalance(snapshot, tenantId, invoice) {
  if (!snapshot.exists) return { exists: false, count: 0, reservedCents: 0 };
  const b = snapshot.data() || {};
  if (b.tenantId !== tenantId || b.invoiceId !== invoice.id
    || b.invoiceSignature !== invoice.signature
    || b.invoiceAmountCents !== satang(invoice.amount)
    || !Number.isSafeInteger(b.reservedCents) || b.reservedCents < 0
    || b.reservedCents > b.invoiceAmountCents
    || !Number.isSafeInteger(b.count) || b.count < 1 || b.count > 500) {
    throw new Error("HYBRID_ADJUSTMENT_BALANCE_CORRUPT");
  }
  return { exists: true, count: b.count, reservedCents: b.reservedCents };
}
function cleanNote(value, min) {
  if (typeof value !== "string" || value.trim().length < min
    || value.trim().length > 500) throw new Error("HYBRID_ADJUSTMENT_REVIEW_NOTE_REQUIRED");
  return value.trim().replace(/(?:[0-9๐-๙][\s.-]?){8,20}/g, "[redacted]");
}
function strictFields(data, fields) {
  if (!data || typeof data !== "object" || Array.isArray(data)
    || Object.keys(data).some(field => !fields.includes(field))) {
    throw new Error("HYBRID_ADJUSTMENT_UNTRUSTED_FIELDS");
  }
}

/**
 * Server-only Super Admin proposal. The per-invoice balance is the serialized
 * source of reserved amount, so concurrent proposals cannot exceed a bill.
 */
async function recordHybridAdjustmentProposal({
  db, tenantRef, invoiceId, request, proposerId, serverTimestamp,
} = {}) {
  strictFields(request, ["id", "kind", "amount", "reason"]);
  const { userRef, invoiceRef, adjustmentRef, balanceRef } = bounds({
    db, tenantRef, invoiceId, adjustmentId: request.id,
    actorUid: proposerId, serverTimestamp,
  });
  return db.runTransaction(async tx => {
    const [actor, tenant, rawInvoice, balanceSnap, adjustmentSnap] = await Promise.all([
      tx.get(userRef), tx.get(tenantRef), tx.get(invoiceRef),
      tx.get(balanceRef), tx.get(adjustmentRef),
    ]);
    requireReviewer(actor);
    if (!tenant.exists) throw new Error("HYBRID_ADJUSTMENT_TENANT_MISSING");
    const invoice = readTrustedInvoice(rawInvoice, tenantRef.id, invoiceId);
    if (adjustmentSnap.exists) throw new Error("HYBRID_ADJUSTMENT_ALREADY_EXISTS");
    const proposal = prepareHybridAdjustmentProposal({
      tenantId: tenantRef.id, tenant: tenant.data(), invoice,
      request, priorAdjustments: [],
    });
    const balance = validateBalance(balanceSnap, tenantRef.id, invoice);
    const amountCents = satang(proposal.amount);
    if (balance.count >= 500) throw new Error("HYBRID_ADJUSTMENT_HISTORY_LIMIT");
    if (balance.reservedCents + amountCents > satang(invoice.amount)) {
      throw new Error("HYBRID_ADJUSTMENT_EXCEEDS_INVOICE");
    }
    const nextBalance = {
      tenantId: tenantRef.id, invoiceId,
      invoiceSignature: invoice.signature,
      invoiceAmountCents: satang(invoice.amount),
      reservedCents: balance.reservedCents + amountCents,
      count: balance.count + 1,
      updatedAt: serverTimestamp,
    };
    if (balance.exists) tx.update(balanceRef, nextBalance);
    else tx.create(balanceRef, { ...nextBalance, createdAt: serverTimestamp });
    tx.create(adjustmentRef, {
      id: proposal.id, invoiceId, tenantId: tenantRef.id,
      invoiceSignature: invoice.signature, kind: proposal.kind,
      amount: proposal.amount, amountCents,
      reasonSummary: proposal.reasonSummary, status: "proposed",
      proposedBy: proposerId, proposedAt: serverTimestamp,
      updatedAt: serverTimestamp,
      // Approval and external settlement are deliberately different facts.
      externallySettled: false,
    });
    return Object.freeze({ id: proposal.id, invoiceId, status: "proposed",
      amount: proposal.amount, refundExecuted: false, invoiceChanged: false });
  });
}

/**
 * Second Super Admin reviews one proposal exactly once. Does not mark paid,
 * settle a refund or issue credits; a later separately authorized payout flow
 * is still necessary. Rejections release only the reserved adjustment cap.
 */
async function reviewHybridAdjustmentProposal({
  db, tenantRef, invoiceId, adjustmentId, reviewerId,
  action, note, serverTimestamp,
} = {}) {
  if (!["approve", "reject"].includes(action)) {
    throw new Error("HYBRID_ADJUSTMENT_REVIEW_ACTION_INVALID");
  }
  const clean = cleanNote(note, action === "approve" ? 20 : 6);
  const { userRef, invoiceRef, adjustmentRef, balanceRef, decisionRef } = bounds({
    db, tenantRef, invoiceId, adjustmentId, actorUid: reviewerId, serverTimestamp,
  });
  return db.runTransaction(async tx => {
    const [actor, tenant, rawInvoice, balanceSnap, adjustmentSnap, decisionSnap] =
      await Promise.all([tx.get(userRef), tx.get(tenantRef), tx.get(invoiceRef),
        tx.get(balanceRef), tx.get(adjustmentRef), tx.get(decisionRef)]);
    requireReviewer(actor);
    if (!tenant.exists || tenant.data()?.billingPolicyVersion !== "hybrid_v1") {
      throw new Error("HYBRID_ADJUSTMENT_TENANT_NOT_HYBRID");
    }
    const invoice = readTrustedInvoice(rawInvoice, tenantRef.id, invoiceId);
    if (!adjustmentSnap.exists) throw new Error("HYBRID_ADJUSTMENT_NOT_FOUND");
    if (decisionSnap.exists) throw new Error("HYBRID_ADJUSTMENT_ALREADY_REVIEWED");
    const original = adjustmentSnap.data() || {};
    if (original.id !== adjustmentId || original.tenantId !== tenantRef.id
      || original.invoiceId !== invoiceId
      || original.invoiceSignature !== invoice.signature
      || original.status !== "proposed"
      || !["credit_note", "refund_request", "chargeback_review"].includes(original.kind)
      || !Number.isSafeInteger(original.amountCents)
      || original.amountCents !== satang(original.amount)) {
      throw new Error("HYBRID_ADJUSTMENT_PROPOSAL_CHANGED");
    }
    // Four-eyes approval; the request initiator cannot approve or reject.
    if (original.proposedBy === reviewerId) {
      throw new Error("HYBRID_ADJUSTMENT_SELF_REVIEW_FORBIDDEN");
    }
    if (original.kind === "credit_note"
      ? !["issued", "rejected"].includes(invoice.status)
      : invoice.status !== "paid") {
      throw new Error("HYBRID_ADJUSTMENT_INVOICE_STATUS_CHANGED");
    }
    const balance = validateBalance(balanceSnap, tenantRef.id, invoice);
    if (!balance.exists || balance.reservedCents < original.amountCents) {
      throw new Error("HYBRID_ADJUSTMENT_BALANCE_MISSING");
    }
    const newStatus = action === "approve" ? "approved" : "rejected";
    // All transaction reads have completed. Only adjustment documents are
    // written. No invoice, tenant, bank recipient or Wallet is touched.
    tx.create(decisionRef, {
      tenantId: tenantRef.id, invoiceId, adjustmentId,
      invoiceSignature: invoice.signature, action, resultStatus: newStatus,
      reviewerId, note: clean, externallySettled: false,
      reviewedAt: serverTimestamp,
    });
    tx.update(adjustmentRef, {
      status: newStatus, reviewedBy: reviewerId, reviewNote: clean,
      reviewedAt: serverTimestamp, updatedAt: serverTimestamp,
    });
    if (action === "reject") tx.update(balanceRef, {
      reservedCents: balance.reservedCents - original.amountCents,
      updatedAt: serverTimestamp,
    });
    return Object.freeze({ id: adjustmentId, invoiceId,
      status: newStatus, refundExecuted: false, invoiceChanged: false });
  });
}
module.exports = {
  recordHybridAdjustmentProposal, reviewHybridAdjustmentProposal,
};
