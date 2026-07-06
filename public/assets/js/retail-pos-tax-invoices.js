import { listRecords } from './retail-db.js?v=20260629-032';

const TAX_INVOICE_COLLECTION = 'taxInvoices';
const TAX_INVOICE_LOCAL_KEY = 'retail_pos_tax_invoices_v1';

const searchInput = document.querySelector('#taxInvoiceSearch');
const refreshBtn = document.querySelector('#refreshBtn');
const summaryEl = document.querySelector('#summaryText');
const listEl = document.querySelector('#taxInvoiceList');
const emptyEl = document.querySelector('#emptyState');
let invoices = [];

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

function localInvoices() {
  const rows = readJson(TAX_INVOICE_LOCAL_KEY, []);
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

function invoiceSearchText(invoice = {}) {
  const buyer = invoice.buyer || {};
  const seller = invoice.seller || {};
  return [invoice.invoiceNumber, invoice.saleNumber, invoice.saleId, buyer.buyerName, buyer.buyerTaxId, buyer.buyerAddress, seller.sellerName, invoice.status].join(' ').toLowerCase();
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

function cardHtml(invoice) {
  const buyer = invoice.buyer || {};
  const seller = invoice.seller || {};
  const status = invoice.status === 'void' ? 'ยกเลิก' : 'ออกเอกสารแล้ว';
  return `<article class="tax-card">
    <div class="tax-card-main">
      <div class="tax-doc-no">${escapeHtml(invoice.invoiceNumber || invoice.id || '-')}</div>
      <h2>${escapeHtml(buyer.buyerName || '-')}</h2>
      <div class="tax-meta">
        <span>เลขภาษี: ${escapeHtml(buyer.buyerTaxId || '-')}</span>
        <span>บิล: ${escapeHtml(invoice.saleNumber || invoice.saleId || '-')}</span>
        <span>${escapeHtml(dateText(invoice.issuedAt))}</span>
      </div>
      <p>${escapeHtml(buyer.buyerAddress || '')}</p>
      <small>ผู้ขาย: ${escapeHtml(seller.sellerName || '-')} • ${escapeHtml(status)}</small>
    </div>
    <div class="tax-card-side">
      <strong>${money(invoice.totalAmount)}</strong>
      <span>VAT ${money(invoice.vatAmount)}</span>
      <div class="tax-actions">
        <a class="btn btn-primary" href="${invoiceUrl(invoice)}" target="_blank" rel="noopener">เปิด/พิมพ์</a>
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
window.addEventListener('storage', event => { if (!event.key || event.key === TAX_INVOICE_LOCAL_KEY) load(); });
load();
