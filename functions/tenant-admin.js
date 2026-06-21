const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { randomUUID } = require("crypto");

function normalizeSlug(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function validateTenant(name, slug) {
  if (name.length < 2 || name.length > 120) {
    throw new HttpsError("invalid-argument", "Tenant name must contain 2-120 characters");
  }
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
    throw new HttpsError("invalid-argument", "Slug must contain 3-50 lowercase letters, numbers, or hyphens");
  }
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
    validateTenant(name, slug);

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
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
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

exports.createTenantOwner = onCall(
  { region: "asia-southeast1" },
  async request => {
    await assertSuperAdmin(request.auth);

    const tenantId = String(request.data?.tenantId || "").trim();
    const displayName = String(request.data?.displayName || "").trim();
    const email = String(request.data?.email || "").trim().toLowerCase();
    const password = String(request.data?.password || "");

    if (!tenantId) throw new HttpsError("invalid-argument", "Tenant ID is required");
    if (displayName.length < 2 || displayName.length > 120) {
      throw new HttpsError("invalid-argument", "Owner name must contain 2-120 characters");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "Owner email is invalid");
    }
    if (password.length < 8) {
      throw new HttpsError("invalid-argument", "Password must contain at least 8 characters");
    }

    const db = getFirestore();
    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnapshot = await tenantRef.get();
    if (!tenantSnapshot.exists) throw new HttpsError("not-found", "Tenant not found");

    const tenant = tenantSnapshot.data();
    if (tenant.active === false) throw new HttpsError("failed-precondition", "Tenant is inactive");

    const existingOwner = await tenantRef
      .collection("memberships")
      .where("role", "==", "owner")
      .where("active", "==", true)
      .limit(1)
      .get();
    if (!existingOwner.empty) {
      throw new HttpsError("already-exists", "This tenant already has an active owner");
    }

    let authUser;
    try {
      authUser = await getAuth().createUser({
        email,
        password,
        displayName,
        disabled: false,
        emailVerified: false
      });
    } catch (error) {
      if (error.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "This email is already registered");
      }
      if (error.code === "auth/invalid-password" || error.code === "auth/invalid-email") {
        throw new HttpsError("invalid-argument", error.message);
      }
      throw error;
    }

    const now = FieldValue.serverTimestamp();
    const userProfile = {
      uid: authUser.uid,
      email,
      displayName,
      role: "owner",
      active: true,
      tenantId,
      tenantSlug: tenant.slug || "",
      tenantName: tenant.name || "",
      createdAt: now,
      updatedAt: now
    };

    try {
      const batch = db.batch();
      batch.set(db.collection("users").doc(authUser.uid), userProfile);
      batch.set(tenantRef.collection("memberships").doc(authUser.uid), userProfile);
      batch.set(tenantRef, {
        ownerUid: authUser.uid,
        ownerEmail: email,
        ownerDisplayName: displayName,
        updatedAt: now
      }, { merge: true });
      await batch.commit();
    } catch (error) {
      await getAuth().deleteUser(authUser.uid).catch(() => {});
      throw error;
    }

    return {
      ok: true,
      owner: {
        uid: authUser.uid,
        email,
        displayName,
        role: "owner",
        tenantId
      }
    };
  }
);

exports.updateTenant = onCall(
  { region: "asia-southeast1" },
  async request => {
    await assertSuperAdmin(request.auth);

    const tenantId = String(request.data?.tenantId || "").trim();
    const name = String(request.data?.name || "").trim();
    const slug = normalizeSlug(request.data?.slug || "");
    const phone = String(request.data?.phone || "").trim();
    const address = String(request.data?.address || "").trim();
    if (!tenantId) throw new HttpsError("invalid-argument", "Tenant ID is required");
    validateTenant(name, slug);

    const db = getFirestore();
    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnapshot = await tenantRef.get();
    if (!tenantSnapshot.exists) throw new HttpsError("not-found", "Tenant not found");

    const current = tenantSnapshot.data();
    const oldSlug = String(current.slug || "").trim();
    const slugRef = db.collection("tenantSlugs").doc(slug);
    if (slug !== oldSlug) {
      const existingSlug = await slugRef.get();
      if (existingSlug.exists && existingSlug.data().tenantId !== tenantId) {
        throw new HttpsError("already-exists", "This slug is already in use");
      }
    }

    const batch = db.batch();
    batch.set(tenantRef, {
      name,
      slug,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    batch.set(tenantRef.collection("settings").doc("store"), {
      shopName: name,
      shopPhone: phone,
      shopAddress: address,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    batch.set(slugRef, {
      tenantId,
      slug,
      name,
      active: current.active !== false,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    if (oldSlug && oldSlug !== slug) batch.delete(db.collection("tenantSlugs").doc(oldSlug));

    const usersSnapshot = await db.collection("users").where("tenantId", "==", tenantId).get();
    usersSnapshot.docs.forEach(userDoc => {
      batch.set(userDoc.ref, {
        tenantSlug: slug,
        tenantName: name,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      batch.set(tenantRef.collection("memberships").doc(userDoc.id), {
        tenantSlug: slug,
        tenantName: name,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });

    await batch.commit();
    return { ok: true, tenant: { id: tenantId, slug, name, active: current.active !== false } };
  }
);

exports.deleteTenant = onCall(
  { region: "asia-southeast1" },
  async request => {
    await assertSuperAdmin(request.auth);

    const tenantId = String(request.data?.tenantId || "").trim();
    if (!tenantId) throw new HttpsError("invalid-argument", "Tenant ID is required");

    const db = getFirestore();
    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnapshot = await tenantRef.get();
    if (!tenantSnapshot.exists) throw new HttpsError("not-found", "Tenant not found");

    const protectedCollections = ["orders", "memberships", "menus", "tables", "notificationTokens", "deliveryCustomers"];
    for (const collectionName of protectedCollections) {
      const snapshot = await tenantRef.collection(collectionName).limit(1).get();
      if (!snapshot.empty) {
        throw new HttpsError("failed-precondition", `Tenant contains data in ${collectionName}`);
      }
    }

    const slug = String(tenantSnapshot.data().slug || "").trim();
    if (slug) await db.collection("tenantSlugs").doc(slug).delete().catch(() => {});
    await db.recursiveDelete(tenantRef);
    return { ok: true, tenantId };
  }
);