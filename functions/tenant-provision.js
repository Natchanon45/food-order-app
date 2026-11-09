"use strict";
// One-call, fail-closed tenant/owner provisioning. Auth cannot participate in
// a Firestore transaction, so reserve operation+slug first and compensate Auth.
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { randomUUID, createHash } = require("node:crypto");
const { BUSINESS_TYPES, businessUnitsFor } = require("./revenue-share-policy");
const { onboardingDates } = require("./tenant-onboarding-policy");
const { loadPricing } = require("./subscription-pricing-core");

async function assertAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Login required");
  const user = (await getFirestore().collection("users").doc(auth.uid).get()).data();
  if (!user || user.active === false || user.role !== "super_admin")
    throw new HttpsError("permission-denied", "Super Admin required");
}
function validate(data) {
  const fields = {
    name: String(data?.name || "").trim(),
    slug: String(data?.slug || "").trim().toLowerCase(),
    phone: String(data?.phone || "").trim(),
    address: String(data?.address || "").trim(),
    businessType: String(data?.businessType || "both"),
    ownerName: String(data?.ownerName || "").trim(),
    ownerEmail: String(data?.ownerEmail || "").trim().toLowerCase(),
    ownerPassword: String(data?.ownerPassword || ""),
    planCode: String(data?.planCode || ""),
    operationId: String(data?.operationId || "").trim().toLowerCase(),
  };
  if (fields.name.length < 2 || fields.name.length > 120
    || !/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(fields.slug)
    || fields.phone.length > 30 || fields.address.length > 300
    || !BUSINESS_TYPES.has(fields.businessType)
    || fields.ownerName.length < 2 || fields.ownerName.length > 120
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.ownerEmail)
    || Buffer.byteLength(fields.ownerPassword, "utf8") < 8
    || Buffer.byteLength(fields.ownerPassword, "utf8") > 72
    || !["monthly", "yearly"].includes(fields.planCode)
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(fields.operationId))
    throw new HttpsError("invalid-argument", "Invalid store or owner fields");
  return fields;
}
function fingerprint(value) {
  const { ownerPassword, ...publicFields } = value;
  return createHash("sha256").update(JSON.stringify(publicFields)).digest("hex");
}
function result(op, replay = false) {
  return { ok: true, tenantActivated: true, planCode: op.planCode,
    tenant: { id: op.tenantId, name: op.name, slug: op.slug, active: true },
    owner: { uid: op.ownerUid, role: "owner" }, idempotent: replay };
}
exports._privateForTests = { validate, fingerprint, result };

exports.createActiveTenantWithOwner = onCall(
  { region: "asia-southeast1", timeoutSeconds: 60 }, async request => {
    await assertAdmin(request.auth);
    const input = validate(request.data);
    const db = getFirestore(), auth = getAuth();
    const opRef = db.collection("platformTenantProvisions").doc(input.operationId);
    const slugRef = db.collection("tenantSlugs").doc(input.slug);
    const proof = fingerprint(input);

    const old = await opRef.get();
    if (old.exists) {
      const saved = old.data();
      if (saved.createdBy !== request.auth.uid || saved.fingerprint !== proof)
        throw new HttpsError("already-exists", "Operation ID already used");
      if (saved.status === "complete") return result(saved, true);
      throw new HttpsError("failed-precondition", "Provisioning requires Super Admin review",
        { code: "TENANT_PROVISION_REVIEW_REQUIRED" });
    }
    // Do not start the free period if master subscription pricing is absent.
    const central = await db.collection("platformSettings").doc("subscriptionPricing").get();
    if (!central.exists)
      throw new HttpsError("failed-precondition", "Configure platform pricing first");
    const pricing = await loadPricing(db);
    if (!(pricing.monthlyPrice > 0 && pricing.deliveryThreshold > 0 &&
      pricing.deliveryShareRate >= 0 && pricing.deliveryShareRate <= 100))
      throw new HttpsError("failed-precondition", "Platform pricing is invalid");

    const tenantId = randomUUID();
    const reserved = { status: "reserved", createdBy: request.auth.uid,
      fingerprint: proof, tenantId, name: input.name, slug: input.slug,
      planCode: input.planCode, createdAt: Timestamp.now() };
    await db.runTransaction(async tx => {
      const [op, slug] = await Promise.all([tx.get(opRef), tx.get(slugRef)]);
      if (op.exists || slug.exists)
        throw new HttpsError("already-exists", "Store slug or operation already exists");
      tx.create(opRef, reserved);
      tx.create(slugRef, {
        tenantId, slug: input.slug, name: input.name, active: false,
        provisioningId: input.operationId, createdAt: Timestamp.now(),
      });
    });

    let createdAuth;
    try {
      createdAuth = await auth.createUser({
        email: input.ownerEmail, password: input.ownerPassword,
        displayName: input.ownerName, disabled: false, emailVerified: false,
      });
      const start = new Date(), dates = onboardingDates(start, input.planCode);
      const started = Timestamp.fromDate(start);
      const trialEnd = Timestamp.fromDate(dates.trialEndsAt);
      const expiry = Timestamp.fromDate(dates.subscriptionExpiresAt);
      const tenantRef = db.collection("tenants").doc(tenantId);
      const userRef = db.collection("users").doc(createdAuth.uid);
      const profile = {
        uid: createdAuth.uid, email: input.ownerEmail, displayName: input.ownerName,
        role: "owner", active: true, tenantId, tenantSlug: input.slug,
        tenantName: input.name, createdAt: started, updatedAt: started,
      };
      await db.runTransaction(async tx => {
        const [op, slug] = await Promise.all([tx.get(opRef), tx.get(slugRef)]);
        if (op.data()?.status !== "reserved" ||
          op.data()?.tenantId !== tenantId ||
          slug.data()?.provisioningId !== input.operationId)
          throw new HttpsError("failed-precondition", "Provision reservation changed");
        tx.create(tenantRef, {
          id: tenantId, name: input.name, slug: input.slug, active: true,
          onboardingRequired: false, firstActivatedAt: started,
          trialStartsAt: started, trialEndsAt: trialEnd,
          subscriptionStartedAt: started, subscriptionExpiresAt: expiry,
          subscriptionStatus: "trialing", gracePeriodDays: 3,
          planCode: input.planCode,
          ownerUid: createdAuth.uid, ownerEmail: input.ownerEmail,
          ownerDisplayName: input.ownerName, businessType: input.businessType,
          businessUnits: businessUnitsFor(input.businessType),
          signupBilling: {
            planCode: input.planCode, businessType: input.businessType,
            billingMode: "subscription",
          },
          createdBy: request.auth.uid, createdAt: started, updatedAt: started,
        });
        tx.create(tenantRef.collection("settings").doc("store"), {
          tenantId, shopName: input.name, shopPhone: input.phone,
          shopAddress: input.address, deliveryFeeNearby: 0,
          deliveryFeeGeneral: 30, deliveryFeeFar: 50,
          createdAt: started, updatedAt: started,
        });
        tx.create(userRef, profile);
        tx.create(tenantRef.collection("memberships").doc(createdAuth.uid), profile);
        tx.update(slugRef, {
          active: true, ownerUid: createdAuth.uid, firstActivatedAt: started,
          subscriptionExpiresAt: expiry, subscriptionStatus: "trialing",
          planCode: input.planCode, onboardingRequired: false, updatedAt: started,
        });
        tx.update(opRef, {
          status: "complete", ownerUid: createdAuth.uid, completedAt: started,
        });
      });
      return result({ ...reserved, ownerUid: createdAuth.uid }, false);
    } catch (error) {
      // A timed-out transaction might already have committed. Never delete an
      // Auth owner unless the persisted operation is definitely still reserved.
      let op;
      try { op = (await opRef.get()).data(); }
      catch {
        throw new HttpsError("failed-precondition", "Provision result uncertain; review required",
          { code: "TENANT_PROVISION_REVIEW_REQUIRED" });
      }
      if (op?.status === "complete" && op.ownerUid === createdAuth?.uid)
        return result(op, true);
      if (op?.status !== "reserved")
        throw new HttpsError("failed-precondition", "Provision requires manual review",
          { code: "TENANT_PROVISION_REVIEW_REQUIRED" });
      if (createdAuth) {
        try { await auth.deleteUser(createdAuth.uid); }
        catch {
          throw new HttpsError("failed-precondition", "Owner rollback failed; review required",
            { code: "TENANT_PROVISION_REVIEW_REQUIRED" });
        }
      }
      // Do not reuse the same slug automatically after an uncertain operation.
      await opRef.update({ status: "failed_review_required", failedAt: Timestamp.now() })
        .catch(() => {});
      if (error instanceof HttpsError) throw error;
      if (error?.code === "auth/email-already-exists")
        throw new HttpsError("already-exists", "Owner email already registered");
      throw new HttpsError("failed-precondition", "Provision requires manual review",
        { code: "TENANT_PROVISION_REVIEW_REQUIRED" });
    }
  },
);
