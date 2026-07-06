import { getRecord } from './retail-db.js?v=20260629-032';

const TAX_INVOICE_COLLECTION = 'taxInvoices';
const TAX_INVOICE_LOCAL_KEY = 'retail_pos_tax_invoices_v1';

const root = document.querySelector('#taxInvoiceRoot');
const printBtn = document.querySelector('#printBtn');
const closeBtn = document.querySelector('#closeBtn');
const params = new URLSearchParams(location.search);
const invoiceId = params.get('invoiceId') || '';
const autoPrint = params.get('auto') === '1';

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

function branchText(seller = {}) {
  return seller.sellerBranchType === 'branch' ? `สาขา ${seller.sellerBranchCode || '-'}` : 'สำนักงานใหญ่';
}

function itemLineTotal(item = {}) {
  return Number(item.lineTotal ?? Number(item.price || 0) * Number(item.qty || 0));
}

function itemRows(items = []) {
  return items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.name || item.productName || '-')}</td><td class="right">${Number(item.qty || 0).toLocaleString('th-TH')}</td><td class="right">${money(item.price)}</td><td class="right">${money(itemLineTotal(item))}</td></tr>`).join('');
}

function render(invoice) {
  if (!invoice) {
    root.className = 'missing';
    root.textContent = 'ไม่พบใบกำกับภาษีเต็มรูปแบบ';
    return;
  }
  const seller = invoice.seller || {};
  const buyer = invoice.buyer || {};
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  root.className = 'tax-paper';
  root.innerHTML = `
    <section class="tax-title">
      <h1>ใบกำกับภาษีเต็มรูปแบบ</h1>
      <div>Tax Invoice</div>
    </section>
    <section class="tax-grid top-grid">
      <div>
        <h2>${escapeHtml(seller.sellerName || 'POS ร้านค้าปลีก')}</h2>
        ${seller.sellerAddress ? `<p>${escapeHtml(seller.sellerAddress)}</p>` : ''}
        ${seller.sellerPhone ? `<p>โทร ${escapeHtml(seller.sellerPhone)}</p>` : ''}
        ${seller.sellerTaxId ? `<p>เลขประจำตัวผู้เสียภาษี ${escapeHtml(seller.sellerTaxId)}</p>` : ''}
        <p>${escapeHtml(branchText(seller))}</p>
      </div>
      <div class="doc-box">
        <div><span>เลขที่</span><strong>${escapeHtml(invoice.invoiceNumber || invoice.id || '-')}</strong></div>
        <div><span>วันที่</span><strong>${escapeHtml(dateTime(invoice.issuedAt))}</strong></div>
        ${invoice.saleNumber ? `<div><span>อ้างอิงบิล</span><strong>${escapeHtml(invoice.saleNumber)}</strong></div>` : ''}
      </div>
    </section>
    <section class="buyer-box">
      <h2>ผู้ซื้อ / Customer</h2>
      <p><strong>${escapeHtml(buyer.buyerName || '-')}</strong></p>
      ${buyer.buyerTaxId ? `<p>เลขประจำตัวผู้เสียภาษี ${escapeHtml(buyer.buyerTaxId)}</p>` : ''}
      ${buyer.buyerBranchName ? `<p>${escapeHtml(buyer.buyerBranchName)}</p>` : ''}
      ${buyer.buyerAddress ? `<p>${escapeHtml(buyer.buyerAddress)}</p>` : ''}
    </section>
    <table class="items-table">
      <thead><tr><th>#</th><th>รายการ</th><th class="right">จำนวน</th><th class="right">ราคา</th><th class="right">รวม</th></tr></thead>
      <tbody>${itemRows(items)}</tbody>
    </table>
    <section class="summary-box">
      <div><span>รวมสินค้า</span><strong>${money(invoice.subtotal)}</strong></div>
      <div><span>ส่วนลด</span><strong>${money(invoice.discount)}</strong></div>
      ${Number(invoice.pointDiscount || 0) ? `<div><span>ส่วนลดแต้ม</span><strong>${money(invoice.pointDiscount)}</strong></div>` : ''}
      <div><span>ยอดก่อน VAT</span><strong>${money(invoice.beforeVat)}</strong></div>
      <div><span>VAT ${Number(invoice.vatRate || 7).toLocaleString('th-TH')}%</span><strong>${money(invoice.vatAmount)}</strong></div>
      <div><span>${invoice.vatMode === 'exclude' ? 'ราคาไม่รวม VAT' : 'ราคารวม VAT'}</span><strong>-</strong></div>
      <div class="grand"><span>ยอดสุทธิ</span><strong>${money(invoice.totalAmount)}</strong></div>
    </section>
    <section class="signature-grid">
      <div><span></span><p>ผู้รับสินค้า / ผู้ซื้อ</p></div>
      <div><span></span><p>ผู้รับเงิน / ผู้ขาย</p></div>
    </section>`;
}

async function boot() {
  render(await findInvoice());
  if (autoPrint) setTimeout(() => window.print(), 350);
}

printBtn?.addEventListener('click', () => window.print());
closeBtn?.addEventListener('click', () => window.close());
boot();
