import { toast } from "./ui.js?v=20260805-081";
import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";
import translations from "./platform-owners-translations.js?v=20260903-212";
import { configureI18n, applyTranslations, t } from "./i18n.js?v=20260903-202";
import {
  createTenantOwner,
  listTenants,
  updateTenantOwner
} from "./platform-tenant-service.js?v=20260726-023";

configureI18n(translations);
applyTranslations();
document.title = t("platform_owners.meta.title");

const ownerList = document.querySelector("#ownerList");
const ownerCount = document.querySelector("#ownerCount");
const ownerSearch = document.querySelector("#ownerSearch");
const ownerStatusFilter = document.querySelector("#ownerStatusFilter");
let tenants = [];
let selectedTenant = null;
let modalMode = "create";

function icon(name) {
  return iconMarkup(name);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

const ownerModal = document.createElement("div");
ownerModal.className = "owner-modal";
ownerModal.hidden = true;
ownerModal.innerHTML = `
  <div class="owner-modal-backdrop" data-owner-close></div>
  <section class="owner-modal-card" role="dialog" aria-modal="true" aria-labelledby="ownerModalTitle">
    <div class="owner-modal-head">
      <div>
        <div class="owner-modal-icon">${icon("user")}</div>
        <div><h2 id="ownerModalTitle">${t("platform_owners.modal.create_title")}</h2><p id="ownerModalShop">-</p></div>
      </div>
      <button type="button" class="owner-modal-close" data-owner-close aria-label="${t("platform_owners.modal.close")}">${icon("close")}</button>
    </div>
    <form id="ownerForm" class="owner-modal-form">
      <div class="field">
        <label for="ownerDisplayName">${t("platform_owners.modal.display_name")}</label>
        <input class="input" id="ownerDisplayName" maxlength="120" autocomplete="name" required>
      </div>
      <div class="field">
        <label for="ownerEmail">${t("platform_owners.modal.email")}</label>
        <input class="input" id="ownerEmail" type="email" maxlength="160" autocomplete="username" required>
      </div>
      <div id="ownerPasswordFields" class="grid grid-2 owner-password-grid">
        <div class="field">
          <label for="ownerPassword">${t("platform_owners.modal.password")}</label>
          <input class="input" id="ownerPassword" type="password" minlength="8" autocomplete="new-password">
          <small>${t("platform_owners.modal.password_help")}</small>
        </div>
        <div class="field">
          <label for="ownerPasswordConfirm">${t("platform_owners.modal.password_confirm")}</label>
          <input class="input" id="ownerPasswordConfirm" type="password" minlength="8" autocomplete="new-password">
          <small>${t("platform_owners.modal.password_confirm_help")}</small>
        </div>
      </div>
      <div class="upload-error owner-form-error" id="ownerFormError" hidden></div>
      <div class="owner-modal-actions">
        <button type="button" class="btn" data-owner-close>${icon("close")}<span>${t("platform_owners.modal.cancel")}</span></button>
        <button type="submit" class="btn btn-primary" id="ownerSubmitButton">${icon("save")}<span>${t("platform_owners.modal.save")}</span></button>
      </div>
    </form>
  </section>`;
document.body.appendChild(ownerModal);

const ownerForm = ownerModal.querySelector("#ownerForm");
const ownerDisplayName = ownerModal.querySelector("#ownerDisplayName");
const ownerEmail = ownerModal.querySelector("#ownerEmail");
const ownerPassword = ownerModal.querySelector("#ownerPassword");
const ownerPasswordConfirm = ownerModal.querySelector("#ownerPasswordConfirm");
const ownerPasswordFields = ownerModal.querySelector("#ownerPasswordFields");
const ownerFormError = ownerModal.querySelector("#ownerFormError");
const ownerSubmitButton = ownerModal.querySelector("#ownerSubmitButton");
const ownerModalTitle = ownerModal.querySelector("#ownerModalTitle");
const ownerModalShop = ownerModal.querySelector("#ownerModalShop");

function setOwnerFormError(message = "") {
  ownerFormError.textContent = message;
  ownerFormError.hidden = !message;
}

function submitButtonMarkup(editing) {
  return editing
    ? `${icon("save")}<span>${t("platform_owners.modal.save_name")}</span>`
    : `${icon("save")}<span>${t("platform_owners.modal.create_account")}</span>`;
}

function openOwnerModal(tenant, mode) {
  selectedTenant = tenant;
  modalMode = mode;
  ownerForm.reset();
  setOwnerFormError("");
  ownerModalShop.textContent = tenant.name || tenant.slug || tenant.id;

  const editing = mode === "edit";
  ownerModalTitle.textContent = editing ? t("platform_owners.modal.edit_title") : t("platform_owners.modal.create_title");
  ownerDisplayName.value = editing ? tenant.ownerDisplayName || "" : "";
  ownerEmail.value = editing ? tenant.ownerEmail || "" : "";
  ownerEmail.disabled = editing;
  ownerPasswordFields.hidden = editing;
  ownerPassword.required = !editing;
  ownerPasswordConfirm.required = !editing;
  ownerSubmitButton.innerHTML = submitButtonMarkup(editing);

  ownerModal.hidden = false;
  document.body.classList.add("owner-modal-open");
  requestAnimationFrame(() => ownerDisplayName.focus());
}

function closeOwnerModal() {
  if (ownerSubmitButton.disabled) return;
  selectedTenant = null;
  ownerModal.hidden = true;
  document.body.classList.remove("owner-modal-open");
  ownerForm.reset();
  setOwnerFormError("");
}

function render() {
  const keyword = ownerSearch.value.trim().toLowerCase();
  const status = ownerStatusFilter.value;
  const filtered = tenants.filter(tenant => {
    const text = [tenant.name, tenant.slug, tenant.ownerDisplayName, tenant.ownerEmail].join(" ").toLowerCase();
    if (keyword && !text.includes(keyword)) return false;
    if (status === "has-owner" && !tenant.ownerUid) return false;
    if (status === "no-owner" && tenant.ownerUid) return false;
    if (status === "inactive" && tenant.active !== false) return false;
    return true;
  });

  ownerCount.textContent = t("platform_owners.list.count", { count: tenants.filter(item => item.ownerUid).length });
  ownerList.innerHTML = filtered.length ? filtered.map(tenant => `
    <article class="card" style="box-shadow:none;background:#f8fbf9">
      <div class="section-title" style="margin:0">
        <div>
          <h2 style="margin:0">${escapeHtml(tenant.name || t("platform_owners.tenant.unknown_name"))}</h2>
          <div class="menu-category">/${escapeHtml(tenant.slug || "-")}</div>
        </div>
        <span class="badge ${tenant.active === false ? "warning" : ""}">${tenant.active === false ? t("platform_owners.tenant.inactive") : t("platform_owners.tenant.active")}</span>
      </div>
      <div style="margin-top:14px">
        ${tenant.ownerUid ? `
          <div><strong>${escapeHtml(tenant.ownerDisplayName || t("platform_owners.tenant.owner_unknown"))}</strong></div>
          <div class="menu-category" style="font-size:14px">${escapeHtml(tenant.ownerEmail || "-")}</div>
          <div style="margin-top:8px"><span class="badge">${t("platform_owners.tenant.owner_exists")}</span></div>
        ` : `
          <div class="menu-category" style="font-size:14px">${t("platform_owners.tenant.no_owner")}</div>
          <div style="margin-top:8px"><span class="badge warning">${t("platform_owners.tenant.pending")}</span></div>
        `}
      </div>
      <div class="order-actions" style="margin-top:14px">
        ${tenant.ownerUid
          ? `<button class="btn" type="button" data-owner-action="edit" data-tenant-id="${escapeHtml(tenant.id)}">${icon("edit")}<span>${t("platform_owners.tenant.edit_owner")}</span></button>`
          : `<button class="btn btn-primary" type="button" data-owner-action="create" data-tenant-id="${escapeHtml(tenant.id)}">${icon("user")}<span>${t("platform_owners.tenant.create_owner")}</span></button>`}
      </div>
    </article>`).join("") : `<div class="empty">${t("platform_owners.list.empty")}</div>`;
}

async function load() {
  ownerList.innerHTML = `<div class="empty">${t("platform_owners.list.loading")}</div>`;
  try {
    const result = await listTenants();
    tenants = result.data?.tenants || [];
    render();
  } catch (error) {
    console.error(error);
    ownerList.innerHTML = `<div class="upload-error">${t("platform_owners.list.load_failed")}</div>`;
  }
}

ownerList.addEventListener("click", event => {
  const button = event.target.closest("[data-owner-action]");
  if (!button) return;
  const tenant = tenants.find(item => item.id === button.dataset.tenantId);
  if (tenant) openOwnerModal(tenant, button.dataset.ownerAction);
});

ownerModal.addEventListener("click", event => {
  if (event.target.closest("[data-owner-close]")) closeOwnerModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !ownerModal.hidden) closeOwnerModal();
});

ownerPasswordConfirm.addEventListener("input", () => {
  if (!ownerPasswordConfirm.value || ownerPasswordConfirm.value === ownerPassword.value) {
    ownerPasswordConfirm.setCustomValidity("");
  } else {
    ownerPasswordConfirm.setCustomValidity(t("platform_owners.modal.password_mismatch"));
  }
});

ownerForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!selectedTenant) return;

  const displayName = ownerDisplayName.value.trim();
  setOwnerFormError("");

  if (modalMode === "create" && ownerPassword.value !== ownerPasswordConfirm.value) {
    ownerPasswordConfirm.setCustomValidity(t("platform_owners.modal.password_mismatch"));
    ownerPasswordConfirm.reportValidity();
    return;
  }
  ownerPasswordConfirm.setCustomValidity("");
  if (!ownerForm.reportValidity()) return;

  ownerSubmitButton.disabled = true;
  ownerSubmitButton.innerHTML = `<span>${t("platform_owners.modal.saving")}</span>`;
  try {
    if (modalMode === "edit") {
      await updateTenantOwner({ tenantId: selectedTenant.id, displayName });
      toast(t("platform_owners.toast.updated"));
    } else {
      await createTenantOwner({
        tenantId: selectedTenant.id,
        displayName,
        email: ownerEmail.value.trim().toLowerCase(),
        password: ownerPassword.value
      });
      toast(t("platform_owners.toast.created"));
    }
    closeOwnerModal();
    await load();
  } catch (error) {
    console.error(error);
    let message = modalMode === "edit" ? t("platform_owners.errors.update_failed") : t("platform_owners.errors.create_failed");
    if (error.code === "functions/already-exists") message = t("platform_owners.errors.already_exists");
    if (error.code === "functions/invalid-argument") message = t("platform_owners.errors.invalid");
    if (error.code === "functions/permission-denied") message = t("platform_owners.errors.permission_denied");
    setOwnerFormError(message);
    toast(message, "error");
  } finally {
    ownerSubmitButton.disabled = false;
    ownerSubmitButton.innerHTML = submitButtonMarkup(modalMode === "edit");
  }
});

ownerSearch.addEventListener("input", render);
ownerStatusFilter.addEventListener("change", render);

await load();
