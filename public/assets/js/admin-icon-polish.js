import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";

const headingIcons = new Map([
  ["จัดการร้าน", "shop"],
  ["สร้าง QR แยกตามโต๊ะ", "qr-code-scan"],
  ["รายงานยอดขาย", "bar-chart-line"],
  ["ข้อมูลร้านและการรับชำระ", "building-gear"],
  ["ค่าจัดส่ง Delivery", "scooter"],
  ["เพิ่ม/แก้ไขเมนู", "journal-plus"],
  ["เพิ่มโต๊ะ", "table"],
  ["จัดลำดับการแสดงเมนู", "list-ol"],
  ["รายการสินค้า/อาหาร", "fork-knife"],
  ["จัดการโต๊ะ", "grid-3x3-gap"],
  ["สรุปยอดขาย", "graph-up-arrow"],
  ["ยอดขายตามช่องทาง", "diagram-3"],
  ["ยอดขายตามวิธีชำระ", "credit-card"],
  ["ยอดขายรายชั่วโมง", "clock-history"],
  ["เมนูขายดี", "trophy"],
  ["วันที่/เดือนขายดีที่สุด", "calendar-check"],
  ["รายการแยกตามใบเสร็จ", "receipt"],
  ["รายละเอียดใบเสร็จ", "receipt-cutoff"],
  ["สร้างผู้ใช้ใหม่", "person-plus"],
  ["รายการพนักงาน", "people"],
  ["สร้างร้านใหม่", "shop-window"],
  ["รายการร้านค้า", "buildings"],
  ["QR สำหรับสั่ง Delivery", "qr-code-scan"],
  ["QR สำหรับสั่งกลับบ้าน", "bag-check"],
  ["แก้ไขข้อมูล", "pencil-square"]
]);

const buttonIcons = new Map([
  ["ย้อนกลับ", "arrow-left"],
  ["พิมพ์สำหรับวางที่โต๊ะ", "printer"],
  ["บันทึกข้อมูลร้าน", "floppy"],
  ["บันทึกเมนู", "floppy"],
  ["บันทึกโต๊ะ", "floppy"],
  ["สร้างผู้ใช้งาน", "person-plus"],
  ["สร้างร้าน", "shop-window"],
  ["ลบรูป", "trash3"],
  ["รายงาน", "bar-chart-line"],
  ["กลับ", "arrow-left"],
  ["คัดลอกลิงก์", "clipboard"],
  ["จัดกึ่งกลางรูป", "arrows-move"],
  ["รายวัน", "calendar-day"],
  ["รายเดือน", "calendar-month"],
  ["รายปี", "calendar3"],
  ["กำหนดช่วง", "calendar-range"],
  ["ดู", "eye"],
  ["แก้ไข", "pencil-square"],
  ["ลบ", "trash3"],
  ["พิมพ์", "printer"],
  ["ปิด", "x-lg"]
]);

function ensureThemeStyle() {
  if (document.querySelector("#admin-icon-polish-runtime-style")) return;
  const style = document.createElement("style");
  style.id = "admin-icon-polish-runtime-style";
  style.textContent = `
    .admin-heading-icon,
    h1 .admin-heading-icon,
    h2 .admin-heading-icon,
    .hero h1 .admin-heading-icon,
    .section-title h2 .admin-heading-icon {
      color: #159447 !important;
    }
    .admin-heading-icon::before {
      color: #159447 !important;
    }
    .table-list button[data-admin-button-icon] {
      min-width: max-content !important;
      width: auto !important;
      height: auto !important;
      min-height: 38px !important;
      padding: 8px 12px !important;
      border-radius: 10px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 7px !important;
      line-height: 1 !important;
      white-space: nowrap !important;
      aspect-ratio: auto !important;
    }
    .table-list button[data-admin-button-icon] .admin-button-icon {
      width: 17px !important;
      height: 17px !important;
      font-size: 17px !important;
      flex: 0 0 17px !important;
      margin: 0 !important;
    }
    .table-list button[data-admin-button-icon] .admin-button-label {
      display: inline !important;
      position: static !important;
      width: auto !important;
      height: auto !important;
      overflow: visible !important;
      clip: auto !important;
      white-space: nowrap !important;
    }
    @media (max-width: 640px) {
      .table-list button[data-admin-button-icon] {
        width: 38px !important;
        height: 38px !important;
        min-width: 38px !important;
        min-height: 38px !important;
        padding: 0 !important;
        border-radius: 50% !important;
        gap: 0 !important;
        aspect-ratio: 1 / 1 !important;
      }
      .table-list button[data-admin-button-icon] .admin-button-label {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        clip: rect(0 0 0 0) !important;
        white-space: nowrap !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function labelText(button) {
  return button.textContent.trim().replace(/\s+/g, " ");
}

function wrapButtonLabel(button, text) {
  if (button.querySelector(".admin-button-label")) return;
  const existingLabel = [...button.children].find(child =>
    child.tagName === "SPAN" &&
    !child.classList.contains("app-icon") &&
    !child.classList.contains("admin-button-icon")
  );
  if (existingLabel) {
    existingLabel.classList.add("admin-button-label");
    return;
  }
  [...button.childNodes].forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) node.remove();
  });
  button.insertAdjacentHTML("beforeend", `<span class="admin-button-label">${text}</span>`);
}

function decorate(root = document) {
  ensureThemeStyle();

  root.querySelectorAll("h1,h2").forEach(heading => {
    if (heading.querySelector(".admin-heading-icon")) return;

    const name = headingIcons.get(heading.textContent.trim());
    if (!name) return;

    heading.dataset.adminIcon = name;
    heading.insertAdjacentHTML("afterbegin", iconMarkup(name, "admin-heading-icon"));
  });

  root.querySelectorAll("button,.btn").forEach(button => {
    if (button.dataset.adminButtonIcon || button.querySelector(".app-icon,.admin-button-icon")) return;

    const text = labelText(button);
    const name = buttonIcons.get(text);
    if (!name) return;

    button.dataset.adminButtonIcon = name;
    button.insertAdjacentHTML("afterbegin", iconMarkup(name, "admin-button-icon"));
    wrapButtonLabel(button, text);
  });
}

decorate();
new MutationObserver(() => decorate()).observe(document.body, {
  childList: true,
  characterData: true,
  subtree: true
});
