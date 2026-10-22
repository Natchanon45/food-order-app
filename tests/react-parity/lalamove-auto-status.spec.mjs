import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  selectLalamoveAutoRefreshOrders,
  LALAMOVE_AUTO_POLL_MS,
  LALAMOVE_AUTO_RETRY_MS,
  LALAMOVE_AUTO_MAX_PER_TICK,
} from "../../react-app/src/utils/lalamoveAutoRefreshPolicy.js";

const now = Date.parse("2026-10-22T04:00:00Z");
const active = (id, overrides = {}) => ({
  id, orderType: "delivery", deliveryProvider: "lalamove",
  lalamoveOrderId: "ll-" + id, lalamoveOrderStatus: "PICKED_UP",
  status: "served", lalamoveDispatchPlacedAt: "2026-10-22T03:00:00Z",
  ...overrides,
});

test("Automatically refreshes only live Lalamove dispatches; never completed, canceled, POS or unrelated orders", () => {
  const rows = [
    active("one"),
    active("complete", { lalamoveOrderStatus: "COMPLETED" }),
    active("cancel", { lalamoveOrderStatus: "CANCELED" }),
    active("expired", { lalamoveOrderStatus: "EXPIRED" }),
    active("refund", { status: "cancelled" }),
    active("other", { deliveryProvider: "self" }),
    active("missing-id", { lalamoveOrderId: "" }),
    active("old", { lalamoveDispatchPlacedAt: "2026-10-19T00:00:00Z" }),
    active("retail", { orderType: "retail" }),
  ];
  assert.deepEqual(selectLalamoveAutoRefreshOrders(rows, new Map(), new Set(), now).map(x => x.id), ["one"]);
});

test("Keeps 20s polling cooldown, server fresh-data delay and per-order 60s failure backoff", () => {
  const rows = [active("one"), active("two"), active("three")];
  assert.equal(LALAMOVE_AUTO_POLL_MS, 20000);
  assert.equal(LALAMOVE_AUTO_RETRY_MS, 60000);
  assert.equal(LALAMOVE_AUTO_MAX_PER_TICK, 2);
  assert.deepEqual(selectLalamoveAutoRefreshOrders(rows, new Map(), new Set(), now).map(x => x.id), ["one", "two"]);
  assert.deepEqual(selectLalamoveAutoRefreshOrders(rows, new Map([["one", now - 5000]]), new Set(), now).map(x => x.id), ["two", "three"]);
  assert.deepEqual(selectLalamoveAutoRefreshOrders(rows, new Map(), new Set(["two"]), now).map(x => x.id), ["one", "three"]);
  assert.deepEqual(selectLalamoveAutoRefreshOrders([active("one", { lalamoveOrderLastSyncedAt: new Date(now - 1000).toISOString() })], new Map(), new Set(), now), []);
  const deferred = new Map([["one", now + LALAMOVE_AUTO_RETRY_MS - LALAMOVE_AUTO_POLL_MS]]);
  assert.equal(selectLalamoveAutoRefreshOrders([active("one")], deferred, new Set(), now + 30000).length, 0);
  assert.equal(selectLalamoveAutoRefreshOrders([active("one")], deferred, new Set(), now + 60000).length, 1);
});

test("Kitchen and Cashier both watch active dispatch status, while customer gets Firestore realtime changes", () => {
  const cashier = readFileSync("react-app/src/pages/CashierPage.jsx", "utf8");
  const kitchen = readFileSync("react-app/src/pages/KitchenPage.jsx", "utf8");
  const hook = readFileSync("react-app/src/hooks/useLalamoveAutoRefresh.js", "utf8");
  const customer = readFileSync("react-app/src/pages/DeliverySuccessPage.jsx", "utf8");
  for (const screen of [cashier,kitchen]) assert.match(screen,/useLalamoveAutoRefresh\(tenant\?\.id, orders, /);
  assert.match(hook,/document\.visibilityState === "hidden"/);
  assert.match(hook,/navigator\.onLine === false/);
  assert.match(hook,/window\.setInterval\(tick, LALAMOVE_AUTO_POLL_MS\)/);
  assert.match(hook,/refreshLalamoveDispatch\(tenantId, id\)/);
  assert.match(customer,/watchPublicOrder\(nextTenant, orderId/);
});

test("Webhook order lookup has a collection-group index for the Lalamove order ID", () => {
  const manifest = JSON.parse(readFileSync("firestore.indexes.json", "utf8"));
  const index = manifest.fieldOverrides.find(item =>
    item.collectionGroup === "orders" && item.fieldPath === "lalamoveOrderId",
  );
  assert.ok(index, "Webhook must be able to query orders across Tenant subcollections");
  assert.ok(index.indexes.some(item =>
    item.queryScope === "COLLECTION_GROUP" && item.order === "ASCENDING",
  ));
  assert.ok(index.indexes.some(item =>
    item.queryScope === "COLLECTION" && item.order === "ASCENDING",
  ), "Do not disable default collection-scope access");
  assert.ok(index.indexes.some(item =>
    item.queryScope === "COLLECTION" && item.order === "DESCENDING",
  ));
});

test("The status-only callable permits kitchen and manager but other privileged dispatch calls stay restricted", () => {
  const source = readFileSync("functions/lalamove-dispatch.js", "utf8");
  assert.match(source,/allowStatusReaders \? \["owner", "admin", "cashier", "manager", "kitchen"\]/);
  assert.match(source,/loadContext\(request, \{ requireReady: false, allowStatusReaders: true \}\)/);
  assert.match(source,/async function loadContext\(request, \{ requireReady = true, allowStatusReaders = false \} = \{\}\)/);
  assert.match(source,/getFirestore\(\)\.runTransaction\(async tx =>/);
  assert.match(source,/if \(storedTerminal && !lalamoveCompletionNeedsRepair\(stored\)\) return stored/);
  assert.match(source,/if \(webhookUpdatedAfterStart && !incomingTerminal\) return stored/);
});
