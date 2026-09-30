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

export function savePublicContact(contact) {
  return saveSetting("publicContact", contact);
}

export async function loadGoogleCustomerLogin() {
  const snapshot = await getDoc(doc(db, "platformSettings", "googleCustomerLogin"));
  const value = snapshot.exists() ? snapshot.data() : {};
  return {
    enabled: value.enabled === true,
    clientId: String(value.clientId || ""),
    tokenTtlDays: Math.max(1, Math.min(90, Number(value.tokenTtlDays || 30))),
    source: snapshot.exists() ? "database" : "environment",
  };
}

export async function saveGoogleCustomerLogin(settings) {
  const saved = await saveSetting("googleCustomerLogin", {
    enabled: settings.enabled === true,
    clientId: String(settings.clientId || "").trim(),
    tokenTtlDays: Math.max(1, Math.min(90, Number.parseInt(settings.tokenTtlDays, 10) || 30)),
  });
  return { ...saved, source: "database" };
}
