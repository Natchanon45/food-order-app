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
let adminApp, db;

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
function callable(name, endpoint, data) {
  const client = clients.get(name);
  if (!client) throw new Error("TEST_UNKNOWN_CLIENT_" + name);
  return httpsCallable(client.functions, endpoint)(data);
}
const submit = (name, data) => callable(name, "demoHybridSubmitProof", data);
const review = (name, data) => callable(name, "demoHybridReviewProof", data);
function fails(code) {
  return err => {
    assert.equal(err.code, "functions/" + code,
      "Unexpected Callable error: " + String(err.code) + " " + String(err.message));
    return true;
  };
}
async function upload(name, store, suffix, attemptId, text) {
  const target = storageRef(clients.get(name).storage,
    evidencePath(store, suffix, attemptId));
  const bytes = new TextEncoder().encode("demo-penguin-bank-slip:" + text);
  await uploadBytes(target, bytes, { contentType: "image/png" });
  return bytes;
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
  for (const suffix of ["trigger", "2026-10-25", "2026-10-26", "2026-10-27"]) {
    await seed("demo-shop-a", suffix);
  }
  await seed("demo-shop-b", "trigger");
});
after(async () => {
  await Promise.allSettled(apps.map(app => deleteApp(app)));
  if (adminApp) await adminDelete(adminApp);
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
  const attemptId = "attempt_owner_123456789";
  await upload("owner-a", "demo-shop-a", "trigger", attemptId, "unique-transfer-1");
  const out = await submit("owner-a", requestData("demo-shop-a", "trigger", attemptId));
  assert.equal(out.data.status, "pending_review");
  assert.equal(out.data.bankVerified, true); // synthetic demo verifier ONLY
  const document = (await invoiceDoc("demo-shop-a", "trigger").get()).data();
  assert.equal(document.status, "pending_review");
  assert.equal(document.amount, 500);
  const saved = (await db.doc("tenants/demo-shop-a/hybridBillingPaymentAttempts/" +
    attemptId).get()).data();
  assert.equal(saved.submittedBy, clients.get("owner-a").uid);
  assert.equal(saved.status, "pending_review");
  assert.equal(saved.verification.provider, "slip2go"); // synthetic result
  await assert.rejects(submit("owner-a",
    requestData("demo-shop-a", "trigger", attemptId)), fails("already-exists"));
});

test("real Auth token prevents owner/admin approval; only Super Admin can settle once", async () => {
  const payload = { ...requestData("demo-shop-a", "trigger", "attempt_owner_123456789"),
    action: "approve", note: "Emulator proof confirmed", verifiedExternally: false };
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
    "attempt_owner_123456789-review").get();
  assert.equal(event.exists, true);
  await assert.rejects(review("super-admin", payload), fails("already-exists"));
});

test("admin may submit but cannot approve; Super Admin rejection is final for one attempt", async () => {
  const attemptId = "attempt_admin_123456789";
  await upload("admin-a", "demo-shop-a", "2026-10-25", attemptId, "unique-transfer-2");
  const payload = requestData("demo-shop-a", "2026-10-25", attemptId);
  assert.equal((await submit("admin-a", payload)).data.status, "pending_review");
  await assert.rejects(review("admin-a", { ...payload, action: "reject",
    note: "Bank reference invalid" }), fails("permission-denied"));
  const outcome = await review("super-admin", {
    ...payload, action: "reject", note: "Bank reference invalid",
  });
  assert.equal(outcome.data.status, "rejected");
  assert.equal((await invoiceDoc("demo-shop-a", "2026-10-25").get()).data().status, "rejected");
});

test("global SHA-256 claim prevents reuse of exact synthetic slip across stores", async () => {
  const proof = "same-transfer-spent-twice";
  const a = "attempt_dedupe_a_123456789";
  const b = "attempt_dedupe_b_123456789";
  const bytes = await upload("owner-a", "demo-shop-a", "2026-10-26", a, proof);
  const reused = await upload("owner-b", "demo-shop-b", "trigger", b, proof);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    createHash("sha256").update(reused).digest("hex"));
  assert.equal((await submit("owner-a",
    requestData("demo-shop-a", "2026-10-26", a))).data.status, "pending_review");
  await assert.rejects(submit("owner-b",
    requestData("demo-shop-b", "trigger", b)), fails("already-exists"));
  assert.equal((await invoiceDoc("demo-shop-b", "trigger").get()).data().status, "issued");
});

test("invoice cannot be paid via forged review body, and a rejected invoice accepts new proof", async () => {
  const old = requestData("demo-shop-a", "2026-10-25", "attempt_admin_123456789");
  await assert.rejects(review("super-admin", { ...old,
    action: "approve", amount: 0, status: "paid",
  }), fails("invalid-argument"));

  const freshAttempt = "attempt_newproof_123456789";
  await upload("owner-a", "demo-shop-a", "2026-10-25", freshAttempt, "unique-transfer-3");
  const newer = requestData("demo-shop-a", "2026-10-25", freshAttempt);
  assert.equal((await submit("owner-a", newer)).data.status, "pending_review");
  assert.equal((await invoiceDoc("demo-shop-a", "2026-10-25").get()).data().status,
    "pending_review");
  await assert.rejects(submit("owner-a", newer), fails("already-exists"));
});

test("real authenticated callable refuses to submit a second payment to an already paid invoice", async () => {
  const attemptId = "attempt_afterpaid_123456789";
  const payload = requestData("demo-shop-a", "trigger", attemptId);
  // The Storage Rules reject a NEW proof against a PAID invoice. The
  // server's financial check independently rejects even without storage.
  await assert.rejects(submit("owner-a", payload), fails("already-exists"));
});
