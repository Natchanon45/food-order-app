import { getTenantId, saveRecord } from './retail-db.js?v=20260629-032';

const DISPLAY_COLLECTION = 'customerDisplays';
const DISPLAY_ID = 'main-register';
const DISPLAY_KEY = 'retail_pos_customer_display_main';
const CUSTOMER_KEY = 'retail_pos_customers_v1';

const els = {
  cartPanel: document.querySelector('.cart-panel'),
  cartList: document.querySelector('#cartList'),
  itemCount: document.querySelector('#itemCount'),
  subtotal: document.querySelector('#subtotal'),
  discount: document.querySelector('#discountInput'),
  vatMode: document.querySelector('#vatMode'),
  beforeVat: document.querySelector('#beforeVatAmount'),
  vatAmount: document.querySelector('#vatAmount'),
  grandTotal: document.querySelector('#grandTotal'),
  paymentDialog: document.querySelector('#paymentDialog')
};

let timer = 0;
let currentCustomer = null;
let cartSequence = 0;
const cartActivity = new Map();

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function numberFromText(value) {
  return Number(String(value || '0').replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0;
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return `${digits.slice(0, 1)}***`;
  if (digits.length < 10) return `${digits.slice(0, 2)}xxx${digits.slice(-2)}`;
  return `${digits.slice(0, 3)}-xxx-xx${digits.slice(-2)}`;
}

function customerById(id) {
  if (!id) return null;
  return readJson(CUSTOMER_KEY, []).find(row => String(row.id || row._documentId || '') === String(id)) || null;
}

function itemKey(row, name, meta) {
  const id = row.querySelector('[data-id]')?.dataset?.id || '';
  return String(id || `${name}|${meta}`).trim();
}

function touchCartItem(key, signature, index) {
  const current = cartActivity.get(key);
  if (!current || current.signature !== signature) {
    const touchedAt = ++cartSequence;
    cartActivity.set(key, { signature, touchedAt, index });
    return touchedAt;
  }
  cartActivity.set(key, { ...current, index });
  return current.touchedAt;
}

function pruneCartActivity(keys) {
  const active = new Set(keys);
  [...cartActivity.keys()].forEach(key => {
    if (!active.has(key)) cartActivity.delete(key);
  });
}

function readCartItems() {
  const activeKeys = [];
  const items = [...document.querySelectorAll('#cartList .cart-row')].map((row, index) => {
    const name = row.querySelector('.cart-name')?.textContent?.trim() || '-';
    const meta = row.querySelector('.cart-meta')?.textContent?.trim() || '';
    const qty = numberFromText(row.querySelector('.qty-tools strong')?.textContent || 0);
    const total = numberFromText(row.querySelector('.line-total')?.textContent || 0);
    const key = itemKey(row, name, meta);
    const signature = `${qty}|${total}|${name}|${meta}`;
    const touchedAt = touchCartItem(key, signature, index);
    activeKeys.push(key);
    return { name, meta, qty, total, sortIndex: index, touchedAt };
  });
  pruneCartActivity(activeKeys);
  return items.sort((a, b) => (b.touchedAt || 0) - (a.touchedAt || 0) || (b.sortIndex || 0) - (a.sortIndex || 0));
}

function buildSnapshot(status = 'editing') {
  const customerId = els.paymentDialog?.dataset.customerId || '';
  const customer = currentCustomer || customerById(customerId);
  const items = readCartItems();
  return {
    id: DISPLAY_ID,
    tenantId: getTenantId(),
    registerId: DISPLAY_ID,
    status,
    customerId: customer?.id || customerId || '',
    customerName: customer?.name || '',
    customerPhone: customer?.phone || '',
    customerDisplayName: customer?.name || '',
    customerDisplayPhone: maskPhone(customer?.phone || ''),
    itemCount: items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    items,
    subtotal: numberFromText(els.subtotal?.textContent),
    discount: numberFromText(els.discount?.value),
    vatMode: els.vatMode?.value || 'none',
    beforeVat: numberFromText(els.beforeVat?.textContent),
    vatAmount: numberFromText(els.vatAmount?.textContent),
    total: numberFromText(els.grandTotal?.textContent),
    updatedAt: Date.now()
  };
}

async function publish(status = 'editing') {
  const snapshot = buildSnapshot(status);
  localStorage.setItem(DISPLAY_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent('customer-display:update', { detail: snapshot }));
  try { await saveRecord(DISPLAY_COLLECTION, snapshot); }
  catch (error) { console.warn('[retail-pos-customer-display-sync] save failed', error); }
}

function schedule(status = 'editing') {
  clearTimeout(timer);
  timer = setTimeout(() => publish(status), 180);
}

if (els.cartPanel) new MutationObserver(() => schedule('editing')).observe(els.cartPanel, { childList: true, subtree: true, characterData: true });
[els.discount, els.vatMode].forEach(element => element?.addEventListener('input', () => schedule('editing')));
els.paymentDialog?.addEventListener('pos:customer-change', event => { currentCustomer = event.detail?.customer || null; schedule('editing'); });
els.paymentDialog?.addEventListener('close', () => schedule('editing'));
document.querySelector('#confirmPaymentBtn')?.addEventListener('click', () => schedule('paid'), true);
window.addEventListener('beforeunload', () => publish('idle'));
schedule('editing');
