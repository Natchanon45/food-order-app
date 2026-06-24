const SALES_KEY = "retail_pos_sales_v1";
const PRINT_MODE_KEY = "retail_pos_print_mode_v1";

const styleLink = document.createElement("link");
styleLink.rel = "stylesheet";
styleLink.href = "/assets/css/retail-pos-complete.css?v=20260624-1";
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
    <div class="print-head"><h1>POS ร้านค้าปลีก</h1><p>ใบเสร็จรับเงิน</p></div>
    <div class="print-meta">
      <div><span>เลขที่บิล</span><strong id="printSaleId">-</strong></div>
      <div><span>วันที่</span><strong id="printSaleDate">-</strong></div>
      <div><span>ชำระโดย</span><strong id="printPaymentMethod">-</strong></div>
    </div>
    <table class="print-items">
      <thead><tr><th>รายการ</th><th class="num">จำนวน</th><th class="num">ราคา</th><th class="num">รวม</th></tr></thead>
      <tbody id="printItems"></tbody>
    </table>
    <div class="print-summary">
      <div><span>รวมสินค้า</span><strong id="printSubtotal">0.00</strong></div>
      <div><span>ส่วนลด</span><strong id="printDiscount">0.00</strong></div>
      <div class="grand"><span>ยอดสุทธิ</span><strong id="printTotal">0.00</strong></div>
      <div><span>รับเงิน</span><strong id="printReceived">0.00</strong></div>
      <div><span>เงินทอน</span><strong id="printChange">0.00</strong></div>
    </div>
    <p class="print-thanks">ขอบคุณที่ใช้บริการ</p>
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

function readSales() {
  try { return JSON.parse(localStorage.getItem(SALES_KEY)) || []; }
  catch { return []; }
}

function money(value) {
  return Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function paymentName(method) {
  return method === "cash" ? "เงินสด" : "PromptPay / โอนเงิน";
}

function populateReceipt(sale) {
  document.querySelector("#printSaleId").textContent = sale.id;
  document.querySelector("#printSaleDate").textContent = new Date(sale.createdAt).toLocaleString("th-TH");
  document.querySelector("#printPaymentMethod").textContent = paymentName(sale.payment?.method);
  document.querySelector("#printItems").innerHTML = (sale.items || []).map(item => `
    <tr><td>${escapeHtml(item.name)}</td><td class="num">${Number(item.qty || 0).toLocaleString("th-TH")}</td><td class="num">${money(item.price)}</td><td class="num">${money(Number(item.price || 0) * Number(item.qty || 0))}</td></tr>
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

function printReceipt() {
  if (!activeSale) return;
  populateReceipt(activeSale);
  window.print();
}

function showComplete(sale) {
  activeSale = sale;
  completeSaleId.textContent = sale.id;
  completeTotal.textContent = `${money(sale.total)} บาท`;
  completeReceived.textContent = `${money(sale.payment?.received)} บาท`;
  completeChange.textContent = `${money(sale.payment?.change)} บาท`;
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
