import { app } from "./firebase-config.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";

const functions = getFunctions(app, "asia-southeast1");
const listTenants = httpsCallable(functions, "listTenants");

const ownerList = document.querySelector("#ownerList");
const ownerCount = document.querySelector("#ownerCount");
const ownerSearch = document.querySelector("#ownerSearch");
const ownerStatusFilter = document.querySelector("#ownerStatusFilter");
let tenants = [];

function icon(name) {
  return `<svg class="app-icon" aria-hidden="true"><use href="/assets/images/app-icons.svg?v=20260621-2#icon-${name}"></use></svg>`;
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
        <a class="btn ${tenant.ownerUid ? "" : "btn-primary"}" href="/admin/tenants">${icon(tenant.ownerUid ? "settings" : "user")}<span>${tenant.ownerUid ? "จัดการร้าน" : "สร้าง Owner"}</span></a>
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

ownerSearch.addEventListener("input", render);
ownerStatusFilter.addEventListener("change", render);

await load();
