import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { getDeliveryOpeningStatus as clientHours } from "../../react-app/src/utils/deliveryOpeningHours.js";
const require = createRequire(import.meta.url);
const { getDeliveryOpeningStatus: serverHours } = require("../../functions/delivery-opening-hours.js");
const { __test: backend } = require("../../functions/public-delivery-submit.js");

const tenantId = "ff897699-de82-4370-a360-35b22cc74c85";
const orderId = "delivery-test-uuid-0000000000000001";
function payload(method = "cod") {
  return { tenantId, order: {
    id: orderId, orderType: "delivery", status: "pending",
    paymentStatus: method === "cod" ? "unpaid" : "pending_verification",
    tableCode: "DELIVERY", recipientName: "Test", recipientPhone: "0812345678",
    deliveryAddress: "Test delivery address", deliveryProvider: "self",
    deliveryLatitude: 13.756331, deliveryLongitude: 100.501762,
    totalAmount: 135, subtotalAmount: 100, deliveryFee: 35,
    paymentMethod: method, items: [{ name: "Food", menuId: "menu-id", price: 100, qty: 1, cancelled: false }],
    ...(method === "promptpay" ? {
      paymentSlipPath: "tenants/" + tenantId + "/payment-slips/" + orderId + "/proof.jpg",
      slipCheckStatus: "matched",
    } : {}),
  } };
}
function fakeFirestore({ hours = {}, businessType = "both", tenantExists = true, storeExists = true, orderExists = false } = {}) {
  const state = { writes: [], reads: [], docs: {}, beforeCommit: null };
  const tenant = { path: "tenants/" + tenantId };
  const make = (path) => ({ path, collection(name) { return { doc(id) { return make(path + "/" + name + "/" + id); } }; } });
  const t = make(tenant.path);
  const db = {
    collection(name) { return { doc(id) { return make(name + "/" + id); } }; },
    async runTransaction(handler) {
      const tx = {
        async get(ref) {
          state.reads.push(ref.path);
          if(ref.path.endsWith("/settings/store"))return { exists: storeExists, data: () => hours };
          if(ref.path.endsWith("/orders/" + orderId))return { exists: orderExists };
          if(ref.path === tenant.path)return { exists: tenantExists, data: () => ({ businessType }) };
          throw Error("UNEXPECTED_READ " + ref.path);
        },
        create(ref, data) { state.writes.push({ ref, data }); },
      };
      return handler(tx);
    },
  };
  return { db, state };
}
function errorCode(code) {
  return error => error.code === code || String(error.message || "").includes(code);
}
test("backend schedule policy always matches browser policy, including Thai timezone and overnight hours", () => {
  const schedule = { deliveryHours: { enabled: true, days: [
    { day: 1, enabled: true, open: "20:00", close: "02:00" },
    { day: 0, enabled: false, open: "09:00", close: "20:00" },
  ] } };
  const cases = [
    ["2026-10-12T19:00:00+07:00", schedule],
    ["2026-10-12T20:00:00+07:00", schedule],
    ["2026-10-13T01:59:00+07:00", schedule],
    ["2026-10-13T02:00:00+07:00", schedule],
    ["2026-10-13T12:00:00+07:00", { ...schedule, deliveryManualStatus: { mode: "closed" } }],
    ["2026-10-13T12:00:00+07:00", { ...schedule, deliveryManualStatus: { mode: "open" } }],
    ["2026-10-13T12:00:00+07:00", {}],
  ];
  for (const [instant, settings] of cases) {
    assert.deepEqual(serverHours(settings, new Date(instant)), clientHours(settings, new Date(instant)));
  }
});
test("server refuses forged status, customer supplied metadata and malformed orders", () => {
  assert.equal(backend.validateSubmission(payload()).id, orderId);
  assert.equal(backend.validateSubmission(payload("promptpay")).id, orderId);
  assert.throws(() => backend.validateSubmission({ ...payload(), order: { ...payload().order, paidAt: "hack" } }), /DELIVERY_ORDER_INVALID_FIELDS/);
  assert.throws(() => backend.validateSubmission({ ...payload(), order: { ...payload().order, paymentMethod: "free" } }), /DELIVERY_ORDER_INVALID/);
  assert.throws(() => backend.validateSubmission({ ...payload(), order: { ...payload().order, items: [] } }), /DELIVERY_ORDER_INVALID/);
  assert.throws(() => backend.validateSubmission({ ...payload(), tenantId: "../evil" }), /DELIVERY_ORDER_INVALID/);
});
test("open store creates only server-controlled delivery metadata", async () => {
  const { db, state } = fakeFirestore();
  const submitted = payload().order;
  submitted.status = "pending";
  const result = await backend.createDeliveryOrderWithGuard(db, tenantId, orderId, submitted);
  assert.deepEqual(result, { id: orderId });
  assert.deepEqual(state.reads, [
    "tenants/" + tenantId,
    "tenants/" + tenantId + "/settings/store",
    "tenants/" + tenantId + "/orders/" + orderId,
  ]);
  assert.equal(state.writes.length, 1);
  assert.equal(state.writes[0].data.orderType, "delivery");
  assert.equal(state.writes[0].data.paymentStatus, "unpaid");
  assert.equal(state.writes[0].data.id, orderId);
  assert.equal(state.writes[0].data.tenantId, tenantId);
});
test("closed store blocks server writes and preserves existing orders", async () => {
  for (const reason of [
    { deliveryManualStatus: { mode: "closed" } },
    { deliveryHours: { enabled: true, days: [{day: 0, enabled: false}] }, deliveryManualStatus: { mode: "closed" } },
  ]) {
    const { db, state } = fakeFirestore({ hours: reason });
    await assert.rejects(backend.createDeliveryOrderWithGuard(db, tenantId, orderId, payload().order), errorCode("DELIVERY_STORE_CLOSED"));
    assert.equal(state.writes.length, 0);
  }
});
test("retail-only, missing store, missing tenant and duplicate order are refused", async () => {
  for (const [options, message] of [
    [{businessType: "retail"}, "DELIVERY_BUSINESS_DISABLED"],
    [{tenantExists: false}, "DELIVERY_STORE_STATUS_UNAVAILABLE"],
    [{storeExists: false}, "DELIVERY_STORE_STATUS_UNAVAILABLE"],
    [{orderExists: true}, "DELIVERY_ORDER_ALREADY_EXISTS"],
  ]) {
    const { db, state } = fakeFirestore(options);
    await assert.rejects(backend.createDeliveryOrderWithGuard(db, tenantId, orderId, payload().order), errorCode(message));
    assert.equal(state.writes.length, 0);
  }
});
test("Firestore rules disallow direct delivery writes for both tenant and legacy root, preserve other types", () => {
  const rules = fs.readFileSync("firestore.rules", "utf8");
  const root = rules.match(/match \/orders\/\{orderId\} \{[^\n]*/)?.[0];
  const tenant = rules.match(/match \/orders\/\{orderId\} \{[^\n]*/g)?.at(-1);
  for (const branch of [root, tenant]) {
    assert.ok(branch);
    assert.match(branch, /allow create: if [^;]*request\.resource\.data\.get\('orderType', ''\) != 'delivery'/);
  }
  assert.match(root,/validTakeawayOrder\(\)/);
  assert.match(tenant,/validPublicTenantTakeaway\(tenantId\)/);
  assert.match(tenant,/validTenantTableOrder\(tenantId\)/);
});
test("browser checkout uses protected callable; backend is exported without affecting other functions", () => {
  const frontend = fs.readFileSync("react-app/src/data/publicStorefrontData.js", "utf8");
  const fn = fs.readFileSync("functions/index.js", "utf8");
  assert.match(frontend, /httpsCallable\(functions, "submitPublicDeliveryOrder"/);
  assert.match(frontend, /await submitPublicDeliveryOrder\(\{/);
  assert.doesNotMatch(frontend.slice(frontend.indexOf("export async function createPublicDeliveryOrder"), frontend.indexOf("export async function getPublicOrder")), /transaction\.set\(tenantDocument\(tenant, "orders"/);
  assert.match(fn, /exports\.submitPublicDeliveryOrder = require\("\.\/public-delivery-submit"\)/);
});
