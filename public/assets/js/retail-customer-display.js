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
  paymentQrPanel: document.querySelector('#paymentQrPanel'),
  paymentQrAmount: document.querySelector('#paymentQrAmount'),
  paymentQrVerify: document.querySelector('#paymentQrVerify'),
  paymentQrImage: document.querySelector('#paymentQrImage'),
  paymentQrError: document.querySelector('#paymentQrError'),
  paidState: document.querySelector('#paidState'),
  updatedAt: document.querySelector('#updatedAt'),
  header: document.querySelector('.display-header'),
  headerActions: document.querySelector('#displayHeaderActions'),
  fullscreen: document.querySelector('#customerDisplayFullscreen')
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

function renderPaymentQr(snapshot = {}) {
  const payment = snapshot.paymentQr || null;
  if (!els.paymentQrPanel || !payment || snapshot.status === 'paid') {
    if (els.paymentQrPanel) els.paymentQrPanel.hidden = true;
    return;
  }
  els.paymentQrPanel.hidden = false;
  if (els.paymentQrAmount) els.paymentQrAmount.textContent = `${money(payment.amount)} บาท`;
  const sameOrigin = String(payment.sourceOrigin || '') === location.origin;
  const verified = Boolean(payment.verified && sameOrigin && payment.tenantId && snapshot.tenantId === payment.tenantId);
  if (els.paymentQrVerify) {
    els.paymentQrVerify.textContent = payment.error
      ? 'กรุณารอพนักงานตั้งค่าข้อมูล PromptPay ของร้าน'
      : (payment.accountName || payment.shopName || '-');
    els.paymentQrVerify.dataset.verified = verified ? 'yes' : 'no';
  }
  if (payment.qrImageUrl && !payment.error) {
    els.paymentQrImage.src = payment.qrImageUrl;
    els.paymentQrImage.hidden = false;
    els.paymentQrError.hidden = true;
    els.paymentQrError.textContent = '';
  } else {
    els.paymentQrImage.removeAttribute('src');
    els.paymentQrImage.hidden = true;
    els.paymentQrError.hidden = false;
    els.paymentQrError.textContent = payment.error || 'รอ QR จาก POS';
  }
}

function installPairingCard() {
  if (!els.header || document.querySelector('#displayPairingCard')) return;
  const url = posPairingUrl();
  const card = document.createElement('div');
  card.id = 'displayPairingCard';
  card.className = 'pairing-card pairing-card-compact';
  card.innerHTML = `
    <button class="pairing-toggle" type="button" aria-label="แสดง QR เชื่อมอุปกรณ์" aria-controls="pairingPanel">
      <span class="pairing-mini-icon" aria-hidden="true"><i class="bi bi-qr-code"></i></span>
      <span class="pairing-toggle-copy"><strong>เชื่อมอุปกรณ์</strong></span>
    </button>
    <div id="pairingPanel" class="pairing-panel" aria-label="QR เชื่อมอุปกรณ์ขายเข้าจอนี้">
      <div class="pairing-copy">
        <div class="pairing-label">เชื่อมอุปกรณ์เพื่อขายเข้าจอนี้</div>
        <strong>สแกน QR ด้วยอุปกรณ์</strong>
        <span>จอนี้: ${esc(requestedDisplayId)}</span>
        <small>อุปกรณ์จะเปิด POS และจำจอนี้ไว้ให้อัตโนมัติ</small>
        <a class="pairing-link" href="${esc(url)}" target="_blank" rel="noopener">เปิด POS สำหรับจอนี้</a>
      </div>
      <div class="pairing-qr-wrap">
        <img class="pairing-qr" src="${esc(qrImageUrl(url))}" alt="QR เชื่อมอุปกรณ์กับจอลูกค้า ${esc(requestedDisplayId)}">
        <div class="pairing-display-id">${esc(requestedDisplayId)}</div>
      </div>
    </div>`;
  (els.headerActions || els.header).append(card);
}

function renderFullscreenButton() {
  if (!els.fullscreen) return;
  const active = Boolean(document.fullscreenElement);
  els.fullscreen.setAttribute('aria-label', active ? 'ออกจากเต็มจอ' : 'เปิดเต็มจอ');
  els.fullscreen.innerHTML = `<i class="bi ${active ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'}" aria-hidden="true"></i><span>${active ? 'ออกจากเต็มจอ' : 'เต็มจอ'}</span>`;
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    console.warn('[customer-display] fullscreen unavailable', error);
  }
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
  renderPaymentQr(snapshot);
  els.paidState.hidden = false;
  els.updatedAt.textContent = snapshot.updatedAt ? `อัปเดตล่าสุด ${new Date(snapshot.updatedAt).toLocaleTimeString('th-TH')}` : '';
}

function localSnapshot() {
  return readJson(displayStorageKey(requestedDisplayId), requestedDisplayId === DEFAULT_DISPLAY_ID ? readJson(LEGACY_DISPLAY_KEY, {}) : {});
}

function renderLocal() {
  render(localSnapshot());
}

installPairingCard();
renderFullscreenButton();
els.fullscreen?.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', renderFullscreenButton);
renderLocal();
const stop = watchRecords(DISPLAY_COLLECTION, rows => {
  const snapshot = rows.find(row => String(row.id || row._documentId || row.displayId) === requestedDisplayId) || localSnapshot();
  render(snapshot);
}, { sortBy: 'updatedAt', direction: 'desc' });
window.addEventListener('storage', event => { if (!event.key || event.key === displayStorageKey(requestedDisplayId) || event.key === LEGACY_DISPLAY_KEY) renderLocal(); });
window.addEventListener('beforeunload', stop, { once: true });
