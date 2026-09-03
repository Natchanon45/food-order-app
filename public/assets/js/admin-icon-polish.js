import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";
import { t } from "./i18n.js?v=20260903-202";

const headingIcons = new Map([
  [t("admin.sales_report.title"), "bar-chart-line"],
  [t("admin.store.section_title"), "building-gear"],
  [t("admin.delivery_fee.title"), "scooter"],
  [t("admin.menu.form_title"), "journal-plus"],
  [t("admin.table.form_title"), "table"],
  [t("admin.menu.sort_title"), "list-ol"],
  [t("admin.menu.list_title"), "fork-knife"],
  [t("admin.table.list_title"), "grid-3x3-gap"],
  [t("admin.delivery_qr.delivery_title"), "qr-code-scan"],
  [t("admin.delivery_qr.takeaway_title"), "bag-check"],
  [t("admin.workspace.modal_default_title"), "pencil-square"],
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
  [t("admin.store.save"), "floppy"],
  [t("admin.menu.save"), "floppy"],
  [t("admin.table.save"), "floppy"],
  [t("admin.menu.remove_image"), "trash3"],
  [t("admin.sales_report.button"), "bar-chart-line"],
  [t("admin.delivery_qr.copy_link"), "clipboard"],
  [t("admin.common.edit"), "pencil-square"],
  [t("admin.common.delete"), "trash3"],
  [t("admin.delivery_qr.print"), "printer"],
  [t("admin.common.close"), "x-lg"],
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
      --admin-icon-fg: #0d6f34;
      --admin-icon-bg: #e8f3ec;
      width: 34px !important;
      height: 34px !important;
      flex: 0 0 34px !important;
      display: inline-grid !important;
      place-items: center !important;
      border-radius: 12px !important;
      background: var(--admin-icon-bg) !important;
      color: var(--admin-icon-fg) !important;
      font-size: 20px !important;
      line-height: 1 !important;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.5);
    }
    .admin-heading-icon::before {
      color: var(--admin-icon-fg) !important;
      line-height: 1 !important;
    }
    [data-admin-icon="shop"] .admin-heading-icon,
    [data-admin-icon="shop-window"] .admin-heading-icon { --admin-icon-fg:#047857; --admin-icon-bg:#d1fae5; }
    [data-admin-icon="qr-code-scan"] .admin-heading-icon { --admin-icon-fg:#0f766e; --admin-icon-bg:#ccfbf1; }
    [data-admin-icon="bar-chart-line"] .admin-heading-icon,
    [data-admin-icon="graph-up-arrow"] .admin-heading-icon { --admin-icon-fg:#15803d; --admin-icon-bg:#dcfce7; }
    [data-admin-icon="building-gear"] .admin-heading-icon,
    [data-admin-icon="buildings"] .admin-heading-icon { --admin-icon-fg:#0369a1; --admin-icon-bg:#e0f2fe; }
    [data-admin-icon="scooter"] .admin-heading-icon { --admin-icon-fg:#c2410c; --admin-icon-bg:#ffedd5; }
    [data-admin-icon="journal-plus"] .admin-heading-icon,
    [data-admin-icon="list-ol"] .admin-heading-icon,
    [data-admin-icon="fork-knife"] .admin-heading-icon { --admin-icon-fg:#b45309; --admin-icon-bg:#fef3c7; }
    [data-admin-icon="table"] .admin-heading-icon,
    [data-admin-icon="grid-3x3-gap"] .admin-heading-icon { --admin-icon-fg:#1d4ed8; --admin-icon-bg:#dbeafe; }
    [data-admin-icon="person-plus"] .admin-heading-icon,
    [data-admin-icon="people"] .admin-heading-icon { --admin-icon-fg:#6d28d9; --admin-icon-bg:#ede9fe; }
    [data-admin-icon="bag-check"] .admin-heading-icon { --admin-icon-fg:#047857; --admin-icon-bg:#d1fae5; }
    [data-admin-icon="credit-card"] .admin-heading-icon,
    [data-admin-icon="receipt"] .admin-heading-icon,
    [data-admin-icon="receipt-cutoff"] .admin-heading-icon { --admin-icon-fg:#0e7490; --admin-icon-bg:#cffafe; }
    [data-admin-icon="calendar-check"] .admin-heading-icon,
    [data-admin-icon="clock-history"] .admin-heading-icon { --admin-icon-fg:#be123c; --admin-icon-bg:#ffe4e6; }
    [data-admin-icon="diagram-3"] .admin-heading-icon,
    [data-admin-icon="trophy"] .admin-heading-icon { --admin-icon-fg:#7c3aed; --admin-icon-bg:#f3e8ff; }
    [data-admin-icon="pencil-square"] .admin-heading-icon { --admin-icon-fg:#475569; --admin-icon-bg:#f1f5f9; }
    .hero h1 .admin-heading-icon {
      --admin-icon-bg: rgba(255,255,255,.16);
      --admin-icon-fg: #fff;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.22);
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
