import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = path => fs.readFileSync(path, "utf8");
test("tenant Master controls dashboards and direct route navigation", () => {
  const home = read("react-app/src/pages/HomePage.jsx");
  const app = read("react-app/src/app/App.jsx");
  assert.match(home, /masterRestaurantEnabled = tenant\?\.businessType !== "retail"/);
  assert.match(home, /masterRetailEnabled = tenant\?\.businessType !== "restaurant_cafe"/);
  assert.match(app, /function MasterBusinessGuard/);
  assert.match(app, /const master = tenantState\.tenant\?\.businessType/);
  assert.match(app, /posPath && !allowsPos/);
  assert.match(app, /restaurantPath && !allowsRestaurant/);
});
test("Firestore collection access requires matching business Master", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /function tenantBusinessEnabled\(tenantId, business\)/);
  for (const collection of ["products", "sales", "stockMovements", "customers", "taxInvoices", "purchases"]) {
    const line = rules.split("\n").find(line => line.includes("match /" + collection + "/{"));
    assert.ok(line?.includes("tenantBusinessEnabled(tenantId, 'retail_pos')"), collection);
  }
  const scoped = rules.slice(rules.indexOf("match /tenants/{tenantId} {"));
  for (const collection of ["menus", "orders", "tables", "waitingQueues"]) {
    const line = scoped.split("\n").find(line => line.includes("match /" + collection + "/{"));
    assert.ok(line?.includes("tenantBusinessEnabled(tenantId, 'order_delivery')"), collection);
  }
});
