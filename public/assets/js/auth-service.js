import {
  auth, db, firebaseConfig, initializeApp, getAuth,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword,
  collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp
} from "./firebase-config.js";

export const ROLE_HOME = {
  super_admin: "/",
  admin: "/admin",
  cashier: "/cashier",
  kitchen: "/kitchen"
};

export const STAFF_ROLES = ["admin", "cashier", "kitchen", "super_admin"];

export function waitForAuth() {
  return new Promise(resolve => {
    const stop = onAuthStateChanged(auth, user => {
      stop();
      resolve(user);
    });
  });
}

export async function getUserProfile(user) {
  if (!user) return null;
  const snapshot = await getDoc(doc(db, "users", user.uid));
  return snapshot.exists() ? { uid: user.uid, email: user.email, ...snapshot.data() } : null;
}

export async function requireRole(allowedRoles = []) {
  document.documentElement.style.visibility = "hidden";
  const user = await waitForAuth();
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`/login/?next=${next}`);
    return new Promise(() => {});
  }

  const profile = await getUserProfile(user);
  if (!profile || profile.active === false || (profile.role !== "super_admin" && !allowedRoles.includes(profile.role))) {
    location.replace(ROLE_HOME[profile?.role] || "/login");
    return new Promise(() => {});
  }

  document.documentElement.style.visibility = "";
  const header = document.querySelector(".app-header");
  if (header && !header.querySelector("[data-logout]")) {
    const box = document.createElement("div");
    box.className = "auth-user";
    box.innerHTML = `<span class="badge dark">${profile.displayName || profile.email}</span><button type="button" class="btn btn-sm" data-logout>ออกจากระบบ</button>`;
    header.appendChild(box);
    box.querySelector("[data-logout]").addEventListener("click", async () => {
      await signOut(auth);
      location.replace("/login");
    });
  }
  return profile;
}

export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(credential.user);
  if (!profile || profile.active === false) {
    await signOut(auth);
    throw new Error("ACCOUNT_NOT_ALLOWED");
  }
  return profile;
}

export async function listStaffUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs
    .map(item => ({ uid: item.id, ...item.data() }))
    .sort((a, b) => String(a.displayName || a.email || "").localeCompare(String(b.displayName || b.email || ""), "th"));
}

export async function createStaffUser({ email, password, displayName, role, active }) {
  if (!STAFF_ROLES.includes(role)) throw new Error("INVALID_ROLE");
  const secondaryApp = initializeApp(firebaseConfig, `staff-create-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await setDoc(doc(db, "users", credential.user.uid), {
      email,
      displayName,
      role,
      active: Boolean(active),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return credential.user.uid;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
  }
}

export async function updateStaffUser(uid, patch) {
  const nextPatch = { ...patch, updatedAt: serverTimestamp() };
  if (nextPatch.role && !STAFF_ROLES.includes(nextPatch.role)) throw new Error("INVALID_ROLE");
  await updateDoc(doc(db, "users", uid), nextPatch);
}
