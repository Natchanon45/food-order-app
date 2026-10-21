const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { transactLegacyMigration } = require("./hybrid-billing-legacy-migration-guard");

const SOURCE_SHOP_ID = "default-shop";
const TARGET_TENANT = Object.freeze({
  id: "ff897699-de82-4370-a360-35b22cc74c85",
  slug: "tuahere-somtam",
  name: "ส้มตำตัวเฮีย",
});
const COLLECTIONS = Object.freeze(["menus", "tables", "orders", "deliveryCustomers"]);

async function assertSuperAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const profile = (await getFirestore().collection("users").doc(auth.uid).get()).data();
  if (!profile || profile.active === false || profile.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Super admin permission required");
  }
  return profile;
}

async function ensureTenant(auth, profile) {
  const db = getFirestore(), tenantRef = db.collection("tenants").doc(TARGET_TENANT.id);
  return transactLegacyMigration({ db, tenantRef, allowCreate: true,
    onAllowed: (tx, snap) => {
      const existing = snap.exists ? snap.data() : {}, now = FieldValue.serverTimestamp();
      tx.set(tenantRef, {
        id: TARGET_TENANT.id, slug: TARGET_TENANT.slug, name: TARGET_TENANT.name,
        status: existing.status || "active", plan: existing.plan || "development",
        ownerId: existing.ownerId || auth.uid, updatedAt: now,
        ...(snap.exists ? {} : { createdAt: now }),
      }, { merge: true });
      tx.set(db.collection("tenantSlugs").doc(TARGET_TENANT.slug), {
        tenantId: TARGET_TENANT.id, slug: TARGET_TENANT.slug,
        name: TARGET_TENANT.name, active: true, updatedAt: now,
      }, { merge: true });
      tx.set(tenantRef.collection("memberships").doc(auth.uid), {
        uid: auth.uid, email: String(auth.token?.email || profile.email || ""),
        displayName: String(profile.displayName || auth.token?.name ||
          auth.token?.email || "Owner"),
        role: "owner", active: true, updatedAt: now,
      }, { merge: true });
    },
  });
}
async function copyCollection(name, overwrite) {
  if (!COLLECTIONS.includes(name))
    throw new HttpsError("invalid-argument", "Unsupported migration collection");
  const db = getFirestore(), tenantRef = db.collection("tenants").doc(TARGET_TENANT.id);
  const sourceSnapshot = await db.collection("shops").doc(SOURCE_SHOP_ID).collection(name).get();
  let copied = 0, skipped = 0;
  for (const sourceDoc of sourceSnapshot.docs) {
    const targetRef = tenantRef.collection(name).doc(sourceDoc.id);
    const decision = await transactLegacyMigration({
      db, tenantRef,
      onAllowed: async tx => {
        const targetSnapshot = await tx.get(targetRef);
        if (targetSnapshot.exists && !overwrite) return "skipped";
        tx.set(targetRef, {
          ...sourceDoc.data(), legacyId: sourceDoc.id,
          tenantId: TARGET_TENANT.id, migratedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return "copied";
      },
    });
    if (decision === "copied") copied += 1;
    else skipped += 1;
  }
  return {
    sourceName: `shops/${SOURCE_SHOP_ID}/${name}`,
    targetName: `tenants/${TARGET_TENANT.id}/${name}`,
    total: sourceSnapshot.size, copied, skipped,
  };
}
async function copySettings(overwrite) {
  const db = getFirestore(), tenantRef = db.collection("tenants").doc(TARGET_TENANT.id);
  const sourceRef = db.collection("shops").doc(SOURCE_SHOP_ID).collection("settings").doc("store");
  const sourceSnapshot = await sourceRef.get();
  const sourceName = `shops/${SOURCE_SHOP_ID}/settings/store`;
  if (!sourceSnapshot.exists) return { sourceName, total: 0, copied: 0, skipped: 0 };
  const targetRef = tenantRef.collection("settings").doc("store");
  const decision = await transactLegacyMigration({
    db, tenantRef,
    onAllowed: async tx => {
      const targetSnap = await tx.get(targetRef);
      if (targetSnap.exists && !overwrite) return "skipped";
      tx.set(targetRef, {
        ...sourceSnapshot.data(), tenantId: TARGET_TENANT.id,
        migratedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return "copied";
    },
  });
  return { sourceName, total: 1,
    copied: decision === "copied" ? 1 : 0,
    skipped: decision === "skipped" ? 1 : 0 };
}
async function finalizeMigration(overwrite) {
  const db = getFirestore(), tenantRef = db.collection("tenants").doc(TARGET_TENANT.id);
  return transactLegacyMigration({
    db, tenantRef,
    onAllowed: tx => tx.set(tenantRef, {
      migration: {
        sourceShopId: SOURCE_SHOP_ID, legacyCompleted: true,
        completedAt: FieldValue.serverTimestamp(), overwrite,
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }),
  });
}
exports.inspectLegacySaasMigration = onCall({ region: "asia-southeast1" }, async request => {
  await assertSuperAdmin(request.auth);
  const db = getFirestore();
  const source = db.collection("shops").doc(SOURCE_SHOP_ID);
  const counts = {};
  for (const name of COLLECTIONS) counts[name] = (await source.collection(name).get()).size;
  const [settingsSnapshot, tenantSnapshot] = await Promise.all([
    source.collection("settings").doc("store").get(),
    db.collection("tenants").doc(TARGET_TENANT.id).get(),
  ]);
  return {
    ok: true,
    summary: {
      tenantExists: tenantSnapshot.exists,
      tenantId: TARGET_TENANT.id,
      tenantSlug: TARGET_TENANT.slug,
      tenantName: TARGET_TENANT.name,
      settings: settingsSnapshot.exists ? 1 : 0,
      ...counts,
    },
  };
});

exports.migrateLegacySaasStore = onCall({ region: "asia-southeast1", timeoutSeconds: 540 }, async request => {
  const profile = await assertSuperAdmin(request.auth);
  const action = String(request.data?.action || "").trim();
  const overwrite = request.data?.overwrite === true;

  if (action === "prepare") {
    await ensureTenant(request.auth, profile);
    return { ok: true };
  }
  if (action === "collection") {
    return { ok: true, result: await copyCollection(String(request.data?.collectionName || ""), overwrite) };
  }
  if (action === "settings") return { ok: true, result: await copySettings(overwrite) };
  if (action === "finalize") {
    await finalizeMigration(overwrite);
    return { ok: true };
  }
  throw new HttpsError("invalid-argument", "Unsupported migration action");
});
