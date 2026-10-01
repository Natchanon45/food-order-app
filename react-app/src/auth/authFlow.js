import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/firebase/client";
import { tenantAccessDecision, tenantAccessError } from "@/auth/tenantAccess";

export const ROLE_HOME = Object.freeze({
  super_admin: "/platform",
  owner: "/pos",
  admin: "/pos",
  cashier: "/pos",
  kitchen: "/kitchen",
  manager: "/",
});

export const STAFF_ROLES = Object.freeze([
  "owner", "admin", "cashier", "kitchen", "manager", "super_admin",
]);

const requestTrialTenantSignup = httpsCallable(functions, "requestTrialTenantSignup");
const activateTrialTenantSignup = httpsCallable(functions, "activateTrialTenantSignup");

const AUTH_TRANSIENT_RETRY_MS = 700;

function transientFirebaseNetworkError(error) {
  const code = String(error?.code || error?.message || "").toLowerCase();
  return code.includes("network-request-failed")
    || code.includes("unavailable")
    || code.includes("deadline-exceeded");
}

function delay(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function getDocWithTransientRetry(reference) {
  try {
    return await getDoc(reference);
  } catch (error) {
    if (!transientFirebaseNetworkError(error)) throw error;
    await delay(AUTH_TRANSIENT_RETRY_MS);
    return getDoc(reference);
  }
}

export async function loadProfile(user) {
  if (!user?.uid) return null;
  const snapshot = await getDocWithTransientRetry(doc(db, "users", user.uid));
  if (!snapshot.exists()) throw new Error("ACCOUNT_PROFILE_NOT_AVAILABLE");
  const profile = { uid: user.uid, email: user.email || "", ...snapshot.data() };
  if (profile.active === false || !STAFF_ROLES.includes(profile.role)) {
    throw new Error("ACCOUNT_NOT_ALLOWED");
  }
  if (profile.role !== "super_admin") {
    if (!profile.tenantId) throw new Error("TENANT_REQUIRED");
    const tenantSnapshot = await getDocWithTransientRetry(doc(db, "tenants", profile.tenantId));
    if (!tenantSnapshot.exists()) throw new Error("TENANT_NOT_FOUND");
    const tenant = tenantSnapshot.data();
    const decision = tenantAccessDecision(tenant, profile.role);
    if (!decision.allowed) throw tenantAccessError(decision);
  }
  return profile;
}

async function signInStaffWithTransientRetry(email, password) {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    if (!transientFirebaseNetworkError(error)) throw error;
    await delay(AUTH_TRANSIENT_RETRY_MS);
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (
      auth.currentUser
      && String(auth.currentUser.email || "").trim().toLowerCase() === normalizedEmail
    ) {
      return { user: auth.currentUser };
    }
    return signInWithEmailAndPassword(auth, email, password);
  }
}

export async function authenticateStaff(email, password) {
  const credential = await signInStaffWithTransientRetry(email, password);
  try {
    return await loadProfile(credential.user);
  } catch (error) {
    await signOut(auth).catch(() => {});
    throw error;
  }
}

export async function ensureSignupUser(email, password) {
  try {
    return await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    if (!String(error?.code || "").includes("email-already-in-use")) throw error;
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch {
      throw new Error("REGISTER_EMAIL_ALREADY_USED");
    }
  }
}

export async function sendSignupVerification(user, returnPath = "/register?verify=1") {
  if (!user) throw new Error("REGISTER_ACCOUNT_NOT_FOUND");
  await reload(user).catch(() => {});
  if (auth.currentUser?.emailVerified) return { alreadyVerified: true };
  const url = new URL(returnPath, location.origin).toString();
  await sendEmailVerification(auth.currentUser || user, { url, handleCodeInApp: false });
  return { alreadyVerified: false };
}

export async function requestSignup(payload) {
  const response = await requestTrialTenantSignup(payload);
  return response.data || {};
}

export async function activateSignup() {
  const user = auth.currentUser;
  if (!user) throw new Error("REGISTER_LOGIN_REQUIRED");
  await reload(user);
  if (!auth.currentUser?.emailVerified) throw new Error("REGISTER_EMAIL_NOT_VERIFIED");
  const response = await activateTrialTenantSignup({});
  return response.data || {};
}

export async function resendSignupVerification(returnPath = "/register?verify=1") {
  return sendSignupVerification(auth.currentUser, returnPath);
}
