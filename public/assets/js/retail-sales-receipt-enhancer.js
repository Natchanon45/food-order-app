const SALES_KEY = 'retail_pos_sales_v1';
const CUSTOMER_KEY = 'retail_pos_customers_v1';

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

function sales() {
  const rows = readJson(SALES_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function customers() {
  const rows = readJson(CUSTOMER_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function saleNo(sale = {}) {
  return String(sale.saleNumber || sale.number || sale.id || '').trim();
}

function currentSale() {
  const number = document.querySelector('#receiptSaleId')?.textContent?.trim() || '';
  return sales().find(sale => saleNo(sale) === number || String(sale.id || '') === number) || null;
}

function customerForSale(sale = {}) {
  const cid = String(sale.customerId || sale.memberId || '');
  return customers().find(customer => String(customer.id || customer._documentId || '') === cid) || null;
}

function isVatSale(sale = {}) {
  return sale.vatRegistered === true || sale.vatRegistered === 'yes' || Number(sale.vatAmount || 0) > 0;
}

function beforeVat(sale = {}) {
  return Number(sale.beforeVat ?? sale.taxableBase ?? sale.discountedBase ?? sale.subtotal ?? 0);
}

function vatRate(sale = {}) {
  return Number.isFinite(Number(sale.vatRate)) ? Number(sale.vatRate) : 7;
}

function vatModeText(sale = {}) {
  return String(sale.vatMode || '').toLowerCase() === 'exclude' ? 'ราคาไม่รวม VAT' : 'ราคารวม VAT';
}

function row(label, value, strong = false) {
  const div = document.createElement('div');
  div.dataset.salesReceiptExtra = 'true';
  div.innerHTML = `<span></span><${strong ? 'strong' : 'span'}></${strong ? 'strong' : 'span'}>`;
  div.children[0].textContent = label;
  div.children[1].textContent = value;
  return div;
}

function patchCustomer(area, sale) {
  const meta = area.querySelector('.receipt-meta');
  if (!meta) return;
  const customer = customerForSale(sale);
  const name = sale.customerName || customer?.name || '';
  const code = sale.customerCode || customer?.customerCode || '';
  const phone = sale.customerPhone || customer?.phone || '';
  if (!name && !code && !phone) return;
  meta.insertAdjacentElement('afterend', row('ลูกค้า', name || '-', true));
  let after = meta.nextElementSibling;
  if (code) { after.insertAdjacentElement('afterend', row('สมาชิก', code)); after = after.nextElementSibling; }
  if (phone) after.insertAdjacentElement('afterend', row('โทร', phone));
}

function patchVat(area, sale) {
  if (!isVatSale(sale)) return;
  const grand = area.querySelector('.receipt-grand');
  if (!grand) return;
  if (Number(sale.pointDiscount || 0)) grand.insertAdjacentElement('beforebegin', row('ส่วนลดแต้ม', money(sale.pointDiscount)));
  grand.insertAdjacentElement('beforebegin', row('ยอดก่อน VAT', money(beforeVat(sale))));
  grand.insertAdjacentElement('beforebegin', row(`VAT ${vatRate(sale).toLocaleString('th-TH')}%`, money(sale.vatAmount || 0)));
  grand.insertAdjacentElement('beforebegin', row(vatModeText(sale), ''));
}

function loyaltyOf(sale = {}) {
  if (sale.loyalty) return sale.loyalty;
  return null;
}

function patchLoyalty(area, sale) {
  const loyalty = loyaltyOf(sale);
  if (!loyalty) return;
  const thanks = area.querySelector('#receiptThanks') || area.querySelector('.receipt-thanks');
  const anchor = thanks || area.querySelector('.receipt-summary');
  if (!anchor) return;
  anchor.insertAdjacentElement('beforebegin', row('แต้มก่อนซื้อ', numberText(loyalty.pointsBefore)));
  anchor.insertAdjacentElement('beforebegin', row('ใช้แต้ม', numberText(loyalty.pointsUsed)));
  anchor.insertAdjacentElement('beforebegin', row('แต้มที่ได้รับ', numberText(loyalty.pointsEarned)));
  anchor.insertAdjacentElement('beforebegin', row('แต้มคงเหลือ', numberText(loyalty.pointsAfter), true));
}

function enhanceReceipt() {
  const area = document.querySelector('#receiptArea');
  if (!area) return;
  area.querySelectorAll('[data-sales-receipt-extra="true"]').forEach(node => node.remove());
  const sale = currentSale();
  const title = area.querySelector('.receipt-header p');
  if (title) title.textContent = sale && isVatSale(sale) ? 'ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน' : 'ใบเสร็จรับเงิน';
  if (!sale) return;
  patchCustomer(area, sale);
  patchVat(area, sale);
  patchLoyalty(area, sale);
}

document.querySelector('#salesTableBody')?.addEventListener('click', () => setTimeout(enhanceReceipt, 0), true);
window.addEventListener('beforeprint', enhanceReceipt);
window.addEventListener('storage', enhanceReceipt);
setTimeout(enhanceReceipt, 0);
