import { dataService, usingDemoMode } from "./data-service.js";
import { db, collection, doc, getDocs, setDoc, updateDoc, onSnapshot, query, orderBy, serverTimestamp } from "./firebase-config.js";
import { offlineStore } from "./offline-store.js";
import { resolveShopContext, shopCollectionPath, shopDocumentPath } from "./tenant-context.js";

const onlineDataService = { ...dataService };
let syncRunning = false;

function activeShop() { return resolveShopContext(); }
function shopCollection(name) { return collection(db, ...shopCollectionPath(name, activeShop())); }
function shopDocument(name, id) { return doc(db, ...shopDocumentPath(name, id, activeShop())); }
function mapDocs(snapshot) { return snapshot.docs.map(item => ({ id: item.id, ...item.data(), syncStatus: "synced" })); }
function shouldUseOffline(error) {
  if (usingDemoMode) return false;
  if (navigator.onLine === false) return true;
  const text = String(error?.code || error?.message || "").toLowerCase();
  return ["network", "offline", "unavailable", "timeout"].some(part => text.includes(part));
}
function withShop(payload = {}) { return { ...payload, tenantId: activeShop().id }; }
function localStamp(payload = {}) {
  const now = offlineStore.nowIso();
  return { ...payload, createdAt: payload.createdAt || now, updatedAt: now };
}

async function syncQueue() {
  if (usingDemoMode || syncRunning || navigator.onLine === false) return;
  syncRunning = true;
  try {
    const queue = await offlineStore.pendingQueue();
    for (const item of queue) {
      try {
        if (item.type === "createOrderWithId") {
          const { id, order } = item.payload;
          await setDoc(shopDocument("orders", id), withShop({ ...order, syncStatus: "synced", updatedAt: serverTimestamp() }), { merge: true });
          await offlineStore.saveOrder({ ...order, id, syncStatus: "synced" });
        }
        if (item.type === "updateOrder") {
          const { id, patch } = item.payload;
          await updateDoc(shopDocument("orders", id), withShop({ ...patch, syncStatus: "synced", updatedAt: serverTimestamp() }));
          const current = await offlineStore.getOrder(id);
          if (current) await offlineStore.saveOrder({ ...current, ...patch, syncStatus: "synced" });
        }
        if (item.type === "updateTable") {
          const { id, patch } = item.payload;
          await updateDoc(shopDocument("tables", id), withShop({ ...patch, updatedAt: serverTimestamp() }));
          const current = await offlineStore.getTable(id);
          if (current) await offlineStore.saveTable({ ...current, ...patch });
        }
        await offlineStore.markQueueDone(item.id);
      } catch (error) {
        console.error("OFFLINE_SYNC_ITEM_FAILED", item, error);
        await offlineStore.markQueueFailed(item, error);
        break;
      }
    }
  } finally {
    syncRunning = false;
  }
}

function sortMenus(menus, categoryOrder = []) {
  const rank = new Map(categoryOrder.map((name, index) => [name, index]));
  return [...menus].sort((a, b) => {
    const ca = a.category || "อื่น ๆ";
    const cb = b.category || "อื่น ๆ";
    const ra = rank.has(ca) ? rank.get(ca) : 9999;
    const rb = rank.has(cb) ? rank.get(cb) : 9999;
    if (ra !== rb) return ra - rb;
    if (ca !== cb) return ca.localeCompare(cb, "th");
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}

window.addEventListener("food-order-sync-request", syncQueue);
window.addEventListener("online", syncQueue);

dataService.syncOfflineOrders = syncQueue;

dataService.listMenus = async function listMenusOfflineFirst() {
  try {
    const menus = await onlineDataService.listMenus.call(this);
    await offlineStore.cacheMenus(menus);
    return menus;
  } catch (error) {
    if (!shouldUseOffline(error)) throw error;
    const settings = await offlineStore.getSettings() || {};
    return sortMenus(await offlineStore.listMenus(), settings.categoryOrder || []);
  }
};

dataService.listTables = async function listTablesOfflineFirst() {
  try {
    const tables = await onlineDataService.listTables.call(this);
    await offlineStore.cacheTables(tables);
    return tables;
  } catch (error) {
    if (!shouldUseOffline(error)) throw error;
    return offlineStore.listTables();
  }
};

dataService.getTable = async function getTableOfflineFirst(idOrCode) {
  try {
    const table = await onlineDataService.getTable.call(this, idOrCode);
    if (table) await offlineStore.saveTable(table);
    return table;
  } catch (error) {
    if (!shouldUseOffline(error)) throw error;
    const lookup = String(idOrCode || "").trim().toUpperCase();
    return (await offlineStore.listTables()).find(item => String(item.id || "").toUpperCase() === lookup || String(item.code || "").toUpperCase() === lookup) || null;
  }
};

dataService.getStoreSettings = async function getStoreSettingsOfflineFirst() {
  try {
    const settings = await onlineDataService.getStoreSettings.call(this);
    await offlineStore.saveSettings(settings);
    return settings;
  } catch (error) {
    if (!shouldUseOffline(error)) throw error;
    return await offlineStore.getSettings() || { shopName: activeShop().name || "Food Order QR", shopAddress: "", shopPhone: "", categoryOrder: [] };
  }
};

dataService.createOrderWithId = async function createOrderWithIdOfflineFirst(id, order) {
  if (!id) throw new Error("ORDER_ID_REQUIRED");
  try {
    const result = await onlineDataService.createOrderWithId.call(this, id, order);
    await offlineStore.saveOrder({ ...order, id, syncStatus: "synced", createdAt: offlineStore.nowIso(), updatedAt: offlineStore.nowIso() });
    return result;
  } catch (error) {
    if (!shouldUseOffline(error)) throw error;
    const offlineOrder = localStamp({ ...order, id, syncStatus: "pending" });
    await offlineStore.saveOrder(offlineOrder);
    await offlineStore.enqueue("createOrderWithId", { id, order: offlineOrder });
    return { id, offline: true };
  }
};

dataService.createOrder = async function createOrderOfflineFirst(order) {
  try {
    const result = await onlineDataService.createOrder.call(this, order);
    if (result?.id) await offlineStore.saveOrder({ ...order, id: result.id, syncStatus: "synced", createdAt: offlineStore.nowIso(), updatedAt: offlineStore.nowIso() });
    return result;
  } catch (error) {
    if (!shouldUseOffline(error)) throw error;
    return dataService.createOrderWithId(crypto.randomUUID(), order);
  }
};

dataService.createTableOrder = async function createTableOrderOfflineFirst(order) {
  try {
    return await onlineDataService.createTableOrder.call(this, order);
  } catch (error) {
    if (!shouldUseOffline(error)) throw error;
    const table = await dataService.getTable(order.tableCode);
    if (!table || table.status !== "occupied" || table.orderToken !== order.tableToken) throw new Error("INVALID_TABLE_SESSION");
    const roundNumber = Number(table.currentRound || 0) + 1;
    const id = crypto.randomUUID();
    const offlineOrder = localStamp({ ...order, id, roundNumber, syncStatus: "pending" });
    await offlineStore.saveOrder(offlineOrder);
    await offlineStore.saveTable({ ...table, currentRound: roundNumber });
    await offlineStore.enqueue("updateTable", { id: table.id, patch: { currentRound: roundNumber } });
    await offlineStore.enqueue("createOrderWithId", { id, order: offlineOrder });
    return { id, offline: true };
  }
};

dataService.updateOrder = async function updateOrderOfflineFirst(id, patch) {
  try {
    const result = await onlineDataService.updateOrder.call(this, id, patch);
    const current = await offlineStore.getOrder(id);
    if (current) await offlineStore.saveOrder({ ...current, ...patch, syncStatus: "synced", updatedAt: offlineStore.nowIso() });
    return result;
  } catch (error) {
    if (!shouldUseOffline(error)) throw error;
    const current = await offlineStore.getOrder(id);
    await offlineStore.saveOrder({ ...(current || { id }), ...patch, id, syncStatus: "pending", updatedAt: offlineStore.nowIso() });
    await offlineStore.enqueue("updateOrder", { id, patch });
    return { id, offline: true };
  }
};

dataService.updateTable = async function updateTableOfflineFirst(id, patch) {
  try {
    const result = await onlineDataService.updateTable.call(this, id, patch);
    const current = await offlineStore.getTable(id);
    if (current) await offlineStore.saveTable({ ...current, ...patch });
    return result;
  } catch (error) {
    if (!shouldUseOffline(error)) throw error;
    const current = await offlineStore.getTable(id);
    if (current) await offlineStore.saveTable({ ...current, ...patch });
    await offlineStore.enqueue("updateTable", { id, patch });
    return { id, offline: true };
  }
};

dataService.subscribeOrders = function subscribeOrdersOfflineFirst(callback) {
  if (usingDemoMode) return onlineDataService.subscribeOrders.call(this, callback);
  let disposed = false;
  let unsubscribeRemote = null;
  const emitLocal = async () => { if (!disposed) callback(await offlineStore.listOrders()); };
  const unsubscribeLocal = offlineStore.subscribe(emitLocal);
  emitLocal();
  try {
    unsubscribeRemote = onSnapshot(query(shopCollection("orders"), orderBy("createdAt", "desc")), async snapshot => {
      await offlineStore.cacheOrders(mapDocs(snapshot));
      await syncQueue();
      await emitLocal();
    }, error => {
      console.error("ORDER_SNAPSHOT_FAILED", error);
      emitLocal();
    });
  } catch (error) {
    console.error("ORDER_SUBSCRIBE_FAILED", error);
    emitLocal();
  }
  syncQueue();
  return () => {
    disposed = true;
    unsubscribeLocal();
    if (unsubscribeRemote) unsubscribeRemote();
  };
};
