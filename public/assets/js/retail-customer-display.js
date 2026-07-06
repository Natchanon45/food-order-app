import { watchRecords } from './retail-db.js?v=20260629-032';

const DISPLAY_COLLECTION = 'customerDisplays';
const DEFAULT_DISPLAY_ID = 'main-register';
const DISPLAY_KEY_PREFIX = 'retail_pos_customer_display';
const LEGACY_DISPLAY_KEY = 'retail_pos_customer_display_main';

const params = new URLSearchParams(location.search);
const requestedDisplayId = safeId(params.get('displayId') || params.get('registerId') || DEFAULT_DISPLAY_ID);

const els = {
  status: document.querySelector('#displayStatus'),
  customerName: document.querySelector('#customerName'),
  customerPhone: document.querySelector('#customerPhone'),
  cartCount: document.querySelector('#cartCount'),
  cartList: document.querySelector('#cartList'),
  subtotal: document.querySelector('#subtotal'),
  discount: document.querySelector('#discount'),
  beforeVat: document.querySelector('#beforeVat'),
  vatAmount: document.querySelector('#vatAmount'),
  vatMode: document.querySelector('#vatMode'),
  grandTotal: document.querySelector('#grandTotal'),
  paidState: document.querySelector('#paidState'),
  updatedAt: document.querySelector('#updatedAt'),
  main: document.querySelector('.display-main')
};

function safeId(value, fallback = DEFAULT_DISPLAY_ID) {
  const cleaned = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || fallback;
}

function displayStorageKey(displayId) {
  return displayId === DEFAULT_DISPLAY_ID ? LEGACY_DISPLAY_KEY : `${DISPLAY_KEY_PREFIX}_${displayId}`;
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function money(value) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function sortItems(items = []) {
  return [...items].sort((a, b) => (Number(b.touchedAt || 0) - Number(a.touchedAt || 0)) || (Number(b.sortIndex || 0) - Number(a.sortIndex || 0)));
}

function registerIdForMobile() {
  const saved = readJson('retail_pos_register_config', {});
  return safeId(params.get('registerId') || saved.registerId || 'iphone-01', 'iphone-01');
}

function posPairingUrl() {
  const url = new URL('/pos', location.origin);
  url.searchParams.set('registerId', registerIdForMobile());
  url.searchParams.set('displayId', requestedDisplayId);
  return url.href;
}

function qrImageUrl(value) {
  const data = encodeURIComponent(value);
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${data}`;
}

function installPairingCard() {
  if (!els.main || document.querySelector('#displayPairingCard')) return;
  const url = posPairingUrl();
  const card = document.createElement('section');
  card.id = 'displayPairingCard';
  card.className = 'pairing-card';
  card.innerHTML = `
    <div class="pairing-copy">
      <div class="pairing-label">เชื่อม iPhone เพื่อขายเข้าจอนี้</div>
      <strong>สแกน QR ด้วย iPhone</strong>
      <span>จอนี้: ${esc(requestedDisplayId)}</span>
      <small>iPhone จะเปิด POS และจำจอนี้ไว้ให้อัตโนมัติ</small>
      <a class="pairing-link" href="${esc(url)}" target="_blank" rel="noopener">เปิด POS สำหรับจอนี้</a>
    </div>
    <div class="pairing-qr-wrap">
      <img class="pairing-qr" src="${esc(qrImageUrl(url))}" alt="QR เชื่อม iPhone กับจอลูกค้า ${esc(requestedDisplayId)}">
      <div class="pairing-display-id">${esc(requestedDisplayId)}</div>
    </div>`;
  els.main.prepend(card);
}

function render(snapshot = {}) {
  const items = sortItems(Array.isArray(snapshot.items) ? snapshot.items : []);
  els.status.textContent = snapshot.updatedAt ? `เชื่อมต่อแล้ว • ${snapshot.displayId || requestedDisplayId}` : `รอข้อมูลจาก ${requestedDisplayId}`;
  els.customerName.textContent = snapshot.customerDisplayName || snapshot.customerName || 'ลูกค้าทั่วไป';
  els.customerPhone.textContent = snapshot.customerDisplayPhone || '';
  els.cartCount.textContent = `${Number(snapshot.itemCount || 0).toLocaleString('th-TH')} รายการ`;
  els.cartList.innerHTML = items.length ? items.map(item => `<article class="cart-item"><div><strong>${esc(item.name)}</strong><small>${esc(item.meta || '')} • จำนวน ${Number(item.qty || 0).toLocaleString('th-TH')}</small></div><div class="cart-item-total">${money(item.total)}</div></article>`).join('') : '<div class="cart-empty">ยังไม่มีสินค้าในบิล</div>';
  els.subtotal.textContent = money(snapshot.subtotal);
  els.discount.textContent = money(snapshot.discount);
  els.beforeVat.textContent = money(snapshot.beforeVat);
  els.vatAmount.textContent = money(snapshot.vatAmount);
  els.vatMode.textContent = snapshot.vatMode === 'exclude' ? 'ราคาไม่รวม VAT' : snapshot.vatMode === 'include' ? 'ราคารวม VAT' : '-';
  els.grandTotal.textContent = money(snapshot.total);
  els.paidState.hidden = snapshot.status !== 'paid';
  els.updatedAt.textContent = snapshot.updatedAt ? `อัปเดตล่าสุด ${new Date(snapshot.updatedAt).toLocaleTimeString('th-TH')}` : '';
}

function localSnapshot() {
  return readJson(displayStorageKey(requestedDisplayId), requestedDisplayId === DEFAULT_DISPLAY_ID ? readJson(LEGACY_DISPLAY_KEY, {}) : {});
}

function renderLocal() {
  render(localSnapshot());
}

installPairingCard();
renderLocal();
const stop = watchRecords(DISPLAY_COLLECTION, rows => {
  const snapshot = rows.find(row => String(row.id || row._documentId || row.displayId) === requestedDisplayId) || localSnapshot();
  render(snapshot);
}, { sortBy: 'updatedAt', direction: 'desc' });
window.addEventListener('storage', event => { if (!event.key || event.key === displayStorageKey(requestedDisplayId) || event.key === LEGACY_DISPLAY_KEY) renderLocal(); });
window.addEventListener('beforeunload', stop, { once: true });
