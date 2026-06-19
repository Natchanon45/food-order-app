export const APP_VERSION = "1.6.4";
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

function iconMarkup(name) {
  return `<svg class="app-icon" aria-hidden="true"><use href="/assets/images/app-icons.svg#icon-${name}"></use></svg>`;
}

function mountIconStyles() {
  if (document.querySelector('link[href="/assets/css/icons.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/icons.css";
  document.head.appendChild(link);
}

function replaceSystemEmoji() {
  const replacements = new Map([
    ["🛵", "delivery"],
    ["👨‍🍳", "kitchen"],
    ["🧾", "receipt"],
    ["⚙️", "settings"],
    ["👥", "users"]
  ]);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(node => {
    if (node.parentElement?.closest("script, style, textarea, input")) return;
    let text = node.nodeValue || "";
    const found = [...replacements.keys()].find(emoji => text.includes(emoji));
    if (!found) return;

    const fragment = document.createDocumentFragment();
    while (text) {
      let nearestIndex = -1;
      let nearestEmoji = "";
      for (const emoji of replacements.keys()) {
        const index = text.indexOf(emoji);
        if (index >= 0 && (nearestIndex < 0 || index < nearestIndex)) {
          nearestIndex = index;
          nearestEmoji = emoji;
        }
      }

      if (nearestIndex < 0) {
        fragment.append(document.createTextNode(text));
        break;
      }

      if (nearestIndex > 0) fragment.append(document.createTextNode(text.slice(0, nearestIndex)));
      const wrapper = document.createElement("span");
      wrapper.innerHTML = iconMarkup(replacements.get(nearestEmoji));
      fragment.append(wrapper.firstElementChild);
      text = text.slice(nearestIndex + nearestEmoji.length);
    }
    node.replaceWith(fragment);
  });
}

function mountVersion() {
  if (document.querySelector(".app-version")) return;
  const footer = document.createElement("footer");
  footer.className = "app-version";
  footer.textContent = `Food Order QR • Version ${APP_VERSION}`;
  document.body.appendChild(footer);
}

function initializeUi() {
  mountIconStyles();
  replaceSystemEmoji();
  mountVersion();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeUi);
else initializeUi();

document.addEventListener("error", event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  if (!image.closest(".menu-image") && !image.matches("[data-food-image]") && image.id !== "menuImagePreview") return;
  if (image.dataset.defaultApplied === "true") return;

  image.dataset.defaultApplied = "true";
  image.src = DEFAULT_FOOD_IMAGE;
}, true);
