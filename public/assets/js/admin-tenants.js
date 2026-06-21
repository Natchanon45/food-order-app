import { app } from "./firebase-config.js";
import { toast } from "./ui.js";
import {
  getFunctions, httpsCallable
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";

const functions = getFunctions(app, "asia-southeast1");
const listTenants = httpsCallable(functions, "listTenants");
const createTenant = httpsCallable(functions, "createTenant");
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

function xIcon() {
  return `
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" style="display:block;flex:0 0 auto">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`;
}

function storefrontIcon() {
  return `
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" style="display:block;flex:0 0 auto">
      <path d="M4 10h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M5 10V6.5L7 4h10l2 2.5V10" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M6 10v9h12v-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M9 19v-5h6v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;
}

const cancelEditButton = document.createElement("button");
cancelEditButton.type = "button";
cancelEditButton.className = "btn tenant-cancel-edit";
cancelEditButton.innerHTML = `${xIcon()}<span>ยกเลิกแก้ไข</span>`;
cancelEditButton.setAttribute("aria-label", "ยกเลิกการแก้ไข");
cancelEditButton.style.setProperty("display", "none", "important");
cancelEditButton.style.setProperty("align-items", "center", "important");
cancelEditButton.style.setProperty("justify-content", "center", "important");
cancelEditButton.style.setProperty("gap", "7px", "important");
cancelEditButton.style.setProperty("width", "100%", "important");
cancelEditButton.style.setProperty("border-radius", "12px", "important");
submitButton.insertAdjacentElement("afterend", cancelEditButton);

function setCancelVisible(visible) {
  cancelEditButton.style.setProperty("display", visible ? "flex" : "none", "important");
}

function sanitizeSlugTyping(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/g, "");
}

function normalizeSlug(value = "") {
  return sanitizeSlugTyping(value).replace(/-+$/g, "");
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

function showError(message = "") {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function resetForm() {
  editingTenantId = "";
  form.reset();
  slugField.dataset.edited = "false";
  submitButton.textContent = "สร้างร้าน";
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
  submitButton.textContent = "บันทึกการแก้ไข";
  setCancelVisible(true);
  if (formTitle) formTitle.textContent = "แก้ไขร้านค้า";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  nameField.focus();
}

function renderTenants(items = []) {
  tenants = items;
  tenantCount.textContent = `${items.length} ร้าน`;
  tenantList.innerHTML = items.length ? items.map(tenant => `
    <article class="card" style="box-shadow:none;background:#f8fbf9">
      <div class="section-title" style="margin:0">
        <div>
          <h2 style="margin:0">${escapeHtml(tenant.name || "ไม่ระบุชื่อร้าน")}</h2>
          <div class="menu-category">/${escapeHtml(tenant.slug || "-")}</div>
        </div>
        <span class="badge ${tenant.active === false ? "warning" : ""}">${tenant.active === false ? "ปิดใช้งาน" : "ใช้งาน"}</span>
      </div>
      <div style="margin-top:12px;word-break:break-all"><strong>Tenant ID:</strong> ${escapeHtml(tenant.id)}</div>
      <div class="order-actions" style="margin-top:12px;align-items:center">
        <a class="btn btn-dark btn-sm tenant-storefront-button" style="display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;min-width:122px!important;padding:8px 12px!important;border-radius:10px!important;white-space:nowrap!important;width:auto!important;height:auto!important;aspect-ratio:auto!important" href="/s/${encodeURIComponent(tenant.slug || "")}/delivery" target="_blank" rel="noopener noreferrer">${storefrontIcon()}<span>เปิดหน้าร้าน</span></a>
        <button class="btn btn-sm" type="button" data-edit-tenant="${escapeHtml(tenant.id)}">แก้ไข</button>
        <button class="btn btn-danger btn-sm" type="button" data-delete-tenant="${escapeHtml(tenant.id)}">ลบ</button>
      </div>
    </article>
  `).join("") : '<div class="empty">ยังไม่มีร้านค้า</div>';
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
  if (slugField.dataset.edited === "true") return;
  slugField.value = normalizeSlug(nameField.value);
});

slugField.addEventListener("input", () => {
  slugField.dataset.edited = "true";
  const cursorPosition = slugField.selectionStart;
  const originalLength = slugField.value.length;
  slugField.value = sanitizeSlugTyping(slugField.value);
  const removedCount = originalLength - slugField.value.length;
  const nextPosition = Math.max(0, cursorPosition - removedCount);
  slugField.setSelectionRange(nextPosition, nextPosition);
});

slugField.addEventListener("blur", () => {
  slugField.value = normalizeSlug(slugField.value);
});

cancelEditButton.addEventListener("click", resetForm);

tenantList.addEventListener("click", async event => {
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

  if (!confirm(`ยืนยันลบร้าน ${tenant.name || tenant.id} ใช่หรือไม่?\n\nลบได้เฉพาะร้านที่ยังไม่มีเมนู โต๊ะ ออเดอร์ หรือพนักงาน`)) return;

  deleteButton.disabled = true;
  deleteButton.textContent = "กำลังลบ...";
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
    deleteButton.textContent = "ลบ";
  }
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  showError("");
  submitButton.disabled = true;
  cancelEditButton.disabled = true;
  submitButton.textContent = editingTenantId ? "กำลังบันทึก..." : "กำลังสร้างร้าน...";

  try {
    const normalizedSlug = normalizeSlug(slugField.value);
    slugField.value = normalizedSlug;
    const payload = {
      name: nameField.value.trim(),
      slug: normalizedSlug,
      phone: phoneField.value.trim(),
      address: addressField.value.trim()
    };

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
    submitButton.textContent = editingTenantId ? "บันทึกการแก้ไข" : "สร้างร้าน";
  }
});

await loadTenants();
