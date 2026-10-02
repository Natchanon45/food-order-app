import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { tenantDocumentPath, resolveTenantContext } from "./tenant-context.js?v=20261002-006";
import {
  customerAuth,
  customerDb,
  customerBrokerAuth,
  customerBrokerFunctions,
} from "./public-firebase-context.js?v=20261002-001";
import {
  GoogleAuthProvider,
  getIdTokenResult,
  signInWithCustomToken,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";

const GUEST_KEY = "food_order_guest_delivery_profile";
const GUEST_FAVORITES_PREFIX = "food_order_guest_menu_favorites";
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

async function customerSessionClaims(user) {
  if (!user) return null;
  try {
    return (await getIdTokenResult(user)).claims || null;
  } catch {
    return null;
  }
}

async function customerContextSession(user) {
  const claims = await customerSessionClaims(user);
  return Boolean(
    user?.uid?.startsWith("cust_")
    && claims?.customerContext === true
    && claims?.customerGoogle === true
  );
}

async function customerVerifiedEmail(user) {
  if (!user) return "";
  if (user.email) return String(user.email).trim().toLowerCase();
  const claims = await customerSessionClaims(user);
  return String(claims?.customerEmail || "").trim().toLowerCase();
}

export function watchCustomerAuth(callback) {
  return onAuthStateChanged(customerAuth, async user => {
    if (!user) {
      await callback(null);
      return;
    }
    if (await customerContextSession(user)) {
      await callback(user);
      return;
    }
    await signOut(customerAuth).catch(() => {});
    await callback(null);
  });
}

function withCustomerLoginStage(error, stage) {
  if (error && typeof error === "object") {
    if (!error.customerStage) error.customerStage = stage;
    return error;
  }
  return Object.assign(new Error(String(error || "CUSTOMER_LOGIN_FAILED")), {
    code: String(error || "CUSTOMER_LOGIN_FAILED"),
    customerStage: stage,
  });
}

export async function loginCustomerWithGoogle() {
  let stage = "google_popup";
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const temporaryCredential = await signInWithPopup(
      customerBrokerAuth,
      provider
    );
    const googleIdentity = temporaryCredential.user?.providerData?.some(
      item => item?.providerId === "google.com"
    );
    if (!googleIdentity) {
      throw Object.assign(
        new Error("CUSTOMER_GOOGLE_ACCOUNT_REQUIRED"),
        { code: "CUSTOMER_GOOGLE_ACCOUNT_REQUIRED" }
      );
    }

    stage = "customer_session";
    const tenant = resolveTenantContext();
    const createCustomerSession = httpsCallable(
      customerBrokerFunctions,
      "createDeliveryCustomerSession"
    );
    const response = await createCustomerSession({ tenantId: tenant.id });
    const customToken = String(response.data?.customToken || "");
    if (!customToken) {
      throw Object.assign(new Error("CUSTOMER_SESSION_TOKEN_REQUIRED"), {
        code: "CUSTOMER_SESSION_TOKEN_REQUIRED",
      });
    }

    stage = "custom_token";
    await signOut(customerBrokerAuth).catch(() => {});
    await signOut(customerAuth).catch(() => {});
    const credential = await signInWithCustomToken(customerAuth, customToken);

    stage = "session_verify";
    if (!(await customerContextSession(credential.user))) {
      throw Object.assign(new Error("CUSTOMER_SESSION_INVALID"), {
        code: "CUSTOMER_SESSION_INVALID",
      });
    }
    return credential;
  } catch (error) {
    await signOut(customerBrokerAuth).catch(() => {});
    throw withCustomerLoginStage(error, stage);
  }
}

export async function logoutCustomer() {
  await Promise.all([
    signOut(customerAuth),
    signOut(customerBrokerAuth).catch(() => {}),
  ]);
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
    const verifiedEmail = await customerVerifiedEmail(user);
    const payload = {
      tenantId: tenant.id,
      displayName: guest.displayName || user.displayName || "",
      email: verifiedEmail,
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

  return {
    displayName: user.displayName || "",
    email: await customerVerifiedEmail(user),
    phone: "",
    addresses: []
  };
}

export async function saveCustomerProfile(profile, user = customerAuth.currentUser) {
  const tenant = resolveTenantContext();
  const verifiedEmail = user ? await customerVerifiedEmail(user) : "";
  const payload = {
    tenantId: tenant.id,
    displayName: profile.displayName || "",
    email: verifiedEmail || profile.email || "",
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
