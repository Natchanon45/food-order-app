import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { submitTrustedHybridProof, reviewTrustedHybridProof,
  listTrustedTenantHybridInvoices } = require("../../functions/hybrid-billing-payment-service.js");
const { LEDGER_VERSION } = require("../../functions/hybrid-billing-ledger.js");

const invoiceId = "2026-10-22:delivery:trigger";
const attemptId = "attempt_1234567890123456";
const slipPath = "tenants/store-1/hybrid-billing-slips/" +
  invoiceId + "/" + attemptId + "/slip.png";
const user = (role, tenantId = "store-1", active = true) =>
  ({ role, tenantId, active });
const bank = { provider: "slip2go", status: "matched", code: "200200",
  amountMatched: true, detectedAmount: 500, receiverValidated: true,
  referenceId: "bank-ref-2026", transRef: "bank-trans-2026" };

function fixture() {
  const dbRecords = new Map([
    ["users/owner-1", user("owner")],
    ["users/admin-1", user("admin")],
    ["users/staff-1", user("cashier")],
    ["users/admin-other", user("owner", "store-2")],
    ["users/super-1", user("super_admin", "")],
    ["users/inactive-super", user("super_admin", "", false)],
    ["tenants/store-1", { shopName: "Demo" }],
    ["tenants/store-1/hybridBillingInvoices/" + invoiceId, {
      id: invoiceId, status: "issued", amount: 500,
      signature: "a".repeat(64), version: LEDGER_VERSION,
    }],
    ["tenants/store-1/hybridBillingUploadGrants/" + attemptId, {
      id: attemptId, tenantId: "store-1", invoiceId,
      actorUid: "owner-1", slipPath, status: "reserved",
      contentType: "image/png", maxSize: Buffer.byteLength("trusted bank-slip fixture data"),
      invoiceSignature: "a".repeat(64), expiresAt: new Date(Date.now() + 3600000),
    }],
  ]);
  const legacy = new Set();
  const ref = path => ({
    id: path.slice(path.lastIndexOf("/") + 1), key: path,
    get: async () => ({ exists: dbRecords.has(path), data: () => dbRecords.get(path) }),
    collection: name => collection(path + "/" + name),
  });
  const collection = path => ({
    doc: id => ref(path + "/" + id),
    orderBy: () => ({
      limit: () => ({
        get: async () => ({
          docs: [...dbRecords].filter(([key]) => key.startsWith(path + "/"))
            .map(([key, data]) => ({ id: key.slice(key.lastIndexOf("/") + 1),
              data: () => data })),
        }),
      }),
    }),
  });
  const db = {
    collection: name => collection(name),
    collectionGroup: name => ({
      where: (field, cmp, value) => ({
        limit: count => ({
          get: async () => ({ empty: !legacy.has(name + ":" + field + ":" + value) }),
        }),
      }),
    }),
    runTransaction: async callback => {
      const changes = [];
      const tx = {
        get: async document => document.get(),
        create: (document, data) => changes.push(["create", document, data]),
        update: (document, data) => changes.push(["update", document, data]),
      };
      const result = await callback(tx);
      for (const [method, doc] of changes) {
        if (method === "create" && dbRecords.has(doc.key)) throw Error("DUPLICATE_DOC");
        if (method === "update" && !dbRecords.has(doc.key)) throw Error("MISSING_DOC");
      }
      for (const [method, doc, data] of changes) dbRecords.set(doc.key,
        method === "create" ? data : { ...dbRecords.get(doc.key), ...data });
      return result;
    },
  };
  const fileData = Buffer.from("trusted bank-slip fixture data");
  const bucket = { file: path => {
    assert.equal(path, slipPath);
    return {
      exists: async () => [true],
      getMetadata: async () => [{
        size: fileData.length, contentType: "image/png",
      }],
      download: async () => [fileData],
    };
  } };
  const inspectSlip = async () => bank;
  const submit = (uid = "owner-1") => {
    // Each authorized uploader must hold a matching server grant.
    const grant = dbRecords.get("tenants/store-1/hybridBillingUploadGrants/" + attemptId);
    // Never override a consumed or stolen grant during repeated submissions.
    if (uid === "admin-1" && grant?.status === "reserved") {
      dbRecords.set("tenants/store-1/hybridBillingUploadGrants/" + attemptId,
        { ...grant, actorUid: uid });
    }
    return submitTrustedHybridProof({
    db, bucket, auth: { uid }, tenantId: "store-1", invoiceId, attemptId,
    slipPath, inspectSlip, serverTimestamp: "SERVER_TIME",
  });
  };
  const review = (uid = "super-1", action = "approve") =>
    reviewTrustedHybridProof({ db, auth: { uid }, tenantId: "store-1",
      invoiceId, attemptId, action, note: "Finance confirmed by bank",
      serverTimestamp: "SERVER_TIME" });
  return {
    db, dbRecords, legacy, submit, review,
    invoice: () => dbRecords.get("tenants/store-1/hybridBillingInvoices/" + invoiceId),
    payment: () => dbRecords.get("tenants/store-1/hybridBillingPaymentAttempts/" + attemptId),
  };
}

test("reviewer revocation after preflight cannot settle an invoice", async () => {
  const env = fixture();
  await env.submit("owner-1");
  const originalRun = env.db.runTransaction;
  env.db.runTransaction = async callback => {
    env.dbRecords.set("users/super-1", user("cashier", "store-1", true));
    return originalRun(callback);
  };
  await assert.rejects(env.review("super-1"), /HYBRID_PAYMENT_SUPER_ADMIN_REQUIRED/);
  assert.equal(env.invoice().status, "pending_review");
  assert.equal(env.payment().status, "pending_review");
  assert.equal(env.dbRecords.has("tenants/store-1/hybridBillingPaymentEvents/" + attemptId + "-review"), false);
});

test("ledger identity/version and attempt record tampering block financial review", async () => {
  for (const [property, value] of [
    ["id", "another-invoice"], ["version", "fake-ledger-v9"],
    ["signature", "not-a-ledger-signature"], ["tenantId", "store-2"],
  ]) {
    const env = fixture();
    await env.submit("owner-1");
    const path = "tenants/store-1/hybridBillingInvoices/" + invoiceId;
    env.dbRecords.set(path, { ...env.invoice(), [property]: value });
    await assert.rejects(env.review("super-1"), /HYBRID_PAYMENT_REVIEW_LEDGER_INVALID/);
    assert.equal(env.invoice().status, "pending_review");
    assert.equal(env.payment().status, "pending_review");
  }
  const env = fixture();
  await env.submit("owner-1");
  const record = "tenants/store-1/hybridBillingPaymentAttempts/" + attemptId;
  env.dbRecords.set(record, { ...env.payment(), id: "tampered-attempt" });
  await assert.rejects(env.review("super-1"), /HYBRID_PAYMENT_REVIEW_LEDGER_INVALID/);
  assert.equal(env.invoice().status, "pending_review");
});

test("tenant owner and admin submit their own bank slip but are never allowed to approve", async () => {
  const env = fixture();
  const result = await env.submit("owner-1");
  assert.equal(result.status, "pending_review");
  assert.equal(env.invoice().status, "pending_review");
  assert.equal(env.dbRecords.get("tenants/store-1/hybridBillingUploadGrants/" + attemptId).status,
    "consumed", "The upload grant must be consumed atomically with pending_review");
  await assert.rejects(env.review("owner-1"), /SUPER_ADMIN_REQUIRED/);
  await assert.rejects(env.review("admin-1"), /SUPER_ADMIN_REQUIRED/);
  assert.equal(env.invoice().status, "pending_review");
});

test("Super Admin approves only after existing pending evidence and authenticated role", async () => {
  const env = fixture();
  await env.submit();
  await assert.rejects(env.review("inactive-super"), /INACTIVE_PROFILE/);
  assert.equal((await env.review()).status, "paid");
  assert.equal(env.invoice().status, "paid");
  assert.equal(env.payment().status, "paid");
});

test("missing, stolen, expired or consumed grant fails before bank verification", async () => {
  const env = fixture();
  const grantPath = "tenants/store-1/hybridBillingUploadGrants/" + attemptId;
  const baseline = env.dbRecords.get(grantPath);
  env.dbRecords.delete(grantPath);
  await assert.rejects(env.submit(), /HYBRID_UPLOAD_GRANT_NOT_FOUND_OR_FORBIDDEN/);
  env.dbRecords.set(grantPath, { ...baseline, actorUid: "admin-1" });
  await assert.rejects(env.submit(), /HYBRID_UPLOAD_GRANT_NOT_FOUND_OR_FORBIDDEN/);
  env.dbRecords.set(grantPath, { ...baseline, expiresAt: new Date(Date.now() - 1000) });
  await assert.rejects(env.submit(), /HYBRID_UPLOAD_GRANT_EXPIRED/);
  env.dbRecords.set(grantPath, { ...baseline, status: "consumed" });
  await assert.rejects(env.submit(), /HYBRID_UPLOAD_GRANT_NOT_FOUND_OR_FORBIDDEN/);
  assert.equal(env.invoice().status, "issued");
});

test("cashier and cross-tenant users cannot attach billing proof", async () => {
  const env = fixture();
  await assert.rejects(env.submit("staff-1"), /TENANT_ADMIN_REQUIRED/);
  await assert.rejects(env.submit("admin-other"), /TENANT_ADMIN_REQUIRED/);
  await assert.rejects(env.submit("missing"), /INACTIVE_PROFILE/);
  assert.equal(env.invoice().status, "issued");
});

test("reuse of bank reference from old revenue-share or Wallet stops payment before staging", async () => {
  for (const coll of ["revenueSharePayments", "lalamoveWalletTopups"]) {
    const env = fixture();
    env.legacy.add(coll + ":slip2GoReferenceId:" + bank.referenceId);
    await assert.rejects(env.submit(), /ALREADY_USED_BY_LEGACY_BILLING_OR_WALLET/);
    assert.equal(env.invoice().status, "issued");
    assert.equal(env.payment(), undefined);
  }
});

test("a newly reused legacy reference also stops later Super Admin approval", async () => {
  const env = fixture();
  await env.submit();
  env.legacy.add("revenueSharePayments:slip2GoTransRef:" + bank.transRef);
  await assert.rejects(env.review(), /ALREADY_USED_BY_LEGACY_BILLING_OR_WALLET/);
  assert.equal(env.invoice().status, "pending_review");
});

test("unavailable collection-group scan fails closed", async () => {
  const env = fixture();
  delete env.db.collectionGroup;
  await assert.rejects(env.submit(), /LEGACY_DUPLICATE_SCAN_UNAVAILABLE/);
  assert.equal(env.invoice().status, "issued");
});

test("only tenant owner/admin or Super Admin can read invoice list", async () => {
  const env = fixture();
  for (const uid of ["owner-1", "admin-1", "super-1"]) {
    const rows = await listTrustedTenantHybridInvoices({
      db: env.db, auth: { uid }, tenantId: "store-1",
    });
    assert.equal(rows[0].id, invoiceId);
    assert.equal(rows[0].amount, 500);
  }
  for (const uid of ["staff-1", "admin-other", "inactive-super"]) {
    await assert.rejects(listTrustedTenantHybridInvoices({
      db: env.db, auth: { uid }, tenantId: "store-1",
    }), /FORBIDDEN|INACTIVE_PROFILE/);
  }
});

test("authenticated wrapper remains server-private and does not expose Cloud Functions", () => {
  const boot = fs.readFileSync("functions/bootstrap.js", "utf8");
  assert.doesNotMatch(boot, /hybrid-billing-payment/);
  const service = fs.readFileSync("functions/hybrid-billing-payment-service.js", "utf8");
  assert.doesNotMatch(service, /onCall\(|onSchedule\(|onRequest\(/);
  assert.match(service, /financeReviewer\(db, auth\)/);
  assert.match(service, /assertNoLegacyReferenceUse/);
});

test("Super Admin can reject duplicate legacy evidence despite blocked approval", async () => {
  const env = fixture();
  await env.submit();
  env.legacy.add("revenueSharePayments:slip2GoTransRef:" + bank.transRef);
  await assert.rejects(env.review("super-1", "approve"),
    /ALREADY_USED_BY_LEGACY_BILLING_OR_WALLET/);
  const rejected = await env.review("super-1", "reject");
  assert.equal(rejected.status, "rejected");
  assert.equal(env.invoice().status, "rejected");
  assert.equal(env.payment().status, "rejected");
});
