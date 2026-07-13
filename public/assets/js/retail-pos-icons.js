import { logout } from "./retail-pos-auth.js?v=20260704-004";

const ICON_RULES = [
  [/ออกจากระบบ|logout/i, "box-arrow-right"],
  [/เข้าสู่ระบบ|login/i, "box-arrow-in-right"],
  [/ผู้ใช้|บัญชี|พนักงาน|สมาชิก|ลูกค้า/i, "people"],
  [/สิทธิ์|บทบาท|permission|role/i, "shield-lock"],
  [/ตั้งค่า|setting/i, "gear"],
  [/สำรอง|backup/i, "database-down"],
  [/กู้คืน|restore/i, "database-up"],
  [/ดาวน์โหลด|ส่งออก|export/i, "download"],
  [/อัปโหลด|นำเข้า|import/i, "upload"],
  [/พิมพ์|print/i, "printer"],
  [/สแกน|บาร์โค้ด|barcode/i, "upc-scan"],
  [/ใบเสร็จ|บิล|receipt/i, "receipt"],
  [/ชำระ|จ่าย|pay/i, "credit-card"],
  [/ขาย|หน้าขาย|sale/i, "cart3"],
  [/คืนสินค้า|คืนเงิน|return/i, "arrow-counterclockwise"],
  [/พักบิล|hold/i, "pause-circle"],
  [/กะพนักงาน|เปิดกะ|ปิดกะ|shift/i, "clock-history"],
  [/ตรวจนับ|count/i, "clipboard-check"],
  [/เคลื่อนไหวสต็อก|movement/i, "arrow-left-right"],
  [/สินค้า|สต็อก|product|stock/i, "box-seam"],
  [/รับสินค้า|จัดซื้อ|purchase/i, "truck"],
  [/เจ้าหนี้|payable/i, "cash-stack"],
  [/ผู้จำหน่าย|supplier/i, "building"],
  [/รายงาน|ประวัติ|history|report/i, "bar-chart-line"],
  [/ค้นหา|search/i, "search"],
  [/เพิ่ม|สร้าง|ใหม่|add|create/i, "plus-lg"],
  [/แก้ไข|edit/i, "pencil-square"],
  [/บันทึก|save/i, "floppy"],
  [/ยืนยัน|ตกลง|confirm/i, "check-lg"],
  [/รีเฟรช|โหลดใหม่|refresh/i, "arrow-clockwise"],
  [/ล้าง|ลบ|delete|clear/i, "trash3"],
  [/ยกเลิก|ปิด|cancel|close/i, "x-lg"],
  [/ย้อนกลับ|กลับ|back/i, "arrow-left"],
  [/ถัดไป|next/i, "arrow-right"],
  [/เมนู|menu/i, "list"],
  [/ระบบ|system/i, "sliders"],
  [/รายละเอียด|ดู|แสดง|ซ่อน|view/i, "eye"],
];

const ACTION_ICON_RULES = [
  [/เปิดกะ(?:และเริ่มขาย)?|เริ่มขาย/i, "play-circle"],
  [/เพิ่ม|สร้าง|ใหม่|add|create/i, "plus-lg"],
  [/บันทึก|save/i, "floppy"],
  [/คืนค่าเริ่มต้น|รีเซ็ต|รีเฟรช|โหลดใหม่|reload|refresh|reset/i, "arrow-clockwise"],
  [/ค้นหา|search/i, "search"],
  [/เดือนนี้|วันนี้|เลือกวันที่|ช่วงวันที่/i, "calendar3"],
  [/ทั้งหมด/i, "x-circle"],
  [/ล้าง|ยกเลิก|ปิด|clear|cancel|close/i, "x-lg"],
  [/ลบ|delete/i, "trash3"],
  [/แก้ไข|edit/i, "pencil-square"],
];

const GROUP_ICONS = {
  sales: "cart3",
  stock: "boxes",
  purchase: "truck",
  customer: "people",
  system: "gear",
};

const ICON_TARGET_SELECTOR = "button, a.btn, a.header-link, .pos-menu-link, h1, h2, h3, .app-title > div > strong";

function visibleText(element) {
  return (element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim();
}

function iconFor(element, fallback = "circle") {
  const explicit = element.dataset.posIcon;
  if (explicit) return explicit;
  if (element.matches("button, a.btn, a.header-link, .pos-menu-link")) {
    const actionIcon = ACTION_ICON_RULES.find(([pattern]) => pattern.test(visibleText(element)))?.[1];
    if (actionIcon) return actionIcon;
  }
  const group = element.dataset.menuGroup;
  if (group && GROUP_ICONS[group]) return GROUP_ICONS[group];
  const haystack = `${element.id || ""} ${visibleText(element)}`;
  return ICON_RULES.find(([pattern]) => pattern.test(haystack))?.[1] || fallback;
}

function shouldSkipIcon(element) {
  if (element.closest(".receipt, .receipt-header, .tax-paper, .tax-title, .qr-ticket, .print-document, .document-page, .print-page, .invoice, .quotation, .customer-sale-receipt, .return-receipt")) return true;
  if (element.matches(".icon-btn, .pos-menu-title, .pos-menu-head h2, .pos-menu-group > button, [data-menu-group], .product-card, .catalog-tab, .sort-row-main, .app-version-badge, .mobile-cart-bar, .qty-tools button, [data-mobile-cart-close]")) return true;
  return element.closest(".pos-menu-head") && visibleText(element) === "เมนู POS";
}

function normalizeIconStack(element) {
  const generated = [...element.querySelectorAll(":scope > .pos-context-icon")];
  if (generated.length > 1) generated.slice(1).forEach(icon => icon.remove());
  const leadingIcons = [...element.querySelectorAll(":scope > i.bi, :scope > .app-icon, :scope > .pos-context-icon")];
  if (leadingIcons.length > 1) {
    const keepAuthored = leadingIcons.find(icon => !icon.classList.contains("pos-context-icon"));
    if (keepAuthored) generated.forEach(icon => icon.remove());
    else leadingIcons.slice(1).forEach(icon => icon.remove());
  }
}

function addIcon(element, fallback) {
  const generatedIcon = element.querySelector(":scope > .pos-context-icon");
  const authoredIcon = element.querySelector(".bi:not(.pos-context-icon)");
  if (authoredIcon && generatedIcon) generatedIcon.remove();
  if (shouldSkipIcon(element)) {
    if (generatedIcon) generatedIcon.remove();
    if (element.matches("[data-menu-group]")) element.removeAttribute("data-pos-icon");
    element.removeAttribute("data-pos-icon-ready");
    return;
  }
  if (authoredIcon || generatedIcon || !visibleText(element)) {
    normalizeIconStack(element);
    return;
  }
  const icon = document.createElement("i");
  icon.className = `bi bi-${iconFor(element, fallback)} pos-context-icon`;
  icon.setAttribute("aria-hidden", "true");
  element.prepend(icon);
  element.dataset.posIconReady = "1";
  normalizeIconStack(element);
}

function enhance(root = document) {
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  const scope = root.nodeType === Node.ELEMENT_NODE
    ? [...(root.matches(ICON_TARGET_SELECTOR) ? [root] : []), ...root.querySelectorAll(ICON_TARGET_SELECTOR)]
    : [...root.querySelectorAll(ICON_TARGET_SELECTOR)];
  scope.forEach(element => {
    if (element.matches("button, a.btn, a.header-link, .pos-menu-link")) addIcon(element, "cursor");
    else addIcon(element, "bookmark-star");
  });
}

function forceUnifiedLogout() {
  document.addEventListener("click", async event => {
    const logoutButton = event.target.closest("#posLogoutBtn");
    if (!logoutButton) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    await logout();
    location.replace("/login/?next=%2Fpos%2F");
  }, true);
}

function start() {
  forceUnifiedLogout();
  enhance();
  const observer = new MutationObserver(records => records.forEach(record => {
    enhance(record.target);
    record.addedNodes.forEach(node => enhance(node));
  }));
  observer.observe(document.body, { childList: true, characterData: true, subtree: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
