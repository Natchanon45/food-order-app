import { t } from "./i18n.js?v=20261001-002";

const pathKeys = Object.freeze({
  "/": "home",
  "/platform": "platform",
  "/admin/tenants": "manage_stores",
  "/cashier/waiting-queue": "waiting_queue",
  "/cashier/table-qr": "open_table",
  "/admin": "store_management",
  "/admin/users": "staff_management",
});

function normalizedPath(value) {
  try { return new URL(value, location.origin).pathname.replace(/\/+$/, "") || "/"; }
  catch { return String(value || "").replace(/\/+$/, "") || "/"; }
}

function translated(key, fallback = "") {
  const value = t(key);
  return value && value !== key ? value : fallback;
}

function translate(menu) {
  if (!(menu instanceof HTMLElement)) return;
  const role = menu.querySelector(".user-menu-role");
  const roleKey = role?.dataset.userMenuRole;
  if (role && roleKey) role.textContent = translated(`shared.user_menu.roles.${roleKey}`, role.textContent);

  menu.querySelectorAll("a.user-menu-link[href]").forEach(link => {
    const key = pathKeys[normalizedPath(link.getAttribute("href"))];
    const label = link.querySelector(":scope > span:last-child");
    if (key && label) label.textContent = translated(`shared.user_menu.${key}`, label.textContent);
  });

  const password = menu.querySelector('[data-menu-action="change-password"] > span:last-child');
  if (password) password.textContent = translated("shared.user_menu.change_password", password.textContent);
  const logout = menu.querySelector("[data-logout] > span:last-child");
  if (logout) logout.textContent = translated("shared.user_menu.logout", logout.textContent);
}

function scan(root = document) {
  if (root instanceof HTMLElement && root.matches("[data-user-menu]")) translate(root);
  root.querySelectorAll?.("[data-user-menu]").forEach(translate);
}

scan();
window.addEventListener("app:i18n-configured", () => scan());
window.addEventListener("app:i18n-locale-changed", () => scan());
new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
  if (node instanceof HTMLElement) scan(node);
}))).observe(document.body, { childList: true, subtree: true });
