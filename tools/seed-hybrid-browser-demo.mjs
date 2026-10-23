// DEV-only data seeder. All service hosts and project values must be DEMO
// localhost BEFORE importing firebase-admin or accessing ANY database.
import { createRequire } from "node:module";

const PROJECT = "demo-penguin-hybrid";
const hosts = {
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  FIREBASE_FUNCTIONS_EMULATOR_HOST: "127.0.0.1:5001",
};
if (process.env.HYBRID_DEMO_FUNCTIONS_ONLY !== "1"
  || Object.entries(hosts).some(([key, value]) => process.env[key] !== value)
  || [process.env.GCLOUD_PROJECT, process.env.GCP_PROJECT]
    .some(value => value && value !== PROJECT)) {
  throw new Error("HYBRID_DEMO_SEED_REFUSES_NONLOCAL_ENVIRONMENT");
}
let config = {};
try { config = JSON.parse(process.env.FIREBASE_CONFIG || "{}"); }
catch { throw new Error("HYBRID_DEMO_SEED_INVALID_CONFIG"); }
if (config.projectId && config.projectId !== PROJECT) {
  throw new Error("HYBRID_DEMO_SEED_REFUSES_NONDEMO_PROJECT");
}

const fnRequire = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = fnRequire("firebase-admin/app");
const { getAuth } = fnRequire("firebase-admin/auth");
const { getFirestore, FieldValue } = fnRequire("firebase-admin/firestore");

const app = initializeApp({ projectId: PROJECT, storageBucket: PROJECT + ".appspot.com" },
  "local-hybrid-browser-demo-seed");
const db = getFirestore(app);
const email = "hybrid-owner@demo.invalid";
const password = "EmulatorOnly123!";
const tenantId = "demo-hybrid-browser";
const invoiceId = "2026-10-24:monthly:fixed";

try {
  const auth = getAuth(app);
  let owner;
  try {
    owner = await auth.getUserByEmail(email);
    await auth.updateUser(owner.uid, { password, disabled: false, emailVerified: true });
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    owner = await auth.createUser({ email, password, emailVerified: true });
  }
  await db.collection("users").doc(owner.uid).set({
    role: "owner", tenantId, tenantSlug: tenantId,
    tenantName: "PENGUIN Demo Hybrid Browser",
    active: true, email, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db.collection("tenants").doc(tenantId).set({
    slug: tenantId, shopName: "PENGUIN Demo Hybrid Browser", name: "Demo Hybrid",
    ownerUid: owner.uid, active: true, hybridBillingSuspended: false,
    billingPolicyVersion: "hybrid_v1", subscriptionStatus: "active",
  }, { merge: true });
  const invoice = db.collection("tenants").doc(tenantId)
    .collection("hybridBillingInvoices").doc(invoiceId);
  const existing = await invoice.get();
  if (!existing.exists) {
    await invoice.create({
      id: invoiceId, tenantId, date: "2026-10-24", kind: "monthly_fixed",
      amount: 590, status: "issued", version: "hybrid-invoice-v1",
      signature: "a".repeat(64),
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  // This prints ONLY fixed synthetic emulator credentials; never any API key.
  process.stdout.write("DEMO_ONLY_FIREBASE_PROJECT: " + PROJECT + "\n");
  process.stdout.write("DEMO_LOGIN: " + email + "\n");
  process.stdout.write("DEMO_PASSWORD: " + password + "\n");
  process.stdout.write("DEMO_INVOICE: " + invoiceId + "\n");
  process.stdout.write("INVOICE_STATE: " + (existing.exists ? "preserved" : "seeded") + "\n");
} finally {
  await deleteApp(app);
}
