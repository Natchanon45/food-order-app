import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc,
  deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAT2YIuk4A0ibSBXpMA_3Im54gj9s4WRW8",
  authDomain: "project-987b9bba-eddc-4459-bdb.firebaseapp.com",
  projectId: "project-987b9bba-eddc-4459-bdb",
  storageBucket: "project-987b9bba-eddc-4459-bdb.firebasestorage.app",
  messagingSenderId: "298432652014",
  appId: "1:298432652014:web:787620331c0de816f489ff",
  measurementId: "G-4SLNZRLR5E"
};

export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith("PUT_") && !firebaseConfig.projectId.startsWith("PUT_");
export let db = null;
if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}
export { collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp };
