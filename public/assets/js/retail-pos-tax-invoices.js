import { RetailCollections, listRecords } from './retail-db.js?v=20260629-032';
import { createFullTaxInvoiceFromSale, defaultBuyerFromSale, deleteTaxBuyerProfile, getExistingFullTaxInvoiceForSale, listTaxBuyerProfiles, saveTaxBuyerProfile, syncPendingTaxInvoices, syncTaxBuyerProfiles, taxInvoiceUrl, voidFullTaxInvoice } from './retail-pos-full-tax-invoice.js?v=20260709-001';

const TAX_INVOICE_COLLECTION = 'taxInvoices';
const TAX_INVOICE_LOCAL_KEY = 'retail_pos_tax_invoices_v1';
const SALES_KEY = 'retail_pos_sales_v1';

const searchInput = document.querySelector('#taxInvoiceSearch');
const refreshBtn = document.querySelector('#refreshBtn');
const summaryEl = document.querySelector('#summaryText');
const listEl = document.querySelector('#taxInvoiceList');
const emptyEl = document.querySelector('#emptyState');
const sourceSaleSearch = document.querySelector('#sourceSaleSearch');
const findSourceSaleBtn = document.querySelector('#findSourceSaleBtn');
const sourceSaleResult = document.querySelector('#sourceSaleResult');
const lateDialog = document.querySelector('#lateTaxInvoiceDialog');
const lateForm = document.querySelector('#lateTaxInvoiceForm');
const lateSaleText = document.querySelector('#lateTaxInvoiceSaleText');
const lateBuyerTaxIdInput = document.querySelector('#lateBuyerTaxIdInput');
const lateBuyerNameInput = document.querySelector('#lateBuyerNameInput');
const lateBuyerBranchInput = document.querySelector('#lateBuyerBranchInput');
const lateBuyerAddressInput = document.querySelector('#lateBuyerAddressInput');
const lateTaxInvoiceError = document.querySelector('#lateTaxInvoiceError');
const lateTaxInvoiceCancelBtn = document.querySelector('#lateTaxInvoiceCancelBtn');
const lateTaxInvoiceSubmitBtn = document.querySelector('#lateTaxInvoiceSubmitBtn');
const profileBtn = document.querySelector('#taxProfileBtn');
const profileDialog = document.querySelector('#taxProfileDialog');
const profileListEl = document.querySelector('#taxProfileList');
const profileForm = document.querySelector('#taxProfileForm');
const profileIdInput = document.querySelector('#taxProfileIdInput');
const profileNameInput = document.querySelector('#taxProfileNameInput');
const profileTaxIdInput = document.querySelector('#taxProfileTaxIdInput');
const profileBranchInput = document.querySelector('#taxProfileBranchInput');
const profileAddressInput = document.querySelector('#taxProfileAddressInput');
const profileError = document.querySelector('#taxProfileError');
const profileNewBtn = document.querySelector('#taxProfileNewBtn');
const profileCloseBtn = document.querySelector('#taxProfileCloseBtn');
const profileDeleteBtn = document.querySelector('#taxProfileDeleteBtn');
const voidDialog = document.querySelector('#voidTaxInvoiceDialog');
const voidForm = document.querySelector('#voidTaxInvoiceForm');
const voidText = document.querySelector('#voidTaxInvoiceText');
const voidReasonInput = document.querySelector('#voidTaxInvoiceReasonInput');
const voidError = document.querySelector('#voidTaxInvoiceError');
const voidCancelBtn = document.querySelector('#voidTaxInvoiceCancelBtn');
const voidSubmitBtn = document.querySelector('#voidTaxInvoiceSubmitBtn');
let invoices = [];
let salesCache = [];
let currentSourceSale = null;
let currentVoidInvoice = null;

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

function dateText(value) {
  return new Date(value || Date.now()).toLocaleString('th-TH');
}

function normalizeTaxId(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 13);
}

function localInvoices() {
  const rows = readJson(TAX_INVOICE_LOCAL_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function localSales() {
  const rows = readJson(SALES_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function keyOf(invoice = {}) {
  return String(invoice.id || invoice.invoiceNumber || invoice._documentId || '').trim();
}

function mergeInvoices(...groups) {
  const map = new Map();
  groups.flat().forEach(row => {
    const key = keyOf(row);
    if (!key) return;
    map.set(key, { ...(map.get(key) || {}), ...row });
  });
  return [...map.values()].sort((a, b) => Number(b.issuedAt || b.updatedAt || 0) - Number(a.issuedAt || a.updatedAt || 0));
}

function saleKey(sale = {}) {
  return String(sale.saleNumber || sale.number || sale.id || '').trim();
}

function saleSearchText(sale = {}) {
  return [sale.id, sale.saleNumber, sale.number, sale.customerName, sale.customerDisplayName, sale.customerPhone, sale.customerCode].join(' ').toLowerCase();
}

function saleDateText(sale = {}) {
  return new Date(sale.createdAt || sale.updatedAt || Date.now()).toLocaleString('th-TH');
}

function mergeSales(...groups) {
  const map = new Map();
  groups.flat().forEach(row => {
    const key = String(row?.id || row?.saleNumber || row?.number || '').trim();
    if (!key) return;
    map.set(key, { ...(map.get(key) || {}), ...row });
  });
  return [...map.values()].sort((a, b) => Number(b.createdAt || b.updatedAt || 0) - Number(a.createdAt || a.updatedAt || 0));
}

function invoiceSearchText(invoice = {}) {
  const buyer = invoice.buyer || {};
  const seller = invoice.seller || {};
  return [invoice.invoiceNumber, invoice.saleNumber, invoice.saleId, buyer.buyerName, buyer.buyerTaxId, buyer.buyerAddress, seller.sellerName, invoice.status, invoice.syncStatus, invoice.syncError].join(' ').toLowerCase();
}

function syncBadge(invoice = {}) {
  const status = String(invoice.syncStatus || '');
  if (invoice.syncError) return '<span class="sync-badge is-error">Sync Error</span>';
  if (['pending_create', 'pending_void'].includes(status)) return '<span class="sync-badge is-pending">รอ Sync</span>';
  if (['local_only', 'local_void'].includes(status)) return '<span class="sync-badge is-local">เอกสารในเครื่อง</span>';
  if (invoice.runningNumberStatus === 'local_only') return '<span class="sync-badge is-local">เลขชั่วคราว</span>';
  return '';
}

function existingInvoiceForSale(sale = {}) {
  const key = String(sale.id || '').trim();
  const number = String(sale.saleNumber || sale.number || '').trim();
  return getExistingFullTaxInvoiceForSale(sale)
    || invoices.find(row => (key && String(row.saleId || row.sourceSale?.id || '') === key) || (number && String(row.saleNumber || row.sourceSale?.saleNumber || '') === number))
    || null;
}

function filteredInvoices() {
  const q = String(searchInput?.value || '').trim().toLowerCase();
  if (!q) return invoices;
  return invoices.filter(invoice => invoiceSearchText(invoice).includes(q));
}

function invoiceUrl(invoice) {
  const id = encodeURIComponent(invoice.id || invoice.invoiceNumber || invoice._documentId || '');
  return `/pos/tax-invoice/?invoiceId=${id}&auto=0`;
}

function openInvoice(invoice) {
  if (!invoice) return;
  window.open(taxInvoiceUrl(invoice, { autoPrint: false }), '_blank', 'noopener,noreferrer');
}

function currentBuyer() {
  return {
    buyerName: lateBuyerNameInput?.value || '',
    buyerTaxId: lateBuyerTaxIdInput?.value || '',
    buyerAddress: lateBuyerAddressInput?.value || '',
    buyerBranchName: lateBuyerBranchInput?.value || ''
  };
}

function profileRows() {
  return listTaxBuyerProfiles();
}

function resetProfileForm(profile = {}) {
  if (profileIdInput) {
    profileIdInput.value = profile.id || profile.customerKey || '';
    profileIdInput.readOnly = Boolean(profile.id || profile.customerKey);
  }
  if (profileNameInput) profileNameInput.value = profile.buyerName || '';
  if (profileTaxIdInput) profileTaxIdInput.value = profile.buyerTaxId || '';
  if (profileAddressInput) profileAddressInput.value = profile.buyerAddress || '';
  if (profileBranchInput) profileBranchInput.value = profile.buyerBranchName || 'สำนักงานใหญ่';
  if (profileError) profileError.textContent = '';
  if (profileDeleteBtn) profileDeleteBtn.hidden = !(profile.id || profile.customerKey);
}

function renderProfiles(selectedId = '') {
  if (!profileListEl) return;
  const rows = profileRows();
  if (!rows.length) {
    profileListEl.innerHTML = '<div class="profile-empty">ยังไม่มีโปรไฟล์ภาษีลูกค้า</div>';
    resetProfileForm();
    return;
  }
  profileListEl.innerHTML = rows.map(profile => {
    const id = profile.id || profile.customerKey || '';
    return `<button class="profile-row${String(id) === String(selectedId) ? ' is-active' : ''}" type="button" data-profile-id="${escapeHtml(id)}">
      <strong>${escapeHtml(profile.buyerName || '-')}</strong>
      <span>${escapeHtml(profile.buyerTaxId || '-')} • ${escapeHtml(profile.buyerBranchName || 'สำนักงานใหญ่')}</span>
    </button>`;
  }).join('');
  const active = rows.find(row => String(row.id || row.customerKey || '') === String(selectedId)) || rows[0];
  resetProfileForm(active);
}

function openProfileDialog() {
  renderProfiles();
  profileDialog?.showModal();
  setTimeout(() => profileNameInput?.focus(), 50);
  syncTaxBuyerProfiles()
    .then(() => renderProfiles(selectedProfileId()))
    .catch(error => console.warn('[retail-pos-tax-invoices] tax profile sync skipped', error));
}

function selectedProfileId() {
  return String(profileIdInput?.value || '').trim();
}

function currentProfileForm() {
  return {
    id: selectedProfileId() || normalizeTaxId(profileTaxIdInput?.value) || profileNameInput?.value || '',
    customerKey: selectedProfileId() || normalizeTaxId(profileTaxIdInput?.value) || profileNameInput?.value || '',
    buyerName: profileNameInput?.value || '',
    buyerTaxId: profileTaxIdInput?.value || '',
    buyerAddress: profileAddressInput?.value || '',
    buyerBranchName: profileBranchInput?.value || ''
  };
}

function saveProfileForm() {
  if (profileError) profileError.textContent = '';
  try {
    const profile = saveTaxBuyerProfile(currentProfileForm());
    renderProfiles(profile.id);
    syncTaxBuyerProfiles()
      .then(() => renderProfiles(profile.id))
      .catch(error => console.warn('[retail-pos-tax-invoices] tax profile save sync skipped', error));
  } catch (error) {
    if (profileError) profileError.textContent = error?.message || 'บันทึกโปรไฟล์ภาษีไม่สำเร็จ';
  }
}

function deleteProfileForm() {
  const id = selectedProfileId();
  if (!id) return;
  const ok = window.confirm('ลบโปรไฟล์ภาษีลูกค้านี้หรือไม่');
  if (!ok) return;
  deleteTaxBuyerProfile(id);
  renderProfiles();
}

function applyBuyer(buyer = {}) {
  if (lateBuyerNameInput) lateBuyerNameInput.value = buyer.buyerName || '';
  if (lateBuyerTaxIdInput) lateBuyerTaxIdInput.value = buyer.buyerTaxId || '';
  if (lateBuyerAddressInput) lateBuyerAddressInput.value = buyer.buyerAddress || '';
  if (lateBuyerBranchInput) lateBuyerBranchInput.value = buyer.buyerBranchName || 'สำนักงานใหญ่';
}

function setSourceSaleMessage(message = '', { error = false } = {}) {
  if (!sourceSaleResult) return;
  sourceSaleResult.classList.toggle('is-error', Boolean(error));
  sourceSaleResult.innerHTML = message;
}

function sourceSaleCard(sale, actionHtml = '') {
  const number = saleKey(sale) || '-';
  return `<div class="issue-sale-card"><div><strong>${escapeHtml(number)}</strong><div>${escapeHtml(saleDateText(sale))} • ยอดสุทธิ ${money(sale.totalAmount ?? sale.total)} บาท</div></div>${actionHtml}</div>`;
}

async function loadSalesForSearch() {
  let remote = [];
  try { remote = await listRecords(RetailCollections.sales, { sortBy: 'createdAt', direction: 'desc' }); }
  catch (error) { console.warn('[retail-pos-tax-invoices] sale/list fallback', error); }
  salesCache = mergeSales(localSales(), remote);
  return salesCache;
}

function findSale(queryText = '') {
  const q = String(queryText || '').trim().toLowerCase();
  if (!q) return null;
  return salesCache.find(sale => [sale.id, sale.saleNumber, sale.number].some(value => String(value || '').trim().toLowerCase() === q))
    || salesCache.find(sale => saleSearchText(sale).includes(q))
    || null;
}

function showLateTaxDialog(sale) {
  currentSourceSale = sale;
  const defaults = defaultBuyerFromSale(sale);
  applyBuyer(defaults);
  if (lateSaleText) lateSaleText.textContent = `บิล ${saleKey(sale) || '-'} • ${saleDateText(sale)} • ยอดสุทธิ ${money(sale.totalAmount ?? sale.total)} บาท`;
  if (lateTaxInvoiceError) lateTaxInvoiceError.textContent = '';
  lateDialog?.showModal();
  setTimeout(() => lateBuyerTaxIdInput?.focus(), 50);
}

async function findSourceSale() {
  const queryText = sourceSaleSearch?.value || '';
  if (!String(queryText).trim()) {
    setSourceSaleMessage('กรุณาระบุเลขบิลเดิมก่อนค้นหา', { error: true });
    sourceSaleSearch?.focus();
    return;
  }
  findSourceSaleBtn.disabled = true;
  findSourceSaleBtn.textContent = 'กำลังค้นหา...';
  setSourceSaleMessage('กำลังค้นหาบิลเดิม...');
  try {
    await loadSalesForSearch();
    const sale = findSale(queryText);
    if (!sale) {
      setSourceSaleMessage('ไม่พบบิลเดิมจากเลขที่ระบุ กรุณาตรวจเลขบิลหรือให้เครื่อง Sync ข้อมูลก่อน', { error: true });
      return;
    }
    const existing = existingInvoiceForSale(sale);
    if (existing) {
      setSourceSaleMessage(sourceSaleCard(sale, `<button class="btn btn-secondary" type="button" data-open-existing-tax="${escapeHtml(existing.id || existing.invoiceNumber || '')}">เปิดใบกำกับเดิม</button>`));
      openInvoice(existing);
      return;
    }
    setSourceSaleMessage(sourceSaleCard(sale, '<button class="btn btn-primary" type="button" data-issue-late-tax="1">ออกใบกำกับภาษี</button>'));
    showLateTaxDialog(sale);
  } finally {
    findSourceSaleBtn.disabled = false;
    findSourceSaleBtn.textContent = 'ค้นหาบิล';
  }
}

async function submitLateTaxInvoice() {
  if (!currentSourceSale) return;
  lateTaxInvoiceSubmitBtn.disabled = true;
  lateTaxInvoiceSubmitBtn.textContent = 'กำลังออกเอกสาร...';
  if (lateTaxInvoiceError) lateTaxInvoiceError.textContent = '';
  try {
    const invoice = await createFullTaxInvoiceFromSale(currentSourceSale, currentBuyer());
    lateDialog?.close();
    openInvoice(invoice);
    await load();
    setSourceSaleMessage(sourceSaleCard(currentSourceSale, `<a class="btn btn-primary" href="${invoiceUrl(invoice)}" target="_blank" rel="noopener">เปิด/พิมพ์</a>`));
  } catch (error) {
    if (lateTaxInvoiceError) lateTaxInvoiceError.textContent = error?.message || 'ออกใบกำกับภาษีไม่สำเร็จ';
  } finally {
    lateTaxInvoiceSubmitBtn.disabled = false;
    lateTaxInvoiceSubmitBtn.textContent = 'ออกใบกำกับภาษี';
  }
}

function showVoidDialog(invoice) {
  currentVoidInvoice = invoice;
  if (voidText) voidText.textContent = `${invoice.invoiceNumber || invoice.id || '-'} • บิล ${invoice.saleNumber || invoice.saleId || '-'}`;
  if (voidReasonInput) voidReasonInput.value = '';
  if (voidError) voidError.textContent = '';
  voidDialog?.showModal();
  setTimeout(() => voidReasonInput?.focus(), 50);
}

async function submitVoidInvoice() {
  if (!currentVoidInvoice) return;
  voidSubmitBtn.disabled = true;
  voidSubmitBtn.textContent = 'กำลังยกเลิก...';
  if (voidError) voidError.textContent = '';
  try {
    await voidFullTaxInvoice(currentVoidInvoice, voidReasonInput?.value || '');
    voidDialog?.close();
    currentVoidInvoice = null;
    await load();
  } catch (error) {
    if (voidError) voidError.textContent = error?.message || 'ยกเลิกใบกำกับภาษีไม่สำเร็จ';
  } finally {
    voidSubmitBtn.disabled = false;
    voidSubmitBtn.textContent = 'ยืนยันยกเลิก';
  }
}

function cardHtml(invoice) {
  const buyer = invoice.buyer || {};
  const seller = invoice.seller || {};
  const isVoid = invoice.status === 'void';
  const status = isVoid ? 'ยกเลิก' : 'ออกเอกสารแล้ว';
  return `<article class="tax-card">
    <div class="tax-card-main">
      <div class="tax-card-badges"><div class="tax-doc-no">${escapeHtml(invoice.invoiceNumber || invoice.id || '-')}</div>${syncBadge(invoice)}</div>
      <h2>${escapeHtml(buyer.buyerName || '-')}</h2>
      <div class="tax-meta">
        <span>เลขภาษี: ${escapeHtml(buyer.buyerTaxId || '-')}</span>
        <span>บิล: ${escapeHtml(invoice.saleNumber || invoice.saleId || '-')}</span>
        <span>${escapeHtml(dateText(invoice.issuedAt))}</span>
      </div>
      <p>${escapeHtml(buyer.buyerAddress || '')}</p>
      <small>ผู้ขาย: ${escapeHtml(seller.sellerName || '-')} • ${escapeHtml(status)}${invoice.voidReason ? ` • เหตุผล: ${escapeHtml(invoice.voidReason)}` : ''}${invoice.syncError ? ` • Sync: ${escapeHtml(invoice.syncError)}` : ''}</small>
    </div>
    <div class="tax-card-side">
      <strong>${money(invoice.totalAmount)}</strong>
      <span>VAT ${money(invoice.vatAmount)}</span>
      <div class="tax-actions">
        <a class="btn btn-primary" href="${invoiceUrl(invoice)}" target="_blank" rel="noopener">เปิด/พิมพ์</a>
        ${isVoid ? '' : `<button class="btn btn-danger" type="button" data-void-tax="${escapeHtml(keyOf(invoice))}">ยกเลิก</button>`}
      </div>
    </div>
  </article>`;
}

function render() {
  const rows = filteredInvoices();
  summaryEl.textContent = `ทั้งหมด ${invoices.length.toLocaleString('th-TH')} เอกสาร • แสดง ${rows.length.toLocaleString('th-TH')} เอกสาร`;
  emptyEl.hidden = rows.length > 0;
  listEl.innerHTML = rows.map(cardHtml).join('');
}

async function load() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'กำลังโหลด...';
  try {
    try { await syncPendingTaxInvoices(); }
    catch (error) { console.warn('[retail-pos-tax-invoices] pending sync skipped', error); }
    try { await syncTaxBuyerProfiles(); }
    catch (error) { console.warn('[retail-pos-tax-invoices] tax profile sync skipped', error); }
    let remote = [];
    try { remote = await listRecords(TAX_INVOICE_COLLECTION, { sortBy: 'issuedAt', direction: 'desc' }); }
    catch (error) { console.warn('[retail-pos-tax-invoices] firebase/list fallback', error); }
    invoices = mergeInvoices(localInvoices(), remote);
    render();
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'รีเฟรช';
  }
}

searchInput?.addEventListener('input', render);
refreshBtn?.addEventListener('click', load);
findSourceSaleBtn?.addEventListener('click', findSourceSale);
sourceSaleSearch?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); findSourceSale(); } });
sourceSaleResult?.addEventListener('click', event => {
  const issueButton = event.target.closest('[data-issue-late-tax]');
  if (issueButton && currentSourceSale) showLateTaxDialog(currentSourceSale);
  const openButton = event.target.closest('[data-open-existing-tax]');
  if (openButton) {
    const invoice = invoices.find(row => String(row.id || row.invoiceNumber || '') === String(openButton.dataset.openExistingTax || ''));
    if (invoice) openInvoice(invoice);
  }
});
lateTaxInvoiceCancelBtn?.addEventListener('click', () => lateDialog?.close());
lateForm?.addEventListener('submit', event => { event.preventDefault(); submitLateTaxInvoice(); });
profileBtn?.addEventListener('click', openProfileDialog);
profileCloseBtn?.addEventListener('click', () => profileDialog?.close());
profileNewBtn?.addEventListener('click', () => {
  resetProfileForm();
  if (profileIdInput) profileIdInput.readOnly = false;
  profileNameInput?.focus();
});
profileDeleteBtn?.addEventListener('click', deleteProfileForm);
profileListEl?.addEventListener('click', event => {
  const button = event.target.closest('[data-profile-id]');
  if (!button) return;
  const profile = profileRows().find(row => String(row.id || row.customerKey || '') === String(button.dataset.profileId || ''));
  if (profile) renderProfiles(profile.id || profile.customerKey || '');
});
profileForm?.addEventListener('submit', event => { event.preventDefault(); saveProfileForm(); });
listEl?.addEventListener('click', event => {
  const button = event.target.closest('[data-void-tax]');
  if (!button) return;
  const invoice = invoices.find(row => keyOf(row) === String(button.dataset.voidTax || ''));
  if (invoice) showVoidDialog(invoice);
});
voidCancelBtn?.addEventListener('click', () => voidDialog?.close());
voidForm?.addEventListener('submit', event => { event.preventDefault(); submitVoidInvoice(); });
window.addEventListener('storage', event => { if (!event.key || event.key === TAX_INVOICE_LOCAL_KEY) load(); });
window.addEventListener('online', load);
load();
loadSalesForSearch();
