import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function harness(initial, onGet) {
  const docs = new Map(Object.entries({
    "users/chef": { role: "kitchen", tenantId: "tenant-one", active: true },
    "users/manager": { role: "manager", tenantId: "tenant-one", active: true },
    "users/cashier": { role: "cashier", tenantId: "tenant-one", active: true },
    "tenants/tenant-one/settings/store": {},
    "tenants/tenant-one/settings/lalamove": { accountMode: "partner" },
    "tenants/tenant-one/privateSettings/lalamove": {
      environment: "sandbox", apiKey: "pk_test_unit", apiSecret: "sk_test_unit", connectionVerifiedAt: "ok",
    },
    "platformPrivateSettings/lalamove": {},
    "tenants/tenant-one/orders/order-one": initial,
  }));
  const orderPath = "tenants/tenant-one/orders/order-one";
  const ref = key => ({
    id: key.split("/").at(-1),
    key,
    collection: name => ({ doc: id => ref(key + "/" + name + "/" + id) }),
    get: async () => ({
      id: key.split("/").at(-1),
      exists: docs.has(key),
      data: () => docs.get(key),
      ref: ref(key),
    }),
    set: async (update, options) => {
      docs.set(key, options?.merge ? { ...docs.get(key), ...update } : update);
    },
  });
  const db = {
    collection: name => ({ doc: id => ref(name + "/" + id) }),
    runTransaction: async fn => {
      const pending = [];
      const tx = {
        get: obj => obj.get(),
        set: (obj, data, opts) => pending.push({ obj, data, opts }),
      };
      const result = await fn(tx);
      for (const item of pending) await item.obj.set(item.data, item.opts);
      return result;
    },
  };
  const captures = [];
  let status = "COMPLETED";
  const mocks = {
    "firebase-functions/v2/https": {
      HttpsError: class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } },
      onCall: (_opts, fn) => fn,
    },
    "firebase-admin/firestore": {
      getFirestore: () => db,
      FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
    },
  };
  const fakeFetch = async (_url, init) => {
    captures.push({ method: init.method, url: _url });
    if (onGet) onGet(docs, orderPath);
    return { ok: true, status: 200, json: async () => ({
      data: { orderId: "ll-111", status, driverId: "driver-test", shareLink: "https://share.sandbox.lalamove.com/example" },
    }) };
  };
  const source = fs.readFileSync("functions/lalamove-dispatch.js", "utf8");
  const module = { exports: {} };
  const execute = new Function("require", "fetch", "module", "exports", source);
  execute(name => {
    if (name in mocks) return mocks[name];
    if (name === "./lalamove-order-lifecycle") return requireLifecycle;
    return requireNode(name);
  }, fakeFetch, module, module.exports);
  return {
    api: module.exports,
    docs, orderPath, captures,
    setResponse: next => { status = next; },
  };
}
import { createRequire } from "node:module";
const requireNode = createRequire(import.meta.url);
const requireLifecycle = requireNode("../../functions/lalamove-order-lifecycle.js");
const base = {
  id: "order-one", orderType: "delivery", deliveryProvider: "lalamove",
  lalamoveOrderId: "ll-111", lalamoveOrderStatus: "PICKED_UP",
  lalamoveOrderLastSyncedAt: "2026-10-21T00:00:00Z",
  status: "served", paymentMethod: "cod", lalamoveCodEnabled: true, paymentStatus: "unpaid",
};

test("Kitchen status-only refresh syncs completed COD order without marking money collected", async () => {
  const h = harness({ ...base });
  await h.api.refreshTenantLalamoveDispatch({ auth: { uid: "chef" }, data: { orderId: "order-one" } });
  const order = h.docs.get(h.orderPath);
  assert.equal(order.lalamoveOrderStatus, "COMPLETED");
  assert.equal(order.status, "completed");
  assert.equal(order.paymentStatus, "unpaid");
  assert.equal(order.lalamoveCodSettlementStatus, "pending");
  assert.equal(h.captures.length, 1);
});

test("Manager may sync delivery but cannot call privileged cancellation", async () => {
  const h = harness({ ...base });
  await h.api.refreshTenantLalamoveDispatch({ auth: { uid: "manager" }, data: { orderId: "order-one" } });
  await assert.rejects(
    h.api.cancelTenantLalamoveDispatch({ auth: { uid: "manager" }, data: { orderId: "order-one" } }),
    error => error?.code === "permission-denied",
  );
});

test("A newer completed webhook must never be overwritten by an in-flight stale API reply", async () => {
  const h = harness({ ...base, paymentMethod: "promptpay", paymentStatus: "paid" }, (docs, orderPath) => {
    docs.set(orderPath, {
      ...docs.get(orderPath),
      lalamoveOrderStatus: "COMPLETED", status: "paid",
      lalamoveCompletedAt: "2026-10-22T03:54:06Z", completedAt: "2026-10-22T03:54:06Z",
      lalamoveWebhookLastTimestamp: 1792641246,
      lalamoveOrderLastSyncedAt: new Date(Date.now() + 1000).toISOString(),
    });
  });
  h.setResponse("ON_GOING");
  await h.api.refreshTenantLalamoveDispatch({ auth: { uid: "cashier" }, data: { orderId: "order-one" } });
  const order = h.docs.get(h.orderPath);
  assert.equal(order.lalamoveOrderStatus, "COMPLETED");
  assert.equal(order.status, "paid");
  assert.equal(order.lalamoveCompletedAt, "2026-10-22T03:54:06Z");
});
