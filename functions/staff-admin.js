const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const ALLOWED_STAFF_ROLES = new Set(["admin", "cashier", "kitchen"]);
const STAFF_MANAGER_ROLES = new Set(["owner", "super_admin"]);
const STAFF_SCOPE = "restaurant";
const BUSINESS_UNIT = "order_delivery";
const POS_BUSINESS_UNIT = "retail_pos";
const BUSINESS_SCOPES = new Set(["order_delivery", "retail_pos", "both"]);

async function getCallerProfile(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const snapshot = await getFirestore().collection("users").doc(auth.uid).get();
  const profile = snapshot.data();
  if (!profile || profile.active === false || !STAFF_MANAGER_ROLES.has(profile.role)) {
    throw new HttpsError("permission-denied", "Staff management permission required");
  }
  return { uid: auth.uid, ...profile };
}

function tenantFromProfile(profile) {
  const tenantId = String(profile.tenantId || "").trim();
  if (!tenantId) throw new HttpsError("failed-precondition", "Tenant is missing from profile");
  return {
    id: tenantId,
    slug: String(profile.tenantSlug || "").trim().toLowerCase(),
    name: String(profile.tenantName || "").trim()
  };
}

function normalizeRole(role) {
  const value = String(role || "").trim();
  if (!ALLOWED_STAFF_ROLES.has(value)) throw new HttpsError("invalid-argument", "Invalid staff role");
  return value;
}

function businessUnit(user = {}) {
  return String(user.businessUnit || user.business_unit || "").trim().toLowerCase();
}

function normalizeBusinessScope(value, user = {}, strict = false) {
  const requested = String(value || user.businessScope || user.business_scope || "").trim().toLowerCase();
  if (BUSINESS_SCOPES.has(requested)) return requested;
  if (requested && strict) throw new HttpsError("invalid-argument", "Invalid business scope");
  const unit = businessUnit(user);
  if (unit === POS_BUSINESS_UNIT) return "retail_pos";
  if (unit === "all" || unit === "both") return "both";
  return "order_delivery";
}

function businessUnitForScope(scope) {
  if (scope === "retail_pos") return POS_BUSINESS_UNIT;
  if (scope === "both") return "all";
  return BUSINESS_UNIT;
}

function isManagedStaff(user = {}) {
  return ALLOWED_STAFF_ROLES.has(String(user.role || "").trim());
}

exports.listTenantStaff = onCall({ region: "asia-southeast1" }, async request => {
  const caller = await getCallerProfile(request.auth);
  const tenant = tenantFromProfile(caller);
  const snapshot = await getFirestore()
    .collection("tenants")
    .doc(tenant.id)
    .collection("memberships")
    .get();

  return {
    users: snapshot.docs
      .map(doc => ({ uid: doc.id, ...doc.data() }))
      .filter(isManagedStaff)
      .sort((a, b) => String(a.displayName || a.email || "").localeCompare(String(b.displayName || b.email || ""), "th"))
  };
});

exports.createTenantStaff = onCall({ region: "asia-southeast1" }, async request => {
  const caller = await getCallerProfile(request.auth);
  const tenant = tenantFromProfile(caller);
  const email = String(request.data?.email || "").trim().toLowerCase();
  const password = String(request.data?.password || "");
  const displayName = String(request.data?.displayName || "").trim();
  const role = normalizeRole(request.data?.role);
  const active = request.data?.active !== false;
  const businessScope = normalizeBusinessScope(request.data?.businessScope, {}, true);

  if (!displayName || !email || password.length < 8) {
    throw new HttpsError("invalid-argument", "Name, email and password are required");
  }

  let authUser;
  try {
    authUser = await getAuth().createUser({ email, password, displayName, disabled: !active });
  } catch (error) {
    if (error?.code === "auth/email-already-exists") throw new HttpsError("already-exists", "This email is already in use");
    if (error?.code === "auth/invalid-email" || error?.code === "auth/invalid-password") throw new HttpsError("invalid-argument", error.message);
    throw error;
  }
  const db = getFirestore();
  const payload = {
    uid: authUser.uid,
    email,
    displayName,
    role,
    staffScope: STAFF_SCOPE,
    businessScope,
    businessUnit: businessUnitForScope(businessScope),
    source: businessScope,
    active,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    createdBy: caller.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  try {
    const batch = db.batch();
    batch.set(db.collection("users").doc(authUser.uid), payload);
    batch.set(db.collection("tenants").doc(tenant.id).collection("memberships").doc(authUser.uid), payload);
    await batch.commit();
    return { ok: true, uid: authUser.uid };
  } catch (error) {
    await getAuth().deleteUser(authUser.uid).catch(() => {});
    throw error;
  }
});

exports.updateTenantStaff = onCall({ region: "asia-southeast1" }, async request => {
  const caller = await getCallerProfile(request.auth);
  const tenant = tenantFromProfile(caller);
  const uid = String(request.data?.uid || "").trim();
  if (!uid || uid === caller.uid) throw new HttpsError("invalid-argument", "Invalid staff account");

  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);
  const userSnapshot = await userRef.get();
  const user = userSnapshot.data();
  if (!user || user.tenantId !== tenant.id || !isManagedStaff(user)) {
    throw new HttpsError("permission-denied", "Staff account is outside this tenant");
  }

  const displayName = String(request.data?.displayName || "").trim();
  const role = normalizeRole(request.data?.role);
  const active = request.data?.active !== false;
  const businessScope = normalizeBusinessScope(request.data?.businessScope, user, true);
  if (!displayName) throw new HttpsError("invalid-argument", "Display name is required");

  await getAuth().updateUser(uid, { displayName, disabled: !active });
  const patch = { displayName, role, staffScope: STAFF_SCOPE, businessScope, businessUnit: businessUnitForScope(businessScope), source: businessScope, active, updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid };
  const batch = db.batch();
  batch.set(userRef, patch, { merge: true });
  batch.set(db.collection("tenants").doc(tenant.id).collection("memberships").doc(uid), patch, { merge: true });
  await batch.commit();
  return { ok: true };
});