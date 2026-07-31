import { getTenantId } from './retail-db.js?v=20260629-032';
import { getDeviceId, POS_FIRESTORE_VERSION, dateKeyFrom, monthKeyFrom, pendingDocumentNumber } from './retail-pos-firestore-foundation.js?v=20260706-041';
import { showReceipt } from './retail-pos-receipt-modal.js?v=20260731-080';

const PRODUCT_KEY = 'retail_pos_products_v1';
const SALES_KEY = 'retail_pos_sales_v1';
const MOVEMENT_KEY = 'retail_pos_stock_movements_v1';
const CUSTOMER_KEY = 'retail_pos_customers_v1';
const SHIFT_KEY = 'retail_pos_active_shift_v1';
let saving = false;
let clearing = false;

function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function round2(value) { return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100; }
function safeId(prefix) { return globalThis.crypto?.randomUUID ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function localSaleKey(sale) { return String(sale?.id || sale?.saleNumber || ''); }
function movementId(saleId, productId) { return `${saleId}_${productId}`.replace(/[^a-zA-Z0-9_-]/g, '_'); }
function parseMoneyText(text) { return Number(String(text || '').replace(/[^\d.-]/g, '')) || 0; }
function parseMoneyInput(value) { return Number(String(value || '').replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0; }

function currentCartItems() {
  const products = readJson(PRODUCT_KEY, []);
  const byId = new Map(products.map(item => [String(item.id || item.code || ''), item]));
  return [...document.querySelectorAll('#cartList .cart-row')].map(row => {
    const id = row.querySelector('[data-id]')?.dataset?.id || '';
    const product = byId.get(String(id));
    const qty = Number(row.querySelector('.qty-tools strong')?.textContent || 0);
    if (!product || !id || qty <= 0) return null;
    return { ...product, id: String(product.id || id), productId: String(product.id || id), barcode: String(product.barcode || ''), name: product.name || row.querySelector('.cart-name')?.textContent || 'สินค้า', price: Number(product.price || 0), cost: Number.isFinite(Number(product.cost)) ? Number(product.cost) : null, qty, unit: product.unit || 'ชิ้น' };
  }).filter(Boolean);
}

function currentTotals(items) {
  const subtotal = round2(items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0));
  const discount = round2(Math.max(0, Math.min(subtotal, Number(document.querySelector('#discountInput')?.value || 0))));
  const vatModeNode = document.querySelector('#vatMode');
  const vatMode = vatModeNode && !vatModeNode.closest('[hidden]') ? String(vatModeNode.value || 'include') : 'none';
  const vatRate = parseMoneyText(document.querySelector('#vatAmountLabel')?.textContent || '7');
  const discountedBase = round2(Math.max(0, subtotal - discount));
  let beforeVat = discountedBase;
  let vatAmount = 0;
  let total = discountedBase;
  if (vatMode === 'include' && vatRate > 0) { vatAmount = round2(discountedBase * vatRate / (100 + vatRate)); beforeVat = round2(discountedBase - vatAmount); }
  else if (vatMode === 'exclude' && vatRate > 0) { vatAmount = round2(discountedBase * vatRate / 100); total = round2(discountedBase + vatAmount); }
  return { subtotal, discount, pointDiscount: 0, discountedBase, taxableBase: beforeVat, beforeVat, vatAmount, vatRate, vatMode, vatRegistered: vatMode !== 'none', vatCalculationBase: 'after_discount_and_points', total };
}

function buildSale({ saleId, number, method, received, totals, createdAt, items }) {
  const tenantId = getTenantId();
  const customerId = document.querySelector('#paymentDialog')?.dataset.customerId || '';
  const customer = readJson(CUSTOMER_KEY, []).find(item => String(item.id || item._documentId || '') === String(customerId));
  const shift = readJson(SHIFT_KEY, null);
  return { id: saleId, saleNumber: number, localSaleNumber: number, finalSaleNumber: '', runningNumberType: 'SALE', runningNumberStatus: 'pending_sync', tenantId, shopId: tenantId, deviceId: getDeviceId(), schemaVersion: POS_FIRESTORE_VERSION, deleted: false, dateKey: dateKeyFrom(createdAt), monthKey: monthKeyFrom(createdAt), channel: 'retail-pos', orderType: 'pos', status: 'completed', paymentStatus: 'paid', syncStatus: 'pending', createdAt, items: items.map(item => ({ id: item.id, productId: item.id, barcode: item.barcode || '', name: item.name, price: item.price, cost: item.cost, qty: item.qty, unit: item.unit, lineTotal: round2(item.price * item.qty) })), totalQty: items.reduce((sum, item) => sum + item.qty, 0), subtotal: totals.subtotal, discount: totals.discount, pointDiscount: 0, discountedBase: totals.discountedBase, taxableBase: totals.taxableBase, beforeVat: totals.beforeVat, vatAmount: totals.vatAmount, vatRate: totals.vatRate, vatMode: totals.vatMode, vatRegistered: totals.vatRegistered, vatCalculationBase: totals.vatCalculationBase, total: totals.total, totalAmount: totals.total, payment: { method, received, change: Math.max(0, received - totals.total) }, paymentMethod: method, receivedAmount: received, changeAmount: Math.max(0, received - totals.total), customerId: customer?.id || customer?._documentId || '', customerCode: customer?.customerCode || '', customerName: customer?.name || '', customerPhone: customer?.phone || '', shiftId: shift?.id || '', cashierName: shift?.cashierName || '', terminalCode: shift?.terminalCode || '' };
}

function saveLocalSale(sale, items) {
  const saleKey = localSaleKey(sale);
  const existingSales = readJson(SALES_KEY, []);
  const existingSale = saleKey ? existingSales.find(item => localSaleKey(item) === saleKey) : null;
  if (existingSale) {
    const preservedSale = { ...sale, ...existingSale };
    writeJson(SALES_KEY, [preservedSale, ...existingSales.filter(item => localSaleKey(item) !== saleKey)].slice(0, 500));
    window.dispatchEvent(new CustomEvent('retail-pos-sale-saved', { detail: { sale: preservedSale, duplicateLocalSave: true } }));
    return preservedSale;
  }

  const products = readJson(PRODUCT_KEY, []);
  const itemMap = new Map(items.map(item => [String(item.id), item]));
  const movements = [];
  const nextProducts = products.map(product => {
    const sold = itemMap.get(String(product.id || product.code || ''))?.qty || 0;
    if (!sold) return product;
    const before = Number(product.stock || 0);
    const after = before - sold;
    const id = movementId(sale.id, product.id || product.code);
    movements.push({ id, tenantId: sale.tenantId, productId: product.id || product.code, productName: product.name, type: 'sale', direction: 'out', qty: sold, before, after, stockBefore: before, stockAfter: after, note: `ขายสินค้า ${sale.saleNumber}`, referenceType: 'sale', referenceId: sale.id, referenceNumber: sale.saleNumber, createdAt: sale.createdAt });
    return { ...product, stock: after };
  });
  const saleWithStockMark = { ...sale, stockDeductedAt: sale.stockDeductedAt || new Date().toISOString(), stockDeductionStatus: 'deducted' };
  const movementIds = new Set(movements.map(item => String(item.id || '')));
  const existingMovements = readJson(MOVEMENT_KEY, []).filter(item => !movementIds.has(String(item.id || '')));
  writeJson(PRODUCT_KEY, nextProducts);
  writeJson(SALES_KEY, [saleWithStockMark, ...existingSales].slice(0, 500));
  writeJson(MOVEMENT_KEY, [...movements, ...existingMovements].slice(0, 500));
  window.dispatchEvent(new CustomEvent('retail-pos-sale-saved', { detail: { sale: saleWithStockMark } }));
  return saleWithStockMark;
}

function unlockPage() {
  const dialog = document.querySelector('#paymentDialog');
  if (dialog?.open) { try { dialog.close(); } catch { dialog.removeAttribute('open'); } }
  dialog?.removeAttribute('open');
  document.body.style.pointerEvents = '';
  document.documentElement.style.pointerEvents = '';
  document.body.classList.remove('modal-open', 'receipt-modal-open', 'is-receipt-open');
  document.documentElement.classList.remove('modal-open', 'receipt-modal-open', 'is-receipt-open');
}

function setText(selector, value) { const node = document.querySelector(selector); if (node) node.textContent = value; }
function setValue(selector, value) { const node = document.querySelector(selector); if (node) node.value = value; }

function resetCartUi() {
  if (clearing) return;
  clearing = true;
  try {
    const clearButton = document.querySelector('#clearSaleBtn');
    if (clearButton && !clearButton.disabled) clearButton.click();
    document.querySelector('#paymentDialog')?.removeAttribute('data-customer-id');
    setValue('#discountInput', '0');
    setValue('#receivedInput', '');
    const cartList = document.querySelector('#cartList');
    if (cartList) cartList.innerHTML = '';
    const cartEmpty = document.querySelector('#cartEmpty');
    if (cartEmpty) cartEmpty.hidden = false;
    setText('#itemCount', '0 รายการ');
    ['#subtotal', '#beforeVatAmount', '#vatAmount', '#grandTotal'].forEach(sel => setText(sel, '0.00'));
    setText('#paymentTotal', '0.00 บาท');
    setText('#changeAmount', '0.00 บาท');
    setText('#paymentError', '');
    const payBtn = document.querySelector('#payBtn');
    if (payBtn) payBtn.disabled = true;
    document.querySelectorAll('[data-selected-customer], .selected-customer, .loyalty-selected, .customer-selected').forEach(node => { node.textContent = ''; node.hidden = true; });
    window.dispatchEvent(new CustomEvent('retail-pos-ready-for-next-sale'));
    setTimeout(() => document.querySelector('#barcodeInput')?.focus(), 100);
  } finally {
    setTimeout(() => { clearing = false; }, 150);
  }
}

async function safeConfirmPayment(event) {
  const button = event.target?.closest?.('#confirmPaymentBtn');
  if (!button || saving) return;
  const fallbackEnabled = button.dataset.safeConfirmFallback === '1' || document.documentElement.dataset.retailPosSafeConfirm === 'enabled';
  if (!fallbackEnabled) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const items = currentCartItems();
  if (!items.length) return;
  const totals = currentTotals(items);
  const method = document.querySelector('#paymentMethod')?.value || 'cash';
  const enteredReceived = parseMoneyInput(document.querySelector('#receivedInput')?.value);
  const received = method === 'cash' || enteredReceived > 0 ? enteredReceived : totals.total;
  if (received < totals.total) { const error = document.querySelector('#paymentError'); if (error) error.textContent = 'จำนวนเงินที่รับมายังไม่ครบ'; return; }
  saving = true;
  button.disabled = true;
  button.textContent = 'กำลังบันทึก...';
  try {
    const saleId = safeId('sale');
    const createdAt = new Date().toISOString();
    const pendingNumber = pendingDocumentNumber({ type: 'SALE', value: createdAt, stableId: saleId });
    const sale = buildSale({ saleId, number: pendingNumber, method, received, totals, createdAt, items });
    const savedSale = saveLocalSale(sale, items);
    unlockPage();
    resetCartUi();
    await showReceipt(savedSale, { autoPrint: false });
  } catch (error) {
    console.error('[retail-pos-safe-confirm] save failed', error);
    const errorNode = document.querySelector('#paymentError');
    if (errorNode) errorNode.textContent = 'บันทึกการขายไม่สำเร็จ กรุณาลองใหม่';
  } finally {
    saving = false;
    button.disabled = false;
    button.textContent = 'ยืนยันการขาย';
  }
}

document.addEventListener('click', safeConfirmPayment, true);
window.retailPosSafeConfirmFallback = safeConfirmPayment;
window.addEventListener('retail-pos-receipt-closed', () => setTimeout(resetCartUi, 0));
