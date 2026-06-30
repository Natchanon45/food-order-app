import { app } from "./firebase-config.js?v=20260630-073";
import { toast } from "./ui.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";

const functions = getFunctions(app, "asia-southeast1");
const listTenants = httpsCallable(functions, "listTenants");
const createTenantOwner = httpsCallable(functions, "createTenantOwner");
const updateTenantOwner = httpsCallable(functions, "updateTenantOwner");

const ownerList = document.querySelector("#ownerList");
const ownerCount = document.querySelector("#ownerCount");
const ownerSearch = document.querySelector("#ownerSearch");
const ownerStatusFilter = document.querySelector("#ownerStatusFilter");
let tenants = [];
let selectedTenant = null;
let modalMode = "create";

function icon(name) {
  return `<svg class="app-icon" aria-hidden="true"><use href="/assets/images/app-icons.svg?v=20260621-2#icon-${name}"></use></svg>`;
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
        <div><h2 id="ownerModalTitle">สร้างบัญชี Owner</h2><p id="ownerModalShop">-</p></div>
      </div>
      <button type="button" class="owner-modal-close" data-owner-close aria-label="ปิด">${icon("close")}</button>
    </div>
    <form id="ownerForm" class="owner-modal-form">
      <div class="field">
        <label for="ownerDisplayName">ชื่อเจ้าของร้าน</label>
        <input class="input" id="ownerDisplayName" maxlength="120" autocomplete="name" required>
      </div>
      <div class="field">
        <label for="ownerEmail">อีเมลสำหรับเข้าสู่ระบบ</label>
        <input class="input" id="ownerEmail" type="email" maxlength="160" autocomplete="username" required>
      </div>
      <div id="ownerPasswordFields" class="grid grid-2 owner-password-grid">
        <div class="field">
          <label for="ownerPassword">รหัสผ่านเริ่มต้น</label>
          <input class="input" id="ownerPassword" type="password" minlength="8" autocomplete="new-password">
          <small>อย่างน้อย 8 ตัวอักษร</small>
        </div>
        <div class="field">
          <label for="ownerPasswordConfirm">ยืนยันรหัสผ่าน</label>
          <input class="input" id="ownerPasswordConfirm" type="password" minlength="8" autocomplete="new-password">
          <small>ต้องตรงกับรหัสผ่านด้านซ้าย</small>
        </div>
      </div>
      <div class="upload-error owner-form-error" id="ownerFormError" hidden></div>
      <div class="owner-modal-actions">
        <button type="button" class="btn" data-owner-close>${icon("close")}<span>ยกเลิก</span></button>
        <button type="submit" class="btn btn-primary" id="ownerSubmitButton">${icon("save")}<span>บันทึก</span></button>
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

function openOwnerModal(tenant, mode) {
  selectedTenant = tenant;
  modalMode = mode;
  ownerForm.reset();
  setOwnerFormError("");
  ownerModalShop.textContent = tenant.name || tenant.slug || tenant.id;

  const editing = mode === "edit";
  ownerModalTitle.textContent = editing ? "แก้ไขชื่อเจ้าของร้าน" : "สร้างบัญชี Owner";
  ownerDisplayName.value = editing ? tenant.ownerDisplayName || "" : "";
  ownerEmail.value = editing ? tenant.ownerEmail || "" : "";
  ownerEmail.disabled = editing;
  ownerPasswordFields.hidden = editing;
  ownerPassword.required = !editing;
  ownerPasswordConfirm.required = !editing;
  ownerSubmitButton.innerHTML = editing
    ? `${icon("save")}<span>บันทึกชื่อเจ้าของร้าน</span>`
    : `${icon("save")}<span>สร้างบัญชี Owner</span>`;

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

  ownerCount.textContent = `${tenants.filter(item => item.ownerUid).length} บัญชี`;
  ownerList.innerHTML = filtered.length ? filtered.map(tenant => `
    <article class="card" style="box-shadow:none;background:#f8fbf9">
      <div class="section-title" style="margin:0">
        <div>
          <h2 style="margin:0">${escapeHtml(tenant.name || "ไม่ระบุชื่อร้าน")}</h2>
          <div class="menu-category">/${escapeHtml(tenant.slug || "-")}</div>
        </div>
        <span class="badge ${tenant.active === false ? "warning" : ""}">${tenant.active === false ? "ร้านถูกระงับ" : "ร้านใช้งาน"}</span>
      </div>
      <div style="margin-top:14px">
        ${tenant.ownerUid ? `
          <div><strong>${escapeHtml(tenant.ownerDisplayName || "ไม่ระบุชื่อ Owner")}</strong></div>
          <div class="menu-category" style="font-size:14px">${escapeHtml(tenant.ownerEmail || "-")}</div>
          <div style="margin-top:8px"><span class="badge">มีบัญชี Owner แล้ว</span></div>
        ` : `
          <div class="menu-category" style="font-size:14px">ร้านนี้ยังไม่มีบัญชี Owner</div>
          <div style="margin-top:8px"><span class="badge warning">รอสร้างบัญชี</span></div>
        `}
      </div>
      <div class="order-actions" style="margin-top:14px">
        ${tenant.ownerUid
          ? `<button class="btn" type="button" data-owner-action="edit" data-tenant-id="${escapeHtml(tenant.id)}">${icon("edit")}<span>แก้ไขชื่อ Owner</span></button>`
          : `<button class="btn btn-primary" type="button" data-owner-action="create" data-tenant-id="${escapeHtml(tenant.id)}">${icon("user")}<span>สร้าง Owner</span></button>`}
      </div>
    </article>`).join("") : '<div class="empty">ไม่พบข้อมูลบัญชี Owner</div>';
}

async function load() {
  ownerList.innerHTML = '<div class="empty">กำลังโหลด...</div>';
  try {
    const result = await listTenants();
    tenants = result.data?.tenants || [];
    render();
  } catch (error) {
    console.error(error);
    ownerList.innerHTML = '<div class="upload-error">โหลดบัญชี Owner ไม่สำเร็จ</div>';
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
    ownerPasswordConfirm.setCustomValidity("รหัสผ่านไม่ตรงกัน");
  }
});

ownerForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!selectedTenant) return;

  const displayName = ownerDisplayName.value.trim();
  setOwnerFormError("");

  if (modalMode === "create" && ownerPassword.value !== ownerPasswordConfirm.value) {
    ownerPasswordConfirm.setCustomValidity("รหัสผ่านไม่ตรงกัน");
    ownerPasswordConfirm.reportValidity();
    return;
  }
  ownerPasswordConfirm.setCustomValidity("");
  if (!ownerForm.reportValidity()) return;

  ownerSubmitButton.disabled = true;
  ownerSubmitButton.innerHTML = "<span>กำลังบันทึก...</span>";
  try {
    if (modalMode === "edit") {
      await updateTenantOwner({ tenantId: selectedTenant.id, displayName });
      toast("แก้ไขชื่อเจ้าของร้านเรียบร้อยแล้ว");
    } else {
      await createTenantOwner({
        tenantId: selectedTenant.id,
        displayName,
        email: ownerEmail.value.trim().toLowerCase(),
        password: ownerPassword.value
      });
      toast("สร้างบัญชี Owner เรียบร้อยแล้ว");
    }
    closeOwnerModal();
    await load();
  } catch (error) {
    console.error(error);
    let message = modalMode === "edit" ? "แก้ไขชื่อเจ้าของร้านไม่สำเร็จ" : "สร้าง Owner ไม่สำเร็จ";
    if (error.code === "functions/already-exists") message = error.message || "ร้านนี้มี Owner แล้ว หรืออีเมลถูกใช้งานแล้ว";
    if (error.code === "functions/invalid-argument") message = error.message || "ข้อมูล Owner ไม่ถูกต้อง";
    if (error.code === "functions/permission-denied") message = "บัญชีนี้ไม่มีสิทธิ์ดำเนินการ";
    setOwnerFormError(message);
    toast(message, "error");
  } finally {
    ownerSubmitButton.disabled = false;
    ownerSubmitButton.innerHTML = modalMode === "edit"
      ? `${icon("save")}<span>บันทึกชื่อเจ้าของร้าน</span>`
      : `${icon("save")}<span>สร้างบัญชี Owner</span>`;
  }
});

ownerSearch.addEventListener("input", render);
ownerStatusFilter.addEventListener("change", render);

await load();
