import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { unresolvedDueInvoices, reconcileHybridArrears } =
  require("../../functions/hybrid-billing-arrears.js");

const tenantId = "tenant-test-123", prefix = "tenants/" + tenantId;
const sample = (id, day, amount = 50000) => ({
  invoiceId: id, tenantId, policyVersion: "hybrid_v1", amountCents: amount,
  suspendFrom: day,
});
const old = sample("2026-09-16:delivery:trigger", "2026-09-22");
const current = sample("2026-10-16:delivery:trigger", "2026-10-22");

function makeDb(data = {}) {
  const store = new Map([[prefix, { billingPolicyVersion: "hybrid_v1",
    hybridBillingEnabled: true, active: true, ...data }]]);
  const ref = path => ({
    path,
    collection: name => ref(path + "/" + name),
    doc: id => ref(path + "/" + id),
    where: (field, cmp, value) => {
      assert.equal(field, "suspendFrom");
      assert.equal(cmp, "<=");
      const query = {
        path, isQuery: true, onDate: value, limitN: 99999,
        orderBy(sortKey) { assert.equal(sortKey, "suspendFrom"); return query; },
        limit(n) { query.limitN = n; return query; },
        get() { throw Error("ARREARS_PRE_TRANSACTION_QUERY_FORBIDDEN"); },
      };
      return query;
    },
  });
  const db = { collection: ref, store };
  db.runTransaction = async fn => {
    const changes = [];
    const out = await fn({
      get: async doc => {
        if (doc.isQuery) {
          const records = [...store.entries()].filter(([id]) => id.startsWith(doc.path + "/"))
            .filter(([id]) => id.split("/").length === doc.path.split("/").length + 1)
            .map(([, item]) => item).filter(row => row.suspendFrom <= doc.onDate)
            .sort((a, b) => a.suspendFrom.localeCompare(b.suspendFrom));
          const docs = records.slice(0, doc.limitN).map(row => ({ data: () => row }));
          return { docs, size: docs.length };
        }
        return { exists: store.has(doc.path), data: () => store.get(doc.path) };
      },
      update: (doc, update) => changes.push([doc.path, update]),
    });
    changes.forEach(([key, update]) => store.set(key, { ...store.get(key), ...update }));
    return out;
  };
  return db;
}
const run = (db, now = "2026-10-22T05:00:00.000Z") =>
  reconcileHybridArrears({ db, tenantId, now: new Date(now),
    serverTimestamp: () => "SERVER_TIME" });

test("previous-month unpaid invoice remains owed after month changes", () => {
  assert.deepEqual(unresolvedDueInvoices([old, current], [], "2026-10-21"), [old.invoiceId]);
  assert.deepEqual(unresolvedDueInvoices([old, current], [old.invoiceId], "2026-10-22"), [current.invoiceId]);
});

test("next-day suspension is idempotent, only for activated hybrid tenant", async () => {
  const db = makeDb();
  db.store.set(prefix + "/hybridBillingInvoices/" + old.invoiceId, old);
  const status = await run(db);
  assert.equal(status.status, "suspended");
  assert.deepEqual(status.outstandingIds, [old.invoiceId]);
  assert.equal(db.store.get(prefix).active, false);
  assert.equal(db.store.get(prefix).hybridBillingSuspended, true);
  assert.equal((await run(db)).status, "already_suspended");
});

test("approved settlement removes invoice from overdue, but never reactivates prematurely", async () => {
  const db = makeDb();
  db.store.set(prefix + "/hybridBillingInvoices/" + old.invoiceId, old);
  await run(db);
  db.store.set(prefix + "/hybridBillingSettlements/" + old.invoiceId, {
    tenantId, invoiceId: old.invoiceId, amountCents: old.amountCents, approvedAt: "SERVER_TIME",
  });
  const state = await run(db);
  assert.equal(state.status, "settled_waiting_for_safe_recovery");
  assert.equal(db.store.get(prefix).active, false);
});

test("manual disabled tenant and legacy tenant cannot be automatically changed", async () => {
  const disabled = makeDb({ active: false });
  disabled.store.set(prefix + "/hybridBillingInvoices/" + old.invoiceId, old);
  assert.equal((await run(disabled)).status, "manual_hold");
  assert.equal(disabled.store.get(prefix).hybridBillingSuspended, undefined);
  const legacy = makeDb({ billingPolicyVersion: "legacy" });
  legacy.store.set(prefix + "/hybridBillingInvoices/" + old.invoiceId, old);
  await assert.rejects(run(legacy), /HYBRID_TENANT_NOT_ACTIVATED/);
});

test("tampered settlement amount fails closed", async () => {
  const db = makeDb();
  db.store.set(prefix + "/hybridBillingInvoices/" + old.invoiceId, old);
  db.store.set(prefix + "/hybridBillingSettlements/" + old.invoiceId, {
    tenantId, invoiceId: old.invoiceId, amountCents: 1, approvedAt: "SERVER_TIME",
  });
  await assert.rejects(run(db), /HYBRID_SETTLEMENT_INVALID/);
});

test("no active scheduler and hybrid signup is still disabled", () => {
  const index = fs.readFileSync("functions/index.js", "utf8");
  assert.doesNotMatch(index, /reconcileHybridArrears/);
  assert.match(fs.readFileSync("functions/hybrid-billing-settings.js", "utf8"),
    /HYBRID_REGISTRATION_READY = false/);
});

test("overdue invoice inserted before transaction decision is included (no stale external scan)", async () => {
  const db = makeDb();
  const original = db.runTransaction;
  db.runTransaction = callback => {
    db.store.set(prefix + "/hybridBillingInvoices/" + old.invoiceId, old);
    return original(callback);
  };
  const state = await run(db);
  assert.equal(state.status, "suspended");
  assert.deepEqual(state.outstandingIds, [old.invoiceId]);
  assert.equal(db.store.get(prefix).hybridBillingSuspended, true);
});

test("excess invoices cannot be treated as an empty/no-debt scan", async () => {
  const db = makeDb();
  db.store.set(prefix + "/hybridBillingInvoices/" + old.invoiceId, old);
  db.store.set(prefix + "/hybridBillingInvoices/" + current.invoiceId, current);
  await assert.rejects(
    reconcileHybridArrears({ db, tenantId, now: new Date("2026-10-22T05:00:00Z"),
      maximumInvoices: 1, serverTimestamp: () => "SERVER_TIME" }),
    /HYBRID_ARREARS_SCAN_LIMIT/,
  );
  assert.equal(db.store.get(prefix).hybridBillingSuspended, undefined);
  assert.equal(db.store.get(prefix).active, true);
});
