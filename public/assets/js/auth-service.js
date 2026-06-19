import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, getDoc } from "./firebase-config.js";

export const ROLE_HOME = {
  super_admin: "/",
  admin: "/admin",
  cashier: "/cashier",
  kitchen: "/kitchen"
};

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
