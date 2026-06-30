import {
  auth, db, functions,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  doc, getDoc, httpsCallable,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from "./firebase-config.js?v=20260630-073";
import { clearActiveTenant, setActiveTenant } from "./tenant-context.js";

export const ROLE_HOME = {
  super_admin: "/platform",
  owner: "/admin",
  admin: "/admin",
  cashier: "/cashier",
  kitchen: "/kitchen"
};

export const STAFF_ROLES = ["owner", "admin", "cashier", "kitchen", "super_admin"];

function icon(name, className = "app-icon") {
  return `<svg class="${className}" aria-hidden="true"><use href="/assets/images/app-icons.svg?v=20260630-082#icon-${name}"></use></svg>`;
}

function ensureIconStyles() {
  if (!document.querySelector('link[href^="/assets/css/icons.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/css/icons.css?v=20260630-079";
    document.head.appendChild(link);
  }
}

function ensurePasswordDialogStyles() {
  if (document.querySelector("#owner-password-dialog-styles")) return;
  const style = document.createElement("style");
  style.id = "owner-password-dialog-styles";
  style.textContent = `
    .owner-password-backdrop{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:18px;background:rgba(8,18,14,.48);backdrop-filter:blur(8px)}
    .owner-password-dialog{width:min(460px,100%);border-radius:22px;background:#fff;box-shadow:0 24px 70px rgba(10,25,18,.28);padding:22px;color:#111827}
    .owner-password-dialog h2{margin:0 0 6px;font-size:24px}
    .owner-password-dialog p{margin:0 0 18px;color:#64748b;font-weight:600}
    .owner-password-field{display:grid;gap:7px;margin-top:12px;font-weight:800;color:#334155}
    .owner-password-field input{width:100%;box-sizing:border-box;border:1px solid #d8e2dc;border-radius:14px;padding:13px 14px;font:inherit;font-weight:700;outline:none}
    .owner-password-field input:focus{border-color:#159447;box-shadow:0 0 0 4px rgba(21,148,71,.12)}
    .owner-password-error{min-height:20px;margin-top:12px;color:#d33;font-weight:800}
    .owner-password-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
    .owner-password-actions button{border:0;border-radius:14px;padding:12px 16px;font-weight:900;cursor:pointer}
    .owner-password-cancel{background:#eef3ef;color:#111827}
    .owner-password-submit{background:#159447;color:#fff}
    .owner-password-submit:disabled{opacity:.65;cursor:wait}
  `;
  document.head.appendChild(style);
}

function roleLabel(role) {
  return ({ super_admin: "เจ้าของระบบ", owner: "เจ้าของร้าน", admin: "ผู้ดูแลระบบ", cashier: "แคชเชียร์", kitchen: "ครัว" })[role] || role;
}

function greetingName(profile) {
  if (profile.role === "cashier") return "แคชเชียร์";
  if (profile.role === "kitchen") return "Kitchen";
  if (profile.role === "admin") return "Admin";
  if (profile.role === "owner") return profile.displayName || "Owner";
  if (profile.role === "super_admin") return profile.displayName || "Super Admin";
  return profile.displayName || roleLabel(profile.role);
}

function roleMenuLinks(profile) {
  if (profile.role === "super_admin") {
    return [
      { href: "/platform", icon: "home", label: "ระบบกลาง" },
      { href: "/admin/tenants", icon: "settings", label: "จัดการร้านค้า" }
    ];
  }

  const links = [{ href: "/", icon: "home", label: "หน้าหลัก" }];
  if (["owner", "cashier"].includes(profile.role)) links.push({ href: "/cashier/table-qr", icon: "table", label: "ออกโต๊ะ" });
  if (["owner", "admin"].includes(profile.role)) links.push({ href: "/admin", icon: "settings", label: "จัดการระบบร้าน" });
  if (profile.role === "owner") {
    links.push({ href: "/admin/users", icon: "users", label: "จัดการพนักงาน" });
    links.push({ action: "change-password", icon: "key", label: "เปลี่ยนรหัสผ่าน" });
  }
  return links;
}

async function activateProfileTenant(profile = {}) {
  if (profile.role === "super_admin") return true;
  if (!profile.tenantId) {
    clearActiveTenant();
    return false;
  }

  const tenantSnapshot = await getDoc(doc(db, "tenants", profile.tenantId));
  if (!tenantSnapshot.exists()) {
    clearActiveTenant();
    return false;
  }

  const tenant = tenantSnapshot.data();
  const slug = String(profile.tenantSlug || tenant.slug || "").trim().toLowerCase();
  if (!slug) {
    clearActiveTenant();
    return false;
  }

  setActiveTenant({
    id: profile.tenantId,
    slug,
    name: profile.tenantName || tenant.name || slug
  });
  return true;
}

function renderMenuItem(item) {
  if (item.action) return `<button type="button" class="user-menu-link" data-menu-action="${item.action}" role="menuitem">${icon(item.icon)}<span>${item.label}</span></button>`;
  return `<a class="user-menu-link" href="${item.href}" role="menuitem">${icon(item.icon)}<span>${item.label}</span></a>`;
}

function passwordErrorText(error) {
  const code = String(error?.code || error?.message || "");
  if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) return "รหัสผ่านเดิมไม่ถูกต้อง";
  if (code.includes("auth/weak-password")) return "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร";
  if (code.includes("auth/requires-recent-login")) return "กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่ก่อนเปลี่ยนรหัสผ่าน";
  return "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่";
}

function showOwnerPasswordDialog() {
  ensurePasswordDialogStyles();
  const user = auth?.currentUser;
  const email = user?.email || "";
  if (!user || !email) return;

  document.querySelector(".owner-password-backdrop")?.remove();
  const backdrop = document.createElement("div");
  backdrop.className = "owner-password-backdrop";
  backdrop.innerHTML = `
    <form class="owner-password-dialog" data-owner-password-form>
      <h2>เปลี่ยนรหัสผ่าน</h2>
      <p>สำหรับเจ้าของร้านเท่านั้น กรุณากรอกรหัสผ่านเดิมเพื่อยืนยันตัวตน</p>
      <label class="owner-password-field">รหัสผ่านเดิม<input type="password" name="currentPassword" autocomplete="current-password" required></label>
      <label class="owner-password-field">รหัสผ่านใหม่<input type="password" name="newPassword" autocomplete="new-password" minlength="6" required></label>
      <label class="owner-password-field">ยืนยันรหัสผ่านใหม่<input type="password" name="confirmPassword" autocomplete="new-password" minlength="6" required></label>
      <div class="owner-password-error" data-password-error></div>
      <div class="owner-password-actions">
        <button class="owner-password-cancel" type="button" data-close-password-dialog>ยกเลิก</button>
        <button class="owner-password-submit" type="submit">เปลี่ยนรหัสผ่าน</button>
      </div>
    </form>`;

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop || event.target.closest("[data-close-password-dialog]")) close();
  });

  backdrop.querySelector("[data-owner-password-form]").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorBox = form.querySelector("[data-password-error]");
    const button = form.querySelector(".owner-password-submit");
    const currentPassword = form.currentPassword.value;
    const newPassword = form.newPassword.value;
    const confirmPassword = form.confirmPassword.value;

    errorBox.textContent = "";
    if (newPassword !== confirmPassword) {
      errorBox.textContent = "รหัสผ่านใหม่และยืนยันรหัสผ่านใหม่ไม่ตรงกัน";
      form.confirmPassword.focus();
      return;
    }
    if (newPassword.length < 6) {
      errorBox.textContent = "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร";
      form.newPassword.focus();
      return;
    }

    button.disabled = true;
    button.textContent = "กำลังตรวจสอบ...";
    try {
      const credential = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      button.textContent = "กำลังเปลี่ยนรหัสผ่าน...";
      await updatePassword(user, newPassword);
      errorBox.style.color = "#0f8a3b";
      errorBox.textContent = "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว";
      setTimeout(close, 900);
    } catch (error) {
      console.error("OWNER_PASSWORD_CHANGE_FAILED", error);
      errorBox.style.color = "#d33";
      errorBox.textContent = passwordErrorText(error);
      button.disabled = false;
      button.textContent = "เปลี่ยนรหัสผ่าน";
    }
  });

  document.body.appendChild(backdrop);
  setTimeout(() => backdrop.querySelector('input[name="currentPassword"]')?.focus(), 30);
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
      <div class="user-menu-greeting">สวัสดี ${greetingName(profile)}<span class="user-menu-role">${roleLabel(profile.role)}</span></div>
      ${roleMenuLinks(profile).map(renderMenuItem).join("")}
      <button type="button" class="user-menu-action danger" data-logout role="menuitem">${icon("logout")}<span>ออกจากระบบ</span></button>
    </div>`;
  header.appendChild(menu);

  const trigger = menu.querySelector("[data-user-menu-trigger]");
  const panel = menu.querySelector("[data-user-menu-panel]");
  const setMenuOpen = open => {
    panel.hidden = !open;
    menu.classList.toggle("open", open);
    trigger.setAttribute("aria-expanded", String(open));
  };
  const closeMenu = () => setMenuOpen(false);
  trigger.addEventListener("click", event => { event.stopPropagation(); setMenuOpen(panel.hidden); });
  document.addEventListener("click", event => { if (!menu.contains(event.target)) closeMenu(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); });
  menu.querySelector('[data-menu-action="change-password"]')?.addEventListener("click", () => { closeMenu(); showOwnerPasswordDialog(); });
  menu.querySelector("[data-logout]").addEventListener("click", async () => { await signOut(auth); location.replace("/login"); });
}

export function waitForAuth() {
  return new Promise(resolve => {
    const stop = onAuthStateChanged(auth, user => { stop(); resolve(user); });
  });
}

export async function getUserProfile(user) {
  if (!user) return null;
  const snapshot = await getDoc(doc(db, "users", user.uid));
  if (!snapshot.exists()) return null;
  const profile = { uid: user.uid, email: user.email, ...snapshot.data() };
  profile.tenantReady = await activateProfileTenant(profile);
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
  const ownerAllowed = profile?.role === "owner" && allowedRoles.some(role => ["owner", "admin", "cashier", "kitchen"].includes(role));
  const permitted = ownerAllowed || allowedRoles.includes(profile?.role);

  if (!profile || profile.active === false || !permitted || profile.tenantReady === false) {
    location.replace(profile?.tenantReady === false ? "/login/?error=tenant" : (ROLE_HOME[profile?.role] || "/login"));
    return new Promise(() => {});
  }

  document.documentElement.style.visibility = "";
  mountUserMenu(profile);
  return profile;
}

export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(credential.user);
  if (!profile || profile.active === false || profile.tenantReady === false) {
    await signOut(auth);
    clearActiveTenant();
    throw new Error(profile?.tenantReady === false ? "TENANT_NOT_ASSIGNED" : "ACCOUNT_NOT_ALLOWED");
  }
  return profile;
}

function callFunction(name) {
  if (!functions) throw new Error("FUNCTIONS_NOT_READY");
  return httpsCallable(functions, name);
}

export async function listStaffUsers() {
  const result = await callFunction("listTenantStaff")({});
  return result.data?.users || [];
}

export async function createStaffUser(payload) {
  const result = await callFunction("createTenantStaff")(payload);
  return result.data?.uid;
}

export async function updateStaffUser(uid, patch) {
  await callFunction("updateTenantStaff")({ uid, ...patch });
}
