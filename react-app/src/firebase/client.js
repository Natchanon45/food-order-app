import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

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
export const firebaseConfig = isHybridDemoMode
  ? Object.freeze({
      apiKey: "demo-only-fake-key",
      authDomain: "demo-penguin-hybrid.firebaseapp.com",
      projectId: "demo-penguin-hybrid",
      storageBucket: "demo-penguin-hybrid.appspot.com",
      appId: "1:123:web:react-hybrid-demo",
    })
  : productionFirebaseConfig;
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
if (isHybridDemoMode && app.options.projectId !== "demo-penguin-hybrid") {
  throw new Error("HYBRID_DEMO_REFUSES_NONDEMO_FIREBASE_PROJECT");
}
export const auth = getAuth(app), db = getFirestore(app), storage = getStorage(app);
export const functions = getFunctions(app, "asia-southeast1");
const useEmulators = import.meta.env.DEV && String(import.meta.env.VITE_USE_FIREBASE_EMULATORS || "").toLowerCase() === "true";
// A truthy flag from a previous HMR/project session is not proof these SDK
// instances were connected. Match both the App and Firebase project.
const emulatorSession = app.name + ":" + firebaseConfig.projectId;
if (useEmulators && globalThis.__FOOD_ORDER_REACT_EMULATORS_CONNECTED__ !== emulatorSession) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  globalThis.__FOOD_ORDER_REACT_EMULATORS_CONNECTED__ = emulatorSession;
}
