import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const data = fs.readFileSync("react-app/src/data/operationalData.js", "utf8");
const quick = fs.readFileSync("react-app/src/pages/QuickOrderPage.jsx", "utf8");
const qr = fs.readFileSync("react-app/src/pages/CashierTableQrPage.jsx", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");

test("restaurant-only access permits menus/tables/orders but rejects Retail POS heldBills", () => {
  assert.ok(rules.includes("business == 'order_delivery' && tenant.get('businessType', 'both') == 'restaurant_cafe'"));
  assert.ok(rules.includes("match /heldBills/{heldBillId} { allow read: if tenantBusinessEnabled(tenantId, 'retail_pos')"));
  assert.ok(rules.includes("match /menus/{menuId} { allow read: if tenantBusinessEnabled(tenantId, 'order_delivery')"));
  assert.ok(rules.includes("match /tables/{tableId} { allow read: if tenantBusinessEnabled(tenantId, 'order_delivery')"));
  assert.ok(rules.includes("match /orders/{orderId} { allow get: if tenantBusinessEnabled(tenantId, 'order_delivery')"));
});

test("core snapshot resolves restaurant menu/table/order data without reading heldBills", async () => {
  const start = "export async function loadOperationalSnapshot(tenantId) {";
  const end = "\n}\n\n// Kitchen";
  const from = data.indexOf(start);
  assert.ok(from >= 0);
  const until = data.indexOf(end, from + start.length);
  assert.ok(until > from);
  const body = data.slice(from + start.length, until);
  const reads = [];
  const tenantId = "restaurant-only";
  const rows = {
    menus: [{ id: "m1", data: () => ({ name: "ลูกชิ้นทอด", price: 30 }) }],
    tables: [{ id: "t1", data: () => ({ code: "T1" }) }],
    orders: [{ id: "o1", data: () => ({ status: "paid" }) }],
  };
  const tenantCollection = (id, name) => { assert.equal(id, tenantId); return { name }; };
  const tenantDoc = (id, coll, name) => { assert.equal(id, tenantId); return { name: coll + "/" + name }; };
  const getDoc = async target => {
    reads.push(target.name);
    return { id: "store", exists: () => true, data: () => ({ shopName: "ร้านอาหาร", categoryOrder: [] }) };
  };
  const getDocs = async target => {
    reads.push(target.name);
    if (target.name === "heldBills") throw new Error("permission-denied");
    return { docs: rows[target.name] || [] };
  };
  const make = new Function("requireTenantId", "getDoc", "getDocs", "tenantDoc", "tenantCollection", "query", "orderBy", "docs", "menuSort",
    "return async function loadOperationalSnapshot(tenantId) {" + body + "\n};");
  const loadSnapshot = make(
    id => id, getDoc, getDocs, tenantDoc, tenantCollection,
    target => target, () => ({ field: "createdAt" }),
    snap => snap.docs.map(row => ({ id: row.id, ...row.data() })),
    records => records
  );
  const result = await loadSnapshot(tenantId);
  assert.deepEqual(reads, ["settings/store", "menus", "tables", "orders"]);
  assert.equal(result.menus[0].name, "ลูกชิ้นทอด");
  assert.equal(result.tables[0].code, "T1");
  assert.equal(result.orders[0].id, "o1");
  assert.equal(result.settings.shopName, "ร้านอาหาร");
  assert.deepEqual(result.heldBills, []);
});

test("Quick Order gates retail held bill listeners and buttons for restaurant-only tenants", () => {
  assert.ok(quick.includes('retailHeldEnabled = tenant?.businessType !== "restaurant_cafe"'));
  assert.ok(quick.includes("const stopHeld = retailHeldEnabled"));
  assert.ok(quick.includes("? watchQuickOrderHeldBills("));
  assert.ok(quick.includes("[tenant?.id, retailHeldEnabled, allowedRole, t]"));
  assert.ok(quick.includes('retailHeldEnabled ? <div className="quick-held-actions">'));
  assert.ok(quick.includes("setHeldBills([])"));
  assert.ok(quick.includes("loadOperationalSnapshot(tenant.id)"));
  assert.ok(quick.includes("setMenus(snapshot.menus || [])"));
  assert.ok(quick.includes("setTables(snapshot.tables || [])"));
  assert.ok(quick.includes("setOrders(snapshot.orders || [])"));
  assert.ok(quick.includes("setStoreSettings(settings)"));
});

test("QR table page also uses restaurant-safe snapshot; retail subscription remains supported", () => {
  assert.ok(qr.includes("loadOperationalSnapshot(tenant.id)"));
  assert.ok(qr.includes("watchOperationalTables("));
  assert.ok(data.includes("export function watchQuickOrderHeldBills"));
  assert.ok(data.includes('tenantCollection(tenantId, "heldBills")'));
});
