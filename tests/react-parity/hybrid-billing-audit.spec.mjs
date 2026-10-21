import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { auditPaidDeliveryCoverage, resolveHybridStartDate, previewHybridCycle,
  signupStartDateForPreview } =
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

test("read-only audit disregards POS rows even if test query adapter supplies them", async () => {
  const rows = [paid(100, "2026-10-20T10:00:00Z"),
    paid(5000, "2026-10-20T10:00:00Z", {
      orderType: "pos", paidAt: "bad legacy timestamp",
    })];
  assert.deepEqual(await auditPaidDeliveryCoverage(onlyOrders(rows)),
    { scanned: 2, paidDeliveryCount: 1, coverageCertified: false });
});


test("audit uses existing single-field Delivery index and pages by document cursor", async () => {
  const calls = [];
  // 501 rows force the second page (PAGE_LIMIT = 500).
  const rows = docRows(Array.from({ length: 501 }, (_, i) =>
    paid(i + 1, "2026-10-20T10:00:00Z")));
  function query(offset = 0) {
    return {
      where(field, op, value) {
        calls.push(["where", field, op, value]); return this;
      },
      orderBy(field) { calls.push(["orderBy", field]); return this; },
      limit(n) { calls.push(["limit", n]); this.size = n; return this; },
      startAfter(cursor) {
        calls.push(["startAfter", cursor.id]);
        const next = query(rows.findIndex(row => row.id === cursor.id) + 1);
        next.size = this.size;
        return next;
      },
      async get() {
        const docs = rows.slice(offset, offset + this.size);
        return { docs, size: docs.length };
      },
    };
  }
  const ref = { collection(name) { assert.equal(name, "orders"); return query(); } };
  const result = await auditPaidDeliveryCoverage(ref, { maxDocs: 501 });
  assert.equal(result.scanned, 501);
  assert.equal(result.paidDeliveryCount, 501);
  assert.equal(result.coverageCertified, false);
  const whereCalls = calls.filter(c => c[0] === "where");
  assert.ok(whereCalls.length >= 2, "must query again after the 500-record page");
  assert.ok(whereCalls.every(c => JSON.stringify(c) === JSON.stringify([
    "where", "orderType", "==", "delivery",
  ])), "all pages must retain the exact Delivery-only scope");
  assert.ok(calls.some(c => c[0] === "startAfter"));
});
test("more than 3,000 Delivery records can be read under the bounded cap", async () => {
  const n = 3001, today = "2026-10-20T10:00:00Z";
  const ref = onlyOrders(Array.from({ length: n }, () => paid(10, today)));
  const result = await auditPaidDeliveryCoverage(ref);
  assert.equal(result.scanned, n);
  assert.equal(result.paidDeliveryCount, n);
  assert.equal(result.coverageCertified, false);
});
test("more than 10,000 Delivery records still fails closed", async () => {
  const ref = onlyOrders(Array.from({ length: 10001 }, () =>
    paid(10, "2026-10-20T10:00:00Z")));
  await assert.rejects(auditPaidDeliveryCoverage(ref),
    /HYBRID_DELIVERY_COVERAGE_SCAN_LIMIT/);
});


test("read-only preview uses existing first signup request day, not activation day", async () => {
  const pending = { uid: "owner-1", tenantId: "tenant-1", status: "active",
    createdAt: { toDate: () => new Date("2026-10-15T17:00:00Z") } };
  const reads = [];
  const db = { collection(name) {
    assert.equal(name, "publicTenantSignups"); reads.push(name);
    return { doc(uid) {
      assert.equal(uid, "owner-1"); return { get: async () => ({ exists: true, data: () => pending }) };
    } };
  } };
  const tenant = { id: "tenant-1", ownerUid: "owner-1",
    createdAt: { toDate: () => new Date("2026-10-18T17:00:00Z") } };
  assert.equal(await signupStartDateForPreview(db, tenant), "2026-10-16");
  assert.deepEqual(reads, ["publicTenantSignups"]);
});
test("unknown or mismatched signup request falls back to trusted Tenant creation", async () => {
  const tenant = { id: "tenant-1", ownerUid: "owner-1",
    createdAt: { toDate: () => new Date("2026-10-18T17:00:00Z") } };
  const db = { collection() { return { doc() { return {
    get: async () => ({ exists: true, data: () => ({
      uid: "owner-1", tenantId: "another-tenant", status: "active",
    }) }),
  }; } }; } };
  assert.equal(await signupStartDateForPreview(db, tenant), "2026-10-19");
});
test("unverifiable or post-activation signup day must not shift billing cycle", async () => {
  const tenant = { id: "tenant-1", ownerUid: "owner-1",
    createdAt: { toDate: () => new Date("2026-10-18T17:00:00Z") } };
  const read = pending => ({ collection() { return { doc() { return {
    get: async () => ({ exists: true, data: () => ({ uid: "owner-1",
      tenantId: "tenant-1", status: "active", ...pending }) }),
  }; } }; } });
  await assert.rejects(signupStartDateForPreview(read({ createdAt: null }), tenant),
    /HYBRID_SIGNUP_REQUEST_DATE_UNVERIFIED/);
  await assert.rejects(signupStartDateForPreview(read({
    createdAt: { toDate: () => new Date("2026-11-16T17:00:00Z") },
  }), tenant), /HYBRID_SIGNUP_REQUEST_DATE_AFTER_ACTIVATION/);
});
test("existing Cashier and indexes remain independent of new registered Hybrid billing", () => {
  const fs = require("node:fs");
  const cashier = fs.readFileSync("react-app/src/pages/CashierPage.jsx", "utf8");
  const signup = fs.readFileSync("functions/public-signup.js", "utf8");
  const preview = fs.readFileSync("functions/hybrid-billing-preview.js", "utf8");
  assert.match(cashier, /const patch = \{ paymentStatus: "paid", paidAt: now \}/);
  assert.doesNotMatch(cashier, /cashierPaidAt|hybridCashierPaidAt/);
  assert.match(signup, /hybridBillingStartDate: startDate/);
  assert.match(signup, /priorSignup\?\.createdAt \|\| now/);
  assert.match(preview, /signupStartDateForPreview/);
});

test("callable limits period query to the selected Bangkok day (read-only contract)", () => {
  const fs = require("node:fs");
  const source = fs.readFileSync("functions/hybrid-billing-preview.js", "utf8");
  assert.match(source, /const readEnd = selectedDayEnd < end \? selectedDayEnd : end/);
  assert.match(source, /paidOrdersInWindow\(tenantRef, start, readEnd\)/);
  assert.match(source, /throughDate: onDate/);
  assert.match(source, /selectedDate: onDate/);
});
