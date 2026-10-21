import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { auditPaidDeliveryCoverage, resolveHybridStartDate, previewHybridCycle } =
  require("../../functions/hybrid-billing-preview.js");

function paid(amount, iso, overrides = {}) {
  return {
    orderType: "delivery", paymentStatus: "paid", status: "delivered",
    paidAt: { toDate: () => new Date(iso) },
    totalAmount: amount + 40, subtotalAmount: amount, deliveryFee: 40,
    ...overrides,
  };
}
function fakeCollection(rows) {
  // Each query starts independently; cursor retains its own page position.
  return {
    where() { return this; },
    orderBy() { return this; },
    limit(pageSize) {
      const q = { pageSize, offset: 0, where: this.where, orderBy: this.orderBy,
        limit: this.limit,
        startAfter(last) { this.offset = rows.findIndex(r => r.id === last.id) + 1; return this; },
        async get() {
          const docs = rows.slice(this.offset, this.offset + this.pageSize);
          return { docs, size: docs.length };
        },
      };
      return q;
    },
  };
}
const docRows = orders => orders.map((row, i) => ({
  id: "order-" + i, data: () => row,
}));
const onlyOrders = rows => ({
  collection(name) {
    assert.equal(name, "orders");
    return fakeCollection(docRows(rows));
  },
});

test("audit scans paid Delivery, ignores unpaid, and remains read-only", async () => {
  const rows = [paid(100, "2026-10-20T10:00:00Z"),
    paid(500, "2026-10-21T10:00:00Z", { paymentStatus: "pending" })];
  const result = await auditPaidDeliveryCoverage(onlyOrders(rows));
  assert.deepEqual(result, { scanned: 2, paidDeliveryCount: 1, coverageCertified: false });
});
test("audit refuses legacy string paidAt before displaying a potentially incomplete fee", async () => {
  const ref = onlyOrders([paid(100, "2026-10-20T10:00:00Z", {
    paidAt: "2026-10-20T10:00:00Z",
  })]);
  await assert.rejects(auditPaidDeliveryCoverage(ref), /HYBRID_PAID_DELIVERY_NONCANONICAL_TIMESTAMP/);
});
test("audit refuses paid Delivery whose timestamp is missing", async () => {
  await assert.rejects(auditPaidDeliveryCoverage(onlyOrders([paid(50, "2026-10-20T10:00:00Z", { paidAt: null })])),
    /HYBRID_PAID_DELIVERY_NONCANONICAL_TIMESTAMP/);
});
test("audit limit is explicit and fails closed without writing or truncating silently", async () => {
  const ref = onlyOrders([paid(10, "2026-10-20T10:00:00Z"),
    paid(20, "2026-10-20T10:00:00Z")]);
  await assert.rejects(auditPaidDeliveryCoverage(ref, { maxDocs: 1 }),
    /HYBRID_DELIVERY_COVERAGE_SCAN_LIMIT/);
});
test("billing start uses trusted Tenant.createdAt and does not guess from hybridTrialMonth", () => {
  const tenant = { hybridTrialMonth: "2026-10",
    createdAt: { toDate: () => new Date("2026-10-15T17:00:00Z") } };
  assert.equal(resolveHybridStartDate(tenant), "2026-10-16");
  assert.equal(resolveHybridStartDate({ ...tenant, hybridBillingStartDate: "2026-10-18" }),
    "2026-10-18");
  assert.throws(() => resolveHybridStartDate({ hybridTrialMonth: "2026-10" }),
    /HYBRID_BILLING_START_DATE_UNVERIFIED/);
});
test("read-only anniversary preview totals only Delivery from the correct cycle", async () => {
  const rows = [paid(9000, "2026-10-20T10:00:00Z"),
    paid(4000, "2026-11-15T10:00:00Z"),
    paid(7000, "2026-11-16T10:00:00Z", { orderType: "table" })];
  const orders = fakeCollection(docRows(rows));
  const writes = [];
  const tenantRef = {
    id: "isolated-tenant",
    collection(name) {
      if (name === "orders") return orders;
      if (name === "hybridBillingPeriods") return {
        doc(id) {
          assert.equal(id, "2026-10-16");
          return { get: async () => ({ exists: false }),
            set: () => writes.push("set") };
        },
      };
      throw Error("unexpected collection " + name);
    },
  };
  const tenant = {
    createdAt: { toDate: () => new Date("2026-10-15T17:00:00Z") },
    hybridBillingSnapshot: { monthlyFee: 590, deliveryThreshold: 10000,
      deliveryShareRate: 5, monthlySlipQuota: 100 },
  };
  const result = await previewHybridCycle(tenantRef, tenant, "2026-11-15", {});
  assert.equal(result.cycleStart, "2026-10-16");
  assert.equal(result.cycleLastDate, "2026-11-15");
  assert.equal(result.totalDeliverySales, 13000);
  assert.equal(result.totalFee, 200);
  assert.equal(result.invoices[0].calculationBase, 4000);
  assert.equal(result.coverageCertified, false);
  assert.equal(result.canIssueInvoice, false);
  assert.deepEqual(writes, []);
});
test("read-only preview aborts if a paid Delivery has noncanonical paidAt", async () => {
  const ref = {
    id: "legacy-tenant",
    collection(name) {
      if (name !== "orders") throw Error("preview should audit before reading period");
      return fakeCollection(docRows([paid(1000, "2026-10-20T10:00:00Z", {
        paidAt: "2026-10-20T10:00:00Z",
      })]));
    },
  };
  const tenant = { createdAt: { toDate: () => new Date("2026-10-15T17:00:00Z") } };
  await assert.rejects(previewHybridCycle(ref, tenant, "2026-10-20", {}),
    /HYBRID_PAID_DELIVERY_NONCANONICAL_TIMESTAMP/);
});

// The signup anchor is a pure policy decision, not a reason to modify POS,
// cashier writers, payment status or live Tenant records.
const { resolveSignupBillingStartDate } = require("../../functions/hybrid-billing-core.js");
import fs from "node:fs";

test("first request anchors at server Bangkok day, including midnight UTC", () => {
  const now = new Date("2026-10-15T17:15:00Z");
  assert.equal(resolveSignupBillingStartDate(null, now), "2026-10-16");
});
test("request retries preserve signup day regardless of later confirmation date", () => {
  const today = new Date("2026-11-18T10:00:00Z");
  assert.equal(resolveSignupBillingStartDate({ hybridBillingStartDate: "2026-10-16" }, today),
    "2026-10-16");
  const legacy = { createdAt: { toDate: () => new Date("2026-10-15T17:00:01Z") } };
  assert.equal(resolveSignupBillingStartDate(legacy, today), "2026-10-16");
});
test("unverifiable and future signup anchors fail instead of silently regranting free cycle", () => {
  const today = new Date("2026-10-20T10:00:00Z");
  assert.throws(() => resolveSignupBillingStartDate({}, today),
    /HYBRID_PENDING_SIGNUP_START_DATE_UNVERIFIED/);
  assert.throws(() => resolveSignupBillingStartDate({ hybridBillingStartDate: "2026-11-01" }, today),
    /HYBRID_SIGNUP_START_DATE_IN_FUTURE/);
  assert.throws(() => resolveSignupBillingStartDate({ hybridBillingStartDate: "2026-10-35" }, today));
});
test("signup requests and activation propagate one canonical anchor without changing payment writers", () => {
  const source = fs.readFileSync("functions/public-signup.js", "utf8");
  assert.match(source, /tx\.get\(pendingRef\)/);
  assert.match(source, /resolveSignupBillingStartDate\(existingPending, requestedAt\)/);
  assert.match(source, /resolveSignupBillingStartDate\(pending\)/);
  assert.match(source, /hybridBillingStartDate: signupDate/g);
  assert.match(source, /hybridBillingEnabled: false/);
  assert.match(source, /if \(!HYBRID_REGISTRATION_READY\)/);
  assert.doesNotMatch(source, /paidAt:|paymentStatus: "paid"|hybridReceiptJournal/);
});
test("read-only audit disregards POS rows even if test query adapter supplies them", async () => {
  const rows = [paid(100, "2026-10-20T10:00:00Z"),
    paid(5000, "2026-10-20T10:00:00Z", {
      orderType: "pos", paidAt: "bad legacy timestamp",
    })];
  assert.deepEqual(await auditPaidDeliveryCoverage(onlyOrders(rows)),
    { scanned: 2, paidDeliveryCount: 1, coverageCertified: false });
});
