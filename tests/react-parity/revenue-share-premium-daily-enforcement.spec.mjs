import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const source = fs.readFileSync("functions/revenue-share.js", "utf8");
const PRICE = { deliveryThreshold: 10000, deliveryShareRate: 5, monthlyPrice: 590 };
const paid = (date, goods) => ({
  orderType: "delivery", paymentStatus: "paid", status: "delivered",
  paidAt: date + "T12:00:00+07:00", subtotalAmount: goods,
  totalAmount: goods + 40, deliveryFee: 40,
});
function fixture(now = "2026-10-11", options = {}) {
  const clock = now + "T12:00:00+07:00";
  const DateOriginal = Date;
  class Clock extends DateOriginal {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return DateOriginal.parse(clock); }
  }
  const tenant = { billingMode: "subscription", businessType: "restaurant_cafe",
    createdAt: "2026-10-03T08:00:00+07:00", subscriptionStatus: "active",
    active: true, slug: "synthetic-tenant", ...options.tenant };
  const orders = options.orders || [
    paid("2026-10-03", 4000), paid("2026-10-09", 6000),
    paid("2026-10-10", 1500),
    // Exempt Retail/POS/fees/unpaid orders even if much bigger.
    { ...paid("2026-10-10", 50000), orderType: "pos" },
    { ...paid("2026-10-10", 50000), paymentStatus: "unpaid" },
  ];
  const payments = options.payments || [];
  const slipArgs = [];
  const applied = [];
  const tenantRef = {
    id: "synthetic-tenant",
    get: async () => ({ exists: true, id: "synthetic-tenant", data: () => tenant }),
    collection: name => ({
      get: async () => ({ docs: (name === "orders" ? orders : name === "sales" ? [] : payments)
        .map((record, index) => ({ id: record.id || String(index), data: () => record })) }),
      orderBy: () => ({
        limit: () => ({ get: async () => ({ docs: payments.map((record, index) =>
          ({ id: record.id || String(index), data: () => record })) }) }),
      }),
      doc: id => ({ kind: name, id }),
    }),
  };
  const fields = {
    delete: () => Symbol.for("firebase-delete"),
    serverTimestamp: () => "server-clock",
  };
  const apply = (ref, patch) => {
    if (ref.kind === "tenant") {
      for (const [key, value] of Object.entries(patch)) {
        if (value === Symbol.for("firebase-delete")) delete tenant[key];
        else tenant[key] = value;
      }
      applied.push("tenant");
    } else if (ref.kind === "payment") {
      Object.assign(payments.find(payment => payment.id === ref.id), patch);
      applied.push("payment");
    }
  };
  const db = {
    collection: name => {
      if (name === "users") return { doc: () => ({
        get: async () => ({ data: () => ({ role: "super_admin", active: true }) }),
      }) };
      if (name === "tenants") return {
        doc: () => Object.assign({ kind: "tenant" }, tenantRef),
        get: async () => ({ docs: [{ id: "synthetic-tenant", ref: tenantRef, data: () => tenant }] }),
      };
      if (name === "tenantSlugs") return { doc: () => ({ kind: "slug" }) };
      throw Error("Unexpected collection: " + name);
    },
    batch: () => {
      const queue = [];
      return { set: (ref, data) => queue.push([ref, data]),
        commit: async () => { for (const [ref, data] of queue) apply(ref, data); } };
    },
    runTransaction: async fn => {
      const patches = [];
      const tx = {
        get: async ref => {
          if (ref.kind !== "revenueSharePayments") throw Error("Unexpected transaction read");
          const payment = payments.find(p => p.id === ref.id);
          return { exists: Boolean(payment), data: () => payment };
        },
        set: (ref, patch) => patches.push([{ kind: "payment", id: ref.id }, patch]),
      };
      const result = await fn(tx);
      for (const [ref, patch] of patches) apply(ref, patch);
      return result;
    },
  };
  const deps = {
    "firebase-functions/v2/https": {
      HttpsError: class extends Error { constructor(code, message) { super(message); this.code = code; } },
      onCall: (_opts, fn) => fn,
    },
    "firebase-functions/v2/scheduler": { onSchedule: (_opts, fn) => fn },
    "firebase-admin/firestore": { getFirestore: () => db, FieldValue: fields },
    "firebase-admin/storage": { getStorage: () => ({}) },
    "node:crypto": require("node:crypto"),
    "./finance-slip-claims": require("../../functions/finance-slip-claims.js"),
    "./slip-verification": { inspectSlip: async (...args) => {
      slipArgs.push(args); return { provider: "slip2go", status: "manual_review" };
    } },
    "./subscription-pricing-core": {
      loadPricing: async () => PRICE, calculatePricing: () => ({ monthly: {payable: 590}, annual: {payable: 5900} }),
    },
    "./revenue-share-policy": require("../../functions/revenue-share-policy.js"),
    "./billing-anniversary": require("../../functions/billing-anniversary.js"),
  };
  const moduleObject = { exports: {} };
  new Function("module", "exports", "require", "Date",
    source + "\nmodule.exports.__setting = revenueSetting;"
      + "\nmodule.exports.__reconcileTenant = reconcileTenant;"
      + "\nmodule.exports.__previousPeriod = previousPeriod;"
      + "\nmodule.exports.__summary = summaryForTenant;"
      + "\nmodule.exports.__inspect = inspectRevenueShareSlip;")(
    moduleObject, moduleObject.exports, name => {
      assert.ok(name in deps, "Unexpected dependency " + name);
      return deps[name];
    }, Clock);
  return { ...moduleObject.exports, tenant, payments, applied, slipArgs };
}

test("Premium Delivery uses daily settlement but anniversary-month threshold and THB 75 excess", async () => {
  const env = fixture();
  const config = env.__setting(env.tenant, PRICE);
  assert.deepEqual([config.enabled, config.premiumDeliveryShare, config.billingCycle,
    config.billingAnchorDate], [true, true, "daily", "2026-10-03"]);
  const period = env.__previousPeriod(config.billingCycle, env.tenant);
  assert.deepEqual([period.startDate, period.endDate], ["2026-10-10", "2026-10-10"]);
  const report = await env.__summary("synthetic-tenant", period, config);
  assert.equal(report.deliveryShareBase, 1500);
  assert.equal(report.deliveryShareAmount, 75);
  assert.equal(report.platformAmountDue, 75);
  assert.equal(report.lalamoveOutstandingCost, 0);
});

test("00:20 Bangkok scheduler suspends unpaid yesterday once and preserves billing identity", async () => {
  const env = fixture("2026-10-11");
  await env.syncRevenueShareTenants();
  assert.equal(env.tenant.active, false);
  assert.equal(env.tenant.revenueShareSuspended, true);
  assert.equal(env.tenant.revenueShareSuspendedPeriodStart, "2026-10-10");
  assert.equal(env.tenant.revenueShareSuspendedPeriodEnd, "2026-10-10");
  const firstCount = env.applied.filter(x => x === "tenant").length;
  await env.syncRevenueShareTenants();
  assert.equal(env.applied.filter(x => x === "tenant").length, firstCount);
});

test("submitted slip pending independent Super Admin verification defers suspension", async () => {
  const env = fixture("2026-10-11", { payments: [{
    id: "payment-test", periodType: "daily",
    periodStart: "2026-10-10", periodEnd: "2026-10-10",
    status: "pending", createdAt: "2026-10-10T20:00:00+07:00",
  }] });
  const result = await env.__reconcileTenant("synthetic-tenant");
  assert.equal(result.state, "pending");
  assert.equal(env.tenant.revenueShareSuspended, undefined);
  assert.equal(env.tenant.active, true);
});

test("Super Admin approval of reviewed pending slip removes only the matching billing hold", async () => {
  const env = fixture("2026-10-11", { payments: [{
    id: "payment-test", periodType: "daily",
    periodStart: "2026-10-10", periodEnd: "2026-10-10",
    status: "pending", createdAt: "2026-10-11T08:00:00+07:00",
  }] });
  // A prior suspension can be entered before a user uploads an overdue slip.
  env.tenant.active = false;
  env.tenant.revenueShareSuspended = true;
  env.tenant.revenueShareSuspendedPeriodStart = "2026-10-10";
  env.tenant.revenueShareSuspendedPeriodEnd = "2026-10-10";
  const result = await env.reviewRevenueSharePayment({
    auth: { uid: "reviewer-superadmin" },
    data: { tenantId: "synthetic-tenant", paymentId: "payment-test", action: "approve", note: "Independent review" },
  });
  assert.equal(result.status, "approved");
  assert.equal(env.payments[0].status, "approved");
  assert.equal(env.tenant.revenueShareSuspended, false);
  assert.equal(env.tenant.active, true);
  const again = await env.__reconcileTenant("synthetic-tenant");
  assert.equal(again.action, "none");
});

test("rejected slip does not suspend on its charge date before midnight", async () => {
  const env = fixture("2026-10-10", { payments: [{
    id: "payment-test", periodType: "daily",
    periodStart: "2026-10-10", periodEnd: "2026-10-10",
    status: "pending", createdAt: "2026-10-10T17:00:00+07:00",
  }] });
  await env.reviewRevenueSharePayment({ auth: { uid: "reviewer" },
    data: { tenantId: "synthetic-tenant", paymentId: "payment-test", action: "reject", note: "Amount mismatch" } });
  assert.equal(env.tenant.active, true);
  assert.equal(env.tenant.revenueShareSuspended, undefined);
});

test("Premium-only strict Slip2Go request never calls a real provider in unit tests", async () => {
  const env = fixture();
  const file = { name: "synthetic.png",
    download: async () => [Buffer.from("FAKE-PROOF-NO-BANK")] };
  const result = await env.__inspect(file, "image/png", 75, true);
  assert.equal(result.status, "manual_review");
  assert.equal(env.slipArgs.length, 1);
  assert.equal(env.slipArgs[0][3].providerOverride, "slip2go");
  assert.equal(env.slipArgs[0][3].requireVerifiedReceiver, true);
  assert.equal(env.slipArgs[0][3].allowConfiguredFallback, true);
});
