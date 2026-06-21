const ACTIVE_TENANT_KEY = "food_order_active_tenant";
const LEGACY_ACTIVE_SHOP_KEY = "food_order_active_shop";

const DEFAULT_TENANT = Object.freeze({
  id: "ff897699-de82-4370-a360-35b22cc74c85",
  slug: "tuahere-somtam",
  name: "ส้มตำตัวเฮีย"
});

function normalizeTenant(value = {}) {
  return {
    id: String(value.id || value.tenantId || DEFAULT_TENANT.id).trim(),
    slug: String(value.slug || value.tenantSlug || DEFAULT_TENANT.slug).trim().toLowerCase(),
    name: String(value.name || value.tenantName || DEFAULT_TENANT.name).trim()
  };
}

function slugFromPath(pathname = location.pathname) {
  const match = pathname.match(/^\/s\/([^/]+)/i);
  return match ? decodeURIComponent(match[1]).trim().toLowerCase() : "";
}

export function getStoredTenant() {
  try {
    const saved = localStorage.getItem(ACTIVE_TENANT_KEY);
    if (saved) return normalizeTenant(JSON.parse(saved));

    const legacy = localStorage.getItem(LEGACY_ACTIVE_SHOP_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed?.slug === DEFAULT_TENANT.slug || parsed?.id === "default-shop") {
        localStorage.removeItem(LEGACY_ACTIVE_SHOP_KEY);
        localStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify(DEFAULT_TENANT));
        return DEFAULT_TENANT;
      }
    }
    return null;
  } catch (error) {
    console.warn("Unable to read active tenant", error);
    return null;
  }
}

export function setActiveTenant(tenant) {
  const normalized = normalizeTenant(tenant);
  localStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify(normalized));
  localStorage.removeItem(LEGACY_ACTIVE_SHOP_KEY);
  return normalized;
}

export function clearActiveTenant() {
  localStorage.removeItem(ACTIVE_TENANT_KEY);
  localStorage.removeItem(LEGACY_ACTIVE_SHOP_KEY);
}

export function resolveTenantContext() {
  const pathSlug = slugFromPath();
  const stored = getStoredTenant();

  // Staff routes such as /admin, /cashier and /kitchen do not contain a
  // tenant slug. They must therefore use the tenant selected from the
  // authenticated user's profile instead of falling back to the default shop.
  if (!pathSlug) return stored || DEFAULT_TENANT;

  if (pathSlug === DEFAULT_TENANT.slug) {
    return stored?.slug === DEFAULT_TENANT.slug ? stored : DEFAULT_TENANT;
  }

  if (stored?.slug === pathSlug) return stored;
  throw new Error(`TENANT_NOT_RESOLVED:${pathSlug}`);
}

export function tenantCollectionPath(collectionName, tenant = resolveTenantContext()) {
  if (!collectionName) throw new Error("COLLECTION_NAME_REQUIRED");
  if (!tenant?.id) throw new Error("TENANT_ID_REQUIRED");
  return ["tenants", tenant.id, collectionName];
}

export function tenantDocumentPath(collectionName, documentId, tenant = resolveTenantContext()) {
  if (!documentId) throw new Error("DOCUMENT_ID_REQUIRED");
  return [...tenantCollectionPath(collectionName, tenant), documentId];
}

export const getStoredShop = getStoredTenant;
export const setActiveShop = setActiveTenant;
export const clearActiveShop = clearActiveTenant;
export const resolveShopContext = resolveTenantContext;
export const shopCollectionPath = tenantCollectionPath;
export const shopDocumentPath = tenantDocumentPath;
export const DEFAULT_SHOP = DEFAULT_TENANT;

export { DEFAULT_TENANT };