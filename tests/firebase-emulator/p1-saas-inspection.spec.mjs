import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080") throw new Error("DEMO_EMULATOR_REQUIRED");
if (!getApps().length) initializeApp({ projectId: "demo-penguin-hybrid" });
const db = getFirestore();
const { inspectLegacySaasMigration, migrateLegacySaasStore } = require("./saas-migration");
const target = "ff897699-de82-4370-a360-35b22cc74c85";
const admin = "p1-saas-inspection-admin";
const owner = "p1-saas-inspection-owner";
test("SaaS inspection and migration reject anonymous, tenant Owner and inactive Super Admin", async () => {
  await db.collection("users").doc(owner).set({ role: "owner", tenantId: "another-tenant", active: true });
  await db.collection("users").doc(admin).set({ role: "super_admin", active: false });
  for (const callable of [inspectLegacySaasMigration, migrateLegacySaasStore]) {
    await assert.rejects(callable.run({ data: { action: "prepare" } }), e => e.code === "unauthenticated");
    for (const uid of [owner, admin]) await assert.rejects(callable.run({ auth: { uid },
      data: { action: "prepare", tenantId: "another-tenant" },
    }), e => e.code === "permission-denied");
  }
  assert.equal((await db.collection("tenants").doc(target).get()).exists, false);
});
test("SaaS inspection returns fixed source counts without provisioning a tenant or accepting caller scope", async () => {
  await db.collection("users").doc(admin).set({ role: "super_admin", active: true });
  await db.collection("shops").doc("default-shop").collection("menus").doc("demo-inspection-menu").set({ name: "Synthetic inspection only" });
  const result = await inspectLegacySaasMigration.run({ auth: { uid: admin },
    data: { tenantId: "another-tenant", sourceShopId: "not-authorized" } });
  assert.equal(result.ok, true);
  assert.equal(result.summary.tenantId, target);
  assert.equal(result.summary.tenantSlug, "tuahere-somtam");
  assert.equal(result.summary.menus, 1);
  assert.equal(result.summary.tenantExists, false);
  assert.equal((await db.collection("tenants").doc(target).get()).exists, false);
  assert.equal((await db.collection("tenants").doc("another-tenant").get()).exists, false);
  await assert.rejects(migrateLegacySaasStore.run({ auth: { uid: admin },
    data: { action: "unknown" } }), e => e.code === "invalid-argument");
});
