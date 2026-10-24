import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { recordHybridAdjustmentProposal, reviewHybridAdjustmentProposal } =
  require("../../functions/hybrid-billing-finance-records.js");

const tenantId = "demo-shop", invoiceId = "2026-10-22:monthly:fixed";
const adjustmentId = "adjustment_12345678901234";
const invoice = { id: invoiceId, tenantId, version: "hybrid-invoice-v1",
  signature: "f".repeat(64), amount: 590, status: "paid" };
const tenant = { billingPolicyVersion: "hybrid_v1", active: false,
  hybridBillingSuspended: true, subscriptionStatus: "suspended" };
const proposalRequest = { id: adjustmentId, kind: "refund_request", amount: 400,
  reason: "Verified refund request for an incorrectly collected invoice" };

function env() {
  const dbDocs = new Map([
    ["users/super-one", { role: "super_admin", active: true }],
    ["users/super-two", { role: "super_admin", active: true }],
    ["users/store-owner", { role: "owner", tenantId, active: true }],
    ["tenants/" + tenantId, { ...tenant }],
    ["tenants/" + tenantId + "/hybridBillingInvoices/" + invoiceId, { ...invoice }],
  ]);
  const ref = path => ({
    key: path, id: path.split("/").at(-1),
    collection: name => collection(path + "/" + name),
    get: async () => snap(path),
  });
  const collection = path => ({ doc: id => ref(path + "/" + id) });
  const snap = path => ({ exists: dbDocs.has(path), data: () => dbDocs.get(path) });
  const db = {
    collection, runTransaction: async callback => {
      const changes = [];
      const tx = {
        get: async doc => snap(doc.key),
        create: (doc, data) => changes.push(["create", doc.key, data]),
        update: (doc, data) => changes.push(["update", doc.key, data]),
      };
      const response = await callback(tx);
      for (const [method, path] of changes) {
        if (method === "create" && dbDocs.has(path)) throw Error("DUPLICATE_DOC");
        if (method === "update" && !dbDocs.has(path)) throw Error("MISSING_DOC");
      }
      for (const [method, path, data] of changes) dbDocs.set(path,
        method === "create" ? { ...data } : { ...dbDocs.get(path), ...data });
      return response;
    },
  };
  const tenantRef = ref("tenants/" + tenantId);
  const propose = (request = proposalRequest, proposerId = "super-one") =>
    recordHybridAdjustmentProposal({
      db, tenantRef, invoiceId, request, proposerId, serverTimestamp: "TIMESTAMP",
    });
  const review = (action = "approve", reviewerId = "super-two",
    note = "Independent finance review confirms the original transaction") =>
    reviewHybridAdjustmentProposal({
      db, tenantRef, invoiceId, adjustmentId,
      reviewerId, action, note, serverTimestamp: "TIMESTAMP",
    });
  const path = name => "tenants/" + tenantId + "/" + name + "/" + adjustmentId;
  const getInvoice = () => dbDocs.get("tenants/" + tenantId + "/hybridBillingInvoices/" + invoiceId);
  return { dbDocs, propose, review, getInvoice, path };
}

test("private proposal reserves cap atomically but never refunds money or alters paid invoice", async () => {
  const e = env(), before = structuredClone(e.getInvoice());
  const response = await e.propose();
  assert.deepEqual(response, {
    id: adjustmentId, invoiceId, status: "proposed",
    amount: 400, refundExecuted: false, invoiceChanged: false,
  });
  assert.deepEqual(e.getInvoice(), before);
  const reservation = e.dbDocs.get("tenants/" + tenantId
    + "/hybridBillingAdjustmentBalances/" + invoiceId);
  assert.equal(reservation.reservedCents, 40000);
  assert.equal(reservation.invoiceAmountCents, 59000);
  assert.equal(reservation.count, 1);
  const saved = e.dbDocs.get(e.path("hybridBillingAdjustments"));
  assert.equal(saved.status, "proposed");
  assert.equal(saved.externallySettled, false);
  assert.equal(e.dbDocs.get("tenants/" + tenantId).active, false);
});

test("second distinct Super Admin approves once with audit but no bank payout or store unlock", async () => {
  const e = env(); await e.propose();
  const response = await e.review();
  assert.equal(response.status, "approved");
  assert.equal(response.refundExecuted, false);
  assert.equal(e.dbDocs.get(e.path("hybridBillingAdjustments")).status, "approved");
  assert.equal(e.dbDocs.get(e.path("hybridBillingAdjustmentEvents") + "-review").reviewerId, "super-two");
  assert.equal(e.dbDocs.get(e.path("hybridBillingAdjustmentEvents") + "-review").externallySettled, false);
  assert.equal(e.getInvoice().status, "paid");
  assert.equal(e.dbDocs.get("tenants/" + tenantId).hybridBillingSuspended, true);
  await assert.rejects(e.review(), /ALREADY_REVIEWED/);
});

test("same actor and tenant owner cannot approve a finance request", async () => {
  const e = env(); await e.propose();
  await assert.rejects(e.review("approve", "super-one"), /SELF_REVIEW_FORBIDDEN/);
  await assert.rejects(e.review("approve", "store-owner"), /SUPER_ADMIN_REQUIRED/);
  assert.equal(e.dbDocs.get(e.path("hybridBillingAdjustments")).status, "proposed");
});

test("role revocation within transaction blocks financial approval without audit writes", async () => {
  const e = env(); await e.propose();
  const prior = e.dbDocs.get("users/super-two");
  e.dbDocs.set("users/super-two", { ...prior, active: false });
  await assert.rejects(e.review(), /SUPER_ADMIN_REQUIRED/);
  assert.equal(e.dbDocs.has(e.path("hybridBillingAdjustmentEvents") + "-review"), false);
  assert.equal(e.dbDocs.get(e.path("hybridBillingAdjustments")).status, "proposed");
});

test("rejecting releases cap but never deletes immutable proposal and logs decision", async () => {
  const e = env(); await e.propose();
  const out = await e.review("reject", "super-two", "Not supported by bank records");
  assert.equal(out.status, "rejected");
  assert.equal(e.dbDocs.get(e.path("hybridBillingAdjustments")).status, "rejected");
  assert.equal(e.dbDocs.get(e.path("hybridBillingAdjustmentEvents") + "-review").action, "reject");
  const reservation = e.dbDocs.get("tenants/" + tenantId
    + "/hybridBillingAdjustmentBalances/" + invoiceId);
  assert.equal(reservation.reservedCents, 0);
  assert.equal(reservation.count, 1);
  await assert.rejects(e.review("reject"), /ALREADY_REVIEWED/);
});

test("a reserved refund blocks another proposal exceeding original amount", async () => {
  const e = env(); await e.propose();
  await assert.rejects(e.propose({
    id: "adjustment_98765432109876", kind: "refund_request",
    amount: 300, reason: "Independent refund requested on original payment",
  }), /EXCEEDS_INVOICE/);
  const balance = e.dbDocs.get("tenants/" + tenantId
    + "/hybridBillingAdjustmentBalances/" + invoiceId);
  assert.equal(balance.reservedCents, 40000);
});

test("forged invoice/signature/status or corrupted reservation prevents approval", async () => {
  for (const mutation of [
    { signature: "a".repeat(64) }, { status: "issued" }, { id: "forged" },
  ]) {
    const e = env(); await e.propose();
    const path = "tenants/" + tenantId + "/hybridBillingInvoices/" + invoiceId;
    e.dbDocs.set(path, { ...e.getInvoice(), ...mutation });
    await assert.rejects(e.review());
    assert.equal(e.dbDocs.has(e.path("hybridBillingAdjustmentEvents") + "-review"), false);
  }
  const e = env(); await e.propose();
  const path = "tenants/" + tenantId + "/hybridBillingAdjustmentBalances/" + invoiceId;
  e.dbDocs.set(path, { ...e.dbDocs.get(path), reservedCents: -1 });
  await assert.rejects(e.review(), /BALANCE_CORRUPT/);
});

test("client bank destination and other untrusted fields are rejected before any writes", async () => {
  const e = env();
  await assert.rejects(e.propose({
    ...proposalRequest, bankAccount: "1234567890",
  }), /UNTRUSTED_FIELDS/);
  assert.equal(e.dbDocs.has(e.path("hybridBillingAdjustments")), false);
  await assert.rejects(e.review("approve", "super-two", "no"), /NOTE_REQUIRED/);
});

test("only server Admin finance transactions can create or review adjustment records", () => {
  const rules = fs.readFileSync("firestore.rules", "utf8");
  const backend = fs.readFileSync("functions/hybrid-billing-finance-records.js", "utf8");
  const production = fs.readFileSync("functions/index.js", "utf8")
    + fs.readFileSync("functions/bootstrap.js", "utf8");
  for (const name of ["hybridBillingAdjustments",
    "hybridBillingAdjustmentEvents", "hybridBillingAdjustmentBalances"]) {
    assert.match(rules, new RegExp("match /" + name + "/\\\\{"));
    assert.match(rules.slice(rules.indexOf("match /" + name)), /allow create, update, delete: if false;|allow read, write: if false;/);
  }
  assert.doesNotMatch(production, /hybrid-billing-finance-records/);
  assert.doesNotMatch(backend, /onCall\(|onSchedule\(|https\.onRequest|uploadBytes\(/);
  assert.match(backend, /requireReviewer\(actor\)/);
  assert.match(backend, /const newStatus = action === "approve" \? "approved" : "rejected"/);
});
