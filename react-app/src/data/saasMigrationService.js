import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";

export const SAAS_SOURCE_SHOP_ID = "default-shop";
export const SAAS_TARGET_TENANT = Object.freeze({
  id: "ff897699-de82-4370-a360-35b22cc74c85",
  slug: "tuahere-somtam",
  name: "ส้มตำตัวเฮีย",
});

// This port deliberately has NO migration/write transport.
// Its LUKKAJA Source page is target-inspection-only and does not have
// verified cross-system Firebase migration capability.
const inspectCallable = httpsCallable(functions, "inspectLegacySaasMigration");

export async function inspectLegacyData() {
  const response = await inspectCallable({});
  const summary = response?.data?.summary;
  if (response?.data?.ok !== true || !summary
    || summary.scope !== "firebase_target_only"
    || summary.sourceInspectable !== false
    || summary.migrationEnabled !== false
    || summary.tenantId !== SAAS_TARGET_TENANT.id
    || summary.tenantSlug !== SAAS_TARGET_TENANT.slug
    || summary.target?.id !== SAAS_TARGET_TENANT.id
    || summary.target?.slug !== SAAS_TARGET_TENANT.slug
    || summary.target?.name !== SAAS_TARGET_TENANT.name
    || typeof summary.tenantExists !== "boolean") {
    throw new Error("SAAS_INSPECTION_RESPONSE_INVALID");
  }
  for (const key of ["menus", "tables", "orders"]) {
    if (summary[key] !== null && (!Number.isSafeInteger(summary[key]) || summary[key] < 0)) {
      throw new Error("SAAS_INSPECTION_COUNT_INVALID");
    }
  }
  if (summary.settings !== null && typeof summary.settings !== "boolean") {
    throw new Error("SAAS_INSPECTION_SETTINGS_INVALID");
  }
  if (!summary.tenantExists && (
    summary.menus !== null || summary.tables !== null || summary.orders !== null
      || summary.settings !== null
  )) {
    throw new Error("SAAS_INSPECTION_TARGET_MISSING_COUNTS_INVALID");
  }
  if (summary.tenantExists && (
    summary.menus === null || summary.tables === null || summary.orders === null
      || summary.settings === null
  )) {
    throw new Error("SAAS_INSPECTION_TARGET_COUNTS_UNAVAILABLE");
  }
  return summary;
}
