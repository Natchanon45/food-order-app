import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/firebase/client";

const ROLE_KEY = "retail_pos_roles_v1";
const SESSION_KEY = "retail_pos_session_v1";
const CURRENT_USER_KEY = "retail_pos_current_user_v1";
const TENANT_KEY = "retail_pos_tenant_id";

const lower = value => String(value || "").trim().toLowerCase();

export function canUseRetailPos(profile = {}) {
  const values = [
    profile.businessScope, profile.business_scope,
    profile.businessUnit, profile.business_unit,
    ...(Array.isArray(profile.businessUnits) ? profile.businessUnits : []),
    ...(Array.isArray(profile.modules) ? profile.modules : []),
    ...(Array.isArray(profile.allowedModules) ? profile.allowedModules : []),
  ].filter(Boolean).map(lower);
  const allowed = values.includes("retail_pos")
    || values.includes("retail")
    || values.includes("all")
    || values.includes("both");
  if (profile.role === "owner" || profile.roleId === "owner") return !values.length || allowed;
  return allowed;
}

function normalizeRole(role, tenantId) {
  const id = String(role?.id || role?.roleId || "").trim();
  if (!id) return null;
  return {
    id,
    name: role?.name || id,
    permissions: Array.isArray(role?.permissions) ? role.permissions.filter(Boolean) : [],
    locked: Boolean(role?.locked),
    tenantId,
  };
}

async function tenantRoles(tenantId) {
  try {
    const snap = await getDoc(doc(db, "tenants", tenantId, "settings", "roles"));
    if (snap.exists()) {
      const data = snap.data();
      const rows = Array.isArray(data.roles) ? data.roles : Array.isArray(data.items) ? data.items : [];
      const roles = rows.map(row => normalizeRole(row, tenantId)).filter(Boolean);
      if (roles.length) return roles;
    }
  } catch (error) {
    console.debug("RETAIL_POS_ROLE_SETTINGS_UNAVAILABLE", error);
  }

  try {
    const snap = await getDocs(collection(db, "tenants", tenantId, "roles"));
    return snap.docs
      .map(item => normalizeRole({ id: item.id, ...item.data() }, tenantId))
      .filter(Boolean);
  } catch (error) {
    console.debug("RETAIL_POS_ROLE_COLLECTION_UNAVAILABLE", error);
    return [];
  }
}

export function clearRetailPosSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
}

export async function prepareRetailPosSession(profile = {}) {
  if (!profile?.tenantId || !canUseRetailPos(profile)) {
    return { ok: false, message: "RETAIL_POS_NOT_ALLOWED" };
  }

  const tenantId = String(profile.tenantId).trim();
  localStorage.setItem(TENANT_KEY, tenantId);

  const roles = await tenantRoles(tenantId);
  if (roles.length) localStorage.setItem(ROLE_KEY, JSON.stringify(roles));

  const userId = profile.id || profile.uid || "";
  const role = profile.role || profile.roleId || "owner";
  const session = {
    tenantId,
    userId,
    uid: profile.uid || userId,
    email: profile.email || "",
    name: profile.name || profile.displayName || profile.ownerDisplayName || profile.email || "",
    role,
    roleId: profile.roleId || role,
    businessScope: profile.businessScope || profile.business_scope || "",
    businessUnit: profile.businessUnit || profile.business_unit || "",
    businessUnits: Array.isArray(profile.businessUnits) ? profile.businessUnits : [],
    loggedInAt: new Date().toISOString(),
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userId));
  return { ok: true, user: session };
}
