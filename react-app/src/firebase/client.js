import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { readStagingFirebaseConfig } from "@/firebase/stagingConfig.mjs";

// Financial demo requires Vite development AND two explicit emulator opt-ins.
export const isHybridDemoMode = import.meta.env.DEV === true
  && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true"
  && import.meta.env.VITE_HYBRID_DEMO_PAYMENT_E2E === "true";

const productionFirebaseConfig = Object.freeze({
  apiKey: "AIzaSyAX4e6-nbiS9Y8tpqW8rKbMkryAwZXSmCo",
  authDomain: "penguin-food.web.app",
  databaseURL: "https://chat-45754-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-45754", storageBucket: "chat-45754.firebasestorage.app",
  messagingSenderId: "1046915702525", appId: "1:1046915702525:web:869e1a0d1407375610e894",
  measurementId: "G-2RR5CK5D89",
});
// Opt-in staging builds MUST present a complete, internally consistent
// non-production Firebase Web config; never fall back to .firebaserc default.
const deploymentStage = String(import.meta.env.VITE_FIREBASE_STAGE || "production");
if (!["production", "staging"].includes(deploymentStage)) {
  throw new Error("FIREBASE_DEPLOYMENT_STAGE_INVALID");
}
if (deploymentStage === "staging" && isHybridDemoMode) {
  throw new Error("STAGING_FIREBASE_CANNOT_USE_DEMO_EMULATORS");
}
export const firebaseConfig = isHybridDemoMode
  ? Object.freeze({
      apiKey: "demo-only-fake-key",
      authDomain: "demo-penguin-hybrid.firebaseapp.com",
      projectId: "demo-penguin-hybrid",
      storageBucket: "demo-penguin-hybrid.appspot.com",
      appId: "1:123:web:react-hybrid-demo",
    })
  : deploymentStage === "staging"
    ? readStagingFirebaseConfig(import.meta.env, productionFirebaseConfig)
    : productionFirebaseConfig;
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
if (app.options.projectId !== firebaseConfig.projectId) {
  // An HMR/reused default App from another build cannot silently cross from
  // staging or the demo Emulators into the Production Firebase project.
  throw new Error("FIREBASE_DEFAULT_APP_PROJECT_MISMATCH");
}
export const auth = getAuth(app), db = getFirestore(app), storage = getStorage(app);
export const functions = getFunctions(app, "asia-southeast1");
const useEmulators = import.meta.env.DEV && String(import.meta.env.VITE_USE_FIREBASE_EMULATORS || "").toLowerCase() === "true";
// A truthy flag from a previous HMR/project session is not proof these SDK
// instances were connected. Match both the App and Firebase project.
const emulatorSession = app.name + ":" + firebaseConfig.projectId;
if (useEmulators && globalThis.__FOOD_ORDER_REACT_EMULATORS_CONNECTED__ !== emulatorSession) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  // Port override is permitted only for the doubly opted-in demo project.
  // This lets QA use an isolated Firestore Emulator if another local service
  // already owns 8080. It never changes any Production Firebase endpoint.
  const configuredFirestorePort = isHybridDemoMode
    ? Number(import.meta.env.VITE_DEMO_FIRESTORE_EMULATOR_PORT || "8080")
    : 8080;
  if (!Number.isSafeInteger(configuredFirestorePort)
      || configuredFirestorePort < 1024 || configuredFirestorePort > 65535) {
    throw new Error("DEMO_FIRESTORE_EMULATOR_PORT_INVALID");
  }
  connectFirestoreEmulator(db, "127.0.0.1", configuredFirestorePort);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  globalThis.__FOOD_ORDER_REACT_EMULATORS_CONNECTED__ = emulatorSession;
}
