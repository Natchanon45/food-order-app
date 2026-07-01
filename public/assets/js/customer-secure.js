await import("./public-tenant-resolver.js?v=20260629-025");
await import("./table-qr-resolver.js?v=20260622-5");

import { dataService, usingDemoMode } from "./data-service.js";
import { db, collection, onSnapshot, query, where } from "./firebase-config.js?v=20260630-073";
import { demoStore } from "./demo-store.js";
import { shopCollectionPath, resolveShopContext } from "./tenant-context.js";

function tableSession() {
  const params = new URLSearchParams(location.search);
  return { tableCode: params.get("table") || params.get("code") || "", tableToken: params.get("token") || "" };
}

async function activeTableForToken(token) {
  if (!token) return null;
  const tables = await dataService.listTables();
  return tables.find(table => table?.active !== false && table.status === "occupied" && table.orderToken === token) || null;
}

const baseGetTable = dataService.getTable.bind(dataService);
const baseCreateTableOrder = dataService.createTableOrder.bind(dataService);

dataService.getTable = async value => {
  const session = tableSession();
  const table = await baseGetTable(value);
  if (table?.active !== false && table?.status === "occupied" && table?.orderToken === session.tableToken) return table;
  if (String(value || "").toUpperCase() === String(session.tableCode || "").toUpperCase()) return await activeTableForToken(session.tableToken) || table;
  return table;
};

dataService.createTableOrder = async order => {
  const table = await activeTableForToken(order.tableToken);
  return baseCreateTableOrder({ ...order, tableCode: table?.code || table?.id || order.tableCode });
};

dataService.subscribeOrders = callback => {
  const session = tableSession();
  if (!session.tableCode || !session.tableToken) { callback([]); return () => {}; }

  const normalize = order => ({ ...order, tableToken: order.tableToken || session.tableToken });
  const isSameSession = order => {
    if (order?.orderType === "delivery" || order?.orderType === "takeaway") return false;
    if (order?.tableToken && order.tableToken === session.tableToken) return true;
    if (String(order?.movedFromTableCode || "").toUpperCase() === String(session.tableCode || "").toUpperCase()) return true;
    return false;
  };
  const emit = rows => callback((rows || []).filter(isSameSession).map(normalize));

  if (usingDemoMode) {
    const send = () => emit(demoStore.orders.list());
    send();
    const handler = () => send();
    window.addEventListener("storage", handler);
    window.addEventListener("demo-store-change", handler);
    const timer = setInterval(send, 1500);
    return () => { clearInterval(timer); window.removeEventListener("storage", handler); window.removeEventListener("demo-store-change", handler); };
  }

  const ordersPath = shopCollectionPath("orders", resolveShopContext());
  const ordersRef = collection(db, ...ordersPath);
  let byToken = [];
  let byMovedFrom = [];
  const flush = () => {
    const merged = new Map();
    [...byToken, ...byMovedFrom].forEach(order => merged.set(order.id, order));
    emit([...merged.values()]);
  };

  const unsubToken = onSnapshot(query(ordersRef, where("tableToken", "==", session.tableToken)), snapshot => {
    byToken = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    flush();
  });
  const unsubMoved = onSnapshot(query(ordersRef, where("movedFromTableCode", "==", session.tableCode)), snapshot => {
    byMovedFrom = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    flush();
  });

  return () => { unsubToken(); unsubMoved(); };
};

await import("./customer.js?v=20260702-001");
