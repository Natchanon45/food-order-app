import { dataService } from "./data-service.js?v=20260903-230";
import { storage, ref, uploadBytes } from "./firebase-config.js?v=20260630-073";
import { getStoredTenant } from "./tenant-context.js?v=20260903-201";

const pendingOrderIds = new Map();
const VALID_ORDER_ID = /^[a-zA-Z0-9_-]{8,128}$/;

function slug() {
  const match = location.pathname.match(/^\/s\/([^/]+)/i);
  return decodeURIComponent(match?.[1] || getStoredTenant()?.slug || "").toLowerCase();
}
function tableSession() {
  const params = new URLSearchParams(location.search);
  return { table: (params.get("table") || params.get("code") || "").trim(), token: params.get("token") || "" };
}
function createUuid() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function pendingKey(channel, identity = "") { return `food_order_public_pending:${slug()}:${channel}:${String(identity || "").trim()}`; }
function readPendingId(key) {
  try { const value = sessionStorage.getItem(key) || ""; if (VALID_ORDER_ID.test(value)) return value; } catch {}
  const value = pendingOrderIds.get(key) || "";
  return VALID_ORDER_ID.test(value) ? value : "";
}
function writePendingId(key, id) { pendingOrderIds.set(key, id); try { sessionStorage.setItem(key, id); } catch {} }
function clearPendingId(key) { pendingOrderIds.delete(key); try { sessionStorage.removeItem(key); } catch {} }
function preparedOrderId(channel, identity = "", providedId = "") {
  const key = pendingKey(channel, identity);
  const existing = readPendingId(key);
  if (existing) return { id: existing, key };
  const explicit = String(providedId || "").trim();
  const id = VALID_ORDER_ID.test(explicit) ? explicit : createUuid();
  writePendingId(key, id);
  return { id, key };
}

export const publicStorefrontService = {
  getActiveShop() { return dataService.getActiveShop() || getStoredTenant() || { slug: slug() }; },
  prepareOrderId(channel, identity = "", providedId = "") { return preparedOrderId(channel, identity, providedId).id; },
  async listMenus() { return dataService.listMenus(); },
  async getStoreSettings() { return dataService.getStoreSettings(); },
  async getTable(value) {
    const session = tableSession();
    const table = await dataService.getTable(value || session.table);
    if (!table || !session.token || table.orderToken !== session.token || table.status !== "occupied") return null;
    return table;
  },
  async listTables() { const table = await this.getTable(tableSession().table); return table ? [table] : []; },
  async createTableOrder(order = {}) {
    const session = tableSession();
    const identity = order.tableToken || session.token || order.tableCode || session.table;
    const pending = preparedOrderId("table", identity, order.id);
    const result = await dataService.createTableOrder({ ...order, id: pending.id });
    clearPendingId(pending.key);
    return result;
  },
  async createOrderWithId(id, order = {}) { return dataService.createOrderWithId(id, { ...order, id }); },
  async createDeliveryOrder(order = {}) {
    const pending = preparedOrderId("delivery", "", order.id);
    const result = await dataService.createDeliveryOrder({ ...order, id: pending.id });
    clearPendingId(pending.key);
    return result;
  },
  async createTakeawayOrder(order = {}) {
    const pending = preparedOrderId("takeaway", "", order.id);
    const result = await dataService.createTakeawayOrder({ ...order, id: pending.id });
    clearPendingId(pending.key);
    return result;
  },
  async getOrder(id) { return dataService.getOrder(id); },
  async uploadSlip(file, orderId) {
    if (!file) return { path: "" };
    if (file.size > 8 * 1024 * 1024) throw new Error("SLIP_TOO_LARGE");
    if (!storage) throw new Error("STORAGE_NOT_READY");
    const tenant = this.getActiveShop();
    if (!tenant?.id) throw new Error("TENANT_NOT_READY");
    const extension = (String(file.name || "").split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "") || "jpg";
    const path = `tenants/${tenant.id}/payment-slips/${orderId}/${Date.now()}.${extension}`;
    const fileRef = ref(storage, path);
    const contentType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
    await uploadBytes(fileRef, file, { contentType, customMetadata: { tenantId: tenant.id, orderId } });
    return { path };
  }
};
