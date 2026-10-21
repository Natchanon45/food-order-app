import { httpsCallable } from "firebase/functions";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { functions, storage } from "@/firebase/client";

async function call(name, args = {}) {
  const response = await httpsCallable(functions, name)(args);
  if (response?.data?.ok !== true) throw new Error("HYBRID_CALL_FAILED");
  return response.data;
}
export async function getTenantHybridSlipUsage() {
  return call("getTenantHybridSlipUsage");
}
export async function getTenantHybridInvoices() {
  return (await call("getTenantHybridInvoices")).items || [];
}
export async function getHybridBillingPaymentDestination() {
  return (await call("getHybridBillingPaymentDestination")).destination;
}
export async function getPlatformHybridPaymentDestination() {
  return (await call("getPlatformHybridPaymentDestination")).destination;
}
export function getPlatformHybridInvoices(tenantId) {
  return call("getPlatformHybridInvoices", { tenantId });
}
export function issueTenantHybridInvoices(tenantId, throughDate) {
  return call("issueTenantHybridInvoices", {
    tenantId, throughDate, attestation: "RECONCILED_DELIVERY_SOURCE",
  });
}
export function setTenantHybridBillingLive(tenantId, enabled) {
  return call("setTenantHybridBillingLive", {
    tenantId, enabled,
    confirmation: enabled ? "ENABLE_HYBRID_LIVE_BILLING" : "",
  });
}
export function updateHybridBillingPaymentDestination(destination) {
  return call("updateHybridBillingPaymentDestination", destination);
}
export function reviewTenantHybridPayment(tenantId, invoiceId, paymentId, action, note = "") {
  return call("reviewTenantHybridPayment", { tenantId, invoiceId, paymentId, action, note });
}
export function reconcileTenantHybridBilling(tenantId) {
  return call("reconcileTenantHybridBilling", { tenantId });
}
export function hybridSlipUrl(path) {
  if (!storage || !path) throw new Error("HYBRID_SLIP_UNAVAILABLE");
  return getDownloadURL(storageRef(storage, path));
}
export async function submitTenantHybridPayment(tenantId, invoiceId, file) {
  if (!storage || !file || !tenantId || !invoiceId) throw new Error("HYBRID_SLIP_REQUIRED");
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  if (!allowed.has(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("HYBRID_SLIP_INVALID");
  }
  const paymentId = crypto.randomUUID();
  const extension = String(file.name || "").split(".").pop().toLowerCase()
    .replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const path = `tenants/${tenantId}/hybrid-billing-slips/${invoiceId}/${paymentId}/proof.${extension}`;
  const target = storageRef(storage, path);
  await uploadBytes(target, file, { contentType: file.type });
  try {
    return await call("submitTenantHybridPayment", {
      invoiceId, paymentId, slipPath: path, slipName: file.name,
    });
  } catch (error) {
    try { await deleteObject(target); } catch {}
    throw error;
  }
}
