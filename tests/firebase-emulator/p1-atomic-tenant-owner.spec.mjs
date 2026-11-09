import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
initializeApp({ projectId: "demo-penguin-hybrid" });
const db = getFirestore();
const provision = require("./tenant-provision");

const payload = {
  operationId: "5f9194a6-7f5b-47a3-81f0-5fa6e11c4817",
  name: "P1 Atomic Store", slug: "p1-atomic-test-store",
  phone: "021234567", address: "Bangkok",
  businessType: "both", ownerName: "Test Owner",
  ownerEmail: "p1-atomic-owner@example.com",
  ownerPassword: "test-password-only-987",
  planCode: "yearly",
};
const request = { auth: { uid: "p1-atomic-superadmin" }, data: payload };

test("provision requires Super Admin and confirmed central master pricing", async () => {
  await db.collection("users").doc("p1-atomic-superadmin")
    .set({ role: "super_admin", active: true });
  await db.collection("users").doc("p1-atomic-ordinary")
    .set({ role: "owner", active: true });
  await assert.rejects(provision.createActiveTenantWithOwner.run({
    auth: { uid: "p1-atomic-ordinary" }, data: payload,
  }), error => error.code === "permission-denied");
  await assert.rejects(provision.createActiveTenantWithOwner.run(request),
    error => error.code === "failed-precondition");
  assert.equal((await db.collection("tenantSlugs").doc(payload.slug).get()).exists, false);
  await db.collection("platformSettings").doc("subscriptionPricing")
    .set({ planId: "premium", monthlyPrice: 590, deliveryThreshold: 10000,
      deliveryShareRate: 5, annualMonths: 12, monthlySlipQuota: 100 });
});

test("one authenticated action creates Owner, tenant and trial with a durable idempotency receipt", async () => {
  const result = await provision.createActiveTenantWithOwner.run(request);
  assert.equal(result.ok, true);
  assert.equal(result.tenantActivated, true);
  assert.equal(result.planCode, "yearly");
  const id = result.tenant.id, uid = result.owner.uid;
  assert.ok(id && uid);
  const tenant = (await db.collection("tenants").doc(id).get()).data();
  const slug = (await db.collection("tenantSlugs").doc(payload.slug).get()).data();
  const user = (await db.collection("users").doc(uid).get()).data();
  const member = (await db.collection("tenants").doc(id).collection("memberships").doc(uid).get()).data();
  assert.equal(tenant.ownerUid, uid);
  assert.equal(tenant.onboardingRequired, false);
  assert.equal(tenant.active, true);
  assert.equal(slug.active, true);
  assert.equal(slug.tenantId, id);
  assert.equal(user.tenantId, id);
  assert.equal(user.role, "owner");
  assert.equal(member.uid, uid);
  assert.equal(tenant.subscriptionStatus, "trialing");
  assert.ok(tenant.trialEndsAt.toDate().getTime() > Date.now());
  assert.ok(tenant.subscriptionExpiresAt.toDate().getTime() >
    tenant.trialEndsAt.toDate().getTime());
  assert.equal((await getAuth().getUser(uid)).email, payload.ownerEmail);
  const replay = await provision.createActiveTenantWithOwner.run(request);
  assert.equal(replay.idempotent, true);
  assert.equal(replay.owner.uid, uid);
  assert.equal(replay.tenant.id, id);
});

test("duplicate slug, changed operation fingerprint and invalid fields fail closed", async () => {
  await assert.rejects(
    provision.createActiveTenantWithOwner.run({
      auth: request.auth, data: { ...payload, ownerName: "Changed Owner" },
    }),
    error => error.code === "already-exists",
  );
  await assert.rejects(
    provision.createActiveTenantWithOwner.run({
      auth: request.auth, data: { ...payload,
        operationId: "5f9194a6-7f5b-47a3-81f0-5fa6e11c4818",
        ownerEmail: "p1-other-owner@example.com" },
    }),
    error => error.code === "already-exists",
  );
  await assert.rejects(provision.createActiveTenantWithOwner.run({
    auth: request.auth, data: { ...payload,
      operationId: "5f9194a6-7f5b-47a3-81f0-5fa6e11c4819", planCode: "unknown" },
  }), error => error.code === "invalid-argument");
});

test("duplicate Auth email releases only its own uncommitted store slug for a new operation ID", async () => {
  const existingEmail = "p1-existing-email@example.com";
  const existing = await getAuth().createUser({
    email: existingEmail, password: "emulator-test-only-123",
  });
  const slug = "p1-released-slug";
  const initial = { ...payload,
    slug, ownerEmail: existingEmail,
    operationId: "7f9194a6-7f5b-47a3-81f0-5fa6e11c4817",
  };
  await assert.rejects(provision.createActiveTenantWithOwner.run({
    auth: request.auth, data: initial,
  }), error => error.code === "already-exists");
  const first = (await db.collection("platformTenantProvisions")
    .doc(initial.operationId).get()).data();
  assert.equal(first.status, "failed_released");
  assert.equal((await db.collection("tenantSlugs").doc(slug).get()).exists, false);
  assert.equal((await db.collection("tenants").doc(first.tenantId).get()).exists, false);
  assert.equal((await getAuth().getUser(existing.uid)).email, existingEmail);

  const corrected = { ...initial, ownerEmail: "p1-retried-owner@example.com",
    operationId: "7f9194a6-7f5b-47a3-81f0-5fa6e11c4818" };
  const result = await provision.createActiveTenantWithOwner.run({
    auth: request.auth, data: corrected,
  });
  assert.equal(result.ok, true);
  assert.equal(result.tenant.active, true);
  assert.equal((await db.collection("tenants").doc(result.tenant.id).get()).data().ownerUid,
    result.owner.uid);
});
