import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc,
  deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAX4e6-nbiS9Y8tpqW8rKbMkryAwZXSmCo",
  authDomain: "chat-45754.firebaseapp.com",
  databaseURL: "https://chat-45754-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-45754",
  storageBucket: "chat-45754.firebasestorage.app",
  messagingSenderId: "1046915702525",
  appId: "1:1046915702525:web:869e1a0d1407375610e894",
  measurementId: "G-2RR5CK5D89"
};

export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith("PUT_") && !firebaseConfig.projectId.startsWith("PUT_");
export let db = null;
export let storage = null;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
}

export {
  collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp,
  ref, uploadBytes, getDownloadURL, deleteObject
};
