const SALES_KEY = "retail_pos_sales_v1";
const PRINT_MODE_KEY = "retail_pos_print_mode_v1";

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
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
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
    <tr>
      <td>${escapeHtml(item.name)}</td>
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
  if (completeDialog?.open) completeDialog.close();
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

  if (printMode.value === "auto") {
    setTimeout(printReceipt, 350);
  }
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
printMode.addEventListener("change", () => {
  localStorage.setItem(PRINT_MODE_KEY, printMode.value);
});

printAndNewBtn?.addEventListener("click", printReceipt);
noPrintNewBtn?.addEventListener("click", closeCompleteDialog);
window.addEventListener("afterprint", closeCompleteDialog);
