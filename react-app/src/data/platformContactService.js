import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/firebase/client";

async function saveSetting(id, payload) {
  const user = auth.currentUser;
  if (!user) throw new Error("AUTH_REQUIRED");
  const value = {
    id,
    tenantId: "__platform__",
    ...payload,
    updatedBy: user.uid,
    updatedByEmail: user.email || "",
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  };
  await setDoc(doc(db, "platformSettings", id), value, { merge: false });
  return value;
}

export async function loadPublicContact() {
  const snapshot = await getDoc(doc(db, "platformSettings", "publicContact"));
  return { exists: snapshot.exists(), contact: snapshot.exists() ? snapshot.data() : null };
}

async function saveAndConfirm(id, payload, uncertainCode) {
  try {
    await saveSetting(id, payload);
  } catch (error) {
    // Failed permission/validation is definite. A timeout is not: it can
    // occur after the Firestore write has committed.
    if (["unavailable", "deadline-exceeded", "unknown", "internal"].includes(String(error?.code || "").replace(/^firestore\//, ""))) {
      throw new Error(uncertainCode);
    }
    throw error;
  }
  try {
    const snapshot = await getDoc(doc(db, "platformSettings", id));
    const saved = snapshot.exists() ? snapshot.data() : null;
    if (!saved || Object.keys(payload).some(key => saved[key] !== payload[key])) {
      throw new Error(uncertainCode);
    }
    return saved;
  } catch {
    // Do not permit another sensitive write until the operator refreshes and
    // independently confirms what the server persisted.
    throw new Error(uncertainCode);
  }
}

export async function savePublicContact(contact) {
  const saved = await saveAndConfirm("publicContact", contact, "PLATFORM_CONTACT_WRITE_UNCONFIRMED");
  return { contact: saved };
}

export async function loadGoogleCustomerLogin() {
  const snapshot = await getDoc(doc(db, "platformSettings", "googleCustomerLogin"));
  const value = snapshot.exists() ? snapshot.data() : {};
  return {
    enabled: value.enabled === true,
    clientId: String(value.clientId || ""),
    tokenTtlDays: Math.max(1, Math.min(90, Number(value.tokenTtlDays || 30))),
    source: snapshot.exists() ? "database" : "environment",
    storageReady: true,
  };
}

export async function saveGoogleCustomerLogin(settings) {
  const saved = await saveAndConfirm("googleCustomerLogin", {
    enabled: settings.enabled === true,
    clientId: String(settings.clientId || "").trim(),
    tokenTtlDays: Math.max(1, Math.min(90, Number.parseInt(settings.tokenTtlDays, 10) || 30)),
  }, "GOOGLE_LOGIN_WRITE_UNCONFIRMED");
  return { ...saved, source: "database", storageReady: true };
}
