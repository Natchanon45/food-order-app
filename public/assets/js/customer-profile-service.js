import { firebaseConfig, auth as staffAuth, db as staffDb, doc, getDoc, setDoc, serverTimestamp } from "./firebase-config.js?v=20260630-073";
import { tenantDocumentPath, resolveTenantContext } from "./tenant-context.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const GUEST_KEY = "food_order_guest_delivery_profile";
const GUEST_FAVORITES_PREFIX = "food_order_guest_menu_favorites";
const CUSTOMER_APP_NAME = "penguin-delivery-customer";
const customerApp = getApps().find(app => app.name === CUSTOMER_APP_NAME)
  || initializeApp(firebaseConfig, CUSTOMER_APP_NAME);
const customerAuth = getAuth(customerApp);
const customerDb = getFirestore(customerApp);

function normalizeFavoriteMenuIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || "").trim())
    .filter(Boolean))];
}

function guestFavoritesKey() {
  const tenant = resolveTenantContext();
  return `${GUEST_FAVORITES_PREFIX}:${tenant.id}`;
}

function getGuestFavorites() {
  try {
    return normalizeFavoriteMenuIds(JSON.parse(localStorage.getItem(guestFavoritesKey()) || "[]"));
  } catch {
    return [];
  }
}

function saveGuestFavorites(values = []) {
  const ids = normalizeFavoriteMenuIds(values);
  localStorage.setItem(guestFavoritesKey(), JSON.stringify(ids));
  return ids;
}
export function isCustomerAccountAvailable() {
  return Boolean(customerAuth);
}

function getGuestProfile() {
  const saved = localStorage.getItem(GUEST_KEY);
  return saved ? JSON.parse(saved) : { displayName: "", phone: "", addresses: [] };
}

function saveGuestProfile(payload) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(payload));
  return payload;
}

function customerProfileDoc(uid) {
  return doc(customerDb, ...tenantDocumentPath("customerProfiles", uid, resolveTenantContext()));
}

export function watchCustomerAuth(callback) {
  return onAuthStateChanged(customerAuth, user => callback(user, null));
}

export async function getStaffSession(user = staffAuth.currentUser) {
  if (!user) return null;
  const snapshot = await getDoc(doc(staffDb, "users", user.uid));
  if (!snapshot.exists()) return null;
  const profile = snapshot.data();
  return profile?.role ? { uid: user.uid, email: user.email, ...profile } : null;
}

export async function loginCustomerWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(customerAuth, provider);
  const googleIdentity = credential.user?.providerData?.some(
    item => item?.providerId === "google.com"
  );
  if (!googleIdentity) {
    await signOut(customerAuth).catch(() => {});
    const error = new Error("CUSTOMER_GOOGLE_ACCOUNT_REQUIRED");
    error.code = "CUSTOMER_GOOGLE_ACCOUNT_REQUIRED";
    throw error;
  }
  return credential;
}

export async function logoutCustomer() {
  await signOut(customerAuth);
}

export async function getCustomerProfile(user = customerAuth.currentUser) {
  if (!user) return getGuestProfile();

  const snapshot = await getDoc(customerProfileDoc(user.uid));
  if (snapshot.exists()) return { id: snapshot.id, ...snapshot.data() };

  // First Google sign-in on this device: preserve an existing Guest delivery
  // profile by promoting it to the tenant-scoped cloud profile. Once written,
  // the same Google account can load these addresses from another device.
  const guest = getGuestProfile();
  const guestAddresses = Array.isArray(guest.addresses) ? guest.addresses.slice(0, 5) : [];
  const hasGuestData = Boolean(
    String(guest.displayName || '').trim()
    || String(guest.phone || '').trim()
    || guestAddresses.length
  );

  if (hasGuestData) {
    const tenant = resolveTenantContext();
    const payload = {
      tenantId: tenant.id,
      displayName: guest.displayName || user.displayName || "",
      email: user.email || "",
      phone: guest.phone || "",
      addresses: guestAddresses,
    };

    try {
      await setDoc(customerProfileDoc(user.uid), {
        ...payload,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return payload;
    } catch (error) {
      console.warn('[customer-profile] Guest profile cloud migration failed', error);
    }
  }

  return { displayName: user.displayName || "", email: user.email || "", phone: "", addresses: [] };
}

export async function saveCustomerProfile(profile, user = customerAuth.currentUser) {
  const tenant = resolveTenantContext();
  const payload = {
    tenantId: tenant.id,
    displayName: profile.displayName || "",
    email: user?.email || profile.email || "",
    phone: profile.phone || "",
    addresses: (profile.addresses || []).slice(0, 5)
  };

  if (!user) return saveGuestProfile(payload);

  await setDoc(customerProfileDoc(user.uid), {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return payload;
}
export async function getCustomerFavorites(user = customerAuth.currentUser) {
  const guestIds = getGuestFavorites();
  if (!user) return guestIds;

  const snapshot = await getDoc(customerProfileDoc(user.uid));
  const cloudIds = snapshot.exists()
    ? normalizeFavoriteMenuIds(snapshot.data()?.favoriteMenuIds)
    : [];
  const merged = normalizeFavoriteMenuIds([...cloudIds, ...guestIds]);

  if (merged.length !== cloudIds.length || merged.some((id, index) => id !== cloudIds[index])) {
    const tenant = resolveTenantContext();
    await setDoc(customerProfileDoc(user.uid), {
      tenantId: tenant.id,
      favoriteMenuIds: merged,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  return merged;
}

export async function saveCustomerFavorites(values = [], user = customerAuth.currentUser) {
  const ids = normalizeFavoriteMenuIds(values);
  if (!user) return saveGuestFavorites(ids);

  const tenant = resolveTenantContext();
  await setDoc(customerProfileDoc(user.uid), {
    tenantId: tenant.id,
    favoriteMenuIds: ids,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return ids;
}
