import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { initializeApp as initializeClient, deleteApp as deleteClient } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth";
import { getFirestore as getClientFirestore, connectFirestoreEmulator, doc, getDocFromServer, terminate } from "firebase/firestore";

const project = "demo-penguin-hybrid";
const local = /^127\.0\.0\.1:(\d{1,5})$/;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "";
if (process.env.GCLOUD_PROJECT !== project || !local.test(firestoreHost) || !local.test(authHost)) {
  throw Error("LOCAL_DEMO_FIRESTORE_AND_AUTH_REQUIRED");
}
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { normalizeProviderReceipt, recordProviderReceipt } = require("./provider-receipt-contract.js");
const admin = initializeApp({ projectId: project });
const db = getFirestore(admin);
const now = Date.parse("2026-11-26T02:00:00.000Z");
const collection = "providerReceiptRecordsV1";
function fixture() {
  const nonce = randomUUID();
  return {
    binding: { provider: "example", connectionId: "demo-" + nonce, scope: "tenant", tenantId: "demo-" + nonce },
    event: { transactionId: "demo-" + nonce, currency: "THB", amountMinor: 9900, occurredAt: "2026-11-26T01:59:00.000Z" },
  };
}
after(async () => { await db.terminate(); await deleteApp(admin); });

test("concurrent duplicate deliveries create exactly one Firestore record", async () => {
  const { binding, event } = fixture();
  const results = await Promise.all(Array.from({ length: 4 }, () => recordProviderReceipt(db, binding, event, now)));
  assert.equal(results.filter(r => r.created).length, 1);
  assert.equal(new Set(results.map(r => r.id)).size, 1);
  const snap = await db.collection(collection).doc(results[0].id).get();
  assert.equal(snap.exists, true);
  assert.deepEqual(snap.data(), {
    ...normalizeProviderReceipt(binding, event, now).record,
    recordedAt: new Date(now).toISOString(),
  });
});

test("conflicting replay cannot alter the original receipt", async () => {
  const { binding, event } = fixture();
  const { id } = await recordProviderReceipt(db, binding, event, now);
  const ref = db.collection(collection).doc(id);
  const before = (await ref.get()).data();
  await assert.rejects(recordProviderReceipt(db, binding, { ...event, amountMinor: 10000 }, now), /PROVIDER_RECEIPT_CONFLICT/);
  await assert.rejects(recordProviderReceipt(db, { ...binding, tenantId: "other-demo" }, event, now), /PROVIDER_RECEIPT_CONFLICT/);
  assert.deepEqual((await ref.get()).data(), before);
});

test("central and two merchant connections remain separate records", async () => {
  const { binding, event } = fixture();
  const central = { ...binding, connectionId: randomUUID(), scope: "platform", tenantId: "" };
  const other = { ...binding, connectionId: randomUUID(), tenantId: randomUUID() };
  const inputs = [binding, central, other];
  const results = await Promise.all(inputs.map(b => recordProviderReceipt(db, b, event, now)));
  assert.equal(new Set(results.map(r => r.id)).size, 3);
  for (let i = 0; i < inputs.length; i++) {
    const data = (await db.collection(collection).doc(results[i].id).get()).data();
    assert.equal(data.scope, inputs[i].scope);
    assert.equal(data.tenantId, inputs[i].tenantId);
    assert.equal(data.paymentVerified, false);
  }
});

test("receipt records are server-only, including for authenticated merchant profiles", async () => {
  const { binding, event } = fixture();
  const { id } = await recordProviderReceipt(db, binding, event, now);
  const client = initializeClient({ projectId: project, apiKey: "demo-key" }, "receipt-demo-" + randomUUID());
  const auth = getAuth(client);
  connectAuthEmulator(auth, "http://" + authHost, { disableWarnings: true });
  const clientDb = getClientFirestore(client);
  connectFirestoreEmulator(clientDb, "127.0.0.1", Number(firestoreHost.split(":")[1]));
  try {
    const { user } = await signInAnonymously(auth);
    await db.collection("users").doc(user.uid).set({ role: "owner", active: true, tenantId: binding.tenantId });
    await assert.rejects(getDocFromServer(doc(clientDb, collection, id)), { code: "permission-denied" });
  } finally {
    await terminate(clientDb);
    await deleteClient(client);
  }
});

test("scoped history reads actual emulator records for the canonical admin only", async () => {
  const { readProviderReceiptHistory: read } = require("./provider-receipt-history.js");
  const { binding, event } = fixture();
  const uid = "demo-history-" + randomUUID();
  const other = { ...binding, connectionId: randomUUID(), tenantId: randomUUID() };
  await db.collection("tenants").doc(binding.tenantId).set({ active: true });
  await db.collection("users").doc(uid).set({ active: true, role: "admin", tenantId: binding.tenantId });
  const mine = await recordProviderReceipt(db, binding, event, now);
  await recordProviderReceipt(db, other, event, now);
  const result = await read(db, { uid }, { scope: "tenant", limit: 1 });
  assert.deepEqual(result.items.map(x => x.id), [mine.id]);
  assert.equal(result.hasMore, false);
  assert.equal(result.items[0].paymentVerified, false);
  assert.equal(Object.hasOwn(result.items[0], "fingerprint"), false);
  await assert.rejects(read(db, { uid }, { scope: "platform" }), { code: "permission-denied" });
  await assert.rejects(read(db, { uid }, { scope: "tenant", tenantId: other.tenantId }), { code: "invalid-argument" });
});
