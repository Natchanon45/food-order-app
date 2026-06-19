import { db, isFirebaseConfigured, collection, addDoc, doc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from "./firebase-config.js";
import { demoStore } from "./demo-store.js";
export const usingDemoMode = !isFirebaseConfigured;
function mapDocs(snapshot) { return snapshot.docs.map(item => ({ id: item.id, ...item.data() })); }
export const dataService = {
  async listMenus() { if (usingDemoMode) return demoStore.menus.list(); return mapDocs(await getDocs(collection(db, "menus"))); },
  async saveMenu(menu) { if (usingDemoMode) return demoStore.menus.save(menu); const id = menu.id || crypto.randomUUID(); const payload = { ...menu }; delete payload.id; return setDoc(doc(db, "menus", id), payload, { merge: true }); },
  async deleteMenu(id) { if (usingDemoMode) return demoStore.menus.remove(id); return deleteDoc(doc(db, "menus", id)); },
  async listTables() { if (usingDemoMode) return demoStore.tables.list(); return mapDocs(await getDocs(collection(db, "tables"))); },
  async saveTable(table) { if (usingDemoMode) return demoStore.tables.save(table); const id = table.id || table.code; const payload = { ...table }; delete payload.id; return setDoc(doc(db, "tables", id), payload, { merge: true }); },
  async deleteTable(id) { if (usingDemoMode) return demoStore.tables.remove(id); return deleteDoc(doc(db, "tables", id)); },
  async createOrder(order) { if (usingDemoMode) return demoStore.orders.add(order); return addDoc(collection(db, "orders"), { ...order, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); },
  async updateOrder(id, patch) { if (usingDemoMode) return demoStore.orders.update(id, patch); return updateDoc(doc(db, "orders", id), { ...patch, updatedAt: serverTimestamp() }); },
  subscribeOrders(callback) { if (usingDemoMode) { const emit = () => callback(demoStore.orders.list()); emit(); const handler = () => emit(); window.addEventListener("storage", handler); window.addEventListener("demo-store-change", handler); const timer = setInterval(emit, 1500); return () => { clearInterval(timer); window.removeEventListener("storage", handler); window.removeEventListener("demo-store-change", handler); }; } const q = query(collection(db, "orders"), orderBy("createdAt", "desc")); return onSnapshot(q, snap => callback(mapDocs(snap))); }
};
