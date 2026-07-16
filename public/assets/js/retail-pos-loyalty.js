import { auth } from './firebase-config.js?v=20260630-073';
import { RetailCollections, listRecords, saveRecordsStrict, watchRecords, commitTenantRecordsStrict } from './retail-db.js?v=20260629-030';

const SETTINGS_KEY = 'retail_pos_loyalty_settings_v1';
const CUSTOMER_KEY = 'retail_pos_customers_v1';
const SALES_KEY = 'retail_pos_sales_v1';
const LEDGER_KEY = 'retail_pos_loyalty_ledger_v1';
const defaults = { enabled: true, spendPerPoint: 10, pointValue: 1 };
const paymentDialog = document.querySelector('#paymentDialog');
const paymentForm = document.querySelector('#paymentDialog .payment-form');
const paymentMethod = document.querySelector('#paymentMethod');
const receivedInput = document.querySelector('#receivedInput');
const discountInput = document.querySelector('#discountInput');
const confirmBtn = document.querySelector('#confirmPaymentBtn');
const changeAmount = document.querySelector('#changeAmount');
let customers = [];
let ledger = [];
let selectedCustomer = null;
let baseDiscount = 0;
let baseTotal = 0;
let redeemPoints = 0;
let pendingLoyalty = { customerId: '', pointsUsed: 0, startedAt: 0 };

function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function settings() { return { ...defaults, ...read(SETTINGS_KEY, {}) }; }
function money(value) { return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function uid() { return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `point-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function numberFromText(value) { return Number(String(value || '').replace(/[^0-9.-]/g, '')) || 0; }
function normalizeCustomer(customer) { return customer ? { ...customer, id: String(customer._documentId || customer.id || '') } : null; }
function customerIdOf(customer) { return String(customer?.id || customer?._documentId || '').trim(); }
function refreshLocalCustomers() { customers = read(CUSTOMER_KEY, customers || []).map(normalizeCustomer).filter(Boolean); return customers; }
function findCustomer(id) { const cid = String(id || '').trim(); if (!cid) return null; refreshLocalCustomers(); return customers.find(customer => customerIdOf(customer) === cid) || null; }

function loyaltyAnchor() { return document.querySelector('.customer-picker') || paymentMethod?.closest('label') || null; }
function ensureLoyaltyBox() {
  if (!paymentForm || !paymentMethod) return null;
  let boxEl = document.querySelector('#loyaltyBox');
  if (!boxEl) {
    boxEl = document.createElement('div');
    boxEl.id = 'loyaltyBox';
    boxEl.className = 'loyalty-box';
    boxEl.hidden = true;
    boxEl.innerHTML = `<div class="loyalty-head"><strong>แต้มสมาชิก</strong><span id="loyaltyBalance">คงเหลือ 0 แต้ม</span></div><div class="loyalty-controls"><input id="loyaltyRedeemInput" type="number" min="0" step="1" value="0" inputmode="numeric" placeholder="จำนวนแต้มที่ใช้"><button id="useAllPointsBtn" class="btn btn-secondary" type="button">ใช้สูงสุด</button></div><small id="loyaltyNote" class="loyalty-note">เลือกสมาชิกเพื่อใช้แต้ม</small>`;
  }
  const anchor = loyaltyAnchor();
  if (anchor && anchor.nextElementSibling !== boxEl) anchor.insertAdjacentElement('afterend', boxEl);
  return boxEl;
}

const box = ensureLoyaltyBox();
const balanceEl = document.querySelector('#loyaltyBalance');
const redeemInput = document.querySelector('#loyaltyRedeemInput');
const useAllBtn = document.querySelector('#useAllPointsBtn');
const note = document.querySelector('#loyaltyNote');

function currentCustomer() {
  if (!selectedCustomer) return null;
  return findCustomer(selectedCustomer.id) || selectedCustomer;
}
function maxRedeemablePoints() {
  const config = settings();
  const customer = currentCustomer();
  const available = Math.max(0, Math.floor(Number(customer?.points || 0)));
  const byBill = Math.floor(Math.max(0, baseTotal) / Number(config.pointValue || 1));
  return Math.max(0, Math.min(available, byBill));
}
function updatePaymentNumbers() {
  ensureLoyaltyBox();
  const config = settings();
  const max = maxRedeemablePoints();
  redeemPoints = Math.max(0, Math.min(Math.floor(Number(redeemInput?.value || 0)), max));
  if (redeemInput) redeemInput.value = String(redeemPoints);
  const redeemValue = redeemPoints * Number(config.pointValue || 1);
  discountInput.value = (baseDiscount + redeemValue).toFixed(2);
  discountInput.dispatchEvent(new Event('input', { bubbles: true }));
  const total = Math.max(0, baseTotal - redeemValue);
  document.querySelector('#paymentTotal').textContent = `${money(total)} บาท`;
  if (paymentMethod.value === 'cash') { receivedInput.value = total.toFixed(2); changeAmount.textContent = '0.00 บาท'; }
  note.textContent = redeemPoints > 0 ? `ใช้ ${redeemPoints.toLocaleString('th-TH')} แต้ม ลด ${money(redeemValue)} บาท` : `ใช้ได้สูงสุด ${max.toLocaleString('th-TH')} แต้ม`;
}
function resetBox() {
  selectedCustomer = null;
  redeemPoints = 0;
  if (redeemInput) redeemInput.value = '0';
  if (box) box.hidden = true;
  if (paymentDialog) paymentDialog.dataset.loyaltyPoints = '0';
}
function loadCustomer(customer) {
  ensureLoyaltyBox();
  selectedCustomer = normalizeCustomer(customer);
  const config = settings();
  if (!box) return;
  if (!config.enabled || !selectedCustomer) { box.hidden = true; redeemPoints = 0; if (redeemInput) redeemInput.value = '0'; return; }
  box.hidden = false;
  const latest = currentCustomer();
  balanceEl.textContent = `คงเหลือ ${Math.floor(Number(latest?.points || 0)).toLocaleString('th-TH')} แต้ม`;
  redeemInput.max = String(maxRedeemablePoints());
  redeemInput.value = '0';
  redeemPoints = 0;
  note.textContent = `ซื้อครบ ${money(config.spendPerPoint)} บาท ได้ 1 แต้ม • 1 แต้ม = ${money(config.pointValue)} บาท`;
}
function prepareDialog() {
  ensureLoyaltyBox();
  baseDiscount = Number(discountInput.value || 0);
  baseTotal = numberFromText(document.querySelector('#paymentTotal')?.textContent);
  redeemPoints = 0;
  if (redeemInput) redeemInput.value = '0';
  if (selectedCustomer) loadCustomer(selectedCustomer);
}

async function applyLedgerToSale(saleId, customerId, pointsUsed) {
  if (!saleId) return false;
  const sales = read(SALES_KEY, []);
  const sale = sales.find(item => String(item.id) === String(saleId));
  const resolvedCustomerId = String(customerId || sale?.customerId || paymentDialog?.dataset.customerId || '').trim();
  if (!sale || !resolvedCustomerId) return false;
  refreshLocalCustomers();
  const customerIndex = customers.findIndex(customer => customerIdOf(customer) === resolvedCustomerId);
  if (customerIndex < 0 || sale.loyalty) return Boolean(sale?.loyalty);

  const config = settings();
  const earnedBase = Math.max(0, Number(sale.totalAmount ?? sale.total ?? 0));
  const earned = config.enabled ? Math.floor(earnedBase / Math.max(0.01, Number(config.spendPerPoint || 10))) : 0;
  const customer = customers[customerIndex];
  const before = Math.max(0, Math.floor(Number(customer.points || 0)));
  const safeUsed = Math.max(0, Math.min(Math.floor(Number(pointsUsed || 0)), before));
  const after = Math.max(0, before - safeUsed + earned);
  const entry = { id: uid(), tenantId: sale.tenantId, shopId: sale.shopId || sale.tenantId, customerId: customer.id, customerCode: customer.customerCode || '', customerName: customer.name || '', saleId: sale.id, saleNumber: sale.saleNumber || sale.id, createdBy: auth?.currentUser?.uid || '', createdAt: new Date().toISOString(), pointsUsed: safeUsed, pointsEarned: earned, balanceBefore: before, balanceAfter: after, redeemValue: safeUsed * Number(config.pointValue || 1) };
  const updatedCustomer = { ...customer, points: after, updatedAt: Date.now() };
  const updatedSale = { ...sale, customerId: sale.customerId || customer.id, customerCode: sale.customerCode || customer.customerCode || '', customerName: sale.customerName || customer.name, customerPhone: sale.customerPhone || customer.phone || '', pointDiscount: Number(sale.pointDiscount || 0) + entry.redeemValue, loyalty: { pointsBefore: before, pointsUsed: safeUsed, pointsEarned: earned, pointsAfter: after, redeemValue: entry.redeemValue } };
  customers[customerIndex] = updatedCustomer;
  const nextSales = sales.map(item => String(item.id) === String(saleId) ? updatedSale : item);
  ledger = [entry, ...read(LEDGER_KEY, ledger || [])].slice(0, 2000);
  write(CUSTOMER_KEY, customers);
  write(SALES_KEY, nextSales);
  write(LEDGER_KEY, ledger);
  window.dispatchEvent(new CustomEvent('pos:loyalty-updated', { detail: { customerId: customer.id, saleId: sale.id, pointsAfter: after, pointsEarned: earned } }));
  const saleAlreadySynced = String(updatedSale.syncStatus || '').toLowerCase() === 'synced' || Boolean(updatedSale.firebaseSyncedAt || updatedSale.syncedAt);
  const rows = [{ collectionName: RetailCollections.customers, row: updatedCustomer }, { collectionName: RetailCollections.loyaltyLedger, row: entry }];
  if (saleAlreadySynced) rows.push({ collectionName: RetailCollections.sales, row: updatedSale });
  commitTenantRecordsStrict(rows).catch(error => console.warn('[retail-pos-loyalty] firebase save failed', error));
  return true;
}

paymentDialog?.addEventListener('pos:customer-change', event => loadCustomer(event.detail?.customer || null));
paymentDialog?.addEventListener('close', () => { discountInput.value = baseDiscount.toFixed(2); discountInput.dispatchEvent(new Event('input', { bubbles: true })); resetBox(); });
document.querySelector('#payBtn')?.addEventListener('click', () => setTimeout(prepareDialog, 0));
redeemInput?.addEventListener('input', updatePaymentNumbers);
useAllBtn?.addEventListener('click', () => { redeemInput.value = String(maxRedeemablePoints()); updatePaymentNumbers(); });
paymentMethod?.addEventListener('change', updatePaymentNumbers);
confirmBtn?.addEventListener('click', () => {
  pendingLoyalty = { customerId: selectedCustomer?.id || paymentDialog?.dataset.customerId || '', pointsUsed: redeemPoints, startedAt: Date.now() };
  if (paymentDialog) paymentDialog.dataset.loyaltyPoints = String(redeemPoints);
}, true);
window.addEventListener('retail-pos-sale-saved', event => {
  const sale = event.detail?.sale;
  if (!sale?.id) return;
  const customerId = pendingLoyalty.customerId || sale.customerId || paymentDialog?.dataset.customerId || '';
  applyLedgerToSale(sale.id, customerId, pendingLoyalty.pointsUsed || 0);
});

customers = read(CUSTOMER_KEY, []).map(normalizeCustomer).filter(Boolean);
ledger = read(LEDGER_KEY, []);
const remoteLedger = await listRecords(RetailCollections.loyaltyLedger, { sortBy: 'createdAt', direction: 'desc' });
if (!remoteLedger.length && ledger.length) { const createdBy = auth?.currentUser?.uid || ''; await saveRecordsStrict(RetailCollections.loyaltyLedger, ledger.map(entry => ({ ...entry, createdBy: entry.createdBy || createdBy }))); }
const stopCustomers = watchRecords(RetailCollections.customers, rows => { customers = rows.map(normalizeCustomer).filter(Boolean); write(CUSTOMER_KEY, customers); if (selectedCustomer) loadCustomer(selectedCustomer); }, { sortBy: 'updatedAt', direction: 'desc' });
const stopLedger = watchRecords(RetailCollections.loyaltyLedger, rows => { ledger = rows; write(LEDGER_KEY, ledger.slice(0, 2000)); }, { sortBy: 'createdAt', direction: 'desc' });
const stopSettings = watchRecords(RetailCollections.settings, rows => { const remoteSettings = rows.find(row => String(row.id) === 'loyalty'); if (remoteSettings) write(SETTINGS_KEY, { ...defaults, ...remoteSettings }); }, { sortBy: 'updatedAt', direction: 'desc' });
window.addEventListener('beforeunload', () => { stopCustomers(); stopLedger(); stopSettings(); }, { once: true });
