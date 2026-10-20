import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { submitHybridPaymentEvidence, reviewHybridPaymentEvidence } =
  require("../../functions/hybrid-billing-payments.js");

const invoiceId = "2026-10-16:delivery:trigger";
const tenantId = "tenant-test-123";
const attemptId = "evidence-20261021-A";
const actor = { uid: "tenant-owner", tenantId, role: "owner", active: true };
const reviewer = { uid: "super-adm", role: "super_admin", active: true };
const slipPath = "tenants/" + tenantId + "/hybrid-billing-slips/" + attemptId + "/bank.png";

function makeDb() {
  const store = new Map();
  const ref = path => ({
    path, collection: name => ref(path + "/" + name),
    doc: id => ref(path + "/" + id),
  });
  store.set("tenants/" + tenantId, { billingPolicyVersion: "hybrid_v1", hybridBillingEnabled: true });
  store.set("tenants/" + tenantId + "/hybridBillingInvoices/" + invoiceId, {
    tenantId, invoiceId, policyVersion: "hybrid_v1", amountCents: 77500, currency: "THB",
  });
  const db = { collection: ref, store };
  let lock = Promise.resolve();
  db.runTransaction = callback => {
    const result = lock.then(async () => {
      const writes = [];
      const tx = {
        get: async doc => ({ exists: store.has(doc.path), data: () => store.get(doc.path) }),
        create: (doc, data) => writes.push([doc.path, data]),
      };
      const output = await callback(tx);
      for (const [path, data] of writes) {
        if (store.has(path)) throw Error("DUPLICATE_CREATE");
        store.set(path, data);
      }
      return output;
    });
    lock = result.catch(() => {});
    return result;
  };
  return db;
}
const submit = (db, args = {}) => submitHybridPaymentEvidence({
  db, tenantId, invoiceId, attemptId, slipPath, verifiedStorage: true, actor,
  serverTimestamp: () => "SERVER_TIME", ...args,
});
const review = (db, args = {}) => reviewHybridPaymentEvidence({
  db, tenantId, attemptId, actor: reviewer, decision: "approve",
  bankTxnRef: "BANK-REF-20261021-001", confirmedAmountCents: 77500,
  recipientConfirmed: true, serverTimestamp: () => "SERVER_TIME", ...args,
});
const paid = db => db.store.get("tenants/" + tenantId + "/hybridBillingSettlements/" + invoiceId);

test("photo submission alone does not create settlement or release tenant", async () => {
  const db = makeDb();
  assert.equal((await submit(db)).status, "pending_review");
  assert.equal(paid(db), undefined);
  assert.equal(db.store.get("tenants/" + tenantId).hybridBillingEnabled, true);
  assert.equal((await submit(db)).alreadySubmitted, true);
  assert.equal(db.store.size, 3);
});

test("only authenticated owner/admin of same tenant submits verified Storage evidence", async () => {
  const db = makeDb();
  await assert.rejects(submit(db, { verifiedStorage: false }), /HYBRID_EVIDENCE_INVALID/);
  await assert.rejects(submit(db, { actor: { uid: "x", tenantId: "other", role: "owner" } }), /HYBRID_OWNER_REQUIRED/);
  await assert.rejects(submit(db, { actor: { uid: "x", tenantId, role: "cashier" } }), /HYBRID_OWNER_REQUIRED/);
  await assert.rejects(submit(db, { slipPath: "tenants/another/slip.jpg" }), /HYBRID_EVIDENCE_INVALID/);
  assert.equal(db.store.size, 2);
});

test("Super Admin independently reconciles exact amount and recipient before settlement", async () => {
  const db = makeDb();
  await submit(db);
  await assert.rejects(review(db, { actor }), /HYBRID_SUPER_ADMIN_REQUIRED/);
  await assert.rejects(review(db, { confirmedAmountCents: 77499 }), /HYBRID_PAYMENT_AMOUNT_MISMATCH/);
  await assert.rejects(review(db, { recipientConfirmed: false }), /HYBRID_BANK_RECONCILIATION_REQUIRED/);
  assert.equal(paid(db), undefined);
  const out = await review(db);
  assert.equal(out.decision, "approve");
  assert.equal(paid(db).amountCents, 77500);
  assert.equal(paid(db).source, "manual_bank_reconciled");
  assert.ok(!Object.hasOwn(paid(db), "bankTxnRef"));
  assert.equal((await review(db)).alreadyReviewed, true);
  assert.equal([...db.store.keys()].filter(x => x.includes("/hybridBillingSettlements/")).length, 1);
});

test("same transfer reference cannot pay a second invoice or another tenant", async () => {
  const db = makeDb();
  await submit(db); await review(db);
  const otherInvoice = "2026-10-16:delivery:2026-10-22";
  db.store.set("tenants/" + tenantId + "/hybridBillingInvoices/" + otherInvoice, {
    tenantId, invoiceId: otherInvoice, policyVersion: "hybrid_v1", amountCents: 77500, currency: "THB",
  });
  const secondAttempt = "evidence-20261022-B";
  await submit(db, { invoiceId: otherInvoice, attemptId: secondAttempt,
    slipPath: "tenants/" + tenantId + "/hybrid-billing-slips/" + secondAttempt + "/transfer.jpg" });
  await assert.rejects(review(db, { attemptId: secondAttempt }), /HYBRID_DUPLICATE_BANK_REFERENCE/);
  assert.equal(db.store.has("tenants/" + tenantId + "/hybridBillingSettlements/" + otherInvoice), false);
});

test("reject is final and cannot be converted to approval without new evidence", async () => {
  const db = makeDb();
  await submit(db);
  const rejected = await review(db, { decision: "reject", bankTxnRef: "",
    confirmedAmountCents: undefined, recipientConfirmed: false, verificationNote: "Mismatch" });
  assert.equal(rejected.decision, "reject");
  assert.equal(paid(db), undefined);
  await assert.rejects(review(db), /HYBRID_REVIEW_FINAL_DECISION_CONFLICT/);
  assert.equal(paid(db), undefined);
});

test("manual reviewer ID is not accepted from the slip alone, payment services remain unexposed", () => {
  const index = fs.readFileSync("functions/index.js", "utf8");
  assert.doesNotMatch(index, /submitHybridPaymentEvidence|reviewHybridPaymentEvidence/);
  assert.match(fs.readFileSync("functions/hybrid-billing-settings.js", "utf8"),
    /HYBRID_REGISTRATION_READY = false/);
});

test("anniversary invoice IDs are accepted and impossible/legacy month IDs fail closed", async () => {
  const db = makeDb();
  for (const bad of ["2026-10:delivery:trigger", "2026-02-31:delivery:trigger",
    "2026-10-16:delivery:2026-02-31", "2026-10-16:delivery:2026-11-34"]) {
    await assert.rejects(submit(db, { invoiceId: bad }), /HYBRID_EVIDENCE_INVALID/);
  }
  assert.equal((await submit(db)).status, "pending_review");
  assert.equal(db.store.get("tenants/" + tenantId + "/hybridBillingInvoices/" + invoiceId).amountCents, 77500);
});
