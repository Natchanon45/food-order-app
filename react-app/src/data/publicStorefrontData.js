import {
  collection, doc, getDoc, getDocFromServer, getDocs, onSnapshot, query, runTransaction,
  serverTimestamp, setDoc, where,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, storage, functions } from "@/firebase/client";
import { getDeliveryOpeningStatus } from "@/utils/deliveryOpeningHours";

const submitPublicDeliveryOrder = httpsCallable(functions, "submitPublicDeliveryOrder", { timeout: 55000 });

const DEFAULT_FOOD_IMAGE = "/assets/images/default-food.svg";
const ACTIVE_TENANT_KEY = "food_order_active_tenant";
const PENDING_PREFIX = "food_order_react_public_pending";

function normalizeSlug(value = "") {
  return decodeURIComponent(String(value || "")).trim().toLowerCase();
}

export function publicSlugFromPath(pathname = location.pathname) {
  const match = String(pathname || "").match(/^\/s\/([^/]+)/i);
  return match ? normalizeSlug(match[1]) : "";
}

function tenantCollection(tenant, name) {
  return collection(db, "tenants", String(tenant.id), name);
}

function tenantDocument(tenant, name, id) {
  return doc(db, "tenants", String(tenant.id), name, String(id));
}

function tenantPayload(tenant, payload = {}) {
  return { ...payload, tenantId: tenant.id, shopId: tenant.id };
}

function clampPosition(value) {
  const number = Number(value);
  return Math.max(0, Math.min(100, Number.isFinite(number) ? number : 50));
}

function normalizeMenu(menu = {}) {
  return {
    ...menu,
    image: menu.image || DEFAULT_FOOD_IMAGE,
    imagePositionX: 50,
    imagePositionY: clampPosition(menu.imagePositionY),
    sortOrder: Number(menu.sortOrder ?? 9999),
  };
}

function categoryOrderKey(value = "") {
  return String(value).normalize("NFKC").trim().toLocaleLowerCase();
}

function sortMenus(menus = [], categoryOrder = []) {
  const rank = new Map((categoryOrder || []).map((name, index) => [categoryOrderKey(name), index]));
  return [...menus].sort((a, b) => {
    const ac = String(a.category || "อื่น ๆ");
    const bc = String(b.category || "อื่น ๆ");
    const ar = rank.get(categoryOrderKey(ac)) ?? 9999;
    const br = rank.get(categoryOrderKey(bc)) ?? 9999;
    if (ar !== br) return ar - br;
    if (ac !== bc) return ac.localeCompare(bc, "th");
    const as = Number(a.sortOrder ?? 9999);
    const bs = Number(b.sortOrder ?? 9999);
    if (as !== bs) return as - bs;
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}

function inactiveTenant(data = {}) {
  const revenueMode = data.revenueShareEnabled === true || data.billingMode === "revenue_share";
  if (revenueMode) return data.active === false || data.revenueShareSuspended === true;
  return data.active === false || ["expired", "suspended"].includes(String(data.subscriptionStatus || "").toLowerCase());
}

export async function resolvePublicTenant(slugValue = publicSlugFromPath()) {
  const slug = normalizeSlug(slugValue);
  if (!slug) throw new Error("TENANT_CONTEXT_REQUIRED");
  const snapshot = await getDocs(query(collection(db, "tenants"), where("slug", "==", slug)));
  if (snapshot.empty) throw new Error("TENANT_NOT_RESOLVED");
  const item = snapshot.docs[0];
  const data = item.data() || {};
  if (inactiveTenant(data)) throw new Error("TENANT_INACTIVE");
  const tenant = {
    ...data,
    id: item.id,
    slug: normalizeSlug(data.slug || slug),
    name: String(data.name || data.shopName || data.slug || slug).trim(),
  };
  try {
    localStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify({ id: tenant.id, slug: tenant.slug, name: tenant.name }));
  } catch {}
  return tenant;
}

export async function getPublicStoreSettings(tenant) {
  const snapshot = await getDoc(tenantDocument(tenant, "settings", "store"));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : {};
}

// Subscribe to live status changes while the customer keeps Delivery open.
export function watchPublicStoreSettings(tenant, onSettings, onError = console.error) {
  return onSnapshot(tenantDocument(tenant, "settings", "store"),
    snapshot => onSettings(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : {}),
    onError);
}

// A server fetch right before the payment workflow avoids relying on a cached
// opening status when the store has just forced an emergency closure.
export async function checkDeliveryStoreIsOpen(tenant) {
  const snapshot = await getDocFromServer(tenantDocument(tenant, "settings", "store"));
  if (!snapshot.exists()) throw new Error("DELIVERY_STORE_STATUS_UNAVAILABLE");
  if (!getDeliveryOpeningStatus(snapshot.data()).open) throw new Error("DELIVERY_STORE_CLOSED");
  return true;
}

export async function listPublicMenus(tenant) {
  const [menuSnapshot, settings] = await Promise.all([
    getDocs(tenantCollection(tenant, "menus")),
    getPublicStoreSettings(tenant),
  ]);
  const rows = menuSnapshot.docs.map(item => normalizeMenu({ id: item.id, ...item.data() }));
  return sortMenus(rows, settings.categoryOrder || []);
}

export async function loadPublicStorefront(tenant) {
  const [menus, settings] = await Promise.all([
    listPublicMenus(tenant),
    getPublicStoreSettings(tenant),
  ]);
  return { menus, settings };
}

export async function getPublicTable(tenant, idOrCode) {
  const lookup = String(idOrCode || "").trim().toUpperCase();
  if (!lookup) return null;
  const direct = await getDoc(tenantDocument(tenant, "tables", idOrCode));
  if (direct.exists()) return { id: direct.id, ...direct.data() };
  const snapshot = await getDocs(tenantCollection(tenant, "tables"));
  return snapshot.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .find(item => String(item.id || "").toUpperCase() === lookup || String(item.code || "").toUpperCase() === lookup) || null;
}

export async function findPublicTableSession(tenant, idOrCode, token) {
  const direct = await getPublicTable(tenant, idOrCode);
  if (direct && direct.active !== false && direct.status === "occupied" && direct.orderToken === token) return direct;
  if (!token) return null;
  const snapshot = await getDocs(tenantCollection(tenant, "tables"));
  return snapshot.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .find(item => item.active !== false && item.status === "occupied" && item.orderToken === token) || null;
}

function pendingKey(tenant, channel, identity = "") {
  return [PENDING_PREFIX, tenant.slug || tenant.id, channel, String(identity || "").trim()].join(":");
}

export function preparePublicOrderId(tenant, channel, identity = "") {
  const key = pendingKey(tenant, channel, identity);
  try {
    const existing = sessionStorage.getItem(key);
    if (/^[A-Za-z0-9_-]{8,128}$/.test(existing || "")) return existing;
  } catch {}
  const id = typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : (channel + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12));
  try { sessionStorage.setItem(key, id); } catch {}
  return id;
}

export function clearPublicOrderId(tenant, channel, identity = "") {
  try { sessionStorage.removeItem(pendingKey(tenant, channel, identity)); } catch {}
}

export async function createPublicTableOrder(tenant, order = {}) {
  const table = await getPublicTable(tenant, order.tableCode);
  if (!table) throw new Error("INVALID_TABLE_SESSION");
  const tableRef = tenantDocument(tenant, "tables", table.id);
  const orderId = String(order.id || preparePublicOrderId(tenant, "table", order.tableToken || order.tableCode));
  const orderRef = tenantDocument(tenant, "orders", orderId);
  await runTransaction(db, async transaction => {
    const tableSnapshot = await transaction.get(tableRef);
    if (!tableSnapshot.exists()) throw new Error("INVALID_TABLE_SESSION");
    const tableData = tableSnapshot.data() || {};
    if (tableData.status !== "occupied" || tableData.orderToken !== order.tableToken) throw new Error("INVALID_TABLE_SESSION");
    const roundNumber = Number(tableData.currentRound || 0) + 1;
    transaction.update(tableRef, tenantPayload(tenant, {
      currentRound: roundNumber,
      orderIds: [...new Set([...(tableData.orderIds || []), orderId])],
      updatedAt: serverTimestamp(),
    }));
    transaction.set(orderRef, tenantPayload(tenant, {
      ...order, id: orderId, orderType: "table", paymentStatus: order.paymentStatus || "unpaid",
      status: order.status || "pending", roundNumber, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  });
  clearPublicOrderId(tenant, "table", order.tableToken || order.tableCode);
  return { id: orderId };
}

export function watchPublicTableOrders(tenant, tableId, tableToken, callback, onError = console.error) {
  let orderStops = new Map();
  let orderRows = new Map();
  let lastTable = null;
  const emit = () => callback({ table: lastTable, orders: [...orderRows.values()] });
  const stopTable = onSnapshot(tenantDocument(tenant, "tables", tableId), snapshot => {
    if (!snapshot.exists()) { lastTable = null; orderStops.forEach(stop => stop()); orderStops.clear(); orderRows.clear(); emit(); return; }
    const table = { id: snapshot.id, ...snapshot.data() };
    lastTable = table;
    if (table.status !== "occupied" || table.orderToken !== tableToken) {
      orderStops.forEach(stop => stop()); orderStops.clear(); orderRows.clear(); emit(); return;
    }
    const ids = new Set((table.orderIds || []).map(String).filter(Boolean));
    for (const [id, stop] of orderStops) {
      if (ids.has(id)) continue;
      stop(); orderStops.delete(id); orderRows.delete(id);
    }
    ids.forEach(id => {
      if (orderStops.has(id)) return;
      const stop = onSnapshot(tenantDocument(tenant, "orders", id), orderSnapshot => {
        if (orderSnapshot.exists()) orderRows.set(id, { id: orderSnapshot.id, ...orderSnapshot.data() });
        else orderRows.delete(id);
        emit();
      }, onError);
      orderStops.set(id, stop);
    });
    emit();
  }, onError);
  return () => { stopTable(); orderStops.forEach(stop => stop()); orderStops.clear(); };
}

function dateKeyFrom(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return String(date.getFullYear()) + String(date.getMonth() + 1).padStart(2, "0") + String(date.getDate()).padStart(2, "0");
}

function takeawayQueueNo(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return "TA-" + String(date.getHours()).padStart(2, "0") + String(date.getMinutes()).padStart(2, "0") + String(date.getSeconds()).padStart(2, "0") + "-" + Math.random().toString(36).slice(2, 5).toUpperCase();
}

export async function createPublicTakeawayOrder(tenant, order = {}) {
  const customerName = String(order.customerName || "").trim();
  const customerPhone = String(order.customerPhone || "").trim();
  if (!customerName && !customerPhone) throw new Error("TAKEAWAY_CUSTOMER_REQUIRED");
  const createdAtText = new Date().toISOString();
  const queueNo = takeawayQueueNo(createdAtText);
  const id = String(order.id || preparePublicOrderId(tenant, "takeaway"));
  await setDoc(tenantDocument(tenant, "orders", id), tenantPayload(tenant, {
    ...order, id, orderType: "takeaway", tableCode: "", tableToken: "", tableName: "",
    customerName, customerPhone, queueNo, pickupStatus: "waiting",
    paymentStatus: order.paymentStatus || "unpaid", status: order.status || "pending",
    dateKey: dateKeyFrom(createdAtText), createdAt: serverTimestamp(), createdAtText, updatedAt: serverTimestamp(),
  }));
  clearPublicOrderId(tenant, "takeaway");
  return { id, queueNo };
}

function localDateKey() {
  const now = new Date();
  return String(now.getFullYear()) + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
}

export function normalizeDeliveryFreeGift(settings = {}) {
  const source = settings?.deliveryPromotion?.freeGift && typeof settings.deliveryPromotion.freeGift === "object"
    ? settings.deliveryPromotion.freeGift : {};
  return {
    enabled: Boolean(source.enabled),
    maxSelectableItems: Math.min(20, Math.max(0, Number.parseInt(source.maxSelectableItems || 0, 10) || 0)),
    validFrom: String(source.validFrom || "").trim(),
    validUntil: String(source.validUntil || "").trim(),
    menuIds: [...new Set((Array.isArray(source.menuIds) ? source.menuIds : []).map(value => String(value || "").trim()).filter(Boolean))],
  };
}

export function deliveryFreeGiftActive(config = {}) {
  if (!config.enabled || config.maxSelectableItems < 1 || !config.menuIds?.length) return false;
  const today = localDateKey();
  if (config.validFrom && today < config.validFrom) return false;
  if (config.validUntil && today > config.validUntil) return false;
  return true;
}

export async function createPublicDeliveryOrder(tenant, order = {}, catalog = null) {
  const id = String(order.id || preparePublicOrderId(tenant, "delivery"));
  const settings = catalog?.settings || await getPublicStoreSettings(tenant);
  const menus = catalog?.menus || await listPublicMenus(tenant);
  const config = normalizeDeliveryFreeGift(settings);
  const selectedIds = [...new Set((Array.isArray(order.freeGiftMenuIds) ? order.freeGiftMenuIds : []).map(String).filter(Boolean))];
  const paidItems = (Array.isArray(order.items) ? order.items : []).filter(item => item?.isGift !== true);
  let normalized = { ...order, freeGiftApplied: false, freeGiftMenuIds: [], freeGiftItems: [], items: paidItems };
  if (deliveryFreeGiftActive(config)) {
    const allowed = new Set(config.menuIds);
    const activeMenus = menus.filter(menu => menu.active !== false && allowed.has(String(menu.id || "")));
    const activeMap = new Map(activeMenus.map(menu => [String(menu.id), menu]));
    if (activeMenus.length && selectedIds.length < 1) throw new Error("DELIVERY_FREE_GIFT_REQUIRED");
    if (selectedIds.length > config.maxSelectableItems) throw new Error("DELIVERY_FREE_GIFT_LIMIT_EXCEEDED");
    if (selectedIds.some(idValue => !activeMap.has(idValue))) throw new Error("DELIVERY_FREE_GIFT_INVALID");
    const freeGiftItems = selectedIds.map(menuId => {
      const menu = activeMap.get(menuId);
      return { menuId, name: String(menu?.name || ""), price: 0, originalPrice: Number(menu?.price || 0), qty: 1, note: "", cancelled: false, isGift: true };
    });
    normalized = {
      ...order, freeGiftApplied: freeGiftItems.length > 0, freeGiftMenuIds: selectedIds, freeGiftItems,
      freeGiftMaxSelectableItems: config.maxSelectableItems, freeGiftValidFrom: config.validFrom,
      freeGiftValidUntil: config.validUntil, items: [...paidItems, ...freeGiftItems],
    };
  } else if (selectedIds.length) {
    throw new Error("DELIVERY_FREE_GIFT_NOT_AVAILABLE");
  }
  // Server Admin SDK creates the order only after an authoritative store-hours
  // transaction. A forged Firestore SDK call cannot bypass shop closure.
  const result = await submitPublicDeliveryOrder({
    tenantId: tenant.id,
    order: { ...normalized, id },
  });
  if (result?.data?.id !== id) throw new Error("DELIVERY_ORDER_CREATE_NOT_CONFIRMED");
  clearPublicOrderId(tenant, "delivery");
  return { id };
}

export async function getPublicOrder(tenant, id) {
  const snapshot = await getDoc(tenantDocument(tenant, "orders", id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function watchPublicOrder(tenant, id, callback, onError = console.error) {
  return onSnapshot(tenantDocument(tenant, "orders", id), snapshot => {
    callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, onError);
}

export async function uploadPublicPaymentSlip(tenant, file, orderId) {
  if (!file) return { path: "" };
  if (file.size > 8 * 1024 * 1024) throw new Error("SLIP_TOO_LARGE");
  const extension = (String(file.name || "").split(".").pop() || "jpg").replace(/[^A-Za-z0-9]/g, "") || "jpg";
  const path = "tenants/" + tenant.id + "/payment-slips/" + orderId + "/" + Date.now() + "." + extension;
  const fileRef = storageRef(storage, path);
  const contentType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
  await uploadBytes(fileRef, file, { contentType, customMetadata: { tenantId: tenant.id, orderId } });
  return { path };
}
