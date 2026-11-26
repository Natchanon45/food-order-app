"use strict";

// Internal contract for an official provider adapter AFTER signature verification
// and server-side account-to-scope lookup. Not an HTTP/callable endpoint.
// Never pass device notifications or an untrusted request body into this module.
const { createHash } = require("node:crypto");
const hash = values => createHash("sha256").update(JSON.stringify(values)).digest("hex");
const opaqueId = /^[A-Za-z0-9_.:-]{1,128}$/;
const providerId = /^[a-z][a-z0-9_-]{0,31}$/;
const tenantId = /^[A-Za-z0-9_-]{1,128}$/;
const invalid = () => { throw new Error("PROVIDER_RECEIPT_INVALID"); };
function exactFields(value, fields) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === fields.length
    && fields.every(key => Object.hasOwn(value, key));
}
function matches(pattern, value) { return typeof value === "string" && pattern.test(value); }

function normalizeProviderReceipt(binding, event, now = Date.now()) {
  if (!exactFields(binding, ["provider", "connectionId", "scope", "tenantId"])
      || !matches(providerId, binding.provider) || !matches(opaqueId, binding.connectionId)
      || !((binding.scope === "platform" && binding.tenantId === "")
        || (binding.scope === "tenant" && matches(tenantId, binding.tenantId)))) invalid();
  if (!exactFields(event, ["transactionId", "currency", "amountMinor", "occurredAt"])
      || !matches(opaqueId, event.transactionId) || event.currency !== "THB"
      || !Number.isSafeInteger(event.amountMinor) || event.amountMinor <= 0
      || event.amountMinor > 10_000_000_000 || !Number.isFinite(now)
      || !matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, event.occurredAt)) invalid();
  const occurredMs = Date.parse(event.occurredAt);
  if (!Number.isFinite(occurredMs) || new Date(occurredMs).toISOString() !== event.occurredAt
      || occurredMs > now + 300_000) invalid();
  // Connection + transaction, NOT delivery/event ID. Retries share a key.
  // Scope is in the immutable fingerprint, so a changed binding cannot silently
  // reassign an already-recorded transaction to another tenant.
  const id = hash(["provider-receipt-v1", binding.provider, binding.connectionId, event.transactionId]);
  const record = {
    schemaVersion: 1, provider: binding.provider, scope: binding.scope,
    tenantId: binding.tenantId, currency: event.currency, amountMinor: event.amountMinor,
    occurredAt: event.occurredAt, source: "provider", paymentVerified: false,
  };
  const fingerprint = hash([id, record.scope, record.tenantId, record.currency, record.amountMinor, record.occurredAt]);
  return { id, record: { ...record, fingerprint } };
}

// No payment, invoice, credit, order or kitchen state is modified here.
async function recordProviderReceipt(db, binding, event, now = Date.now()) {
  const { id, record } = normalizeProviderReceipt(binding, event, now);
  const ref = db.collection("providerReceiptRecordsV1").doc(id);
  return db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      if (existing.data()?.fingerprint !== record.fingerprint) throw new Error("PROVIDER_RECEIPT_CONFLICT");
      return { id, created: false };
    }
    tx.create(ref, { ...record, recordedAt: new Date(now).toISOString() });
    return { id, created: true };
  });
}

module.exports = { normalizeProviderReceipt, recordProviderReceipt };
