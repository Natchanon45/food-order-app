const SALES_KEY = "retail_pos_sales_v1";
const PRINT_MODE_KEY = "retail_pos_print_mode_v1";
const STORE_SETTINGS_KEY = "retail_pos_store_settings_v1";
const LEGACY_STORE_SETTINGS_KEY = "food_order_store_settings";

const styleLink = document.createElement("link");
styleLink.rel = "stylesheet";
styleLink.href = "/assets/css/retail-pos-complete.css?v=20260624-5";
document.head.appendChild(styleLink);

document.body.insertAdjacentHTML("beforeend", `
  <dialog id="paymentCompleteDialog" class="complete-dialog">
    <div class="complete-content">
      <div class="complete-icon">✓</div>
      <h2 class="complete-title">รับชำระเงินสำเร็จ</h2>
      <p id="completeSaleId" class="complete-sale-id">-</p>
      <div class="complete-money">
        <div><span>ยอดสุทธิ</span><strong id="completeTotal">0.00 บาท</strong></div>
        <div><span>รับเงิน</span><strong id="completeReceived">0.00 บาท</strong></div>
        <div class="change"><span>เงินทอน</span><strong id="completeChange">0.00 บาท</strong></div>
      </div>
      <label class="complete-setting">การพิมพ์หลังชำระเงิน
        <select id="printMode">
          <option value="ask">ถามก่อนพิมพ์</option>
          <option value="auto">เปิดหน้าพิมพ์อัตโนมัติ</option>
        </select>
      </label>
      <div class="complete-actions">
        <button id="noPrintNewBtn" class="btn btn-secondary" type="button">ไม่พิมพ์ เริ่มบิลใหม่</button>
        <button id="printAndNewBtn" class="btn btn-pay" type="button">พิมพ์ใบเสร็จ</button>
      </div>
    </div>
  </dialog>

  <section id="posPrintReceipt" class="pos-print-receipt">
    <div class="print-head">
      <h1 id="printShopName">ชื่อร้าน</h1>
      <p>ใบเสร็จรับเงิน</p>
    </div>
    <div class="print-shop-info">
      <div id="printShopAddress"></div>
      <div id="printShopPhone"></div>
      <div id="printShopTaxId"></div>
    </div>
    <hr class="print-rule">
    <div class="print-meta">
      <div><span>เลขที่บิล</span><strong id="printSaleId">-</strong></div>
      <div><span>วันที่</span><strong id="printSaleDate">-</strong></div>
      <div><span>พนักงาน</span><strong id="printCashier">-</strong></div>
      <div><span>เครื่อง POS</span><strong id="printTerminal">-</strong></div>
      <div id="printCustomerNameRow" hidden><span>สมาชิก</span><strong id="printCustomerName">-</strong></div>
      <div id="printCustomerPhoneRow" hidden><span>เบอร์โทร</span><strong id="printCustomerPhone">-</strong></div>
      <div><span>ชำระโดย</span><strong id="printPaymentMethod">-</strong></div>
    </div>
    <hr class="print-rule">
    <div class="print-section-title">รายการสินค้า</div>
    <table class="print-items">
      <thead><tr><th>รายการ</th><th class="num">จำนวน</th><th class="num">ราคา</th><th class="num">รวม</th></tr></thead>
      <tbody id="printItems"></tbody>
    </table>
    <hr class="print-rule">
    <div class="print-section-title">สรุปยอด</div>
    <div class="print-summary">
      <div><span>รวมสินค้า</span><strong id="printSubtotal">0.00</strong></div>
      <div><span>ส่วนลด</span><strong id="printDiscount">0.00</strong></div>
      <div class="grand"><span>ยอดรวม</span><strong id="printTotal">0.00</strong></div>
      <div class="received"><span>รับเงิน</span><strong id="printReceived">0.00</strong></div>
      <div class="change"><span>เงินทอน</span><strong id="printChange">0.00</strong></div>
    </div>
    <hr class="print-rule">
    <p id="printThanks" class="print-thanks">ขอบคุณที่ใช้บริการ</p>
    <p id="printFooter" class="print-warning">เอกสารฉบับนี้ออกโดยระบบของร้านตามข้อมูลด้านบน</p>
  </section>
`);

const confirmPaymentBtn = document.querySelector("#confirmPaymentBtn");
const completeDialog = document.querySelector("#paymentCompleteDialog");
const completeSaleId = document.querySelector("#completeSaleId");
const completeTotal = document.querySelector("#completeTotal");
const completeReceived = document.querySelector("#completeReceived");
const completeChange = document.querySelector("#completeChange");
const printMode = document.querySelector("#printMode");
const printAndNewBtn = document.querySelector("#printAndNewBtn");
const noPrintNewBtn = document.querySelector("#noPrintNewBtn");
const barcodeInput = document.querySelector("#barcodeInput");

let saleBeforeConfirm = null;
let activeSale = null;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function readSales() {
  return readJson(SALES_KEY, []);
}

function getStoreSettings() {
  const legacy = readJson(LEGACY_STORE_SETTINGS_KEY, {});
  const settings = readJson(STORE_SETTINGS_KEY, {});
  return {
    shopName: settings.shopName || legacy.shopName || "POS ร้านค้าปลีก",
    shopAddress: settings.shopAddress || legacy.shopAddress || "",
    shopPhone: settings.shopPhone || legacy.shopPhone || "",
    taxId: settings.taxId || legacy.taxId || legacy.shopTaxId || "",
    receiptThanks: settings.receiptThanks || "ขอบคุณที่ใช้บริการ",
    receiptFooter: settings.receiptFooter || "เอกสารฉบับนี้ออกโดยระบบของร้านตามข้อมูลด้านบน"
  };
}

function money(value) {
  return Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function maskPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length < 6) return `${digits.slice(0, 2)}***${digits.slice(-2)}`;
  return `${digits.slice(0, 3)}-xxx-xx${digits.slice(-2)}`;
}

function paymentName(method) {
  return method === "cash" ? "เงินสด" : "PromptPay / โอนเงิน";
}

function latestSaleSnapshot(sale) {
  return readSales().find(item => item.id === sale?.id) || sale;
}

function populateReceipt(sourceSale) {
  const sale = latestSaleSnapshot(sourceSale);
  const settings = getStoreSettings();
  document.querySelector("#printShopName").textContent = settings.shopName;
  document.querySelector("#printShopAddress").textContent = settings.shopAddress;
  document.querySelector("#printShopPhone").textContent = settings.shopPhone ? `โทร ${settings.shopPhone}` : "";
  document.querySelector("#printShopTaxId").textContent = settings.taxId ? `เลขประจำตัวผู้เสียภาษี ${settings.taxId}` : "";
  document.querySelector("#printThanks").textContent = settings.receiptThanks;
  document.querySelector("#printFooter").textContent = settings.receiptFooter;
  document.querySelector("#printSaleId").textContent = sale.id;
  document.querySelector("#printSaleDate").textContent = new Date(sale.createdAt).toLocaleString("th-TH");
  document.querySelector("#printCashier").textContent = sale.cashierName || "-";
  document.querySelector("#printTerminal").textContent = sale.terminalCode || "-";

  const memberName = [sale.customerCode, sale.customerName].filter(Boolean).join(" • ");
  const memberPhone = maskPhone(sale.customerPhone);
  const customerNameRow = document.querySelector("#printCustomerNameRow");
  const customerPhoneRow = document.querySelector("#printCustomerPhoneRow");
  customerNameRow.hidden = !memberName;
  customerPhoneRow.hidden = !memberPhone;
  document.querySelector("#printCustomerName").textContent = memberName || "-";
  document.querySelector("#printCustomerPhone").textContent = memberPhone || "-";

  document.querySelector("#printPaymentMethod").textContent = paymentName(sale.payment?.method);
  document.querySelector("#printItems").innerHTML = (sale.items || []).map(item => `
    <tr>
      <td class="item-name">${escapeHtml(item.name)}</td>
      <td class="num">${Number(item.qty || 0).toLocaleString("th-TH")}</td>
      <td class="num">${money(item.price)}</td>
      <td class="num">${money(Number(item.price || 0) * Number(item.qty || 0))}</td>
    </tr>
  `).join("");
  document.querySelector("#printSubtotal").textContent = money(sale.subtotal);
  document.querySelector("#printDiscount").textContent = money(sale.discount);
  document.querySelector("#printTotal").textContent = money(sale.total);
  document.querySelector("#printReceived").textContent = money(sale.payment?.received);
  document.querySelector("#printChange").textContent = money(sale.payment?.change);
}

function closeCompleteDialog() {
  if (completeDialog.open) completeDialog.close();
  setTimeout(() => barcodeInput?.focus(), 50);
}

async function waitForReceiptFont() {
  if (!document.fonts) return;
  try {
    await document.fonts.load('20px "TH Sarabun PSK Local"', "ทดสอบใบเสร็จรับเงิน");
    await document.fonts.load('700 24px "TH Sarabun PSK Local"', "ยอดรวม รับเงิน เงินทอน");
    await document.fonts.ready;
  } catch (error) {
    console.warn("โหลดฟอนต์ใบเสร็จไม่สำเร็จ ใช้ฟอนต์สำรองแทน", error);
  }
}

async function printReceipt() {
  if (!activeSale) return;
  activeSale = latestSaleSnapshot(activeSale);
  populateReceipt(activeSale);
  await waitForReceiptFont();
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

function showComplete(sale) {
  activeSale = latestSaleSnapshot(sale);
  completeSaleId.textContent = activeSale.id;
  completeTotal.textContent = `${money(activeSale.total)} บาท`;
  completeReceived.textContent = `${money(activeSale.payment?.received)} บาท`;
  completeChange.textContent = `${money(activeSale.payment?.change)} บาท`;
  completeDialog.showModal();
  if (printMode.value === "auto") setTimeout(printReceipt, 350);
}

confirmPaymentBtn?.addEventListener("click", () => {
  saleBeforeConfirm = readSales()[0]?.id || null;
  setTimeout(() => {
    const latest = readSales()[0];
    if (!latest || latest.id === saleBeforeConfirm) return;
    showComplete(latest);
  }, 120);
}, { capture: true });

printMode.value = localStorage.getItem(PRINT_MODE_KEY) || "ask";
printMode.addEventListener("change", () => localStorage.setItem(PRINT_MODE_KEY, printMode.value));
printAndNewBtn.addEventListener("click", printReceipt);
noPrintNewBtn.addEventListener("click", closeCompleteDialog);
window.addEventListener("afterprint", closeCompleteDialog);