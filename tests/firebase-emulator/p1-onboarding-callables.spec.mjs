import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp({ projectId: "demo-penguin-hybrid" });
const db = getFirestore(), adminAuth = getAuth();
const tenantCalls = require("./tenant-admin");
const staffCalls = require("./staff-admin");
const admin = { auth: { uid: "p1-superadmin" } };

test("Superadmin-only tenant and owner provisioning is inaccessible until the Owner exists", async () => {
  await db.collection("users").doc(admin.auth.uid).set({ role: "super_admin", active: true });
  await db.collection("users").doc("p1-not-superadmin").set({ role: "admin", active: true });
  const key = "p1-test-tenant";
  await assert.rejects(
    tenantCalls.createTenant.run({ auth: { uid: "p1-not-superadmin" },
      data: { name: "Not authorized", slug: key } }),
    error => error.code === "permission-denied",
  );

  const created = await tenantCalls.createTenant.run({
    ...admin, data: { name: "P1 test shop", slug: key, phone: "021234567", address: "Bangkok" },
  });
  assert.equal(created.ok, true);
  const tenantId = created.tenant.id;
  assert.equal(created.tenant.active, false);
  assert.equal(created.tenant.onboardingRequired, true);
  const provisional = (await db.collection("tenants").doc(tenantId).get()).data();
  assert.equal(provisional.ownerUid, undefined);
  assert.equal(provisional.active, false);
  assert.equal((await db.collection("tenantSlugs").doc(key).get()).data().active, false);

  const owner = await tenantCalls.createTenantOwner.run({
    ...admin, data: { tenantId, displayName: "Test owner",
      email: "p1-test-owner@example.com", password: "example-only-123", planCode: "yearly" },
  });
  assert.equal(owner.ok, true);
  const actual = (await db.collection("tenants").doc(tenantId).get()).data();
  assert.equal(actual.active, true);
  assert.equal(actual.onboardingRequired, false);
  assert.equal(actual.planCode, "yearly");
  assert.equal(actual.subscriptionStatus, "trialing");
  assert.equal(actual.ownerUid, owner.owner.uid);
  assert.equal((await db.collection("tenantSlugs").doc(key).get()).data().active, true);
  assert.equal((await db.collection("users").doc(owner.owner.uid).get()).data().role, "owner");
  assert.equal((await db.collection("tenants").doc(tenantId).collection("memberships")
    .doc(owner.owner.uid).get()).data().role, "owner");

  const trial = actual.trialEndsAt.toDate(), expiry = actual.subscriptionExpiresAt.toDate();
  assert.ok(trial.getTime() > Date.now());
  assert.ok(expiry.getTime() > trial.getTime());
  assert.equal(expiry.getUTCFullYear(), trial.getUTCFullYear() + 1);

  await assert.rejects(
    tenantCalls.createTenantOwner.run({
      ...admin, data: { tenantId, displayName: "Duplicate",
        email: "duplicate-owner@example.com", password: "example-only-456", planCode: "yearly" },
    }),
    error => error.code === "already-exists",
  );

  const ownerAuth = { auth: { uid: owner.owner.uid } };
  const staff = await staffCalls.listTenantStaff.run({
    ...ownerAuth, data: { expectedTenantId: tenantId },
  });
  assert.ok(Array.isArray(staff.users));
  await assert.rejects(
    staffCalls.listTenantStaff.run({ ...ownerAuth, data: { expectedTenantId: "another-tenant" } }),
    error => error.code === "permission-denied",
  );
  await assert.rejects(
    staffCalls.createTenantStaff.run({ ...ownerAuth,
      data: { expectedTenantId: "another-tenant" } }),
    error => error.code === "permission-denied",
  );
  const authOwner = await adminAuth.getUser(owner.owner.uid);
  assert.equal(authOwner.disabled, false);
});

test("only Super Admin can retrieve masked payment account fields, never raw identifiers", async () => {
  const tenant = (await db.collection("tenants")
    .where("slug", "==", "p1-test-tenant").limit(1).get()).docs[0];
  assert.ok(tenant, "test tenant must exist");
  const accountNumber = "1234567890";
  const promptPay = "0899991234";
  await tenant.ref.collection("settings").doc("store").set({
    bankName: "Emulator Bank",
    bankAccountName: "Emulator Owner",
    bankAccountNumber: accountNumber,
    promptPayId: promptPay,
    promptPayName: "Emulator Owner",
    deliveryPromptPayEnabled: true,
  }, { merge: true });
  await assert.rejects(
    tenantCalls.getPlatformTenantSavedPaymentAccount.run({
      auth: { uid: "p1-not-superadmin" }, data: { tenantId: tenant.id },
    }),
    error => error.code === "permission-denied",
  );
  const response = await tenantCalls.getPlatformTenantSavedPaymentAccount.run({
    ...admin, data: { tenantId: tenant.id },
  });
  assert.equal(response.ok, true);
  assert.equal(response.readOnly, true);
  assert.equal(response.source, "firebase_saved_store_settings");
  assert.equal(response.account.bankAccountMasked, "•••• 7890");
  assert.equal(response.account.promptPayMasked, "•••• 1234");
  assert.equal(response.account.ownershipVerified, false);
  assert.equal(JSON.stringify(response).includes(accountNumber), false);
  assert.equal(JSON.stringify(response).includes(promptPay), false);
});
