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
        notePreview: String(event.note || "").slice(0, 160),
      };
    }),
  };
}
