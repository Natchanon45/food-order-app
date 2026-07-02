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
  const group = element.dataset.menuGroup;
  if (group && GROUP_ICONS[group]) return GROUP_ICONS[group];
  const haystack = `${element.id || ""} ${visibleText(element)}`;
  return ICON_RULES.find(([pattern]) => pattern.test(haystack))?.[1] || fallback;
}

function addIcon(element, fallback) {
  const generatedIcon = element.querySelector(":scope > .pos-context-icon");
  const authoredIcon = element.querySelector(".bi:not(.pos-context-icon)");
  if (authoredIcon && generatedIcon) generatedIcon.remove();
  if (authoredIcon || generatedIcon || !visibleText(element)) return;
  if (element.matches(".icon-btn, .product-card, .catalog-tab, .sort-row-main, .app-version-badge, .mobile-cart-bar, .qty-tools button, [data-mobile-cart-close]")) return;
  const icon = document.createElement("i");
  icon.className = `bi bi-${iconFor(element, fallback)} pos-context-icon`;
  icon.setAttribute("aria-hidden", "true");
  element.prepend(icon);
  element.dataset.posIconReady = "1";
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

function start() {
  enhance();
  const observer = new MutationObserver(records => records.forEach(record => {
    enhance(record.target);
    record.addedNodes.forEach(node => enhance(node));
  }));
  observer.observe(document.body, { childList: true, characterData: true, subtree: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
