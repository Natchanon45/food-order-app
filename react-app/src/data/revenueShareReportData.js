import { httpsCallable } from "firebase/functions";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { functions, storage } from "@/firebase/client";

async function call(name, payload = {}) {
  const response = await httpsCallable(functions, name)(payload);
  return response?.data || {};
}

export function getRevenueShareAccess() {
  return call("getTenantRevenueShareAccess");
}

export function getRevenueShareReport(payload = {}) {
  return call("getTenantRevenueShareSummary", payload);
}

export async function listRevenueSharePayments() {
  const data = await call("listTenantRevenueSharePayments");
  return Array.isArray(data.items) ? data.items : [];
}

function safeFileName(file) {
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const stem = String(file?.name || "slip").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "slip";
  return `${stem}.${extension}`;
}

export async function submitRevenueSharePayment(tenantId, periodPayload, file) {
  if (!storage) throw new Error("STORAGE_NOT_READY");
  if (!file) throw new Error("REVENUE_SHARE_SLIP_REQUIRED");
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("TENANT_REQUIRED");
  const paymentId = crypto.randomUUID();
  const fileName = safeFileName(file);
  const slipPath = `tenants/${id}/revenue-share-slips/${paymentId}/${fileName}`;
  const target = storageRef(storage, slipPath);
  await uploadBytes(target, file, { contentType: file.type || "application/octet-stream" });
  try {
    const data = await call("submitTenantRevenueSharePayment", {
      ...periodPayload,
      paymentId,
      slipPath,
      slipName: file.name || fileName,
    });
    return data.item || data;
  } catch (error) {
    try { await deleteObject(target); } catch {}
    throw error;
  }
}

export function deleteRevenueSharePayment(paymentId) {
  return call("deleteTenantRevenueSharePayment", { paymentId: String(paymentId || "") });
}

export async function getRevenueShareSlipUrl(path) {
  const value = String(path || "").trim();
  if (!value) throw new Error("SLIP_PATH_REQUIRED");
  return getDownloadURL(storageRef(storage, value));
}
