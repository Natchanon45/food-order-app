import { getRecord } from './retail-db.js?v=20260629-032';

const TAX_INVOICE_COLLECTION = 'taxInvoices';
const TAX_INVOICE_LOCAL_KEY = 'retail_pos_tax_invoices_v1';

const root = document.querySelector('#taxInvoiceRoot');
const printBtn = document.querySelector('#printBtn');
const closeBtn = document.querySelector('#closeBtn');
const params = new URLSearchParams(location.search);
const invoiceId = params.get('invoiceId') || '';
const autoPrint = params.get('auto') === '1';
const ITEMS_PER_PAGE = 20;

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

function dateTime(value) {
  return new Date(value || Date.now()).toLocaleString('th-TH');
}

function localInvoice() {
  const rows = readJson(TAX_INVOICE_LOCAL_KEY, []);
  return (Array.isArray(rows) ? rows : []).find(row => String(row.id) === invoiceId || String(row.invoiceNumber) === invoiceId) || null;
}

async function findInvoice() {
  const local = localInvoice();
  if (local) return local;
  try { return await getRecord(TAX_INVOICE_COLLECTION, invoiceId); }
  catch { return null; }
}

function sellerBranchText(seller = {}) {
  return seller.sellerBranchType === 'branch' ? `สาขา ${seller.sellerBranchCode || '-'}` : 'สำนักงานใหญ่';
}

function buyerBranchText(buyer = {}) {
  return String(buyer.buyerBranchName || '').trim();
}

function sellerTaxLine(seller = {}) {
  const taxId = String(seller.sellerTaxId || '').trim();
  const branch = sellerBranchText(seller);
  if (!taxId) return branch;
  return `เลขประจำตัวผู้เสียภาษี ${taxId}${branch ? ` ${branch}` : ''}`;
}

function buyerTaxLine(buyer = {}) {
  const taxId = String(buyer.buyerTaxId || '').trim();
  const branch = buyerBranchText(buyer) || 'สำนักงานใหญ่';
  if (!taxId) return '';
  return `เลขประจำตัวผู้เสียภาษี ${taxId}${branch ? ` ${branch}` : ''}`;
}

function itemLineTotal(item = {}) {
  return Number(item.lineTotal ?? Number(item.price || 0) * Number(item.qty || 0));
}

function itemRows(items = [], offset = 0) {
  return items.map((item, index) => `<tr><td>${offset + index + 1}</td><td>${escapeHtml(item.name || item.productName || '-')}</td><td class="right">${Number(item.qty || 0).toLocaleString('th-TH')}</td><td class="right">${money(item.price)}</td><td class="right">${money(itemLineTotal(item))}</td></tr>`).join('');
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
    ${isVoid ? `<div class="void-stamp">ยกเลิก</div>` : ''}
    <div class="tax-page-number">หน้า ${pageNumber}/${totalPages}</div>
    <section class="tax-title">
      <h1>ใบกำกับภาษี</h1>
      <div>Tax Invoice</div>
    </section>
    <section class="tax-grid top-grid">
      <div>
        <h2>${escapeHtml(seller.sellerName || 'POS ร้านค้าปลีก')}</h2>
        ${seller.sellerAddress ? `<p>${escapeHtml(seller.sellerAddress)}</p>` : ''}
        ${seller.sellerPhone ? `<p>โทร ${escapeHtml(seller.sellerPhone)}</p>` : ''}
        ${sellerTax ? `<p>${escapeHtml(sellerTax)}</p>` : ''}
      </div>
      <div class="doc-box">
        <div><span>เลขที่</span><strong>${escapeHtml(invoice.invoiceNumber || invoice.id || '-')}</strong></div>
        <div><span>วันที่</span><strong>${escapeHtml(dateTime(invoice.issuedAt))}</strong></div>
        ${invoice.saleNumber ? `<div><span>อ้างอิงบิล</span><strong>${escapeHtml(invoice.saleNumber)}</strong></div>` : ''}
        ${isVoid ? `<div><span>สถานะ</span><strong>ยกเลิก</strong></div>` : ''}
      </div>
    </section>
    ${isVoid ? `<section class="void-note"><strong>เอกสารนี้ถูกยกเลิก</strong>${invoice.voidedAt ? ` เมื่อ ${escapeHtml(dateTime(invoice.voidedAt))}` : ''}${invoice.voidReason ? `<br>เหตุผล: ${escapeHtml(invoice.voidReason)}` : ''}</section>` : ''}
    <section class="buyer-box">
      <h2>ผู้ซื้อ / ลูกค้า</h2>
      <p><strong>${escapeHtml(buyer.buyerName || '-')}</strong></p>
      ${buyerTax ? `<p>${escapeHtml(buyerTax)}</p>` : buyerBranch ? `<p>${escapeHtml(buyerBranch)}</p>` : ''}
      ${buyer.buyerAddress ? `<p>${escapeHtml(buyer.buyerAddress)}</p>` : ''}
    </section>`;
}

function itemsTableHtml(items, offset) {
  return `<table class="items-table">
    <thead><tr><th>#</th><th>รายการ</th><th class="right">จำนวน</th><th class="right">ราคา</th><th class="right">รวม</th></tr></thead>
    <tbody>${itemRows(items, offset)}</tbody>
  </table>`;
}

function summaryHtml(invoice) {
  return `<section class="tax-final-block">
    <section class="summary-box">
      <div><span>รวมสินค้า</span><strong>${money(invoice.subtotal)}</strong></div>
      <div><span>ส่วนลด</span><strong>${money(invoice.discount)}</strong></div>
      ${Number(invoice.pointDiscount || 0) ? `<div><span>ส่วนลดแต้ม</span><strong>${money(invoice.pointDiscount)}</strong></div>` : ''}
      <div><span>ยอดก่อน VAT</span><strong>${money(invoice.beforeVat)}</strong></div>
      <div><span>VAT ${Number(invoice.vatRate || 7).toLocaleString('th-TH')}%</span><strong>${money(invoice.vatAmount)}</strong></div>
      <div><span>${invoice.vatMode === 'exclude' ? 'ราคาไม่รวม VAT' : 'ราคารวม VAT'}</span><strong>${money(vatTotalAmount(invoice))}</strong></div>
      <div class="grand"><span>ยอดสุทธิ</span><strong>${money(invoice.totalAmount)}</strong></div>
    </section>
    <section class="signature-grid">
      <div><span></span><p>ผู้รับสินค้า / ผู้ซื้อ</p></div>
      <div><span></span><p>ผู้รับเงิน / ผู้ขาย</p></div>
    </section>
  </section>`;
}

function render(invoice) {
  if (!invoice) {
    root.className = 'missing';
    root.textContent = 'ไม่พบใบกำกับภาษี';
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

async function printInvoice() {
  if (printBtn) printBtn.disabled = true;
  try {
    await waitForPrintReady();
    window.print();
  } finally {
    setTimeout(() => { if (printBtn) printBtn.disabled = false; }, 800);
  }
}

async function boot() {
  render(await findInvoice());
  if (autoPrint) setTimeout(printInvoice, 350);
}

printBtn?.addEventListener('click', printInvoice);
closeBtn?.addEventListener('click', () => window.close());
boot();
