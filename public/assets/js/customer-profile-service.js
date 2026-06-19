import { auth, db, doc, getDoc, setDoc, serverTimestamp } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const GUEST_KEY = "food_order_guest_delivery_profile";

function getGuestProfile() {
  const saved = localStorage.getItem(GUEST_KEY);
  return saved ? JSON.parse(saved) : { displayName: "", phone: "", addresses: [] };
}

function saveGuestProfile(payload) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(payload));
  return payload;
}

export function watchCustomerAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getStaffSession(user = auth.currentUser) {
  if (!user) return null;
  const snapshot = await getDoc(doc(db, "users", user.uid));
  if (!snapshot.exists()) return null;
  const profile = snapshot.data();
  return profile?.role ? { uid: user.uid, email: user.email, ...profile } : null;
}

export async function loginCustomerWithGoogle() {
  const staff = await getStaffSession();
  if (staff) throw new Error("STAFF_SESSION_ACTIVE");

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
}

export async function logoutCustomer() {
  await signOut(auth);
}

export async function getCustomerProfile(user = auth.currentUser) {
  if (!user) return getGuestProfile();

  const staff = await getStaffSession(user);
  if (staff) return getGuestProfile();

  const snapshot = await getDoc(doc(db, "customerProfiles", user.uid));
  return snapshot.exists()
    ? { id: snapshot.id, ...snapshot.data() }
    : { displayName: user.displayName || "", email: user.email || "", phone: "", addresses: [] };
}

export async function saveCustomerProfile(profile, user = auth.currentUser) {
  const payload = {
    displayName: profile.displayName || "",
    email: user?.email || profile.email || "",
    phone: profile.phone || "",
    addresses: (profile.addresses || []).slice(0, 5)
  };

  if (!user) return saveGuestProfile(payload);

  const staff = await getStaffSession(user);
  if (staff) return saveGuestProfile({ ...payload, email: "" });

  await setDoc(doc(db, "customerProfiles", user.uid), {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return payload;
}
