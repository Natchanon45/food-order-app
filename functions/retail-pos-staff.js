const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const MANAGER_ROLES = new Set(["owner", "super_admin"]);
const POS_BUSINESS_UNIT = "retail_pos";

async function getCallerProfile(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const snapshot = await getFirestore().collection("users").doc(auth.uid).get();
  const profile = snapshot.data();
  if (!profile || profile.active === false || !MANAGER_ROLES.has(profile.role)) {
    throw new HttpsError("permission-denied", "POS staff management permission required");
  }
  return { uid: auth.uid, ...profile };
}

function tenantFromProfile(profile) {
  const id = String(profile.tenantId || "").trim();
  if (!id) throw new HttpsError("failed-precondition", "Tenant is missing from profile");
  return {
    id,
    slug: String(profile.tenantSlug || "").trim().toLowerCase(),
    name: String(profile.tenantName || "").trim()
  };
}

function clean(value = "") { return String(value || "").trim(); }
function normalizeEmail(value = "") { return clean(value).toLowerCase(); }
function normalizeRole(value = "") {
  const role = clean(value || "cashier");
  if (!role || role === "owner") throw new HttpsError("invalid-argument", "Invalid POS role");
  return role;
}
async function getUserByEmailOrNull(email) {
  try { return await getAuth().getUserByEmail(email); }
  catch (error) {
    if (error?.code === "auth/user-not-found") return null;
    throw error;
  }
}

exports.upsertRetailPosStaff = onCall({ region: "asia-southeast1" }, async request => {
  const caller = await getCallerProfile(request.auth);
  const tenant = tenantFromProfile(caller);
  const email = normalizeEmail(request.data?.email);
  const displayName = clean(request.data?.displayName || request.data?.name);
  const password = String(request.data?.password || "");
  const role = normalizeRole(request.data?.roleId || request.data?.role);
  const active = request.data?.active !== false;

  if (!email || !displayName) throw new HttpsError("invalid-argument", "Name and email are required");
  if (password && password.length < 6) throw new HttpsError("invalid-argument", "Password must be at least 6 characters");

  const auth = getAuth();
  let authUser = null;
  const uid = clean(request.data?.uid);
  if (uid) {
    try { authUser = await auth.getUser(uid); }
    catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
  }
  if (!authUser) authUser = await getUserByEmailOrNull(email);
  if (!authUser && !password) throw new HttpsError("invalid-argument", "Password is required for new POS user");

  if (!authUser) {
    authUser = await auth.createUser({ email, password, displayName, disabled: !active });
  } else {
    const update = { displayName, disabled: !active };
    if (password) update.password = password;
    await auth.updateUser(authUser.uid, update);
  }

  const db = getFirestore();
  const now = FieldValue.serverTimestamp();
  const payload = {
    uid: authUser.uid,
    id: authUser.uid,
    email,
    username: email,
    displayName,
    name: displayName,
    role,
    roleId: role,
    active,
    staffScope: "pos",
    source: "pos",
    userType: "retail_pos_staff",
    businessUnit: POS_BUSINESS_UNIT,
    businessUnits: [POS_BUSINESS_UNIT],
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    updatedAt: now,
    updatedBy: caller.uid
  };

  const batch = db.batch();
  batch.set(db.collection("users").doc(authUser.uid), { ...payload, createdAt: now, createdBy: caller.uid }, { merge: true });
  batch.set(db.collection("tenants").doc(tenant.id).collection("memberships").doc(authUser.uid), payload, { merge: true });
  batch.set(db.collection("tenants").doc(tenant.id).collection("users").doc(authUser.uid), payload, { merge: true });
  await batch.commit();

  return { ok: true, uid: authUser.uid, email, roleId: role };
});