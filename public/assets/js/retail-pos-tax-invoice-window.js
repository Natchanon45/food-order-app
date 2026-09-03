import { getRecord } from './retail-db.js?v=20260629-032';
import { getIntlLocale, t } from './i18n.js?v=20260903-202';

const TAX_INVOICE_COLLECTION = 'taxInvoices';
const TAX_INVOICE_LOCAL_KEY = 'retail_pos_tax_invoices_v1';

const root = document.querySelector('#taxInvoiceRoot');
const printBtn = document.querySelector('#printBtn');
const closeBtn = document.querySelector('#closeBtn');
const params = new URLSearchParams(location.search);
const invoiceId = params.get('invoiceId') || '';
const autoPrint = params.get('auto') === '1';
const ITEMS_PER_PAGE = 20;
const INTL_LOCALE = getIntlLocale();
const tx = (key, replacements = {}) => t(`pos_tax_invoice.${key}`, replacements);

function localizeStaticUi() {
  document.title = tx('meta_title');
  const toolbarTitle = document.querySelector('.toolbar > strong');
  const historyLabel = document.querySelector('.toolbar a[href="/pos/tax-invoices/"] span');
  const printLabel = printBtn?.querySelector('span');
  const closeLabel = closeBtn?.querySelector('span');
  if (toolbarTitle) toolbarTitle.textContent = tx('title');
  if (historyLabel) historyLabel.textContent = tx('history');
  if (printLabel) printLabel.textContent = tx('print');
  if (closeLabel) closeLabel.textContent = tx('close');
  if (root?.classList.contains('loading')) root.textContent = tx('loading');
}
let printReady = false;
let printReadyPromise = null;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function money(value) {
  return Number(value || 0).toLocaleString(INTL_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateTime(value) {
  return new Date(value || Date.now()).toLocaleString(INTL_LOCALE);
}

function localInvoice() {
  const rows = readJson(TAX_INVOICE_LOCAL_KEY, []);
  return (Array.isArray(rows) ? rows : []).find(row => String(row.id) === invoiceId || String(row.invoiceNumber) === invoiceId) || null;
}

async function firebaseInvoice() {
  if (!invoiceId) return null;
  try { return await getRecord(TAX_INVOICE_COLLECTION, invoiceId); }
  catch { return null; }
}

async function findInvoice() {
  if (!invoiceId) return null;

  // Firestore is authoritative for synced documents. The dedicated local
  // invoice store remains available for pending/offline documents.
  const remote = await firebaseInvoice();
  if (remote) return remote;

  return localInvoice();
}

function sellerBranchText(seller = {}) {
  return seller.sellerBranchType === 'branch' ? tx('branch', { code: seller.sellerBranchCode || '-' }) : tx('head_office');
}

function buyerBranchText(buyer = {}) {
  return String(buyer.buyerBranchName || '').trim();
}

function sellerTaxLine(seller = {}) {
  const taxId = String(seller.sellerTaxId || '').trim();
  const branch = sellerBranchText(seller);
  if (!taxId) return branch;
  return tx('tax_id', { tax_id: taxId, branch: branch ? ` ${branch}` : '' });
}

function buyerTaxLine(buyer = {}) {
  const taxId = String(buyer.buyerTaxId || '').trim();
  const branch = buyerBranchText(buyer) || tx('head_office');
  if (!taxId) return '';
  return tx('tax_id', { tax_id: taxId, branch: branch ? ` ${branch}` : '' });
}

function itemLineTotal(item = {}) {
  return Number(item.lineTotal ?? Number(item.price || 0) * Number(item.qty || 0));
}

function itemRows(items = [], offset = 0) {
  return items.map((item, index) => `<tr><td>${offset + index + 1}</td><td>${escapeHtml(item.name || item.productName || '-')}</td><td class="right">${Number(item.qty || 0).toLocaleString(INTL_LOCALE)}</td><td class="right">${money(item.price)}</td><td class="right">${money(itemLineTotal(item))}</td></tr>`).join('');
}

function vatTotalAmount(invoice = {}) {
  const total = Number(invoice.totalAmount || 0);
  const beforeVat = Number(invoice.beforeVat || 0);
  const vatAmount = Number(invoice.vatAmount || 0);
  if (total) return total;
  return beforeVat + vatAmount;
}

function invoiceHeaderHtml(invoice, seller, buyer, isVoid, pageNumber, totalPages) {
  const sellerTax = sellerTaxLine(seller);
  const buyerTax = buyerTaxLine(buyer);
  const buyerBranch = buyerBranchText(buyer);
  return `
    ${isVoid ? `<div class="void-stamp">${escapeHtml(tx('void'))}</div>` : ''}
    <div class="tax-page-number">${escapeHtml(tx('page', { current: pageNumber, total: totalPages }))}</div>
    <section class="tax-title">
      <h1>${escapeHtml(tx('title'))}</h1>
      <div>Tax Invoice</div>
    </section>
    <section class="tax-grid top-grid">
      <div>
        <h2>${escapeHtml(seller.sellerName || tx('default_seller'))}</h2>
        ${seller.sellerAddress ? `<p>${escapeHtml(seller.sellerAddress)}</p>` : ''}
        ${seller.sellerPhone ? `<p>${escapeHtml(tx('phone', { phone: seller.sellerPhone }))}</p>` : ''}
        ${sellerTax ? `<p>${escapeHtml(sellerTax)}</p>` : ''}
      </div>
      <div class="doc-box">
        <div><span>${escapeHtml(tx('number'))}</span><strong>${escapeHtml(invoice.invoiceNumber || invoice.id || '-')}</strong></div>
        <div><span>${escapeHtml(tx('date'))}</span><strong>${escapeHtml(dateTime(invoice.issuedAt))}</strong></div>
        ${invoice.saleNumber ? `<div><span>${escapeHtml(tx('sale_reference'))}</span><strong>${escapeHtml(invoice.saleNumber)}</strong></div>` : ''}
        ${isVoid ? `<div><span>${escapeHtml(tx('status'))}</span><strong>${escapeHtml(tx('void'))}</strong></div>` : ''}
      </div>
    </section>
    ${isVoid ? `<section class="void-note"><strong>${escapeHtml(tx('void_note'))}</strong>${invoice.voidedAt ? escapeHtml(tx('void_when', { date: dateTime(invoice.voidedAt) })) : ''}${invoice.voidReason ? `<br>${escapeHtml(tx('reason', { reason: invoice.voidReason }))}` : ''}</section>` : ''}
    <section class="buyer-box">
      <h2>${escapeHtml(tx('buyer'))}</h2>
      <p><strong>${escapeHtml(buyer.buyerName || '-')}</strong></p>
      ${buyerTax ? `<p>${escapeHtml(buyerTax)}</p>` : buyerBranch ? `<p>${escapeHtml(buyerBranch)}</p>` : ''}
      ${buyer.buyerAddress ? `<p>${escapeHtml(buyer.buyerAddress)}</p>` : ''}
    </section>`;
}

function itemsTableHtml(items, offset) {
  return `<table class="items-table">
    <thead><tr><th>#</th><th>${escapeHtml(tx('item'))}</th><th class="right">${escapeHtml(tx('quantity'))}</th><th class="right">${escapeHtml(tx('price'))}</th><th class="right">${escapeHtml(tx('total'))}</th></tr></thead>
    <tbody>${itemRows(items, offset)}</tbody>
  </table>`;
}

function summaryHtml(invoice) {
  return `<section class="tax-final-block">
    <section class="summary-box">
      <div><span>${escapeHtml(tx('subtotal'))}</span><strong>${money(invoice.subtotal)}</strong></div>
      <div><span>${escapeHtml(tx('discount'))}</span><strong>${money(invoice.discount)}</strong></div>
      ${Number(invoice.pointDiscount || 0) ? `<div><span>${escapeHtml(tx('point_discount'))}</span><strong>${money(invoice.pointDiscount)}</strong></div>` : ''}
      <div><span>${escapeHtml(tx('before_vat'))}</span><strong>${money(invoice.beforeVat)}</strong></div>
      <div><span>VAT ${Number(invoice.vatRate || 7).toLocaleString(INTL_LOCALE)}%</span><strong>${money(invoice.vatAmount)}</strong></div>
      <div><span>${escapeHtml(tx(invoice.vatMode === 'exclude' ? 'vat_excluded' : 'vat_included'))}</span><strong>${money(vatTotalAmount(invoice))}</strong></div>
      <div class="grand"><span>${escapeHtml(tx('net_total'))}</span><strong>${money(invoice.totalAmount)}</strong></div>
    </section>
    <section class="signature-grid">
      <div><span></span><p>${escapeHtml(tx('goods_receiver'))}</p></div>
      <div><span></span><p>${escapeHtml(tx('payment_receiver'))}</p></div>
    </section>
  </section>`;
}

function render(invoice) {
  if (!invoice) {
    root.className = 'missing';
    root.textContent = tx('missing');
    return;
  }
  const seller = invoice.seller || {};
  const buyer = invoice.buyer || {};
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const isVoid = invoice.status === 'void';
  const chunks = [];
  for (let index = 0; index < Math.max(items.length, 1); index += ITEMS_PER_PAGE) {
    chunks.push(items.slice(index, index + ITEMS_PER_PAGE));
  }
  root.className = 'tax-stack';
  const totalPages = chunks.length;
  root.innerHTML = chunks.map((chunk, pageIndex) => {
    const isLastPage = pageIndex === chunks.length - 1;
    const offset = pageIndex * ITEMS_PER_PAGE;
    return `<article class="tax-paper" data-tax-page="${pageIndex + 1}">
      ${invoiceHeaderHtml(invoice, seller, buyer, isVoid, pageIndex + 1, totalPages)}
      ${itemsTableHtml(chunk, offset)}
      ${isLastPage ? summaryHtml(invoice) : ''}
    </article>`;
  }).join('');
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

function preparePrintReady() {
  if (printReadyPromise) return printReadyPromise;
  setPrintButtonReady(false);
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

async function printInvoice(options = {}) {
  const auto = Boolean(options.auto);
  if (!auto && printReady) {
    window.print();
    return;
  }
  await preparePrintReady();
  window.print();
}

async function boot() {
  render(await findInvoice());
  preparePrintReady();
  if (autoPrint) setTimeout(() => printInvoice({ auto: true }), 450);
}

printBtn?.addEventListener('click', () => printInvoice());
closeBtn?.addEventListener('click', () => window.close());
localizeStaticUi();
boot();
