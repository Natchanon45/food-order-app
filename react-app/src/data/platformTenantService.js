import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/firebase/client";

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
function normalizeLalamoveMode(value = "") {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "partner") return "tenant";
  return ["disabled", "tenant", "fod_central"].includes(mode) ? mode : "disabled";
}

export function normalizeTenant(tenant = {}) {
  const revenueShareEnabled = tenant.revenueShareEnabled === true || tenant.billingMode === "revenue_share";
  const lalamove = tenant.lalamove && typeof tenant.lalamove === "object" ? tenant.lalamove : {};
  const wallet = tenant.lalamoveWallet && typeof tenant.lalamoveWallet === "object" ? tenant.lalamoveWallet : {};
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
    lalamove: {
      ...lalamove,
      accountMode: normalizeLalamoveMode(lalamove.accountMode),
      fodCentralApproved: lalamove.fodCentralApproved === true,
    },
    lalamoveWallet: {
      ...wallet,
      balance: Math.round((Number(wallet.balance) || 0) * 100) / 100,
      currency: String(wallet.currency || "THB"),
    },
  };
}

async function hydrateTenantLalamoveState(tenant = {}) {
  const normalized = normalizeTenant(tenant);
  const tenantId = String(normalized.id || "").trim();
  if (!tenantId) return normalized;
  try {
    const [lalamoveSnapshot, walletSnapshot] = await Promise.all([
      getDoc(doc(db, "tenants", tenantId, "settings", "lalamove")),
      getDoc(doc(db, "tenants", tenantId, "settings", "lalamoveWallet")),
    ]);
    const lalamove = lalamoveSnapshot.exists() ? lalamoveSnapshot.data() : normalized.lalamove;
    const wallet = walletSnapshot.exists() ? walletSnapshot.data() : normalized.lalamoveWallet;
    return normalizeTenant({
      ...normalized,
      lalamove: {
        ...normalized.lalamove,
        ...lalamove,
        accountMode: normalizeLalamoveMode(lalamove?.accountMode ?? normalized.lalamove?.accountMode),
        fodCentralApproved: lalamove?.fodCentralApproved === true,
      },
      lalamoveWallet: {
        ...normalized.lalamoveWallet,
        ...wallet,
      },
    });
  } catch (error) {
    console.warn("TENANT_LALAMOVE_STATE_HYDRATE_FAILED", tenantId, error?.code || error?.message || error);
    return normalized;
  }
}

export async function listTenants() {
  const data = await call("listTenants");
  const tenants = (data.tenants || []).map(normalizeTenant);
  return Promise.all(tenants.map(hydrateTenantLalamoveState));
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
