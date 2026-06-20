import {
  auth, db, collection, doc, getDocs, getDoc, setDoc, serverTimestamp
} from "./firebase-config.js";
import { DEFAULT_SHOP, setActiveShop } from "./tenant-context.js";

const LEGACY_COLLECTIONS = ["menus", "tables", "orders"];

async function copyCollection(sourceName, targetName, { overwrite = false } = {}) {
  const sourceSnapshot = await getDocs(collection(db, sourceName));
  let copied = 0;
  let skipped = 0;

  for (const sourceDoc of sourceSnapshot.docs) {
    const targetRef = doc(db, "shops", DEFAULT_SHOP.id, targetName, sourceDoc.id);
    const targetSnapshot = await getDoc(targetRef);
    if (targetSnapshot.exists() && !overwrite) {
      skipped += 1;
      continue;
    }

    await setDoc(targetRef, {
      ...sourceDoc.data(),
      legacyId: sourceDoc.id,
      shopId: DEFAULT_SHOP.id,
      migratedAt: serverTimestamp()
    }, { merge: true });
    copied += 1;
  }

  return { sourceName, targetName, total: sourceSnapshot.size, copied, skipped };
}

async function copyStoreSettings({ overwrite = false } = {}) {
  const sourceRef = doc(db, "settings", "store");
  const sourceSnapshot = await getDoc(sourceRef);
  if (!sourceSnapshot.exists()) return { sourceName: "settings/store", total: 0, copied: 0, skipped: 0 };

  const targetRef = doc(db, "shops", DEFAULT_SHOP.id, "settings", "store");
  const targetSnapshot = await getDoc(targetRef);
  if (targetSnapshot.exists() && !overwrite) {
    return { sourceName: "settings/store", total: 1, copied: 0, skipped: 1 };
  }

  await setDoc(targetRef, {
    ...sourceSnapshot.data(),
    shopId: DEFAULT_SHOP.id,
    migratedAt: serverTimestamp()
  }, { merge: true });
  return { sourceName: "settings/store", total: 1, copied: 1, skipped: 0 };
}

async function createDefaultShop() {
  const user = auth.currentUser;
  const shopRef = doc(db, "shops", DEFAULT_SHOP.id);
  const shopSnapshot = await getDoc(shopRef);

  await setDoc(shopRef, {
    id: DEFAULT_SHOP.id,
    slug: DEFAULT_SHOP.slug,
    name: DEFAULT_SHOP.name,
    status: "active",
    plan: "development",
    ownerId: shopSnapshot.data()?.ownerId || user?.uid || "",
    updatedAt: serverTimestamp(),
    ...(shopSnapshot.exists() ? {} : { createdAt: serverTimestamp() })
  }, { merge: true });

  if (user) {
    await setDoc(doc(db, "shops", DEFAULT_SHOP.id, "staff", user.uid), {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email || "Owner",
      role: "shop_owner",
      active: true,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  setActiveShop(DEFAULT_SHOP);
}

export async function inspectLegacyData() {
  const collectionCounts = {};
  for (const name of LEGACY_COLLECTIONS) {
    const snapshot = await getDocs(collection(db, name));
    collectionCounts[name] = snapshot.size;
  }
  const settingsSnapshot = await getDoc(doc(db, "settings", "store"));
  const shopSnapshot = await getDoc(doc(db, "shops", DEFAULT_SHOP.id));

  return {
    shopExists: shopSnapshot.exists(),
    settings: settingsSnapshot.exists() ? 1 : 0,
    ...collectionCounts
  };
}

export async function migrateLegacyStore({ overwrite = false, onProgress = () => {} } = {}) {
  await createDefaultShop();
  onProgress({ step: "shop", message: "สร้างร้านเริ่มต้นแล้ว" });

  const results = [];
  for (const name of LEGACY_COLLECTIONS) {
    onProgress({ step: name, message: `กำลังย้าย ${name}...` });
    results.push(await copyCollection(name, name, { overwrite }));
  }

  onProgress({ step: "settings", message: "กำลังย้ายการตั้งค่าร้าน..." });
  results.push(await copyStoreSettings({ overwrite }));

  await setDoc(doc(db, "shops", DEFAULT_SHOP.id), {
    migration: {
      legacyCompleted: true,
      completedAt: serverTimestamp(),
      overwrite
    },
    updatedAt: serverTimestamp()
  }, { merge: true });

  onProgress({ step: "done", message: "ย้ายข้อมูลร้านเริ่มต้นสำเร็จ" });
  return results;
}
