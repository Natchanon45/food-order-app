import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { paidOrdersInWindow } = require("../../functions/hybrid-billing-preview.js");

function queryFixture(count, { brokenPage = false } = {}) {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: "paid-" + String(i).padStart(5, "0"),
    data: () => ({ orderType: "delivery", subtotalAmount: i + 1 }),
  }));
  const audit = { transactionReads: 0, outsideReads: 0, pages: [] };
  const tenantRef = {
    collection(name) {
      assert.equal(name, "orders");
      let size = 0, start = 0;
      const query = {
        where(field, op) {
          assert.equal(field, "paidAt");
          assert.ok(op === ">=" || op === "<");
          return query;
        },
        orderBy(field) {
          assert.equal(field, "paidAt");
          return query;
        },
        limit(value) { size = value; return query; },
        startAfter(doc) { start = rows.findIndex(row => row.id === doc.id) + 1; return query; },
        _snapshot() {
          audit.pages.push({ start, size });
          const docs = rows.slice(start, start + size);
          return { docs: brokenPage ? docs.slice(0, Math.max(0, docs.length - 1)) : docs,
            size: docs.length };
        },
        get() { audit.outsideReads++; return Promise.resolve(query._snapshot()); },
      };
      return query;
    },
  };
  const transaction = {
    get(query) {
      audit.transactionReads++;
      return Promise.resolve(query._snapshot());
    },
  };
  return { tenantRef, transaction, audit };
}
const start = new Date("2026-10-16T00:00:00+07:00");
const end = new Date("2026-11-16T00:00:00+07:00");

test("invoice reads 520 paid orders through Transaction.get(query), paginated inside transaction", async () => {
  const { tenantRef, transaction, audit } = queryFixture(520);
  const result = await paidOrdersInWindow(tenantRef, start, end, {
    includeIds: true, transaction, maxRecords: 520,
  });
  assert.equal(result.length, 520);
  assert.equal(result[0].id, "paid-00000");
  assert.equal(result.at(-1).id, "paid-00519");
  assert.equal(result[0].data.subtotalAmount, 1);
  assert.deepEqual(audit.pages, [{ start: 0, size: 500 }, { start: 500, size: 21 }]);
  assert.equal(audit.transactionReads, 2);
  assert.equal(audit.outsideReads, 0);
});

test("read-only preview keeps normal querying and original plain-order return shape", async () => {
  const { tenantRef, audit } = queryFixture(2);
  const result = await paidOrdersInWindow(tenantRef, start, end);
  assert.deepEqual(result, [
    { orderType: "delivery", subtotalAmount: 1 },
    { orderType: "delivery", subtotalAmount: 2 },
  ]);
  assert.equal(audit.outsideReads, 1);
  assert.equal(audit.transactionReads, 0);
});

test("limit+1 detection fails closed rather than issuing from incomplete source scan", async () => {
  const { tenantRef, transaction, audit } = queryFixture(3);
  await assert.rejects(
    paidOrdersInWindow(tenantRef, start, end, { transaction, maxRecords: 2 }),
    /resource-exhausted|safe limit/i,
  );
  assert.deepEqual(audit.pages, [{ start: 0, size: 3 }]);
});

test("malformed partial Firestore query page fails closed before invoices", async () => {
  const { tenantRef, transaction } = queryFixture(2, { brokenPage: true });
  await assert.rejects(paidOrdersInWindow(tenantRef, start, end, {
    transaction, maxRecords: 2,
  }), /HYBRID_PAID_ORDER_SCAN_INCOMPLETE/);
});

test("bad input windows and malformed transaction readers are rejected", async () => {
  const { tenantRef } = queryFixture(1);
  await assert.rejects(paidOrdersInWindow(tenantRef, end, start), /HYBRID_INVALID_PAID_ORDER_WINDOW/);
  await assert.rejects(paidOrdersInWindow(tenantRef, start, end, {
    transaction: {}, maxRecords: 10,
  }), /HYBRID_TRANSACTION_READ_REQUIRED/);
});
