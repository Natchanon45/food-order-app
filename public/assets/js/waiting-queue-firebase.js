import * as FirebaseConfig from "./firebase-config.js?v=20260801-002";
import * as FirestoreSdk from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export const db = FirebaseConfig.db;
export const auth = FirebaseConfig.auth || null;
export const collection = FirebaseConfig.collection || FirestoreSdk.collection;
export const doc = FirebaseConfig.doc || FirestoreSdk.doc;
export const getDoc = FirebaseConfig.getDoc || FirestoreSdk.getDoc;
export const getDocs = FirebaseConfig.getDocs || FirestoreSdk.getDocs;
export const query = FirebaseConfig.query || FirestoreSdk.query;
export const where = FirebaseConfig.where || FirestoreSdk.where;
export const orderBy = FirebaseConfig.orderBy || FirestoreSdk.orderBy;
export const onSnapshot = FirebaseConfig.onSnapshot || FirestoreSdk.onSnapshot;
export const runTransaction = FirebaseConfig.runTransaction || FirestoreSdk.runTransaction;
export const writeBatch = FirebaseConfig.writeBatch || FirestoreSdk.writeBatch;
export const serverTimestamp = FirebaseConfig.serverTimestamp || FirestoreSdk.serverTimestamp;
