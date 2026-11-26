import { test } from "node:test";
import assert from "node:assert/strict";
import contract from "../../functions/provider-receipt-contract.js";
const { normalizeProviderReceipt: normalize, recordProviderReceipt: record } = contract;
const now = Date.parse("2026-11-26T02:00:00.000Z");
const binding = { provider: "example", connectionId: "test-connection", scope: "tenant", tenantId: "shop-a" };
const event = { transactionId: "test-transaction", currency: "THB", amountMinor: 9900, occurredAt: "2026-11-26T01:59:00.000Z" };
function fakeDb() {
  const docs = new Map();
  return { docs, collection(name) { assert.equal(name, "providerReceiptRecordsV1"); return { doc(id) { return id; } }; },
    async runTransaction(fn) { return fn({ async get(id) { return { exists: docs.has(id), data: () => docs.get(id) }; },
      create(id, value) { assert.equal(docs.has(id), false); docs.set(id, value); } }); } };
}
test("canonical receipt contains no external transaction or connection identifier", () => {
  const { id, record: value } = normalize(binding, event, now);
  assert.match(id, /^[a-f0-9]{64}$/);
  assert.equal(value.amountMinor, 9900);
  assert.equal(value.paymentVerified, false);
  assert.equal(value.tenantId, "shop-a");
  assert.equal(JSON.stringify(value).includes(event.transactionId), false);
  assert.equal(JSON.stringify(value).includes(binding.connectionId), false);
});
test("rejects unexpected fields, invalid amounts, currency, dates and scope", () => {
  for (const patch of [{ note: "extra" }, { tenantId: "shop-b" }, { amountMinor: 0 }, { amountMinor: 99.9 }, { currency: "USD" },
    { occurredAt: "2026-02-30T01:59:00.000Z" }, { occurredAt: "2026-11-26T02:10:00.000Z" }]) {
    assert.throws(() => normalize(binding, { ...event, ...patch }, now), /PROVIDER_RECEIPT_INVALID/);
  }
  assert.throws(() => normalize({ ...binding, scope: "platform" }, event, now), /PROVIDER_RECEIPT_INVALID/);
  assert.throws(() => normalize({ ...binding, tenantId: "" }, event, now), /PROVIDER_RECEIPT_INVALID/);
});
test("platform and tenant bindings are explicit and connection keys are distinct", () => {
  const central = normalize({ ...binding, connectionId: "central", scope: "platform", tenantId: "" }, event, now);
  assert.equal(central.record.scope, "platform");
  assert.equal(central.record.tenantId, "");
  assert.notEqual(central.id, normalize(binding, event, now).id);
});
test("transaction replay is a no-op; changed amount or tenant conflicts", async () => {
  const db = fakeDb();
  const first = await record(db, binding, event, now);
  assert.equal(first.created, true);
  assert.deepEqual(await record(db, binding, event, now + 1000), { id: first.id, created: false });
  await assert.rejects(record(db, binding, { ...event, amountMinor: 10000 }, now), /PROVIDER_RECEIPT_CONFLICT/);
  await assert.rejects(record(db, { ...binding, tenantId: "shop-b" }, event, now), /PROVIDER_RECEIPT_CONFLICT/);
  assert.equal(db.docs.size, 1);
  assert.equal(db.docs.get(first.id).recordedAt, new Date(now).toISOString());
});
