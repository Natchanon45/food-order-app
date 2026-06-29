import "./sweet-dialog.js?v=20260629-048";
import { app } from "./firebase-config.js";
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
const backfillTenantSubscriptions = httpsCallable(functions, "backfillTenantSubscriptions");
const updateTenantSubscription = httpsCallable(functions, "updateTenantSubscription");
const tenantList = document.querySelector("#tenantList");
let tenants = [];

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options);
  return confirm(message);
}

function icon(name) {
  return `<svg class="app-icon" aria-hidden="true"><use href="/assets/images/app-icons.svg?v=20260621-2#icon-${name}"></use></svg>`;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateInputValue(value) {
  const date = toDate(value);
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function daysRemaining(tenant) {
  const expiry = toDate(tenant.subscriptionExpiresAt);
  if (!expiry) return null;
  return Math.ceil((expiry.getTime() - Date.now()) / 86400000);
}

function statusInfo(tenant) {
  const status = tenant.subscriptionStatus || "active";
  const labels = { active: "ใช้งาน", grace: "ช่วงผ่อนผัน", expired: "หมดอายุ", suspended: "ระงับ" };
  return { status, label: labels[status] || status };
}

function subscriptionHtml(tenant) {
  const remaining = daysRemaining(tenant);
  const { status, label } = statusInfo(tenant);
  return `
    <section class="tenant-subscription" data-subscription-tenant="${tenant.id}" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line)">
      <div class="grid grid-3">
        <div><strong>แพ็กเกจ</strong><div class="menu-category">${tenant.planCode === "yearly" ? "รายปี" : "รายเดือน"}</div></div>
        <div><strong>วันหมดอายุ</strong><div class="menu-category">${toDate(tenant.subscriptionExpiresAt)?.toLocaleDateString("th-TH") || "ยังไม่กำหนด"}</div></div>
        <div><strong>สถานะสมาชิก</strong><div><span class="badge ${["expired", "suspended"].includes(status) ? "warning" : ""}">${label}</span></div></div>
      </div>
      <div class="menu-category" style="margin-top:8px">${remaining === null ? "ยังไม่กำหนดวันหมดอายุ" : remaining >= 0 ? `เหลือ ${remaining} วัน` : `หมดอายุแล้ว ${Math.abs(remaining)} วัน`} • ผ่อนผัน ${Number(tenant.gracePeriodDays ?? 3)} วัน</div>
      <div class="grid grid-3" style="margin-top:10px">
        <div class="field"><label>กำหนดวันหมดอายุ</label><input class="input" type="date" data-expiry-date value="${dateInputValue(tenant.subscriptionExpiresAt)}"></div>
        <div class="field"><label>ช่วงผ่อนผัน (วัน)</label><input class="input" type="number" min="0" max="30" data-grace-days value="${Number(tenant.gracePeriodDays ?? 3)}"></div>
        <div class="field"><label>แพ็กเกจ</label><select class="input" data-plan-code><option value="monthly" ${tenant.planCode !== "yearly" ? "selected" : ""}>รายเดือน</option><option value="yearly" ${tenant.planCode === "yearly" ? "selected" : ""}>รายปี</option></select></div>
      </div>
      <div class="order-actions" style="margin-top:10px">
        <button class="btn btn-primary btn-sm" type="button" data-subscription-action="extend" data-days="30">${icon("add")}<span>ต่ออายุ 30 วัน</span></button>
        <button class="btn btn-primary btn-sm" type="button" data-subscription-action="extend" data-days="365">${icon("add")}<span>ต่ออายุ 1 ปี</span></button>
        <button class="btn btn-sm" type="button" data-subscription-action="set-expiry">${icon("save")}<span>บันทึกวันหมดอายุ</span></button>
        ${status === "suspended" ? `<button class="btn btn-primary btn-sm" type="button" data-subscription-action="activate">${icon("check-circle")}<span>เปิดใช้งานอีกครั้ง</span></button>` : `<button class="btn btn-danger btn-sm" type="button" data-subscription-action="suspend">${icon("times-circle")}<span>ระงับบัญชี</span></button>`}
      </div>
    </section>`;
}

async function decorateTenantCards() {
  const cards = [...tenantList.querySelectorAll(":scope > article.card")];
  if (!cards.length) return;
  if (!tenants.length) {
    const result = await listTenants();
    tenants = result.data?.tenants || [];
  }
  cards.forEach((card, index) => {
    if (card.querySelector("[data-subscription-tenant]")) return;
    const tenant = tenants[index];
    if (tenant) card.insertAdjacentHTML("beforeend", subscriptionHtml(tenant));
  });
}

async function performAction(button) {
  const section = button.closest("[data-subscription-tenant]");
  const tenantId = section?.dataset.subscriptionTenant;
  if (!tenantId) return;
  const action = button.dataset.subscriptionAction;
  if (action === "suspend") {
    const ok = await askConfirm("ยืนยันระงับบัญชีร้านนี้ใช่หรือไม่? QR และระบบร้านจะหยุดใช้งานทันที", {
      title: "ระงับบัญชีร้าน",
      confirmText: "ตกลง",
      cancelText: "ยกเลิก",
      type: "warning"
    });
    if (!ok) return;
  }

  const payload = {
    tenantId,
    action,
    days: Number(button.dataset.days || 0),
    expiresAt: section.querySelector("[data-expiry-date]")?.value || "",
    gracePeriodDays: Number(section.querySelector("[data-grace-days]")?.value || 3),
    planCode: section.querySelector("[data-plan-code]")?.value || "monthly"
  };

  button.disabled = true;
  try {
    await updateTenantSubscription(payload);
    toast("อัปเดตอายุสมาชิกเรียบร้อยแล้ว");
    location.reload();
  } catch (error) {
    console.error(error);
    toast(error.message || "อัปเดตอายุสมาชิกไม่สำเร็จ", "error");
    button.disabled = false;
  }
}

tenantList.addEventListener("click", event => {
  const button = event.target.closest("[data-subscription-action]");
  if (button) performAction(button);
});

new MutationObserver(() => decorateTenantCards().catch(console.error)).observe(tenantList, { childList: true });

try {
  const result = await backfillTenantSubscriptions({});
  if (result.data?.updated) toast(`กำหนดอายุเริ่มต้นให้ ${result.data.updated} ร้านแล้ว`);
} catch (error) {
  console.error("Subscription backfill failed", error);
}

await decorateTenantCards();