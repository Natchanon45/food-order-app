// Real Firebase Auth + Storage Emulator with Admin SDK fixture writes.
// STRICTLY local demo project. Never points to production or performs deploy.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp as clientInit, deleteApp as clientDelete } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth";
import { getStorage, connectStorageEmulator, ref, uploadBytes, getMetadata,
  deleteObject } from "firebase/storage";
const require = createRequire(import.meta.url);
const adminRequire = createRequire(new URL("../../functions/hybrid-billing-ledger.js", import.meta.url));
const { initializeApp: adminInit, deleteApp: adminDelete } = adminRequire("firebase-admin/app");
const { getFirestore } = adminRequire("firebase-admin/firestore");

const PROJECT = "demo-penguin-hybrid-storage-uat";
if (process.env.GCLOUD_PROJECT !== PROJECT
  || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8190"
  || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9097"
  || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9198") {
  throw Error("HYBRID_STORAGE_EMULATOR_ONLY");
}
const adminApp = adminInit({ projectId: PROJECT }, "hybrid-storage-admin");
const db = getFirestore(adminApp);
const client = clientInit({
  apiKey: "demo-fake-key", authDomain: "localhost", projectId: PROJECT,
  storageBucket: PROJECT + ".appspot.com",
}, "hybrid-storage-client");
const auth = getAuth(client);
connectAuthEmulator(auth, "http://127.0.0.1:9097", { disableWarnings: true });
const storage = getStorage(client);
connectStorageEmulator(storage, "127.0.0.1", 9198);
const tenantId = "tenant-storage-emulator-001";
const attempt = "hybrid-slip-attempt-001";
const key = "tenants/" + tenantId + "/hybrid-billing-slips/" + attempt + "/proof.png";
const buffer = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
let uid;

test.before(async () => {
  uid = (await signInAnonymously(auth)).user.uid;
  await db.collection("users").doc(uid).set({
    uid, tenantId, role: "owner", active: true,
  });
  await db.collection("tenants").doc(tenantId).set({
    billingPolicyVersion: "hybrid_v1", active: true,
  });
});
test.after(async () => {
  await clientDelete(client);
  await adminDelete(adminApp);
});

test("storage: authorized Hybrid owner uploads immutable correctly attributed proof", async () => {
  await uploadBytes(ref(storage, key), buffer, {
    contentType: "image/png", customMetadata: { uploadedByUid: uid },
  });
  const meta = await getMetadata(ref(storage, key));
  assert.equal(meta.contentType, "image/png");
  assert.equal(meta.customMetadata.uploadedByUid, uid);
  assert.ok(meta.size > 0);
});
test("storage: false uploadedByUid cannot spoof ownership", async () => {
  await assert.rejects(uploadBytes(ref(storage, key.replace("proof.png", "spoof.png")), buffer, {
    contentType: "image/png", customMetadata: { uploadedByUid: "another-user-0001" },
  }), error => error.code === "storage/unauthorized");
});
test("storage: proof cannot be overwritten or deleted, even by original owner", async () => {
  await assert.rejects(uploadBytes(ref(storage, key), buffer, {
    contentType: "image/png", customMetadata: { uploadedByUid: uid },
  }), error => error.code === "storage/unauthorized");
  await assert.rejects(deleteObject(ref(storage, key)),
    error => error.code === "storage/unauthorized");
});
test("storage: user from other tenant cannot create Hybrid receipt", async () => {
  const other = "tenant-storage-emulator-002";
  await db.collection("users").doc(uid).update({ tenantId: other });
  await assert.rejects(uploadBytes(ref(storage,
    key.replace("proof.png", "cross-tenant.png")), buffer, {
    contentType: "image/png", customMetadata: { uploadedByUid: uid },
  }), error => error.code === "storage/unauthorized");
  await db.collection("users").doc(uid).update({ tenantId });
});
