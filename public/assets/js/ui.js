export const APP_VERSION = "1.6.11";
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
      <svg class="app-icon"><use href="/assets/images/app-icons.svg#icon-${iconName}"></use></svg>
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
  return `<svg class="app-icon" aria-hidden="true"><use href="/assets/images/app-icons.svg#icon-${name}"></use></svg>`;
}

function mountIconStyles() {
  if (!document.querySelector('link[href="/assets/css/icons.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/css/icons.css";
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

const buttonIconRules = [
  [/ลบ|delete|remove/i, "delete"],
  [/แก้ไข|edit/i, "edit"],
  [/บันทึก|save/i, "save"],
  [/เพิ่ม|add/i, "add"],
  [/ยืนยัน|confirm|ชำระ|เสร็จ|รับออเดอร์/i, "check"],
  [/ยกเลิก|cancel|ปิด/i, "close"],
  [/พิมพ์|print/i, "print"],
  [/ย้อนกลับ|กลับ|back/i, "back"],
  [/qr/i, "qr"],
  [/ค้นหา|search/i, "search"],
  [/ออกจากระบบ|logout/i, "logout"]
];

function visibleButtonText(button) {
  return [...button.childNodes]
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.nodeValue || "")
    .join("")
    .trim();
}

function stripDuplicateLeadingSymbol(button) {
  for (const node of button.childNodes) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const text = node.nodeValue || "";
    const cleaned = text.replace(/^\s*[+＋]\s*/, "");
    if (cleaned !== text) node.nodeValue = cleaned;
    break;
  }
}

function makeIconOnly(button, icon, label) {
  button.innerHTML = iconMarkup(icon);
  button.classList.add("btn-icon-only");
  button.setAttribute("aria-label", label);
  button.title = label;
}

function decorateButton(button) {
  if (!(button instanceof HTMLElement) || !button.matches("button, a.btn")) return;
  if (button.closest(".user-menu")) return;

  if (button.dataset.inc) {
    makeIconOnly(button, "add", "เพิ่มจำนวน");
    return;
  }

  if (button.dataset.dec) {
    makeIconOnly(button, "minus", "ลดจำนวน");
    return;
  }

  const originalText = button.textContent?.trim() || "";
  if (/^\s*[+＋]\s*(เพิ่ม|add)/i.test(originalText)) stripDuplicateLeadingSymbol(button);

  if (!button.querySelector(".app-icon")) {
    const normalizedText = button.textContent?.trim() || "";
    const icon = buttonIconRules.find(([pattern]) => pattern.test(normalizedText))?.[1] || "";
    if (icon) button.insertAdjacentHTML("afterbegin", iconMarkup(icon));
  }

  const hasIcon = Boolean(button.querySelector(".app-icon"));
  const hasText = Boolean(visibleButtonText(button));
  button.classList.toggle("btn-icon-only", hasIcon && !hasText);

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
  decorateButtons();
  decorateCartHeadings();
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      decorateButtons(node);
      decorateCartHeadings(node);
    } else if (node.parentElement) {
      decorateButton(node.parentElement);
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
