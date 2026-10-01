import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js?v=20260630-073";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";

export const CUSTOMER_APP_NAME = "penguin-storefront-customer-v2";
export const CUSTOMER_BROKER_APP_NAME = "penguin-google-customer-broker-v1";

export let customerApp = null;
export let customerAuth = null;
export let customerDb = null;
export let customerStorage = null;
export let customerFunctions = null;
export let customerBrokerApp = null;
export let customerBrokerAuth = null;
export let customerBrokerFunctions = null;

if (isFirebaseConfigured) {
  customerApp = getApps().find(app => app.name === CUSTOMER_APP_NAME)
    || initializeApp(firebaseConfig, CUSTOMER_APP_NAME);
  customerAuth = getAuth(customerApp);
  customerDb = getFirestore(customerApp);
  customerStorage = getStorage(customerApp);
  customerFunctions = getFunctions(customerApp, "asia-southeast1");

  customerBrokerApp = getApps().find(app => app.name === CUSTOMER_BROKER_APP_NAME)
    || initializeApp(firebaseConfig, CUSTOMER_BROKER_APP_NAME);
  customerBrokerAuth = getAuth(customerBrokerApp);
  customerBrokerFunctions = getFunctions(
    customerBrokerApp,
    "asia-southeast1"
  );
}

export function isTenantPublicRoute(pathname = location.pathname) {
  const path = String(pathname || "");
  return /^\/s\/[^/]+(?:\/|$)/i.test(path)
    || /^\/(?:delivery|takeaway|order)(?:\/|$)/i.test(path);
}
