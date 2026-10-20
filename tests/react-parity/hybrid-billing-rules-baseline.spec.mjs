// Diagnostic only: exercise the original checked-in firestore.rules WITHOUT
// the Hybrid Candidate patch. Never connect to a live project or deploy rules.
// A normal PERMISSION_DENIED is expected; a 1000-expression evaluator failure
// must be surfaced by the strict runner instead of counting as a passing deny.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp as initClient, deleteApp as deleteClient } from "firebase/app";
import { getAuth, signInAnonymously, connectAuthEmulator } from "firebase/auth";
import { getFirestore as getClientDb, connectFirestoreEmulator,
  doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
const require = createRequire(import.meta.url);
const adminRequire = createRequire(new URL("../../functions/hybrid-billing-ledger.js", import.meta.url));
const { initializeApp: initAdmin, deleteApp: deleteAdmin } = adminRequire("firebase-admin/app");
const { getFirestore: getAdminDb } = adminRequire("firebase-admin/firestore");
const PROJECT = "demo-penguin-hybrid-rules-uat";
if (process.env.GCLOUD_PROJECT !== PROJECT
  || process.env.HYBRID_RULES_BASELINE_DIAGNOSTIC !== "1"
  || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8188"
  || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9098") {
  throw Error("HYBRID_ORIGINAL_RULES_BASELINE_ISOLATION_REQUIRED");
}
const app = initAdmin({ projectId: PROJECT }, "hybrid-original-rules-diagnostic");
const admin = getAdminDb(app);
const clientApp = initClient({
  apiKey: "demo-fake-api-key", authDomain: "localhost", projectId: PROJECT,
}, "hybrid-original-rules-diagnostic-client");
const auth = getAuth(clientApp);
connectAuthEmulator(auth, "http://127.0.0.1:9098", { disableWarnings: true });
const db = getClientDb(clientApp);
connectFirestoreEmulator(db, "127.0.0.1", 8188);
const tenantId = "tenant-original-baseline-001";
let uid;

test.before(async () => {
  uid = (await signInAnonymously(auth)).user.uid;
  await admin.collection("users").doc(uid).set({
    uid, role: "cashier", tenantId, active: true,
  });
  await admin.collection("tenants").doc(tenantId).set({
    ownerUid: "demo-real-owner-other", businessType: "both",
    billingPolicyVersion: "legacy", active: true,
  });
  await admin.collection("tenants").doc(tenantId).collection("orders")
    .doc("baseline-order-001").set({
      tenantId, orderType: "delivery", paymentMethod: "cash",
      paymentStatus: "unpaid", status: "pending", totalAmount: 100,
      items: [{ name: "Demo", qty: 1 }],
    });
});

test.after(async () => {
  await deleteClient(clientApp);
  await deleteAdmin(app);
});

test("original rules baseline: legitimate legacy cashier order update succeeds", async () => {
  const ref = doc(db, "tenants", tenantId, "orders", "baseline-order-001");
  assert.equal((await getDoc(ref)).data().status, "pending");
  await updateDoc(ref, { status: "ready" });
  assert.equal((await getDoc(ref)).data().status, "ready");
});

test("original rules baseline: ordinary cashier cannot update tenant root", async () => {
  await assert.rejects(updateDoc(doc(db, "tenants", tenantId), {
    active: false, hybridBillingSuspended: false,
  }), /permission/i);
});

test("original rules baseline: cashier cannot edit another user's profile", async () => {
  const victim = "demo-other-user-001";
  await admin.collection("users").doc(victim).set({
    tenantId, role: "owner", active: true,
  });
  await assert.rejects(updateDoc(doc(db, "users", victim), {
    role: "super_admin",
  }), /permission/i);
});

test("original rules baseline: cashier cannot perform malformed retail POS writes", async () => {
  await assert.rejects(setDoc(doc(db, "tenants", tenantId, "sales", "baseline-sale-001"), {
    tenantId, channel: "retail-pos", status: "completed",
    totalAmount: -100, totalQty: -1, items: [],
  }), /permission/i);
});
