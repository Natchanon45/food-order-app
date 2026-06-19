import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc,
  deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "PUT_YOUR_API_KEY_HERE",
  authDomain: "PUT_YOUR_PROJECT.firebaseapp.com",
  projectId: "PUT_YOUR_PROJECT_ID_HERE",
  storageBucket: "PUT_YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "PUT_YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "PUT_YOUR_APP_ID_HERE"
};

export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith("PUT_") && !firebaseConfig.projectId.startsWith("PUT_");
export let db = null;
if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}
export { collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp };
