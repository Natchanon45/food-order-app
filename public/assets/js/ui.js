import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";

export const APP_VERSION = "1.6.17";
export const DEFAULT_FOOD_IMAGE = "/assets/images/default-food.svg";

export const money = (value = 0) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);

export function toast(message, type = "success") {
  const normalizedType = type === "error" ? "error" : "success";
  const iconName = normalizedType === "error" ? "x-circle" : "check-circle";
  const el = document.createElement("div");
  el.className = `app-toast ${normalizedType}`;
  el.setAttribute("role", normalizedType === "error" ? "alert" : "status");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `
    <span class="app-toast-icon" aria-hidden="true">
      ${iconMarkup(iconName)}
    </span>
    <span class="app-toast-message"></span>
  `;
  el.querySelector(".app-toast-message").textContent = String(message || "");
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

export function getTableCode() {
  return new URLSearchParams(location.search).get("table")?.trim().toUpperCase() || "";
}

export function statusLabel(status) {
  return ({ pending: "รอรับออเดอร์", accepted: "ครัวรับแล้ว", cooking: "กำลังทำ", ready: "พร้อมเสิร์ฟ", served: "เสิร์ฟแล้ว", paid: "ชำระแล้ว", cancelled: "ยกเลิก" })[status] || status;
}

function normalizeDateValue(value) {
  if (!value) return new Date();
  if (value?.toDate) return value.toDate();
  if (typeof value === "object" && Number.isFinite(Number(value.seconds))) return new Date(Number(value.seconds) * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function formatTime(value) {
  return normalizeDateValue(value).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

function mountIconStyles() {
  if (!document.querySelector('link[href^="/assets/css/icons.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/css/icons.css?v=20260701-001";
    document.head.appendChild(link);
  }
  if (!document.querySelector("#receiptCompactStyles")) {
    const style = document.createElement("style");
    style.id = "receiptCompactStyles";
    style.textContent = ".receipt-item-name{max-width:42mm;font-size:.82em;line-height:1.05;vertical-align:top}.receipt-item-line{display:flex;align-items:flex-end;gap:3px;min-width:0}.receipt-item-text{min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}.receipt-item-qty{flex:0 0 auto;white-space:nowrap;font-weight:600}.receipt-item-note{font-size:.78em;color:#444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";
    document.head.appendChild(style);
  }
}

const STANDARD_ACTIONS = [
  { pattern: /^\s*[+＋]?\s*สร้าง/i, label: "สร้าง", icon: "plus" },
  { pattern: /^\s*[+＋]?\s*เพิ่ม/i, label: "เพิ่ม", icon: "plus" },
  { pattern: /^\s*แก้ไข/i, label: "แก้ไข", icon: "pencil" },
  { pattern: /^\s*ลบ/i, label: "ลบ", icon: "trash" },
  { pattern: /^\s*ยกเลิก/i, label: "ยกเลิก", icon: "x-circle" },
  { pattern: /^\s*บันทึก/i, label: "บันทึก", icon: "save" }
];

const buttonIconRules = [
  [/เปิดใช้งานอีกครั้ง|reactivate|activate again/i, "check-circle"],
  [/ระงับบัญชี|suspend/i, "times-circle"],
  [/ต่ออายุ|renew|extend/i, "plus"],
  [/ยืนยัน|confirm|ชำระ|เสร็จ|รับออเดอร์/i, "check"],
  [/พิมพ์|print/i, "print"],
  [/ย้อนกลับ|กลับ|back/i, "back"],
  [/qr/i, "qr"],
  [/ค้นหา|search/i, "search"],
  [/ออกจากระบบ|logout/i, "logout"]
];

function visibleButtonText(button) {
  const clone = button.cloneNode(true);
  clone.querySelectorAll("svg, .app-icon").forEach(node => node.remove());
  return (clone.textContent || "").replace(/\s+/g, " ").trim();
}

function standardActionFor(button) {
  const text = visibleButtonText(button);
  if (!text || /^(กำลัง|โปรดรอ)/i.test(text)) return null;
  return STANDARD_ACTIONS.find(action => action.pattern.test(text)) || null;
}

function applyStandardAction(button, action) {
  const alreadyStandard = visibleButtonText(button) === action.label
    && button.dataset.appIcon === action.icon
    && Boolean(button.querySelector(".app-icon"));
  if (!alreadyStandard) {
    button.innerHTML = `${iconMarkup(action.icon)}<span>${action.label}</span>`;
    button.dataset.appIcon = action.icon;
  }
  button.classList.add("btn-standard-action");
  button.classList.remove("btn-icon-only");
  button.removeAttribute("aria-label");
  button.removeAttribute("title");
  return true;
}

function makeIconOnly(button, icon, label) {
  const alreadyDecorated = button.classList.contains("btn-icon-only")
    && button.dataset.appIcon === icon
    && Boolean(button.querySelector(".app-icon"));

  if (!alreadyDecorated) {
    button.innerHTML = iconMarkup(icon);
    button.dataset.appIcon = icon;
  }
  button.classList.add("btn-icon-only");
  button.classList.remove("btn-standard-action");
  button.setAttribute("aria-label", label);
  button.title = label;
}

mountIconStyles();
