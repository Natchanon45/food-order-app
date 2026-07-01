import {
  db, isFirebaseConfigured, collection, addDoc, doc, getDoc, getDocs, setDoc,
  updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, runTransaction
} from "./firebase-config.js?v=20260630-073";
import { demoStore } from "./demo-store.js";
import { resolveShopContext, shopCollectionPath, shopDocumentPath } from "./tenant-context.js";

export const usingDemoMode = !isFirebaseConfigured;
const DEFAULT_FOOD_IMAGE = "/assets/images/default-food.svg";

function activeShop() { return resolveShopContext(); }
function shopCollection(name) { return collection(db, ...shopCollectionPath(name, activeShop())); }
function shopDocument(name, id) { return doc(db, ...shopDocumentPath(name, id, activeShop())); }
function mapDocs(snapshot) { return snapshot.docs.map(item => ({ id: item.id, ...item.data() })); }
function normalizeMenu(menu) { return { ...menu, image: menu.image || DEFAULT_FOOD_IMAGE, sortOrder: Number(menu.sortOrder || 9999) }; }
function sortMenus(menus, categoryOrder = []) {
  const rank = new Map(categoryOrder.map((name, index) => [name, index]));
  return [...menus].sort((a, b) => {
    const categoryA = a.category || "อื่น ๆ";
    const categoryB = b.category || "อื่น ๆ";
    const categoryRankA = rank.has(categoryA) ? rank.get(categoryA) : 9999;
    const categoryRankB = rank.has(categoryB) ? rank.get(categoryB) : 9999;
    if (categoryRankA !== categoryRankB) return categoryRankA - categoryRankB;
    if (categoryA !== categoryB) return categoryA.localeCompare(categoryB, "th");
    const itemRankA = Number(a.sortOrder || 9999);
    const itemRankB = Number(b.sortOrder || 9999);
    if (itemRankA !== itemRankB) return itemRankA - itemRankB;
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}
function withShop(payload = {}) { const tenantId = activeShop().id; return { ...payload, tenantId }; }
function isUnpaidTableOrder(order) { return order?.orderType !== "delivery" && order?.orderType !== "takeaway" && !["paid", "cancelled"].includes(order?.status) && order?.paymentStatus !== "paid"; }
function dateKeyFrom(value = new Date()) { const date = value instanceof Date ? value : new Date(value || Date.now()); return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`; }
function takeawayQueueNoFromDate(value = new Date()) { const date = value instanceof Date ? value : new Date(value || Date.now()); return `TA-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}${String(date.getSeconds()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`; }
function demoTakeawayQueueNo() { const dateKey = dateKeyFrom(); const count = demoStore.orders.list().filter(order => order.orderType === "takeaway" && String(order.dateKey || "") === dateKey).length + 1; return `TA-${String(count).padStart(3, "0")}`; }

export const dataService = {
  getActiveShop() { return activeShop(); },

  async getStoreSettings() {
    if (usingDemoMode) {
      const saved = localStorage.getItem("food_order_store_settings");
      return saved ? JSON.parse(saved) : {};
    }
    const snapshot = await getDoc(shopDocument("settings", "store"));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : {};
  },

  async saveStoreSettings(settings = {}) {
    if (usingDemoMode) {
      const current = await this.getStoreSettings();
      const next = { ...current, ...settings };
      localStorage.setItem("food_order_store_settings", JSON.stringify(next));
      return next;
    }
    const payload = withShop({ ...settings, updatedAt: serverTimestamp() });
    delete payload.id;
    return setDoc(shopDocument("settings", "store"), payload, { merge: true });
  },

  async listMenus() {
    if (usingDemoMode) {
      const settings = await this.getStoreSettings();
      return sortMenus(demoStore.menus.list().map(normalizeMenu), settings.categoryOrder || []);
    }
    const [menuSnapshot, settingsSnapshot] = await Promise.all([getDocs(shopCollection("menus")), getDoc(shopDocument("settings", "store"))]);
    const settings = settingsSnapshot.exists() ? settingsSnapshot.data() : {};
    return sortMenus(mapDocs(menuSnapshot).map(normalizeMenu), settings.categoryOrder || []);
  },

  async saveMenu(menu) { if (usingDemoMode) return demoStore.menus.save(menu); const id = menu.id || crypto.randomUUID(); const payload = withShop({ ...menu }); delete payload.id; return setDoc(shopDocument("menus", id), payload, { merge: true }); },
  async deleteMenu(id) { if (usingDemoMode) return demoStore.menus.remove(id); return deleteDoc(shopDocument("menus", id)); },
  async listTables() { if (usingDemoMode) return demoStore.tables.list(); return mapDocs(await getDocs(shopCollection("tables"))); },

  async getTable(idOrCode) {
    const lookup = String(idOrCode || "").trim().toUpperCase();
    if (!lookup) return null;
    if (usingDemoMode) return demoStore.tables.list().find(item => String(item.id || "").toUpperCase() === lookup || String(item.code || "").toUpperCase() === lookup) || null;
    const direct = await getDoc(shopDocument("tables", idOrCode));
    if (direct.exists()) return { id: direct.id, ...direct.data() };
    const tables = mapDocs(await getDocs(shopCollection("tables")));
    return tables.find(item => String(item.id || "").toUpperCase() === lookup || String(item.code || "").toUpperCase() === lookup) || null;
  },

  async saveTable(table) { if (usingDemoMode) return demoStore.tables.save(table); const id = table.id || table.code; const payload = withShop({ status: "available", orderToken: "", currentRound: 0, ...table }); delete payload.id; return setDoc(shopDocument("tables", id), payload, { merge: true }); },
  async updateTable(id, patch) { if (usingDemoMode) { const table = await this.getTable(id); if (!table) return; return demoStore.tables.save({ ...table, ...patch, id: table.id }); } return updateDoc(shopDocument("tables", id), withShop({ ...patch, updatedAt: serverTimestamp() })); },
  async deleteTable(id) { if (usingDemoMode) return demoStore.tables.remove(id); return deleteDoc(shopDocument("tables", id)); },
  async createOrder(order) { if (usingDemoMode) return demoStore.orders.add(order); return addDoc(shopCollection("orders"), withShop({ ...order, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })); },
  async createOrderWithId(id, order) { if (!id) throw new Error("ORDER_ID_REQUIRED"); if (usingDemoMode) return demoStore.orders.add({ ...order, id }); await setDoc(shopDocument("orders", id), withShop({ ...order, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })); return { id }; },

  async createTakeawayOrder(order) {
    const customerName = String(order.customerName || "").trim();
    const customerPhone = String(order.customerPhone || "").trim();
    if (!customerName && !customerPhone) throw new Error("TAKEAWAY_CUSTOMER_REQUIRED");
    const createdAtIso = new Date().toISOString();
    const dateKey = dateKeyFrom(createdAtIso);
    const queueNo = usingDemoMode ? demoTakeawayQueueNo() : takeawayQueueNoFromDate(createdAtIso);
    const baseOrder = { ...order, orderType: "takeaway", tableCode: "", tableToken: "", tableName: "", customerName, customerPhone, queueNo, pickupStatus: "waiting", paymentStatus: order.paymentStatus || "unpaid", status: order.status || "pending", dateKey };
    if (usingDemoMode) return demoStore.orders.add({ ...baseOrder, createdAt: createdAtIso, updatedAt: createdAtIso });
    const ref = await addDoc(shopCollection("orders"), withShop({ ...baseOrder, createdAt: serverTimestamp(), createdAtText: createdAtIso, updatedAt: serverTimestamp() }));
    return { id: ref.id, queueNo };
  },

  async createTableOrder(order) {
    if (usingDemoMode) {
      const table = await this.getTable(order.tableCode);
      if (!table || table.status !== "occupied" || table.orderToken !== order.tableToken) throw new Error("INVALID_TABLE_SESSION");
      const roundNumber = Number(table.currentRound || 0) + 1;
      await this.updateTable(table.id, { currentRound: roundNumber });
      return demoStore.orders.add({ ...order, roundNumber });
    }
    const table = await this.getTable(order.tableCode);
    if (!table) throw new Error("INVALID_TABLE_SESSION");
    const tableRef = shopDocument("tables", table.id);
    const orderRef = doc(shopCollection("orders"));
    await runTransaction(db, async transaction => {
      const tableSnapshot = await transaction.get(tableRef);
      if (!tableSnapshot.exists()) throw new Error("INVALID_TABLE_SESSION");
      const tableData = tableSnapshot.data();
      if (tableData.status !== "occupied" || tableData.orderToken !== order.tableToken) throw new Error("INVALID_TABLE_SESSION");
      const roundNumber = Number(tableData.currentRound || 0) + 1;
      transaction.update(tableRef, withShop({ currentRound: roundNumber, updatedAt: serverTimestamp() }));
      transaction.set(orderRef, withShop({ ...order, roundNumber, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    });
    return { id: orderRef.id };
  },

  async getOrder(id) { if (usingDemoMode) return demoStore.orders.list().find(item => item.id === id) || null; const snapshot = await getDoc(shopDocument("orders", id)); return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null; },
  async updateOrder(id, patch) { if (usingDemoMode) return demoStore.orders.update(id, patch); return updateDoc(shopDocument("orders", id), withShop({ ...patch, updatedAt: serverTimestamp() })); },

  async moveTableSession({ fromTableCode, fromTableToken, toTableId, orders = [] }) {
    const orderIds = [...new Set((orders || []).map(order => String(order?.id || "").trim()).filter(Boolean))];
    if (!fromTableCode || !fromTableToken || !toTableId || !orderIds.length) throw new Error("INVALID_TABLE_MOVE_REQUEST");
    const fromTable = await this.getTable(fromTableCode);
    const toTable = await this.getTable(toTableId);
    if (!fromTable || fromTable.status !== "occupied" || fromTable.orderToken !== fromTableToken) throw new Error("SOURCE_TABLE_NOT_ACTIVE");
    if (!toTable || toTable.active === false || (toTable.status && toTable.status !== "available")) throw new Error("TARGET_TABLE_NOT_AVAILABLE");
    if (String(fromTable.id) === String(toTable.id)) throw new Error("SAME_TABLE_MOVE");
    const movedAt = new Date().toISOString();
    const targetCode = toTable.code || toTable.id;
    const targetName = toTable.name || `โต๊ะ ${targetCode}`;
    const maxRound = Math.max(Number(fromTable.currentRound || 0), ...orders.map(order => Number(order?.roundNumber || 0)));

    if (usingDemoMode) {
      const latestOrders = demoStore.orders.list().filter(order => orderIds.includes(String(order.id)));
      if (latestOrders.length !== orderIds.length) throw new Error("MOVE_ORDER_NOT_FOUND");
      latestOrders.forEach(order => { if (!isUnpaidTableOrder(order) || order.tableToken !== fromTableToken || String(order.tableCode) !== String(fromTable.code || fromTable.id)) throw new Error("MOVE_ORDER_NOT_UNPAID"); });
      await this.updateTable(fromTable.id, { status: "available", orderToken: "", sessionStartedAt: null, currentRound: 0 });
      await this.updateTable(toTable.id, { status: "occupied", orderToken: fromTableToken, sessionStartedAt: fromTable.sessionStartedAt || movedAt, currentRound: maxRound, movedFromTableCode: fromTable.code || fromTable.id, movedAt });
      latestOrders.forEach(order => demoStore.orders.update(order.id, { tableCode: targetCode, tableName: targetName, movedFromTableCode: fromTable.code || fromTable.id, tableMovedAt: movedAt }));
      return { fromTable, toTable: { ...toTable, code: targetCode, name: targetName }, movedOrders: latestOrders.length };
    }

    const fromTableRef = shopDocument("tables", fromTable.id);
    const toTableRef = shopDocument("tables", toTable.id);
    const orderRefs = orderIds.map(id => shopDocument("orders", id));
    await runTransaction(db, async transaction => {
      const [fromSnapshot, toSnapshot, ...orderSnapshots] = await Promise.all([transaction.get(fromTableRef), transaction.get(toTableRef), ...orderRefs.map(ref => transaction.get(ref))]);
      if (!fromSnapshot.exists()) throw new Error("SOURCE_TABLE_NOT_ACTIVE");
      const source = fromSnapshot.data();
      if (source.status !== "occupied" || source.orderToken !== fromTableToken) throw new Error("SOURCE_TABLE_NOT_ACTIVE");
      if (!toSnapshot.exists()) throw new Error("TARGET_TABLE_NOT_AVAILABLE");
      const target = toSnapshot.data();
      if (target.active === false || (target.status && target.status !== "available")) throw new Error("TARGET_TABLE_NOT_AVAILABLE");
      orderSnapshots.forEach(snapshot => { if (!snapshot.exists()) throw new Error("MOVE_ORDER_NOT_FOUND"); const order = snapshot.data(); if (!isUnpaidTableOrder(order) || order.tableToken !== fromTableToken || String(order.tableCode) !== String(source.code || fromTableCode)) throw new Error("MOVE_ORDER_NOT_UNPAID"); });
      transaction.update(fromTableRef, withShop({ status: "available", orderToken: "", sessionStartedAt: null, currentRound: 0, updatedAt: serverTimestamp() }));
      transaction.update(toTableRef, withShop({ status: "occupied", orderToken: fromTableToken, sessionStartedAt: source.sessionStartedAt || movedAt, currentRound: maxRound, movedFromTableCode: source.code || fromTableCode, movedAt, updatedAt: serverTimestamp() }));
      orderRefs.forEach(ref => transaction.update(ref, withShop({ tableCode: targetCode, tableName: targetName, movedFromTableCode: source.code || fromTableCode, tableMovedAt: movedAt, updatedAt: serverTimestamp() })));
    });
    return { fromTable, toTable: { ...toTable, code: targetCode, name: targetName }, movedOrders: orderIds.length };
  },

  async createDeliveryOrder(order) { const id = `DELIVERY-${Date.now()}-${Math.random().toString(16).slice(2)}`; return this.createOrderWithId(id, { ...order, orderType: "delivery", status: "pending" }); },

  subscribeOrders(callback) {
    if (usingDemoMode) {
      const emit = () => callback(demoStore.orders.list());
      emit();
      const handler = () => emit();
      window.addEventListener("storage", handler);
      window.addEventListener("demo-store-change", handler);
      const timer = setInterval(emit, 1500);
      return () => { clearInterval(timer); window.removeEventListener("storage", handler); window.removeEventListener("demo-store-change", handler); };
    }
    return onSnapshot(query(shopCollection("orders"), orderBy("createdAt", "desc")), snapshot => callback(mapDocs(snapshot)));
  }
};