import "./sweet-dialog.js?v=20260629-048";
import { app } from "./firebase-config.js?v=20260630-073";
import { toast } from "./ui.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";

if (!document.querySelector('link[href*="sweet-dialog.css"]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/sweet-dialog.css?v=20260629-048";
  document.head.appendChild(link);
}

const functions = getFunctions(app, "asia-southeast1");
const listTenants = httpsCallable(functions, "listTenants");
const createTenant = httpsCallable(functions, "createTenant");
const createTenantOwner = httpsCallable(functions, "createTenantOwner");
const updateTenant = httpsCallable(functions, "updateTenant");
const deleteTenant = httpsCallable(functions, "deleteTenant");

const form = document.getElementById("tenantForm");
const nameField = document.getElementById("tenantName");
const slugField = document.getElementById("tenantSlug");
const phoneField = document.getElementById("tenantPhone");
const addressField = document.getElementById("tenantAddress");
const submitButton = document.getElementById("createTenantButton");
const errorBox = document.getElementById("tenantError");
const tenantList = document.getElementById("tenantList");
const tenantCount = document.getElementById("tenantCount");
const formTitle = form.closest(".card")?.querySelector(".section-title h2");

let tenants = [];
let editingTenantId = "";
let selectedOwnerTenant = null;

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options);
  return confirm(message);
}

function icon(name) {
  return `<svg class="app-icon" aria-hidden="true"><use href="/assets/images/app-icons.svg#icon-${name}"></use></svg>`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

function setSubmitContent(mode = "create") {
  const states = {
    create: `${icon("add")}<span>สร้างร้าน</span>`,
    creating: "<span>กำลังสร้างร้าน...</span>",
    edit: `${icon("save")}<span>บันทึกการแก้ไข</span>`,
    saving: "<span>กำลังบันทึก...</span>"
  };
  submitButton.innerHTML = states[mode] || states.create;
}

submitButton.style.cssText = "display:flex;align-items:center;justify-content:center;gap:8px;width:100%;";
setSubmitContent();

const cancelEditButton = document.createElement("button");
cancelEditButton.type = "button";
cancelEditButton.className = "btn tenant-cancel-edit";
cancelEditButton.textContent = "ยกเลิกแก้ไข";
cancelEditButton.setAttribute("aria-label", "ยกเลิกการแก้ไข");
cancelEditButton.style.setProperty("display", "none", "important");
cancelEditButton.style.setProperty("width", "100%", "important");
cancelEditButton.style.setProperty("border-radius", "12px", "important");
submitButton.insertAdjacentElement("afterend", cancelEditButton);

function setCancelVisible(visible) {
  cancelEditButton.style.setProperty("display", visible ? "block" : "none", "important");
}

function sanitizeSlugTyping(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+/g, "");
}

function normalizeSlug(value = "") {
  return sanitizeSlugTyping(value).replace(/-+$/g, "");
}

function showError(message = "") {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function resetForm() {
  editingTenantId = "";
  form.reset();
  slugField.dataset.edited = "false";
  setSubmitContent("create");
  setCancelVisible(false);
  if (formTitle) formTitle.textContent = "สร้างร้านใหม่";
  showError("");
}

function beginEdit(tenant) {
  editingTenantId = tenant.id;
  nameField.value = tenant.name || "";
  slugField.value = tenant.slug || "";
  phoneField.value = tenant.shopPhone || tenant.phone || "";
  addressField.value = tenant.shopAddress || tenant.address || "";
  slugField.dataset.edited = "true";
  setSubmitContent("edit");
  setCancelVisible(true);
  if (formTitle) formTitle.textContent = "แก้ไขร้านค้า";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  nameField.focus();
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
        <div>
          <h2 id="ownerModalTitle">สร้างบัญชี Owner</h2>
          <p id="ownerModalShop">-</p>
        </div>
      </div>
      <button type="button" class="owner-modal-close" data-owner-close aria-label="ปิด">${icon("close")}</button>
    </div>
    <form id="ownerForm" class="owner-modal-form">
      <div class="field"><label for="ownerDisplayName">ชื่อเจ้าของร้าน</label><input class="input" id="ownerDisplayName" maxlength="120" autocomplete="name" required></div>
      <div class="field"><label for="ownerEmail">อีเมลสำหรับเข้าสู่ระบบ</label><input class="input" id="ownerEmail" type="email" maxlength="160" autocomplete="username" required></div>
      <div class="grid grid-2 owner-password-grid">
        <div class="field"><label for="ownerPassword">รหัสผ่านเริ่มต้น</label><input class="input" id="ownerPassword" type="password" minlength="8" autocomplete="new-password" required><small>อย่างน้อย 8 ตัวอักษร</small></div>
        <div class="field"><label for="ownerPasswordConfirm">ยืนยันรหัสผ่าน</label><input class="input" id="ownerPasswordConfirm" type="password" minlength="8" autocomplete="new-password" required><small>ต้องตรงกับรหัสผ่านด้านซ้าย</small></div>
      </div>
      <div class="upload-error owner-form-error" id="ownerFormError" hidden></div>
      <div class="owner-modal-actions"><button type="button" class="btn" data-owner-close>ยกเลิก</button><button type="submit" class="btn btn-primary" id="ownerSubmitButton">${icon("save")}<span>สร้างบัญชี Owner</span></button></div>
    </form>
  </section>`;
document.body.appendChild(ownerModal);

const ownerForm = ownerModal.querySelector("#ownerForm");
const ownerDisplayName = ownerModal.querySelector("#ownerDisplayName");
const ownerEmail = ownerModal.querySelector("#ownerEmail");
const ownerPassword = ownerModal.querySelector("#ownerPassword");
const ownerPasswordConfirm = ownerModal.querySelector("#ownerPasswordConfirm");
const ownerFormError = ownerModal.querySelector("#ownerFormError");
const ownerSubmitButton = ownerModal.querySelector("#ownerSubmitButton");
const ownerModalShop = ownerModal.querySelector("#ownerModalShop");

function setOwnerFormError(message = "") {
  ownerFormError.textContent = message;
  ownerFormError.hidden = !message;
}

function openOwnerModal(tenant) {
  selectedOwnerTenant = tenant;
  ownerForm.reset();
  setOwnerFormError("");
  ownerModalShop.textContent = tenant.name || tenant.slug || tenant.id;
  ownerModal.hidden = false;
  document.body.classList.add("owner-modal-open");
  requestAnimationFrame(() => ownerDisplayName.focus());
}

function closeOwnerModal() {
  if (ownerSubmitButton.disabled) return;
  selectedOwnerTenant = null;
  ownerModal.hidden = true;
  document.body.classList.remove("owner-modal-open");
  ownerForm.reset();
  setOwnerFormError("");
}

ownerModal.addEventListener("click", event => {
  if (event.target.closest("[data-owner-close]")) closeOwnerModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !ownerModal.hidden) closeOwnerModal();
});

ownerPasswordConfirm.addEventListener("input", () => {
  if (!ownerPasswordConfirm.value || ownerPasswordConfirm.value === ownerPassword.value) ownerPasswordConfirm.setCustomValidity("");
  else ownerPasswordConfirm.setCustomValidity("รหัสผ่านไม่ตรงกัน");
});

ownerPassword.addEventListener("input", () => {
  if (ownerPasswordConfirm.value) ownerPasswordConfirm.dispatchEvent(new Event("input"));
});

ownerForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!selectedOwnerTenant) return;
  const displayName = ownerDisplayName.value.trim();
  const email = ownerEmail.value.trim().toLowerCase();
  const password = ownerPassword.value;
  const confirmPassword = ownerPasswordConfirm.value;
  setOwnerFormError("");
  if (password !== confirmPassword) {
    ownerPasswordConfirm.setCustomValidity("รหัสผ่านไม่ตรงกัน");
    ownerPasswordConfirm.reportValidity();
    setOwnerFormError("รหัสผ่านและยืนยันรหัสผ่านต้องตรงกัน");
    return;
  }
  ownerPasswordConfirm.setCustomValidity("");
  if (!ownerForm.reportValidity()) return;
  ownerSubmitButton.disabled = true;
  ownerSubmitButton.innerHTML = "<span>กำลังสร้างบัญชี...</span>";
  try {
    await createTenantOwner({ tenantId: selectedOwnerTenant.id, displayName, email, password });
    toast(`สร้าง Owner ${displayName} เรียบร้อยแล้ว`);
    ownerSubmitButton.disabled = false;
    ownerSubmitButton.innerHTML = `${icon("save")}<span>สร้างบัญชี Owner</span>`;
    closeOwnerModal();
    await loadTenants();
  } catch (error) {
    console.error(error);
    let message = "สร้าง Owner ไม่สำเร็จ";
    if (error.code === "functions/already-exists") message = error.message || "ร้านนี้มี Owner แล้ว หรืออีเมลถูกใช้งานแล้ว";
    if (error.code === "functions/invalid-argument") message = error.message || "ข้อมูล Owner ไม่ถูกต้อง";
    if (error.code === "functions/permission-denied") message = "บัญชีนี้ไม่มีสิทธิ์สร้าง Owner";
    setOwnerFormError(message);
    toast(message, "error");
    ownerSubmitButton.disabled = false;
    ownerSubmitButton.innerHTML = `${icon("save")}<span>สร้างบัญชี Owner</span>`;
  }
});

function renderTenants(items = []) {
  tenants = items;
  tenantCount.textContent = `${items.length} ร้าน`;
  tenantList.innerHTML = items.length ? items.map(tenant => `
    <article class="card" style="box-shadow:none;background:#f8fbf9">
      <div class="section-title" style="margin:0"><div><h2 style="margin:0">${escapeHtml(tenant.name || "ไม่ระบุชื่อร้าน")}</h2><div class="menu-category">/${escapeHtml(tenant.slug || "-")}</div></div><span class="badge ${tenant.active === false ? "warning" : ""}">${tenant.active === false ? "ปิดใช้งาน" : "ใช้งาน"}</span></div>
      <div style="margin-top:10px"><span class="badge ${tenant.ownerUid ? "" : "warning"}">${tenant.ownerUid ? `Owner: ${escapeHtml(tenant.ownerDisplayName || tenant.ownerEmail || "มีแล้ว")}` : "ยังไม่มี Owner"}</span></div>
      <div style="margin-top:12px;word-break:break-all"><strong>Tenant ID:</strong> ${escapeHtml(tenant.id)}</div>
      <div class="order-actions" style="margin-top:12px;align-items:center">
        <a class="btn btn-dark btn-sm" href="/s/${encodeURIComponent(tenant.slug || "")}/delivery" target="_blank" rel="noopener noreferrer">${icon("home")}<span>เปิดหน้าร้าน</span></a>
        ${tenant.ownerUid ? "" : `<button class="btn btn-primary btn-sm" type="button" data-create-owner="${escapeHtml(tenant.id)}">${icon("user")}<span>สร้าง Owner</span></button>`}
        <button class="btn btn-sm" type="button" data-edit-tenant="${escapeHtml(tenant.id)}">${icon("edit")}<span>แก้ไข</span></button>
        <button class="btn btn-danger btn-sm" type="button" data-delete-tenant="${escapeHtml(tenant.id)}">${icon("delete")}<span>ลบ</span></button>
      </div>
    </article>`).join("") : '<div class="empty">ยังไม่มีร้านค้า</div>';
}

async function loadTenants() {
  tenantList.innerHTML = '<div class="empty">กำลังโหลด...</div>';
  try {
    const result = await listTenants();
    renderTenants(result.data?.tenants || []);
  } catch (error) {
    console.error(error);
    tenantList.innerHTML = '<div class="upload-error">โหลดรายการร้านค้าไม่สำเร็จ</div>';
  }
}

nameField.addEventListener("input", () => {
  if (slugField.dataset.edited !== "true") slugField.value = normalizeSlug(nameField.value);
});
slugField.addEventListener("input", () => {
  slugField.dataset.edited = "true";
  const cursorPosition = slugField.selectionStart;
  const originalLength = slugField.value.length;
  slugField.value = sanitizeSlugTyping(slugField.value);
  const nextPosition = Math.max(0, cursorPosition - (originalLength - slugField.value.length));
  slugField.setSelectionRange(nextPosition, nextPosition);
});
slugField.addEventListener("blur", () => { slugField.value = normalizeSlug(slugField.value); });
cancelEditButton.addEventListener("click", resetForm);

tenantList.addEventListener("click", async event => {
  const ownerButton = event.target.closest("[data-create-owner]");
  if (ownerButton) {
    const tenant = tenants.find(item => item.id === ownerButton.dataset.createOwner);
    if (tenant) openOwnerModal(tenant);
    return;
  }
  const editButton = event.target.closest("[data-edit-tenant]");
  if (editButton) {
    const tenant = tenants.find(item => item.id === editButton.dataset.editTenant);
    if (tenant) beginEdit(tenant);
    return;
  }
  const deleteButton = event.target.closest("[data-delete-tenant]");
  if (!deleteButton) return;
  const tenant = tenants.find(item => item.id === deleteButton.dataset.deleteTenant);
  if (!tenant) return;
  const ok = await askConfirm(`ยืนยันลบร้าน ${tenant.name || tenant.id} ใช่หรือไม่?\n\nลบได้เฉพาะร้านที่ยังไม่มีเมนู โต๊ะ ออเดอร์ หรือพนักงาน`, {
    title: "ลบร้านค้า",
    confirmText: "ตกลง",
    cancelText: "ยกเลิก",
    type: "warning"
  });
  if (!ok) return;
  deleteButton.disabled = true;
  deleteButton.innerHTML = "<span>กำลังลบ...</span>";
  try {
    await deleteTenant({ tenantId: tenant.id });
    if (editingTenantId === tenant.id) resetForm();
    toast("ลบร้านเรียบร้อยแล้ว");
    await loadTenants();
  } catch (error) {
    console.error(error);
    let message = "ลบร้านไม่สำเร็จ";
    if (error.code === "functions/failed-precondition") message = "ร้านนี้มีข้อมูลใช้งานแล้ว จึงไม่อนุญาตให้ลบ";
    if (error.code === "functions/permission-denied") message = "บัญชีนี้ไม่มีสิทธิ์ลบร้าน";
    toast(message, "error");
    deleteButton.disabled = false;
    deleteButton.innerHTML = `${icon("delete")}<span>ลบ</span>`;
  }
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  showError("");
  submitButton.disabled = true;
  cancelEditButton.disabled = true;
  setSubmitContent(editingTenantId ? "saving" : "creating");
  try {
    const normalizedSlug = normalizeSlug(slugField.value);
    slugField.value = normalizedSlug;
    const payload = { name: nameField.value.trim(), slug: normalizedSlug, phone: phoneField.value.trim(), address: addressField.value.trim() };
    if (editingTenantId) {
      await updateTenant({ tenantId: editingTenantId, ...payload });
      toast("บันทึกการแก้ไขร้านเรียบร้อยแล้ว");
    } else {
      const result = await createTenant(payload);
      toast(`สร้างร้าน ${result.data?.tenant?.name || "ใหม่"} เรียบร้อยแล้ว`);
    }
    resetForm();
    await loadTenants();
  } catch (error) {
    console.error(error);
    let message = editingTenantId ? "แก้ไขร้านไม่สำเร็จ" : "สร้างร้านไม่สำเร็จ";
    if (error.code === "functions/already-exists") message = "Slug นี้ถูกใช้งานแล้ว";
    if (error.code === "functions/invalid-argument") message = error.message || "ข้อมูลร้านไม่ถูกต้อง";
    if (error.code === "functions/permission-denied") message = "บัญชีนี้ไม่มีสิทธิ์ดำเนินการ";
    showError(message);
    toast(message, "error");
  } finally {
    submitButton.disabled = false;
    cancelEditButton.disabled = false;
    setSubmitContent(editingTenantId ? "edit" : "create");
  }
});

await loadTenants();