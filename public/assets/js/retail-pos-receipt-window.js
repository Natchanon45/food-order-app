import { createFullTaxInvoiceFromSale, defaultBuyerFromSale, getExistingFullTaxInvoiceForSale, syncPendingTaxInvoices, taxInvoiceUrl } from './retail-pos-full-tax-invoice.js?v=20260731-080';
import { maskReceiptCustomerName, maskReceiptPhone } from './retail-receipt-privacy.js?v=20260716-002';
import { getRecord } from './retail-db.js?v=20260629-032';

const SALES_KEY = 'retail_pos_sales_v1';
const CUSTOMER_KEY = 'retail_pos_customers_v1';
const LEDGER_KEY = 'retail_pos_loyalty_ledger_v1';
const STORE_SETTINGS_KEY = 'retail_pos_store_settings_v1';
const LEGACY_STORE_SETTINGS_KEY = 'food_order_store_settings';
const DBD_LOOKUP_URL_KEY = 'retail_pos_dbd_lookup_url';
const TAX_BUYER_DRAFT_PREFIX = 'retail_pos_tax_buyer_draft_';
const TAX_INVOICE_LOCAL_KEY = 'retail_pos_tax_invoices_v1';
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
const taxInvoiceId = params.get('taxInvoiceId') || params.get('invoiceId') || '';
const autoPrint = params.get('auto') === '1';
const requestedPaperSize = params.get('paper') || '';
let currentSale = null;
let printReady = false;
let printReadyPromise = null;

function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function money(value) { return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function numberText(value) { return Number(value || 0).toLocaleString('th-TH'); }
function iconLabel(iconPath, label) { return `<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">${iconPath}</svg><span>${escapeHtml(label)}</span>`; }
function setButtonIconLabel(button, iconPath, label) { if (button) button.innerHTML = iconLabel(iconPath, label); }
const ICON_SEARCH = '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>';
const ICON_HOURGLASS = '<path d="M6 2h12"/><path d="M6 22h12"/><path d="M17 2v6.2a2 2 0 0 1-.6 1.4L14 12l2.4 2.4a2 2 0 0 1 .6 1.4V22"/><path d="M7 2v6.2a2 2 0 0 0 .6 1.4L10 12l-2.4 2.4a2 2 0 0 0-.6 1.4V22"/>';
function saleKey(sale) { return String(sale?.id || sale?.saleNumber || '').trim(); }
function normalizeTaxId(value) { return String(value || '').replace(/\D/g, '').slice(0, 13); }
function normalizeText(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function taxTitle(sale = {}) { return Number(sale.vatAmount || 0) > 0 || sale.vatRegistered ? 'ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน' : 'ใบเสร็จรับเงิน'; }
function settings() {
  const local = readJson(STORE_SETTINGS_KEY, {});
  const legacy = readJson(LEGACY_STORE_SETTINGS_KEY, {});
  const merged = { ...legacy, ...local };
  return { shopName: merged.taxInvoiceName || merged.shopName || merged.name || 'POS ร้านค้าปลีก', shopAddress: merged.shopAddress || merged.address || '', shopPhone: merged.shopPhone || merged.phone || '', taxId: merged.taxId || merged.shopTaxId || '', taxBranch: merged.taxBranch || merged.branchName || 'สำนักงานใหญ่', logoUrl: merged.logoUrl || merged.shopLogoUrl || '', receiptThanks: merged.receiptThanks || 'ขอบคุณที่ใช้บริการ', receiptFooter: merged.receiptFooter || '', receiptPaperSize: ['58', '80', 'a4'].includes(String(merged.receiptPaperSize || '')) ? String(merged.receiptPaperSize) : '80' };
}
function applyPaperSize() {
  const paperSize = ['58', '80', 'a4'].includes(requestedPaperSize) ? requestedPaperSize : settings().receiptPaperSize;
  document.documentElement.dataset.receiptPaper = paperSize;
  const width = paperSize === '58' ? '58mm' : paperSize === 'a4' ? '210mm' : '80mm';
  const pageMargin = paperSize === 'a4' ? '12mm' : '0';
  const style = document.createElement('style');
  style.dataset.receiptPaperStyle = 'true';
  style.textContent = `@media print{.receipt{width:${width}!important;max-width:${paperSize === 'a4' ? '186mm' : 'none'}!important}@page{size:${paperSize === 'a4' ? 'A4' : `${width} auto`};margin:${pageMargin}}}`;
  document.head.appendChild(style);
  if (root) root.style.width = width;
}
function customers() { const rows = readJson(CUSTOMER_KEY, []); return Array.isArray(rows) ? rows : []; }
function loyaltyLedger() { const rows = readJson(LEDGER_KEY, []); return Array.isArray(rows) ? rows : []; }
function localSales() { const rows = readJson(SALES_KEY, []); return Array.isArray(rows) ? rows : []; }
function findLocalSale() {
  const sales = localSales();
  if (!saleId) return sales[0] || null;
  return sales.find(sale => saleKey(sale) === saleId || String(sale.saleNumber || '') === saleId) || null;
}
function cacheResolvedSale(sale) {
  if (!sale) return null;
  const key = saleKey(sale);
  const rows = localSales().filter(row => saleKey(row) !== key && String(row.saleNumber || '') !== String(sale.saleNumber || ''));
  rows.unshift(sale);
  writeJson(SALES_KEY, rows.slice(0, 500));
  return sale;
}
async function fetchFirestoreSale() {
  if (!saleId || navigator.onLine === false) return null;
  try {
    return cacheResolvedSale(await getRecord('sales', saleId));
  } catch (error) {
    console.warn('[retail-pos-receipt-window] firestore sale fallback', error);
    return null;
  }
}
function saleFromTaxInvoice(invoice = {}) {
  if (!invoice || typeof invoice !== 'object') return null;
  const sourceSale = invoice.sourceSale && typeof invoice.sourceSale === 'object' ? invoice.sourceSale : {};
  const buyer = invoice.buyer && typeof invoice.buyer === 'object' ? invoice.buyer : {};
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const resolvedId = String(invoice.saleId || sourceSale.id || saleId || '').trim();
  const resolvedNumber = String(invoice.saleNumber || sourceSale.saleNumber || '').trim();
  if (!resolvedId && !resolvedNumber && !items.length) return null;
  return {
    ...sourceSale,
    id: resolvedId || resolvedNumber,
    saleId: resolvedId || resolvedNumber,
    saleNumber: resolvedNumber || resolvedId,
    createdAt: sourceSale.createdAt || invoice.issuedAt || invoice.createdAt || Date.now(),
    customerCode: invoice.buyerProfileId || buyer.customerKey || sourceSale.customerCode || '',
    customerName: buyer.buyerName || sourceSale.customerName || '',
    customerDisplayName: buyer.buyerName || sourceSale.customerDisplayName || '',
    customerPhone: sourceSale.customerPhone || '',
    customerDisplayPhone: sourceSale.customerDisplayPhone || '',
    items,
    subtotal: Number(invoice.subtotal || 0),
    discount: Number(invoice.discount || 0),
    pointDiscount: Number(invoice.pointDiscount || 0),
    beforeVat: Number(invoice.beforeVat || invoice.taxableBase || 0),
    taxableBase: Number(invoice.taxableBase || invoice.beforeVat || 0),
    vatRegistered: true,
    vatMode: invoice.vatMode || 'include',
    vatRate: Number(invoice.vatRate || 0),
    vatAmount: Number(invoice.vatAmount || 0),
    total: Number(invoice.totalAmount || invoice.total || 0),
    totalAmount: Number(invoice.totalAmount || invoice.total || 0),
    paymentMethod: invoice.paymentMethod || sourceSale.paymentMethod || '',
    receivedAmount: Number(invoice.receivedAmount || invoice.totalAmount || invoice.total || 0),
    changeAmount: Number(invoice.changeAmount || 0),
    syncStatus: 'synced',
    sourceTaxInvoiceId: invoice.id || invoice.invoiceNumber || taxInvoiceId || ''
  };
}
function localTaxInvoice() {
  const rows = readJson(TAX_INVOICE_LOCAL_KEY, []);
  if (!Array.isArray(rows)) return null;
  if (taxInvoiceId) {
    const match = rows.find(row => String(row.id || row.invoiceNumber || row._documentId || '') === taxInvoiceId);
    if (match) return match;
  }
  if (saleId) return rows.find(row => String(row.saleId || row.saleNumber || row.sourceSale?.id || row.sourceSale?.saleNumber || '') === saleId) || null;
  return null;
}
async function fetchTaxInvoiceSnapshot() {
  if (navigator.onLine !== false && taxInvoiceId) {
    try {
      const invoice = await getRecord('taxInvoices', taxInvoiceId);
      const sale = saleFromTaxInvoice(invoice);
      if (sale) return cacheResolvedSale(sale);
    } catch (error) {
      console.warn('[retail-pos-receipt-window] firestore tax invoice fallback', error);
    }
  }
  return cacheResolvedSale(saleFromTaxInvoice(localTaxInvoice()));
}
async function resolveSale() {
  const remoteSale = await fetchFirestoreSale();
  if (remoteSale) return remoteSale;
  const invoiceSale = await fetchTaxInvoiceSnapshot();
  return invoiceSale || findLocalSale();
}
function findSale() { return currentSale || findLocalSale(); }
function customerForSale(sale = {}) {
  const cid = String(sale.customerId || sale.memberId || '').trim();
  const code = String(sale.customerCode || sale.memberCode || '').trim();
  const phone = String(sale.customerPhone || sale.customerDisplayPhone || '').replace(/\D/g, '');
  return customers().find(customer => {
    const customerId = String(customer.id || customer._documentId || '').trim();
    const customerCode = String(customer.customerCode || customer.code || '').trim();
    const customerPhone = String(customer.phone || '').replace(/\D/g, '');
    return (cid && customerId === cid) || (code && customerCode === code) || (phone && customerPhone === phone);
  }) || null;
}
function loyaltyForSale(sale = {}) {
  if (sale?.loyalty) return sale.loyalty;
  const id = String(sale?.id || '').trim();
  const number = String(sale?.saleNumber || '').trim();
  const entry = loyaltyLedger().find(row => (id && String(row.saleId || '') === id) || (number && String(row.saleNumber || '') === number));
  if (!entry) return null;
  return {
    pointsBefore: entry.pointsBefore ?? entry.balanceBefore,
    pointsUsed: entry.pointsUsed,
    pointsEarned: entry.pointsEarned,
    pointsAfter: entry.pointsAfter ?? entry.balanceAfter,
    redeemValue: entry.redeemValue
  };
}
function draftKey() { return `${TAX_BUYER_DRAFT_PREFIX}${saleKey(currentSale) || saleId || 'latest'}`; }
function currentBuyerDraft() { return { buyerName: buyerNameInput.value, buyerTaxId: buyerTaxIdInput.value, buyerAddress: buyerAddressInput.value, buyerBranchName: buyerBranchInput.value }; }
function saveBuyerDraft() { if (currentSale) writeJson(draftKey(), { ...currentBuyerDraft(), updatedAt: Date.now() }); }
function loadBuyerDraft() { return currentSale ? readJson(draftKey(), null) : null; }
function clearBuyerDraft() { if (currentSale) localStorage.removeItem(draftKey()); }
function applyBuyerData(data = {}) { buyerNameInput.value = data.buyerName || ''; buyerTaxIdInput.value = data.buyerTaxId || ''; buyerAddressInput.value = data.buyerAddress || ''; buyerBranchInput.value = data.buyerBranchName || 'สำนักงานใหญ่'; saveBuyerDraft(); }
function loyaltyHtml(sale) { const loyalty = loyaltyForSale(sale); if (!loyalty) return ''; return `<hr class="rule"><div class="row"><span>แต้มก่อนซื้อ</span><span>${numberText(loyalty.pointsBefore)}</span></div><div class="row"><span>ใช้แต้ม</span><span>${numberText(loyalty.pointsUsed)}</span></div><div class="row"><span>แต้มที่ได้รับ</span><span>${numberText(loyalty.pointsEarned)}</span></div><div class="row"><span>แต้มคงเหลือ</span><strong>${numberText(loyalty.pointsAfter)}</strong></div>`; }
function customerHtml(sale) {
  const customer = customerForSale(sale);
  const name = sale.customerName || customer?.name || sale.customerDisplayName || '';
  const phone = sale.customerPhone || customer?.phone || sale.customerDisplayPhone || '';
  const code = sale.customerCode || customer?.customerCode || '';
  if (!name && !phone && !code) return '';
  return `<hr class="rule"><div class="row"><span>ลูกค้า</span><strong>${escapeHtml(maskReceiptCustomerName(name) || '-')}</strong></div>${code ? `<div class="row"><span>สมาชิก</span><span>${escapeHtml(code)}</span></div>` : ''}${phone ? `<div class="row"><span>โทร</span><span>${escapeHtml(maskReceiptPhone(phone))}</span></div>` : ''}`;
}
function itemsHtml(items) {
  const rows = items.map(item => {
    const qty = Number(item.qty || 0);
    const name = `${item.name || item.productName || '-'} x ${qty.toLocaleString('th-TH')}`;
    const code = item.id || item.barcode || '';
    return `<tr><td><strong>${escapeHtml(name)}</strong>${code ? `<small>${escapeHtml(code)}</small>` : ''}</td><td>${money(item.price)}</td><td>${money(item.lineTotal || Number(item.price || 0) * qty)}</td></tr>`;
  }).join('');
  return `<table class="receipt-items"><thead><tr><th>รายการ</th><th>ราคา</th><th>รวม</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function vatHtml(sale) {
  const vat = Number(sale.vatAmount || 0);
  if (!vat && !sale.vatRegistered) return '';
  return `<div class="row"><span>ยอดก่อน VAT</span><span>${money(sale.beforeVat ?? sale.taxableBase ?? sale.discountedBase ?? 0)}</span></div><div class="row"><span>VAT ${Number(sale.vatRate || 7).toLocaleString('th-TH')}%</span><span>${money(vat)}</span></div><div class="row"><span>โหมด VAT</span><span>${String(sale.vatMode || 'include') === 'exclude' ? 'ราคาไม่รวม VAT' : 'ราคารวม VAT'}</span></div>`;
}
function render(sale) {
  markPrintDirty();
  if (!sale) { root.className = 'missing'; root.textContent = 'ไม่พบบิลที่ต้องการพิมพ์'; return; }
  currentSale = sale;
  const store = settings();
  const items = Array.isArray(sale.items) ? sale.items : [];
  root.className = 'receipt';
  root.innerHTML = `<div class="center">${store.logoUrl ? `<img class="logo" src="${escapeHtml(store.logoUrl)}" alt="">` : ''}<div class="shop">${escapeHtml(store.shopName)}</div>${store.shopAddress ? `<div class="muted">${escapeHtml(store.shopAddress)}</div>` : ''}${store.shopPhone ? `<div class="muted">โทร ${escapeHtml(store.shopPhone)}</div>` : ''}${store.taxId ? `<div class="muted">เลขประจำตัวผู้เสียภาษี ${escapeHtml(store.taxId)}</div>` : ''}${store.taxBranch ? `<div class="muted">${escapeHtml(store.taxBranch)}</div>` : ''}<div class="receipt-title">${taxTitle(sale)}</div></div><hr class="rule"><div class="row"><span>เลขที่</span><strong>${escapeHtml(sale.saleNumber || sale.id || '-')}</strong></div><div class="row"><span>วันที่</span><span>${escapeHtml(new Date(sale.createdAt || Date.now()).toLocaleString('th-TH'))}</span></div><div class="row"><span>ชำระเงิน</span><span>${escapeHtml(sale.paymentMethod || sale.payment?.method || '-')}</span></div>${customerHtml(sale)}<hr class="rule">${itemsHtml(items)}<hr class="rule"><div class="row"><span>รวมสินค้า</span><span>${money(sale.subtotal)}</span></div><div class="row"><span>ส่วนลด</span><span>${money(sale.discount)}</span></div>${Number(sale.pointDiscount || 0) ? `<div class="row"><span>ส่วนลดแต้ม</span><span>${money(sale.pointDiscount)}</span></div>` : ''}${vatHtml(sale)}<div class="row total"><span>ยอดสุทธิ</span><span>${money(sale.totalAmount || sale.total)}</span></div><div class="row"><span>รับเงิน</span><span>${money(sale.receivedAmount || sale.payment?.received || sale.totalAmount || sale.total)}</span></div><div class="row"><span>เงินทอน</span><span>${money(sale.changeAmount || sale.payment?.change || 0)}</span></div>${loyaltyHtml(sale)}${sale.syncStatus === 'pending' ? '<hr class="rule"><div class="center muted">บิลนี้บันทึกแบบออฟไลน์ รอส่งข้อมูลเข้าระบบ</div>' : ''}<hr class="rule"><div class="center muted footer">${escapeHtml(store.receiptThanks)}${store.receiptFooter ? `<br>${escapeHtml(store.receiptFooter)}` : ''}</div>`;
  preparePrintReady();
}
function rerenderLatest() { const sale = findSale(); if (sale) render(sale); return sale; }
async function waitForLoyaltyAndRender() { applyPaperSize(); let sale = await resolveSale(); render(sale); const started = Date.now(); while (Date.now() - started < 900) { await new Promise(resolve => setTimeout(resolve, 160)); sale = rerenderLatest(); if (loyaltyForSale(sale)) break; } preparePrintReady(); if (autoPrint) setTimeout(() => printReceipt({ auto: true }), 350); }
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
  } catch (error) { taxError.textContent = error?.message || 'ออกใบกำกับภาษีไม่สำเร็จ'; }
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
async function waitForPrintReady() {
  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch {}
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
function setPrintButtonReady(ready) {
  if (printBtn) printBtn.disabled = !ready;
}
function markPrintDirty() {
  printReady = false;
  printReadyPromise = null;
  setPrintButtonReady(false);
}
function preparePrintReady() {
  if (printReadyPromise) return printReadyPromise;
  printReadyPromise = waitForPrintReady()
    .then(() => {
      printReady = true;
      setPrintButtonReady(true);
    })
    .catch(() => {
      printReady = true;
      setPrintButtonReady(true);
    });
  return printReadyPromise;
}
async function printReceipt(options = {}) {
  const auto = Boolean(options.auto);
  if (!auto && printReady) {
    window.print();
    return;
  }
  await preparePrintReady();
  window.print();
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
  setButtonIconLabel(dbdLookupBtn, ICON_HOURGLASS, 'ค้นหา...');
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
    setButtonIconLabel(dbdLookupBtn, ICON_SEARCH, 'DBD');
  }
}
printBtn?.addEventListener('click', () => printReceipt());
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
