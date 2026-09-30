import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";

const cache = new Map();

function callable(name) {
  if (!cache.has(name)) cache.set(name, httpsCallable(functions, name));
  return cache.get(name);
}

async function call(name, payload = {}) {
  const response = await callable(name)(payload);
  return response?.data || {};
}

export const loadPlatformGoogleApis = () => call("getPlatformGoogleApis");
export const savePlatformGoogleApis = payload => call("updatePlatformGoogleApis", payload);

export const loadPlatformSlipVerification = () => call("getPlatformSlipVerification");
export const savePlatformSlipVerification = payload => call("updatePlatformSlipVerification", payload);
export const testPlatformSlipVerification = () => call("testPlatformSlipVerification");

export const loadPlatformLalamove = () => call("getPlatformLalamove");
export const savePlatformLalamove = payload => call("updatePlatformLalamove", payload);
export const testPlatformLalamove = () => call("testPlatformLalamove");
export const registerPlatformLalamoveWebhook = payload => call("registerPlatformLalamoveWebhook", payload);
