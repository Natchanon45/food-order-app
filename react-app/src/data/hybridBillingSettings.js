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
export async function getAdminHybridRegistrationReady() {
  const response = await httpsCallable(functions, "getHybridBillingSettings")({});
  if (response?.data?.ok !== true) throw new Error("HYBRID_REGISTRATION_STATUS_UNAVAILABLE");
  return response.data.registrationReady === true;
}
export async function setAdminHybridRegistrationReady(enabled) {
  const response = await httpsCallable(functions, "setHybridRegistrationReady")({
    enabled, confirmation: enabled ? "ENABLE_HYBRID_REGISTRATION" : "",
  });
  if (response?.data?.ok !== true) throw new Error("HYBRID_REGISTRATION_SETTING_FAILED");
  return response.data.registrationReady === true;
}
