import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/client";

function requireTenantId(value) {
  const id = String(value || "").trim();
  if (!id) throw new Error("TENANT_REQUIRED");
  return id;
}

export function subscribeTenantOrders(tenantId, callback, onError) {
  const id = requireTenantId(tenantId);
  const ref = collection(db, "tenants", id, "orders");
  return onSnapshot(
    ref,
    snapshot => callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))),
    error => {
      console.error("SALES_REPORT_ORDERS_SUBSCRIBE_FAILED", error);
      onError?.(error);
    },
  );
}

function giftItemId(item = {}) {
  return String(item.menuId || item.id || "").trim();
}

export function normalizeOrderGiftItems(order = {}) {
  const freeGiftItems = Array.isArray(order.freeGiftItems) ? order.freeGiftItems : [];
  const giftIds = new Set([
    ...(Array.isArray(order.freeGiftMenuIds) ? order.freeGiftMenuIds : []),
    ...freeGiftItems.map(giftItemId),
  ].map(value => String(value || "").trim()).filter(Boolean));
  const seenGiftIds = new Set();
  const items = (Array.isArray(order.items) ? order.items : []).map(item => {
    const id = giftItemId(item);
    const explicitGift = item?.isGift === true;
    const legacyGift = !explicitGift && id && giftIds.has(id) && Number(item?.price || 0) <= 0;
    const isGift = explicitGift || legacyGift;
    if (isGift && id) seenGiftIds.add(id);
    return isGift ? { ...item, isGift: true, price: 0 } : item;
  });
  freeGiftItems.forEach(gift => {
    const id = giftItemId(gift);
    if (id && seenGiftIds.has(id)) return;
    items.push({
      ...gift,
      menuId: id || gift.menuId,
      qty: Number(gift.qty || 1),
      price: 0,
      isGift: true,
      cancelled: gift.cancelled === true,
    });
  });
  return items;
}
