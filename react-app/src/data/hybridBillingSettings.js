import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";

// Do not silently fall back to example prices when the live server is unavailable.
export async function loadPublicHybridBillingSettings() {
  const response = await httpsCallable(functions, "getPublicHybridBillingSettings")({});
  if (response?.data?.ok !== true || !response.data.config) {
    throw new Error("HYBRID_PRICING_UNAVAILABLE");
  }
  return { config: response.data.config, registrationReady: response.data.registrationReady === true };
}
export async function loadAdminHybridBillingSettings() {
  const response = await httpsCallable(functions, "getHybridBillingSettings")({});
  if (response?.data?.ok !== true || !response.data.config) throw new Error("HYBRID_PRICING_UNAVAILABLE");
  return response.data.config;
}
export async function saveAdminHybridBillingSettings(config) {
  const response = await httpsCallable(functions, "updateHybridBillingSettings")(config);
  if (response?.data?.ok !== true) throw new Error("HYBRID_PRICING_SAVE_FAILED");
  return response.data.config;
}
