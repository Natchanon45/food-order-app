import {
  auth, db, doc, getDoc, onAuthStateChanged, serverTimestamp, setDoc,
} from "./firebase-config.js?v=20260630-073";

function waitForUser() {
  if (auth?.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => { unsubscribe(); reject(new Error("AUTH_TIMEOUT")); }, 10000);
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) return;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    });
  });
}

function cleanPath(path = "") { return String(path).split("?")[0].replace(/\/+$/, ""); }

async function publicContact(method, body = {}) {
  const ref = doc(db, "platformSettings", "publicContact");
  if (method === "GET") {
    const snapshot = await getDoc(ref);
    return { exists: snapshot.exists(), contact: snapshot.exists() ? snapshot.data() : null };
  }
  const user = await waitForUser();
  await setDoc(ref, {
    id: "publicContact", tenantId: "__platform__", ...body,
    updatedBy: user.uid, updatedByEmail: user.email || "",
    updatedAt: serverTimestamp(), updatedAtMs: Date.now(),
  }, { merge: false });
  return { exists: true, contact: body };
}

async function googleLogin(method, body = {}) {
  const ref = doc(db, "platformSettings", "googleCustomerLogin");
  if (method === "GET") {
    const snapshot = await getDoc(ref);
    const value = snapshot.exists() ? snapshot.data() : {};
    return { googleCustomerLogin: {
      enabled: value.enabled === true,
      clientId: String(value.clientId || ""),
      tokenTtlDays: Math.max(1, Math.min(90, Number(value.tokenTtlDays || 30))),
      source: snapshot.exists() ? "database" : "environment",
    } };
  }
  const user = await waitForUser();
  const value = {
    id: "googleCustomerLogin", tenantId: "__platform__",
    enabled: body.enabled === true,
    clientId: String(body.clientId || "").trim(),
    tokenTtlDays: Math.max(1, Math.min(90, Number(body.tokenTtlDays || 30))),
    updatedBy: user.uid, updatedByEmail: user.email || "",
    updatedAt: serverTimestamp(), updatedAtMs: Date.now(),
  };
  await setDoc(ref, value, { merge: false });
  return { googleCustomerLogin: { ...value, source: "database" } };
}

export async function apiRequest(path, options = {}) {
  const route = cleanPath(path);
  const method = String(options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};
  if (route === "/api/platform/contact") return publicContact(method, body);
  if (route === "/api/platform/contact/google-login") return googleLogin(method, body);
  throw new Error(`UNSUPPORTED_PLATFORM_CONTACT_ROUTE:${route}`);
}
