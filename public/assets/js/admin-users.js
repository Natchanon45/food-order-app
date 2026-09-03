import { auth } from "./firebase-config.js?v=20260630-073";
import { createStaffUser, listStaffUsers, updateStaffUser } from "./admin-staff-service.js?v=20260903-205";
import { toast } from "./ui.js?v=20260805-081";
import translations from "./admin-users-translations.js?v=20260903-205";
import { configureI18n, applyTranslations, t } from "./i18n.js?v=20260903-202";

configureI18n(translations);
applyTranslations();
document.title = t("admin_users.meta.title");

const userForm = document.getElementById("userForm");
const userRows = document.getElementById("userRows");
const userCount = document.getElementById("userCount");
const createUserButton = document.getElementById("createUserButton");
const userError = document.getElementById("userError");
const userDialog = document.getElementById("userDialog");
const openCreateUserModal = document.getElementById("openCreateUserModal");
const closeCreateUserModal = document.getElementById("closeCreateUserModal");
const cancelCreateUserModal = document.getElementById("cancelCreateUserModal");
let users = [];
const currentUserId = String(auth?.currentUser?.uid || "");

const roleOptions = [
  ["admin", t("admin_users.roles.admin")],
  ["cashier", t("admin_users.roles.cashier")],
  ["kitchen", t("admin_users.roles.kitchen")]
];

const scopeOptions = [
  ["order_delivery", t("admin_users.scopes.order_delivery")],
  ["retail_pos", t("admin_users.scopes.retail_pos")],
  ["both", t("admin_users.scopes.both")]
];

function showError(message = "") {
  userError.textContent = message;
  userError.hidden = !message;
}

function resetCreateForm() {
  userForm.reset();
  document.getElementById("active").checked = true;
  document.getElementById("businessScope").value = "order_delivery";
  showError("");
}

function closeCreateDialog() {
  if (userDialog.open) userDialog.close();
}

openCreateUserModal.addEventListener("click", () => {
  resetCreateForm();
  userDialog.showModal();
  requestAnimationFrame(() => document.getElementById("displayName").focus());
});

closeCreateUserModal.addEventListener("click", closeCreateDialog);
cancelCreateUserModal.addEventListener("click", closeCreateDialog);
userDialog.addEventListener("close", resetCreateForm);

function iconLabel(iconClass, label) {
  return `<i class="bi ${iconClass}" aria-hidden="true"></i><span>${label}</span>`;
}

function setButtonContent(button, iconClass, label) {
  if (!button) return;
  button.innerHTML = iconLabel(iconClass, label);
}

function roleSelect(user) {
  return `<select class="input" data-role-uid="${user.uid}">
    ${roleOptions.map(([value, label]) => `<option value="${value}" ${user.role === value ? "selected" : ""}>${label}</option>`).join("")}
  </select>`;
}

function scopeSelect(user) {
  return `<select class="input" data-scope-uid="${user.uid}">
    ${scopeOptions.map(([value, label]) => `<option value="${value}" ${user.businessScope === value ? "selected" : ""}>${label}</option>`).join("")}
  </select>`;
}

function renderUsers() {
  userCount.textContent = t("admin_users.list.count", { count: users.length });
  userRows.innerHTML = users.length ? users.map(user => `
    <tr>
      <td><input class="input" data-name-uid="${user.uid}" value="${user.displayName || ""}" maxlength="100"></td>
      <td>${user.email || "-"}</td>
      <td>${roleSelect(user)}</td>
      <td>${scopeSelect(user)}</td>
      <td style="text-align:center"><input type="checkbox" data-active-uid="${user.uid}" ${user.active !== false ? "checked" : ""}></td>
      <td><button class="btn btn-primary btn-sm user-save-button" data-save-user="${user.uid}">${iconLabel("bi-floppy", t("admin_users.actions.save"))}</button></td>
    </tr>
  `).join("") : `<tr><td colspan="6"><div class="empty">${t("admin_users.list.empty")}</div></td></tr>`;
}

async function loadUsers() {
  try {
    users = await listStaffUsers();
    renderUsers();
  } catch (error) {
    console.error(error);
    const message = t("admin_users.list.load_failed");
    showError(message);
    toast(message, "error");
  }
}

userForm.addEventListener("submit", async event => {
  event.preventDefault();
  showError("");

  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  if (password.length < 8) {
    showError(t("admin_users.validation.password_min"));
    return;
  }
  if (password !== confirmPassword) {
    showError(t("admin_users.validation.password_mismatch"));
    return;
  }

  createUserButton.disabled = true;
  setButtonContent(createUserButton, "bi-hourglass-split", t("admin_users.dialog.creating"));

  try {
    await createStaffUser({
      displayName: document.getElementById("displayName").value.trim(),
      email: document.getElementById("email").value.trim().toLowerCase(),
      password,
      role: document.getElementById("role").value,
      businessScope: document.getElementById("businessScope").value,
      active: document.getElementById("active").checked
    });

    closeCreateDialog();
    toast(t("admin_users.messages.created"));
    await loadUsers();
  } catch (error) {
    console.error(error);
    const code = String(error?.code || error?.message || "");
    let message = t("admin_users.messages.create_failed");
    if (code.includes("STAFF_EMAIL_EXISTS") || code.includes("already-exists") || code.includes("email-already-exists")) message = t("admin_users.messages.email_exists");
    if (code.includes("STAFF_NAME_REQUIRED") || code.includes("STAFF_EMAIL_INVALID") || code.includes("STAFF_ROLE_INVALID") || code.includes("STAFF_BUSINESS_SCOPE_INVALID") || code.includes("invalid-argument")) message = t("admin_users.messages.invalid_data");
    if (code.includes("FORBIDDEN") || code.includes("HTTP_403") || code.includes("permission-denied")) message = t("admin_users.messages.forbidden");
    showError(message);
    toast(message, "error");
  } finally {
    createUserButton.disabled = false;
    setButtonContent(createUserButton, "bi-person-plus", t("admin_users.dialog.create"));
  }
});

userRows.addEventListener("click", async event => {
  const button = event.target.closest("[data-save-user]");
  if (!button) return;

  const uid = button.dataset.saveUser;
  const user = users.find(item => item.uid === uid);
  if (!user || uid === currentUserId) return;

  button.disabled = true;
  setButtonContent(button, "bi-hourglass-split", t("admin_users.actions.saving"));

  try {
    const displayName = document.querySelector(`[data-name-uid="${uid}"]`).value.trim();
    const role = document.querySelector(`[data-role-uid="${uid}"]`).value;
    const businessScope = document.querySelector(`[data-scope-uid="${uid}"]`).value;
    const active = document.querySelector(`[data-active-uid="${uid}"]`).checked;
    await updateStaffUser(uid, { displayName, email: user.email, role, businessScope, active });
    toast(t("admin_users.messages.saved"));
    await loadUsers();
  } catch (error) {
    console.error(error);
    toast(t("admin_users.messages.save_failed"), "error");
    button.disabled = false;
    setButtonContent(button, "bi-floppy", t("admin_users.actions.save"));
  }
});

await loadUsers();
