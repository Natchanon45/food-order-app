import { db, isFirebaseConfigured, collection, getDocs, query, where } from './firebase-config.js';

const ACTIVE_TENANT_KEY = "food_order_active_tenant";
const LEGACY_ACTIVE_SHOP_KEY = "food_order_active_shop";

const DEFAULT_TENANT = Object.freeze({
  id: "ff897699-de82-4370-a360-35b22cc74c85",
  slug: "tuahere-somtam",
  name: "ส้มตำตัวเฮีย"
});

function normalizeTenant(value = {}) {
  const tenant = {
    id: String(value.id || value.tenantId || "").trim(),
    slug: String(value.slug || value.tenantSlug || "").trim().toLowerCase(),
    name: String(value.name || value.tenantName || value.slug || value.tenantSlug || "").trim()
  };

  if (!tenant.id) throw new Error("TENANT_ID_REQUIRED");
  if (!tenant.slug) throw new Error("TENANT_SLUG_REQUIRED");
  return tenant;
}

function slugFromPath(pathname = location.pathname) {
  const match = pathname.match(/^\/s\/([^/]+)/i);
  return match ? decodeURIComponent(match[1]).trim().toLowerCase() : "";
}

export function getStoredTenant() {
  try {
    const saved = localStorage.getItem(ACTIVE_TENANT_KEY);
    return saved ? normalizeTenant(JSON.parse(saved)) : null;
  } catch (error) {
    console.warn("Unable to read active tenant", error);
    clearActiveTenant();
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

async function fetchTenantBySlug(slug) {
  if (!isFirebaseConfigured || !db || !slug) return null;
  const snapshot = await getDocs(query(collection(db, "tenants"), where("slug", "==", slug)));
  if (snapshot.empty) return null;
  const docSnapshot = snapshot.docs[0];
  const data = docSnapshot.data();
  if (data.active === false || ["expired", "suspended"].includes(data.subscriptionStatus)) {
    throw new Error(`TENANT_INACTIVE:${slug}`);
  }
  return setActiveTenant({
    id: docSnapshot.id,
    slug: data.slug || slug,
    name: data.name || data.shopName || slug
  });
}

export async function ensureTenantContext() {
  const pathSlug = slugFromPath();
  const stored = getStoredTenant();
  if (!pathSlug) {
    if (stored?.id && stored?.slug) return stored;
    throw new Error("TENANT_CONTEXT_REQUIRED");
  }
  if (stored?.slug === pathSlug) return stored;
  const tenant = await fetchTenantBySlug(pathSlug);
  if (tenant) return tenant;
  clearActiveTenant();
  throw new Error(`TENANT_NOT_RESOLVED:${pathSlug}`);
}

export function resolveTenantContext() {
  const pathSlug = slugFromPath();
  const stored = getStoredTenant();

  if (pathSlug) {
    if (stored?.slug === pathSlug) return stored;
    throw new Error(`TENANT_NOT_RESOLVED:${pathSlug}`);
  }

  if (stored?.id && stored?.slug) return stored;
  throw new Error("TENANT_CONTEXT_REQUIRED");
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
export const ensureShopContext = ensureTenantContext;
export const DEFAULT_SHOP = DEFAULT_TENANT;

export { DEFAULT_TENANT };
