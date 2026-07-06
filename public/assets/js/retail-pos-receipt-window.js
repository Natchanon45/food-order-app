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

function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function money(value) { return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function numberText(value) { return Number(value || 0).toLocaleString('th-TH'); }
function saleKey(sale) { return String(sale?.id || sale?.saleNumber || '').trim(); }
function maskPhone(phone = '') { const digits = String(phone || '').replace(/\D/g, ''); if (digits.length < 7) return digits ? `${digits.slice(0, 2)}***` : ''; return `${digits.slice(0, 3)}-***-${digits.slice(-4)}`; }
function maskName(name = '') { const text = String(name || '').trim(); if (!text) return ''; if (text.length <= 2) return `${text[0] || ''}*`; return `${text.slice(0, 2)}${'*'.repeat(Math.min(5, text.length - 2))}`; }
function taxTitle(sale = {}) { return Number(sale.vatAmount || 0) > 0 || sale.vatRegistered ? 'ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน' : 'ใบเสร็จรับเงิน'; }
function settings() {
  const local = readJson(STORE_SETTINGS_KEY, {});
  const legacy = readJson(LEGACY_STORE_SETTINGS_KEY, {});
  const merged = { ...legacy, ...local };
  return { shopName: merged.taxInvoiceName || merged.shopName || merged.name || 'POS ร้านค้าปลีก', shopAddress: merged.shopAddress || merged.address || '', shopPhone: merged.shopPhone || merged.phone || '', taxId: merged.taxId || merged.shopTaxId || '', taxBranch: merged.taxBranch || merged.branchName || 'สำนักงานใหญ่', logoUrl: merged.logoUrl || merged.shopLogoUrl || '', receiptThanks: merged.receiptThanks || 'ขอบคุณที่ใช้บริการ', receiptFooter: merged.receiptFooter || '' };
}
function findSale() { const sales = readJson(SALES_KEY, []); if (!Array.isArray(sales)) return null; return sales.find(sale => saleKey(sale) === saleId || String(sale.saleNumber || '') === saleId) || sales[0] || null; }
function loyaltyHtml(sale) { const loyalty = sale.loyalty; if (!loyalty) return ''; return `<hr class="rule"><div class="row"><span>แต้มก่อนซื้อ</span><span>${numberText(loyalty.pointsBefore)}</span></div><div class="row"><span>ใช้แต้ม</span><span>${numberText(loyalty.pointsUsed)}</span></div><div class="row"><span>แต้มที่ได้รับ</span><span>${numberText(loyalty.pointsEarned)}</span></div><div class="row"><span>แต้มคงเหลือ</span><strong>${numberText(loyalty.pointsAfter)}</strong></div>`; }
function customerHtml(sale) {
  const name = sale.customerName || sale.customerDisplayName || '';
  const phone = sale.customerPhone || sale.customerDisplayPhone || '';
  if (!name && !phone && !sale.customerCode) return '';
  return `<hr class="rule"><div class="row"><span>ลูกค้า</span><strong>${escapeHtml(maskName(name) || '-')}</strong></div>${sale.customerCode ? `<div class="row"><span>สมาชิก</span><span>${escapeHtml(sale.customerCode)}</span></div>` : ''}${phone ? `<div class="row"><span>โทร</span><span>${escapeHtml(maskPhone(phone))}</span></div>` : ''}`;
}
function itemsHtml(items) { return items.map(item => `<div class="item"><div><strong>${escapeHtml(item.name || item.productName || '-')}</strong><small>${money(item.price)} x ${Number(item.qty || 0).toLocaleString('th-TH')}</small></div><div>${money(item.lineTotal || Number(item.price || 0) * Number(item.qty || 0))}</div></div>`).join(''); }
function vatHtml(sale) {
  const vat = Number(sale.vatAmount || 0);
  if (!vat && !sale.vatRegistered) return '';
  return `<div class="row"><span>ยอดก่อน VAT</span><span>${money(sale.beforeVat ?? sale.taxableBase ?? sale.discountedBase ?? 0)}</span></div><div class="row"><span>VAT ${Number(sale.vatRate || 7).toLocaleString('th-TH')}%</span><span>${money(vat)}</span></div><div class="row"><span>${String(sale.vatMode || 'include') === 'exclude' ? 'ราคาไม่รวม VAT' : 'ราคารวม VAT'}</span><span>-</span></div>`;
}
function render(sale) {
  if (!sale) { root.className = 'missing'; root.textContent = 'ไม่พบบิลที่ต้องการพิมพ์'; return; }
  currentSale = sale;
  const store = settings();
  const items = Array.isArray(sale.items) ? sale.items : [];
  root.className = 'receipt';
  root.innerHTML = `<div class="center">${store.logoUrl ? `<img class="logo" src="${escapeHtml(store.logoUrl)}" alt="">` : ''}<div class="shop">${escapeHtml(store.shopName)}</div>${store.shopAddress ? `<div class="muted">${escapeHtml(store.shopAddress)}</div>` : ''}${store.shopPhone ? `<div class="muted">โทร ${escapeHtml(store.shopPhone)}</div>` : ''}${store.taxId ? `<div class="muted">เลขประจำตัวผู้เสียภาษี ${escapeHtml(store.taxId)}</div>` : ''}${store.taxBranch ? `<div class="muted">${escapeHtml(store.taxBranch)}</div>` : ''}<div class="receipt-title">${taxTitle(sale)}</div></div><hr class="rule"><div class="row"><span>เลขที่</span><strong>${escapeHtml(sale.saleNumber || sale.id || '-')}</strong></div><div class="row"><span>วันที่</span><span>${escapeHtml(new Date(sale.createdAt || Date.now()).toLocaleString('th-TH'))}</span></div><div class="row"><span>ชำระเงิน</span><span>${escapeHtml(sale.paymentMethod || sale.payment?.method || '-')}</span></div>${customerHtml(sale)}<hr class="rule">${itemsHtml(items)}<hr class="rule"><div class="row"><span>รวมสินค้า</span><span>${money(sale.subtotal)}</span></div><div class="row"><span>ส่วนลด</span><span>${money(sale.discount)}</span></div>${Number(sale.pointDiscount || 0) ? `<div class="row"><span>ส่วนลดแต้ม</span><span>${money(sale.pointDiscount)}</span></div>` : ''}${vatHtml(sale)}<div class="row total"><span>ยอดสุทธิ</span><span>${money(sale.totalAmount || sale.total)}</span></div><div class="row"><span>รับเงิน</span><span>${money(sale.receivedAmount || sale.payment?.received || sale.totalAmount || sale.total)}</span></div><div class="row"><span>เงินทอน</span><span>${money(sale.changeAmount || sale.payment?.change || 0)}</span></div>${loyaltyHtml(sale)}${sale.syncStatus === 'pending' ? '<hr class="rule"><div class="center muted">บิลนี้บันทึกแบบออฟไลน์ รอ Sync Firebase</div>' : ''}<hr class="rule"><div class="center muted footer">${escapeHtml(store.receiptThanks)}${store.receiptFooter ? `<br>${escapeHtml(store.receiptFooter)}` : ''}</div>`;
}
function rerenderLatest() { const sale = findSale(); if (sale) render(sale); return sale; }
async function waitForLoyaltyAndRender() { let sale = findSale(); render(sale); const started = Date.now(); while (Date.now() - started < 2500) { await new Promise(resolve => setTimeout(resolve, 180)); sale = rerenderLatest(); if (sale?.loyalty) break; } if (autoPrint) setTimeout(() => window.print(), 250); }
printBtn?.addEventListener('click', () => window.print());
closeBtn?.addEventListener('click', () => window.close());
window.addEventListener('storage', event => { if (event.key === SALES_KEY) rerenderLatest(); });
window.addEventListener('pos:loyalty-updated', rerenderLatest);
waitForLoyaltyAndRender();
