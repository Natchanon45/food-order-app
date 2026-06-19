import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc,
  deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

export const firebaseConfig = {
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
export let app = null;
export let db = null;
export let storage = null;
export let auth = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
}

export {
  initializeApp, getAuth,
  collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, runTransaction,
  ref, uploadBytes, getDownloadURL, deleteObject,
  signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword
};
