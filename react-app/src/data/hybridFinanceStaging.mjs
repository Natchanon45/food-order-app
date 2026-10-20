// Local source-only merchant/Super Admin finance UI staging boundary.
// It deliberately cannot reach any deployed callable until reviewed Auth,
// Storage, App Check and bank-reconciliation release checks pass.
export const HYBRID_FINANCE_UI_READY = false;
const SAFE_ID = /^[A-Za-z0-9_-]{8,128}$/;
const MIME_EXTENSION = Object.freeze({
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "application/pdf": "pdf",
});
const MAX_SLIP_BYTES = 10 * 1024 * 1024;

export function validateHybridFinanceSlip(file) {
  if (!file || !Object.hasOwn(MIME_EXTENSION, file.type)
    || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_SLIP_BYTES) {
    throw new Error("HYBRID_FINANCE_INVALID_SLIP");
  }
  return MIME_EXTENSION[file.type];
}
export function hybridFinanceSlipPath({ tenantId, attemptId, file }) {
  if (typeof tenantId !== "string" || !SAFE_ID.test(tenantId)
    || typeof attemptId !== "string" || !SAFE_ID.test(attemptId)) {
    throw new Error("HYBRID_FINANCE_INVALID_PATH");
  }
  const ext = validateHybridFinanceSlip(file);
  return `tenants/${tenantId}/hybrid-billing-slips/${attemptId}/proof.${ext}`;
}
export function createHybridFinanceClient(invoke, { ready = HYBRID_FINANCE_UI_READY } = {}) {
  // Never allow a forgotten fake/test injection to override source cutover in
  // the production app: all React call sites use default ready=false.
  return async function financeAction(payload) {
    if (ready !== true) throw new Error("HYBRID_FINANCE_UI_NOT_RELEASED");
    if (typeof invoke !== "function") throw new Error("HYBRID_FINANCE_CALLABLE_NOT_REGISTERED");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)
      || typeof payload.tenantId !== "string" || !SAFE_ID.test(payload.tenantId)) {
      throw new Error("HYBRID_FINANCE_INVALID_REQUEST");
    }
    const response = await invoke(payload);
    if (response?.data?.ok !== true) throw new Error("HYBRID_FINANCE_UNCONFIRMED");
    return response.data;
  };
}
