import { auth } from './firebase-config.js?v=20260629-030';
import { RetailCollections, listRecords, saveRecordsStrict, watchRecords, commitTenantRecordsStrict } from './retail-db.js?v=20260629-030';

const SETTINGS_KEY = "retail_pos_loyalty_settings_v1";
const CUSTOMER_KEY = "retail_pos_customers_v1";
const SALES_KEY = "retail_pos_sales_v1";
const LEDGER_KEY = "retail_pos_loyalty_ledger_v1";
const defaults = { enabled: true, spendPerPoint: 10, pointValue: 1 };
const paymentDialog = document.querySelector("#paymentDialog");
const paymentForm = document.querySelector("#paymentDialog .payment-form");
const paymentMethod = document.querySelector("#paymentMethod");
const paymentTotal = document.querySelector("#paymentTotal");
const receivedInput = document.querySelector("#receivedInput");
const discountInput = document.querySelector("#discountInput");
const confirmBtn = document.querySelector("#confirmPaymentBtn");
const changeAmount = document.querySelector("#changeAmount");
let customers = [];
let ledger = [];
let selectedCustomer = null;
let baseDiscount = 0;
let baseTotal = 0;
let redeemPoints = 0;

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function settings() {
  return { ...defaults, ...read(SETTINGS_KEY, {}) };
}

function money(value) {
  return Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function uid() {
  return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `point-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function numberFromText(value) {
  return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
}

function normalizeCustomer(customer) {
  return customer ? { ...customer, id: String(customer._documentId || customer.id || "") } : null;
}

if (paymentForm && paymentMethod && !document.querySelector("#loyaltyBox")) {
  const boxEl = document.createElement("div");
  boxEl.id = "loyaltyBox";
  boxEl.className = "loyalty-box";
  boxEl.hidden = true;
  boxEl.innerHTML = `<div class="loyalty-head"><strong>แต้มสมาชิก</strong><span id="loyaltyBalance">คงเหลือ 0 แต้ม</span></div><div class="loyalty-controls"><input id="loyaltyRedeemInput" type="number" min="0" step="1" value="0" inputmode="numeric" placeholder="จำนวนแต้มที่ใช้"><button id="useAllPointsBtn" class="btn btn-secondary" type="button">ใช้สูงสุด</button></div><small id="loyaltyNote" class="loyalty-note">เลือกสมาชิกเพื่อใช้แต้ม</small>`;
  paymentMethod.closest("label")?.insertAdjacentElement("beforebegin", boxEl);
}

const box = document.querySelector("#loyaltyBox");
const balanceEl = document.querySelector("#loyaltyBalance");
const redeemInput = document.querySelector("#loyaltyRedeemInput");
const useAllBtn = document.querySelector("#useAllPointsBtn");
const note = document.querySelector("#loyaltyNote");

function currentCustomer() {
  if (!selectedCustomer) return null;
  return customers.find(customer => String(customer.id) === String(selectedCustomer.id)) || selectedCustomer;
}

function maxRedeemablePoints() {
  const config = settings();
  const customer = currentCustomer();
  const available = Math.max(0, Math.floor(Number(customer?.points || 0)));
  const byBill = Math.floor(Math.max(0, baseTotal) / Number(config.pointValue || 1));
  return Math.max(0, Math.min(available, byBill));
}

function updatePaymentNumbers() {
  const config = settings();
  const max = maxRedeemablePoints();
  redeemPoints = Math.max(0, Math.min(Math.floor(Number(redeemInput?.value || 0)), max));
  if (redeemInput) redeemInput.value = String(redeemPoints);
  const redeemValue = redeemPoints * Number(config.pointValue || 1);
  discountInput.value = (baseDiscount + redeemValue).toFixed(2);
  discountInput.dispatchEvent(new Event("input", { bubbles: true }));
  const total = Math.max(0, baseTotal - redeemValue);
  paymentTotal.textContent = `${money(total)} บาท`;
  if (paymentMethod.value === "cash") {
    receivedInput.value = total.toFixed(2);
    changeAmount.textContent = "0.00 บาท";
  }
  note.textContent = redeemPoints > 0 ? `ใช้ ${redeemPoints.toLocaleString("th-TH")} แต้ม ลด ${money(redeemValue)} บาท` : `ใช้ได้สูงสุด ${max.toLocaleString("th-TH")} แต้ม`;
}

function resetBox() {
  selectedCustomer = null;
  redeemPoints = 0;
  if (redeemInput) redeemInput.value = "0";
  if (box) box.hidden = true;
  paymentDialog.dataset.loyaltyPoints = "0";
}

function loadCustomer(customer) {
  selectedCustomer = normalizeCustomer(customer);
  const config = settings();
  if (!box) return;
  if (!config.enabled || !selectedCustomer) {
    box.hidden = true;
    redeemPoints = 0;
    if (redeemInput) redeemInput.value = "0";
    return;
  }
  box.hidden = false;
  const latest = currentCustomer();
  balanceEl.textContent = `คงเหลือ ${Math.floor(Number(latest?.points || 0)).toLocaleString("th-TH")} แต้ม`;
  redeemInput.max = String(maxRedeemablePoints());
  redeemInput.value = "0";
  redeemPoints = 0;
  note.textContent = `ซื้อครบ ${money(config.spendPerPoint)} บาท ได้ 1 แต้ม • 1 แต้ม = ${money(config.pointValue)} บาท`;
}

function prepareDialog() {
  baseDiscount = Number(discountInput.value || 0);
  baseTotal = numberFromText(paymentTotal.textContent);
  redeemPoints = 0;
  if (redeemInput) redeemInput.value = "0";
  if (selectedCustomer) loadCustomer(selectedCustomer);
}

function waitForSavedSale(previousSaleId, startedAt, timeout = 1800) {
  return new Promise(resolve => {
    const started = Date.now();
    const check = () => {
      const latest = read(SALES_KEY, [])[0];
      if (latest && latest.id !== previousSaleId && new Date(latest.createdAt).getTime() >= startedAt - 5000) {
        resolve(latest);
        return;
      }
      if (Date.now() - started >= timeout) {
        resolve(null);
        return;
      }
      setTimeout(check, 40);
    };
    check();
  });
}

async function applyLedgerToSale(saleId, customerId, pointsUsed) {
  if (!customerId || !saleId) return false;
  const config = settings();
  const customerIndex = customers.findIndex(customer => String(customer.id) === String(customerId));
  if (customerIndex < 0) return false;
  const sales = read(SALES_KEY, []);
  const sale = sales.find(item => String(item.id) === String(saleId));
  if (!sale || sale.loyalty) return Boolean(sale?.loyalty);

  const earned = config.enabled ? Math.floor(Number(sale.total || 0) / Math.max(0.01, Number(config.spendPerPoint || 10))) : 0;
  const customer = customers[customerIndex];
  const before = Math.max(0, Math.floor(Number(customer.points || 0)));
  const safeUsed = Math.max(0, Math.min(Math.floor(Number(pointsUsed || 0)), before));
  const after = Math.max(0, before - safeUsed + earned);
  const entry = {
    id: uid(),
    customerId: customer.id,
    customerCode: customer.customerCode || "",
    customerName: customer.name || "",
    saleId: sale.id,
    saleNumber: sale.saleNumber || sale.id,
    createdBy: auth?.currentUser?.uid || "",
    createdAt: new Date().toISOString(),
    pointsUsed: safeUsed,
    pointsEarned: earned,
    balanceBefore: before,
    balanceAfter: after,
    redeemValue: safeUsed * Number(config.pointValue || 1)
  };
  const updatedCustomer = { ...customer, points: after, updatedAt: Date.now() };
  const updatedSale = {
    ...sale,
    customerId: sale.customerId || customer.id,
    customerCode: sale.customerCode || customer.customerCode || "",
    customerName: sale.customerName || customer.name,
    customerPhone: sale.customerPhone || customer.phone || "",
    loyalty: {
      pointsBefore: before,
      pointsUsed: safeUsed,
      pointsEarned: earned,
      pointsAfter: after,
      redeemValue: entry.redeemValue
    }
  };

  customers[customerIndex] = updatedCustomer;
  const nextSales = sales.map(item => String(item.id) === String(saleId) ? updatedSale : item);
  ledger = [entry, ...ledger].slice(0, 2000);
  write(CUSTOMER_KEY, customers);
  write(SALES_KEY, nextSales);
  write(LEDGER_KEY, ledger);

  try {
    await commitTenantRecordsStrict([
      { collectionName: RetailCollections.customers, row: updatedCustomer },
      { collectionName: RetailCollections.sales, row: updatedSale },
      { collectionName: RetailCollections.loyaltyLedger, row: entry }
    ]);
  } catch (error) {
    console.warn('[retail-pos-loyalty] firebase save failed', error);
  }

  window.dispatchEvent(new CustomEvent("pos:loyalty-updated", { detail: { customerId: customer.id, saleId: sale.id, pointsAfter: after } }));
  return true;
}

paymentDialog?.addEventListener("pos:customer-change", event => loadCustomer(event.detail?.customer || null));
paymentDialog?.addEventListener("close", () => {
  discountInput.value = baseDiscount.toFixed(2);
  discountInput.dispatchEvent(new Event("input", { bubbles: true }));
  resetBox();
});
document.querySelector("#payBtn")?.addEventListener("click", () => setTimeout(prepareDialog, 0));
redeemInput?.addEventListener("input", updatePaymentNumbers);
useAllBtn?.addEventListener("click", () => { redeemInput.value = String(maxRedeemablePoints()); updatePaymentNumbers(); });
paymentMethod?.addEventListener("change", updatePaymentNumbers);
confirmBtn?.addEventListener("click", () => {
  const startedAt = Date.now();
  const customerId = selectedCustomer?.id || "";
  const used = redeemPoints;
  const previousSaleId = read(SALES_KEY, [])[0]?.id || "";
  paymentDialog.dataset.loyaltyPoints = String(used);
  if (!customerId) return;
  waitForSavedSale(previousSaleId, startedAt).then(sale => {
    if (!sale) {
      console.error("ไม่พบบิลใหม่สำหรับบันทึกแต้ม");
      return;
    }
    applyLedgerToSale(sale.id, customerId, used);
  });
}, true);

customers = read(CUSTOMER_KEY, []);
ledger = read(LEDGER_KEY, []);
const remoteLedger = await listRecords(RetailCollections.loyaltyLedger, { sortBy: 'createdAt', direction: 'desc' });
if (!remoteLedger.length && ledger.length) {
  const createdBy = auth?.currentUser?.uid || "";
  await saveRecordsStrict(RetailCollections.loyaltyLedger, ledger.map(entry => ({ ...entry, createdBy: entry.createdBy || createdBy })));
}
const stopCustomers = watchRecords(RetailCollections.customers, rows => {
  customers = rows.map(normalizeCustomer).filter(Boolean);
  write(CUSTOMER_KEY, customers);
  if (selectedCustomer) loadCustomer(selectedCustomer);
}, { sortBy: 'updatedAt', direction: 'desc' });
const stopLedger = watchRecords(RetailCollections.loyaltyLedger, rows => {
  ledger = rows;
  write(LEDGER_KEY, ledger.slice(0, 2000));
}, { sortBy: 'createdAt', direction: 'desc' });
window.addEventListener('beforeunload', () => { stopCustomers(); stopLedger(); }, { once: true });
