"use strict";
// P1.4: read-only SaaS inspection. Source LUKKAJA explicitly rejects
// cross-system migration while it cannot verify its original Firebase shop.
// Never infer authorization to copy legacy shops or overwrite tenant/finance.
const { HttpsError, onCall } = require("./managed-email-callable");
const { getFirestore } = require("firebase-admin/firestore");

const SOURCE_SHOP_ID = "default-shop";
const TARGET_TENANT = Object.freeze({
  id: "ff897699-de82-4370-a360-35b22cc74c85",
  slug: "tuahere-somtam",
  name: "ส้มตำตัวเฮีย",
});
const COLLECTIONS = Object.freeze(["menus", "tables", "orders"]);

async function assertSuperAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const profile = (await getFirestore().collection("users").doc(auth.uid).get()).data();
  if (!profile || profile.active !== true || profile.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Super admin permission required");
  }
}

// Do not accept caller-provided source/target IDs, migration flags or overwrite.
// Reading an absent target must not fabricate source counts or provision a shop.
exports.inspectLegacySaasMigration = onCall({ region: "asia-southeast1" }, async request => {
  await assertSuperAdmin(request.auth);
  const db = getFirestore();
  const targetRef = db.collection("tenants").doc(TARGET_TENANT.id);
  const tenant = await targetRef.get();
  const summary = {
    scope: "firebase_target_only",
    sourceInspectable: false,
    migrationEnabled: false,
    tenantExists: tenant.exists,
    tenantId: TARGET_TENANT.id,
    tenantSlug: TARGET_TENANT.slug,
    tenantName: TARGET_TENANT.name,
    target: { ...TARGET_TENANT },
    menus: null,
    tables: null,
    orders: null,
    settings: null,
  };
  if (tenant.exists) {
    const [menus, tables, orders, store] = await Promise.all([
      ...COLLECTIONS.map(name => targetRef.collection(name).count().get()),
      targetRef.collection("settings").doc("store").get(),
    ]);
    summary.menus = menus.data().count;
    summary.tables = tables.data().count;
    summary.orders = orders.data().count;
    summary.settings = store.exists;
  }
  return { ok: true, summary };
});

// Retain the old Callable name for deployed clients but permanently fail
// closed. No operation/collection/overwrite input may mutate either system.
exports.migrateLegacySaasStore = onCall({ region: "asia-southeast1" }, async request => {
  await assertSuperAdmin(request.auth);
  throw new HttpsError("failed-precondition", "SAAS_SOURCE_MIGRATION_DISABLED_INSPECTION_ONLY");
});
