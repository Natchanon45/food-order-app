import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { recordDemoHybridRefundCandidate,
  HYBRID_REFUND_CANDIDATE_PRODUCTION_READY } =
  require("../../functions/hybrid-billing-refund-candidate.js");

const tenantId = "demo-shop", invoiceId = "2026-10-24:monthly:fixed";
const adjustmentId = "adjustment_12345678901234";
const at = "2026-10-24T10:00:00Z";
const hash = "a".repeat(64), destination = "b".repeat(64);
const instructionHash = createHash("sha256")
  .update("hybrid-refund-instruction-v1:outgoing_20261024_123456")
  .digest("hex");
const invoice = { id: invoiceId, tenantId, amount: 590, status: "paid",
  version: "hybrid-invoice-v1", signature: "f".repeat(64) };
const adjustment = { id: adjustmentId, tenantId, invoiceId,
  invoiceSignature: invoice.signature, kind: "refund_request", status: "approved",
  amount: 250, amountCents: 25000, proposedBy: "super-first",
  reviewedBy: "super-second", externallySettled: false };
const approval = { tenantId, invoiceId, adjustmentId,
  invoiceSignature: invoice.signature, action: "approve", resultStatus: "approved",
  reviewerId: "super-second", externallySettled: false };
const disbursement = { tenantId, invoiceId, adjustmentId,
  source: "trusted_finance_disbursement", state: "submitted",
  currency: "THB", amountCents: 25000, instructionId: "outgoing_20261024_123456",
  bankReferenceHash: hash, destinationFingerprint: destination,
  submittedAt: "2026-10-24T09:00:00Z" };
const bankStatement = { tenantId, invoiceId, adjustmentId,
  source: "trusted_bank_statement", direction: "debit",
  postingStatus: "posted", currency: "THB", amountCents: 25000,
  bankReferenceHash: hash, destinationFingerprint: destination,
  postedAt: "2026-10-24T09:30:00Z" };

function fixture({ projectId = "demo-penguin-hybrid", host = "127.0.0.1:8080" } = {}) {
  const store = new Map([
    ["users/super-third", { role: "super_admin", active: true }],
    ["users/super-second", { role: "super_admin", active: true }],
    ["users/store-owner", { role: "owner", tenantId, active: true }],
    ["tenants/" + tenantId, { billingPolicyVersion: "hybrid_v1",
      active: false, hybridBillingSuspended: true }],
    ["tenants/" + tenantId + "/hybridBillingInvoices/" + invoiceId, invoice],
    ["tenants/" + tenantId + "/hybridBillingAdjustments/" + adjustmentId, adjustment],
    ["tenants/" + tenantId + "/hybridBillingAdjustmentEvents/" + adjustmentId + "-review",
      approval],
  ]);
  const ref = path => ({ path, id: path.split("/").at(-1),
    collection: name => ({ doc: id => ref(path + "/" + name + "/" + id) }) });
  const db = { app: { options: { projectId } }, collection: name => ({
    doc: id => ref(name + "/" + id),
  }), runTransaction: async callback => {
    const updates = [];
    const tx = {
      get: async r => ({ exists: store.has(r.path), id: r.id,
        data: () => store.get(r.path) }),
      create: (r, value) => updates.push([r.path, value]),
    };
    const result = await callback(tx);
    for (const [path] of updates) if (store.has(path)) throw Error("DUPLICATE");
    for (const [path, value] of updates) store.set(path, value);
    return result;
  } };
  const tenantRef = ref("tenants/" + tenantId);
  const payload = { db, tenantRef, invoiceId, adjustmentId,
    actorUid: "super-third", disbursement, bankStatement, at,
    serverTimestamp: "SERVER_TIMESTAMP" };
  const priorEnv = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = host;
  return { store, payload, restore: () => {
    if (priorEnv === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = priorEnv;
  } };
}
async function scenario(callback, options) {
  const f = fixture(options);
  try { return await callback(f); } finally { f.restore(); }
}

test("one synthetic candidate atomically claims global bank hash, not cash settlement", async () =>
  scenario(async ({ store, payload }) => {
    const result = await recordDemoHybridRefundCandidate(payload);
    assert.equal(result.state, "awaiting_independent_bank_attestation");
    assert.equal(result.settlementConfirmed, false);
    assert.equal(result.refundExecuted, false);
    assert.equal(result.bankSourceIntegrationReady, false);
    const claim = store.get("hybridRefundReferenceClaims/" + hash);
    const instructionClaim = store.get("hybridRefundInstructionClaims/" + instructionHash);
    assert.equal(instructionClaim.adjustmentId, adjustmentId);
    const candidate = store.get("tenants/" + tenantId +
      "/hybridBillingRefundCandidates/" + adjustmentId);
    assert.equal(claim.adjustmentId, adjustmentId);
    assert.equal(candidate.settlementConfirmed, false);
    assert.equal(candidate.sourceIntegrationReady, false);
    assert.equal(candidate.bankReferenceHash, hash);
    assert.equal(candidate.instructionHash, instructionHash);
    assert.equal(Object.hasOwn(candidate, "instructionId"), false,
      "Raw outgoing instruction must not be stored in browseable records");
    assert.equal(store.get("tenants/" + tenantId +
      "/hybridBillingInvoices/" + invoiceId).status, "paid");
    assert.equal(store.get("tenants/" + tenantId).hybridBillingSuspended, true);
    for (const hidden of ["bankAccount", "rawBankReference", "rawStatement",
      "customerSlip", "payoutReceipt"]) {
      assert.equal(Object.hasOwn(candidate, hidden), false);
    }
  }));

test("same adjustment and global hash are immutable; replays write no extra records", async () =>
  scenario(async ({ store, payload }) => {
    await recordDemoHybridRefundCandidate(payload);
    await assert.rejects(recordDemoHybridRefundCandidate(payload), /ALREADY_EXISTS|ALREADY_CLAIMED/);
    assert.equal([...store.keys()].filter(k => k.startsWith("hybridRefundReferenceClaims/")).length, 1);
  }));

test("global hash cannot be reused for a different adjustment or tenant", async () =>
  scenario(async ({ store, payload }) => {
    await recordDemoHybridRefundCandidate(payload);
    const otherId = "adjustment_98765432109876";
    const other = { ...adjustment, id: otherId };
    const otherApproval = { ...approval, adjustmentId: otherId };
    store.set("tenants/" + tenantId + "/hybridBillingAdjustments/" + otherId, other);
    store.set("tenants/" + tenantId + "/hybridBillingAdjustmentEvents/" + otherId + "-review",
      otherApproval);
    await assert.rejects(recordDemoHybridRefundCandidate({
      ...payload, adjustmentId: otherId,
      disbursement: { ...disbursement, adjustmentId: otherId },
      bankStatement: { ...bankStatement, adjustmentId: otherId },
    }), /BANK_REFERENCE_ALREADY_CLAIMED/);
  }));

test("invalid project or nonlocal emulator host denies before any transaction", async () => {
  for (const opts of [{ projectId: "production-store" },
    { host: "remote-firestore:8080" }, { host: "" }]) {
    await scenario(async ({ store, payload }) => {
      await assert.rejects(recordDemoHybridRefundCandidate(payload), /DEMO_EMULATOR_ONLY/);
      assert.equal(store.has("hybridRefundReferenceClaims/" + hash), false);
    }, opts);
  }
  assert.equal(HYBRID_REFUND_CANDIDATE_PRODUCTION_READY, false);
});

test("revoked, demoted or nonfinance actor cannot attest candidate", async () =>
  scenario(async ({ store, payload }) => {
    for (const actor of ["super-first", "super-second", "store-owner"]) {
      await assert.rejects(recordDemoHybridRefundCandidate({
        ...payload, actorUid: actor,
      }), /SUPER_ADMIN_REQUIRED|SAME_ACTOR_ATTESTATION_FORBIDDEN/);
    }
    store.set("users/super-third", { role: "super_admin", active: false });
    await assert.rejects(recordDemoHybridRefundCandidate(payload), /SUPER_ADMIN_REQUIRED/);
    assert.equal(store.has("hybridRefundReferenceClaims/" + hash), false);
  }));

test("an independent Super Admin cannot bypass three-person review", async () =>
  scenario(async ({ store, payload }) => {
    store.set("users/super-first", { role: "super_admin", active: true });
    await assert.rejects(recordDemoHybridRefundCandidate({
      ...payload, actorUid: "super-first",
    }), /SAME_ACTOR_ATTESTATION_FORBIDDEN/);
    await assert.rejects(recordDemoHybridRefundCandidate({
      ...payload, actorUid: "super-second",
    }), /SAME_ACTOR_ATTESTATION_FORBIDDEN/);
  }));

test("forged bank source, tampered invoice or review rejects without global claim", async () =>
  scenario(async ({ store, payload }) => {
    for (const [part, change] of [
      ["disbursement", { currency: "USD" }],
      ["bankStatement", { postingStatus: "pending" }],
      ["bankStatement", { destinationFingerprint: "c".repeat(64) }],
      ["bankStatement", { amountCents: 24900 }],
      ["disbursement", { extraSettlementApproved: true }],
      ["bankStatement", { rawAccountNumber: "1234567890" }],
    ]) {
      await assert.rejects(recordDemoHybridRefundCandidate({
        ...payload, [part]: { ...payload[part], ...change },
      }));
      assert.equal(store.has("hybridRefundReferenceClaims/" + hash), false);
    }
    const invoicePath = "tenants/" + tenantId + "/hybridBillingInvoices/" + invoiceId;
    store.set(invoicePath, { ...invoice, status: "issued" });
    await assert.rejects(recordDemoHybridRefundCandidate(payload), /PAID_INVOICE_REQUIRED/);
  }));

test("Browser finance rules deny claims and writes; production exports are unchanged", () => {
  const rules = fs.readFileSync("firestore.rules", "utf8");
  const source = fs.readFileSync("functions/hybrid-billing-refund-candidate.js", "utf8");
  const prod = fs.readFileSync("functions/index.js", "utf8")
    + fs.readFileSync("functions/bootstrap.js", "utf8");
  assert.match(rules, /match \/hybridRefundReferenceClaims\/\{referenceHash\}/);
  assert.match(rules, /match \/hybridRefundInstructionClaims\/\{instructionHash\}/);
  assert.match(rules, /match \/hybridBillingRefundCandidates\/\{adjustmentId\}/);
  assert.match(rules, /allow read, write: if false/);
  assert.match(source, /HYBRID_REFUND_CANDIDATE_PRODUCTION_READY = false/);
  assert.doesNotMatch(prod, /hybrid-billing-refund-candidate/);
  assert.doesNotMatch(source, /onCall\(|https\.onRequest|onSchedule\(|uploadBytes\(/);
});


test("same outgoing instruction cannot be reused even with another bank hash", async () =>
  scenario(async ({ store, payload }) => {
    await recordDemoHybridRefundCandidate(payload);
    const otherId = "adjustment_98765432109876";
    store.set("tenants/" + tenantId + "/hybridBillingAdjustments/" + otherId,
      { ...adjustment, id: otherId });
    store.set("tenants/" + tenantId + "/hybridBillingAdjustmentEvents/" + otherId + "-review",
      { ...approval, adjustmentId: otherId });
    const alternateHash = "c".repeat(64);
    await assert.rejects(recordDemoHybridRefundCandidate({
      ...payload, adjustmentId: otherId,
      disbursement: { ...disbursement, adjustmentId: otherId,
        bankReferenceHash: alternateHash },
      bankStatement: { ...bankStatement, adjustmentId: otherId,
        bankReferenceHash: alternateHash },
    }), /INSTRUCTION_ALREADY_CLAIMED/);
    assert.equal(store.has("hybridRefundReferenceClaims/" + alternateHash), false);
    assert.equal(store.has("hybridRefundInstructionClaims/" + instructionHash), true);
  }));


test("reverse replay guard: refund candidate cannot reuse ANY existing bank batch claim", async () =>
  scenario(async ({ store, payload }) => {
    const scopeHash = createHash("sha256")
      .update("PENGUIN-HYBRID-BANK-ADJUSTMENT-CLAIM-V1\n"
        + JSON.stringify([tenantId, adjustmentId]), "utf8").digest("hex");
    const paths = [
      "hybridBankBatchReferenceClaims/" + hash,
      "hybridBankBatchInstructionClaims/" + instructionHash,
      "hybridBankBatchAdjustmentClaims/" + scopeHash,
    ];
    for (const path of paths) {
      store.set(path, { state: "synthetic_untrusted_reservation" });
      await assert.rejects(recordDemoHybridRefundCandidate(payload),
        /HYBRID_REFUND_BANK_BATCH_ALREADY_RESERVED/);
      assert.equal(store.has("hybridRefundReferenceClaims/" + hash), false);
      assert.equal(store.has("hybridRefundInstructionClaims/" + instructionHash), false);
      assert.equal(store.has("tenants/" + tenantId +
        "/hybridBillingRefundCandidates/" + adjustmentId), false);
      store.delete(path);
    }
    const result = await recordDemoHybridRefundCandidate(payload);
    assert.equal(result.settlementConfirmed, false);
    assert.equal(result.refundExecuted, false);
  }));
