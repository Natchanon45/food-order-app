import { RetailCollections, getRecord } from './retail-db.js?v=20260629-032';

const SALES_KEY = 'retail_pos_sales_v1';
const STORE_SETTINGS_KEY = 'retail_pos_store_settings_v1';
let settingsCache = null;

function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function money(value) { return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function normalizeVatRegistered(value) { return value === true || String(value || '').toLowerCase() === 'yes'; }
function normalizeVatMode(value) { return String(value || '').toLowerCase() === 'exclude' ? 'exclude' : 'include'; }
function normalizeSettings(store = {}, receipt = {}, tax = {}, local = {}) {
  const merged = { ...store, ...receipt, ...tax, ...local };
  return {
    shopAddress: merged.shopAddress || '',
    taxId: merged.taxId || merged.shopTaxId || '',
    vatRegistered: normalizeVatRegistered(merged.vatRegistered),
    vatRate: Number.isFinite(Number(merged.vatRate)) ? Number(merged.vatRate) : 7,
    defaultVatMode: normalizeVatMode(merged.defaultVatMode),
    taxBranchType: String(merged.taxBranchType || 'headOffice') === 'branch' ? 'branch' : 'headOffice',
    taxBranchCode: String(merged.taxBranchCode || '').trim(),
    taxInvoiceName: String(merged.taxInvoiceName || '').trim(),
    taxInvoiceAddress: String(merged.taxInvoiceAddress || '').trim()
  };
}
async function getSettings() {
  if (settingsCache) return settingsCache;
  const local = readJson(STORE_SETTINGS_KEY, {});
  try {
    const [store, receipt, tax] = await Promise.all([
      getRecord(RetailCollections.settings, 'store'),
      getRecord(RetailCollections.settings, 'receipt'),
      getRecord(RetailCollections.settings, 'tax')
    ]);
    settingsCache = normalizeSettings(store || {}, receipt || {}, tax || {}, local);
  } catch (error) {
    console.warn('[retail-sales-receipt-vat] settings fallback', error);
    settingsCache = normalizeSettings({}, {}, {}, local);
  }
  return settingsCache;
}
function sales() { const rows = readJson(SALES_KEY, []); return Array.isArray(rows) ? rows : []; }
function saleNumberOf(sale = {}) { return String(sale.saleNumber || sale.number || sale.id || '').trim(); }
function currentSale() {
  const number = document.querySelector('#receiptSaleId')?.textContent?.trim() || '';
  return sales().find(sale => saleNumberOf(sale) === number || String(sale.id || '') === number) || null;
}
function taxEnabled(sale, settings) { return normalizeVatRegistered(sale?.vatRegistered) || (settings.vatRegistered && Number(sale?.vatAmount || 0) > 0); }
function branchText(settings) { return settings.taxBranchType === 'branch' ? `สาขา ${settings.taxBranchCode || '-'}` : 'สำนักงานใหญ่'; }
function row(label, value) { const div = document.createElement('div'); div.dataset.vatReceiptRow = 'true'; div.innerHTML = '<span></span><strong></strong>'; div.children[0].textContent = label; div.children[1].textContent = value; return div; }
async function enhanceReceipt() {
  const sale = currentSale();
  const settings = await getSettings();
  const area = document.querySelector('#receiptArea');
  if (!area || !sale || !taxEnabled(sale, settings)) return;
  area.querySelectorAll('[data-vat-receipt-row="true"]').forEach(node => node.remove());
  const title = area.querySelector('.receipt-header p');
  if (title) title.textContent = 'ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน';
  if (settings.taxInvoiceName) document.querySelector('#receiptShopName').textContent = settings.taxInvoiceName;
  if (settings.taxInvoiceAddress) document.querySelector('#receiptShopAddress').textContent = settings.taxInvoiceAddress;
  let branch = document.querySelector('#receiptTaxBranch');
  if (!branch) {
    branch = document.createElement('span');
    branch.id = 'receiptTaxBranch';
    document.querySelector('#receiptTaxId')?.insertAdjacentElement('afterend', branch);
  }
  branch.textContent = branchText(settings);
  const grand = area.querySelector('.receipt-grand');
  if (!grand) return;
  const rate = Number.isFinite(Number(sale.vatRate)) ? Number(sale.vatRate) : settings.vatRate;
  const mode = normalizeVatMode(sale.vatMode || settings.defaultVatMode);
  if (Number(sale.pointDiscount || 0)) grand.insertAdjacentElement('beforebegin', row('ส่วนลดแต้ม', money(sale.pointDiscount)));
  grand.insertAdjacentElement('beforebegin', row('ยอดก่อน VAT', money(sale.beforeVat ?? sale.taxableBase ?? sale.discountedBase ?? sale.subtotal)));
  grand.insertAdjacentElement('beforebegin', row(`VAT ${money(rate).replace(/\.00$/, '')}%`, money(sale.vatAmount || 0)));
  grand.insertAdjacentElement('beforebegin', row(mode === 'exclude' ? 'ราคาไม่รวม VAT' : 'ราคารวม VAT', ''));
}

document.querySelector('#salesTableBody')?.addEventListener('click', () => setTimeout(enhanceReceipt, 0), true);
window.addEventListener('beforeprint', enhanceReceipt);
window.addEventListener('storage', event => { if (!event.key || event.key === STORE_SETTINGS_KEY) settingsCache = null; });
