import { app } from "./firebase-config.js";
import { toast } from "./ui.js";
import {
  getFunctions, httpsCallable
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";

const functions = getFunctions(app, "asia-southeast1");
const listTenants = httpsCallable(functions, "listTenants");
const createTenant = httpsCallable(functions, "createTenant");

const form = document.getElementById("tenantForm");
const nameField = document.getElementById("tenantName");
const slugField = document.getElementById("tenantSlug");
const phoneField = document.getElementById("tenantPhone");
const addressField = document.getElementById("tenantAddress");
const submitButton = document.getElementById("createTenantButton");
const errorBox = document.getElementById("tenantError");
const tenantList = document.getElementById("tenantList");
const tenantCount = document.getElementById("tenantCount");

function normalizeSlug(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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

function renderTenants(tenants = []) {
  tenantCount.textContent = `${tenants.length} ร้าน`;
  tenantList.innerHTML = tenants.length ? tenants.map(tenant => `
    <article class="card" style="box-shadow:none;background:#f8fbf9">
      <div class="section-title" style="margin:0">
        <div>
          <h2 style="margin:0">${escapeHtml(tenant.name || "ไม่ระบุชื่อร้าน")}</h2>
          <div class="menu-category">/${escapeHtml(tenant.slug || "-")}</div>
        </div>
        <span class="badge ${tenant.active === false ? "warning" : ""}">${tenant.active === false ? "ปิดใช้งาน" : "ใช้งาน"}</span>
      </div>
      <div style="margin-top:12px;word-break:break-all"><strong>Tenant ID:</strong> ${escapeHtml(tenant.id)}</div>
      <div class="order-actions" style="margin-top:12px">
        <a class="btn btn-dark btn-sm" href="/s/${encodeURIComponent(tenant.slug || "")}/delivery" target="_blank" rel="noopener">เปิดหน้าร้าน</a>
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
  slugField.value = normalizeSlug(slugField.value);
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  showError("");
  submitButton.disabled = true;
  submitButton.textContent = "กำลังสร้างร้าน...";

  try {
    const result = await createTenant({
      name: nameField.value.trim(),
      slug: normalizeSlug(slugField.value),
      phone: phoneField.value.trim(),
      address: addressField.value.trim()
    });

    form.reset();
    slugField.dataset.edited = "false";
    toast(`สร้างร้าน ${result.data?.tenant?.name || "ใหม่"} เรียบร้อยแล้ว`);
    await loadTenants();
  } catch (error) {
    console.error(error);
    let message = "สร้างร้านไม่สำเร็จ";
    if (error.code === "functions/already-exists") message = "Slug นี้ถูกใช้งานแล้ว";
    if (error.code === "functions/invalid-argument") message = error.message || "ข้อมูลร้านไม่ถูกต้อง";
    if (error.code === "functions/permission-denied") message = "บัญชีนี้ไม่มีสิทธิ์สร้างร้าน";
    showError(message);
    toast(message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "สร้างร้าน";
  }
});

await loadTenants();
