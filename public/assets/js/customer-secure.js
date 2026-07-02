await import("./public-tenant-resolver.js?v=20260629-025");
await import("./table-qr-resolver.js?v=20260702-002");

import { dataService, usingDemoMode } from "./data-service.js";
import { demoStore } from "./demo-store.js";

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

  let stopped = false;
  let lastSignature = "";
  const refresh = async () => {
    try {
      const table = await activeTableForToken(session.tableToken);
      const orderIds = [...new Set((table?.orderIds || []).map(String).filter(Boolean))];
      const rows = (await Promise.all(orderIds.map(id => dataService.getOrder(id)))).filter(Boolean);
      const signature = rows.map(order => `${order.id}:${order.updatedAt?.seconds || order.updatedAt || ""}`).join("|");
      if (!stopped && signature !== lastSignature) {
        lastSignature = signature;
        emit(rows);
      }
    } catch (error) {
      console.error("Unable to refresh table session orders", error);
    }
  };
  refresh();
  const timer = setInterval(refresh, 1500);
  return () => { stopped = true; clearInterval(timer); };
};

await import("./customer.js?v=20260702-004");
