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
