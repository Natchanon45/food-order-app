import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const realRequire = createRequire(import.meta.url);
const src = fs.readFileSync("functions/hybrid-billing-payment-callables.js", "utf8");
class HttpsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function load(services = {}) {
  const modules = {
    "firebase-functions/v2/https": {
      HttpsError,
      onCall: (options, fn) => Object.assign(fn, { options }),
    },
    "firebase-admin/firestore": {
      getFirestore: () => ({ trusted: "db" }),
      FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
    },
    "firebase-admin/storage": {
      getStorage: () => ({ bucket: () => ({ trusted: "bucket" }) }),
    },
    "./slip-verification": { inspectSlip: () => "verifier" },
    "./hybrid-billing-payment-service": {
      submitTrustedHybridProof: services.submit || (async ({ auth, tenantId }) =>
        ({ state: "pending_review", uid: auth.uid, tenantId })),
      reviewTrustedHybridProof: services.review || (async ({ auth, action }) =>
        ({ state: action === "approve" ? "paid" : "rejected", uid: auth.uid })),
    },
    "./hybrid-billing-payment-policy": {
      validInvoiceId: value => {
        if (!/^20\d{2}-\d{2}-\d{2}:(delivery:trigger|monthly:fixed)$/.test(value))
          throw Error("invalid invoice");
      },
      validId: value => { if (!/^[\w-]{16,80}$/.test(value)) throw Error("invalid attempt"); },
      validateEvidencePath: ({ tenantId, invoiceId, attemptId, path }) => {
        if (!path.startsWith("tenants/" + tenantId +
          "/hybrid-billing-slips/" + invoiceId + "/" + attemptId + "/"))
          throw Error("path does not match tenant/invoice/attempt");
      },
    },
  };
  const mod = { exports: {} };
  new Function("module", "exports", "require", src)(mod, mod.exports, key => {
    if (!(key in modules)) throw Error("Unexpected dependency " + key);
    return modules[key];
  });
  return mod.exports;
}
const invoiceId = "2026-10-22:delivery:trigger";
const attemptId = "attempt_1234567890123456";
const sampleSubmit = {
  tenantId: "shop-one", invoiceId, attemptId,
  slipPath: "tenants/shop-one/hybrid-billing-slips/" + invoiceId +
    "/" + attemptId + "/bank.png",
};
const sampleReview = { tenantId: "shop-one", invoiceId, attemptId,
  action: "approve", note: "Confirmed received bank transfer" };
function ready(mod, services = {}) {
  return mod.makeHybridPaymentHandlersForTest({
    db: { trusted: "db" }, bucket: { trusted: "bucket" },
    inspect: "verifier", timestamp: "SERVER_TIME", enabled: true,
  });
}

test("real callable exports are hard disabled, private from bootstrap and use App Check", () => {
  const callables = load();
  assert.equal(callables.HYBRID_PAYMENT_CALLABLE_READY, false);
  assert.equal(callables.submitTenantHybridPaymentProof.options.enforceAppCheck, true);
  assert.equal(callables.reviewHybridInvoicePaymentProof.options.enforceAppCheck, true);
  assert.equal(callables.reviewHybridInvoicePaymentProof.options.region, "asia-southeast1");
  assert.doesNotMatch(fs.readFileSync("functions/bootstrap.js", "utf8"),
    /hybrid-billing-payment-callables/);
  assert.doesNotMatch(fs.readFileSync("functions/index.js", "utf8"),
    /hybrid-billing-payment-callables/);
  assert.doesNotMatch(src, /getPublicHybridBillingSettings|HYBRID_REGISTRATION_READY = true/);
});

test("real production submit and review reject even valid authenticated requests", async () => {
  const m = load();
  await assert.rejects(
    m.submitTenantHybridPaymentProof({ auth: { uid: "owner-one" }, data: sampleSubmit }),
    e => e.code === "failed-precondition" && /NOT_RELEASED/.test(e.message),
  );
  await assert.rejects(
    m.reviewHybridInvoicePaymentProof({ auth: { uid: "super-one" }, data: sampleReview }),
    e => e.code === "failed-precondition" && /NOT_RELEASED/.test(e.message),
  );
  await assert.rejects(m.submitTenantHybridPaymentProof({ data: sampleSubmit }),
    e => e.code === "unauthenticated");
});

test("prepared private handler forwards only validated tenant/invoice/proof and server context", async () => {
  let recorded = null;
  const m = load({
    submit: async params => {
      recorded = params;
      return { status: "pending_review" };
    },
  });
  const result = await ready(m).submit({
    auth: { uid: "owner-one" }, data: sampleSubmit,
  });
  assert.deepEqual(result, { status: "pending_review" });
  assert.equal(recorded.auth.uid, "owner-one");
  assert.equal(recorded.tenantId, "shop-one");
  assert.equal(recorded.invoiceId, invoiceId);
  assert.equal(recorded.serverTimestamp, "SERVER_TIME");
  assert.ok(!("amount" in recorded));
  assert.ok(!("status" in recorded));
  assert.ok(!("verifiedExternally" in recorded));
});

test("forged amount, status, verifier results and extra fields fail before the service", async () => {
  let called = false;
  const m = load({ submit: async () => { called = true; } });
  for (const addition of [
    { amount: 0 }, { status: "paid" }, { bankVerified: true },
    { invoiceAmount: 500 }, { provider: "slip2go" }, { actorId: "admin" },
  ]) {
    await assert.rejects(ready(m).submit({
      auth: { uid: "owner-one" }, data: { ...sampleSubmit, ...addition },
    }), e => e.code === "invalid-argument");
  }
  assert.equal(called, false);
});

test("cross-tenant path mismatch, malformed identifiers and huge strings fail safely", async () => {
  const m = load();
  for (const bad of [
    { ...sampleSubmit, tenantId: "../another" },
    { ...sampleSubmit, slipPath: sampleSubmit.slipPath.replace("shop-one", "shop-two") },
    { ...sampleSubmit, attemptId: "../invalid" },
    { ...sampleSubmit, invoiceId: "untrusted-document" },
    { ...sampleSubmit, slipPath: "A".repeat(2000) },
  ]) {
    await assert.rejects(ready(m).submit({ auth: { uid: "one" }, data: bad }),
      e => e.code === "invalid-argument");
  }
});

test("review rejects forged payment fields and passes note plus review action to trusted service", async () => {
  let args = null;
  const mod = load({ review: async p => { args = p; return { status: "paid" }; } });
  for (const data of [
    { ...sampleReview, amount: 1 }, { ...sampleReview, action: "unlock" },
    { ...sampleReview, verifiedExternally: "true" },
    { ...sampleReview, note: "x".repeat(2001) },
    { ...sampleReview, status: "paid" },
  ]) {
    await assert.rejects(ready(mod).review({ auth: { uid: "super-one" }, data }),
      e => e.code === "invalid-argument");
  }
  assert.equal(args, null);
  const result = await ready(mod).review({
    auth: { uid: "super-one" }, data: sampleReview,
  });
  assert.deepEqual(result, { status: "paid" });
  assert.equal(args.reviewerId, undefined, "The trusted service owns reviewer identity");
  assert.equal(args.auth.uid, "super-one");
  assert.equal(args.action, "approve");
  assert.equal(args.serverTimestamp, "SERVER_TIME");
});

test("authorization and duplicate claims errors map to stable sanitized HTTPS errors", async () => {
  for (const [message, code] of [
    ["HYBRID_PAYMENT_SUPER_ADMIN_REQUIRED", "permission-denied"],
    ["HYBRID_PAYMENT_TENANT_ADMIN_REQUIRED", "permission-denied"],
    ["FINANCE_SLIP_ALREADY_CLAIMED", "already-exists"],
    ["HYBRID_PAYMENT_ALREADY_REVIEWED", "already-exists"],
  ]) {
    const mod = load({ review: async () => { throw Error(message); } });
    await assert.rejects(ready(mod).review({
      auth: { uid: "user" }, data: sampleReview,
    }), e => e.code === code && e.message === message);
  }
  const mod = load({ review: async () => { throw Error("bank account 1234 secret token"); } });
  await assert.rejects(ready(mod).review({
    auth: { uid: "user" }, data: sampleReview,
  }), e => e.code === "failed-precondition" && e.message === "HYBRID_PAYMENT_FAILED");
});
