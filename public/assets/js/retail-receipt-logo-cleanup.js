const styleId = 'retailReceiptLogoCleanupStyle';
const SALES_KEY = 'retail_pos_sales_v1';
const STORE_SETTINGS_KEY = 'retail_pos_store_settings_v1';

if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `.receipt-logo,.receipt-header h1 i,.receipt-header h1 svg,.receipt-header h1 img,.receipt-shop i,.receipt-shop svg,.receipt-shop img,.receipt-shop::before,.receipt-shop::after{content:none!important;display:none!important;visibility:hidden!important}`;
  document.head.appendChild(style);
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function money(value) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numberText(value) {
  return Number(value || 0).toLocaleString('th-TH');
}

function receiptSales() {
  const rows = readJson(SALES_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function saleNo(sale = {}) {
  return String(sale.saleNumber || sale.number || sale.id || '').trim();
}

function findSale(paper) {
  const text = paper?.textContent || '';
  return receiptSales().find(sale => saleNo(sale) && text.includes(saleNo(sale))) || receiptSales()[0] || null;
}

function isVatSale(sale = {}) {
  return sale.vatRegistered === true || sale.vatRegistered === 'yes' || Number(sale.vatAmount || 0) > 0;
}

function beforeVat(sale = {}) {
  return Number(sale.beforeVat ?? sale.taxableBase ?? sale.discountedBase ?? sale.subtotal ?? 0);
}

function vatRate(sale = {}) {
  const settings = readJson(STORE_SETTINGS_KEY, {});
  return Number.isFinite(Number(sale.vatRate)) ? Number(sale.vatRate) : Number(settings.vatRate || 7);
}

function modeLabel(sale = {}) {
  return String(sale.vatMode || '').toLowerCase() === 'exclude' ? 'ราคาไม่รวม VAT' : 'ราคารวม VAT';
}

function cleanupReceiptLogo(root = document) {
  root.querySelectorAll('.receipt-logo,.receipt-header h1 i,.receipt-header h1 svg,.receipt-header h1 img,.receipt-shop i,.receipt-shop svg,.receipt-shop img').forEach(node => node.remove());
}

function row(label, value, strong = false) {
  const div = document.createElement('div');
  div.className = 'receipt-row';
  div.dataset.receiptEnhance = 'true';
  div.innerHTML = `<span></span><${strong ? 'strong' : 'span'}></${strong ? 'strong' : 'span'}>`;
  div.children[0].textContent = label;
  div.children[1].textContent = value;
  return div;
}

function rule() {
  const hr = document.createElement('hr');
  hr.className = 'receipt-rule';
  hr.dataset.receiptEnhance = 'true';
  return hr;
}

function customerRows(sale = {}) {
  const frag = document.createDocumentFragment();
  const customerName = sale.customerName || sale.customerDisplayName || '';
  const phone = sale.customerDisplayPhone || sale.customerPhone || '';
  if (!customerName && !sale.customerCode && !phone) return frag;
  frag.append(rule());
  if (customerName) frag.append(row('ลูกค้า', customerName, true));
  if (sale.customerCode) frag.append(row('สมาชิก', sale.customerCode));
  if (phone) frag.append(row('โทร', phone));
  return frag;
}

function loyaltyRows(sale = {}) {
  const loyalty = sale.loyalty;
  const frag = document.createDocumentFragment();
  if (!loyalty) return frag;
  frag.append(rule());
  frag.append(row('แต้มก่อนซื้อ', numberText(loyalty.pointsBefore)));
  frag.append(row('ใช้แต้ม', numberText(loyalty.pointsUsed)));
  frag.append(row('แต้มที่ได้รับ', numberText(loyalty.pointsEarned)));
  frag.append(row('แต้มคงเหลือ', numberText(loyalty.pointsAfter), true));
  return frag;
}

function vatRows(sale = {}) {
  const frag = document.createDocumentFragment();
  if (!isVatSale(sale)) return frag;
  if (Number(sale.pointDiscount || 0)) frag.append(row('ส่วนลดแต้ม', money(sale.pointDiscount)));
  frag.append(row('ยอดก่อน VAT', money(beforeVat(sale))));
  frag.append(row(`VAT ${vatRate(sale).toLocaleString('th-TH')}%`, money(sale.vatAmount || 0)));
  frag.append(row(modeLabel(sale), ''));
  return frag;
}

function enhancePaper(paper) {
  if (!paper) return;
  cleanupReceiptLogo(paper);
  paper.querySelectorAll('[data-receipt-enhance="true"]').forEach(node => node.remove());
  const sale = findSale(paper);
  if (!sale) return;
  const title = [...paper.querySelectorAll('.receipt-muted')].find(node => node.textContent.includes('ใบเสร็จรับเงิน'));
  if (title && isVatSale(sale)) title.textContent = 'ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน';
  const paymentRow = [...paper.querySelectorAll('.receipt-row')].find(node => node.textContent.includes('ชำระเงิน'));
  if (paymentRow) paymentRow.insertAdjacentElement('afterend', rule());
  const customerFrag = customerRows(sale);
  if (paymentRow && customerFrag.childNodes.length) paymentRow.after(customerFrag);
  const totalRow = paper.querySelector('.receipt-total') || [...paper.querySelectorAll('.receipt-row')].find(node => node.textContent.includes('สุทธิ'));
  const vatFrag = vatRows(sale);
  if (totalRow && vatFrag.childNodes.length) totalRow.before(vatFrag);
  const footer = paper.querySelector('.receipt-footer');
  const loyaltyFrag = loyaltyRows(sale);
  if (footer && loyaltyFrag.childNodes.length) footer.before(loyaltyFrag);
}

function scanReceipts() {
  cleanupReceiptLogo();
  document.querySelectorAll('.receipt-paper,#receiptArea').forEach(enhancePaper);
}

new MutationObserver(scanReceipts).observe(document.body, { childList: true, subtree: true });
window.addEventListener('storage', scanReceipts);
scanReceipts();
