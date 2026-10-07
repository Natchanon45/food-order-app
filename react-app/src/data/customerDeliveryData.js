import { getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider, getAuth, getIdTokenResult, onAuthStateChanged,
  signInWithCustomToken, signInWithPopup, signOut,
} from "firebase/auth";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseConfig } from "@/firebase/client";

const CUSTOMER_APP_NAME = "penguin-storefront-customer-v2";
const BROKER_APP_NAME = "penguin-google-customer-broker-v1";
const GUEST_KEY = "food_order_guest_delivery_profile";
const GUEST_FAVORITES_PREFIX = "food_order_guest_menu_favorites";

const customerApp = getApps().find(app => app.name === CUSTOMER_APP_NAME)
  || initializeApp(firebaseConfig, CUSTOMER_APP_NAME);
const brokerApp = getApps().find(app => app.name === BROKER_APP_NAME)
  || initializeApp(firebaseConfig, BROKER_APP_NAME);
const customerAuth = getAuth(customerApp);
const brokerAuth = getAuth(brokerApp);
const customerDb = getFirestore(customerApp);
const brokerFunctions = getFunctions(brokerApp, "asia-southeast1");
const createCustomerSession = httpsCallable(brokerFunctions, "createDeliveryCustomerSession");

function normalizeFavoriteMenuIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(value => String(value || "").trim()).filter(Boolean))];
}
function guestFavoritesKey(tenant) {
  return `${GUEST_FAVORITES_PREFIX}:${String(tenant?.id || "")}`;
}
function readGuestProfile() {
  try {
    const value = JSON.parse(localStorage.getItem(GUEST_KEY) || "null");
    return value && typeof value === "object" ? value : { displayName: "", phone: "", addresses: [] };
  } catch {
    return { displayName: "", phone: "", addresses: [] };
  }
}
function writeGuestProfile(profile) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(profile));
  return profile;
}
function readGuestFavorites(tenant) {
  try { return normalizeFavoriteMenuIds(JSON.parse(localStorage.getItem(guestFavoritesKey(tenant)) || "[]")); }
  catch { return []; }
}
function writeGuestFavorites(tenant, values) {
  const ids = normalizeFavoriteMenuIds(values);
  localStorage.setItem(guestFavoritesKey(tenant), JSON.stringify(ids));
  return ids;
}
function profileRef(tenant, uid) {
  if (!tenant?.id || !uid) throw new Error("CUSTOMER_PROFILE_CONTEXT_REQUIRED");
  return doc(customerDb, "tenants", String(tenant.id), "customerProfiles", String(uid));
}
async function claimsFor(user) {
  if (!user) return {};
  try { return (await getIdTokenResult(user)).claims || {}; }
  catch { return {}; }
}
async function isCustomerContext(user) {
  const claims = await claimsFor(user);
  return Boolean(user?.uid?.startsWith("cust_") && claims.customerContext === true && claims.customerGoogle === true);
}
async function verifiedEmail(user) {
  if (!user) return "";
  if (user.email) return String(user.email).trim().toLowerCase();
  const claims = await claimsFor(user);
  return String(claims.customerEmail || "").trim().toLowerCase();
}

export function watchDeliveryCustomerAuth(callback) {
  return onAuthStateChanged(customerAuth, async user => {
    if (!user) { callback(null); return; }
    if (await isCustomerContext(user)) { callback(user); return; }
    await signOut(customerAuth).catch(() => {});
    callback(null);
  });
}

export async function loginDeliveryCustomerWithGoogle(tenant) {
  let stage = "google_popup";
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const temporary = await signInWithPopup(brokerAuth, provider);
    if (!temporary.user?.providerData?.some(item => item?.providerId === "google.com")) {
      throw Object.assign(new Error("CUSTOMER_GOOGLE_ACCOUNT_REQUIRED"), { code: "CUSTOMER_GOOGLE_ACCOUNT_REQUIRED" });
    }
    stage = "customer_session";
    const response = await createCustomerSession({ tenantId: String(tenant?.id || "") });
    const token = String(response.data?.customToken || "");
    if (!token) throw Object.assign(new Error("CUSTOMER_SESSION_TOKEN_REQUIRED"), { code: "CUSTOMER_SESSION_TOKEN_REQUIRED" });
    stage = "custom_token";
    await signOut(brokerAuth).catch(() => {});
    await signOut(customerAuth).catch(() => {});
    const credential = await signInWithCustomToken(customerAuth, token);
    stage = "session_verify";
    if (!(await isCustomerContext(credential.user))) {
      throw Object.assign(new Error("CUSTOMER_SESSION_INVALID"), { code: "CUSTOMER_SESSION_INVALID" });
    }
    return credential.user;
  } catch (error) {
    await signOut(brokerAuth).catch(() => {});
    if (error && typeof error === "object" && !error.customerStage) error.customerStage = stage;
    throw error;
  }
}

export async function logoutDeliveryCustomer() {
  await Promise.all([signOut(customerAuth), signOut(brokerAuth).catch(() => {})]);
}

export async function getDeliveryCustomerProfile(tenant, user = customerAuth.currentUser) {
  if (!user) return readGuestProfile();
  const ref = profileRef(tenant, user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return { id: snapshot.id, ...snapshot.data() };

  const guest = readGuestProfile();
  const guestAddresses = Array.isArray(guest.addresses) ? guest.addresses.slice(0, 5) : [];
  const hasGuest = Boolean(String(guest.displayName || "").trim() || String(guest.phone || "").trim() || guestAddresses.length);
  const payload = {
    tenantId: tenant.id,
    displayName: guest.displayName || user.displayName || "",
    email: await verifiedEmail(user),
    phone: guest.phone || "",
    addresses: guestAddresses,
  };
  if (hasGuest) {
    try {
      await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      return payload;
    } catch (error) {
      console.warn("DELIVERY_CUSTOMER_GUEST_MIGRATION_FAILED", error);
    }
  }
  return { ...payload, addresses: [] };
}

export async function saveDeliveryCustomerProfile(tenant, profile, user = customerAuth.currentUser) {
  const payload = {
    tenantId: tenant.id,
    displayName: String(profile?.displayName || ""),
    email: user ? await verifiedEmail(user) : String(profile?.email || ""),
    phone: String(profile?.phone || ""),
    addresses: (Array.isArray(profile?.addresses) ? profile.addresses : []).slice(0, 5),
  };
  if (!user) return writeGuestProfile(payload);
  await setDoc(profileRef(tenant, user.uid), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  return payload;
}

export async function getDeliveryCustomerFavorites(tenant, user = customerAuth.currentUser) {
  const guest = readGuestFavorites(tenant);
  if (!user) return guest;
  const snapshot = await getDoc(profileRef(tenant, user.uid));
  const cloud = snapshot.exists() ? normalizeFavoriteMenuIds(snapshot.data()?.favoriteMenuIds) : [];
  const merged = normalizeFavoriteMenuIds([...cloud, ...guest]);
  if (merged.length !== cloud.length || merged.some((id, index) => id !== cloud[index])) {
    await setDoc(profileRef(tenant, user.uid), {
      tenantId: tenant.id,
      favoriteMenuIds: merged,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
  return merged;
}

export async function saveDeliveryCustomerFavorites(tenant, values, user = customerAuth.currentUser) {
  const ids = normalizeFavoriteMenuIds(values);
  if (!user) return writeGuestFavorites(tenant, ids);
  await setDoc(profileRef(tenant, user.uid), {
    tenantId: tenant.id,
    favoriteMenuIds: ids,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return ids;
}

export function currentDeliveryCustomer() {
  return customerAuth.currentUser;
}
