import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";

const cache = new Map();
function fn(name) {
  if (!cache.has(name)) cache.set(name, httpsCallable(functions, name));
  return cache.get(name);
}
async function call(name, payload = {}) {
  const response = await fn(name)(payload);
  return response?.data || {};
}
function dateValue(value) {
  if (!value) return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toISOString();
  return value;
}
export function normalizeTenant(tenant = {}) {
  const revenueShareEnabled = tenant.revenueShareEnabled === true || tenant.billingMode === "revenue_share";
  return {
    ...tenant,
    shopPhone: tenant.shopPhone ?? tenant.phone ?? "",
    shopAddress: tenant.shopAddress ?? tenant.address ?? "",
    subscriptionExpiresAt: dateValue(tenant.subscriptionExpiresAt),
    suspendedAt: dateValue(tenant.suspendedAt),
    billingMode: revenueShareEnabled ? "revenue_share" : "subscription",
    accessStatus: tenant.revenueShareSuspended === true
      ? "revenue_share_suspended"
      : (tenant.active === false ? "inactive" : "active"),
  };
}

export async function listTenants() {
  const data = await call("listTenants");
  return (data.tenants || []).map(normalizeTenant);
}
export const createTenant = payload => call("createTenant", payload);
export const updateTenant = payload => call("updateTenant", payload);
export const deleteTenant = payload => call("deleteTenant", payload);
export const getPlatformRevenueShareSummary = payload => call("getPlatformRevenueShareSummary", payload);
export const updateTenantRevenueShare = payload => call("updateTenantRevenueShare", payload);
export const unlockTenantRevenueShare = payload => call("unlockTenantRevenueShare", payload);
export const listPlatformRevenueSharePayments = payload => call("listPlatformRevenueSharePayments", payload);
export const reviewRevenueSharePayment = payload => call("reviewRevenueSharePayment", payload);
export const reconcileRevenueShare = payload => call("reconcileRevenueShare", payload);
export const createTenantOwner = payload => call("createTenantOwner", payload);
export const updateTenantOwner = payload => call("updateTenantOwner", payload);
export const updateTenantLalamoveApproval = payload => call("updateTenantLalamoveApproval", payload);
export const getTenantLalamoveWallet = payload => call("getTenantLalamoveWallet", payload);
export const reviewTenantLalamoveWalletTopup = payload => call("reviewTenantLalamoveWalletTopup", payload);
export const backfillTenantSubscriptions = payload => call("backfillTenantSubscriptions", payload);
export const updateTenantSubscription = payload => call("updateTenantSubscription", payload);
