import {
  auth, db, firebaseConfig, initializeApp, getAuth,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword,
  collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp
} from "./firebase-config.js";
import { DEFAULT_TENANT, resolveTenantContext, setActiveTenant } from "./tenant-context.js";

export const ROLE_HOME = {
  super_admin: "/",
  owner: "/admin",
  admin: "/admin",
  cashier: "/cashier",
  kitchen: "/kitchen"
};

export const STAFF_ROLES = ["owner", "admin", "cashier", "kitchen", "super_admin"];

function icon(name, className = "app-icon") {
  return `<svg class="${className}" aria-hidden="true"><use href="/assets/images/app-icons.svg#icon-${name}"></use></svg>`;
}

function ensureIconStyles() {
  if (document.querySelector('link[href="/assets/css/icons.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/icons.css";
  document.head.appendChild(link);
}

function roleLabel(role) {
  return ({
    super_admin: "เจ้าของระบบ",
    owner: "เจ้าของร้าน",
    admin: "ผู้ดูแลระบบ",
    cashier: "แคชเชียร์",
    kitchen: "ครัว"
  })[role] || role;
}

function greetingName(profile) {
  if (profile.role === "cashier") return "แคชเชียร์";
  if (profile.role === "kitchen") return "Kitchen";
  if (profile.role === "admin") return "Admin";
  if (profile.role === "owner") return profile.displayName || "Owner";
  if (profile.role === "super_admin") return "Owner";
  return profile.displayName || roleLabel(profile.role);
}

function roleMenuLinks(profile) {
  const links = [{ href: "/", icon: "home", label: "หน้าหลัก" }];

  if (["owner", "cashier", "super_admin"].includes(profile.role)) {
    links.push({ href: "/cashier/table-qr", icon: "table", label: "ออกโต๊ะ" });
  }

  if (["owner", "admin", "super_admin"].includes(profile.role)) {
    links.push({ href: "/admin", icon: "settings", label: "จัดการระบบ" });
  }

  if (["owner", "super_admin"].includes(profile.role)) {
    links.push({ href: "/admin/users", icon: "users", label: "จัดการพนักงาน" });
  }

  return links;
}

function activateProfileTenant(profile = {}) {
  const fallback = resolveTenantContext();
  return setActiveTenant({
    id: profile.tenantId || fallback.id || DEFAULT_TENANT.id,
    slug: profile.tenantSlug || fallback.slug || DEFAULT_TENANT.slug,
    name: profile.tenantName || fallback.name || DEFAULT_TENANT.name
  });
}

export function mountUserMenu(profile) {
  ensureIconStyles();
  const header = document.querySelector(".app-header");
  if (!header || header.querySelector("[data-user-menu]")) return;

  const menu = document.createElement("div");
  menu.className = "user-menu";
  menu.dataset.userMenu = "true";
  menu.innerHTML = `
    <button type="button" class="user-menu-trigger" data-user-menu-trigger aria-expanded="false" aria-haspopup="menu">
      <span class="user-menu-avatar">${icon("user")}</span>
      <span class="user-menu-trigger-label">${profile.displayName || roleLabel(profile.role)}</span>
      ${icon("chevron-down", "app-icon user-menu-chevron")}
    </button>
    <div class="user-menu-panel" data-user-menu-panel role="menu" hidden>
      <div class="user-menu-greeting">
        สวัสดี ${greetingName(profile)}
        <span class="user-menu-role">${roleLabel(profile.role)}</span>
      </div>
      ${roleMenuLinks(profile).map(item => `
        <a class="user-menu-link" href="${item.href}" role="menuitem">
          ${icon(item.icon)}
          <span>${item.label}</span>
        </a>
      `).join("")}
      <button type="button" class="user-menu-action danger" data-logout role="menuitem">
        ${icon("logout")}
        <span>ออกจากระบบ</span>
      </button>
    </div>
  `;
  header.appendChild(menu);

  const trigger = menu.querySelector("[data-user-menu-trigger]");
  const panel = menu.querySelector("[data-user-menu-panel]");

  const closeMenu = () => {
    panel.hidden = true;
    menu.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  };

  trigger.addEventListener("click", event => {
    event.stopPropagation();
    const nextOpen = panel.hidden;
    panel.hidden = !nextOpen;
    menu.classList.toggle("open", nextOpen);
    trigger.setAttribute("aria-expanded", String(nextOpen));
  });

  document.addEventListener("click", event => {
    if (!menu.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });

  menu.querySelector("[data-logout]").addEventListener("click", async () => {
    await signOut(auth);
    location.replace("/login");
  });
}

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
  if (!snapshot.exists()) return null;
  const profile = { uid: user.uid, email: user.email, ...snapshot.data() };
  activateProfileTenant(profile);
  return profile;
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
    location.replace(ROLE_HOME[profile?.role] || "/delivery");
    return new Promise(() => {});
  }

  document.documentElement.style.visibility = "";
  mountUserMenu(profile);
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
  if (!STAFF_ROLES.includes(role) || ["owner", "super_admin"].includes(role)) throw new Error("INVALID_ROLE");
  const tenant = resolveTenantContext();
  const secondaryApp = initializeApp(firebaseConfig, `staff-create-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await setDoc(doc(db, "users", credential.user.uid), {
      email,
      displayName,
      role,
      active: Boolean(active),
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
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
  if (nextPatch.role && (!STAFF_ROLES.includes(nextPatch.role) || ["owner", "super_admin"].includes(nextPatch.role))) throw new Error("INVALID_ROLE");
  await updateDoc(doc(db, "users", uid), nextPatch);
}