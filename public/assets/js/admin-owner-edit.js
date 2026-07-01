import { app } from "./firebase-config.js?v=20260630-073";
import { toast } from "./ui.js?v=20260701-002";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";
import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";

const functions = getFunctions(app, "asia-southeast1");
const listTenants = httpsCallable(functions, "listTenants");
const updateTenantOwner = httpsCallable(functions, "updateTenantOwner");
const tenantList = document.querySelector("#tenantList");
let tenants = [];

function icon(name) {
  return iconMarkup(name);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

const modal = document.createElement("div");
modal.className = "owner-modal";
modal.hidden = true;
modal.innerHTML = `
  <div class="owner-modal-backdrop" data-edit-owner-close></div>
  <section class="owner-modal-card" role="dialog" aria-modal="true" aria-labelledby="editOwnerTitle">
    <div class="owner-modal-head">
      <div><div class="owner-modal-icon">${icon("edit")}</div><div><h2 id="editOwnerTitle">แก้ไขชื่อเจ้าของร้าน</h2><p id="editOwnerShop">-</p></div></div>
      <button type="button" class="owner-modal-close" data-edit-owner-close aria-label="ปิด">${icon("close")}</button>
    </div>
    <form id="editOwnerForm" class="owner-modal-form">
      <div class="field"><label for="editOwnerDisplayName">ชื่อเจ้าของร้าน</label><input class="input" id="editOwnerDisplayName" maxlength="120" required></div>
      <div class="field"><label>อีเมลเข้าสู่ระบบ</label><input class="input" id="editOwnerEmail" disabled></div>
      <div class="upload-error" id="editOwnerError" hidden></div>
      <div class="owner-modal-actions">
        <button type="button" class="btn" data-edit-owner-close>${icon("close")}<span>ยกเลิก</span></button>
        <button type="submit" class="btn btn-primary" id="editOwnerSubmit">${icon("save")}<span>บันทึกชื่อเจ้าของร้าน</span></button>
      </div>
    </form>
  </section>`;
document.body.appendChild(modal);

const form = modal.querySelector("#editOwnerForm");
const nameField = modal.querySelector("#editOwnerDisplayName");
const emailField = modal.querySelector("#editOwnerEmail");
const shopLabel = modal.querySelector("#editOwnerShop");
const errorBox = modal.querySelector("#editOwnerError");
const submitButton = modal.querySelector("#editOwnerSubmit");
let selectedTenant = null;

function closeModal() {
  if (submitButton.disabled) return;
  selectedTenant = null;
  modal.hidden = true;
  document.body.classList.remove("owner-modal-open");
  form.reset();
  errorBox.hidden = true;
}

function openModal(tenant) {
  selectedTenant = tenant;
  shopLabel.textContent = tenant.name || tenant.slug || tenant.id;
  nameField.value = tenant.ownerDisplayName || "";
  emailField.value = tenant.ownerEmail || "";
  errorBox.hidden = true;
  modal.hidden = false;
  document.body.classList.add("owner-modal-open");
  requestAnimationFrame(() => nameField.focus());
}

async function decorateOwnerButtons() {
  const cards = [...tenantList.querySelectorAll(":scope > article.card")];
  if (!cards.length) return;
  if (!tenants.length) tenants = (await listTenants()).data?.tenants || [];
  cards.forEach((card, index) => {
    const tenant = tenants[index];
    if (!tenant?.ownerUid || card.querySelector("[data-edit-owner]")) return;
    const actions = card.querySelector(".order-actions");
    actions?.insertAdjacentHTML("afterbegin", `<button class="btn btn-sm" type="button" data-edit-owner="${escapeHtml(tenant.id)}">${icon("edit")}<span>แก้ไขชื่อ Owner</span></button>`);
  });
}

tenantList.addEventListener("click", event => {
  const button = event.target.closest("[data-edit-owner]");
  if (!button) return;
  const tenant = tenants.find(item => item.id === button.dataset.editOwner);
  if (tenant) openModal(tenant);
});

modal.addEventListener("click", event => {
  if (event.target.closest("[data-edit-owner-close]")) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !modal.hidden) closeModal();
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!selectedTenant || !form.reportValidity()) return;
  submitButton.disabled = true;
  submitButton.innerHTML = "<span>กำลังบันทึก...</span>";
  errorBox.hidden = true;
  try {
    await updateTenantOwner({ tenantId: selectedTenant.id, displayName: nameField.value.trim() });
    toast("แก้ไขชื่อเจ้าของร้านเรียบร้อยแล้ว");
    location.reload();
  } catch (error) {
    console.error(error);
    errorBox.textContent = error.message || "แก้ไขชื่อเจ้าของร้านไม่สำเร็จ";
    errorBox.hidden = false;
    toast("แก้ไขชื่อเจ้าของร้านไม่สำเร็จ", "error");
    submitButton.disabled = false;
    submitButton.innerHTML = `${icon("save")}<span>บันทึกชื่อเจ้าของร้าน</span>`;
  }
});

new MutationObserver(() => decorateOwnerButtons().catch(console.error)).observe(tenantList, { childList: true });
await decorateOwnerButtons();
