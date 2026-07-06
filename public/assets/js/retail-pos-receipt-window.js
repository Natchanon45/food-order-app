const SALES_KEY = 'retail_pos_sales_v1';
const STORE_SETTINGS_KEY = 'retail_pos_store_settings_v1';
const LEGACY_STORE_SETTINGS_KEY = 'food_order_store_settings';

const root = document.querySelector('#receiptRoot');
const printBtn = document.querySelector('#printBtn');
const closeBtn = document.querySelector('#closeBtn');
const params = new URLSearchParams(location.search);
const saleId = params.get('saleId') || '';
const autoPrint = params.get('auto') === '1';
let currentSale = null;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
function money(value) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function numberText(value) {
  return Number(value || 0).toLocaleString('th-TH');
}
function saleKey(sale) {
  return String(sale?.id || sale?.saleNumber || '').trim();
}
function settings() {
  const local = readJson(STORE_SETTINGS_KEY, {});
  const legacy = readJson(LEGACY_STORE_SETTINGS_KEY, {});
  const merged = { ...legacy, ...local };
  return {
    shopName: merged.shopName || merged.name || 'POS ร้านค้าปลีก',
    shopAddress: merged.shopAddress || merged.address || '',
    shopPhone: merged.shopPhone || merged.phone || '',
    taxId: merged.taxId || merged.shopTaxId || '',
    logoUrl: merged.logoUrl || merged.shopLogoUrl || '',
    receiptThanks: merged.receiptThanks || 'ขอบคุณที่ใช้บริการ',
    receiptFooter: merged.receiptFooter || ''
  };
}
function findSale() {
  const sales = readJson(SALES_KEY, []);
  if (!Array.isArray(sales)) return null;
  return sales.find(sale => saleKey(sale) === saleId || String(sale.saleNumber || '') === saleId) || sales[0] || null;
}
function loyaltyHtml(sale) {
  const loyalty = sale.loyalty;
  if (!loyalty) return '';
  return `<hr class="rule"><div class="row"><span>แต้มก่อนซื้อ</span><span>${numberText(loyalty.pointsBefore)}</span></div><div class="row"><span>ใช้แต้ม</span><span>${numberText(loyalty.pointsUsed)}</span></div><div class="row"><span>แต้มที่ได้รับ</span><span>${numberText(loyalty.pointsEarned)}</span></div><div class="row"><span>แต้มคงเหลือ</span><strong>${numberText(loyalty.pointsAfter)}</strong></div>`;
}
function customerHtml(sale) {
  const name = sale.customerName || sale.customerDisplayName || '';
  const phone = sale.customerPhone || sale.customerDisplayPhone || '';
  if (!name && !phone && !sale.customerCode) return '';
  return `<hr class="rule"><div class="row"><span>ลูกค้า</span><strong>${escapeHtml(name || '-')}</strong></div>${sale.customerCode ? `<div class="row"><span>สมาชิก</span><span>${escapeHtml(sale.customerCode)}</span></div>` : ''}${phone ? `<div class="row"><span>โทร</span><span>${escapeHtml(phone)}</span></div>` : ''}`;
}
function render(sale) {
  if (!sale) {
    root.className = 'missing';
    root.textContent = 'ไม่พบบิลที่ต้องการพิมพ์';
    return;
  }
  currentSale = sale;
  const store = settings();
  const items = Array.isArray(sale.items) ? sale.items : [];
  root.className = 'receipt';
  root.innerHTML = `<div class="center">${store.logoUrl ? `<img class="logo" src="${escapeHtml(store.logoUrl)}" alt="">` : ''}<div class="shop">${escapeHtml(store.shopName)}</div>${store.shopAddress ? `<div class="muted">${escapeHtml(store.shopAddress)}</div>` : ''}${store.shopPhone ? `<div class="muted">โทร ${escapeHtml(store.shopPhone)}</div>` : ''}${store.taxId ? `<div class="muted">เลขประจำตัวผู้เสียภาษี ${escapeHtml(store.taxId)}</div>` : ''}<div class="muted">ใบเสร็จรับเงิน</div></div><hr class="rule"><div class="row"><span>เลขที่</span><strong>${escapeHtml(sale.saleNumber || sale.id || '-')}</strong></div><div class="row"><span>วันที่</span><span>${escapeHtml(new Date(sale.createdAt || Date.now()).toLocaleString('th-TH'))}</span></div><div class="row"><span>ชำระเงิน</span><span>${escapeHtml(sale.paymentMethod || sale.payment?.method || '-')}</span></div>${customerHtml(sale)}<hr class="rule">${items.map(item => `<div class="item"><div><strong>${escapeHtml(item.name || item.productName || '-')}</strong><small>${money(item.price)} x ${Number(item.qty || 0).toLocaleString('th-TH')}</small></div><div>${money(item.lineTotal || Number(item.price || 0) * Number(item.qty || 0))}</div></div>`).join('')}<hr class="rule"><div class="row"><span>รวม</span><span>${money(sale.subtotal)}</span></div><div class="row"><span>ส่วนลด</span><span>${money(sale.discount)}</span></div><div class="row total"><span>สุทธิ</span><span>${money(sale.totalAmount || sale.total)}</span></div><div class="row"><span>รับเงิน</span><span>${money(sale.receivedAmount || sale.payment?.received || sale.totalAmount || sale.total)}</span></div><div class="row"><span>เงินทอน</span><span>${money(sale.changeAmount || sale.payment?.change || 0)}</span></div>${loyaltyHtml(sale)}${sale.syncStatus === 'pending' ? '<hr class="rule"><div class="center muted">บิลนี้บันทึกแบบออฟไลน์ รอ Sync Firebase</div>' : ''}<hr class="rule"><div class="center muted footer">${escapeHtml(store.receiptThanks)}${store.receiptFooter ? `<br>${escapeHtml(store.receiptFooter)}` : ''}</div>`;
}
function rerenderLatest() {
  const sale = findSale();
  if (sale && (!currentSale || JSON.stringify(sale.loyalty || {}) !== JSON.stringify(currentSale.loyalty || {}))) render(sale);
  return sale;
}
async function waitForLoyaltyAndRender() {
  let sale = findSale();
  render(sale);
  const started = Date.now();
  while (Date.now() - started < 1800) {
    await new Promise(resolve => setTimeout(resolve, 180));
    sale = rerenderLatest();
    if (sale?.loyalty) break;
  }
  if (autoPrint) setTimeout(() => window.print(), 250);
}

printBtn?.addEventListener('click', () => window.print());
closeBtn?.addEventListener('click', () => window.close());
window.addEventListener('storage', event => { if (event.key === SALES_KEY) rerenderLatest(); });
waitForLoyaltyAndRender();
