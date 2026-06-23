export const APP_VERSION = "1.6.16";
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
      <svg class="app-icon"><use href="/assets/images/app-icons.svg?v=20260621-3#icon-${iconName}"></use></svg>
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

export function formatTime(value) {
  const date = value?.toDate ? value.toDate() : new Date(value || Date.now());
  return date.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

function iconMarkup(name) {
  return `<svg class="app-icon" aria-hidden="true"><use href="/assets/images/app-icons.svg?v=20260621-3#icon-${name}"></use></svg>`;
}

function mountIconStyles() {
  if (!document.querySelector('link[href^="/assets/css/icons.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/css/icons.css?v=20260621-34";
    document.head.appendChild(link);
  }
  if (!document.querySelector("#receiptCompactStyles")) {
    const style = document.createElement("style");
    style.id = "receiptCompactStyles";
    style.textContent = ".receipt-item-name{max-width:42mm;font-size:.82em;line-height:1.05;vertical-align:top}.receipt-item-line{display:flex;align-items:flex-end;gap:3px;min-width:0}.receipt-item-text{min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}.receipt-item-qty{flex:0 0 auto;white-space:nowrap;font-weight:600}.receipt-item-note{font-size:.78em;color:#444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";
    document.head.appendChild(style);
  }
}

function replaceSystemEmoji() {
  const replacements = new Map([["🛵", "delivery"], ["👨‍🍳", "kitchen"], ["🧾", "receipt"], ["⚙️", "settings"], ["👥", "users"]]);
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
        if (index >= 0 && (nearestIndex < 0 || index < nearestIndex)) { nearestIndex = index; nearestEmoji = emoji; }
      }
      if (nearestIndex < 0) { fragment.append(document.createTextNode(text)); break; }
      if (nearestIndex > 0) fragment.append(document.createTextNode(text.slice(0, nearestIndex)));
      const wrapper = document.createElement("span");
      wrapper.innerHTML = iconMarkup(replacements.get(nearestEmoji));
      fragment.append(wrapper.firstElementChild);
      text = text.slice(nearestIndex + nearestEmoji.length);
    }
    node.replaceWith(fragment);
  });
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
  const use = button.querySelector("use");
  const href = use?.getAttribute("href") || use?.getAttribute("xlink:href") || "";
  const alreadyStandard = visibleButtonText(button) === action.label && href.includes(`#icon-${action.icon}`);
  if (!alreadyStandard) {
    button.innerHTML = `${iconMarkup(action.icon)}<span>${action.label}</span>`;
  }
  button.classList.add("btn-standard-action");
  button.classList.remove("btn-icon-only");
  button.removeAttribute("aria-label");
  button.removeAttribute("title");
  return true;
}

function makeIconOnly(button, icon, label) {
  const use = button.querySelector("use");
  const href = use?.getAttribute("href") || use?.getAttribute("xlink:href") || "";
  const alreadyDecorated = button.classList.contains("btn-icon-only") && href.includes(`#icon-${icon}`);

  if (!alreadyDecorated) {
    button.innerHTML = iconMarkup(icon);
  }
  button.classList.add("btn-icon-only");
  button.classList.remove("btn-standard-action");
  button.setAttribute("aria-label", label);
  button.title = label;
}

function decorateButton(button) {
  if (!(button instanceof HTMLElement) || !button.matches("button, a.btn")) return;
  if (button.closest(".user-menu")) return;

  if (button.dataset.inc) {
    makeIconOnly(button, "plus", "เพิ่มจำนวน");
    return;
  }

  if (button.dataset.dec) {
    makeIconOnly(button, "minus", "ลดจำนวน");
    return;
  }

  const standardAction = standardActionFor(button);
  if (standardAction && applyStandardAction(button, standardAction)) return;

  if (!button.querySelector(".app-icon")) {
    const normalizedText = button.textContent?.trim() || "";
    const icon = buttonIconRules.find(([pattern]) => pattern.test(normalizedText))?.[1] || "";
    if (icon) button.insertAdjacentHTML("afterbegin", iconMarkup(icon));
  }

  const hasIcon = Boolean(button.querySelector(".app-icon"));
  const hasText = Boolean(visibleButtonText(button));
  button.classList.toggle("btn-icon-only", hasIcon && !hasText);

  if (hasIcon && hasText) {
    button.removeAttribute("aria-label");
    button.removeAttribute("title");
  }

  if (hasIcon && !hasText && !button.getAttribute("aria-label")) {
    const fallbackLabel = button.title || "ปุ่มคำสั่ง";
    button.setAttribute("aria-label", fallbackLabel);
  }
}

function decorateButtons(root = document) {
  if (root instanceof HTMLElement && root.matches("button, a.btn")) decorateButton(root);
  root.querySelectorAll?.("button, a.btn").forEach(decorateButton);
}

function decorateCartHeading(heading) {
  if (!(heading instanceof HTMLElement) || heading.querySelector(".app-icon")) return;
  const text = heading.textContent?.trim() || "";
  if (!/ตะกร้าอาหาร|รายการรอบปัจจุบัน/i.test(text)) return;
  heading.insertAdjacentHTML("afterbegin", iconMarkup("cart"));
  heading.classList.add("has-heading-icon");
}

function decorateCartHeadings(root = document) {
  if (root instanceof HTMLElement && root.matches(".section-title h2")) decorateCartHeading(root);
  root.querySelectorAll?.(".section-title h2").forEach(decorateCartHeading);
}

function mountDeliveryAddToast() {
  const isDeliveryPage = /^\/s\/[^/]+\/delivery\/?$/i.test(location.pathname) || /^\/delivery\/?$/i.test(location.pathname);
  if (!isDeliveryPage || document.body.dataset.deliveryAddToastMounted === "true") return;
  document.body.dataset.deliveryAddToastMounted = "true";

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-add]");
    if (!button) return;
    const name = button.closest(".menu-card")?.querySelector(".menu-name")?.textContent?.trim() || "เมนู";
    setTimeout(() => toast(`เพิ่ม ${name} แล้ว`), 0);
  });
}

function mountVersion() {
  if (document.querySelector(".app-version")) return;
  const footer = document.createElement("footer");
  footer.className = "app-version";
  footer.textContent = `Food Order/Delivery With QR • Version ${APP_VERSION}`;
  document.body.appendChild(footer);
}

function initializeUi() {
  mountIconStyles();
  replaceSystemEmoji();
  decorateButtons();
  decorateCartHeadings();
  mountDeliveryAddToast();
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      decorateButtons(node);
      if (node.parentElement?.matches("button, a.btn")) decorateButton(node.parentElement);
      decorateCartHeadings(node);
    } else if (node.parentElement) {
      decorateButton(node.parentElement.closest?.("button, a.btn"));
      decorateCartHeading(node.parentElement.closest?.(".section-title h2"));
    }
  }))).observe(document.body, { childList: true, subtree: true });
  if (document.querySelector("#menuGrid")) import("./menu-image-position.js");
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
