import { functions, httpsCallable } from "./firebase-config.js?v=20260630-073";

const callable = name => httpsCallable(functions, name);
const calls = new Map();

function fn(name) {
  if (!calls.has(name)) calls.set(name, callable(name));
  return calls.get(name);
}

function objectParams(params = {}) {
  if (params instanceof URLSearchParams) return Object.fromEntries(params.entries());
  return { ...(params || {}) };
}

function dateValue(value) {
  if (!value) return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toISOString();
  return value;
}

function normalizeTenant(tenant = {}) {
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

async function call(name, payload = {}) {
  const response = await fn(name)(payload);
  return { data: response?.data || {} };
}

export async function listTenants() {
  const response = await call("listTenants");
  response.data.tenants = (response.data.tenants || []).map(normalizeTenant);
  return response;
}

export function createTenant(payload = {}) { return call("createTenant", payload); }
export function updateTenant(payload = {}) { return call("updateTenant", payload); }
export function deleteTenant(payload = {}) { return call("deleteTenant", payload); }
export function createTenantOwner(payload = {}) { return call("createTenantOwner", payload); }
export function updateTenantOwner(payload = {}) { return call("updateTenantOwner", payload); }
export function backfillTenantSubscriptions() { return call("backfillTenantSubscriptions", {}); }
export function updateTenantSubscription(payload = {}) { return call("updateTenantSubscription", payload); }
export function listTenantSalesSummary(params = {}) { return call("getPlatformRevenueShareSummary", objectParams(params)); }
export function updateTenantRevenueShare(payload = {}) { return call("updateTenantRevenueShare", payload); }
export function unlockTenantRevenueShare(payload = {}) { return call("unlockTenantRevenueShare", payload); }
