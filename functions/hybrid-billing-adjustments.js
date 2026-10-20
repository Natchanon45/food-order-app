"use strict";

// SOURCE-ONLY accounting adjustment candidate. NOT a deployed tax credit note,
// bank refund, actual offset, or collectible debit. No Production exports.
// Computes the exact change in a LOCKED invoice from the same transactional,
// verified paid-Delivery source and a separately server-verified review record.
const { FieldValue } = require("firebase-admin/firestore");
const { billingCycleById, cycleWindow, nextDate } = require("./hybrid-billing-core");
const { paidOrdersInWindow, auditPaidDeliveryReceiptCoverage } = require("./hybrid-billing-preview");
const { planClosedDay } = require("./hybrid-billing-ledger");

const ID = /^[A-Za-z0-9_-]{8,128}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const TYPES = new Set(["verified_refund", "verified_late_paid_receipt"]);
const sorted = arr => [...arr].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function verifyAdjustmentAttestation(attestation, context, now) {
  // Independent server-side review adapter required; NEVER accept a browser
  // argument, client refund date, slip image, or reviewer-entered money amount.
  if (!attestation || attestation.verified !== true
    || attestation.tenantId !== context.tenantId
    || attestation.cycleId !== context.cycleId
    || attestation.invoiceId !== context.invoiceId
    || !TYPES.has(attestation.sourceType)
    || !SHA256.test(attestation.evidenceSha256 || "")
    || !SHA256.test(attestation.originalSealDigest || "")
    || !SHA256.test(attestation.currentSealDigest || "")
    || !(attestation.checkedAt instanceof Date)
    || !Number.isFinite(attestation.checkedAt.getTime())
    || attestation.checkedAt > now
    || now.getTime() - attestation.checkedAt.getTime() > 15 * 60 * 1000) {
    throw Error("HYBRID_ADJUSTMENT_INDEPENDENT_REVIEW_REQUIRED");
  }
  return { sourceType: attestation.sourceType, evidenceSha256: attestation.evidenceSha256,
    originalSealDigest: attestation.originalSealDigest,
    currentSealDigest: attestation.currentSealDigest };
}

/**
 * Produces ONE immutable approval record per ORIGINAL invoice, with calculated
 * signed delta. Explicit status "approved_unapplied": NO customer account
 * balance, paid settlement, suspension, tax invoice or refund is changed.
 * A changed threshold topology, multiple changed days, another adjustment or
 * incomplete lifetime source aborts; a separate reviewed policy is required.
 */
async function recordHybridReviewedAdjustment({
  db, tenantId, cycleId, invoiceId, reviewId, reviewerUid,
  resolveIndependentAdjustment, now = new Date(),
  serverTimestamp = () => FieldValue.serverTimestamp(),
}) {
  if (!db || ![tenantId, reviewId, reviewerUid].every(s => typeof s === "string" && ID.test(s))
    || typeof cycleId !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(cycleId)
    || typeof invoiceId !== "string" || !invoiceId.startsWith(cycleId + ":")
    || invoiceId.includes("/") || invoiceId.length > 128
    || !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw Error("HYBRID_ADJUSTMENT_BAD_REQUEST");
  }
  if (typeof resolveIndependentAdjustment !== "function") {
    throw Error("HYBRID_ADJUSTMENT_REVIEW_ADAPTER_MISSING");
  }
  const context = { tenantId, cycleId, invoiceId };
  const proof = verifyAdjustmentAttestation(
    await resolveIndependentAdjustment(context), context, now);
  const tenantRef = db.collection("tenants").doc(tenantId);
  const periodRef = tenantRef.collection("hybridBillingPeriods").doc(cycleId);
  const invoiceRef = tenantRef.collection("hybridBillingInvoices").doc(invoiceId);
  const adjustmentRef = tenantRef.collection("hybridBillingAdjustments").doc(invoiceId);
  const reviewerRef = db.collection("users").doc(reviewerUid);
  const { createHash } = require("node:crypto");
  const reviewClaimId = createHash("sha256").update("hybrid_adjustment:" + proof.evidenceSha256).digest("hex");
  const proofRef = db.collection("platformHybridAdjustmentProofs").doc(reviewClaimId);

  return db.runTransaction(async tx => {
    const [tenantSnap, periodSnap, invoiceSnap, already, reviewer, claim] =
      await Promise.all([tx.get(tenantRef), tx.get(periodRef), tx.get(invoiceRef),
        tx.get(adjustmentRef), tx.get(reviewerRef), tx.get(proofRef)]);
    if (!reviewer.exists || reviewer.data()?.active !== true
      || reviewer.data()?.role !== "super_admin") throw Error("HYBRID_ADJUSTMENT_SUPER_ADMIN_REQUIRED");
    const tenant = tenantSnap.data() || {}, period = periodSnap.data() || {};
    if (!tenantSnap.exists || tenant.billingPolicyVersion !== "hybrid_v1"
      || tenant.hybridBillingEnabled !== true || !tenant.hybridBillingStartDate) {
      throw Error("HYBRID_ADJUSTMENT_TENANT_INVALID");
    }
    const cycle = billingCycleById(tenant.hybridBillingStartDate, cycleId);
    if (!periodSnap.exists || period.policyVersion !== "hybrid_v1"
      || period.tenantId !== tenantId || period.cycleId !== cycleId
      || period.cycleStart !== cycle.startDate || period.cycleEnd !== cycle.endDate
      || !period.configSnapshot || !period.daySeals
      || typeof period.daySeals !== "object" || !Array.isArray(period.issuedInvoiceIds)) {
      throw Error("HYBRID_ADJUSTMENT_PERIOD_INVALID");
    }
    const invoice = invoiceSnap.data() || {};
    if (!invoiceSnap.exists || invoice.tenantId !== tenantId || invoice.invoiceId !== invoiceId
      || invoice.cycleId !== cycleId || invoice.policyVersion !== "hybrid_v1"
      || invoice.currency !== "THB" || !Number.isSafeInteger(invoice.amountCents)
      || invoice.amountCents <= 0 || !period.issuedInvoiceIds.includes(invoiceId)) {
      throw Error("HYBRID_ADJUSTMENT_INVOICE_INVALID");
    }
    const days = Object.keys(period.daySeals).sort();
    const throughDay = days.at(-1);
    if (!days.length || days[0] !== cycle.startDate || throughDay > cycle.lastDate) {
      throw Error("HYBRID_ADJUSTMENT_SEAL_RANGE");
    }
    const expected = [];
    for (let day = cycle.startDate; day <= throughDay; day = nextDate(day)) expected.push(day);
    if (!same(days, expected)) throw Error("HYBRID_ADJUSTMENT_SEAL_GAP");
    // An ALL-paid-Delivery audit (including legacy ISO dates) is mandatory;
    // query and audit are inside same Firestore transaction as the original seal.
    await auditPaidDeliveryReceiptCoverage(tenantRef, { transaction: tx, maxRecords: 3000 });
    const window = cycleWindow(cycle), closedEnd = new Date(nextDate(throughDay) + "T00:00:00+07:00");
    const rows = await paidOrdersInWindow(tenantRef, window.start,
      closedEnd < window.end ? closedEnd : window.end,
      { transaction: tx, includeIds: true, maxRecords: 3000 });
    const plan = planClosedDay({ orders: rows, tenantId,
      signupDate: tenant.hybridBillingStartDate, cycleId, throughDay,
      settings: period.configSnapshot });
    const revisedIds = sorted(plan.invoices.map(row => row.invoiceId));
    if (!same(revisedIds, sorted(period.issuedInvoiceIds))) {
      throw Error("HYBRID_ADJUSTMENT_THRESHOLD_TOPOLOGY_CHANGED");
    }
    const changes = days.filter(day => {
      const old = period.daySeals[day], current = plan.seals[day];
      if (!old || !current || !SHA256.test(old.digest) || !SHA256.test(current.digest)
        || !Number.isSafeInteger(old.salesCents) || !Number.isSafeInteger(current.salesCents)
        || !Number.isSafeInteger(old.receiptCount) || !Number.isSafeInteger(current.receiptCount)) {
        throw Error("HYBRID_ADJUSTMENT_SEAL_INVALID");
      }
      return !same(old, current);
    });
    if (changes.length !== 1 || changes[0] !== invoice.serviceDate) {
      throw Error("HYBRID_ADJUSTMENT_REQUIRES_SINGLE_SERVICE_DAY");
    }
    const day = changes[0];
    if (proof.originalSealDigest !== period.daySeals[day].digest
      || proof.currentSealDigest !== plan.seals[day].digest) {
      throw Error("HYBRID_ADJUSTMENT_EVIDENCE_SOURCE_MISMATCH");
    }
    const revised = plan.invoices.find(row => row.invoiceId === invoiceId);
    if (!revised || revised.kind !== invoice.kind || revised.serviceDate !== invoice.serviceDate
      || revised.dueDate !== invoice.dueDate || revised.suspendFrom !== invoice.suspendFrom
      || revised.currency !== invoice.currency || !Number.isSafeInteger(revised.amountCents)) {
      throw Error("HYBRID_ADJUSTMENT_INVOICE_TOPOLOGY_CHANGED");
    }
    const delta = revised.amountCents - invoice.amountCents;
    if (!Number.isSafeInteger(delta) || delta === 0) {
      throw Error("HYBRID_ADJUSTMENT_ZERO_OR_INVALID");
    }
    // Require supporting source direction: a refund cannot yield a debit,
    // and late paid merchandise cannot yield a credit.
    if ((delta < 0 && proof.sourceType !== "verified_refund")
      || (delta > 0 && proof.sourceType !== "verified_late_paid_receipt")) {
      throw Error("HYBRID_ADJUSTMENT_PROVENANCE_DIRECTION");
    }
    if (already.exists) {
      const a = already.data() || {};
      if (a.reviewId !== reviewId || a.originalAmountCents !== invoice.amountCents
        || a.adjustedAmountCents !== revised.amountCents
        || a.evidenceSha256 !== proof.evidenceSha256
        || a.originalSealDigest !== proof.originalSealDigest
        || a.currentSealDigest !== proof.currentSealDigest) {
        throw Error("HYBRID_ADJUSTMENT_IMMUTABLE_CONFLICT");
      }
      return { invoiceId, noteId: invoiceId, kind: a.kind,
        amountCents: a.amountCents, alreadyRecorded: true,
        applied: false };
    }
    if (claim.exists) throw Error("HYBRID_ADJUSTMENT_PROOF_ALREADY_USED");
    const kind = delta < 0 ? "credit_note_candidate" : "debit_note_candidate";
    tx.create(proofRef, { tenantId, cycleId, invoiceId, reviewId,
      evidenceSha256: proof.evidenceSha256, createdAt: serverTimestamp() });
    tx.create(adjustmentRef, {
      tenantId, cycleId, invoiceId, noteId: invoiceId, policyVersion: "hybrid_v1",
      kind, currency: "THB", status: "approved_unapplied",
      amountCents: Math.abs(delta), signedDeltaCents: delta,
      originalAmountCents: invoice.amountCents, adjustedAmountCents: revised.amountCents,
      serviceDate: day, originalSealDigest: proof.originalSealDigest,
      currentSealDigest: proof.currentSealDigest,
      sourceType: proof.sourceType, evidenceSha256: proof.evidenceSha256,
      reviewId, reviewedBy: reviewerUid, reviewedAt: serverTimestamp(),
      refundInitiated: false, settlementChanged: false,
    });
    return { invoiceId, noteId: invoiceId, kind, amountCents: Math.abs(delta),
      alreadyRecorded: false, applied: false };
  });
}
module.exports = { verifyAdjustmentAttestation, recordHybridReviewedAdjustment };
