import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  satang, validInvoiceId, validateEvidencePath, validateEvidenceMetadata,
  fingerprintClaims, evaluateSlipVerification,
} = require("../../functions/hybrid-billing-payment-policy.js");
const {
  prepareHybridInvoiceProof, stageHybridInvoiceProof, reviewHybridInvoiceProof,
} = require("../../functions/hybrid-billing-payment.js");
const { LEDGER_VERSION } = require("../../functions/hybrid-billing-ledger.js");

const invoiceId = "2026-10-22:delivery:trigger";
const attemptId = "attempt_1234567890123456";
const body = Buffer.from("test fixture bank slip PNG bytes");
const fakeStamp = "SERVER_CLOCK";
const paidBank = () => ({
  provider: "slip2go", code: "200200", status: "matched",
  amountMatched: true, detectedAmount: 500,
  referenceId: "bank-ref-a", transRef: "bank-trans-a",
});
const invoice = (overrides = {}) => ({
  id: invoiceId, amount: 500, status: "issued",
  signature: "a".repeat(64), version: LEDGER_VERSION, ...overrides,
});

function memory() {
  const store = new Map([
    ["users/superadmin_1234", { role: "super_admin", tenantId: "", active: true }],
  ]);
  const doc = key => ({
    key, id: key.slice(key.lastIndexOf("/") + 1),
    get: async () => ({
      exists: store.has(key),
      data: () => store.get(key),
    }),
  });
  const tenant = id => ({
    id, collection: coll => ({
      doc: id2 => doc("tenants/" + id + "/" + coll + "/" + id2),
    }),
  });
  const env = {
    store,
    tenant,
    db: {
      collection: coll => ({ doc: id => doc(coll + "/" + id) }),
      async runTransaction(handler) {
        const changes = [];
        const tx = {
          get: async ref => ({
            exists: store.has(ref.key),
            data: () => store.get(ref.key),
          }),
          create(ref, value) { changes.push({ op: "create", ref, value }); },
          update(ref, value) { changes.push({ op: "update", ref, value }); },
        };
        const result = await handler(tx);
        for (const change of changes) {
          if (change.op === "create" && store.has(change.ref.key)) throw Error("ALREADY_EXISTS");
          if (change.op === "update" && !store.has(change.ref.key)) throw Error("NOT_FOUND");
        }
        for (const change of changes) store.set(change.ref.key,
          change.op === "create" ? change.value :
            { ...store.get(change.ref.key), ...change.value });
        return result;
      },
    },
    slipPath: (id = "tenant-1", attempt = attemptId) =>
      "tenants/" + id + "/hybrid-billing-slips/"
      + invoiceId + "/" + attempt + "/slip.png",
    async prepare({ tenantId = "tenant-1", attempt = attemptId,
      verification = paidBank(), data = body } = {}) {
      const tenantRef = tenant(tenantId);
      if (!store.has("tenants/" + tenantId + "/hybridBillingInvoices/" + invoiceId)) {
        store.set("tenants/" + tenantId + "/hybridBillingInvoices/" + invoiceId, invoice());
      }
      const path = env.slipPath(tenantId, attempt);
      const bucket = {
        file: requested => {
          assert.equal(requested, path);
          return {
            exists: async () => [true],
            getMetadata: async () => [{
              size: data.length, contentType: "image/png",
            }],
            download: async () => [data],
          };
        },
      };
      return prepareHybridInvoiceProof({
        tenantRef, invoiceId, attemptId: attempt, slipPath: path, bucket,
        inspectSlip: async (buffer, mime, fileName, amount, options) => {
          assert.equal(buffer.toString(), data.toString());
          assert.equal(amount, 500);
          assert.equal(mime, "image/png");
          assert.equal(fileName, "slip.png");
          assert.equal(options.providerOverride, "slip2go");
          return verification;
        },
      });
    },
    submit: (tenantId, prepared) => stageHybridInvoiceProof({
    requireUploadGrant: false, // Isolated legacy stage fixture; trusted service requires grants.
      db: env.db, tenantRef: tenant(tenantId), prepared,
      actorId: "owner_1234", serverTimestamp: fakeStamp,
    }),
    review: (tenantId, attempt, action, more = {}) => reviewHybridInvoiceProof({
      db: env.db, tenantRef: tenant(tenantId), invoiceId,
      attemptId: attempt, action, reviewerId: "superadmin_1234",
      serverTimestamp: fakeStamp, ...more,
    }),
    getInvoice: (tenantId = "tenant-1") =>
      store.get("tenants/" + tenantId + "/hybridBillingInvoices/" + invoiceId),
    getPayment: (tenantId = "tenant-1", attempt = attemptId) =>
      store.get("tenants/" + tenantId + "/hybridBillingPaymentAttempts/" + attempt),
    countClaims: () => [...store.keys()].filter(k => k.startsWith("hybridBillingSlipReferences/")).length,
  };
  return env;
}

test("exact satang and invoice-bound storage paths reject forged or cross-tenant inputs", () => {
  assert.equal(satang(500), 50000);
  for (const v of [0, -1, "NaN", 1.123, "", null, Infinity]) {
    assert.throws(() => satang(v));
  }
  assert.equal(validInvoiceId(invoiceId), invoiceId);
  assert.throws(() => validInvoiceId("../2026-invoice"));
  assert.throws(() => validateEvidencePath({
    tenantId: "tenant-1", invoiceId, attemptId,
    path: "tenants/tenant-2/hybrid-billing-slips/" + invoiceId + "/" + attemptId + "/slip.png",
  }));
  assert.throws(() => validateEvidenceMetadata({ size: 0, contentType: "image/png" }));
  assert.throws(() => validateEvidenceMetadata({ size: 1, contentType: "text/html" }));
});

test("only genuine Slip2Go code 200200 plus exact amount and reference earns bankVerified", () => {
  assert.equal(evaluateSlipVerification(paidBank(), 500).bankVerified, true);
  for (const verification of [
    { ...paidBank(), code: "200000" },
    { ...paidBank(), provider: "slip2go_fallback_vision" },
    { ...paidBank(), provider: "google_vision" },
    { ...paidBank(), referenceId: "", transRef: "" },
    { ...paidBank(), amountMatched: false },
  ]) assert.equal(evaluateSlipVerification(verification, 500).bankVerified, false);
  for (const status of ["duplicate", "invalid", "mismatch", "receiver_mismatch", "config_required"]) {
    assert.throws(() => evaluateSlipVerification({ ...paidBank(), status }, 500));
  }
  assert.throws(() => evaluateSlipVerification({ ...paidBank(), detectedAmount: 499 }, 500),
    /AMOUNT_MISMATCH/);
});

test("bank verification only stages pending_review, never marks invoice as paid", async () => {
  const env = memory(), prepared = await env.prepare();
  assert.equal(prepared.verification.bankVerified, true);
  const result = await env.submit("tenant-1", prepared);
  assert.equal(result.status, "pending_review");
  assert.equal(env.getInvoice().status, "pending_review");
  assert.equal(env.getPayment().status, "pending_review");
  assert.equal(env.countClaims(), 3);
  assert.equal(env.getPayment().verification.bankVerified, true);
  assert.equal(env.getPayment().verification.textExcerpt, undefined);
});

test("manual finance approval atomically settles one exact invoice without unlocking a store", async () => {
  const env = memory();
  await env.submit("tenant-1", await env.prepare());
  const result = await env.review("tenant-1", attemptId, "approve");
  assert.equal(result.status, "paid");
  assert.equal(env.getInvoice().status, "paid");
  assert.equal(env.getInvoice().paidAttemptId, attemptId);
  assert.equal(env.getPayment().status, "paid");
  assert.equal(env.getInvoice().active, undefined);
  assert.equal(env.getInvoice().subscriptionStatus, undefined);
  await assert.rejects(env.review("tenant-1", attemptId, "approve"), /ALREADY_REVIEWED/);
  await assert.rejects(
    env.prepare({ attempt: "attempt_1234567890999999" }),
    /ALREADY_PENDING_OR_PAID/,
  );
});

test("duplicate slip bytes or repeated bank reference cannot pay another store", async () => {
  const env = memory();
  await env.submit("tenant-1", await env.prepare());
  const duplicate = await env.prepare({ tenantId: "tenant-2",
    attempt: "attempt_1234567890999999",
    verification: { ...paidBank(), transRef: "different-ref" },
  });
  await assert.rejects(env.submit("tenant-2", duplicate),
    /DUPLICATE_SLIP_OR_BANK_REFERENCE|FINANCE_SLIP_ALREADY_CLAIMED/);
  assert.equal(env.getInvoice("tenant-2").status, "issued");
  assert.equal(env.getPayment("tenant-2", "attempt_1234567890999999"), undefined);
});

test("manual OCR/Slip2Go fallback remains pending and needs documented external verification", async () => {
  const env = memory(), proof = await env.prepare({
    verification: {
      provider: "slip2go_fallback_vision", status: "manual_review",
      reason: "bank_unavailable", detectedAmount: 500,
    },
  });
  assert.equal(proof.verification.bankVerified, false);
  await env.submit("tenant-1", proof);
  await assert.rejects(env.review("tenant-1", attemptId, "approve"),
    /EXTERNAL_CONFIRMATION_REQUIRED/);
  await assert.rejects(env.review("tenant-1", attemptId, "approve", {
    verifiedExternally: true, note: "yes",
  }), /EXTERNAL_CONFIRMATION_REQUIRED/);
  const reviewed = await env.review("tenant-1", attemptId, "approve", {
    verifiedExternally: true,
    note: "Confirmed matching incoming bank transfer using official bank records",
  });
  assert.equal(reviewed.status, "paid");
});

test("rejected proof permits a new attempt, but permanently blocks reusing old evidence", async () => {
  const env = memory();
  await env.submit("tenant-1", await env.prepare());
  assert.equal((await env.review("tenant-1", attemptId, "reject", {
    note: "The transfer belongs to a different customer",
  })).status, "rejected");
  assert.equal(env.getInvoice().status, "rejected");
  const reused = await env.prepare({ attempt: "attempt_1234567890999999",
    verification: paidBank() });
  await assert.rejects(env.submit("tenant-1", reused),
    /DUPLICATE_SLIP_OR_BANK_REFERENCE|FINANCE_SLIP_ALREADY_CLAIMED/);
  const differentData = Buffer.from("different verified bank slip bytes");
  const newProof = await env.prepare({ attempt: "attempt_1234567890999999",
    data: differentData, verification: {
      ...paidBank(), referenceId: "new_bank_ref", transRef: "new_bank_trans",
    },
  });
  assert.equal((await env.submit("tenant-1", newProof)).status, "pending_review");
});

test("invoice update between verification and staging rejects financial drift", async () => {
  const env = memory(), prepared = await env.prepare();
  env.store.set("tenants/tenant-1/hybridBillingInvoices/" + invoiceId,
    invoice({ amount: 900 }));
  await assert.rejects(env.submit("tenant-1", prepared),
    /INVOICE_CHANGED_DURING_VERIFICATION/);
  assert.equal(env.countClaims(), 0);
});

test("tenant scope, attempt scope and Super Admin review linkage cannot be mixed", async () => {
  const env = memory();
  await env.submit("tenant-1", await env.prepare());
  env.store.set("tenants/tenant-1/hybridBillingPaymentAttempts/" + attemptId,
    { ...env.getPayment(), invoiceSignature: "forged" });
  await assert.rejects(env.review("tenant-1", attemptId, "approve"),
    /REVIEW_FINANCIAL_MISMATCH/);
  assert.equal(env.getInvoice().status, "pending_review");
});

test("Firestore and Storage rules deny browser changes to paid records and unique claims", () => {
  const firestore = fs.readFileSync("firestore.rules", "utf8");
  const storage = fs.readFileSync("storage.rules", "utf8");
  for (const name of ["hybridBillingInvoices", "hybridBillingPeriods",
    "hybridBillingPaymentAttempts", "hybridBillingPaymentEvents"]) {
    const at = firestore.indexOf("match /" + name + "/{");
    assert.ok(at > 0, "Missing collection " + name);
    assert.match(firestore.slice(at, at + 210), /allow create, update, delete: if false/);
  }
  assert.match(firestore, /match \/hybridBillingSlipReferences\/\{referenceId\}/);
  assert.match(firestore, /allow read, write: if false/);
  assert.match(storage, /match \/tenants\/\{tenantId\}\/hybrid-billing-slips\/\{invoiceId\}\/\{attemptId\}\/\{fileName\}/);
  assert.match(storage, /allow update, delete: if false/);
});

test("payment stage and manual approval remain private and are not Firebase callables", () => {
  const boot = fs.readFileSync("functions/bootstrap.js", "utf8");
  const code = fs.readFileSync("functions/hybrid-billing-payment.js", "utf8");
  assert.doesNotMatch(boot, /hybrid-billing-payment|hybrid-billing-reconciler/);
  assert.doesNotMatch(code, /onCall\(|onSchedule\(|https\.onRequest/);
  assert.match(code, /status: "pending_review"/);
  assert.doesNotMatch(code, /active: true|revenueShareSuspended: false/);
});
