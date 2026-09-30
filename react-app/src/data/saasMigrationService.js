import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";

export const SAAS_SOURCE_SHOP_ID = "default-shop";
export const SAAS_TARGET_TENANT = Object.freeze({
  id: "ff897699-de82-4370-a360-35b22cc74c85",
  slug: "tuahere-somtam",
  name: "ส้มตำตัวเฮีย",
});
const COLLECTIONS = Object.freeze(["menus", "tables", "orders", "deliveryCustomers"]);
const inspectCallable = httpsCallable(functions, "inspectLegacySaasMigration");
const migrateCallable = httpsCallable(functions, "migrateLegacySaasStore");

export async function inspectLegacyData() {
  const response = await inspectCallable({});
  return response?.data?.summary || {};
}

export async function migrateLegacyStore({ overwrite = false, onProgress = () => {} } = {}) {
  await migrateCallable({ action: "prepare", overwrite });
  onProgress({ step: "tenant" });

  const results = [];
  for (const name of COLLECTIONS) {
    onProgress({ step: "collection", name });
    const response = await migrateCallable({
      action: "collection",
      collectionName: name,
      overwrite,
    });
    if (response?.data?.result) results.push(response.data.result);
  }

  onProgress({ step: "settings" });
  const settingsResponse = await migrateCallable({ action: "settings", overwrite });
  if (settingsResponse?.data?.result) results.push(settingsResponse.data.result);

  await migrateCallable({ action: "finalize", overwrite });
  onProgress({ step: "done" });
  return results;
}
