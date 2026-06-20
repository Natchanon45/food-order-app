const ACTIVE_SHOP_KEY = "food_order_active_shop";
const DEFAULT_SHOP = Object.freeze({
  id: "default-shop",
  slug: "default",
  name: "Food Order QR"
});

function normalizeShop(value = {}) {
  return {
    id: String(value.id || DEFAULT_SHOP.id).trim(),
    slug: String(value.slug || DEFAULT_SHOP.slug).trim().toLowerCase(),
    name: String(value.name || DEFAULT_SHOP.name).trim()
  };
}

function slugFromPath(pathname = location.pathname) {
  const match = pathname.match(/^\/s\/([^/]+)/i);
  return match ? decodeURIComponent(match[1]).trim().toLowerCase() : "";
}

export function getStoredShop() {
  try {
    const saved = localStorage.getItem(ACTIVE_SHOP_KEY);
    return saved ? normalizeShop(JSON.parse(saved)) : null;
  } catch (error) {
    console.warn("Unable to read active shop", error);
    return null;
  }
}

export function setActiveShop(shop) {
  const normalized = normalizeShop(shop);
  localStorage.setItem(ACTIVE_SHOP_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearActiveShop() {
  localStorage.removeItem(ACTIVE_SHOP_KEY);
}

export function resolveShopContext() {
  const pathSlug = slugFromPath();
  const stored = getStoredShop();

  if (pathSlug) {
    return normalizeShop({
      id: stored?.slug === pathSlug ? stored.id : pathSlug,
      slug: pathSlug,
      name: stored?.slug === pathSlug ? stored.name : pathSlug
    });
  }

  return stored || DEFAULT_SHOP;
}

export function shopCollectionPath(collectionName, shop = resolveShopContext()) {
  if (!collectionName) throw new Error("COLLECTION_NAME_REQUIRED");
  return ["shops", shop.id, collectionName];
}

export function shopDocumentPath(collectionName, documentId, shop = resolveShopContext()) {
  if (!documentId) throw new Error("DOCUMENT_ID_REQUIRED");
  return [...shopCollectionPath(collectionName, shop), documentId];
}

export { DEFAULT_SHOP };
