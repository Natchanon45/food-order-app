import { createFullTaxInvoiceFromSale, defaultBuyerFromSale, getExistingFullTaxInvoiceForSale, syncPendingTaxInvoices, taxInvoiceUrl } from './retail-pos-full-tax-invoice.js?v=20260708-020';

const SALES_KEY = 'retail_pos_sales_v1';
const STORE_SETTINGS_KEY = 'retail_pos_store_settings_v1';
const LEGACY_STORE_SETTINGS_KEY = 'food_order_store_settings';
const DBD_LOOKUP_URL_KEY = 'retail_pos_dbd_lookup_url';
const TAX_BUYER_DRAFT_PREFIX = 'retail_pos_tax_buyer_draft_';
const DEFAULT_TAX_BUYER_LOOKUP_URL = '/api/tax-buyer/lookup';
const DBD_DATAWAREHOUSE_URL = 'https://datawarehouse.dbd.go.th/juristic';

const root = document.querySelector('#receiptRoot');
const printBtn = document.querySelector('#printBtn');
const closeBtn = document.querySelector('#closeBtn');
const taxInvoiceBtn = document.querySelector('#taxInvoiceBtn');
const dbdLookupBtn = document.querySelector('#dbdLookupBtn');
const taxDialog = document.querySelector('#taxInvoiceDialog');
const taxForm = document.querySelector('#taxInvoiceForm');
const taxCancelBtn = document.querySelector('#taxInvoiceCancelBtn');
const taxError = document.querySelector('#taxInvoiceError');
const buyerNameInput = document.querySelector('#buyerNameInput');
const buyerTaxIdInput = document.querySelector('#buyerTaxIdInput');
const buyerAddressInput = document.querySelector('#buyerAddressInput');
const buyerBranchInput = document.querySelector('#buyerBranchInput');
const params = new URLSearchParams(location.search);
const saleId = params.get('saleId') || '';
const autoPrint = params.get('auto') === '1';
let currentSale = null;

function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function money(value) { return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function numberText(value) { return Number(value || 0).toLocaleString('th-TH'); }
function saleKey(sale) { return String(sale?.id || sale?.saleNumber || '').trim(); }
function normalizeTaxId(value) { return String(value || '').replace(/\D/g, '').slice(0, 13); }
function normalizeText(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function maskPhone(phone = '') { const digits = String(phone || '').replace(/\D/g, ''); if (!digits) return ''; if (digits.length < 10) return digits.length <= 2 ? digits : `${digits.slice(0, 2)}***`; return `${digits.slice(0, 3)}-***-**${digits.slice(-2)}`; }
function firstChars(text, count) { return Array.from(String(text || '')).slice(0, count).join(''); }
function maskFirstName(name = '') { const chars = Array.from(String(name || '').trim()); if (!chars.length) return ''; return `${chars.slice(0, Math.min(5, chars.length)).join('')}*****`; }
function maskLastName(name = '') { const chars = Array.from(String(name || '').trim()); if (!chars.length) return ''; return `*****${chars.slice(Math.max(0, chars.length - 3)).join('')}`; }
function maskName(name = '') {
  const text = String(name || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const parts = text.split(' ').filter(Boolean);
  if (parts.length >= 2) return `${maskFirstName(parts[0])} ${maskLastName(parts.slice(1).join(' '))}`;
  const chars = Array.from(text);
  if (chars.length <= 5) return `${firstChars(text, chars.length)}*****`;
  return `${firstChars(text, 5)}*****`;
}
function taxTitle(sale = {}) { return Number(sale.vatAmount || 0) > 0 || sale.vatRegistered ? 'ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน' : 'ใบเสร็จรับเงิน'; }
function settings() {
  const local = readJson(STORE_SETTINGS_KEY, {});
  const legacy = readJson(LEGACY_STORE_SETTINGS_KEY, {});
  const merged = { ...legacy, ...local };
  return { shopName: merged.taxInvoiceName || merged.shopName || merged.name || 'POS ร้านค้าปลีก', shopAddress: merged.shopAddress || merged.address || '', shopPhone: merged.shopPhone || merged.phone || '', taxId: merged.taxId || merged.shopTaxId || '', taxBranch: merged.taxBranch || merged.branchName || 'สำนักงานใหญ่', logoUrl: merged.logoUrl || merged.shopLogoUrl || '', receiptThanks: merged.receiptThanks || 'ขอบคุณที่ใช้บริการ', receiptFooter: merged.receiptFooter || '' };
}
function findSale() { const sales = readJson(SALES_KEY, []); if (!Array.isArray(sales)) return null; return sales.find(sale => saleKey(sale) === saleId || String(sale.saleNumber || '') === saleId) || sales[0] || null; }
function draftKey() { return `${TAX_BUYER_DRAFT_PREFIX}${saleKey(currentSale) || saleId || 'latest'}`; }
function currentBuyerDraft() { return { buyerName: buyerNameInput.value, buyerTaxId: buyerTaxIdInput.value, buyerAddress: buyerAddressInput.value, buyerBranchName: buyerBranchInput.value }; }
function saveBuyerDraft() { if (currentSale) writeJson(draftKey(), { ...currentBuyerDraft(), updatedAt: Date.now() }); }
function loadBuyerDraft() { return currentSale ? readJson(draftKey(), null) : null; }
function clearBuyerDraft() { if (currentSale) localStorage.removeItem(draftKey()); }
function applyBuyerData(data = {}) { buyerNameInput.value = data.buyerName || ''; buyerTaxIdInput.value = data.buyerTaxId || ''; buyerAddressInput.value = data.buyerAddress || ''; buyerBranchInput.value = data.buyerBranchName || 'สำนักงานใหญ่'; saveBuyerDraft(); }
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
  return `<div class="row"><span>ยอดก่อน VAT</span><span>${money(sale.beforeVat ?? sale.taxableBase ?? sale.discountedBase ?? 0)}</span></div><div class="row"><span>VAT ${Number(sale.vatRate || 7).toLocaleString('th-TH')}%</span><span>${money(vat)}</span></div><div class="row"><span>โหมด VAT</span><span>${String(sale.vatMode || 'include') === 'exclude' ? 'ราคาไม่รวม VAT' : 'ราคารวม VAT'}</span></div>`;
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
function openInvoice(invoice) { window.open(taxInvoiceUrl(invoice, { autoPrint: false }), `pos_tax_invoice_${String(invoice.id).replace(/[^a-zA-Z0-9]/g, '_')}`, 'popup=yes,width=920,height=760,noopener,noreferrer'); }
async function showTaxDialog() {
  if (!currentSale || !taxDialog) return;
  taxInvoiceBtn.disabled = true;
  try {
    await syncPendingTaxInvoices();
    const existing = getExistingFullTaxInvoiceForSale(currentSale);
    if (existing) { openInvoice(existing); return; }
    const defaults = defaultBuyerFromSale(currentSale);
    const draft = loadBuyerDraft();
    applyBuyerData(draft || defaults);
    taxError.innerHTML = '';
    taxDialog.showModal();
    setTimeout(() => buyerTaxIdInput?.focus(), 50);
  } finally {
    taxInvoiceBtn.disabled = false;
  }
}
async function submitTaxDialog() {
  if (!currentSale) return;
  const buyer = currentBuyerDraft();
  taxError.innerHTML = '';
  taxInvoiceBtn.disabled = true;
  try {
    const invoice = await createFullTaxInvoiceFromSale(currentSale, buyer);
    if (invoice) { clearBuyerDraft(); taxDialog?.close(); openInvoice(invoice); }
  } catch (error) { taxError.textContent = error?.message || 'ออกใบกำกับภาษีเต็มรูปแบบไม่สำเร็จ'; }
  finally { taxInvoiceBtn.disabled = false; }
}
function dbdLookupEndpoint() { return window.RETAIL_POS_DBD_LOOKUP_URL || localStorage.getItem(DBD_LOOKUP_URL_KEY) || DEFAULT_TAX_BUYER_LOOKUP_URL; }
function normalizeDbdProfile(data = {}) {
  const source = data.data || data.result || data.profile || data;
  return { buyerName: normalizeText(source.buyerName || source.juristicNameTH || source.juristicName || source.nameTh || source.name || source.companyName || ''), buyerTaxId: normalizeTaxId(source.buyerTaxId || source.juristicId || source.registrationNo || source.taxId || source.id || buyerTaxIdInput.value), buyerAddress: normalizeText(source.buyerAddress || source.addressTh || source.address || source.location || ''), buyerBranchName: normalizeText(source.buyerBranchName || source.branchName || source.branch || 'สำนักงานใหญ่') || 'สำนักงานใหญ่' };
}
function fillBuyerFromDbd(profile) {
  if (profile.buyerTaxId) buyerTaxIdInput.value = profile.buyerTaxId;
  if (profile.buyerName) buyerNameInput.value = profile.buyerName;
  if (profile.buyerAddress) buyerAddressInput.value = profile.buyerAddress;
  if (profile.buyerBranchName) buyerBranchInput.value = profile.buyerBranchName;
  saveBuyerDraft();
}
function manualDbdLink(taxId) { return `${DBD_DATAWAREHOUSE_URL}?keyword=${encodeURIComponent(taxId)}`; }
function showManualDbdMessage(taxId) {
  const url = manualDbdLink(taxId);
  taxError.innerHTML = `ยังดึงข้อมูลอัตโนมัติไม่ได้ ข้อมูลในฟอร์มถูกบันทึกไว้แล้ว<br><button id="copyDbdLinkBtn" class="dbd-btn" type="button" data-url="${escapeHtml(url)}">คัดลอกลิงก์ DBD</button><br><small>นำลิงก์ไปเปิดที่แท็บ DBD เอง แล้วกลับมากรอกต่อใน popup นี้ได้</small>`;
}
async function lookupDbd() {
  const taxId = normalizeTaxId(buyerTaxIdInput.value);
  buyerTaxIdInput.value = taxId;
  saveBuyerDraft();
  taxError.innerHTML = '';
  if (!taxId || taxId.length < 13) { taxError.textContent = 'กรุณากรอกเลขประจำตัวผู้เสียภาษี 13 หลักก่อนกด DBD'; return; }
  dbdLookupBtn.disabled = true;
  dbdLookupBtn.textContent = 'ค้นหา...';
  try {
    const url = new URL(dbdLookupEndpoint(), location.origin);
    url.searchParams.set('taxId', taxId);
    const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('DBD lookup failed');
    const profile = normalizeDbdProfile(await response.json());
    if (!profile.buyerName && !profile.buyerAddress) throw new Error('ไม่พบข้อมูลจาก DBD');
    fillBuyerFromDbd(profile);
    taxError.textContent = 'ดึงข้อมูลสำเร็จ กรุณาตรวจสอบก่อนออกเอกสาร';
  } catch (error) {
    showManualDbdMessage(taxId);
    buyerTaxIdInput.focus();
  } finally {
    dbdLookupBtn.disabled = false;
    dbdLookupBtn.textContent = 'DBD';
  }
}
printBtn?.addEventListener('click', () => window.print());
closeBtn?.addEventListener('click', () => window.close());
taxInvoiceBtn?.addEventListener('click', showTaxDialog);
dbdLookupBtn?.addEventListener('click', lookupDbd);
taxCancelBtn?.addEventListener('click', () => taxDialog?.close());
taxForm?.addEventListener('input', saveBuyerDraft);
taxForm?.addEventListener('click', async event => {
  const button = event.target.closest('#copyDbdLinkBtn');
  if (!button) return;
  event.preventDefault();
  const url = button.dataset.url || manualDbdLink(normalizeTaxId(buyerTaxIdInput.value));
  try { await navigator.clipboard.writeText(url); taxError.innerHTML = 'คัดลอกลิงก์ DBD แล้ว เปิดแท็บ DBD เองแล้วกลับมากรอกต่อได้'; }
  catch { taxError.innerHTML = `คัดลอกลิงก์นี้ไปเปิดเอง: ${escapeHtml(url)}`; }
});
taxForm?.addEventListener('submit', event => { event.preventDefault(); submitTaxDialog(); });
window.addEventListener('storage', event => { if (event.key === SALES_KEY) rerenderLatest(); });
window.addEventListener('pos:loyalty-updated', rerenderLatest);
waitForLoyaltyAndRender();
