import {
  auth, db, collection, doc, getDocs, getDoc, setDoc, serverTimestamp
} from "./firebase-config.js?v=20260630-073";

const SOURCE_SHOP_ID = "default-shop";
const TARGET_TENANT = Object.freeze({
  id: "ff897699-de82-4370-a360-35b22cc74c85",
  slug: "tuahere-somtam",
  name: "ส้มตำตัวเฮีย"
});
const COLLECTIONS = ["menus", "tables", "orders", "deliveryCustomers"];

async function copyCollection(name, { overwrite = false } = {}) {
  const sourceSnapshot = await getDocs(collection(db, "shops", SOURCE_SHOP_ID, name));
  let copied = 0;
  let skipped = 0;

  for (const sourceDoc of sourceSnapshot.docs) {
    const targetRef = doc(db, "tenants", TARGET_TENANT.id, name, sourceDoc.id);
    const targetSnapshot = await getDoc(targetRef);

    if (targetSnapshot.exists() && !overwrite) {
      skipped += 1;
      continue;
    }

    await setDoc(targetRef, {
      ...sourceDoc.data(),
      legacyId: sourceDoc.id,
      tenantId: TARGET_TENANT.id,
      migratedAt: serverTimestamp()
    }, { merge: true });
    copied += 1;
  }

  return {
    sourceName: `shops/${SOURCE_SHOP_ID}/${name}`,
    targetName: `tenants/${TARGET_TENANT.id}/${name}`,
    total: sourceSnapshot.size,
    copied,
    skipped
  };
}

async function copyStoreSettings({ overwrite = false } = {}) {
  const sourceRef = doc(db, "shops", SOURCE_SHOP_ID, "settings", "store");
  const sourceSnapshot = await getDoc(sourceRef);
  if (!sourceSnapshot.exists()) {
    return { sourceName: `shops/${SOURCE_SHOP_ID}/settings/store`, total: 0, copied: 0, skipped: 0 };
  }

  const targetRef = doc(db, "tenants", TARGET_TENANT.id, "settings", "store");
  const targetSnapshot = await getDoc(targetRef);
  if (targetSnapshot.exists() && !overwrite) {
    return { sourceName: `shops/${SOURCE_SHOP_ID}/settings/store`, total: 1, copied: 0, skipped: 1 };
  }

  await setDoc(targetRef, {
    ...sourceSnapshot.data(),
    tenantId: TARGET_TENANT.id,
    migratedAt: serverTimestamp()
  }, { merge: true });

  return { sourceName: `shops/${SOURCE_SHOP_ID}/settings/store`, total: 1, copied: 1, skipped: 0 };
}

async function ensureTenant() {
  const user = auth.currentUser;
  const tenantRef = doc(db, "tenants", TARGET_TENANT.id);
  const tenantSnapshot = await getDoc(tenantRef);
  const existing = tenantSnapshot.exists() ? tenantSnapshot.data() : {};

  await setDoc(tenantRef, {
    id: TARGET_TENANT.id,
    slug: TARGET_TENANT.slug,
    name: TARGET_TENANT.name,
    status: existing.status || "active",
    plan: existing.plan || "development",
    ownerId: existing.ownerId || user?.uid || "",
    updatedAt: serverTimestamp(),
    ...(tenantSnapshot.exists() ? {} : { createdAt: serverTimestamp() })
  }, { merge: true });

  await setDoc(doc(db, "tenantSlugs", TARGET_TENANT.slug), {
    tenantId: TARGET_TENANT.id,
    slug: TARGET_TENANT.slug,
    name: TARGET_TENANT.name,
    active: true,
    updatedAt: serverTimestamp()
  }, { merge: true });

  if (user) {
    await setDoc(doc(db, "tenants", TARGET_TENANT.id, "memberships", user.uid), {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email || "Owner",
      role: "owner",
      active: true,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}

export async function inspectLegacyData() {
  const collectionCounts = {};
  for (const name of COLLECTIONS) {
    const snapshot = await getDocs(collection(db, "shops", SOURCE_SHOP_ID, name));
    collectionCounts[name] = snapshot.size;
  }

  const settingsSnapshot = await getDoc(doc(db, "shops", SOURCE_SHOP_ID, "settings", "store"));
  const tenantSnapshot = await getDoc(doc(db, "tenants", TARGET_TENANT.id));

  return {
    tenantExists: tenantSnapshot.exists(),
    shopExists: tenantSnapshot.exists(),
    tenantId: TARGET_TENANT.id,
    tenantSlug: TARGET_TENANT.slug,
    settings: settingsSnapshot.exists() ? 1 : 0,
    ...collectionCounts
  };
}

export async function migrateLegacyStore({ overwrite = false, onProgress = () => {} } = {}) {
  await ensureTenant();
  onProgress({ step: "tenant", message: "เตรียม Tenant ร้านแรกแล้ว" });

  const results = [];
  for (const name of COLLECTIONS) {
    onProgress({ step: name, message: `กำลังย้าย ${name}...` });
    results.push(await copyCollection(name, { overwrite }));
  }

  onProgress({ step: "settings", message: "กำลังย้ายการตั้งค่าร้าน..." });
  results.push(await copyStoreSettings({ overwrite }));

  await setDoc(doc(db, "tenants", TARGET_TENANT.id), {
    migration: {
      sourceShopId: SOURCE_SHOP_ID,
      legacyCompleted: true,
      completedAt: serverTimestamp(),
      overwrite
    },
    updatedAt: serverTimestamp()
  }, { merge: true });

  onProgress({ step: "done", message: "ย้ายข้อมูลเข้า Tenant ร้านแรกสำเร็จ" });
  return results;
}
