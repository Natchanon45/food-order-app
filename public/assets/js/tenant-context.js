const ACTIVE_TENANT_KEY = "food_order_active_tenant";
const LEGACY_ACTIVE_SHOP_KEY = "food_order_active_shop";

// Existing production tenant for the original restaurant.
// Slug lookup can replace this value when a /s/{slug} URL is used.
const DEFAULT_TENANT = Object.freeze({
  id: "ff897699-de82-4370-a360-35b22cc74c85",
  slug: "tuahere-somtam",
  name: "ส้มตำตัวเฮีย"
});

function normalizeTenant(value = {}) {
  return {
    id: String(value.id || value.tenantId || DEFAULT_TENANT.id).trim(),
    slug: String(value.slug || DEFAULT_TENANT.slug).trim().toLowerCase(),
    name: String(value.name || DEFAULT_TENANT.name).trim()
  };
}

function slugFromPath(pathname = location.pathname) {
  const match = pathname.match(/^\/s\/([^/]+)/i);
  return match ? decodeURIComponent(match[1]).trim().toLowerCase() : "";
}

export function getStoredTenant() {
  try {
    const saved = localStorage.getItem(ACTIVE_TENANT_KEY)
      || localStorage.getItem(LEGACY_ACTIVE_SHOP_KEY);
    return saved ? normalizeTenant(JSON.parse(saved)) : null;
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

  if (pathSlug) {
    if (stored?.slug === pathSlug) return stored;
    if (pathSlug === DEFAULT_TENANT.slug) return DEFAULT_TENANT;

    // A non-default slug must first be resolved by tenantSlugs and stored.
    // Keeping an empty id prevents accidentally reading another tenant.
    return normalizeTenant({ id: "", slug: pathSlug, name: pathSlug });
  }

  return stored || DEFAULT_TENANT;
}

export function tenantCollectionPath(collectionName, tenant = resolveTenantContext()) {
  if (!collectionName) throw new Error("COLLECTION_NAME_REQUIRED");
  if (!tenant?.id) throw new Error("TENANT_NOT_RESOLVED");
  return ["tenants", tenant.id, collectionName];
}

export function tenantDocumentPath(collectionName, documentId, tenant = resolveTenantContext()) {
  if (!documentId) throw new Error("DOCUMENT_ID_REQUIRED");
  return [...tenantCollectionPath(collectionName, tenant), documentId];
}

// Temporary compatibility aliases while remaining pages are migrated.
export const getStoredShop = getStoredTenant;
export const setActiveShop = setActiveTenant;
export const clearActiveShop = clearActiveTenant;
export const resolveShopContext = resolveTenantContext;
export const shopCollectionPath = tenantCollectionPath;
export const shopDocumentPath = tenantDocumentPath;
export const DEFAULT_SHOP = DEFAULT_TENANT;

export { DEFAULT_TENANT };
