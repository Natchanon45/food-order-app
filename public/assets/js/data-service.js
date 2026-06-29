import {
  db, isFirebaseConfigured, collection, addDoc, doc, getDoc, getDocs, setDoc,
  updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, runTransaction
} from "./firebase-config.js";
import { demoStore } from "./demo-store.js";
import { resolveShopContext, shopCollectionPath, shopDocumentPath } from "./tenant-context.js";

export const usingDemoMode = !isFirebaseConfigured;
const DEFAULT_FOOD_IMAGE = "/assets/images/default-food.svg";

function activeShop() {
  return resolveShopContext();
}

function shopCollection(name) {
  return collection(db, ...shopCollectionPath(name, activeShop()));
}

function shopDocument(name, id) {
  return doc(db, ...shopDocumentPath(name, id, activeShop()));
}

function mapDocs(snapshot) {
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

function normalizeMenu(menu) {
  return {
    ...menu,
    image: menu.image || DEFAULT_FOOD_IMAGE,
    sortOrder: Number(menu.sortOrder || 9999)
  };
}

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

async function phoneKey(phone) {
  const normalized = String(phone || "").replace(/\D/g, "");
  if (!normalized) throw new Error("INVALID_PHONE");
  const bytes = new TextEncoder().encode(normalized);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function withShop(payload = {}) {
  const tenantId = activeShop().id;
  return { ...payload, tenantId };
}

function isUnpaidTableOrder(order) {
  return order?.orderType !== "delivery" && !["paid", "cancelled"].includes(order?.status) && order?.paymentStatus !== "paid";
}

export const dataService = {
  getActiveShop() {
    return activeShop();
  },

  async listMenus() {
    if (usingDemoMode) {
      const saved = localStorage.getItem("food_order_store_settings");
      const settings = saved ? JSON.parse(saved) : {};
      return sortMenus(demoStore.menus.list().map(normalizeMenu), settings.categoryOrder || []);
    }

    const [menuSnapshot, settingsSnapshot] = await Promise.all([
      getDocs(shopCollection("menus")),
      getDoc(shopDocument("settings", "store"))
    ]);
    const settings = settingsSnapshot.exists() ? settingsSnapshot.data() : {};
    return sortMenus(mapDocs(menuSnapshot).map(normalizeMenu), settings.categoryOrder || []);
  },

  async saveMenu(menu) {
    if (usingDemoMode) return demoStore.menus.save(menu);
    const id = menu.id || crypto.randomUUID();
    const payload = withShop({ ...menu });
    delete payload.id;
    return setDoc(shopDocument("menus", id), payload, { merge: true });
  },

  async deleteMenu(id) {
    if (usingDemoMode) return demoStore.menus.remove(id);
    return deleteDoc(shopDocument("menus", id));
  },

  async listTables() {
    if (usingDemoMode) return demoStore.tables.list();
    return mapDocs(await getDocs(shopCollection("tables")));
  },

  async getTable(idOrCode) {
    const lookup = String(idOrCode || "").trim().toUpperCase();
    if (!lookup) return null;

    if (usingDemoMode) {
      return demoStore.tables.list().find(item =>
        String(item.id || "").toUpperCase() === lookup ||
        String(item.code || "").toUpperCase() === lookup
      ) || null;
    }

    const direct = await getDoc(shopDocument("tables", idOrCode));
    if (direct.exists()) return { id: direct.id, ...direct.data() };

    const tables = mapDocs(await getDocs(shopCollection("tables")));
    return tables.find(item =>
      String(item.id || "").toUpperCase() === lookup ||
      String(item.code || "").toUpperCase() === lookup
    ) || null;
  },

  async saveTable(table) {
    if (usingDemoMode) return demoStore.tables.save(table);
    const id = table.id || table.code;
    const payload = withShop({ status: "available", orderToken: "", currentRound: 0, ...table });
    delete payload.id;
    return setDoc(shopDocument("tables", id), payload, { merge: true });
  },

  async updateTable(id, patch) {
    if (usingDemoMode) {
      const table = await this.getTable(id);
      if (!table) return;
      return demoStore.tables.save({ ...table, ...patch, id: table.id });
    }
    return updateDoc(shopDocument("tables", id), withShop({ ...patch, updatedAt: serverTimestamp() }));
  },

  async deleteTable(id) {
    if (usingDemoMode) return demoStore.tables.remove(id);
    return deleteDoc(shopDocument("tables", id));
  },

  async createOrder(order) {
    if (usingDemoMode) return demoStore.orders.add(order);
    return addDoc(shopCollection("orders"), withShop({
      ...order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  },

  async createOrderWithId(id, order) {
    if (!id) throw new Error("ORDER_ID_REQUIRED");
    if (usingDemoMode) return demoStore.orders.add({ ...order, id });
    await setDoc(shopDocument("orders", id), withShop({
      ...order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
    return { id };
  },

  async createTableOrder(order) {
    if (usingDemoMode) {
      const table = await this.getTable(order.tableCode);
      if (!table || table.status !== "occupied" || table.orderToken !== order.tableToken) {
        throw new Error("INVALID_TABLE_SESSION");
      }
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
      if (tableData.status !== "occupied" || tableData.orderToken !== order.tableToken) {
        throw new Error("INVALID_TABLE_SESSION");
      }
      const roundNumber = Number(tableData.currentRound || 0) + 1;
      transaction.update(tableRef, withShop({ currentRound: roundNumber, updatedAt: serverTimestamp() }));
      transaction.set(orderRef, withShop({
        ...order,
        roundNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
    });
    return { id: orderRef.id };
  },

  async getOrder(id) {
    if (usingDemoMode) return demoStore.orders.list().find(item => item.id === id) || null;
    const snapshot = await getDoc(shopDocument("orders", id));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  },

  async updateOrder(id, patch) {
    if (usingDemoMode) return demoStore.orders.update(id, patch);
    return updateDoc(shopDocument("orders", id), withShop({ ...patch, updatedAt: serverTimestamp() }));
  },

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
      latestOrders.forEach(order => {
        if (!isUnpaidTableOrder(order) || order.tableToken !== fromTableToken || String(order.tableCode) !== String(fromTable.code || fromTable.id)) {
          throw new Error("MOVE_ORDER_NOT_UNPAID");
        }
      });
      await this.updateTable(fromTable.id, { status: "available", orderToken: "", sessionStartedAt: null, currentRound: 0 });
      await this.updateTable(toTable.id, {
        status: "occupied",
        orderToken: fromTableToken,
        sessionStartedAt: fromTable.sessionStartedAt || movedAt,
        currentRound: maxRound,
        movedFromTableCode: fromTable.code || fromTable.id,
        movedAt
      });
      latestOrders.forEach(order => demoStore.orders.update(order.id, {
        tableCode: targetCode,
        tableName: targetName,
        movedFromTableCode: fromTable.code || fromTable.id,
        tableMovedAt: movedAt
      }));
      return { fromTable, toTable: { ...toTable, code: targetCode, name: targetName }, movedOrders: latestOrders.length };
    }

    const fromTableRef = shopDocument("tables", fromTable.id);
    const toTableRef = shopDocument("tables", toTable.id);
    const orderRefs = orderIds.map(id => shopDocument("orders", id));

    await runTransaction(db, async transaction => {
      const fromSnapshot = await transaction.get(fromTableRef);
      const toSnapshot = await transaction.get(toTableRef);
      const orderSnapshots = [];
      for (const orderRef of orderRefs) orderSnapshots.push(await transaction.get(orderRef));

      if (!fromSnapshot.exists()) throw new Error("SOURCE_TABLE_NOT_ACTIVE");
      if (!toSnapshot.exists()) throw new Error("TARGET_TABLE_NOT_AVAILABLE");

      const latestFromTable = { id: fromSnapshot.id, ...fromSnapshot.data() };
      const latestToTable = { id: toSnapshot.id, ...toSnapshot.data() };
      if (latestFromTable.status !== "occupied" || latestFromTable.orderToken !== fromTableToken) throw new Error("SOURCE_TABLE_NOT_ACTIVE");
      if (latestToTable.active === false || (latestToTable.status && latestToTable.status !== "available")) throw new Error("TARGET_TABLE_NOT_AVAILABLE");

      orderSnapshots.forEach(snapshot => {
        if (!snapshot.exists()) throw new Error("MOVE_ORDER_NOT_FOUND");
        const order = { id: snapshot.id, ...snapshot.data() };
        if (!isUnpaidTableOrder(order) || order.tableToken !== fromTableToken || String(order.tableCode) !== String(latestFromTable.code || latestFromTable.id)) {
          throw new Error("MOVE_ORDER_NOT_UNPAID");
        }
      });

      transaction.update(fromTableRef, withShop({
        status: "available",
        orderToken: "",
        sessionStartedAt: null,
        currentRound: 0,
        updatedAt: serverTimestamp()
      }));
      transaction.update(toTableRef, withShop({
        status: "occupied",
        orderToken: fromTableToken,
        sessionStartedAt: latestFromTable.sessionStartedAt || movedAt,
        currentRound: maxRound,
        movedFromTableCode: latestFromTable.code || latestFromTable.id,
        movedAt,
        updatedAt: serverTimestamp()
      }));
      orderRefs.forEach(orderRef => transaction.update(orderRef, withShop({
        tableCode: targetCode,
        tableName: targetName,
        movedFromTableCode: latestFromTable.code || latestFromTable.id,
        tableMovedAt: movedAt,
        updatedAt: serverTimestamp()
      })));
    });

    return { fromTable, toTable: { ...toTable, code: targetCode, name: targetName }, movedOrders: orderIds.length };
  },

  async getStoreSettings() {
    const fallback = {
      shopName: activeShop().name || "Food Order QR",
      shopAddress: "",
      shopPhone: "",
      categoryOrder: []
    };
    if (usingDemoMode) {
      const saved = localStorage.getItem("food_order_store_settings");
      return saved ? { ...fallback, ...JSON.parse(saved) } : fallback;
    }
    const snapshot = await getDoc(shopDocument("settings", "store"));
    return snapshot.exists() ? { ...fallback, ...snapshot.data() } : fallback;
  },

  async saveStoreSettings(settings) {
    if (usingDemoMode) {
      const current = JSON.parse(localStorage.getItem("food_order_store_settings") || "{}");
      const merged = { ...current, ...settings };
      localStorage.setItem("food_order_store_settings", JSON.stringify(merged));
      return merged;
    }
    return setDoc(shopDocument("settings", "store"), withShop({
      ...settings,
      updatedAt: serverTimestamp()
    }), { merge: true });
  },

  async getDeliveryCustomer(phone) {
    const normalizedPhone = String(phone || "").replace(/\D/g, "");
    if (!normalizedPhone) return null;
    const key = await phoneKey(normalizedPhone);
    if (usingDemoMode) {
      const saved = localStorage.getItem(`delivery_customer_${activeShop().id}_${key}`);
      return saved ? JSON.parse(saved) : null;
    }
    const snapshot = await getDoc(shopDocument("deliveryCustomers", key));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  },

  async saveDeliveryCustomer(phone, profile) {
    const normalizedPhone = String(phone || "").replace(/\D/g, "");
    const key = await phoneKey(normalizedPhone);
    const payload = withShop({
      ...profile,
      phone: normalizedPhone,
      addresses: (profile.addresses || []).slice(0, 5)
    });
    if (usingDemoMode) {
      localStorage.setItem(`delivery_customer_${activeShop().id}_${key}`, JSON.stringify(payload));
      return payload;
    }
    return setDoc(shopDocument("deliveryCustomers", key), {
      ...payload,
      updatedAt: serverTimestamp()
    }, { merge: true });
  },

  subscribeOrders(callback) {
    if (usingDemoMode) {
      const emit = () => callback(demoStore.orders.list());
      emit();
      const handler = () => emit();
      window.addEventListener("storage", handler);
      window.addEventListener("demo-store-change", handler);
      const timer = setInterval(emit, 1500);
      return () => {
        clearInterval(timer);
        window.removeEventListener("storage", handler);
        window.removeEventListener("demo-store-change", handler);
      };
    }
    const ordersQuery = query(shopCollection("orders"), orderBy("createdAt", "desc"));
    return onSnapshot(ordersQuery, snapshot => callback(mapDocs(snapshot)));
  }
};
