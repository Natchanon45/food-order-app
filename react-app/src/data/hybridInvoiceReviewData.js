import {
  collection, documentId, getDocs, limit as queryLimit, orderBy, query, startAfter,
} from "firebase/firestore";
import { db } from "@/firebase/client";

// Read-only: invoice writer/settlement is intentionally not a Cloud Callable.
// The Firestore rules authorize only the tenant's owner/admin or Super Admin.
function normalizeId(value) {
  const id = String(value || "");
  if (!/^[a-zA-Z0-9_-]{3,160}$/.test(id)) throw new Error("INVALID_TENANT_ID");
  return id;
}
const first = (docs, max) => ({
  items: docs.docs.map(doc => ({ ...doc.data(), id: doc.id })),
  cursor: docs.docs.at(-1) || null,
  hasMore: docs.size === max,
});
export async function listHybridTenants(cursor = null) {
  const count = 50;
  const constraints = [orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), queryLimit(count)];
  const result = await getDocs(query(collection(db, "tenants"), ...constraints));
  return first(result, count);
}
export async function listHybridInvoices(tenantId, { cursor = null, pageSize = 30 } = {}) {
  normalizeId(tenantId);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new RangeError("INVALID_LIMIT");
  const constraints = [orderBy("date", "desc"),
    ...(cursor ? [startAfter(cursor)] : []), queryLimit(pageSize)];
  const result = await getDocs(query(
    collection(db, "tenants", tenantId, "hybridBillingInvoices"), ...constraints,
  ));
  return first(result, pageSize);
}
export async function listHybridPaymentAttempts(tenantId, { cursor = null, pageSize = 30 } = {}) {
  normalizeId(tenantId);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new RangeError("INVALID_LIMIT");
  const constraints = [orderBy("submittedAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []), queryLimit(pageSize)];
  const result = await getDocs(query(
    collection(db, "tenants", tenantId, "hybridBillingPaymentAttempts"), ...constraints,
  ));
  // Whitelist display fields. Do not surface bank reference, raw verification,
  // storage links or private transfer metadata in browser-rendered tables.
  return {
    ...first(result, pageSize),
    items: result.docs.map(doc => {
      const p = doc.data() || {};
      return { id: doc.id, invoiceId: String(p.invoiceId || ""),
        status: String(p.status || ""), amount: Number(p.amount || 0),
        provider: String(p.verification?.provider || ""),
        bankVerified: p.verification?.bankVerified === true,
        submittedAt: p.submittedAt || null };
    }),
  };
}

/**
 * Server-written immutable payment review events. The browser may read only
 * its authorized tenant via Firestore Rules and cannot edit audit documents.
 * Exclude raw bank refs, Storage paths, OCR, personal bank data and full notes.
 */
export async function listHybridPaymentReviewEvents(tenantId, {
  cursor = null, pageSize = 30,
} = {}) {
  normalizeId(tenantId);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw new RangeError("INVALID_LIMIT");
  }
  const constraints = [orderBy("reviewedAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []), queryLimit(pageSize)];
  const result = await getDocs(query(
    collection(db, "tenants", tenantId, "hybridBillingPaymentEvents"), ...constraints,
  ));
  return {
    cursor: result.docs.at(-1) || null,
    hasMore: result.size === pageSize,
    items: result.docs.map(doc => {
      const event = doc.data() || {};
      return {
        id: doc.id,
        invoiceId: String(event.invoiceId || "").slice(0, 80),
        attemptId: String(event.attemptId || "").slice(0, 80),
        action: event.action === "approve" ? "approve"
          : event.action === "reject" ? "reject" : "unknown",
        resultStatus: ["paid", "rejected"].includes(event.resultStatus)
          ? event.resultStatus : "unknown",
        reviewerId: String(event.reviewerId || "").slice(0, 80),
        bankVerified: event.bankVerified === true,
        verifiedExternally: event.verifiedExternally === true,
        reviewedAt: event.reviewedAt || null,
        // Expose only the first 160 characters of a reviewer note, never
        // a raw provider response, bank reference or full sensitive payload.
        notePreview: String(event.note || "")
          .replace(/(?:[0-9๐-๙][\s.-]?){8,20}/g, "[redacted]")
          .slice(0, 160),
      };
    }),
  };
}


// Compensation is a separate private ledger. Approval means INTERNAL REVIEW
// ONLY: never infer bank payout, refund, credit applied or invoice settlement.
const safeFinanceText = value => String(value || "")
  .replace(/(?:[0-9๐-๙][\s.-]?){8,20}/g, "[redacted]").slice(0, 160);
const safeMoney = value => Number.isFinite(value) && value > 0
  && value <= 1000000000 ? Math.round(value * 100) / 100 : 0;
const financeKinds = new Set(["credit_note", "refund_request", "chargeback_review"]);
const financeStatuses = new Set(["proposed", "approved", "rejected"]);

// Only active Super Admin can read via Firestore Rules; no Browser mutation.
export async function listHybridAdjustments(tenantId, {
  cursor = null, pageSize = 30,
} = {}) {
  normalizeId(tenantId);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw new RangeError("INVALID_LIMIT");
  }
  const result = await getDocs(query(
    collection(db, "tenants", tenantId, "hybridBillingAdjustments"),
    orderBy("proposedAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []), queryLimit(pageSize),
  ));
  return {
    cursor: result.docs.at(-1) || null,
    hasMore: result.size === pageSize,
    items: result.docs.map(doc => {
      const record = doc.data() || {};
      return {
        id: doc.id, invoiceId: safeFinanceText(record.invoiceId),
        kind: financeKinds.has(record.kind) ? record.kind : "unknown",
        amount: safeMoney(record.amount),
        status: financeStatuses.has(record.status) ? record.status : "unknown",
        proposedBy: safeFinanceText(record.proposedBy),
        proposedAt: record.proposedAt || null,
        reviewedBy: safeFinanceText(record.reviewedBy),
        // Keep internal review distinct from actual cash settlement.
        payoutConfirmed: false,
        reasonPreview: safeFinanceText(record.reasonSummary),
      };
    }),
  };
}

export async function listHybridAdjustmentReviewEvents(tenantId, {
  cursor = null, pageSize = 30,
} = {}) {
  normalizeId(tenantId);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw new RangeError("INVALID_LIMIT");
  }
  const result = await getDocs(query(
    collection(db, "tenants", tenantId, "hybridBillingAdjustmentEvents"),
    orderBy("reviewedAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []), queryLimit(pageSize),
  ));
  return {
    cursor: result.docs.at(-1) || null,
    hasMore: result.size === pageSize,
    items: result.docs.map(doc => {
      const event = doc.data() || {};
      return {
        id: doc.id, invoiceId: safeFinanceText(event.invoiceId),
        adjustmentId: safeFinanceText(event.adjustmentId),
        action: event.action === "approve" ? "approve"
          : event.action === "reject" ? "reject" : "unknown",
        resultStatus: financeStatuses.has(event.resultStatus)
          ? event.resultStatus : "unknown",
        reviewerId: safeFinanceText(event.reviewerId),
        reviewedAt: event.reviewedAt || null,
        // Ignore any externallySettled flag until real bank reconciliation.
        payoutConfirmed: false,
        notePreview: safeFinanceText(event.note),
      };
    }),
  };
}


// This collection contains UNVERIFIED demo comparison candidates only.
// Browser rendering cannot promote a flag or claim proof of a bank payout.
export async function listHybridRefundCandidates(tenantId, {
  cursor = null, pageSize = 30,
} = {}) {
  normalizeId(tenantId);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw new RangeError("INVALID_LIMIT");
  }
  const result = await getDocs(query(
    collection(db, "tenants", tenantId, "hybridBillingRefundCandidates"),
    orderBy("createdAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []), queryLimit(pageSize),
  ));
  return {
    cursor: result.docs.at(-1) || null,
    hasMore: result.size === pageSize,
    items: result.docs.map(doc => {
      const evidence = doc.data() || {};
      return {
        id: doc.id,
        invoiceId: safeFinanceText(evidence.invoiceId),
        amount: safeMoney(evidence.amount),
        createdAt: evidence.createdAt || null,
        observedBy: safeFinanceText(evidence.observedBy),
        // Always render the conservative server state. Do not render raw
        // outgoing transfer IDs, destination fingerprints or bank hash.
        state: "awaiting_independent_bank_attestation",
        payoutConfirmed: false,
        bankSourceConfirmed: false,
      };
    }),
  };
}
