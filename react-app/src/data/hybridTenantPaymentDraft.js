// Phase 9: purely local presentation/validation. This file never imports
// Firebase, writes Storage, calls a server endpoint or saves the selected file.
export const HYBRID_TENANT_PROOF_SUBMISSION_READY = false;
export const MAX_HYBRID_PROOF_BYTES = 10 * 1024 * 1024;
export const HYBRID_PROOF_MIME_TYPES = Object.freeze([
  "image/jpeg", "image/png", "image/webp", "application/pdf",
]);
export const HYBRID_PROOF_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf";

const INVOICE_ID = /^20\d{2}-\d{2}-\d{2}:(?:delivery:(?:trigger|20\d{2}-\d{2}-\d{2})|monthly:fixed)$/;
const TENANT_ID = /^[A-Za-z0-9_-]{3,160}$/;

export function isEligibleHybridInvoice(invoice) {
  return Boolean(invoice
    && INVOICE_ID.test(String(invoice.id || ""))
    && ["issued", "rejected"].includes(invoice.status)
    && typeof invoice.amount === "number" && Number.isFinite(invoice.amount)
    && invoice.amount > 0 && invoice.amount <= 1000000000
    && Math.abs(invoice.amount * 100 - Math.round(invoice.amount * 100)) < 1e-6);
}
export function validateHybridProofFile(file) {
  if (!file || typeof file !== "object"
    || typeof file.name !== "string" || !file.name.trim()
    || !/^[^\\/\x00-\x1f\x7f]{1,160}$/.test(file.name)
    || !HYBRID_PROOF_MIME_TYPES.includes(file.type)) {
    return { ok: false, code: "INVALID_PROOF_TYPE" };
  }
  if (!Number.isSafeInteger(file.size) || file.size < 1
    || file.size > MAX_HYBRID_PROOF_BYTES) {
    return { ok: false, code: "INVALID_PROOF_SIZE" };
  }
  return { ok: true, code: "" };
}
export function describeLocalHybridProof({ tenantId, invoice, file }) {
  if (!TENANT_ID.test(String(tenantId || "")) || !isEligibleHybridInvoice(invoice)) {
    return { ok: false, code: "INVALID_PAYMENT_INVOICE" };
  }
  const checked = validateHybridProofFile(file);
  if (!checked.ok) return checked;
  // UI-only metadata. No receipt number, Storage path or payment attempt is
  // allocated until a future trusted backend release.
  return {
    ok: true,
    code: "",
    invoiceId: invoice.id,
    invoiceAmount: invoice.amount,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    localOnly: true,
  };
}
export async function submitHybridTenantProof() {
  // Two independent server/UI release gates also remain disabled.
  // A future refactor must NOT turn this into client-originated paid status.
  throw new Error("HYBRID_PAYMENT_NOT_RELEASED");
}
