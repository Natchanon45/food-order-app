import {
  auth, db, functions,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  doc, getDoc, httpsCallable,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from "./firebase-config.js?v=20260630-073";
import "./form-validation-ui.js?v=20260731-080";
import { clearActiveTenant, setActiveTenant } from "./tenant-context.js";
import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";

export const ROLE_HOME = {
  super_admin: "/platform",
  owner: "/admin",
  admin: "/admin",
  cashier: "/cashier",
  kitchen: "/kitchen"
};

export const STAFF_ROLES = ["owner", "admin", "cashier", "kitchen", "manager", "super_admin"];

function icon(name, className = "app-icon") {
  return iconMarkup(name, className.replace(/\bapp-icon\b/g, "").trim());
}
function lower(value) { return String(value || "").trim().toLowerCase(); }
function moduleValues(profile = {}) {
  return [
    profile.module,
    profile.tenantType,
    profile.businessType,
    profile.businessUnit,
    profile.business_unit,
    profile.businessScope,
    profile.business_scope,
    ...(Array.isArray(profile.modules) ? profile.modules : []),
    ...(Array.isArray(profile.businessUnits) ? profile.businessUnits : []),
    ...(Array.isArray(profile.allowedModules) ? profile.allowedModules : [])
  ].filter(Boolean).map(lower);
}
function routeModule() {
  const explicit = lower(document.body?.dataset?.module || "");
  if (explicit) return explicit;
  if (location.pathname.replace(/\/index\.html$/, "/").startsWith("/pos")) return "retail-pos";
  return "";
}
function profileSupportsModule(profile = {}, moduleName = "") {
  if (!moduleName) return true;
  if (profile.role === "super_admin") return true;
  const values = moduleValues(profile);
  if (moduleName === "retail-pos") {
    if (profile.role === "owner") return !values.length || values.includes("retail_pos") || values.includes("retail") || values.includes("all") || values.includes("both");
    return values.includes("retail_pos") || values.includes("retail") || values.includes("all") || values.includes("both");
  }
  if (!values.length) return true;
  return values.includes(moduleName) || values.includes("all");
}
function moduleHome(profile = {}) {
  if (profile.role === "cashier" && lower(profile.businessUnit || profile.business_unit) === "order_delivery") return "/cashier";
  return ROLE_HOME[profile.role] || "/login";
}

function ensureIconStyles() {
  if (!document.querySelector('link[href^="/assets/css/icons.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/css/icons.css?v=20260731-079";
    document.head.appendChild(link);
  }
  if (!document.querySelector('link[href*="cdn-uicons.flaticon.com"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn-uicons.flaticon.com/4.0.0/uicons-regular-rounded/css/uicons-regular-rounded.css";
    document.head.appendChild(link);
  }
}

function ensurePasswordDialogStyles() {
  if (document.querySelector("#owner-password-dialog-styles")) return;
  const style = document.createElement("style");
  style.id = "owner-password-dialog-styles";
  style.textContent = `
    .owner-password-backdrop{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:rgba(5,18,12,.58);backdrop-filter:blur(9px);animation:owner-password-fade .16s ease-out}
    .owner-password-dialog{width:min(500px,100%);max-height:min(760px,calc(100dvh - 28px));overflow:auto;border:1px solid rgba(21,148,71,.12);border-radius:26px;background:#fff;box-shadow:0 30px 90px rgba(7,31,19,.34);color:#17211b;animation:owner-password-rise .2s ease-out}
    .owner-password-header{display:flex;align-items:flex-start;gap:14px;padding:24px 24px 18px;border-bottom:1px solid #e7eee9;background:linear-gradient(135deg,#f5fcf7 0%,#fff 72%)}
    .owner-password-heading-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 48px;width:48px;height:48px;border-radius:15px;background:#dcf8e7;color:#118540;font-size:1.35rem;line-height:1;box-shadow:inset 0 0 0 1px rgba(21,148,71,.08)}
    .owner-password-key-icon{display:inline-flex;align-items:center;justify-content:center;width:1em;height:1em;line-height:1}.owner-password-key-icon::before,.profile-key-reference-icon::before{display:block;line-height:1;transform:rotate(90deg) scaleY(-1);transform-origin:center}
    .owner-password-title{flex:1;min-width:0}.owner-password-dialog h2{margin:1px 0 5px;font-size:1.5rem;line-height:1.2}.owner-password-dialog p{margin:0;color:#64748b;font-size:.93rem;font-weight:600;line-height:1.55}
    .owner-password-close{display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border:0;border-radius:12px;background:#edf3ef;color:#334a3d;cursor:pointer;font-size:1rem}.owner-password-close:hover{background:#e1ece5;color:#0d6f35}
    .owner-password-body{display:grid;gap:16px;padding:22px 24px 8px}.owner-password-field{display:grid;gap:8px;font-weight:750;color:#263c30}.owner-password-label{display:flex;align-items:center;gap:8px}.owner-password-label .app-icon{color:#159447}
    .owner-password-input-wrap{position:relative}.owner-password-field input{width:100%;box-sizing:border-box;border:1px solid #cfdbd3;border-radius:14px;background:#fbfdfb;padding:13px 48px 13px 14px;font:inherit;outline:none;transition:border-color .16s,box-shadow .16s,background .16s}.owner-password-field input:hover{border-color:#9fc5ac}.owner-password-field input:focus{border-color:#159447;background:#fff;box-shadow:0 0 0 4px rgba(21,148,71,.12)}
    .owner-password-toggle{position:absolute;top:50%;right:7px;transform:translateY(-50%);display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:10px;background:transparent;color:#607267;cursor:pointer}.owner-password-toggle:hover{background:#eaf6ee;color:#118540}
    .owner-password-hint{display:flex;align-items:center;gap:7px;margin-top:-3px;color:#718096;font-size:.82rem;font-weight:600}.owner-password-hint .app-icon{color:#159447}
    .owner-password-error{display:none;align-items:center;gap:8px;min-height:22px;margin:8px 24px 0;padding:11px 13px;border-radius:12px;background:#fff0f0;color:#c92b2b;font-weight:700}.owner-password-error.has-message{display:flex}.owner-password-error.is-success{background:#eaf8ef;color:#0f7d3a}
    .owner-password-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;padding:18px 24px 22px;border-top:1px solid #e7eee9;background:#fbfdfb}.owner-password-actions button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;border:0;border-radius:14px;padding:12px 18px;font-weight:750;cursor:pointer}.owner-password-cancel{background:#e9efeb;color:#263c30}.owner-password-cancel:hover{background:#dfe8e2}.owner-password-submit{min-width:174px;background:#159447;color:#fff;box-shadow:0 10px 24px rgba(21,148,71,.2)}.owner-password-submit:hover{background:#107f3c}.owner-password-submit:disabled{opacity:.65;cursor:wait;box-shadow:none}
    @keyframes owner-password-fade{from{opacity:0}to{opacity:1}}@keyframes owner-password-rise{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
    @media(max-width:600px){.owner-password-backdrop{align-items:end;padding:10px}.owner-password-dialog{width:100%;max-height:calc(100dvh - 20px);border-radius:24px}.owner-password-header{padding:19px 18px 15px}.owner-password-heading-icon{width:44px;height:44px;flex-basis:44px}.owner-password-dialog h2{font-size:1.3rem}.owner-password-body{padding:18px 18px 6px;gap:14px}.owner-password-error{margin-inline:18px}.owner-password-actions{padding:15px 18px 18px}.owner-password-actions button{flex:1;padding-inline:12px}.owner-password-submit{min-width:0}}
  `;
  document.head.appendChild(style);
}

function roleLabel(role) {
  return ({ super_admin: "เจ้าของระบบ", owner: "เจ้าของร้าน", admin: "ผู้ดูแลระบบ", manager: "ผู้จัดการ", cashier: "แคชเชียร์", kitchen: "ครัว" })[role] || role;
}

function greetingName(profile) {
  if (profile.role === "cashier") return "แคชเชียร์";
  if (profile.role === "kitchen") return "Kitchen";
  if (profile.role === "manager") return "Manager";
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
  if (["owner", "admin", "manager", "cashier"].includes(profile.role)) links.push({ href: "/cashier/waiting-queue", icon: "people", label: "คิวรอโต๊ะ" });
  if (["owner", "cashier"].includes(profile.role)) links.push({ href: "/cashier/table-qr", icon: "easel2", label: "เปิดโต๊ะ" });
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
  const flaticon = {
    home: "house-chimney",
    people: "user-time",
    easel2: "room-service",
    settings: "settings-sliders",
    users: "users"
  };
  const itemIcon = item.icon === "key"
    ? '<i class="fi fi-rr-key app-icon fontawesome-profile-icon profile-key-reference-icon" aria-hidden="true"></i>'
    : `<i class="fi fi-rr-${flaticon[item.icon] || "circle"} app-icon" aria-hidden="true"></i>`;
  if (item.action) return `<button type="button" class="user-menu-link" data-menu-action="${item.action}" role="menuitem">${itemIcon}<span>${item.label}</span></button>`;
  return `<a class="user-menu-link" href="${item.href}" role="menuitem">${itemIcon}<span>${item.label}</span></a>`;
}

function passwordErrorText(error) {
  const code = String(error?.code || error?.message || "");
  if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) return "รหัสผ่านเดิมไม่ถูกต้อง";
  if (code.includes("auth/weak-password")) return "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร";
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
  const passwordField = ({ label, name, autocomplete, hint = "" }) => `
    <label class="owner-password-field">
      <span class="owner-password-label">${icon("lock")}<span>${label}</span></span>
      <span class="owner-password-input-wrap">
        <input type="password" name="${name}" autocomplete="${autocomplete}"${name === "currentPassword" ? "" : ' minlength="8"'} required>
        <button class="owner-password-toggle" type="button" data-password-toggle aria-label="แสดง${label}" aria-pressed="false">${icon("eye")}</button>
      </span>
      ${hint ? `<small class="owner-password-hint">${icon("info-circle")}<span>${hint}</span></small>` : ""}
    </label>`;
  const keyIcon = '<i class="fi fi-rr-key owner-password-key-icon" aria-hidden="true"></i>';
  backdrop.innerHTML = `
    <form class="owner-password-dialog" data-owner-password-form>
      <div class="owner-password-header">
        <span class="owner-password-heading-icon">${keyIcon}</span>
        <div class="owner-password-title"><h2>เปลี่ยนรหัสผ่าน</h2><p>ยืนยันตัวตนด้วยรหัสผ่านเดิม แล้วกำหนดรหัสผ่านใหม่สำหรับบัญชีเจ้าของร้าน</p></div>
        <button class="owner-password-close" type="button" data-close-password-dialog aria-label="ปิดหน้าต่าง">${icon("close")}</button>
      </div>
      <div class="owner-password-body">
        ${passwordField({ label: "รหัสผ่านเดิม", name: "currentPassword", autocomplete: "current-password" })}
        ${passwordField({ label: "รหัสผ่านใหม่", name: "newPassword", autocomplete: "new-password", hint: "ใช้ตัวอักษรอย่างน้อย 8 ตัว เพื่อความปลอดภัยของบัญชี" })}
        ${passwordField({ label: "ยืนยันรหัสผ่านใหม่", name: "confirmPassword", autocomplete: "new-password" })}
      </div>
      <div class="owner-password-error" data-password-error>${icon("x-circle")}<span data-password-message></span></div>
      <div class="owner-password-actions">
        <button class="owner-password-cancel" type="button" data-close-password-dialog>${icon("close")}<span>ยกเลิก</span></button>
        <button class="owner-password-submit" type="submit">${keyIcon}<span>เปลี่ยนรหัสผ่าน</span></button>
      </div>
    </form>`;

  const onEscape = event => { if (event.key === "Escape") close(); };
  const close = () => { document.removeEventListener("keydown", onEscape); backdrop.remove(); };
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop || event.target.closest("[data-close-password-dialog]")) close();
  });
  backdrop.querySelectorAll("[data-password-toggle]").forEach(button => button.addEventListener("click", () => {
    const input = button.closest(".owner-password-input-wrap")?.querySelector("input");
    if (!input) return;
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    button.setAttribute("aria-pressed", String(!visible));
    button.innerHTML = icon(visible ? "eye" : "eye-slash");
  }));
  document.addEventListener("keydown", onEscape);

  const setMessage = (box, message = "", success = false) => {
    box.classList.toggle("has-message", Boolean(message));
    box.classList.toggle("is-success", Boolean(message) && success);
    const messageIcon = box.querySelector(".app-icon");
    if (messageIcon) messageIcon.className = `bi bi-${success ? "check-circle" : "x-circle"} app-icon`;
    box.querySelector("[data-password-message]").textContent = message;
  };

  backdrop.querySelector("[data-owner-password-form]").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorBox = form.querySelector("[data-password-error]");
    const button = form.querySelector(".owner-password-submit");
    const currentPassword = form.currentPassword.value;
    const newPassword = form.newPassword.value;
    const confirmPassword = form.confirmPassword.value;

    setMessage(errorBox);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage(errorBox, "กรุณากรอกรหัสผ่านให้ครบทุกช่อง");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage(errorBox, "รหัสผ่านใหม่และยืนยันรหัสผ่านใหม่ไม่ตรงกัน");
      form.confirmPassword.focus();
      return;
    }
    if (newPassword.length < 8) {
      setMessage(errorBox, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
      form.newPassword.focus();
      return;
    }

    button.disabled = true;
    button.innerHTML = `${icon("arrow-repeat")}<span>กำลังตรวจสอบ...</span>`;
    try {
      const credential = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      button.innerHTML = `${icon("arrow-repeat")}<span>กำลังเปลี่ยน...</span>`;
      await updatePassword(user, newPassword);
      setMessage(errorBox, "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว", true);
      setTimeout(close, 900);
    } catch (error) {
      console.error("OWNER_PASSWORD_CHANGE_FAILED", error);
      setMessage(errorBox, passwordErrorText(error));
      button.disabled = false;
      button.innerHTML = `${keyIcon}<span>เปลี่ยนรหัสผ่าน</span>`;
    }
  });

  document.body.appendChild(backdrop);
  setTimeout(() => backdrop.querySelector('input[name="currentPassword"]')?.focus(), 30);
}

async function logoutToLogin() {
  await signOut(auth);
  clearActiveTenant();
  location.replace("/login");
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
      <button type="button" class="user-menu-action danger" data-logout role="menuitem"><i class="fi fi-rr-exit app-icon" aria-hidden="true"></i><span>ออกจากระบบ</span></button>
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
  menu.querySelector("[data-logout]").addEventListener("click", async () => { await logoutToLogin(); });
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
  try {
    const user = await waitForAuth();
    if (!user) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.replace(`/login/?next=${next}`);
      return new Promise(() => {});
    }

    const profile = await getUserProfile(user);
    if (!profile?.role || profile.active === false) {
      throw new Error("ACCOUNT_PROFILE_NOT_AVAILABLE");
    }

    const ownerAllowed = profile.role === "owner" && allowedRoles.some(role => ["owner", "admin", "cashier", "kitchen", "manager"].includes(role));
    const permitted = ownerAllowed || allowedRoles.includes(profile.role);
    const moduleAllowed = profileSupportsModule(profile, routeModule());

    if (!permitted || !moduleAllowed) {
      location.replace(moduleHome(profile));
      return new Promise(() => {});
    }

    if (profile.role !== "super_admin" && profile.tenantReady === false) {
      document.documentElement.innerHTML = `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ยังไม่มีร้าน</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;font-family:system-ui,sans-serif;background:#f3f6f4;color:#151515}main{width:min(440px,100%);padding:26px;border-radius:20px;background:#fff;border:1px solid #dde5df;text-align:center}</style></head><body><main><h1>ยังไม่มีข้อมูลร้าน</h1><p>บัญชีนี้ยังไม่ได้ผูกกับร้าน กรุณาติดต่อผู้ดูแลระบบ</p></main></body>`;
      return new Promise(() => {});
    }

    document.documentElement.style.visibility = "";
    mountUserMenu(profile);
    return profile;
  } catch (error) {
    console.error("PAGE_GUARD_PROFILE_FAILED", error);
    document.documentElement.style.visibility = "";
    document.body.innerHTML = `
      <main style="box-sizing:border-box;min-height:100vh;display:grid;place-items:center;padding:20px;background:#f3f6f4;font-family:system-ui,-apple-system,sans-serif;color:#151515">
        <section style="box-sizing:border-box;width:min(480px,100%);padding:30px;border:1px solid #dde5df;border-radius:20px;background:#fff;text-align:center;box-shadow:0 16px 44px rgba(16,35,23,.08)">
          <h1 style="margin:0 0 10px;font-size:25px">โหลดข้อมูลบัญชีไม่สำเร็จ</h1>
          <p style="margin:0;color:#6b746f;line-height:1.7">ระบบไม่สามารถตรวจสอบสิทธิ์ผู้ใช้งานได้ กรุณาลองโหลดหน้าใหม่ หรือเข้าสู่ระบบอีกครั้ง</p>
          <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:18px">
            <button type="button" onclick="location.reload()" style="border:0;border-radius:10px;padding:11px 16px;background:#159447;color:#fff;font:inherit;font-weight:700;cursor:pointer">ลองใหม่</button>
            <button type="button" data-auth-reset style="border:1px solid #d5ded8;border-radius:10px;padding:10px 16px;background:#fff;color:#151515;font:inherit;font-weight:700;cursor:pointer">เข้าสู่ระบบอีกครั้ง</button>
          </div>
        </section>
      </main>`;
    document.querySelector("[data-auth-reset]")?.addEventListener("click", logoutToLogin);
    return new Promise(() => {});
  }
}

export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(credential.user);
  if (!profile?.role || profile.active === false) {
    await signOut(auth);
    throw new Error("ACCOUNT_NOT_ALLOWED");
  }
  return profile;
}

export async function logout() {
  await logoutToLogin();
}

export async function callCloud(name, payload = {}) {
  return httpsCallable(functions, name)(payload);
}
