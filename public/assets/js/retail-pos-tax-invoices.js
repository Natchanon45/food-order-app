import { RetailCollections, listRecords } from './retail-db.js?v=20260629-032';
import { createFullTaxInvoiceFromSale, defaultBuyerFromSale, deleteTaxBuyerProfile, getExistingFullTaxInvoiceForSale, listTaxBuyerProfiles, retryTaxInvoiceSync, saveTaxBuyerProfile, syncPendingTaxInvoices, syncTaxBuyerProfiles, taxInvoiceUrl, updateLocalTaxInvoiceBuyer, voidFullTaxInvoice } from './retail-pos-full-tax-invoice.js?v=20260716-017';

const appI18n = globalThis.APP_I18N || {};
const intlLocale = appI18n.locale === 'en' ? 'en-US' : 'th-TH';
function tr(key, replacements = {}) {
  const current = appI18n.messages?.pos_tax_invoices?.dynamic?.[key];
  const fallback = appI18n.fallbackMessages?.pos_tax_invoices?.dynamic?.[key];
  let text = String(current ?? fallback ?? key);
  for (const [name, value] of Object.entries(replacements)) {
    text = text.replaceAll(`:${name}`, String(value));
  }
  return text;
}


const TAX_INVOICE_COLLECTION = 'taxInvoices';
const TAX_INVOICE_LOCAL_KEY = 'retail_pos_tax_invoices_v1';
const SALES_KEY = 'retail_pos_sales_v1';
const STALE_SYNC_MS = 24 * 60 * 60 * 1000;
const DBD_LOOKUP_URL_KEY = 'retail_pos_dbd_lookup_url';
const DEFAULT_TAX_BUYER_LOOKUP_URL = '/api/tax-buyer/lookup';
const DBD_DATAWAREHOUSE_URL = 'https://datawarehouse.dbd.go.th/juristic';

const searchInput = document.querySelector('#taxInvoiceSearch');
const syncFilterButtons = [...document.querySelectorAll('[data-tax-sync-filter]')];
const sourceFilterButtons = [...document.querySelectorAll('[data-tax-source-filter]')];
const refreshBtn = document.querySelector('#refreshBtn');
const summaryEl = document.querySelector('#summaryText');
const syncHealthEl = document.querySelector('#taxSyncHealth');
const listEl = document.querySelector('#taxInvoiceList');
const emptyEl = document.querySelector('#emptyState');
const copyViewLinkBtn = document.querySelector('#copyTaxViewLinkBtn');
const sourceSaleSearch = document.querySelector('#sourceSaleSearch');
const findSourceSaleBtn = document.querySelector('#findSourceSaleBtn');
const sourceSaleResult = document.querySelector('#sourceSaleResult');
const lateDialog = document.querySelector('#lateTaxInvoiceDialog');
const lateForm = document.querySelector('#lateTaxInvoiceForm');
const lateSaleText = document.querySelector('#lateTaxInvoiceSaleText');
const lateBuyerTaxIdInput = document.querySelector('#lateBuyerTaxIdInput');
const lateDbdLookupBtn = document.querySelector('#lateDbdLookupBtn');
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
const editDbdLookupBtn = document.querySelector('#editDbdLookupBtn');
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
let lastSyncHealth = { checkedAt: 0, pendingTaxOk: true, profileOk: true, remoteListOk: true, pendingTaxError: '', profileError: '', remoteListError: '' };

function queryValue(key) {
  try { return new URLSearchParams(location.search).get(key) || ''; }
  catch { return ''; }
}

function initialSearchQuery() {
  return queryValue('q');
}

function initialSyncFilter() {
  const value = queryValue('sync');
  return ['all', 'error', 'pending', 'support', 'stale', 'review'].includes(value) ? value : 'all';
}

function initialSourceFilter() {
  const value = queryValue('source');
  return ['all', 'remote', 'local', 'both'].includes(value) ? value : 'all';
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function iconLabel(iconClass, label) {
  return `<i class="bi ${iconClass}" aria-hidden="true"></i><span>${escapeHtml(label)}</span>`;
}

function setIconLabel(button, iconClass, label) {
  if (button) button.innerHTML = iconLabel(iconClass, label);
}

function money(value) {
  return Number(value || 0).toLocaleString(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateText(value) {
  return new Date(value || Date.now()).toLocaleString(intlLocale);
}

function normalizeTaxId(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 13);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function dbdLookupEndpoint() {
  return window.RETAIL_POS_DBD_LOOKUP_URL || localStorage.getItem(DBD_LOOKUP_URL_KEY) || DEFAULT_TAX_BUYER_LOOKUP_URL;
}

function normalizeDbdProfile(data = {}, fallbackTaxId = '') {
  const source = data.data || data.result || data.profile || data;
  return {
    buyerName: normalizeText(source.buyerName || source.juristicNameTH || source.juristicName || source.nameTh || source.name || source.companyName || ''),
    buyerTaxId: normalizeTaxId(source.buyerTaxId || source.juristicId || source.registrationNo || source.taxId || source.id || fallbackTaxId),
    buyerAddress: normalizeText(source.buyerAddress || source.addressTh || source.address || source.location || ''),
    buyerBranchName: normalizeText(source.buyerBranchName || source.branchName || source.branch || tr('head_office')) || tr('head_office')
  };
}

function manualDbdLink(taxId) {
  return `${DBD_DATAWAREHOUSE_URL}?keyword=${encodeURIComponent(taxId)}`;
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
  if (invoice._syncSourceLocal && invoice._syncSourceRemote) return tr('source_both');
  if (invoice._syncSourceRemote) return tr('source_remote');
  if (invoice._syncSourceLocal) return tr('source_local');
  return tr('source_unknown');
}

function saleKey(sale = {}) {
  return String(sale.saleNumber || sale.number || sale.id || '').trim();
}

function saleSearchText(sale = {}) {
  return [sale.id, sale.saleNumber, sale.number, sale.customerName, sale.customerDisplayName, sale.customerPhone, sale.customerCode].join(' ').toLowerCase();
}

function saleDateText(sale = {}) {
  return new Date(sale.createdAt || sale.updatedAt || Date.now()).toLocaleString(intlLocale);
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
  const escalation = shouldEscalateSync(invoice) ? tr('search_escalation') : '';
  const stale = shouldShowStaleSync(invoice) ? tr('search_stale') : '';
  const quality = qualityWarnings(invoice).join(' ');
  const recommendation = recoveryRecommendation(invoice);
  const source = invoiceSourceText(invoice);
  return [invoice.invoiceNumber, invoice.saleNumber, invoice.saleId, buyer.buyerName, buyer.buyerTaxId, buyer.buyerAddress, seller.sellerName, invoice.status, invoice.syncStatus, invoice.syncAction, invoice.syncPhase, invoice.syncTargetId, invoice.syncError, escalation, stale, quality, recommendation, source].join(' ').toLowerCase();
}

function syncBadge(invoice = {}) {
  const status = String(invoice.syncStatus || '');
  const badge = (className, label) => `<span class="sync-badge ${className}">${escapeHtml(label)}</span>`;
  const staleBadge = shouldShowStaleSync(invoice) ? badge('is-pending', tr('sync_stale')) : '';
  const qualityBadge = needsQualityReview(invoice) ? badge('is-pending', tr('review_data')) : '';
  if (invoice.syncError) return `${badge('is-error', tr('sync_failed'))}${shouldEscalateSync(invoice) ? badge('is-pending', tr('send_support')) : ''}${staleBadge}${qualityBadge}`;
  if (['pending_create', 'pending_void'].includes(status)) return `${badge('is-pending', tr('pending_sync'))}${staleBadge}${qualityBadge}`;
  if (['local_only', 'local_void'].includes(status)) return `${badge('is-local', tr('local_document'))}${staleBadge}${qualityBadge}`;
  if (invoice.runningNumberStatus === 'local_only') return `${badge('is-local', tr('temporary_number'))}${staleBadge}${qualityBadge}`;
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
  if (canEditPendingBuyer(invoice) && !String(buyer.buyerName || '').trim()) warnings.push('missing_buyer_name');
  if (canEditPendingBuyer(invoice) && !normalizeTaxId(buyer.buyerTaxId)) warnings.push('missing_buyer_tax_id');
  if (!sourceSaleKey(invoice)) warnings.push('missing_source_receipt');
  return warnings;
}

function needsQualityReview(invoice = {}) {
  return qualityWarnings(invoice).length > 0;
}

function recoveryRecommendation(invoice = {}) {
  if (!canRetrySync(invoice)) return '';
  if (shouldEscalateSync(invoice)) return tr('recommend_support');
  const warnings = qualityWarnings(invoice);
  if (warnings.some(key => ['missing_buyer_name', 'missing_buyer_tax_id'].includes(key))) return tr('recommend_edit_buyer');
  if (warnings.includes('missing_source_receipt')) return tr('recommend_source_receipt');
  if (shouldShowStaleSync(invoice)) return tr('recommend_stale');
  if (invoice.syncError) return tr('recommend_retry_or_copy');
  return tr('recommend_retry');
}

function syncDiagnosticText(invoice = {}) {
  const recommendation = recoveryRecommendation(invoice);
  if (!invoice.syncError && !shouldShowStaleSync(invoice) && !needsQualityReview(invoice) && !recommendation) return '';
  const parts = invoice.syncError ? [tr('diagnostic_error', { error: invoice.syncError })] : [];
  const action = String(invoice.syncAction || '').trim();
  const phase = String(invoice.syncPhase || '').trim();
  if (action || phase) parts.push(tr('diagnostic_job', { job: `${action || '-'}${phase ? ` / ${phase}` : ''}` }));
  const count = Number(invoice.syncAttemptCount || 0);
  if (count > 0) parts.push(tr('diagnostic_attempts', { count: count.toLocaleString(intlLocale) }));
  const attemptedAt = syncReferenceTime(invoice);
  if (attemptedAt > 0) parts.push(tr('diagnostic_latest', { date: dateText(attemptedAt) }));
  if (shouldShowStaleSync(invoice)) parts.push(tr('diagnostic_stale_hours', { count: staleSyncHours(invoice).toLocaleString(intlLocale) }));
  if (needsQualityReview(invoice)) parts.push(tr('diagnostic_review', { warnings: qualityWarnings(invoice).map(key => tr(key)).join(', ') }));
  if (shouldEscalateSync(invoice)) parts.push(tr('diagnostic_escalate'));
  if (recommendation) parts.push(recommendation);
  return parts.join(' • ');
}

function syncRecoveryText(invoice = {}) {
  const buyer = invoice.buyer || {};
  const receiptUrl = sourceReceiptUrl(invoice);
  return [
    tr('recovery_title'),
    `Invoice ID: ${keyOf(invoice) || '-'}`,
    `Invoice No: ${invoice.invoiceNumber || '-'}`,
    `Sale: ${invoice.saleNumber || invoice.saleId || invoice.sourceSale?.saleNumber || invoice.sourceSale?.id || '-'}`,
    `Tax History: ${historySearchUrl(invoice)}`,
    `Source Receipt: ${receiptUrl || '-'}`,
    `Buyer: ${buyer.buyerName || '-'}`,
    `Status: ${invoice.status || '-'}`,
    `${tr('recovery_sync_status')}: ${invoice.syncStatus || '-'}`,
    `${tr('recovery_action')}: ${invoice.syncAction || '-'}`,
    `${tr('recovery_phase')}: ${invoice.syncPhase || '-'}`,
    `${tr('recovery_target')}: ${invoice.syncTargetId || '-'}`,
    `${tr('recovery_error')}: ${invoice.syncError || '-'}`,
    `${tr('recovery_attempts')}: ${Number(invoice.syncAttemptCount || 0)}`,
    `${tr('recovery_escalation')}: ${shouldEscalateSync(invoice) ? tr('send_support') : '-'}`,
    `${tr('recovery_stale')}: ${shouldShowStaleSync(invoice) ? `${staleSyncHours(invoice)} hours` : '-'}`,
    `Quality Check: ${needsQualityReview(invoice) ? qualityWarnings(invoice).map(key => tr(key)).join(', ') : '-'}`,
    `Recommended Action: ${recoveryRecommendation(invoice) || '-'}`,
    `Data Source: ${invoiceSourceText(invoice)}`,
    `${tr('recovery_reference_time')}: ${syncReferenceTime(invoice) ? dateText(syncReferenceTime(invoice)) : '-'}`,
    `${tr('recovery_last_attempt')}: ${invoice.syncAttemptedAt || invoice.syncErrorAt ? dateText(invoice.syncAttemptedAt || invoice.syncErrorAt) : '-'}`
  ].join('\n');
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (error) {
      console.warn('[retail-pos-tax-invoices] clipboard api fallback', error);
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('copy command failed');
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
  if (activeSyncFilter === 'error') return tr('sync_failed');
  if (activeSyncFilter === 'pending') return tr('pending_sync');
  if (activeSyncFilter === 'support') return tr('send_support');
  if (activeSyncFilter === 'stale') return tr('sync_stale');
  if (activeSyncFilter === 'review') return tr('review_data');
  return tr('all');
}

function sourceFilterLabel() {
  if (activeSourceFilter === 'remote') return tr('remote_only');
  if (activeSourceFilter === 'local') return tr('local_only');
  if (activeSourceFilter === 'both') return tr('both');
  return tr('all_sources');
}

function syncFilterForInvoice(invoice = {}) {
  if (shouldEscalateSync(invoice)) return 'support';
  if (invoice.syncError) return 'error';
  if (shouldShowStaleSync(invoice)) return 'stale';
  if (needsQualityReview(invoice)) return 'review';
  if (isPendingSync(invoice)) return 'pending';
  return 'all';
}

function conciseError(error) {
  return String(error?.message || error || '').replace(/\s+/g, ' ').trim().slice(0, 90);
}

function sourceFilterForInvoice(invoice = {}) {
  if (invoice._syncSourceLocal && invoice._syncSourceRemote) return 'both';
  if (invoice._syncSourceRemote) return 'remote';
  if (invoice._syncSourceLocal) return 'local';
  return 'all';
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
    if (countEl) countEl.textContent = Number(counts[key] || 0).toLocaleString(intlLocale);
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
    if (countEl) countEl.textContent = Number(counts[key] || 0).toLocaleString(intlLocale);
  });
}

function syncHealthCounts() {
  return {
    all: invoices.length,
    error: invoices.filter(invoice => invoice.syncError).length,
    pending: invoices.filter(isPendingSync).length,
    support: invoices.filter(shouldEscalateSync).length,
    stale: invoices.filter(shouldShowStaleSync).length,
    review: invoices.filter(needsQualityReview).length,
    remote: invoices.filter(invoice => invoice._syncSourceRemote && !invoice._syncSourceLocal).length,
    local: invoices.filter(invoice => invoice._syncSourceLocal && !invoice._syncSourceRemote).length,
    both: invoices.filter(invoice => invoice._syncSourceLocal && invoice._syncSourceRemote).length
  };
}

function syncHealthChip(label, value, className = '', attrs = '') {
  return `<button class="tax-sync-health-chip${className ? ` ${className}` : ''}" type="button" ${attrs}>${escapeHtml(label)} <strong>${Number(value || 0).toLocaleString(intlLocale)}</strong></button>`;
}

function renderSyncHealth() {
  if (!syncHealthEl) return;
  const counts = syncHealthCounts();
  const loadErrors = [lastSyncHealth.pendingTaxError, lastSyncHealth.profileError, lastSyncHealth.remoteListError].filter(Boolean);
  const hasErrors = counts.error > 0 || loadErrors.length > 0;
  const hasWarnings = counts.pending > 0 || counts.stale > 0 || counts.review > 0 || counts.support > 0;
  const stateClass = hasErrors ? 'is-error' : hasWarnings ? 'is-warning' : '';
  const title = hasErrors ? tr('health_error') : hasWarnings ? tr('health_warning') : tr('health_ok');
  const checkedText = lastSyncHealth.checkedAt ? dateText(lastSyncHealth.checkedAt) : tr('not_checked');
  syncHealthEl.className = `tax-sync-health${stateClass ? ` ${stateClass}` : ''}`;
  syncHealthEl.innerHTML = `
    <div class="tax-sync-health-main">
      <p class="tax-sync-health-title">${title}</p>
      <p class="tax-sync-health-state">${escapeHtml(tr('last_checked'))} <strong>${escapeHtml(checkedText)}</strong>${loadErrors.length ? ` • ${escapeHtml(loadErrors.join(' • '))}` : ''}</p>
    </div>
    <div class="tax-sync-health-grid">
      ${syncHealthChip(tr('all'), counts.all, '', 'data-health-sync-filter="all" data-health-source-filter="all"')}
      ${syncHealthChip(tr('sync_failed'), counts.error, counts.error ? 'is-error' : '', 'data-health-sync-filter="error"')}
      ${syncHealthChip(tr('pending_sync'), counts.pending, counts.pending ? 'is-warning' : '', 'data-health-sync-filter="pending"')}
      ${syncHealthChip(tr('sync_stale'), counts.stale, counts.stale ? 'is-warning' : '', 'data-health-sync-filter="stale"')}
      ${syncHealthChip(tr('review_data'), counts.review, counts.review ? 'is-warning' : '', 'data-health-sync-filter="review"')}
      ${syncHealthChip(tr('source_remote'), counts.remote, '', 'data-health-source-filter="remote"')}
      ${syncHealthChip(tr('source_local'), counts.local, counts.local ? 'is-muted' : '', 'data-health-source-filter="local"')}
      ${syncHealthChip(tr('both'), counts.both, '', 'data-health-source-filter="both"')}
    </div>`;
}

function applyHealthShortcut(button) {
  const syncFilter = String(button?.dataset?.healthSyncFilter || '').trim();
  const sourceFilter = String(button?.dataset?.healthSourceFilter || '').trim();
  if (syncFilter) activeSyncFilter = syncFilter;
  if (sourceFilter) activeSourceFilter = sourceFilter;
  render();
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

function currentHistoryUrl() {
  const url = new URL(location.href);
  const q = String(searchInput?.value || '').trim();
  if (q) url.searchParams.set('q', q);
  else url.searchParams.delete('q');
  if (activeSyncFilter !== 'all') url.searchParams.set('sync', activeSyncFilter);
  else url.searchParams.delete('sync');
  if (activeSourceFilter !== 'all') url.searchParams.set('source', activeSourceFilter);
  else url.searchParams.delete('source');
  return url;
}

function syncHistoryUrlState() {
  if (!history.replaceState) return;
  const url = currentHistoryUrl();
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  if (nextUrl !== `${location.pathname}${location.search}${location.hash}`) {
    history.replaceState(null, '', nextUrl);
  }
}

function hasActiveFilters() {
  return Boolean(String(searchInput?.value || '').trim() || activeSyncFilter !== 'all' || activeSourceFilter !== 'all');
}

function resetFilters() {
  if (searchInput) searchInput.value = '';
  activeSyncFilter = 'all';
  activeSourceFilter = 'all';
  render();
}

async function copyCurrentViewLink() {
  if (!copyViewLinkBtn) return;
  syncHistoryUrlState();
  const originalHtml = copyViewLinkBtn.innerHTML;
  copyViewLinkBtn.disabled = true;
  try {
    await copyText(currentHistoryUrl().toString());
    setIconLabel(copyViewLinkBtn, 'bi-check-lg', tr('copied'));
  } catch (error) {
    console.warn('[retail-pos-tax-invoices] copy view link failed', error);
    setIconLabel(copyViewLinkBtn, 'bi-exclamation-triangle', tr('copy_failed'));
  } finally {
    setTimeout(() => {
      if (copyViewLinkBtn.isConnected) {
        copyViewLinkBtn.disabled = false;
        copyViewLinkBtn.innerHTML = originalHtml || iconLabel('bi-link-45deg', tr('copy_view_link'));
      }
    }, 1200);
  }
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
  const invoiceKeyValue = keyOf(invoice);
  if (!saleKeyValue && !invoiceKeyValue) return '';
  const url = new URL('/pos/receipt/', location.origin);
  if (saleKeyValue) url.searchParams.set('saleId', saleKeyValue);
  if (invoiceKeyValue) url.searchParams.set('taxInvoiceId', invoiceKeyValue);
  url.searchParams.set('auto', '0');
  return url.toString();
}

function historySearchUrl(invoice = {}) {
  const searchKey = keyOf(invoice) || invoice.invoiceNumber || invoice.saleNumber || invoice.saleId || '';
  if (!searchKey) return new URL('/pos/tax-invoices/', location.origin).toString();
  const url = new URL('/pos/tax-invoices/', location.origin);
  url.searchParams.set('q', searchKey);
  const syncFilter = syncFilterForInvoice(invoice);
  const sourceFilter = sourceFilterForInvoice(invoice);
  if (syncFilter !== 'all') url.searchParams.set('sync', syncFilter);
  if (sourceFilter !== 'all') url.searchParams.set('source', sourceFilter);
  return url.toString();
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

function profileSyncState(profile = {}) {
  const status = String(profile.syncStatus || '').trim();
  if (status === 'pending_sync') return { className: 'is-pending', label: tr('pending_sync') };
  if (status === 'synced' || profile.firebaseSyncedAt) return { className: 'is-synced', label: tr('synced') };
  return { className: 'is-local', label: tr('source_local') };
}

function profileSyncDetail(profile = {}) {
  const error = String(profile.syncError || '').trim();
  if (error) {
    const count = Number(profile.syncAttemptCount || 0);
    const attemptText = count > 0 ? ` • ${tr('attempt_count', { count: count.toLocaleString(intlLocale) })}` : '';
    return ` • ${tr('sync_error_detail', { error })}${attemptText}`;
  }
  const syncedAt = Number(profile.firebaseSyncedAt || 0);
  if (syncedAt) return ` • ${tr('last_sync', { date: dateText(syncedAt) })}`;
  if (String(profile.syncStatus || '') === 'pending_sync') return ` • ${tr('waiting_central_sync')}`;
  return '';
}

function resetProfileForm(profile = {}) {
  if (profileIdInput) {
    profileIdInput.value = profile.id || profile.customerKey || '';
    profileIdInput.readOnly = Boolean(profile.id || profile.customerKey);
  }
  if (profileNameInput) profileNameInput.value = profile.buyerName || '';
  if (profileTaxIdInput) profileTaxIdInput.value = profile.buyerTaxId || '';
  if (profileAddressInput) profileAddressInput.value = profile.buyerAddress || '';
  if (profileBranchInput) profileBranchInput.value = profile.buyerBranchName || tr('head_office');
  if (profileError) profileError.textContent = '';
  if (profileDeleteBtn) profileDeleteBtn.hidden = !(profile.id || profile.customerKey);
}

function renderProfiles(selectedId = '') {
  if (!profileListEl) return;
  const rows = profileRows();
  if (!rows.length) {
    profileListEl.innerHTML = `<div class="profile-empty">${escapeHtml(tr('no_profiles'))}</div>`;
    resetProfileForm();
    return;
  }
  profileListEl.innerHTML = rows.map(profile => {
    const id = profile.id || profile.customerKey || '';
    const state = profileSyncState(profile);
    return `<button class="profile-row${String(id) === String(selectedId) ? ' is-active' : ''}" type="button" data-profile-id="${escapeHtml(id)}" data-pos-icon="person-vcard">
      <strong>${escapeHtml(profile.buyerName || '-')} <span class="profile-sync-badge ${state.className}">${escapeHtml(state.label)}</span></strong>
      <span>${escapeHtml(profile.buyerTaxId || '-')} • ${escapeHtml(profile.buyerBranchName || tr('head_office'))}${escapeHtml(profileSyncDetail(profile))}</span>
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
    if (profileError) profileError.textContent = error?.message || tr('profile_save_failed');
  }
}

function deleteProfileForm() {
  const id = selectedProfileId();
  if (!id) return;
  const ok = window.confirm(tr('profile_delete_confirm'));
  if (!ok) return;
  deleteTaxBuyerProfile(id);
  renderProfiles();
  syncTaxBuyerProfiles()
    .then(() => renderProfiles())
    .catch(error => console.warn('[retail-pos-tax-invoices] tax profile delete sync skipped', error));
}

function applyBuyer(buyer = {}) {
  if (lateBuyerNameInput) lateBuyerNameInput.value = buyer.buyerName || '';
  if (lateBuyerTaxIdInput) lateBuyerTaxIdInput.value = buyer.buyerTaxId || '';
  if (lateBuyerAddressInput) lateBuyerAddressInput.value = buyer.buyerAddress || '';
  if (lateBuyerBranchInput) lateBuyerBranchInput.value = buyer.buyerBranchName || tr('head_office');
}

function fillLateBuyerFromDbd(profile = {}) {
  if (lateBuyerTaxIdInput && profile.buyerTaxId) lateBuyerTaxIdInput.value = profile.buyerTaxId;
  if (lateBuyerNameInput && profile.buyerName) lateBuyerNameInput.value = profile.buyerName;
  if (lateBuyerAddressInput && profile.buyerAddress) lateBuyerAddressInput.value = profile.buyerAddress;
  if (lateBuyerBranchInput && profile.buyerBranchName) lateBuyerBranchInput.value = profile.buyerBranchName;
}

function fillEditBuyerFromDbd(profile = {}) {
  if (editBuyerTaxIdInput && profile.buyerTaxId) editBuyerTaxIdInput.value = profile.buyerTaxId;
  if (editBuyerNameInput && profile.buyerName) editBuyerNameInput.value = profile.buyerName;
  if (editBuyerAddressInput && profile.buyerAddress) editBuyerAddressInput.value = profile.buyerAddress;
  if (editBuyerBranchInput && profile.buyerBranchName) editBuyerBranchInput.value = profile.buyerBranchName;
}

function dbdManualButtonHtml(id, taxId) {
  const url = manualDbdLink(taxId);
  return `<button id="${id}" class="dbd-btn" type="button" data-url="${escapeHtml(url)}"><i class="bi bi-clipboard" aria-hidden="true"></i><span>${escapeHtml(tr('copy_dbd_link'))}</span></button>`;
}

function showLateManualDbdMessage(taxId) {
  if (!lateTaxInvoiceError) return;
  lateTaxInvoiceError.innerHTML = `${escapeHtml(tr('dbd_auto_failed'))}<br>${dbdManualButtonHtml('copyLateDbdLinkBtn', taxId)}<br><small>${escapeHtml(tr('dbd_manual_help'))}</small>`;
}

function showEditManualDbdMessage(taxId) {
  if (!editBuyerError) return;
  editBuyerError.innerHTML = `${escapeHtml(tr('dbd_auto_failed'))}<br>${dbdManualButtonHtml('copyEditDbdLinkBtn', taxId)}<br><small>${escapeHtml(tr('dbd_manual_help'))}</small>`;
}

async function fetchDbdProfile(taxId) {
  const url = new URL(dbdLookupEndpoint(), location.origin);
  url.searchParams.set('taxId', taxId);
  const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('DBD lookup failed');
  const profile = normalizeDbdProfile(await response.json(), taxId);
  if (!profile.buyerName && !profile.buyerAddress) throw new Error(tr('dbd_not_found'));
  return profile;
}

async function lookupLateBuyerDbd() {
  const taxId = normalizeTaxId(lateBuyerTaxIdInput?.value || '');
  if (lateBuyerTaxIdInput) lateBuyerTaxIdInput.value = taxId;
  if (lateTaxInvoiceError) lateTaxInvoiceError.textContent = '';
  if (!taxId || taxId.length < 13) {
    if (lateTaxInvoiceError) lateTaxInvoiceError.textContent = tr('tax_id_required');
    lateBuyerTaxIdInput?.focus();
    return;
  }
  if (lateDbdLookupBtn) {
    lateDbdLookupBtn.disabled = true;
    setIconLabel(lateDbdLookupBtn, 'bi-hourglass-split', tr('searching'));
  }
  try {
    const profile = await fetchDbdProfile(taxId);
    fillLateBuyerFromDbd(profile);
    if (lateTaxInvoiceError) lateTaxInvoiceError.textContent = tr('dbd_issue_success');
  } catch (error) {
    showLateManualDbdMessage(taxId);
  } finally {
    if (lateDbdLookupBtn) {
      lateDbdLookupBtn.disabled = false;
      setIconLabel(lateDbdLookupBtn, 'bi-search', 'DBD');
    }
  }
}

async function lookupEditBuyerDbd() {
  const taxId = normalizeTaxId(editBuyerTaxIdInput?.value || '');
  if (editBuyerTaxIdInput) editBuyerTaxIdInput.value = taxId;
  if (editBuyerError) editBuyerError.textContent = '';
  if (!taxId || taxId.length < 13) {
    if (editBuyerError) editBuyerError.textContent = tr('tax_id_required');
    editBuyerTaxIdInput?.focus();
    return;
  }
  if (editDbdLookupBtn) {
    editDbdLookupBtn.disabled = true;
    setIconLabel(editDbdLookupBtn, 'bi-hourglass-split', tr('searching'));
  }
  try {
    const profile = await fetchDbdProfile(taxId);
    fillEditBuyerFromDbd(profile);
    if (editBuyerError) editBuyerError.textContent = tr('dbd_save_success');
  } catch (error) {
    showEditManualDbdMessage(taxId);
  } finally {
    if (editDbdLookupBtn) {
      editDbdLookupBtn.disabled = false;
      setIconLabel(editDbdLookupBtn, 'bi-search', 'DBD');
    }
  }
}

function setSourceSaleMessage(message = '', { error = false } = {}) {
  if (!sourceSaleResult) return;
  sourceSaleResult.classList.toggle('is-error', Boolean(error));
  sourceSaleResult.innerHTML = message;
}

function sourceSaleCard(sale, actionHtml = '') {
  const number = saleKey(sale) || '-';
  return `<div class="issue-sale-card"><div><strong>${escapeHtml(number)}</strong><div>${escapeHtml(saleDateText(sale))} • ${escapeHtml(tr('net_total', { amount: money(sale.totalAmount ?? sale.total) }))}</div></div>${actionHtml}</div>`;
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
  if (lateSaleText) lateSaleText.textContent = tr('sale_summary', { receipt: saleKey(sale) || '-', date: saleDateText(sale), amount: money(sale.totalAmount ?? sale.total) });
  if (lateTaxInvoiceError) lateTaxInvoiceError.textContent = '';
  lateDialog?.showModal();
  setTimeout(() => lateBuyerTaxIdInput?.focus(), 50);
}

async function findSourceSale() {
  const queryText = sourceSaleSearch?.value || '';
  if (!String(queryText).trim()) {
    setSourceSaleMessage(tr('source_required'), { error: true });
    sourceSaleSearch?.focus();
    return;
  }
  findSourceSaleBtn.disabled = true;
  setIconLabel(findSourceSaleBtn, 'bi-hourglass-split', tr('searching'));
  setSourceSaleMessage(tr('searching_receipt'));
  try {
    await loadSalesForSearch();
    const sale = findSale(queryText);
    if (!sale) {
      setSourceSaleMessage(tr('source_not_found'), { error: true });
      return;
    }
    const existing = existingInvoiceForSale(sale);
    if (existing) {
      setSourceSaleMessage(sourceSaleCard(sale, `<button class="btn btn-secondary" type="button" data-open-existing-tax="${escapeHtml(existing.id || existing.invoiceNumber || '')}">${escapeHtml(tr('open_existing'))}</button>`));
      openInvoice(existing);
      return;
    }
    setSourceSaleMessage(sourceSaleCard(sale, `<button class="btn btn-primary" type="button" data-issue-late-tax="1">${escapeHtml(tr('issue_invoice'))}</button>`));
    showLateTaxDialog(sale);
  } finally {
    findSourceSaleBtn.disabled = false;
    setIconLabel(findSourceSaleBtn, 'bi-search', tr('find_receipt'));
  }
}

async function submitLateTaxInvoice() {
  if (!currentSourceSale) return;
  lateTaxInvoiceSubmitBtn.disabled = true;
  setIconLabel(lateTaxInvoiceSubmitBtn, 'bi-hourglass-split', tr('issuing'));
  if (lateTaxInvoiceError) lateTaxInvoiceError.textContent = '';
  try {
    const invoice = await createFullTaxInvoiceFromSale(currentSourceSale, currentBuyer());
    lateDialog?.close();
    openInvoice(invoice);
    await load();
    setSourceSaleMessage(sourceSaleCard(currentSourceSale, `<a class="btn btn-primary" href="${invoiceUrl(invoice)}" target="_blank" rel="noopener">${escapeHtml(tr('open_print'))}</a>`));
  } catch (error) {
    if (lateTaxInvoiceError) lateTaxInvoiceError.textContent = error?.message || tr('issue_failed');
  } finally {
    lateTaxInvoiceSubmitBtn.disabled = false;
    setIconLabel(lateTaxInvoiceSubmitBtn, 'bi-send', tr('issue_invoice'));
  }
}

function showVoidDialog(invoice) {
  currentVoidInvoice = invoice;
  if (voidText) voidText.textContent = tr('invoice_receipt_summary', { invoice: invoice.invoiceNumber || invoice.id || '-', receipt: invoice.saleNumber || invoice.saleId || '-' });
  if (voidReasonInput) voidReasonInput.value = '';
  if (voidError) voidError.textContent = '';
  voidDialog?.showModal();
  setTimeout(() => voidReasonInput?.focus(), 50);
}

async function submitVoidInvoice() {
  if (!currentVoidInvoice) return;
  voidSubmitBtn.disabled = true;
  setIconLabel(voidSubmitBtn, 'bi-hourglass-split', tr('voiding'));
  if (voidError) voidError.textContent = '';
  try {
    await voidFullTaxInvoice(currentVoidInvoice, voidReasonInput?.value || '');
    voidDialog?.close();
    currentVoidInvoice = null;
    await load();
  } catch (error) {
    if (voidError) voidError.textContent = error?.message || tr('void_failed');
  } finally {
    voidSubmitBtn.disabled = false;
    setIconLabel(voidSubmitBtn, 'bi-x-circle', tr('confirm_void'));
  }
}

function showEditBuyerDialog(invoice) {
  currentEditBuyerInvoice = invoice;
  const buyer = invoice.buyer || {};
  if (editBuyerText) editBuyerText.textContent = tr('invoice_receipt_summary', { invoice: invoice.invoiceNumber || invoice.id || '-', receipt: invoice.saleNumber || invoice.saleId || '-' });
  if (editBuyerNameInput) editBuyerNameInput.value = buyer.buyerName || '';
  if (editBuyerTaxIdInput) editBuyerTaxIdInput.value = buyer.buyerTaxId || '';
  if (editBuyerBranchInput) editBuyerBranchInput.value = buyer.buyerBranchName || tr('head_office');
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
  setIconLabel(editBuyerSubmitBtn, 'bi-hourglass-split', tr('saving'));
  if (editBuyerError) editBuyerError.textContent = '';
  try {
    updateLocalTaxInvoiceBuyer(currentEditBuyerInvoice, currentEditBuyer());
    editBuyerDialog?.close();
    currentEditBuyerInvoice = null;
    await load();
  } catch (error) {
    if (editBuyerError) editBuyerError.textContent = error?.message || tr('buyer_save_failed');
  } finally {
    editBuyerSubmitBtn.disabled = false;
    setIconLabel(editBuyerSubmitBtn, 'bi-floppy', tr('save_buyer'));
  }
}

function cardHtml(invoice) {
  const buyer = invoice.buyer || {};
  const seller = invoice.seller || {};
  const isVoid = invoice.status === 'void';
  const status = isVoid ? tr('voided') : tr('issued');
  const syncText = syncDiagnosticText(invoice);
  const receiptUrl = sourceReceiptUrl(invoice);
  return `<article class="tax-card">
    <div class="tax-card-main">
      <div class="tax-card-badges"><div class="tax-doc-no">${escapeHtml(invoice.invoiceNumber || invoice.id || '-')}</div>${syncBadge(invoice)}</div>
      <h2>${escapeHtml(buyer.buyerName || '-')}</h2>
      <div class="tax-meta">
        <span>${escapeHtml(tr('data_source'))}: ${escapeHtml(invoiceSourceText(invoice))}</span>
        <span>${escapeHtml(tr('tax_id'))}: ${escapeHtml(buyer.buyerTaxId || '-')}</span>
        <span>${escapeHtml(tr('receipt'))}: ${escapeHtml(invoice.saleNumber || invoice.saleId || '-')}</span>
        <span>${escapeHtml(dateText(invoice.issuedAt))}</span>
      </div>
      <p>${escapeHtml(buyer.buyerAddress || '')}</p>
      <small>${escapeHtml(tr('seller'))}: ${escapeHtml(seller.sellerName || '-')} • ${escapeHtml(status)}${invoice.voidReason ? ` • ${escapeHtml(tr('reason'))}: ${escapeHtml(invoice.voidReason)}` : ''}${syncText ? ` • ${escapeHtml(syncText)}` : ''}</small>
    </div>
    <div class="tax-card-side">
      <strong>${money(invoice.totalAmount)}</strong>
      <span>VAT ${money(invoice.vatAmount)}</span>
      <div class="tax-actions">
        <a class="btn btn-primary" href="${invoiceUrl(invoice)}" target="_blank" rel="noopener">${iconLabel('bi-printer', tr('open_print'))}</a>
        ${receiptUrl ? `<a class="btn btn-secondary" href="${escapeHtml(receiptUrl)}" target="_blank" rel="noopener">${iconLabel('bi-receipt', tr('view_source_receipt'))}</a>` : ''}
        ${canEditPendingBuyer(invoice) ? `<button class="btn btn-secondary" type="button" data-edit-tax-buyer="${escapeHtml(keyOf(invoice))}">${iconLabel('bi-pencil-square', tr('edit_buyer'))}</button>` : ''}
        ${canRetrySync(invoice) ? `<button class="btn btn-secondary" type="button" data-copy-tax-sync="${escapeHtml(keyOf(invoice))}">${iconLabel('bi-clipboard', tr('copy_diagnostics'))}</button>` : ''}
        ${canRetrySync(invoice) ? `<button class="btn btn-secondary" type="button" data-retry-tax-sync="${escapeHtml(keyOf(invoice))}">${iconLabel('bi-arrow-repeat', tr('retry_sync'))}</button>` : ''}
        ${isVoid ? '' : `<button class="btn btn-danger" type="button" data-void-tax="${escapeHtml(keyOf(invoice))}">${iconLabel('bi-x-circle', tr('void'))}</button>`}
      </div>
    </div>
  </article>`;
}

function render() {
  const rows = filteredInvoices();
  syncHistoryUrlState();
  updateSyncFilterCounts();
  updateSourceFilterCounts();
  renderSyncHealth();
  summaryEl.textContent = tr('summary', { total: invoices.length.toLocaleString(intlLocale), status: syncFilterLabel(), source: sourceFilterLabel(), shown: rows.length.toLocaleString(intlLocale) });
  emptyEl.hidden = rows.length > 0;
  emptyEl.innerHTML = hasActiveFilters()
    ? `${escapeHtml(tr('filtered_empty'))} <button class="btn btn-secondary" type="button" data-clear-tax-filters="1">${escapeHtml(tr('clear_filters'))}</button>`
    : escapeHtml(tr('empty'));
  listEl.innerHTML = rows.map(cardHtml).join('');
}

async function load({ sync = true } = {}) {
  refreshBtn.disabled = true;
  setIconLabel(refreshBtn, 'bi-hourglass-split', tr('loading'));
  lastSyncHealth = { checkedAt: Date.now(), pendingTaxOk: true, profileOk: true, remoteListOk: true, pendingTaxError: '', profileError: '', remoteListError: '' };
  try {
    try { if (sync) await syncPendingTaxInvoices(); }
    catch (error) {
      lastSyncHealth.pendingTaxOk = false;
      lastSyncHealth.pendingTaxError = tr('invoice_load_error', { error: conciseError(error) || 'sync skipped' });
      console.warn('[retail-pos-tax-invoices] pending sync skipped', error);
    }
    try { await syncTaxBuyerProfiles(); }
    catch (error) {
      lastSyncHealth.profileOk = false;
      lastSyncHealth.profileError = tr('profile_load_error', { error: conciseError(error) || 'sync skipped' });
      console.warn('[retail-pos-tax-invoices] tax profile sync skipped', error);
    }
    let remote = [];
    try {
      remote = await listRecords(TAX_INVOICE_COLLECTION, { sortBy: 'issuedAt', direction: 'desc' });
    }
    catch (error) {
      lastSyncHealth.remoteListOk = false;
      lastSyncHealth.remoteListError = tr('remote_load_error', { error: conciseError(error) || 'list fallback' });
      console.warn('[retail-pos-tax-invoices] firebase/list fallback', error);
    }
    const localRows = localInvoices().map(row => ({ ...row, _syncSourceLocal: true }));
    const remoteRows = remote.map(row => ({ ...row, _syncSourceRemote: true }));
    invoices = mergeInvoices(localRows, remoteRows);
    render();
  } finally {
    refreshBtn.disabled = false;
    setIconLabel(refreshBtn, 'bi-arrow-clockwise', tr('refresh'));
  }
}

if (searchInput && initialSearchQuery()) searchInput.value = initialSearchQuery();
activeSyncFilter = initialSyncFilter();
activeSourceFilter = initialSourceFilter();
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
copyViewLinkBtn?.addEventListener('click', copyCurrentViewLink);
syncHealthEl?.addEventListener('click', event => {
  const button = event.target.closest('[data-health-sync-filter],[data-health-source-filter]');
  if (button) applyHealthShortcut(button);
});
emptyEl?.addEventListener('click', event => {
  if (event.target.closest('[data-clear-tax-filters]')) resetFilters();
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
lateDbdLookupBtn?.addEventListener('click', lookupLateBuyerDbd);
lateForm?.addEventListener('click', async event => {
  const button = event.target.closest('#copyLateDbdLinkBtn');
  if (!button) return;
  event.preventDefault();
  const url = button.dataset.url || manualDbdLink(normalizeTaxId(lateBuyerTaxIdInput?.value || ''));
  try {
    await copyText(url);
    if (lateTaxInvoiceError) lateTaxInvoiceError.textContent = tr('dbd_link_copied');
  } catch (error) {
    if (lateTaxInvoiceError) lateTaxInvoiceError.textContent = tr('copy_link_manually', { url });
  }
});
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
editDbdLookupBtn?.addEventListener('click', lookupEditBuyerDbd);
editBuyerForm?.addEventListener('click', async event => {
  const button = event.target.closest('#copyEditDbdLinkBtn');
  if (!button) return;
  event.preventDefault();
  const url = button.dataset.url || manualDbdLink(normalizeTaxId(editBuyerTaxIdInput?.value || ''));
  try {
    await copyText(url);
    if (editBuyerError) editBuyerError.textContent = tr('dbd_link_copied');
  } catch (error) {
    if (editBuyerError) editBuyerError.textContent = tr('copy_link_manually', { url });
  }
});
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
    const originalHtml = copyButton.innerHTML;
    copyButton.disabled = true;
    try {
      await copyText(syncRecoveryText(invoice));
      setIconLabel(copyButton, 'bi-check-lg', tr('copied'));
    } catch (error) {
      console.warn('[retail-pos-tax-invoices] copy sync diagnostics failed', error);
      setIconLabel(copyButton, 'bi-exclamation-triangle', tr('copy_failed'));
    } finally {
      setTimeout(() => {
        if (copyButton.isConnected) {
          copyButton.disabled = false;
          copyButton.innerHTML = originalHtml || iconLabel('bi-clipboard', tr('copy_diagnostics'));
        }
      }, 1200);
    }
    return;
  }
  const retryButton = event.target.closest('[data-retry-tax-sync]');
  if (retryButton) {
    const invoice = invoices.find(row => keyOf(row) === String(retryButton.dataset.retryTaxSync || ''));
    retryButton.disabled = true;
    setIconLabel(retryButton, 'bi-hourglass-split', tr('syncing'));
    try {
      if (invoice) await retryTaxInvoiceSync(invoice);
      await load({ sync: false });
    } finally {
      if (retryButton.isConnected) {
        retryButton.disabled = false;
        setIconLabel(retryButton, 'bi-arrow-repeat', tr('retry_sync'));
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
window.addEventListener('storage', event => { if (!event.key || event.key === TAX_INVOICE_LOCAL_KEY) load({ sync: false }); });
window.addEventListener('online', load);
load();
loadSalesForSearch();
