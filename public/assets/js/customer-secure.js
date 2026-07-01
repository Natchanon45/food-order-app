await import("./public-tenant-resolver.js?v=20260629-025");
await import("./table-qr-resolver.js?v=20260622-5");

import { dataService, usingDemoMode } from "./data-service.js?v=20260701-008";
import { db, collection, onSnapshot, query, where } from "./firebase-config.js?v=20260630-073";
import { demoStore } from "./demo-store.js";
import { shopCollectionPath, resolveShopContext } from "./tenant-context.js";

function currentTableSession() {
  const params = new URLSearchParams(location.search);
  return {
    tableCode: params.get("table") || params.get("code") || "",
    tableToken: params.get("token") || ""
  };
}

dataService.subscribeOrders = callback => {
  const { tableCode, tableToken } = currentTableSession();

  if (!tableCode || !tableToken) {
    callback([]);
    return () => {};
  }

  if (usingDemoMode) {
    const emit = () => callback(
      demoStore.orders.list().filter(order =>
        order.tableCode === tableCode && order.tableToken === tableToken
      )
    );
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

  const ordersPath = shopCollectionPath("orders", resolveShopContext());
  const tableOrdersQuery = query(
    collection(db, ...ordersPath),
    where("tableCode", "==", tableCode),
    where("tableToken", "==", tableToken)
  );

  return onSnapshot(tableOrdersQuery, snapshot => {
    callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
  });
};

await import("./customer-smooth.js?v=20260701-009");
