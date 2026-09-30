import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";

const STAFF_ROLES = new Set(["admin", "cashier", "kitchen", "manager", "stock"]);
const BUSINESS_SCOPES = new Set(["order_delivery", "retail_pos", "both"]);

function normalizeUser(data = {}) {
  const role = String(data.roleId || data.role || "").trim().toLowerCase();
  const requestedScope = String(data.businessScope || data.business_scope || "order_delivery").trim().toLowerCase();
  return {
    uid: String(data.uid || data.id || ""),
    displayName: String(data.displayName || data.name || ""),
    email: String(data.email || data.username || ""),
    role,
    roleId: role,
    businessScope: BUSINESS_SCOPES.has(requestedScope) ? requestedScope : "order_delivery",
    active: data.active !== false,
    tenantId: String(data.tenantId || ""),
  };
}

async function call(name, payload = {}) {
  const response = await httpsCallable(functions, name)(payload);
  return response?.data || {};
}

export async function listStaffUsers() {
  const data = await call("listTenantStaff");
  return (Array.isArray(data.users) ? data.users : [])
    .map(normalizeUser)
    .filter(user => STAFF_ROLES.has(user.role))
    .sort((a, b) => String(a.displayName || a.email).localeCompare(String(b.displayName || b.email), "th"));
}

export async function createStaffUser(payload = {}) {
  const data = await call("createTenantStaff", {
    displayName: String(payload.displayName || "").trim(),
    email: String(payload.email || "").trim().toLowerCase(),
    password: String(payload.password || ""),
    role: String(payload.role || ""),
    businessScope: String(payload.businessScope || "order_delivery"),
    active: payload.active !== false,
  });
  return data;
}

export async function updateStaffUser(uid, patch = {}) {
  return call("updateTenantStaff", {
    uid: String(uid || "").trim(),
    displayName: String(patch.displayName || "").trim(),
    role: String(patch.role || ""),
    businessScope: String(patch.businessScope || "order_delivery"),
    active: patch.active !== false,
  });
}
