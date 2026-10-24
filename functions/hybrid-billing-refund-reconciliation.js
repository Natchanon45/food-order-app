"use strict";

// Private Phase 10 reconciliation preflight only. Approval is NOT bank payout.
// This function never contacts a bank, consumes a reference, changes a paid
// invoice, marks an adjustment settled or updates Wallet / tenant access.
// Future server integration must fetch BOTH original disbursement and posted
// bank entries via trusted admin/provider adapters, not browser payload.
const { validInvoiceId, validId, satang } = require("./hybrid-billing-payment-policy");
const { LEDGER_VERSION } = require("./hybrid-billing-ledger");

const HASH = /^[a-f0-9]{64}$/;
const validHash = (s, label) => {
  if (typeof s !== "string" || !HASH.test(s)) {
    throw new Error("HYBRID_REFUND_INVALID_" + label);
  }
  return s;
};
function timestamp(value, label) {
  // Unambiguous ISO UTC string from trusted server/statement reader.
  if (typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    || !Number.isFinite(Date.parse(value))) {
    throw new Error("HYBRID_REFUND_INVALID_" + label);
  }
  return Date.parse(value);
}
function scope(value, label, tenantId, invoiceId, adjustmentId) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || value.tenantId !== tenantId || value.invoiceId !== invoiceId
    || value.adjustmentId !== adjustmentId) {
    throw new Error("HYBRID_REFUND_SCOPE_" + label);
  }
}

/**
 * Evaluate whether separately acquired, server-verified finance disbursement
 * AND bank statement records warrant later independent final attestation.
 * The output is NEVER proof that a transfer was made: it is an exact-match
 * checklist requiring a future trusted bank importer and duplicate-claim TX.
 */
function planHybridRefundReconciliation({
  tenantId, invoice, adjustment, reviewEvent,
  disbursement, bankStatement, existingBankReferenceHashes = [],
  at = new Date().toISOString(),
} = {}) {
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(tenantId || ""))) {
    throw new Error("HYBRID_REFUND_TENANT_INVALID");
  }
  validInvoiceId(invoice?.id);
  validId(adjustment?.id, "ADJUSTMENT_ID");
  if (invoice.tenantId !== tenantId || invoice.version !== LEDGER_VERSION
    || invoice.status !== "paid"
    || !HASH.test(String(invoice.signature || ""))) {
    throw new Error("HYBRID_REFUND_PAID_INVOICE_REQUIRED");
  }
  satang(invoice.amount);
  scope(adjustment, "ADJUSTMENT", tenantId, invoice.id, adjustment.id);
  if (adjustment.kind !== "refund_request" || adjustment.status !== "approved"
    || adjustment.externallySettled !== false
    || adjustment.invoiceSignature !== invoice.signature
    || !Number.isSafeInteger(adjustment.amountCents)
    || adjustment.amountCents !== satang(adjustment.amount)
    || adjustment.amountCents > satang(invoice.amount)
    || typeof adjustment.proposedBy !== "string"
    || adjustment.proposedBy === adjustment.reviewedBy) {
    throw new Error("HYBRID_REFUND_APPROVED_ADJUSTMENT_REQUIRED");
  }
  scope(reviewEvent, "REVIEW", tenantId, invoice.id, adjustment.id);
  if (reviewEvent.action !== "approve" || reviewEvent.resultStatus !== "approved"
    || reviewEvent.externallySettled !== false
    || reviewEvent.invoiceSignature !== invoice.signature
    || reviewEvent.reviewerId !== adjustment.reviewedBy) {
    throw new Error("HYBRID_REFUND_INDEPENDENT_REVIEW_REQUIRED");
  }
  scope(disbursement, "DISBURSEMENT", tenantId, invoice.id, adjustment.id);
  scope(bankStatement, "BANK_STATEMENT", tenantId, invoice.id, adjustment.id);

  if (disbursement.source !== "trusted_finance_disbursement"
    || disbursement.state !== "submitted"
    || disbursement.currency !== "THB"
    || !Number.isSafeInteger(disbursement.amountCents)
    || disbursement.amountCents !== adjustment.amountCents
    || typeof disbursement.instructionId !== "string"
    || !/^[A-Za-z0-9_-]{16,80}$/.test(disbursement.instructionId)) {
    throw new Error("HYBRID_REFUND_DISBURSEMENT_NOT_TRUSTED");
  }
  if (bankStatement.source !== "trusted_bank_statement"
    || bankStatement.direction !== "debit"
    || bankStatement.postingStatus !== "posted"
    || bankStatement.currency !== "THB"
    || !Number.isSafeInteger(bankStatement.amountCents)
    || bankStatement.amountCents !== adjustment.amountCents) {
    throw new Error("HYBRID_REFUND_BANK_POSTING_NOT_TRUSTED");
  }

  const transferHash = validHash(disbursement.bankReferenceHash, "DISBURSEMENT_REFERENCE");
  const bankHash = validHash(bankStatement.bankReferenceHash, "BANK_REFERENCE");
  const payoutDestinationHash = validHash(disbursement.destinationFingerprint,
    "DISBURSEMENT_DESTINATION");
  const bankDestinationHash = validHash(bankStatement.destinationFingerprint,
    "BANK_DESTINATION");
  if (transferHash !== bankHash || payoutDestinationHash !== bankDestinationHash) {
    throw new Error("HYBRID_REFUND_BANK_REFERENCE_OR_DESTINATION_MISMATCH");
  }
  const timeSent = timestamp(disbursement.submittedAt, "SUBMITTED_AT");
  const timePosted = timestamp(bankStatement.postedAt, "POSTED_AT");
  const asOf = timestamp(at, "AS_OF");
  if (timePosted < timeSent || timePosted > asOf || timeSent > asOf) {
    throw new Error("HYBRID_REFUND_INVALID_BANK_TIME_ORDER");
  }
  if (!Array.isArray(existingBankReferenceHashes)
    || existingBankReferenceHashes.length > 2000
    || existingBankReferenceHashes.some(value => !HASH.test(String(value)))) {
    throw new Error("HYBRID_REFUND_REFERENCE_HISTORY_INVALID");
  }
  if (new Set(existingBankReferenceHashes).has(bankHash)) {
    throw new Error("HYBRID_REFUND_DUPLICATE_BANK_REFERENCE");
  }

  return Object.freeze({
    dryRun: true, writesPerformed: false, settlementConfirmed: false,
    status: "candidate_for_independent_finance_attestation",
    tenantId, invoiceId: invoice.id, adjustmentId: adjustment.id,
    instructionId: disbursement.instructionId,
    bankReferenceHash: bankHash,
    amount: adjustment.amountCents / 100, currency: "THB",
    // Verified only against source fields supplied by the *future* private
    // adapter. No server currently attests authenticity of these sources.
    destinationMatched: true, amountMatched: true, postingMatched: true,
    bankSourceIntegrationReady: false,
  });
}
module.exports = { planHybridRefundReconciliation };
