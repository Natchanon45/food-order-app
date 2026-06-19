export const APP_VERSION = "1.4.0";
export const DEFAULT_FOOD_IMAGE = "/assets/images/default-food.svg";

export const money = (value = 0) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);

export function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `app-toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 250); }, 2400);
}

export function getTableCode() {
  return new URLSearchParams(location.search).get("table")?.trim().toUpperCase() || "";
}

export function statusLabel(status) {
  return ({ pending: "รอรับออเดอร์", accepted: "ครัวรับแล้ว", cooking: "กำลังทำ", ready: "พร้อมเสิร์ฟ", served: "เสิร์ฟแล้ว", paid: "ชำระแล้ว", cancelled: "ยกเลิก" })[status] || status;
}

export function formatTime(value) {
  const date = value?.toDate ? value.toDate() : new Date(value || Date.now());
  return date.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

function mountVersion() {
  if (document.querySelector(".app-version")) return;
  const footer = document.createElement("footer");
  footer.className = "app-version";
  footer.textContent = `Food Order QR • Version ${APP_VERSION}`;
  document.body.appendChild(footer);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountVersion);
else mountVersion();

document.addEventListener("error", event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  if (!image.closest(".menu-image") && !image.matches("[data-food-image]") && image.id !== "menuImagePreview") return;
  if (image.dataset.defaultApplied === "true") return;

  image.dataset.defaultApplied = "true";
  image.src = DEFAULT_FOOD_IMAGE;
}, true);
