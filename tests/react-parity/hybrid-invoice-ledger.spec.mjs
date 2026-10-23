import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { prepareInvoiceLedger, LEDGER_VERSION } =
  require("../../functions/hybrid-billing-ledger.js");
const { persistHybridInvoiceLedger } =
  require("../../functions/hybrid-billing-persistence.js");

const prices = { monthlyFee: 590, deliveryThreshold: 10000,
  deliveryShareRate: 5, monthlySlipQuota: 100 };
const make = (args = {}) => prepareInvoiceLedger({
  cycleStartDate: "2026-10-22",
  cycleEndExclusiveDate: "2026-11-22",
  firstMonth: false, settings: prices,
  asOfDate: "2026-11-02",
  dailyDeliverySales: [],
  ...args,
});
const sale = (date, amount) => ({ date, amount });
const invoiced = (row, status = "issued") => ({ ...row, status });
const periodFrom = plan => ({
  version: LEDGER_VERSION, cycleStartDate: plan.cycleStartDate,
  cycleEndExclusiveDate: plan.cycleEndExclusiveDate,
  configSnapshot: plan.configSnapshot, sealedBeforeDate: plan.sealedBeforeDate,
  sealedSalesDigest: plan.sealedSalesDigest,
  invoiceIds: plan.expectedInvoices.map(row => row.id),
});

test("day-close invoice plan never bills current Bangkok day or fixed fee before cycle close", () => {
  const plan = make({ asOfDate: "2026-11-02", dailyDeliverySales: [
    sale("2026-10-23", 6000), sale("2026-11-01", 4000), sale("2026-11-02", 25000),
  ] });
  assert.equal(plan.mode, "delivery_share");
  assert.equal(plan.expectedInvoices.length, 1);
  assert.deepEqual(plan.expectedInvoices.map(x => [x.kind, x.date, x.amount]), [
    ["delivery_threshold", "2026-11-01", 500],
  ]);
  assert.equal(plan.sealedBeforeDate, "2026-11-02");
  assert.equal(plan.openAmount, 500);
});

test("threshold overshoot creates one deterministic trigger and later closed-day invoices", () => {
  const sales = [sale("2026-10-25", 9000),
    sale("2026-11-01", 4000), sale("2026-11-02", 3000)];
  const atTwo = make({ asOfDate: "2026-11-02", dailyDeliverySales: sales });
  assert.deepEqual(atTwo.expectedInvoices.map(row => row.amount), [500]);
  assert.equal(atTwo.expectedInvoices[0].id, "2026-10-22:delivery:trigger");
  const atThree = make({ asOfDate: "2026-11-03", dailyDeliverySales: sales,
    existingPeriod: periodFrom(atTwo),
    existingInvoices: atTwo.expectedInvoices.map(row => invoiced(row, "paid")) });
  assert.deepEqual(atThree.newInvoices.map(row => [row.date, row.amount]), [
    ["2026-11-02", 150],
  ]);
  assert.equal(atThree.existingInvoiceIds.length, 1);
  assert.equal(atThree.openAmount, 150);
});

test("fixed subscription invoice only appears after final day; first cycle fee remains waived", () => {
  const before = make({ asOfDate: "2026-11-21" });
  assert.deepEqual(before.expectedInvoices, []);
  const close = make({ asOfDate: "2026-11-22" });
  assert.equal(close.expectedInvoices.length, 1);
  assert.deepEqual([close.expectedInvoices[0].kind, close.expectedInvoices[0].amount,
    close.expectedInvoices[0].dueDate], ["fixed_monthly", 590, "2026-11-21"]);
  const trial = make({ asOfDate: "2026-11-22", firstMonth: true });
  assert.deepEqual(trial.expectedInvoices, []);
});

test("changed historical payment/refund after seal fails closed before issuing further invoices", () => {
  const earlier = make({ asOfDate: "2026-11-02",
    dailyDeliverySales: [sale("2026-10-23", 6000)] });
  assert.throws(() => make({ asOfDate: "2026-11-03",
    existingPeriod: periodFrom(earlier),
    dailyDeliverySales: [sale("2026-10-23", 5900), sale("2026-11-02", 5000)],
  }), /HYBRID_LEDGER_HISTORICAL_SALES_CHANGED_REVIEW_REQUIRED/);
  assert.throws(() => make({ asOfDate: "2026-11-01",
    existingPeriod: periodFrom(earlier) }), /HYBRID_LEDGER_INVALID_SEAL/);
});

test("paid invoices cannot be overwritten, removed, or silently changed", () => {
  const issued = make({ asOfDate: "2026-11-03",
    dailyDeliverySales: [sale("2026-10-23", 9000), sale("2026-11-01", 1000)],
  });
  const existingPeriod = periodFrom(issued);
  const goods = [sale("2026-10-23", 9000), sale("2026-11-01", 1000)];
  assert.equal(make({ asOfDate: "2026-11-03", dailyDeliverySales: goods,
    existingPeriod, existingInvoices: [invoiced(issued.expectedInvoices[0], "paid")] }).newInvoices.length, 0);
  assert.throws(() => make({ asOfDate: "2026-11-03", dailyDeliverySales: goods,
    existingPeriod, existingInvoices: [{ ...issued.expectedInvoices[0],
      signature: "tampered", status: "paid" }] }), /HYBRID_LEDGER_EXISTING_INVOICE_DRIFT/);
  assert.throws(() => make({ asOfDate: "2026-11-03", dailyDeliverySales: goods,
    existingPeriod, existingInvoices: [{ ...issued.expectedInvoices[0],
      status: "uploaded_slip_means_paid" }] }), /HYBRID_LEDGER_EXISTING_INVOICE_DRIFT/);
});

function memory() {
  const store = new Map();
  const tenantRef = { collection: coll => ({ doc: id => ({
    key: "tenants/test/" + coll + "/" + id, id,
  }) }) };
  const snapshot = ref => ({
    exists: store.has(ref.key), data: () => store.get(ref.key),
  });
  const db = { async runTransaction(handler) {
    const writes = [];
    const tx = {
      get: async ref => snapshot(ref),
      create(ref, data) { writes.push({ type: "create", ref, data }); },
      update(ref, data) { writes.push({ type: "update", ref, data }); },
    };
    const result = await handler(tx);
    for (const w of writes) {
      if (w.type === "create" && store.has(w.ref.key)) throw new Error("ALREADY_EXISTS");
      store.set(w.ref.key, w.type === "update" ? { ...store.get(w.ref.key), ...w.data } : w.data);
    }
    return result;
  } };
  const readPeriod = () => store.get("tenants/test/hybridBillingPeriods/2026-10-22") || null;
  const readInvoices = () => [...store.entries()]
    .filter(([key]) => key.includes("/hybridBillingInvoices/"))
    .map(([, val]) => val);
  return { db, tenantRef, store, readPeriod, readInvoices };
}

test("private Firestore transaction creates invoices exactly once and repeated reconciliation is a no-op", async () => {
  const env = memory(), serverTimestamp = "serverTimestamp";
  const first = make({ asOfDate: "2026-11-02",
    dailyDeliverySales: [sale("2026-10-23", 9000), sale("2026-11-01", 1000)] });
  const once = await persistHybridInvoiceLedger({
    db: env.db, tenantRef: env.tenantRef, ledger: first, serverTimestamp });
  assert.deepEqual([once.created, once.reused, once.unchanged], [1, 0, false]);
  assert.equal(env.readInvoices()[0].status, "issued");
  assert.equal(env.readPeriod().configSnapshot.monthlyFee, 590);

  const repeat = make({ asOfDate: "2026-11-02",
    dailyDeliverySales: [sale("2026-10-23", 9000), sale("2026-11-01", 1000)],
    existingPeriod: env.readPeriod(), existingInvoices: env.readInvoices() });
  const twice = await persistHybridInvoiceLedger({
    db: env.db, tenantRef: env.tenantRef, ledger: repeat, serverTimestamp });
  assert.deepEqual([twice.created, twice.reused, twice.unchanged], [0, 1, true]);
  assert.equal(env.readInvoices().length, 1);
});

test("concurrent stale issuance and paid invoice modifications never rewrite transaction data", async () => {
  const env = memory(), serverTimestamp = "serverTimestamp";
  const initial = make({ asOfDate: "2026-11-02" });
  await persistHybridInvoiceLedger({
    db: env.db, tenantRef: env.tenantRef, ledger: initial, serverTimestamp });
  const oldPlan = make({ asOfDate: "2026-11-03" });
  await assert.rejects(persistHybridInvoiceLedger({
    db: env.db, tenantRef: env.tenantRef, ledger: oldPlan, serverTimestamp,
  }), /HYBRID_LEDGER_CONCURRENT_PERIOD_UPDATE_RETRY/);

  const now = make({ asOfDate: "2026-11-03",
    dailyDeliverySales: [sale("2026-11-02", 10000)],
    existingPeriod: env.readPeriod() });
  await persistHybridInvoiceLedger({ db: env.db, tenantRef: env.tenantRef,
    ledger: now, serverTimestamp });
  const invoiceRef = "tenants/test/hybridBillingInvoices/2026-10-22:delivery:trigger";
  env.store.set(invoiceRef, { ...env.store.get(invoiceRef), status: "paid" });
  const replay = make({ asOfDate: "2026-11-03",
    dailyDeliverySales: [sale("2026-11-02", 10000)],
    existingPeriod: env.readPeriod(), existingInvoices: env.readInvoices() });
  const result = await persistHybridInvoiceLedger({
    db: env.db, tenantRef: env.tenantRef, ledger: replay, serverTimestamp });
  assert.equal(result.unchanged, true);
  assert.equal(env.store.get(invoiceRef).status, "paid");
});

test("payment status cannot be forged and snapshots are immutable", async () => {
  const env = memory(), serverTimestamp = "serverTimestamp";
  const first = make({ asOfDate: "2026-11-02",
    dailyDeliverySales: [sale("2026-11-01", 10000)] });
  await persistHybridInvoiceLedger({ db: env.db, tenantRef: env.tenantRef,
    ledger: first, serverTimestamp });
  const alteredPrices = { ...prices, deliveryShareRate: 9, monthlyFee: 900 };
  const retry = make({ asOfDate: "2026-11-02",
    dailyDeliverySales: [sale("2026-11-01", 10000)],
    existingPeriod: env.readPeriod(), existingInvoices: env.readInvoices(),
    settings: alteredPrices });
  assert.equal(retry.configSnapshot.deliveryShareRate, 5);
  assert.equal(retry.expectedInvoices[0].amount, 500);
  const invoiceRef = "tenants/test/hybridBillingInvoices/2026-10-22:delivery:trigger";
  env.store.set(invoiceRef, { ...env.store.get(invoiceRef), status: "fake_paid" });
  await assert.rejects(persistHybridInvoiceLedger({
    db: env.db, tenantRef: env.tenantRef, ledger: retry, serverTimestamp,
  }), /HYBRID_LEDGER_INVOICE_CONFLICT_REVIEW_REQUIRED/);
});

test("invoice writer is private and not exported as a Firebase callable or scheduler", () => {
  const bootstrap = fs.readFileSync("functions/bootstrap.js", "utf8");
  const source = fs.readFileSync("functions/hybrid-billing-persistence.js", "utf8");
  assert.doesNotMatch(bootstrap, /hybrid-billing-persistence|hybrid-billing-ledger/);
  assert.doesNotMatch(source, /onCall|onSchedule|https\.onRequest/);
});

test("Firestore browser access is tenant-scoped and never mutates invoice or period ledgers", () => {
  const rules = fs.readFileSync("firestore.rules", "utf8");
  for (const col of ["hybridBillingPeriods", "hybridBillingInvoices"]) {
    const marker = "match /" + col + "/{";
    const at = rules.indexOf(marker);
    assert.ok(at > 0, "Missing billing security rule " + col);
    const snippet = rules.slice(at, at + 225);
    assert.match(snippet, /allow get, list: if tenantAdminRole\(tenantId\) \|\| superAdminRole\(\)/);
    assert.match(snippet, /allow create, update, delete: if false/);
  }
});
