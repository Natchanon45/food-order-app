import { getTenantId, saveRecord } from './retail-db.js?v=20260629-032';

const DISPLAY_COLLECTION = 'customerDisplays';
const DEFAULT_DISPLAY_ID = 'main-register';
const DISPLAY_KEY_PREFIX = 'retail_pos_customer_display';
const LEGACY_DISPLAY_KEY = 'retail_pos_customer_display_main';
const REGISTER_CONFIG_KEY = 'retail_pos_register_config';
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
  paymentDialog: document.querySelector('#paymentDialog'),
  customerDisplayLink: document.querySelector('a[href^="/pos/customer-display"]')
};

let timer = 0;
let currentCustomer = null;
let cartSequence = 0;
const cartActivity = new Map();

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function safeId(value, fallback = DEFAULT_DISPLAY_ID) {
  const cleaned = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || fallback;
}

function getRegisterConfig() {
  const params = new URLSearchParams(location.search);
  const current = readJson(REGISTER_CONFIG_KEY, {});
  const next = {
    registerId: safeId(params.get('registerId') || current.registerId || DEFAULT_DISPLAY_ID),
    displayId: safeId(params.get('displayId') || current.displayId || current.registerId || DEFAULT_DISPLAY_ID),
    registerName: String(params.get('registerName') || current.registerName || '').trim()
  };
  if (params.has('registerId') || params.has('displayId') || params.has('registerName') || !current.displayId || !current.registerId) {
    writeJson(REGISTER_CONFIG_KEY, next);
  }
  return next;
}

function displayStorageKey(displayId) {
  return displayId === DEFAULT_DISPLAY_ID ? LEGACY_DISPLAY_KEY : `${DISPLAY_KEY_PREFIX}_${displayId}`;
}

function currentSessionId(config) {
  const key = `retail_pos_display_session_${config.registerId}_${config.displayId}`;
  let sessionId = localStorage.getItem(key);
  if (!sessionId) {
    sessionId = `display-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, sessionId);
  }
  return sessionId;
}

function updateDisplayLink(config) {
  if (!els.customerDisplayLink) return;
  els.customerDisplayLink.href = `/pos/customer-display?displayId=${encodeURIComponent(config.displayId)}`;
  els.customerDisplayLink.title = `จอลูกค้า ${config.displayId}`;
  els.customerDisplayLink.setAttribute('aria-label', `จอลูกค้า ${config.displayId}`);
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
  const config = getRegisterConfig();
  updateDisplayLink(config);
  const customerId = els.paymentDialog?.dataset.customerId || '';
  const customer = currentCustomer || customerById(customerId);
  const items = readCartItems();
  return {
    id: config.displayId,
    tenantId: getTenantId(),
    registerId: config.registerId,
    registerName: config.registerName,
    displayId: config.displayId,
    sessionId: currentSessionId(config),
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
  localStorage.setItem(displayStorageKey(snapshot.displayId), JSON.stringify(snapshot));
  if (snapshot.displayId === DEFAULT_DISPLAY_ID) localStorage.setItem(LEGACY_DISPLAY_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent('customer-display:update', { detail: snapshot }));
  try { await saveRecord(DISPLAY_COLLECTION, snapshot); }
  catch (error) { console.warn('[retail-pos-customer-display-sync] save failed', error); }
}

function schedule(status = 'editing') {
  clearTimeout(timer);
  timer = setTimeout(() => publish(status), 180);
}

updateDisplayLink(getRegisterConfig());
if (els.cartPanel) new MutationObserver(() => schedule('editing')).observe(els.cartPanel, { childList: true, subtree: true, characterData: true });
[els.discount, els.vatMode].forEach(element => element?.addEventListener('input', () => schedule('editing')));
els.paymentDialog?.addEventListener('pos:customer-change', event => { currentCustomer = event.detail?.customer || null; schedule('editing'); });
els.paymentDialog?.addEventListener('close', () => schedule('editing'));
document.querySelector('#confirmPaymentBtn')?.addEventListener('click', () => schedule('paid'), true);
window.addEventListener('beforeunload', () => publish('idle'));
schedule('editing');
