import { watchRecords } from './retail-db.js?v=20260629-032';

const DISPLAY_COLLECTION = 'customerDisplays';
const DISPLAY_ID = 'main-register';
const DISPLAY_KEY = 'retail_pos_customer_display_main';

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
  updatedAt: document.querySelector('#updatedAt')
};

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

function render(snapshot = {}) {
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  els.status.textContent = snapshot.updatedAt ? 'เชื่อมต่อแล้ว' : 'รอข้อมูลจาก POS';
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

function renderLocal() {
  render(readJson(DISPLAY_KEY, {}));
}

renderLocal();
const stop = watchRecords(DISPLAY_COLLECTION, rows => {
  const snapshot = rows.find(row => String(row.id || row._documentId) === DISPLAY_ID) || readJson(DISPLAY_KEY, {});
  render(snapshot);
}, { sortBy: 'updatedAt', direction: 'desc' });
window.addEventListener('storage', event => { if (!event.key || event.key === DISPLAY_KEY) renderLocal(); });
window.addEventListener('beforeunload', stop, { once: true });
