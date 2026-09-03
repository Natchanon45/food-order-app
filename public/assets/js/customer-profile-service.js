import { auth, db, doc, getDoc, setDoc, serverTimestamp } from "./firebase-config.js?v=20260630-073";
import { tenantDocumentPath, resolveTenantContext } from "./tenant-context.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const GUEST_KEY = "food_order_guest_delivery_profile";
const googleSettingsRef = doc(db, "platformSettings", "googleCustomerLogin");
let googleCustomerLoginAvailable = true;

async function loadGoogleCustomerLoginSetting() {
  try {
    const snapshot = await getDoc(googleSettingsRef);
    if (!snapshot.exists()) {
      googleCustomerLoginAvailable = true;
      return googleCustomerLoginAvailable;
    }
    const settings = snapshot.data() || {};
    googleCustomerLoginAvailable = settings.enabled === true && Boolean(String(settings.clientId || "").trim());
    return googleCustomerLoginAvailable;
  } catch (error) {
    console.warn("[customer-profile] Google login settings unavailable", error);
    googleCustomerLoginAvailable = true;
    return googleCustomerLoginAvailable;
  }
}

export function isCustomerAccountAvailable() {
  return googleCustomerLoginAvailable;
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
  return doc(db, ...tenantDocumentPath("customerProfiles", uid, resolveTenantContext()));
}

function applyStaffDeliveryState(staff) {
  if (!staff) return;
  const googleLoginButton = document.querySelector("#googleLoginButton");
  const customerLogoutButton = document.querySelector("#customerLogoutButton");
  const customerAccount = document.querySelector("#customerAccount");
  const customerAccountName = document.querySelector("#customerAccountName");
  const customerModeText = document.querySelector("#customerModeText");

  if (googleLoginButton) {
    googleLoginButton.hidden = true;
    googleLoginButton.disabled = true;
    googleLoginButton.style.display = "none";
  }
  if (customerLogoutButton) {
    customerLogoutButton.hidden = false;
    customerLogoutButton.style.display = "";
    customerLogoutButton.textContent = "ออกจากระบบพนักงาน";
  }
  if (customerAccount) customerAccount.hidden = false;
  if (customerAccountName) customerAccountName.textContent = `${staff.displayName || staff.email} • ${staff.role}`;
  if (customerModeText) {
    customerModeText.textContent = "กำลังใช้บัญชีพนักงาน ที่อยู่ Delivery จะบันทึกเฉพาะอุปกรณ์นี้";
  }
}

export function watchCustomerAuth(callback) {
  return onAuthStateChanged(auth, async user => {
    const [staff] = await Promise.all([
      getStaffSession(user).catch(() => null),
      loadGoogleCustomerLoginSetting(),
    ]);
    await callback(staff ? null : user, staff);
    applyStaffDeliveryState(staff);
    const googleLoginButton = document.querySelector("#googleLoginButton");
    if (googleLoginButton && !staff && !user && !googleCustomerLoginAvailable) {
      googleLoginButton.hidden = true;
      googleLoginButton.disabled = true;
      googleLoginButton.style.display = "none";
    }
  });
}

export async function getStaffSession(user = auth.currentUser) {
  if (!user) return null;
  const snapshot = await getDoc(doc(db, "users", user.uid));
  if (!snapshot.exists()) return null;
  const profile = snapshot.data();
  return profile?.role ? { uid: user.uid, email: user.email, ...profile } : null;
}

export async function loginCustomerWithGoogle() {
  const [staff, available] = await Promise.all([
    getStaffSession(),
    loadGoogleCustomerLoginSetting(),
  ]);
  if (staff) throw new Error("STAFF_SESSION_ACTIVE");
  if (!available) {
    const error = new Error("GOOGLE_LOGIN_DISABLED");
    error.code = "GOOGLE_LOGIN_DISABLED";
    throw error;
  }

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

  const snapshot = await getDoc(customerProfileDoc(user.uid));
  return snapshot.exists()
    ? { id: snapshot.id, ...snapshot.data() }
    : { displayName: user.displayName || "", email: user.email || "", phone: "", addresses: [] };
}

export async function saveCustomerProfile(profile, user = auth.currentUser) {
  const tenant = resolveTenantContext();
  const payload = {
    tenantId: tenant.id,
    displayName: profile.displayName || "",
    email: user?.email || profile.email || "",
    phone: profile.phone || "",
    addresses: (profile.addresses || []).slice(0, 5)
  };

  if (!user) return saveGuestProfile(payload);

  const staff = await getStaffSession(user);
  if (staff) return saveGuestProfile({ ...payload, email: "" });

  await setDoc(customerProfileDoc(user.uid), {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return payload;
}
