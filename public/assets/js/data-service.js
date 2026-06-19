import { db, isFirebaseConfigured, collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, runTransaction } from "./firebase-config.js";
import { demoStore } from "./demo-store.js";

export const usingDemoMode = !isFirebaseConfigured;
const DEFAULT_FOOD_IMAGE = "/assets/images/default-food.svg";

function mapDocs(snapshot) {
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

function normalizeMenu(menu) {
  return {
    ...menu,
    image: menu.image || DEFAULT_FOOD_IMAGE
  };
}

export const dataService = {
  async listMenus() {
    if (usingDemoMode) return demoStore.menus.list().map(normalizeMenu);
    return mapDocs(await getDocs(collection(db, "menus"))).map(normalizeMenu);
  },
  async saveMenu(menu) {
    if (usingDemoMode) return demoStore.menus.save(menu);
    const id = menu.id || crypto.randomUUID();
    const payload = { ...menu };
    delete payload.id;
    return setDoc(doc(db, "menus", id), payload, { merge: true });
  },
  async deleteMenu(id) {
    if (usingDemoMode) return demoStore.menus.remove(id);
    return deleteDoc(doc(db, "menus", id));
  },
  async listTables() {
    if (usingDemoMode) return demoStore.tables.list();
    return mapDocs(await getDocs(collection(db, "tables")));
  },
  async getTable(id) {
    if (usingDemoMode) {
      return demoStore.tables.list().find(item => item.id === id || item.code === id) || null;
    }
    const snapshot = await getDoc(doc(db, "tables", id));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  },
  async saveTable(table) {
    if (usingDemoMode) return demoStore.tables.save(table);
    const id = table.id || table.code;
    const payload = { status: "available", orderToken: "", currentRound: 0, ...table };
    delete payload.id;
    return setDoc(doc(db, "tables", id), payload, { merge: true });
  },
  async updateTable(id, patch) {
    if (usingDemoMode) {
      const table = await this.getTable(id);
      if (!table) return;
      return demoStore.tables.save({ ...table, ...patch, id: table.id });
    }
    return updateDoc(doc(db, "tables", id), { ...patch, updatedAt: serverTimestamp() });
  },
  async deleteTable(id) {
    if (usingDemoMode) return demoStore.tables.remove(id);
    return deleteDoc(doc(db, "tables", id));
  },
  async createOrder(order) {
    if (usingDemoMode) return demoStore.orders.add(order);
    return addDoc(collection(db, "orders"), { ...order, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  },
  async createTableOrder(order) {
    if (usingDemoMode) {
      const table = await this.getTable(order.tableCode);
      if (!table || table.status !== "occupied" || table.orderToken !== order.tableToken) throw new Error("INVALID_TABLE_SESSION");
      const roundNumber = Number(table.currentRound || 0) + 1;
      await this.updateTable(table.id, { currentRound: roundNumber });
      return demoStore.orders.add({ ...order, roundNumber });
    }

    const tableRef = doc(db, "tables", order.tableCode);
    const orderRef = doc(collection(db, "orders"));

    await runTransaction(db, async transaction => {
      const tableSnapshot = await transaction.get(tableRef);
      if (!tableSnapshot.exists()) throw new Error("INVALID_TABLE_SESSION");
      const table = tableSnapshot.data();
      if (table.status !== "occupied" || table.orderToken !== order.tableToken) throw new Error("INVALID_TABLE_SESSION");

      const roundNumber = Number(table.currentRound || 0) + 1;
      transaction.update(tableRef, { currentRound: roundNumber, updatedAt: serverTimestamp() });
      transaction.set(orderRef, {
        ...order,
        roundNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    return { id: orderRef.id };
  },
  async getOrder(id) {
    if (usingDemoMode) return demoStore.orders.list().find(item => item.id === id) || null;
    const snapshot = await getDoc(doc(db, "orders", id));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  },
  async updateOrder(id, patch) {
    if (usingDemoMode) return demoStore.orders.update(id, patch);
    return updateDoc(doc(db, "orders", id), { ...patch, updatedAt: serverTimestamp() });
  },
  async getStoreSettings() {
    const fallback = { shopName: "Food Order QR", shopAddress: "", shopPhone: "" };
    if (usingDemoMode) {
      const saved = localStorage.getItem("food_order_store_settings");
      return saved ? { ...fallback, ...JSON.parse(saved) } : fallback;
    }
    const snapshot = await getDoc(doc(db, "settings", "store"));
    return snapshot.exists() ? { ...fallback, ...snapshot.data() } : fallback;
  },
  async saveStoreSettings(settings) {
    if (usingDemoMode) {
      localStorage.setItem("food_order_store_settings", JSON.stringify(settings));
      return settings;
    }
    return setDoc(doc(db, "settings", "store"), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
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
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => callback(mapDocs(snap)));
  }
};
