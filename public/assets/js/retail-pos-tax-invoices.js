import { RetailCollections, listRecords } from './retail-db.js?v=20260629-032';
import { createFullTaxInvoiceFromSale, defaultBuyerFromSale, deleteTaxBuyerProfile, getExistingFullTaxInvoiceForSale, listTaxBuyerProfiles, saveTaxBuyerProfile, syncPendingTaxInvoices, syncTaxBuyerProfiles, taxInvoiceUrl, updateLocalTaxInvoiceBuyer, voidFullTaxInvoice } from './retail-pos-full-tax-invoice.js?v=20260711-011';

const TAX_INVOICE_COLLECTION = 'taxInvoices';
const TAX_INVOICE_LOCAL_KEY = 'retail_pos_tax_invoices_v1';
const SALES_KEY = 'retail_pos_sales_v1';
const STALE_SYNC_MS = 24 * 60 * 60 * 1000;

const searchInput = document.querySelector('#taxInvoiceSearch');
const syncFilterButtons = [...document.querySelectorAll('[data-tax-sync-filter]')];
const sourceFilterButtons = [...document.querySelectorAll('[data-tax-source-filter]')];
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
const editBuyerDialog = document.querySelector('#editTaxBuyerDialog');
const editBuyerForm = document.querySelector('#editTaxBuyerForm');
const editBuyerText = document.querySelector('#editTaxBuyerText');
const editBuyerNameInput = document.querySelector('#editBuyerNameInput');
const editBuyerTaxIdInput = document.querySelector('#editBuyerTaxIdInput');
const editBuyerBranchInput = document.querySelector('#editBuyerBranchInput');
const editBuyerAddressInput = document.querySelector('#editBuyerAddressInput');
const editBuyerError = document.querySelector('#editTaxBuyerError');
const editBuyerCancelBtn = document.querySelector('#editTaxBuyerCancelBtn');
const editBuyerSubmitBtn = document.querySelector('#editTaxBuyerSubmitBtn');
let invoices = [];
let salesCache = [];
let currentSourceSale = null;
let currentVoidInvoice = null;
let currentEditBuyerInvoice = null;
let activeSyncFilter = 'all';
let activeSourceFilter = 'all';

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

function invoiceSourceText(invoice = {}) {
  if (invoice._syncSourceLocal && invoice._syncSourceRemote) return 'Firestore + เครื่องนี้';
  if (invoice._syncSourceRemote) return 'Firestore';
  if (invoice._syncSourceLocal) return 'เครื่องนี้';
  return 'ไม่ทราบแหล่งข้อมูล';
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
  const escalation = shouldEscalateSync(invoice) ? 'ส่ง support ตรวจสอบ stuck sync retry' : '';
  const stale = shouldShowStaleSync(invoice) ? 'ค้าง sync เกิน 24 ชั่วโมง stuck pending local' : '';
  const quality = qualityWarnings(invoice).join(' ');
  const recommendation = recoveryRecommendation(invoice);
  const source = invoiceSourceText(invoice);
  return [invoice.invoiceNumber, invoice.saleNumber, invoice.saleId, buyer.buyerName, buyer.buyerTaxId, buyer.buyerAddress, seller.sellerName, invoice.status, invoice.syncStatus, invoice.syncAction, invoice.syncPhase, invoice.syncTargetId, invoice.syncError, escalation, stale, quality, recommendation, source].join(' ').toLowerCase();
}

function syncBadge(invoice = {}) {
  const status = String(invoice.syncStatus || '');
  const staleBadge = shouldShowStaleSync(invoice) ? '<span class="sync-badge is-pending">ค้าง Sync</span>' : '';
  const qualityBadge = needsQualityReview(invoice) ? '<span class="sync-badge is-pending">ตรวจข้อมูล</span>' : '';
  if (invoice.syncError) return `<span class="sync-badge is-error">Sync Error</span>${shouldEscalateSync(invoice) ? '<span class="sync-badge is-pending">ส่ง Support</span>' : ''}${staleBadge}${qualityBadge}`;
  if (['pending_create', 'pending_void'].includes(status)) return `<span class="sync-badge is-pending">รอ Sync</span>${staleBadge}${qualityBadge}`;
  if (['local_only', 'local_void'].includes(status)) return `<span class="sync-badge is-local">เอกสารในเครื่อง</span>${staleBadge}${qualityBadge}`;
  if (invoice.runningNumberStatus === 'local_only') return `<span class="sync-badge is-local">เลขชั่วคราว</span>${staleBadge}${qualityBadge}`;
  return `${staleBadge}${qualityBadge}`;
}

function shouldEscalateSync(invoice = {}) {
  return Boolean(invoice.syncError && Number(invoice.syncAttemptCount || 0) >= 3);
}

function syncReferenceTime(invoice = {}) {
  return Number(invoice.syncAttemptedAt || invoice.syncErrorAt || invoice.updatedAt || invoice.issuedAt || 0);
}

function staleSyncHours(invoice = {}) {
  const startedAt = syncReferenceTime(invoice);
  if (!startedAt) return 0;
  return Math.floor((Date.now() - startedAt) / (60 * 60 * 1000));
}

function shouldShowStaleSync(invoice = {}) {
  const startedAt = syncReferenceTime(invoice);
  return Boolean(canRetrySync(invoice) && startedAt && Date.now() - startedAt >= STALE_SYNC_MS);
}

function qualityWarnings(invoice = {}) {
  if (!canRetrySync(invoice)) return [];
  const buyer = invoice.buyer || {};
  const warnings = [];
  if (canEditPendingBuyer(invoice) && !String(buyer.buyerName || '').trim()) warnings.push('ขาดชื่อผู้ซื้อ');
  if (canEditPendingBuyer(invoice) && !normalizeTaxId(buyer.buyerTaxId)) warnings.push('ไม่มีเลขภาษีผู้ซื้อ');
  if (!sourceSaleKey(invoice)) warnings.push('ไม่มีเลขบิลต้นทาง');
  return warnings;
}

function needsQualityReview(invoice = {}) {
  return qualityWarnings(invoice).length > 0;
}

function recoveryRecommendation(invoice = {}) {
  if (!canRetrySync(invoice)) return '';
  if (shouldEscalateSync(invoice)) return 'คำแนะนำ: คัดลอก Sync ส่ง Support';
  const warnings = qualityWarnings(invoice);
  if (warnings.some(text => text.includes('ชื่อผู้ซื้อ') || text.includes('เลขภาษี'))) return 'คำแนะนำ: แก้ผู้ซื้อ แล้วลอง Sync';
  if (warnings.some(text => text.includes('เลขบิลต้นทาง'))) return 'คำแนะนำ: ดูบิลต้นทางหรือคัดลอก Sync ให้ Support';
  if (shouldShowStaleSync(invoice)) return 'คำแนะนำ: ลอง Sync อีกครั้ง ถ้ายังค้างให้คัดลอก Sync';
  if (invoice.syncError) return 'คำแนะนำ: ลอง Sync หรือคัดลอก Sync';
  return 'คำแนะนำ: ลอง Sync';
}

function syncDiagnosticText(invoice = {}) {
  const recommendation = recoveryRecommendation(invoice);
  if (!invoice.syncError && !shouldShowStaleSync(invoice) && !needsQualityReview(invoice) && !recommendation) return '';
  const parts = invoice.syncError ? [`Sync: ${invoice.syncError}`] : [];
  const action = String(invoice.syncAction || '').trim();
  const phase = String(invoice.syncPhase || '').trim();
  if (action || phase) parts.push(`งาน ${action || '-'}${phase ? ` / ${phase}` : ''}`);
  const count = Number(invoice.syncAttemptCount || 0);
  if (count > 0) parts.push(`พยายาม ${count.toLocaleString('th-TH')} ครั้ง`);
  const attemptedAt = syncReferenceTime(invoice);
  if (attemptedAt > 0) parts.push(`ล่าสุด ${dateText(attemptedAt)}`);
  if (shouldShowStaleSync(invoice)) parts.push(`ค้าง Sync ประมาณ ${staleSyncHours(invoice).toLocaleString('th-TH')} ชม.`);
  if (needsQualityReview(invoice)) parts.push(`ตรวจข้อมูล: ${qualityWarnings(invoice).join(', ')}`);
  if (shouldEscalateSync(invoice)) parts.push('แนะนำคัดลอก Sync ส่ง Support');
  if (recommendation) parts.push(recommendation);
  return parts.join(' • ');
}

function syncRecoveryText(invoice = {}) {
  const buyer = invoice.buyer || {};
  const receiptUrl = sourceReceiptUrl(invoice);
  return [
    'Food Order POS Tax Invoice Sync Recovery',
    `Invoice ID: ${keyOf(invoice) || '-'}`,
    `Invoice No: ${invoice.invoiceNumber || '-'}`,
    `Sale: ${invoice.saleNumber || invoice.saleId || invoice.sourceSale?.saleNumber || invoice.sourceSale?.id || '-'}`,
    `Source Receipt: ${receiptUrl || '-'}`,
    `Buyer: ${buyer.buyerName || '-'}`,
    `Status: ${invoice.status || '-'}`,
    `Sync Status: ${invoice.syncStatus || '-'}`,
    `Sync Action: ${invoice.syncAction || '-'}`,
    `Sync Phase: ${invoice.syncPhase || '-'}`,
    `Sync Target: ${invoice.syncTargetId || '-'}`,
    `Sync Error: ${invoice.syncError || '-'}`,
    `Attempts: ${Number(invoice.syncAttemptCount || 0)}`,
    `Escalation: ${shouldEscalateSync(invoice) ? 'ส่ง Support' : '-'}`,
    `Stale Sync: ${shouldShowStaleSync(invoice) ? `${staleSyncHours(invoice)} hours` : '-'}`,
    `Quality Check: ${needsQualityReview(invoice) ? qualityWarnings(invoice).join(', ') : '-'}`,
    `Recommended Action: ${recoveryRecommendation(invoice) || '-'}`,
    `Data Source: ${invoiceSourceText(invoice)}`,
    `Sync Reference: ${syncReferenceTime(invoice) ? dateText(syncReferenceTime(invoice)) : '-'}`,
    `Latest Attempt: ${invoice.syncAttemptedAt || invoice.syncErrorAt ? dateText(invoice.syncAttemptedAt || invoice.syncErrorAt) : '-'}`
  ].join('\n');
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function canRetrySync(invoice = {}) {
  const status = String(invoice.syncStatus || '');
  return Boolean(invoice.syncError || ['pending_create', 'pending_void', 'local_only', 'local_void'].includes(status));
}

function canEditPendingBuyer(invoice = {}) {
  const status = String(invoice.syncStatus || '');
  return invoice.status !== 'void' && ['pending_create', 'local_only'].includes(status);
}

function isPendingSync(invoice = {}) {
  const status = String(invoice.syncStatus || '');
  return Boolean(['pending_create', 'pending_void', 'local_only', 'local_void'].includes(status) || invoice.runningNumberStatus === 'local_only');
}

function invoiceMatchesSyncFilter(invoice = {}) {
  if (activeSyncFilter === 'error') return Boolean(invoice.syncError);
  if (activeSyncFilter === 'pending') return isPendingSync(invoice);
  if (activeSyncFilter === 'support') return shouldEscalateSync(invoice);
  if (activeSyncFilter === 'stale') return shouldShowStaleSync(invoice);
  if (activeSyncFilter === 'review') return needsQualityReview(invoice);
  return true;
}

function invoiceMatchesSourceFilter(invoice = {}) {
  if (activeSourceFilter === 'remote') return Boolean(invoice._syncSourceRemote && !invoice._syncSourceLocal);
  if (activeSourceFilter === 'local') return Boolean(invoice._syncSourceLocal && !invoice._syncSourceRemote);
  if (activeSourceFilter === 'both') return Boolean(invoice._syncSourceLocal && invoice._syncSourceRemote);
  return true;
}

function syncFilterLabel() {
  if (activeSyncFilter === 'error') return 'Sync Error';
  if (activeSyncFilter === 'pending') return 'รอ Sync';
  if (activeSyncFilter === 'support') return 'ส่ง Support';
  if (activeSyncFilter === 'stale') return 'ค้าง Sync';
  if (activeSyncFilter === 'review') return 'ตรวจข้อมูล';
  return 'ทั้งหมด';
}

function sourceFilterLabel() {
  if (activeSourceFilter === 'remote') return 'Firestore เท่านั้น';
  if (activeSourceFilter === 'local') return 'เครื่องนี้เท่านั้น';
  if (activeSourceFilter === 'both') return 'ทั้งสอง';
  return 'ทุกแหล่ง';
}

function updateSyncFilterCounts() {
  const counts = {
    all: invoices.length,
    error: invoices.filter(invoice => invoice.syncError).length,
    pending: invoices.filter(isPendingSync).length,
    support: invoices.filter(shouldEscalateSync).length,
    stale: invoices.filter(shouldShowStaleSync).length,
    review: invoices.filter(needsQualityReview).length
  };
  syncFilterButtons.forEach(button => {
    const key = String(button.dataset.taxSyncFilter || 'all');
    button.classList.toggle('is-active', key === activeSyncFilter);
    const countEl = button.querySelector('[data-tax-sync-count]');
    if (countEl) countEl.textContent = Number(counts[key] || 0).toLocaleString('th-TH');
  });
}

function updateSourceFilterCounts() {
  const counts = {
    all: invoices.length,
    remote: invoices.filter(invoice => invoice._syncSourceRemote && !invoice._syncSourceLocal).length,
    local: invoices.filter(invoice => invoice._syncSourceLocal && !invoice._syncSourceRemote).length,
    both: invoices.filter(invoice => invoice._syncSourceLocal && invoice._syncSourceRemote).length
  };
  sourceFilterButtons.forEach(button => {
    const key = String(button.dataset.taxSourceFilter || 'all');
    button.classList.toggle('is-active', key === activeSourceFilter);
    const countEl = button.querySelector('[data-tax-source-count]');
    if (countEl) countEl.textContent = Number(counts[key] || 0).toLocaleString('th-TH');
  });
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
  return invoices.filter(invoice => invoiceMatchesSyncFilter(invoice) && invoiceMatchesSourceFilter(invoice) && (!q || invoiceSearchText(invoice).includes(q)));
}

function invoiceUrl(invoice) {
  const id = encodeURIComponent(invoice.id || invoice.invoiceNumber || invoice._documentId || '');
  return `/pos/tax-invoice/?invoiceId=${id}&auto=0`;
}

function sourceSaleKey(invoice = {}) {
  return String(invoice.saleId || invoice.saleNumber || invoice.sourceSale?.id || invoice.sourceSale?.saleNumber || '').trim();
}

function sourceReceiptUrl(invoice = {}) {
  const saleKeyValue = sourceSaleKey(invoice);
  if (!saleKeyValue) return '';
  return new URL(`/pos/receipt/?saleId=${encodeURIComponent(saleKeyValue)}&auto=0`, location.origin).toString();
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

function showEditBuyerDialog(invoice) {
  currentEditBuyerInvoice = invoice;
  const buyer = invoice.buyer || {};
  if (editBuyerText) editBuyerText.textContent = `${invoice.invoiceNumber || invoice.id || '-'} • บิล ${invoice.saleNumber || invoice.saleId || '-'}`;
  if (editBuyerNameInput) editBuyerNameInput.value = buyer.buyerName || '';
  if (editBuyerTaxIdInput) editBuyerTaxIdInput.value = buyer.buyerTaxId || '';
  if (editBuyerBranchInput) editBuyerBranchInput.value = buyer.buyerBranchName || 'สำนักงานใหญ่';
  if (editBuyerAddressInput) editBuyerAddressInput.value = buyer.buyerAddress || '';
  if (editBuyerError) editBuyerError.textContent = '';
  editBuyerDialog?.showModal();
  setTimeout(() => editBuyerNameInput?.focus(), 50);
}

function currentEditBuyer() {
  return {
    buyerName: editBuyerNameInput?.value || '',
    buyerTaxId: editBuyerTaxIdInput?.value || '',
    buyerBranchName: editBuyerBranchInput?.value || '',
    buyerAddress: editBuyerAddressInput?.value || ''
  };
}

async function submitEditBuyer() {
  if (!currentEditBuyerInvoice) return;
  editBuyerSubmitBtn.disabled = true;
  editBuyerSubmitBtn.textContent = 'กำลังบันทึก...';
  if (editBuyerError) editBuyerError.textContent = '';
  try {
    updateLocalTaxInvoiceBuyer(currentEditBuyerInvoice, currentEditBuyer());
    editBuyerDialog?.close();
    currentEditBuyerInvoice = null;
    await load();
  } catch (error) {
    if (editBuyerError) editBuyerError.textContent = error?.message || 'บันทึกข้อมูลผู้ซื้อไม่สำเร็จ';
  } finally {
    editBuyerSubmitBtn.disabled = false;
    editBuyerSubmitBtn.textContent = 'บันทึกข้อมูลผู้ซื้อ';
  }
}

function cardHtml(invoice) {
  const buyer = invoice.buyer || {};
  const seller = invoice.seller || {};
  const isVoid = invoice.status === 'void';
  const status = isVoid ? 'ยกเลิก' : 'ออกเอกสารแล้ว';
  const syncText = syncDiagnosticText(invoice);
  const receiptUrl = sourceReceiptUrl(invoice);
  return `<article class="tax-card">
    <div class="tax-card-main">
      <div class="tax-card-badges"><div class="tax-doc-no">${escapeHtml(invoice.invoiceNumber || invoice.id || '-')}</div>${syncBadge(invoice)}</div>
      <h2>${escapeHtml(buyer.buyerName || '-')}</h2>
      <div class="tax-meta">
        <span>แหล่งข้อมูล: ${escapeHtml(invoiceSourceText(invoice))}</span>
        <span>เลขภาษี: ${escapeHtml(buyer.buyerTaxId || '-')}</span>
        <span>บิล: ${escapeHtml(invoice.saleNumber || invoice.saleId || '-')}</span>
        <span>${escapeHtml(dateText(invoice.issuedAt))}</span>
      </div>
      <p>${escapeHtml(buyer.buyerAddress || '')}</p>
      <small>ผู้ขาย: ${escapeHtml(seller.sellerName || '-')} • ${escapeHtml(status)}${invoice.voidReason ? ` • เหตุผล: ${escapeHtml(invoice.voidReason)}` : ''}${syncText ? ` • ${escapeHtml(syncText)}` : ''}</small>
    </div>
    <div class="tax-card-side">
      <strong>${money(invoice.totalAmount)}</strong>
      <span>VAT ${money(invoice.vatAmount)}</span>
      <div class="tax-actions">
        <a class="btn btn-primary" href="${invoiceUrl(invoice)}" target="_blank" rel="noopener">เปิด/พิมพ์</a>
        ${receiptUrl ? `<a class="btn btn-secondary" href="${escapeHtml(receiptUrl)}" target="_blank" rel="noopener">ดูบิลต้นทาง</a>` : ''}
        ${canEditPendingBuyer(invoice) ? `<button class="btn btn-secondary" type="button" data-edit-tax-buyer="${escapeHtml(keyOf(invoice))}">แก้ผู้ซื้อ</button>` : ''}
        ${canRetrySync(invoice) ? `<button class="btn btn-secondary" type="button" data-copy-tax-sync="${escapeHtml(keyOf(invoice))}">คัดลอก Sync</button>` : ''}
        ${canRetrySync(invoice) ? '<button class="btn btn-secondary" type="button" data-retry-tax-sync="1">ลอง Sync</button>' : ''}
        ${isVoid ? '' : `<button class="btn btn-danger" type="button" data-void-tax="${escapeHtml(keyOf(invoice))}">ยกเลิก</button>`}
      </div>
    </div>
  </article>`;
}

function render() {
  const rows = filteredInvoices();
  updateSyncFilterCounts();
  updateSourceFilterCounts();
  summaryEl.textContent = `ทั้งหมด ${invoices.length.toLocaleString('th-TH')} เอกสาร • สถานะ ${syncFilterLabel()} • แหล่งข้อมูล ${sourceFilterLabel()} • แสดง ${rows.length.toLocaleString('th-TH')} เอกสาร`;
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
    const localRows = localInvoices().map(row => ({ ...row, _syncSourceLocal: true }));
    const remoteRows = remote.map(row => ({ ...row, _syncSourceRemote: true }));
    invoices = mergeInvoices(localRows, remoteRows);
    render();
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'รีเฟรช';
  }
}

searchInput?.addEventListener('input', render);
syncFilterButtons.forEach(button => {
  button.addEventListener('click', () => {
    activeSyncFilter = String(button.dataset.taxSyncFilter || 'all');
    render();
  });
});
sourceFilterButtons.forEach(button => {
  button.addEventListener('click', () => {
    activeSourceFilter = String(button.dataset.taxSourceFilter || 'all');
    render();
  });
});
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
editBuyerCancelBtn?.addEventListener('click', () => editBuyerDialog?.close());
editBuyerForm?.addEventListener('submit', event => { event.preventDefault(); submitEditBuyer(); });
listEl?.addEventListener('click', async event => {
  const editBuyerButton = event.target.closest('[data-edit-tax-buyer]');
  if (editBuyerButton) {
    const invoice = invoices.find(row => keyOf(row) === String(editBuyerButton.dataset.editTaxBuyer || ''));
    if (invoice) showEditBuyerDialog(invoice);
    return;
  }
  const copyButton = event.target.closest('[data-copy-tax-sync]');
  if (copyButton) {
    const invoice = invoices.find(row => keyOf(row) === String(copyButton.dataset.copyTaxSync || ''));
    if (!invoice) return;
    const originalText = copyButton.textContent;
    copyButton.disabled = true;
    try {
      await copyText(syncRecoveryText(invoice));
      copyButton.textContent = 'คัดลอกแล้ว';
    } catch (error) {
      console.warn('[retail-pos-tax-invoices] copy sync diagnostics failed', error);
      copyButton.textContent = 'คัดลอกไม่สำเร็จ';
    } finally {
      setTimeout(() => {
        if (copyButton.isConnected) {
          copyButton.disabled = false;
          copyButton.textContent = originalText || 'คัดลอก Sync';
        }
      }, 1200);
    }
    return;
  }
  const retryButton = event.target.closest('[data-retry-tax-sync]');
  if (retryButton) {
    retryButton.disabled = true;
    retryButton.textContent = 'กำลัง Sync...';
    try {
      await load();
    } finally {
      if (retryButton.isConnected) {
        retryButton.disabled = false;
        retryButton.textContent = 'ลอง Sync';
      }
    }
    return;
  }
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
