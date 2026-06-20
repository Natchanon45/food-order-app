import { dataService, usingDemoMode } from "./data-service.js";
import { db, collection, onSnapshot, query, where, orderBy } from "./firebase-config.js";
import { demoStore } from "./demo-store.js";

function currentTableSession() {
  const params = new URLSearchParams(location.search);
  return {
    tableCode: params.get("table") || params.get("code") || "",
    tableToken: params.get("token") || ""
  };
}

// หน้าโต๊ะต้องอ่านเฉพาะออเดอร์ของโต๊ะและรอบเดียวกันเท่านั้น
// เพื่อให้หลายเครื่องเห็นรายการที่สั่งแบบ Real-time โดยไม่ดึงออเดอร์ Delivery
// หรือออเดอร์ของโต๊ะอื่นทั้งระบบลงมาที่ Browser
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

  const tableOrdersQuery = query(
    collection(db, "orders"),
    where("tableCode", "==", tableCode),
    where("tableToken", "==", tableToken),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(tableOrdersQuery, snapshot => {
    callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
  });
};

await import("./customer.js");
