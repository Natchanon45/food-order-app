import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const fromFunctions = createRequire(new URL("../../functions/package.json", import.meta.url));
const { MAX_BYTES, MIME_EXTENSIONS, RESERVATION_MS,
  validatePrepareRequest, issueTrustedHybridUploadGrant } =
  fromFunctions("./hybrid-billing-upload-grant");
const input = { tenantId: "shop-a", invoiceId: "2026-10-22:delivery:trigger",
  contentType: "image/png", fileSize: 380000 };
const attemptId = "ServerGeneratedAttemptId_123456789";
const now = new Date("2026-10-24T00:00:00.000Z");

function memoryDb({ status = "issued", role = "owner", active = true,
  actorTenant = "shop-a", amount = 500 } = {}) {
  const docs = new Map([
    ["users/uid-one", { role, active, tenantId: actorTenant }],
    ["tenants/shop-a/hybridBillingInvoices/" + input.invoiceId, {
      id: input.invoiceId, tenantId: "shop-a", version: "hybrid-invoice-v1",
      amount, signature: "a".repeat(64), status,
    }],
  ]);
  const doc = path => ({
    id: path.split("/").at(-1), path,
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
    collection: child => collection(path + "/" + child),
  });
  const collection = name => ({ doc: id => doc(name + "/" + id) });
  return {
    docs,
    db: {
      collection,
      runTransaction: async fn => {
        const pending = [];
        const tx = {
          get: ref => ref.get(),
          create: (ref, value) => {
            if (docs.has(ref.path) || pending.some(x => x.ref.path === ref.path))
              throw new Error("ALREADY_EXISTS");
            pending.push({ ref, value });
          },
        };
        const result = await fn(tx);
        for (const row of pending) docs.set(row.ref.path, row.value);
        return result;
      },
    },
  };
}
function makeArgs(environment, overrides = {}) {
  return { db: environment.db, auth: { uid: "uid-one" }, input,
    generateAttemptId: () => attemptId, now: () => new Date(now), ...overrides };
}

test("grant parser is strict and rejects amount, status, path, MIME and oversize", () => {
  assert.equal(MAX_BYTES, 10485760);
  assert.deepEqual(Object.keys(MIME_EXTENSIONS).sort(),
    ["application/pdf", "image/jpeg", "image/png", "image/webp"].sort());
  assert.equal(RESERVATION_MS, 600000);
  assert.deepEqual(validatePrepareRequest(input), input);
  for (const invalid of [
    { ...input, amount: 1 }, { ...input, status: "paid" },
    { ...input, attemptId }, { ...input, slipPath: "forged" },
    { ...input, invoiceId: "../../bad" }, { ...input, tenantId: "../bad" },
    { ...input, contentType: "text/html" }, { ...input, fileSize: 0 },
    { ...input, fileSize: MAX_BYTES + 1 }, { ...input, fileSize: 1.1 },
  ]) assert.throws(() => validatePrepareRequest(invalid), /HYBRID_UPLOAD_/);
});

test("server creates a short-lived immutable reservation without changing invoice or finance", async () => {
  const env = memoryDb();
  const result = await issueTrustedHybridUploadGrant(makeArgs(env));
  assert.deepEqual(result, {
    tenantId: "shop-a", invoiceId: input.invoiceId, attemptId,
    slipPath: "tenants/shop-a/hybrid-billing-slips/" + input.invoiceId +
      "/" + attemptId + "/evidence.png",
    contentType: "image/png", maxSize: input.fileSize,
    expiresAt: "2026-10-24T00:10:00.000Z", uploadEnabled: false,
  });
  const grant = env.docs.get("tenants/shop-a/hybridBillingUploadGrants/" + attemptId);
  assert.equal(grant.actorUid, "uid-one");
  assert.equal(grant.status, "reserved");
  assert.equal(grant.invoiceSignature, "a".repeat(64));
  assert.equal(grant.expiresAt.toISOString(), result.expiresAt);
  assert.equal(env.docs.get("tenants/shop-a/hybridBillingInvoices/" + input.invoiceId).status, "issued");
  assert.equal([...env.docs.keys()].filter(x => /financeSlipClaims|PaymentAttempts/.test(x)).length, 0);
  await assert.rejects(issueTrustedHybridUploadGrant(makeArgs(env)), /ALREADY_EXISTS/);
});

test("cashier, super admin, inactive or foreign-tenant owner cannot issue reservations", async () => {
  for (const options of [
    { role: "cashier" }, { role: "super_admin" },
    { active: false }, { actorTenant: "shop-b" },
  ]) {
    const env = memoryDb(options);
    await assert.rejects(issueTrustedHybridUploadGrant(makeArgs(env)),
      /HYBRID_PAYMENT_(TENANT_ADMIN_REQUIRED|INACTIVE_PROFILE)/);
    assert.equal(env.docs.size, 2);
  }
});

test("settled, pending, malformed and zero-amount invoices never produce upload grants", async () => {
  for (const options of [
    { status: "paid" }, { status: "pending_review" }, { amount: 0 },
  ]) {
    const env = memoryDb(options);
    await assert.rejects(issueTrustedHybridUploadGrant(makeArgs(env)),
      /HYBRID_UPLOAD_INVOICE_NOT_PAYABLE|HYBRID_PAYMENT_INVALID_AMOUNT/);
    assert.equal(env.docs.size, 2);
  }
});

test("transaction rechecks a revoked profile before creating an upload grant", async () => {
  const env = memoryDb();
  const old = env.db.runTransaction;
  env.db.runTransaction = async fn => {
    env.docs.set("users/uid-one", { role: "cashier", active: true, tenantId: "shop-a" });
    return old(fn);
  };
  await assert.rejects(issueTrustedHybridUploadGrant(makeArgs(env)),
    /HYBRID_PAYMENT_TENANT_ADMIN_REQUIRED/);
  assert.equal(env.docs.size, 2);
});

test("production has no public upload endpoint and React still has no file transport", () => {
  const boot = fs.readFileSync("functions/index.js", "utf8") +
    fs.readFileSync("functions/bootstrap.js", "utf8");
  const panel = fs.readFileSync("react-app/src/components/HybridTenantProofPanel.jsx", "utf8");
  const model = fs.readFileSync("react-app/src/data/hybridTenantPaymentDraft.js", "utf8");
  const prodCallable = fs.readFileSync("functions/hybrid-billing-payment-callables.js", "utf8");
  assert.doesNotMatch(boot, /hybrid-billing-upload-grant|demoHybridPrepareUpload/);
  assert.doesNotMatch(panel + model, /uploadBytes\(|httpsCallable\(/);
  assert.match(prodCallable, /HYBRID_PAYMENT_CALLABLE_READY = false/);
  assert.match(model, /HYBRID_TENANT_PROOF_SUBMISSION_READY = false/);
});
