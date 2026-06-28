const DB_NAME = "food_order_offline_pos";
const DB_VERSION = 1;
const STORE_NAMES = ["menus", "tables", "orders", "settings", "syncQueue"];
let dbPromise = null;
let syncTimer = null;
const listeners = new Set();

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("INDEXEDDB_NOT_SUPPORTED"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      STORE_NAMES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("INDEXEDDB_OPEN_FAILED"));
  });
  return dbPromise;
}

async function storeAction(storeName, mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("INDEXEDDB_REQUEST_FAILED"));
  });
}

function emitChange() {
  listeners.forEach(listener => {
    try { listener(); } catch (error) { console.error("OFFLINE_STORE_LISTENER_FAILED", error); }
  });
  window.dispatchEvent(new CustomEvent("food-order-offline-change"));
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeRecord(record = {}) {
  return { ...record, id: record.id || crypto.randomUUID(), updatedAt: record.updatedAt || nowIso() };
}

async function put(storeName, record) {
  const normalized = normalizeRecord(record);
  await storeAction(storeName, "readwrite", store => store.put(normalized));
  emitChange();
  return normalized;
}

async function remove(storeName, id) {
  await storeAction(storeName, "readwrite", store => store.delete(id));
  emitChange();
}

async function list(storeName) {
  try {
    return await storeAction(storeName, "readonly", store => store.getAll());
  } catch (error) {
    console.error("OFFLINE_STORE_LIST_FAILED", storeName, error);
    return [];
  }
}

async function get(storeName, id) {
  if (!id) return null;
  try {
    return await storeAction(storeName, "readonly", store => store.get(id)) || null;
  } catch (error) {
    console.error("OFFLINE_STORE_GET_FAILED", storeName, id, error);
    return null;
  }
}

async function replaceAll(storeName, records = []) {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    store.clear();
    records.forEach(record => store.put(normalizeRecord(record)));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("INDEXEDDB_REPLACE_FAILED"));
  });
  emitChange();
}

async function enqueue(type, payload = {}) {
  const item = {
    id: crypto.randomUUID(),
    type,
    payload,
    status: "pending",
    attempts: 0,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  await put("syncQueue", item);
  scheduleSync();
  return item;
}

async function markQueueDone(id) {
  await remove("syncQueue", id);
}

async function markQueueFailed(item, error) {
  await put("syncQueue", {
    ...item,
    status: "pending",
    attempts: Number(item.attempts || 0) + 1,
    lastError: String(error?.message || error || "SYNC_FAILED"),
    updatedAt: nowIso()
  });
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => window.dispatchEvent(new CustomEvent("food-order-sync-request")), 300);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export const offlineStore = {
  nowIso,
  subscribe,
  scheduleSync,
  async cacheMenus(menus) { return replaceAll("menus", menus); },
  async listMenus() { return list("menus"); },
  async cacheTables(tables) { return replaceAll("tables", tables); },
  async listTables() { return list("tables"); },
  async getTable(id) { return get("tables", id); },
  async saveTable(table) { return put("tables", table); },
  async deleteTable(id) { return remove("tables", id); },
  async cacheOrders(orders) {
    const queuedOrders = (await list("orders")).filter(order => order.syncStatus && order.syncStatus !== "synced");
    const remoteIds = new Set(orders.map(order => order.id));
    const merged = [...orders, ...queuedOrders.filter(order => !remoteIds.has(order.id))];
    return replaceAll("orders", merged);
  },
  async listOrders() {
    return (await list("orders")).sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
  },
  async getOrder(id) { return get("orders", id); },
  async saveOrder(order) { return put("orders", order); },
  async deleteOrder(id) { return remove("orders", id); },
  async saveSettings(settings) { return put("settings", { ...settings, id: "store" }); },
  async getSettings() { return get("settings", "store"); },
  enqueue,
  async pendingQueue() { return (await list("syncQueue")).filter(item => item.status === "pending").sort((a, b) => timestampValue(a.createdAt) - timestampValue(b.createdAt)); },
  markQueueDone,
  markQueueFailed
};

window.addEventListener("online", () => offlineStore.scheduleSync());
