const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { randomUUID } = require("crypto");

const PLAN_ID = "premium";
const TRIAL_DAYS = 30;
const BUSINESS_UNITS = ["order_delivery", "retail_pos"];

function clean(value = "") { return String(value || "").trim(); }
function normalizeEmail(value = "") { return clean(value).toLowerCase(); }
function normalizeSlug(value = "") {
  return clean(value).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function validateSlug(slug) {
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) throw new HttpsError("invalid-argument", "Slug must contain 3-50 lowercase letters, numbers, or hyphens");
}
function validateText(value, label, min = 2, max = 120) {
  const text = clean(value);
  if (text.length < min || text.length > max) throw new HttpsError("invalid-argument", `${label} is required`);
  return text;
}
function assertAuth(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  return request.auth.uid;
}
function trialEndDate() { return new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000); }

exports.requestTrialTenantSignup = onCall({ region: "asia-southeast1" }, async request => {
  const uid = assertAuth(request);
  const authEmail = normalizeEmail(request.auth.token.email || "");
  const email = normalizeEmail(request.data?.email || authEmail);
  if (!authEmail || email !== authEmail) throw new HttpsError("permission-denied", "Email must match authenticated user");

  const ownerName = validateText(request.data?.ownerName, "Owner name");
  const phone = validateText(request.data?.phone, "Phone", 8, 30);
  const orderDeliveryShopName = validateText(request.data?.orderDeliveryShopName, "Order/Delivery shop name");
  const retailPosShopName = validateText(request.data?.retailPosShopName, "Retail POS shop name");
  const slug = normalizeSlug(request.data?.slug);
  validateSlug(slug);
  const packageId = clean(request.data?.packageId || PLAN_ID).toLowerCase();
  if (packageId !== PLAN_ID) throw new HttpsError("failed-precondition", "Only Premium trial is available now");

  const db = getFirestore();
  const pendingRef = db.collection("publicTenantSignups").doc(uid);
  const pendingSlugRef = db.collection("publicTenantSignupSlugs").doc(slug);
  const tenantSlugRef = db.collection("tenantSlugs").doc(slug);
  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async tx => {
    const [tenantSlugSnap, pendingSlugSnap] = await Promise.all([tx.get(tenantSlugRef), tx.get(pendingSlugRef)]);
    if (tenantSlugSnap.exists) throw new HttpsError("already-exists", "This slug is already in use");
    if (pendingSlugSnap.exists && pendingSlugSnap.data()?.uid !== uid) throw new HttpsError("already-exists", "This slug is already reserved");
    const payload = {
      uid,
      email,
      ownerName,
      phone,
      orderDeliveryShopName,
      retailPosShopName,
      slug,
      packageId: PLAN_ID,
      plan: PLAN_ID,
      status: "email_verification_required",
      previewUrl: `https://natchanon-food-order-delivery.web.app/s/${slug}/`,
      updatedAt: now,
      createdAt: now
    };
    tx.set(pendingRef, payload, { merge: true });
    tx.set(pendingSlugRef, { uid, slug, email, status: "pending", updatedAt: now, createdAt: now }, { merge: true });
  });

  return { ok: true, slug, email, previewUrl: `https://natchanon-food-order-delivery.web.app/s/${slug}/` };
});

exports.activateTrialTenantSignup = onCall({ region: "asia-southeast1" }, async request => {
  const uid = assertAuth(request);
  const authUser = await getAuth().getUser(uid);
  if (!authUser.emailVerified) throw new HttpsError("failed-precondition", "Email verification is required");

  const db = getFirestore();
  const pendingRef = db.collection("publicTenantSignups").doc(uid);
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists) throw new HttpsError("not-found", "Signup request not found");
  const pending = pendingSnap.data();
  if (pending.status === "active" && pending.tenantId) return { ok: true, tenantId: pending.tenantId, slug: pending.slug };

  const slug = normalizeSlug(pending.slug);
  validateSlug(slug);
  const tenantId = randomUUID();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSlugRef = db.collection("tenantSlugs").doc(slug);
  const pendingSlugRef = db.collection("publicTenantSignupSlugs").doc(slug);
  const userRef = db.collection("users").doc(uid);
  const membershipRef = tenantRef.collection("memberships").doc(uid);
  const now = FieldValue.serverTimestamp();
  const trialEndsAt = trialEndDate();

  await db.runTransaction(async tx => {
    const [tenantSlugSnap, pendingSlugSnap] = await Promise.all([tx.get(tenantSlugRef), tx.get(pendingSlugRef)]);
    if (tenantSlugSnap.exists) throw new HttpsError("already-exists", "This slug is already in use");
    if (pendingSlugSnap.exists && pendingSlugSnap.data()?.uid !== uid) throw new HttpsError("permission-denied", "Slug reservation is owned by another user");

    const ownerProfile = {
      uid,
      email: authUser.email || pending.email || "",
      displayName: pending.ownerName,
      phone: pending.phone || "",
      role: "owner",
      active: true,
      tenantId,
      tenantSlug: slug,
      tenantName: pending.orderDeliveryShopName,
      packageId: PLAN_ID,
      plan: PLAN_ID,
      subscriptionStatus: "trialing",
      trialStartsAt: now,
      trialEndsAt,
      businessUnits: BUSINESS_UNITS,
      updatedAt: now,
      createdAt: now
    };
    const tenantPayload = {
      id: tenantId,
      slug,
      name: pending.orderDeliveryShopName,
      orderDeliveryShopName: pending.orderDeliveryShopName,
      retailPosShopName: pending.retailPosShopName,
      phone: pending.phone || "",
      ownerUid: uid,
      ownerEmail: authUser.email || pending.email || "",
      ownerDisplayName: pending.ownerName,
      active: true,
      packageId: PLAN_ID,
      plan: PLAN_ID,
      subscriptionStatus: "trialing",
      trialStartsAt: now,
      trialEndsAt,
      businessUnits: BUSINESS_UNITS,
      createdBy: uid,
      updatedAt: now,
      createdAt: now
    };
    tx.set(tenantRef, tenantPayload);
    tx.set(tenantSlugRef, { tenantId, slug, name: pending.orderDeliveryShopName, active: true, createdAt: now, updatedAt: now });
    tx.set(tenantRef.collection("settings").doc("store"), {
      tenantId,
      shopName: pending.orderDeliveryShopName,
      shopPhone: pending.phone || "",
      deliveryFeeNearby: 0,
      deliveryFeeGeneral: 30,
      deliveryFeeFar: 50,
      createdAt: now,
      updatedAt: now
    });
    tx.set(tenantRef.collection("settings").doc("retailPos"), {
      tenantId,
      shopName: pending.retailPosShopName,
      createdAt: now,
      updatedAt: now
    });
    tx.set(tenantRef.collection("settings").doc("subscription"), {
      tenantId,
      packageId: PLAN_ID,
      plan: PLAN_ID,
      status: "trialing",
      trialDays: TRIAL_DAYS,
      trialStartsAt: now,
      trialEndsAt,
      createdAt: now,
      updatedAt: now
    });
    tx.set(userRef, ownerProfile, { merge: true });
    tx.set(membershipRef, ownerProfile, { merge: true });
    tx.set(pendingRef, { status: "active", tenantId, activatedAt: now, updatedAt: now }, { merge: true });
    tx.set(pendingSlugRef, { uid, slug, tenantId, status: "active", updatedAt: now }, { merge: true });
  });

  return { ok: true, tenantId, slug, plan: PLAN_ID, trialEndsAt: trialEndsAt.toISOString() };
});