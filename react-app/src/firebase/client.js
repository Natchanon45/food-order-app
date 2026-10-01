import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

export const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyAX4e6-nbiS9Y8tpqW8rKbMkryAwZXSmCo",
  authDomain: "penguin-food.web.app",
  databaseURL: "https://chat-45754-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-45754", storageBucket: "chat-45754.firebasestorage.app",
  messagingSenderId: "1046915702525", appId: "1:1046915702525:web:869e1a0d1407375610e894",
  measurementId: "G-2RR5CK5D89",
});
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app), db = getFirestore(app), storage = getStorage(app);
export const functions = getFunctions(app, "asia-southeast1");
const useEmulators = import.meta.env.DEV && String(import.meta.env.VITE_USE_FIREBASE_EMULATORS || "").toLowerCase() === "true";
if (useEmulators && !globalThis.__FOOD_ORDER_REACT_EMULATORS_CONNECTED__) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080); connectFunctionsEmulator(functions, "127.0.0.1", 5001); connectStorageEmulator(storage, "127.0.0.1", 9199);
  globalThis.__FOOD_ORDER_REACT_EMULATORS_CONNECTED__ = true;
}
