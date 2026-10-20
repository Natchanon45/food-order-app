import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { issueHybridInvoicesForClosedDay, planClosedDay } = require("../../functions/hybrid-billing-ledger.js");

const paidAt = iso => ({ toDate: () => new Date(iso), toMillis: () => Date.parse(iso) });
const order = (id, date, goods, extra = {}) => ({
  id, data: {
    orderType: "delivery", paymentStatus: "paid", status: "delivered",
    paidAt: paidAt(date), subtotalAmount: goods,
    totalAmount: goods + 40, deliveryFee: 40, ...extra,
  },
});
const rows = () => [
  order("order-a", "2026-10-20T10:00:00Z", 11000),
  order("order-b", "2026-10-21T10:00:00Z", 1200),
  order("order-pos", "2026-10-21T10:00:00Z", 70000, { orderType: "pos" }),
];

function fakeFirestore({ signupDate = "2026-09-16", enabled = true, settings = {} } = {}) {
  const store = new Map();
  const ref = path => ({
    path,
    collection(name) { return ref(path + "/" + name); },
    doc(id) { return ref(path + "/" + id); },
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
  });
  const db = { collection: ref, raw: store };
  const tenantPath = "tenants/tenant-test-123";
  store.set(tenantPath, {
    billingPolicyVersion: "hybrid_v1", hybridBillingEnabled: enabled,
    hybridBillingStartDate: signupDate,
    hybridBillingSnapshot: {
      monthlyFee: 790, deliveryThreshold: 10000, deliveryShareRate: 4, monthlySlipQuota: 50,
    },
  });
  store.set("platformSettings/hybridBilling", {
    monthlyFee: 590, deliveryThreshold: 10000, deliveryShareRate: 5, monthlySlipQuota: 100,
    ...settings,
  });
  let queue = Promise.resolve();
  const snapshot = path => ({ exists: store.has(path), data: () => store.get(path) });
  db.runTransaction = fn => {
    const task = queue.then(async () => {
      const operations = [];
      const tx = {
        get: async doc => snapshot(doc.path),
        create: (doc, data) => operations.push(["create", doc.path, data]),
        update: (doc, data) => operations.push(["update", doc.path, data]),
      };
      const result = await fn(tx);
      for (const [kind, path, data] of operations) {
        if (kind === "create" && store.has(path)) throw Error("already exists: " + path);
        if (kind === "update" && !store.has(path)) throw Error("not found: " + path);
        store.set(path, kind === "update" ? { ...store.get(path), ...data } : data);
      }
      return result;
    });
    queue = task.catch(() => {});
    return task;
  };
  return db;
}
const issue = (db, orders, now = "2026-10-22T10:00:00Z", cycleId = "2026-10-16") =>
  issueHybridInvoicesForClosedDay({ db, tenantId: "tenant-test-123", cycleId,
    now: new Date(now), readOrders: async () => orders,
    auditReceipts: async () => ({ scanned: orders.length }),
    serverTimestamp: () => "MOCK_SERVER_TIMESTAMP" });
const invoices = db => [...db.raw.entries()].filter(([key]) => key.includes("/hybridBillingInvoices/"))
  .map(([, record]) => record);

test("closed-day trigger uses full 11000 day and next day bills only new sales", async () => {
  const db = fakeFirestore();
  const result = await issue(db, rows());
  assert.deepEqual(result.issued, ["2026-10-16:delivery:trigger", "2026-10-16:delivery:2026-10-21"]);
  const list = invoices(db);
  assert.deepEqual(list.map(i => i.amountCents), [55000, 6000]);
  assert.deepEqual(list.map(i => i.baseCents), [1100000, 120000]);
  assert.equal(list[0].suspendFrom, "2026-10-21");
  assert.equal(list[0].currency, "THB");
  assert.ok(!Object.hasOwn(list[0], "paymentApproved"));
  assert.equal(db.raw.get("tenants/tenant-test-123/hybridBillingPeriods/2026-10-16").daySeals["2026-10-21"].receiptCount, 1);
});

test("concurrent repeats cannot duplicate invoice IDs or overwrite issued amounts", async () => {
  const db = fakeFirestore();
  const [first, second] = await Promise.all([issue(db, rows()), issue(db, rows())]);
  assert.equal(first.issued.length + second.issued.length, 2);
  assert.equal(invoices(db).length, 2);
  assert.deepEqual([...first.issued, ...second.issued].sort(),
    ["2026-10-16:delivery:2026-10-21", "2026-10-16:delivery:trigger"]);
});

test("pricing edits after snapshot do not rewrite historic rate or amounts", async () => {
  const db = fakeFirestore();
  await issue(db, rows());
  db.raw.set("platformSettings/hybridBilling", {
    monthlyFee: 999, deliveryThreshold: 1000, deliveryShareRate: 90, monthlySlipQuota: 20,
  });
  const initial = invoices(db).map(x => x.amountCents);
  const retried = await issue(db, rows());
  assert.equal(retried.issued.length, 0);
  assert.deepEqual(invoices(db).map(x => x.amountCents), initial);
  assert.equal(db.raw.get("tenants/tenant-test-123/hybridBillingPeriods/2026-10-16").configSnapshot.deliveryShareRate, 5);
});

test("edits to settled-day refunds and source orders fail closed, never issue new bills", async () => {
  const db = fakeFirestore();
  await issue(db, rows());
  const modified = rows();
  modified[0].data.refundTotal = 8000;
  await assert.rejects(issue(db, modified), /HYBRID_CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT/);
  assert.equal(invoices(db).length, 2);
});

test("fixed fee issues only after signup-anniversary close and never in first cycle", async () => {
  const db = fakeFirestore({ signupDate: "2026-09-16" });
  const small = [order("small", "2026-10-20T10:00:00Z", 100)];
  const before = await issue(db, small);
  assert.equal(before.issued.length, 0);
  const after = await issue(db, small, "2026-11-15T17:00:00Z");
  assert.deepEqual(after.issued, ["2026-10-16:monthly:fixed"]);
  assert.equal(invoices(db)[0].amountCents, 59000);
  assert.equal((await issue(db, small, "2026-11-18T10:00:00Z")).issued.length, 0);

  const first = fakeFirestore({ signupDate: "2026-10-16" });
  const trial = await issue(first, small, "2026-11-15T17:00:00Z");
  assert.deepEqual(trial.issued, []);
  assert.equal(invoices(first).length, 0);
});

test("first signup cycle charges full trigger day with signup snapshot", async () => {
  const db = fakeFirestore({ signupDate: "2026-10-16" });
  const result = await issue(db, rows());
  assert.equal(result.firstCycle, true);
  assert.deepEqual(invoices(db).map(x => x.amountCents), [44000, 4800]);
  const period = db.raw.get("tenants/tenant-test-123/hybridBillingPeriods/2026-10-16");
  assert.equal(period.configSnapshot.deliveryShareRate, 4);
});

test("future day cannot be issued, and legacy/nonactivated tenant is protected", async () => {
  const db = fakeFirestore();
  assert.equal((await issue(db, rows(), "2026-10-01T09:00:00Z")).skipped, true);
  assert.equal(invoices(db).length, 0);
  const blocked = fakeFirestore({ enabled: false });
  await assert.rejects(issue(blocked, rows()), /HYBRID_TENANT_NOT_ACTIVATED/);
  assert.equal(invoices(blocked).length, 0);
  assert.throws(() => planClosedDay({ orders: rows(), tenantId: "tenant-test-123",
    signupDate: "2026-09-16", cycleId: "2026-10-16", throughDay: "2026-10-19", settings: {} }),
  /HYBRID_PAID_ORDER_OUTSIDE_CLOSED_WINDOW/);
});

test("no live function export or scheduler exists; registration stays fail-closed", () => {
  const index = fs.readFileSync("functions/index.js", "utf8");
  const settings = fs.readFileSync("functions/hybrid-billing-settings.js", "utf8");
  assert.doesNotMatch(index, /issueHybridInvoicesForClosedDay|reconcileHybridInvoice/);
  assert.match(settings, /HYBRID_REGISTRATION_READY = false/);
});

test("09:00 threshold plus 23:00 orders: no premature invoice, closed day bills 15,500 x 5%", async () => {
  // The second cycle uses the platform 5% rate; first-cycle signup snapshot is 4%.
  const db = fakeFirestore({ signupDate: "2026-09-16" });
  const accepted = [
    order("morning-09", "2026-10-20T02:00:00Z", 10000),
    order("night-23", "2026-10-20T16:00:00Z", 5500),
  ];
  const run = now => issueHybridInvoicesForClosedDay({
    db, tenantId: "tenant-test-123", cycleId: "2026-10-16",
    now: new Date(now),
    auditReceipts: async () => ({ scanned: accepted.length }),
    readOrders: async (_, start, end) => accepted.filter(row => {
      const stamp = row.data.paidAt.toMillis();
      return stamp >= start.getTime() && stamp < end.getTime();
    }),
    serverTimestamp: () => "MOCK_SERVER_TIMESTAMP",
  });
  const duringDay = await run("2026-10-20T16:30:00Z"); // 23:30 Bangkok
  assert.deepEqual(duringDay.issued, []);
  assert.equal(invoices(db).length, 0);
  const closed = await run("2026-10-20T17:01:00Z"); // 00:01 Oct 21 Bangkok
  assert.deepEqual(closed.issued, ["2026-10-16:delivery:trigger"]);
  assert.equal(invoices(db)[0].baseCents, 1550000);
  assert.equal(invoices(db)[0].amountCents, 77500);
  assert.equal(invoices(db)[0].dueDate, "2026-10-20");
  assert.equal(invoices(db)[0].suspendFrom, "2026-10-21");
  assert.deepEqual((await run("2026-10-20T17:02:00Z")).issued, []);
  assert.equal(invoices(db).length, 1);
});

test("invoice scan runs INSIDE transaction and includes a same-day order committed just before scan", async () => {
  const db = fakeFirestore();
  const accepted = [order("morning-09", "2026-10-20T02:00:00Z", 10000)];
  let called = 0;
  let sawTransaction = false;
  const originalRun = db.runTransaction;
  db.runTransaction = callback => {
    // A payment arrives after tenant metadata is read but before the
    // transaction begins. Pre-transaction order scanning would omit it.
    accepted.push(order("night-23", "2026-10-20T16:00:00Z", 5500));
    return originalRun(callback);
  };
  const result = await issueHybridInvoicesForClosedDay({
    db, tenantId: "tenant-test-123", cycleId: "2026-10-16",
    now: new Date("2026-10-20T17:03:00Z"),
    auditReceipts: async () => ({ scanned: accepted.length }),
    readOrders: async (_, start, end, opts) => {
      called++;
      sawTransaction = Boolean(opts.transaction && typeof opts.transaction.get === "function");
      assert.equal(opts.maxRecords, 3000);
      return accepted.filter(row =>
        row.data.paidAt.toMillis() >= start.getTime() &&
        row.data.paidAt.toMillis() < end.getTime());
    },
    serverTimestamp: () => "MOCK_SERVER_TIMESTAMP",
  });
  assert.equal(called, 1);
  assert.equal(sawTransaction, true);
  assert.deepEqual(result.issued, ["2026-10-16:delivery:trigger"]);
  assert.equal(invoices(db)[0].amountCents, 77500);
});

test("incomplete paid-order scan aborts atomically before creating period or invoice", async () => {
  const db = fakeFirestore();
  await assert.rejects(issueHybridInvoicesForClosedDay({
    db, tenantId: "tenant-test-123", cycleId: "2026-10-16",
    now: new Date("2026-10-20T17:05:00Z"),
    auditReceipts: async () => ({ scanned: 0 }),
    readOrders: async () => [{ id: "broken", data: null }],
    serverTimestamp: () => "MOCK_SERVER_TIMESTAMP",
  }), /HYBRID_PAID_ORDER_SCAN_INCOMPLETE/);
  assert.equal(invoices(db).length, 0);
  assert.equal(db.raw.has("tenants/tenant-test-123/hybridBillingPeriods/2026-10-16"), false);
});
