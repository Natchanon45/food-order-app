const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { randomUUID } = require("crypto");

function normalizeSlug(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function assertSuperAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const profileSnapshot = await getFirestore().collection("users").doc(auth.uid).get();
  const profile = profileSnapshot.data();
  if (!profile || profile.active === false || profile.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Super admin permission required");
  }
  return profile;
}

exports.listTenants = onCall(
  { region: "asia-southeast1" },
  async request => {
    await assertSuperAdmin(request.auth);
    const snapshot = await getFirestore().collection("tenants").orderBy("name").get();
    return {
      tenants: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    };
  }
);

exports.createTenant = onCall(
  { region: "asia-southeast1" },
  async request => {
    await assertSuperAdmin(request.auth);

    const name = String(request.data?.name || "").trim();
    const slug = normalizeSlug(request.data?.slug || "");
    const phone = String(request.data?.phone || "").trim();
    const address = String(request.data?.address || "").trim();

    if (name.length < 2 || name.length > 120) {
      throw new HttpsError("invalid-argument", "Tenant name must contain 2-120 characters");
    }
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
      throw new HttpsError("invalid-argument", "Slug must contain 3-50 lowercase letters, numbers, or hyphens");
    }

    const db = getFirestore();
    const slugRef = db.collection("tenantSlugs").doc(slug);
    const slugSnapshot = await slugRef.get();
    if (slugSnapshot.exists) throw new HttpsError("already-exists", "This slug is already in use");

    const tenantId = randomUUID();
    const tenantRef = db.collection("tenants").doc(tenantId);
    const settingsRef = tenantRef.collection("settings").doc("store");
    const batch = db.batch();

    batch.set(tenantRef, {
      id: tenantId,
      slug,
      name,
      active: true,
      createdBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    batch.set(slugRef, {
      tenantId,
      slug,
      name,
      active: true,
      createdAt: FieldValue.serverTimestamp()
    });
    batch.set(settingsRef, {
      tenantId,
      shopName: name,
      shopPhone: phone,
      shopAddress: address,
      deliveryFeeNearby: 0,
      deliveryFeeGeneral: 30,
      deliveryFeeFar: 50,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    await batch.commit();
    return { ok: true, tenant: { id: tenantId, slug, name, active: true } };
  }
);
