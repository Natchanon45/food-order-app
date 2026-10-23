import {
  describeLocalHybridProof, isEligibleHybridInvoice,
} from "./hybridTenantPaymentDraft.js";

const DEMO_ID = "demo-penguin-hybrid";
const ATTEMPT_ID = /^[A-Za-z0-9_-]{16,80}$/;
const EXT = Object.freeze({
  "image/jpeg": "jpg", "image/png": "png",
  "image/webp": "webp", "application/pdf": "pdf",
});

// Pure dependency-injected runner; no Firebase imports, no bank actions.
export function isSafeHybridDemoRuntime(runtime = {}) {
  return runtime.dev === true
    && runtime.emulatorFlag === true
    && runtime.demoFlag === true
    && runtime.projectId === DEMO_ID;
}
function requireCurrent(isCurrent) {
  if (isCurrent() !== true) throw new Error("HYBRID_DEMO_SESSION_CHANGED");
}
function validateGrant(grant, tenantId, invoiceId, file) {
  if (!grant || typeof grant !== "object" || !ATTEMPT_ID.test(String(grant.attemptId || ""))
    || grant.tenantId !== tenantId || grant.invoiceId !== invoiceId
    || grant.contentType !== file.type || grant.maxSize !== file.size
    || grant.uploadEnabled !== false) {
    throw new Error("HYBRID_DEMO_INVALID_SERVER_GRANT");
  }
  const suffix = "." + EXT[file.type];
  const path = "tenants/" + tenantId + "/hybrid-billing-slips/"
    + invoiceId + "/" + grant.attemptId + "/evidence" + suffix;
  if (grant.slipPath !== path) throw new Error("HYBRID_DEMO_INVALID_SERVER_PATH");
  const expiry = Date.parse(String(grant.expiresAt || ""));
  if (!Number.isFinite(expiry) || expiry <= Date.now()) {
    throw new Error("HYBRID_DEMO_EXPIRED_SERVER_GRANT");
  }
  return { tenantId, invoiceId, attemptId: grant.attemptId, slipPath: path };
}

export async function submitDemoHybridEvidence({
  runtime, tenantId, invoice, file, requestGrant, uploadEvidence, submitProof,
  isCurrent = () => true, onStep = () => {},
}) {
  if (!isSafeHybridDemoRuntime(runtime)) throw new Error("HYBRID_DEMO_ONLY_LOCAL_EMULATOR");
  if (typeof requestGrant !== "function" || typeof uploadEvidence !== "function"
    || typeof submitProof !== "function"
    || typeof isCurrent !== "function" || typeof onStep !== "function") {
    throw new TypeError("HYBRID_DEMO_TRANSPORT_REQUIRED");
  }
  if (!isEligibleHybridInvoice(invoice)) throw new Error("HYBRID_DEMO_INVOICE_UNAVAILABLE");
  const draft = describeLocalHybridProof({ tenantId, invoice, file });
  if (!draft.ok) throw new Error(draft.code);
  requireCurrent(isCurrent);
  onStep("reserving");
  const grant = await requestGrant({
    tenantId, invoiceId: invoice.id, contentType: file.type, fileSize: file.size,
  });
  requireCurrent(isCurrent);
  const payload = validateGrant(grant, tenantId, invoice.id, file);
  onStep("uploading");
  await uploadEvidence({ slipPath: payload.slipPath, file });
  requireCurrent(isCurrent);
  onStep("submitting");
  const result = await submitProof(payload);
  requireCurrent(isCurrent);
  if (result?.status !== "pending_review"
    || result.invoiceId !== invoice.id
    || result.attemptId !== payload.attemptId) {
    throw new Error("HYBRID_DEMO_UNEXPECTED_FINANCIAL_RESULT");
  }
  return Object.freeze({ status: "pending_review", invoiceId: invoice.id,
    attemptId: payload.attemptId });
}
