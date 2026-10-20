import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { reserveHybridSlipVerification } =
  require("../../functions/hybrid-billing-slip-quota.js");

const tenantId = "tenant-test-123";
const base = "tenants/" + tenantId;
const settings = { monthlyFee: 590, deliveryThreshold: 10000,
  deliveryShareRate: 5, monthlySlipQuota: 2 };
function fakeDb() {
  const store = new Map();
  store.set(base, { billingPolicyVersion: "hybrid_v1", hybridBillingEnabled: true,
    hybridBillingStartDate: "2026-10-16" });
  const ref = path => ({
    path,
    collection: name => ref(path + "/" + name),
    doc: id => ref(path + "/" + id),
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
  });
  const db = { collection: ref, store };
  let queue = Promise.resolve();
  db.runTransaction = fn => {
    const task = queue.then(async () => {
      const writes = [];
      const tx = {
        get: async doc => ({ exists: store.has(doc.path), data: () => store.get(doc.path) }),
        create: (doc, data) => writes.push(["create", doc.path, data]),
        set: (doc, data) => writes.push(["set", doc.path, data]),
      };
      const result = await fn(tx);
      for (const [mode, key, data] of writes) {
        if (mode === "create" && store.has(key)) throw Error("EXISTS");
        store.set(key, data);
      }
      return result;
    });
    queue = task.catch(() => {});
    return task;
  };
  return db;
}
const reserve = (db, attemptId, overrides = {}) =>
  reserveHybridSlipVerification({
    db, tenantId, orderId: "order-test-123", attemptId,
    now: new Date("2026-10-21T07:00:00Z"),
    trustedPreview: async () => ({
      tenantId, cycleId: "2026-10-16", config: settings, triggerDate: null,
    }),
    serverTimestamp: () => "SERVER_TIME", ...overrides,
  });

test("signup-anniversary-cycle quota uses atomic reservations, third check falls back to manual", async () => {
  const db = fakeDb();
  const [a, b] = await Promise.all([reserve(db, "verify-attempt-0001"), reserve(db, "verify-attempt-0002")]);
  assert.equal(a.status, "reserved");
  assert.equal(b.status, "reserved");
  const third = await reserve(db, "verify-attempt-0003");
  assert.equal(third.status, "manual_review");
  assert.equal(third.reason, "monthly_quota_exhausted");
  assert.equal(db.store.get(base + "/hybridSlipUsage/2026-10-16").count, 2);
});

test("retries with same order attempt do not consume another quota credit", async () => {
  const db = fakeDb();
  await reserve(db, "verify-attempt-0001");
  const retry = await reserve(db, "verify-attempt-0001");
  assert.equal(retry.alreadyReserved, true);
  assert.equal(db.store.get(base + "/hybridSlipUsage/2026-10-16").count, 1);
  await assert.rejects(reserve(db, "verify-attempt-0001", { orderId: "order-different-123" }),
    /HYBRID_SLIP_RESERVATION_CONFLICT/);
});

test("trusted threshold crossing grants unlimited entitlement without additional count", async () => {
  const db = fakeDb();
  await reserve(db, "verify-attempt-0001");
  const unlimited = await reserve(db, "verify-attempt-0002", {
    trustedPreview: async () => ({ tenantId, cycleId: "2026-10-16", config: settings,
      triggerDate: "2026-10-21" }),
  });
  assert.equal(unlimited.status, "reserved");
  assert.equal(unlimited.counted, false);
  assert.equal(db.store.get(base + "/hybridSlipUsage/2026-10-16").unlimited, true);
  assert.equal(db.store.get(base + "/hybridSlipUsage/2026-10-16").count, 1);
});

test("provider unavailable never spends quota; manual fallback remains available", async () => {
  const db = fakeDb();
  const result = await reserve(db, "verify-attempt-0001", { providerAvailable: false });
  assert.equal(result.reason, "provider_unavailable");
  assert.equal(db.store.has(base + "/hybridSlipUsage/2026-10-16"), false);
  assert.equal(db.store.has(base + "/hybridSlipReservations/verify-attempt-0001"), false);
});

test("client-provided-looking incorrect trusted preview is rejected", async () => {
  const db = fakeDb();
  await assert.rejects(reserve(db, "verify-attempt-0001", {
    trustedPreview: async () => ({ tenantId: "wrong", cycleId: "2026-10-16", config: settings, triggerDate: true }),
  }), /HYBRID_TRUSTED_PREVIEW_REQUIRED/);
  assert.equal(db.store.size, 1);
});

test("quota engine is not imported into live Delivery verification or exported to production", () => {
  const delivery = fs.readFileSync("functions/delivery-slip.js", "utf8");
  const index = fs.readFileSync("functions/index.js", "utf8");
  assert.doesNotMatch(delivery, /reserveHybridSlipVerification/);
  assert.doesNotMatch(index, /reserveHybridSlipVerification/);
});

test("quota resets on signup anniversary 16 Nov, not on calendar Nov 1", async () => {
  const db = fakeDb();
  await reserve(db, "verify-attempt-0001");
  await reserve(db, "verify-attempt-0002");
  const oldCycleNov = await reserve(db, "verify-attempt-0003", {
    now: new Date("2026-10-31T17:01:00Z"), // Bangkok November 1
  });
  assert.equal(oldCycleNov.status, "manual_review");
  assert.equal(oldCycleNov.cycleId, "2026-10-16");
  const newCycle = await reserve(db, "verify-attempt-0004", {
    now: new Date("2026-11-15T17:01:00Z"), // Bangkok November 16
    trustedPreview: async () => ({
      tenantId, cycleId: "2026-11-16", config: settings, triggerDate: null,
    }),
  });
  assert.equal(newCycle.status, "reserved");
  assert.equal(newCycle.counted, true);
  assert.equal(newCycle.cycleId, "2026-11-16");
  assert.equal(db.store.get(base + "/hybridSlipUsage/2026-10-16").count, 2);
  assert.equal(db.store.get(base + "/hybridSlipUsage/2026-11-16").count, 1);
});
