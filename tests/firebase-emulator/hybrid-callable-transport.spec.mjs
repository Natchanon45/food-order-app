import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth, connectAuthEmulator, createUserWithEmailAndPassword,
} from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import {
  getStorage, connectStorageEmulator, ref as storageRef, uploadBytes,
} from "firebase/storage";
import { createHash } from "node:crypto";

const projectId = "demo-penguin-hybrid";
const bucket = projectId + ".appspot.com";
const invoicePrefix = "2026-10-22:delivery:";
const requireFunctions = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp: adminInitialize, deleteApp: adminDelete } =
  requireFunctions("firebase-admin/app");
const { getFirestore: getAdminDb } = requireFunctions("firebase-admin/firestore");

const apps = [], clients = new Map();
let adminApp, db, ownerPaidProof, adminRejectedProof;

function guardEnvironment() {
  if (process.env.HYBRID_DEMO_FUNCTIONS_ONLY !== "1") {
    throw new Error("DEMO_ONLY_ENV_REQUIRED");
  }
  for (const name of ["FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST",
    "FIREBASE_STORAGE_EMULATOR_HOST", "FIREBASE_FUNCTIONS_EMULATOR_HOST"]) {
    if (!/^(?:127\.0\.0\.1|localhost):\d+$/.test(String(process.env[name] || ""))) {
      throw new Error("REFUSE_NONLOCAL_EMULATOR_" + name);
    }
  }
}
function application(name) {
  const app = initializeApp({
    apiKey: "demo-fake-key",
    projectId, authDomain: projectId + ".firebaseapp.com",
    storageBucket: bucket, appId: "1:123:web:" + name,
  }, "demo-functions-uattest-" + name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://" + process.env.FIREBASE_AUTH_EMULATOR_HOST,
    { disableWarnings: true });
  const [storageHost, storagePort] =
    process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(":");
  const storage = getStorage(app);
  connectStorageEmulator(storage, storageHost, Number(storagePort));
  const [functionHost, functionPort] =
    process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST.split(":");
  const functions = getFunctions(app, "asia-southeast1");
  connectFunctionsEmulator(functions, functionHost, Number(functionPort));
  return { app, auth, storage, functions, uid: null };
}
async function identity(name, role, tenantId = "demo-shop-a", active = true) {
  const client = application(name);
  const result = await createUserWithEmailAndPassword(client.auth,
    name + "@example.test", "EmulatorOnly123!");
  client.uid = result.user.uid;
  clients.set(name, client);
  await db.collection("users").doc(client.uid).set({
    role, tenantId, active, email: name + "@example.test",
  });
  return client;
}
function invoiceId(suffix) {
  return invoicePrefix + suffix;
}
function invoiceDoc(store, suffix) {
  return db.doc("tenants/" + store + "/hybridBillingInvoices/" + invoiceId(suffix));
}
function evidencePath(store, suffix, attemptId) {
  return "tenants/" + store + "/hybrid-billing-slips/" +
    invoiceId(suffix) + "/" + attemptId + "/bank.png";
}
function requestData(store, suffix, attemptId) {
  return {
    tenantId: store, invoiceId: invoiceId(suffix),
    attemptId, slipPath: evidencePath(store, suffix, attemptId),
  };
}
// Review request has a DIFFERENT strict allowlist from the upload request:
// slipPath is forbidden during approval and would return invalid-argument.
function reviewData(submission, action, note, verifiedExternally = false) {
  const { tenantId, invoiceId, attemptId } = submission;
  return { tenantId, invoiceId, attemptId, action, note, verifiedExternally };
}
function callable(name, endpoint, data) {
  const client = clients.get(name);
  if (!client) throw new Error("TEST_UNKNOWN_CLIENT_" + name);
  return httpsCallable(client.functions, endpoint)(data);
}
const prepareUpload = (name, data) => callable(name, "demoHybridPrepareUpload", data);
const submit = (name, data) => callable(name, "demoHybridSubmitProof", data);
const review = (name, data) => callable(name, "demoHybridReviewProof", data);
function fails(code) {
  return err => {
    assert.equal(err.code, "functions/" + code,
      "Unexpected Callable error: " + String(err.code) + " " + String(err.message));
    return true;
  };
}
// Browser uses a server-generated, invoice-scoped grant: no self-chosen IDs.
async function reserveAndUpload(name, store, suffix, text) {
  const bytes = new TextEncoder().encode("demo-penguin-bank-slip:" + text);
  const grant = (await prepareUpload(name, {
    tenantId: store, invoiceId: invoiceId(suffix),
    contentType: "image/png", fileSize: bytes.byteLength,
  })).data;
  const payload = {
    tenantId: store, invoiceId: invoiceId(suffix),
    attemptId: grant.attemptId, slipPath: grant.slipPath,
  };
  await uploadBytes(storageRef(clients.get(name).storage, grant.slipPath),
    bytes, { contentType: "image/png" });
  return { payload, bytes };
}
async function seed(store, suffix, amount = 500) {
  await invoiceDoc(store, suffix).set({
    id: invoiceId(suffix), version: "hybrid-invoice-v1",
    signature: "a".repeat(64), status: "issued",
    amount, tenantId: store, date: "2026-10-25",
  });
}

before(async () => {
  guardEnvironment();
  adminApp = adminInitialize({ projectId, storageBucket: bucket }, "demo-hybrid-uattest-admin");
  db = getAdminDb(adminApp);
  await identity("owner-a", "owner", "demo-shop-a");
  await identity("admin-a", "admin", "demo-shop-a");
  await identity("cashier-a", "cashier", "demo-shop-a");
  await identity("inactive-a", "admin", "demo-shop-a", false);
  await identity("owner-b", "owner", "demo-shop-b");
  await identity("super-admin", "super_admin", "");
  clients.set("anonymous", application("anonymous"));
  await db.collection("tenants").doc("demo-shop-a").set({
    ownerUid: clients.get("owner-a").uid, shopName: "Demo A",
    subscriptionStatus: "suspended", active: false,
    suspensionReason: "manual_review",
  });
  await db.collection("tenants").doc("demo-shop-b").set({
    ownerUid: clients.get("owner-b").uid, shopName: "Demo B",
    subscriptionStatus: "active", active: true,
  });
  for (const suffix of ["trigger", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"]) {
    await seed("demo-shop-a", suffix);
  }
  await seed("demo-shop-b", "trigger");
});
after(async () => {
  await Promise.allSettled(apps.map(app => deleteApp(app)));
  if (adminApp) await adminDelete(adminApp);
});

test("demo Auth Callable issues short-lived server-generated invoice upload reservation, never payment", async () => {
  const data = { tenantId: "demo-shop-a", invoiceId: invoiceId("trigger"),
    contentType: "image/png", fileSize: 800 };
  await assert.rejects(prepareUpload("anonymous", data), fails("unauthenticated"));
  await assert.rejects(prepareUpload("cashier-a", data), fails("permission-denied"));
  await assert.rejects(prepareUpload("inactive-a", data), fails("unauthenticated"));
  await assert.rejects(prepareUpload("owner-b", data), fails("permission-denied"));
  for (const forged of [
    { ...data, amount: 1 }, { ...data, status: "paid" },
    { ...data, fileSize: 10 * 1024 * 1024 + 1 },
    { ...data, contentType: "text/html" }, { ...data, invoiceId: "nonexistent" },
  ]) await assert.rejects(prepareUpload("owner-a", forged), fails("invalid-argument"));
  const response = (await prepareUpload("owner-a", data)).data;
  assert.match(response.attemptId, /^[A-Za-z0-9_-]{16,80}$/);
  assert.equal(response.uploadEnabled, false);
  assert.equal(response.slipPath, "tenants/demo-shop-a/hybrid-billing-slips/" +
    invoiceId("trigger") + "/" + response.attemptId + "/evidence.png");
  const grant = await db.doc("tenants/demo-shop-a/hybridBillingUploadGrants/" +
    response.attemptId).get();
  assert.equal(grant.exists, true);
  assert.equal(grant.data().actorUid, clients.get("owner-a").uid);
  assert.equal(grant.data().maxSize, 800);
  assert.equal(grant.data().status, "reserved");
  assert.equal((await invoiceDoc("demo-shop-a", "trigger").get()).data().status, "issued");
  const second = (await prepareUpload("owner-a", data)).data;
  assert.notEqual(second.attemptId, response.attemptId);
  assert.equal((await invoiceDoc("demo-shop-a", "trigger").get()).data().status, "issued");
});

test("actual Callable transport denies unsigned, cashier, inactive and cross-tenant submit", async () => {
  const data = requestData("demo-shop-a", "trigger", "attempt_denied_123456789");
  await assert.rejects(submit("anonymous", data), fails("unauthenticated"));
  await assert.rejects(submit("cashier-a", data), fails("permission-denied"));
  await assert.rejects(submit("inactive-a", data), fails("unauthenticated"));
  await assert.rejects(submit("owner-b", data), fails("permission-denied"));
  assert.equal((await invoiceDoc("demo-shop-a", "trigger").get()).data().status, "issued");
});

test("actual Callable rejects forged client amount/paid status and malformed proof links", async () => {
  const original = requestData("demo-shop-a", "trigger", "attempt_invalid_12345678");
  for (const data of [
    { ...original, amount: 1 },
    { ...original, status: "paid" },
    { ...original, bankVerified: true },
    { ...original, invoiceId: "../../evil" },
    { ...original, slipPath: original.slipPath.replace("demo-shop-a", "demo-shop-b") },
  ]) {
    await assert.rejects(submit("owner-a", data), fails("invalid-argument"));
  }
});

test("owner uploads once, submits via authenticated Callable and only creates pending_review", async () => {
  const { payload } = await reserveAndUpload(
    "owner-a", "demo-shop-a", "trigger", "unique-transfer-1");
  ownerPaidProof = payload;
  const out = await submit("owner-a", payload);
  assert.equal(out.data.status, "pending_review");
  assert.equal(out.data.bankVerified, true); // synthetic demo verifier ONLY
  const document = (await invoiceDoc("demo-shop-a", "trigger").get()).data();
  assert.equal(document.status, "pending_review");
  assert.equal(document.amount, 500);
  const saved = (await db.doc("tenants/demo-shop-a/hybridBillingPaymentAttempts/" +
    payload.attemptId).get()).data();
  assert.equal(saved.submittedBy, clients.get("owner-a").uid);
  assert.equal(saved.status, "pending_review");
  assert.equal(saved.verification.provider, "slip2go");
  const grant = (await db.doc("tenants/demo-shop-a/hybridBillingUploadGrants/" +
    payload.attemptId).get()).data();
  assert.equal(grant.status, "consumed");
  await assert.rejects(submit("owner-a", payload), fails("failed-precondition"));
});

test("real Auth token prevents owner/admin approval; only Super Admin can settle once", async () => {
  const payload = reviewData(ownerPaidProof, "approve", "Emulator proof confirmed");
  await assert.rejects(review("owner-a", payload), fails("permission-denied"));
  await assert.rejects(review("admin-a", payload), fails("permission-denied"));
  await assert.rejects(review("anonymous", payload), fails("unauthenticated"));
  const result = await review("super-admin", payload);
  assert.equal(result.data.status, "paid");
  const paid = (await invoiceDoc("demo-shop-a", "trigger").get()).data();
  assert.equal(paid.status, "paid");
  assert.equal(paid.amount, 500);
  const tenant = (await db.collection("tenants").doc("demo-shop-a").get()).data();
  assert.equal(tenant.active, false);
  assert.equal(tenant.subscriptionStatus, "suspended");
  assert.equal(tenant.suspensionReason, "manual_review");
  const event = await db.doc("tenants/demo-shop-a/hybridBillingPaymentEvents/" +
    ownerPaidProof.attemptId + "-review").get();
  assert.equal(event.exists, true);
  await assert.rejects(review("super-admin", payload), fails("already-exists"));
});

test("admin may submit but cannot approve; Super Admin rejection is final for one attempt", async () => {
  const { payload } = await reserveAndUpload(
    "admin-a", "demo-shop-a", "2026-10-25", "unique-transfer-2");
  adminRejectedProof = payload;
  assert.equal((await submit("admin-a", payload)).data.status, "pending_review");
  await assert.rejects(review("admin-a",
    reviewData(payload, "reject", "Bank reference invalid")), fails("permission-denied"));
  const outcome = await review("super-admin",
    reviewData(payload, "reject", "Bank reference invalid"));
  assert.equal(outcome.data.status, "rejected");
  assert.equal((await invoiceDoc("demo-shop-a", "2026-10-25").get()).data().status, "rejected");
});

test("global SHA-256 claim prevents reuse of exact synthetic slip across stores", async () => {
  const proof = "same-transfer-spent-twice";
  const first = await reserveAndUpload("owner-a", "demo-shop-a", "2026-10-26", proof);
  const second = await reserveAndUpload("owner-b", "demo-shop-b", "trigger", proof);
  assert.equal(createHash("sha256").update(first.bytes).digest("hex"),
    createHash("sha256").update(second.bytes).digest("hex"));
  assert.equal((await submit("owner-a", first.payload)).data.status, "pending_review");
  await assert.rejects(submit("owner-b", second.payload), fails("already-exists"));
  assert.equal((await invoiceDoc("demo-shop-b", "trigger").get()).data().status, "issued");
});

test("invoice cannot be paid via forged review body, and a rejected invoice accepts new proof", async () => {
  await assert.rejects(review("super-admin", {
    ...reviewData(adminRejectedProof, "approve", "Emulator fake bank verification"),
    amount: 0, status: "paid",
  }), fails("invalid-argument"));
  const { payload } = await reserveAndUpload(
    "owner-a", "demo-shop-a", "2026-10-25", "unique-transfer-3");
  assert.equal((await submit("owner-a", payload)).data.status, "pending_review");
  assert.equal((await invoiceDoc("demo-shop-a", "2026-10-25").get()).data().status,
    "pending_review");
  await assert.rejects(submit("owner-a", payload), fails("failed-precondition"));
});

test("paid invoice cannot issue a new grant and unauthorised proof path cannot submit", async () => {
  await assert.rejects(prepareUpload("owner-a", {
    tenantId: "demo-shop-a", invoiceId: invoiceId("trigger"),
    contentType: "image/png", fileSize: 100,
  }), fails("failed-precondition"));
  await assert.rejects(submit("owner-a",
    requestData("demo-shop-a", "trigger", "attempt_afterpaid_123456789")),
  fails("failed-precondition"));
});

test("demo transport denies unreserved upload, grant theft, expired grant and forged size", async () => {
  const owner = clients.get("owner-a"), admin = clients.get("admin-a");
  const raw = new TextEncoder().encode("demo-no-bank-payout");
  const noGrant = evidencePath("demo-shop-a", "2026-10-27", "unreserved_1234567890123");
  await assert.rejects(uploadBytes(storageRef(owner.storage, noGrant),
    raw, { contentType: "image/png" }));
  const grant = (await prepareUpload("owner-a", {
    tenantId: "demo-shop-a", invoiceId: invoiceId("2026-10-27"),
    contentType: "image/png", fileSize: raw.byteLength,
  })).data;
  await assert.rejects(uploadBytes(storageRef(admin.storage, grant.slipPath),
    raw, { contentType: "image/png" }));
  await assert.rejects(uploadBytes(storageRef(owner.storage, grant.slipPath),
    new Uint8Array(raw.byteLength + 1), { contentType: "image/png" }));
  await db.doc("tenants/demo-shop-a/hybridBillingUploadGrants/" + grant.attemptId)
    .update({ expiresAt: new Date(Date.now() - 1000) });
  await assert.rejects(uploadBytes(storageRef(owner.storage, grant.slipPath),
    raw, { contentType: "image/png" }));
  await assert.rejects(submit("owner-a", {
    tenantId: "demo-shop-a", invoiceId: invoiceId("2026-10-27"),
    attemptId: grant.attemptId, slipPath: grant.slipPath,
  }), fails("failed-precondition"));
  assert.equal((await invoiceDoc("demo-shop-a", "2026-10-27").get()).data().status, "issued");
});

test("concurrent submit calls consume exactly one grant and create exactly one payment", async () => {
  const { payload } = await reserveAndUpload(
    "owner-a", "demo-shop-a", "2026-10-28", "concurrent-unique-transfer");
  const results = await Promise.allSettled([
    submit("owner-a", payload), submit("owner-a", payload),
  ]);
  const successes = results.filter(result => result.status === "fulfilled");
  const failures = results.filter(result => result.status === "rejected");
  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  assert.equal(successes[0].value.data.status, "pending_review");
  assert.ok(["functions/failed-precondition", "functions/already-exists"].includes(
    failures[0].reason.code));
  const grant = (await db.doc("tenants/demo-shop-a/hybridBillingUploadGrants/" +
    payload.attemptId).get()).data();
  assert.equal(grant.status, "consumed");
  assert.equal((await invoiceDoc("demo-shop-a", "2026-10-28").get()).data().status,
    "pending_review");
  const attempt = await db.doc("tenants/demo-shop-a/hybridBillingPaymentAttempts/" +
    payload.attemptId).get();
  assert.equal(attempt.exists, true);
});

test("revoked Super Admin cannot settle a pending invoice; audit remains untouched", async () => {
  const { payload } = await reserveAndUpload(
    "owner-a", "demo-shop-a", "2026-10-29", "revoked-reviewer-test");
  assert.equal((await submit("owner-a", payload)).data.status, "pending_review");
  const userRef = db.collection("users").doc(clients.get("super-admin").uid);
  const reviewPayload = reviewData(payload, "approve", "Synthetic bank confirmed");
  try {
    await userRef.update({ active: false });
    await assert.rejects(review("super-admin", reviewPayload), fails("unauthenticated"));
    assert.equal((await invoiceDoc("demo-shop-a", "2026-10-29").get()).data().status,
      "pending_review");

    await userRef.update({ active: true, role: "cashier" });
    await assert.rejects(review("super-admin", reviewPayload), fails("permission-denied"));
    assert.equal((await invoiceDoc("demo-shop-a", "2026-10-29").get()).data().status,
      "pending_review");
    const event = await db.doc("tenants/demo-shop-a/hybridBillingPaymentEvents/" +
      payload.attemptId + "-review").get();
    assert.equal(event.exists, false, "No reviewer event may exist after revocation");
  } finally {
    await userRef.update({ active: true, role: "super_admin" });
  }
  assert.equal((await review("super-admin", reviewPayload)).data.status, "paid");
  assert.equal((await invoiceDoc("demo-shop-a", "2026-10-29").get()).data().status, "paid");
  const store = (await db.collection("tenants").doc("demo-shop-a").get()).data();
  assert.equal(store.subscriptionStatus, "suspended",
    "Review must not unlock unrelated store suspension");
  assert.equal(store.active, false);
});
