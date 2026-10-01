const crypto = require("node:crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const REGION = "asia-southeast1";
const CUSTOMER_UID_PREFIX = "cust_";

function normalizedTenantId(value) {
  const tenantId = String(value || "").trim();
  if (!tenantId) throw new HttpsError("invalid-argument", "Tenant is required");
  if (tenantId.length > 128 || tenantId.includes("/")) {
    throw new HttpsError("invalid-argument", "Tenant is invalid");
  }
  return tenantId;
}

function googleAuthenticated(request) {
  return Boolean(
    request.auth?.uid
    && request.auth?.token?.firebase?.sign_in_provider === "google.com"
  );
}

function customerUidFromSourceUid(sourceUid) {
  const digest = crypto
    .createHash("sha256")
    .update(String(sourceUid || ""), "utf8")
    .digest("hex")
    .slice(0, 28);
  return CUSTOMER_UID_PREFIX + digest;
}

function safeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

async function ensureCustomerAuthUser({
  customerUid,
  displayName,
  photoURL,
}) {
  const auth = getAuth();
  try {
    const existing = await auth.getUser(customerUid);
    const patch = {};
    if (displayName && existing.displayName !== displayName) patch.displayName = displayName;
    if (photoURL && existing.photoURL !== photoURL) patch.photoURL = photoURL;
    if (Object.keys(patch).length) await auth.updateUser(customerUid, patch);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    const payload = { uid: customerUid };
    if (displayName) payload.displayName = displayName;
    if (photoURL) payload.photoURL = photoURL;
    await auth.createUser(payload);
  }
}

async function migrateLegacyTenantCustomerProfile({
  tenantId,
  sourceUid,
  customerUid,
  email,
  displayName,
}) {
  const db = getFirestore();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnapshot = await tenantRef.get();
  if (!tenantSnapshot.exists) {
    throw new HttpsError("not-found", "Tenant not found");
  }

  const profiles = tenantRef.collection("customerProfiles");
  const targetRef = profiles.doc(customerUid);
  const targetSnapshot = await targetRef.get();
  if (targetSnapshot.exists) return;

  const legacyRef = profiles.doc(sourceUid);
  const legacySnapshot = await legacyRef.get();
  if (!legacySnapshot.exists) return;

  const legacy = legacySnapshot.data() || {};
  await targetRef.set({
    ...legacy,
    tenantId,
    email: email || String(legacy.email || ""),
    displayName: displayName || String(legacy.displayName || ""),
    migratedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

exports.createDeliveryCustomerSession = onCall(
  { region: REGION, timeoutSeconds: 20 },
  async request => {
    if (!googleAuthenticated(request)) {
      throw new HttpsError(
        "unauthenticated",
        "Delivery customer sign-in requires Google authentication"
      );
    }

    const tenantId = normalizedTenantId(request.data?.tenantId);
    const sourceUid = String(request.auth.uid);
    const email = safeText(request.auth.token.email, 320).toLowerCase();
    const emailVerified = request.auth.token.email_verified === true;
    if (!email || !emailVerified) {
      throw new HttpsError(
        "permission-denied",
        "A verified Google email is required"
      );
    }

    const customerUid = customerUidFromSourceUid(sourceUid);
    const displayName = safeText(request.auth.token.name, 120);
    const photoURL = safeText(request.auth.token.picture, 1024);

    await ensureCustomerAuthUser({
      customerUid,
      displayName,
      photoURL,
    });

    await migrateLegacyTenantCustomerProfile({
      tenantId,
      sourceUid,
      customerUid,
      email,
      displayName,
    });

    const customerClaims = {
      customerContext: true,
      customerEmail: email,
      customerGoogle: true,
    };
    await getAuth().setCustomUserClaims(customerUid, customerClaims);
    const customToken = await getAuth().createCustomToken(
      customerUid,
      customerClaims
    );

    return {
      customToken,
      customer: {
        uid: customerUid,
        email,
        displayName,
        photoURL,
      },
    };
  }
);
