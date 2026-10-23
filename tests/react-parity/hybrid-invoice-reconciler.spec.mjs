import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { prepareTrustedHybridLedger, issueTrustedHybridLedger,
  HYBRID_INVOICE_ISSUANCE_READY } = require("../../functions/hybrid-billing-reconciler.js");

const prices = { monthlyFee: 590, deliveryThreshold: 10000,
  deliveryShareRate: 5, monthlySlipQuota: 100 };
const fakeDate = value => ({ toDate: () => new Date(value) });
function mockTenant({
  orders = [], existingPeriod = null, existingInvoices = [], settings = prices,
} = {}) {
  const invoiceRows = new Map(existingInvoices.map(i => [i.id, i]));
  const query = {
    where: () => query, orderBy: () => query, limit: () => query,
    startAfter: () => query,
    get: async () => ({
      docs: orders.map(row => ({ data: () => row })), size: orders.length,
    }),
  };
  const tenantRef = {
    id: "fixture-shop",
    collection: name => name === "orders" ? query
      : name === "hybridBillingPeriods" ? ({
        doc: id => ({
          id,
          get: async () => ({ exists: Boolean(existingPeriod), data: () => existingPeriod }),
        }),
      }) : name === "hybridBillingInvoices" ? ({
        doc: id => ({
          id, get: async () => ({
            exists: invoiceRows.has(id),
            data: () => invoiceRows.get(id),
          }),
        }),
      }) : (() => { throw Error("Unexpected collection " + name); })(),
  };
  const db = {
    collection: name => {
      if (name !== "platformSettings") throw Error(name);
      return { doc: id => ({
        get: async () => ({ exists: true, data: () => settings }),
      }) };
    },
  };
  return { db, tenantRef };
}
const paidOrder = (date, merchandise) => ({
  orderType: "delivery", paymentStatus: "paid", status: "delivered",
  paidAt: fakeDate(date + "T12:00:00+07:00"),
  subtotalAmount: merchandise, totalAmount: merchandise + 40, deliveryFee: 40,
});
const tenant = (timestamp = "2026-10-22T00:00:00+07:00") => ({
  createdAt: timestamp, billingMode: "", planCode: "yearly",
});

test("read-only trusted invoice planner uses activation anniversary for a legacy blank billingMode", async () => {
  const { db, tenantRef } = mockTenant({ orders: [
    paidOrder("2026-10-31", 6000), paidOrder("2026-11-01", 5000),
  ] });
  const result = await prepareTrustedHybridLedger({
    db, tenantRef, tenant: tenant(), month: "2026-10",
    now: new Date("2026-11-02T00:00:00+07:00"),
  });
  const plan = result.invoicePlan;
  assert.equal(result.writesPerformed, false);
  assert.equal(plan.cycleStartDate, "2026-10-22");
  assert.equal(plan.cycleEndDate, "2026-11-21");
  assert.equal(plan.firstMonth, undefined, "first-cycle billing is stored as policy, not client flag");
  assert.equal(plan.mode, "delivery_share");
  assert.deepEqual(plan.expectedInvoices.map(x => [x.date, x.amount]),
    [["2026-11-01", 500]]);
});

test("fixed fee only after anniversary close; a first-cycle fee is waived", async () => {
  const env = mockTenant(), tenantData = tenant();
  const early = await prepareTrustedHybridLedger({
    ...env, tenant: tenantData, month: "2026-10",
    now: new Date("2026-11-21T16:00:00+07:00"),
  });
  assert.equal(early.invoicePlan.expectedInvoices.length, 0);
  const close = await prepareTrustedHybridLedger({
    ...env, tenant: tenantData, month: "2026-10",
    now: new Date("2026-11-22T00:00:00+07:00"),
  });
  assert.equal(close.invoicePlan.expectedInvoices.length, 0, "first activation month is trial");
  const later = await prepareTrustedHybridLedger({
    ...env, tenant: tenantData, month: "2026-11",
    now: new Date("2026-12-22T00:00:00+07:00"),
  });
  assert.equal(later.invoicePlan.expectedInvoices[0].amount, 590);
  assert.equal(later.invoicePlan.expectedInvoices[0].date, "2026-12-21");
});

test("previous issued invoice snapshot always overrides changed live central prices", async () => {
  const originalEnv = mockTenant({ orders: [paidOrder("2026-11-01", 10000)] });
  const first = await prepareTrustedHybridLedger({
    ...originalEnv, tenant: tenant(), month: "2026-10",
    now: new Date("2026-11-02T12:00:00+07:00"),
  });
  const p = first.invoicePlan;
  const snapshot = {
    version: p.version, cycleStartDate: p.cycleStartDate,
    cycleEndExclusiveDate: p.cycleEndExclusiveDate,
    configSnapshot: p.configSnapshot, sealedBeforeDate: p.sealedBeforeDate,
    sealedSalesDigest: p.sealedSalesDigest,
    invoiceIds: p.expectedInvoices.map(x => x.id),
  };
  const env = mockTenant({
    orders: [paidOrder("2026-11-01", 10000)],
    existingPeriod: snapshot,
    existingInvoices: p.expectedInvoices.map(invoice => ({ ...invoice, status: "paid" })),
    settings: { ...prices, deliveryShareRate: 25, monthlyFee: 999 },
  });
  const replay = await prepareTrustedHybridLedger({
    ...env, tenant: tenant(), month: "2026-10",
    now: new Date("2026-11-02T12:00:00+07:00"),
  });
  assert.deepEqual(replay.invoicePlan.newInvoices, []);
  assert.equal(replay.invoicePlan.configSnapshot.deliveryShareRate, 5);
  assert.equal(replay.invoicePlan.openAmount, 0);
});

test("untrusted future dates, invalid invoice index and historical revenue changes fail closed", async () => {
  const env = mockTenant();
  await assert.rejects(prepareTrustedHybridLedger({
    ...env, tenant: tenant(), month: "2026-11",
    now: new Date("2026-11-01T00:00:00+07:00"),
  }), /HYBRID_CANNOT_ISSUE_FUTURE_CYCLE/);
  const corrupted = mockTenant({
    existingPeriod: { invoiceIds: ["../something"] },
  });
  await assert.rejects(prepareTrustedHybridLedger({
    ...corrupted, tenant: tenant(), month: "2026-10",
    now: new Date("2026-11-02T00:00:00+07:00"),
  }), /HYBRID_PERIOD_INVOICE_REFERENCE_INVALID/);
});

test("production issuer is disabled even with trusted admin data and caller input", async () => {
  assert.equal(HYBRID_INVOICE_ISSUANCE_READY, false);
  await assert.rejects(issueTrustedHybridLedger({}),
    /HYBRID_INVOICE_ISSUANCE_DISABLED/);
  const boot = fs.readFileSync("functions/bootstrap.js", "utf8");
  for (const hidden of ["hybrid-billing-reconciler", "hybrid-billing-persistence"]) {
    assert.doesNotMatch(boot, new RegExp(hidden));
  }
  const source = fs.readFileSync("functions/hybrid-billing-reconciler.js", "utf8");
  assert.match(source, /const HYBRID_INVOICE_ISSUANCE_READY = false/);
  assert.doesNotMatch(source, /onCall\(|onSchedule\(/);
});
