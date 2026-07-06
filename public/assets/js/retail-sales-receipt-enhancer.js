const SALES_KEY = 'retail_pos_sales_v1';
const CUSTOMER_KEY = 'retail_pos_customers_v1';
const STORE_SETTINGS_KEY = 'retail_pos_store_settings_v1';

const styleId = 'retailSalesReceiptEnhancerStyle';
if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `.receipt [data-sales-receipt-extra="true"]{display:flex!important;justify-content:space-between!important;align-items:flex-start!important;gap:10px!important;padding:1px 0!important;font-size:19px!important;line-height:1.08!important}.receipt [data-sales-receipt-extra="true"] span:first-child{flex:0 0 auto!important;color:#000!important}.receipt [data-sales-receipt-extra="true"] span:last-child,.receipt [data-sales-receipt-extra="true"] strong:last-child{min-width:0!important;text-align:right!important;font-weight:700!important;color:#000!important;overflow-wrap:anywhere!important}.receipt .receipt-extra-block{display:block!important;margin:5px 0!important;padding:4px 0!important;border-top:0!important;border-bottom:1px dashed #000!important}.receipt .receipt-extra-block [data-sales-receipt-extra="true"]{display:flex!important;width:100%!important}.receipt .receipt-extra-block [data-sales-receipt-extra="true"] span:first-child{min-width:54px!important}.receipt .receipt-extra-block [data-sales-receipt-extra="true"] span:last-child,.receipt .receipt-extra-block [data-sales-receipt-extra="true"] strong:last-child{text-align:right!important;flex:1 1 auto!important}.receipt .receipt-extra-block+.receipt-table{margin-top:6px!important}`;
  document.head.appendChild(style);
}
function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function money(value) { return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function numberText(value) { return Number(value || 0).toLocaleString('th-TH'); }
function settings() { return readJson(STORE_SETTINGS_KEY, {}); }
function sales() { const rows = readJson(SALES_KEY, []); return Array.isArray(rows) ? rows : []; }
function customers() { const rows = readJson(CUSTOMER_KEY, []); return Array.isArray(rows) ? rows : []; }
function saleNo(sale = {}) { return String(sale.saleNumber || sale.number || sale.id || '').trim(); }
function currentSale() { const number = document.querySelector('#receiptSaleId')?.textContent?.trim() || ''; return sales().find(sale => saleNo(sale) === number || String(sale.id || '') === number) || null; }
function customerForSale(sale = {}) { const cid = String(sale.customerId || sale.memberId || ''); return customers().find(customer => String(customer.id || customer._documentId || '') === cid) || null; }
function isVatSale(sale = {}) { return sale.vatRegistered === true || sale.vatRegistered === 'yes' || Number(sale.vatAmount || 0) > 0; }
function beforeVat(sale = {}) { return Number(sale.beforeVat ?? sale.taxableBase ?? sale.discountedBase ?? sale.subtotal ?? 0); }
function vatRate(sale = {}) { const store = settings(); return Number.isFinite(Number(sale.vatRate)) ? Number(sale.vatRate) : Number(store.vatRate || 7); }
function vatModeText(sale = {}) { return String(sale.vatMode || '').toLowerCase() === 'exclude' ? 'ราคาไม่รวม VAT' : 'ราคารวม VAT'; }
function shopName() { const store = settings(); return store.taxInvoiceName || store.shopName || store.name || 'POS ร้านค้าปลีก'; }
function maskPhone(phone = '') { const digits = String(phone || '').replace(/\D/g, ''); if (digits.length < 7) return digits ? `${digits.slice(0, 2)}***` : ''; return `${digits.slice(0, 3)}-***-${digits.slice(-4)}`; }
function maskName(name = '') { const text = String(name || '').trim(); if (!text) return ''; if (text.length <= 2) return `${text[0] || ''}*`; return `${text.slice(0, 2)}${'*'.repeat(Math.min(5, text.length - 2))}`; }
function row(label, value, strong = false) { const div = document.createElement('div'); div.dataset.salesReceiptExtra = 'true'; div.innerHTML = `<span></span><${strong ? 'strong' : 'span'}></${strong ? 'strong' : 'span'}>`; div.children[0].textContent = label; div.children[1].textContent = value || '-'; return div; }
function block(rows = []) { const wrapper = document.createElement('div'); wrapper.className = 'receipt-extra-block'; wrapper.dataset.salesReceiptBlock = 'true'; rows.forEach(item => wrapper.append(item)); return wrapper; }
function patchShop(area) { const shop = area.querySelector('#receiptShopName'); if (shop) shop.textContent = shopName(); }
function patchCustomer(area, sale) {
  const meta = area.querySelector('.receipt-meta'); if (!meta) return;
  const customer = customerForSale(sale);
  const name = sale.customerName || customer?.name || '';
  const code = sale.customerCode || customer?.customerCode || '';
  const phone = sale.customerPhone || customer?.phone || '';
  if (!name && !code && !phone) return;
  const rows = [];
  if (name) rows.push(row('ลูกค้า', maskName(name), true));
  if (code) rows.push(row('สมาชิก', code));
  if (phone) rows.push(row('เบอร์โทร', maskPhone(phone)));
  meta.insertAdjacentElement('afterend', block(rows));
}
function patchVat(area, sale) { if (!isVatSale(sale)) return; const grand = area.querySelector('.receipt-grand'); if (!grand) return; if (Number(sale.pointDiscount || 0)) grand.insertAdjacentElement('beforebegin', row('ส่วนลดแต้ม', money(sale.pointDiscount))); grand.insertAdjacentElement('beforebegin', row('ยอดก่อน VAT', money(beforeVat(sale)))); grand.insertAdjacentElement('beforebegin', row(`VAT ${vatRate(sale).toLocaleString('th-TH')}%`, money(sale.vatAmount || 0))); grand.insertAdjacentElement('beforebegin', row(vatModeText(sale), '')); }
function patchLoyalty(area, sale) { const loyalty = sale.loyalty || null; if (!loyalty) return; const thanks = area.querySelector('#receiptThanks') || area.querySelector('.receipt-thanks'); const anchor = thanks || area.querySelector('.receipt-summary'); if (!anchor) return; const rows = [row('แต้มก่อนซื้อ', numberText(loyalty.pointsBefore)), row('ใช้แต้ม', numberText(loyalty.pointsUsed)), row('แต้มที่ได้รับ', numberText(loyalty.pointsEarned)), row('แต้มคงเหลือ', numberText(loyalty.pointsAfter), true)]; anchor.insertAdjacentElement('beforebegin', block(rows)); }
function enhanceReceipt() { const area = document.querySelector('#receiptArea'); if (!area) return; area.querySelectorAll('[data-sales-receipt-extra="true"],[data-sales-receipt-block="true"]').forEach(node => node.remove()); const sale = currentSale(); patchShop(area); const title = area.querySelector('.receipt-header p'); if (title) title.textContent = sale && isVatSale(sale) ? 'ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน' : 'ใบเสร็จรับเงิน'; if (!sale) return; patchCustomer(area, sale); patchVat(area, sale); patchLoyalty(area, sale); }
document.querySelector('#salesTableBody')?.addEventListener('click', () => setTimeout(enhanceReceipt, 0), true);
window.addEventListener('beforeprint', enhanceReceipt);
window.addEventListener('storage', enhanceReceipt);
setTimeout(enhanceReceipt, 0);
