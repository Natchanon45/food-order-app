import { RetailCollections, getRecord } from './retail-db.js?v=20260629-032';

const SALES_KEY = 'retail_pos_sales_v1';
const STORE_SETTINGS_KEY = 'retail_pos_store_settings_v1';
let settingsCache = null;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function money(value) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeVatRegistered(value) {
  return value === true || String(value || '').toLowerCase() === 'yes';
}

function normalizeVatMode(value) {
  return String(value || '').toLowerCase() === 'exclude' ? 'exclude' : 'include';
}

function normalizeSettings(store = {}, receipt = {}, tax = {}, local = {}) {
  const merged = { ...store, ...receipt, ...tax, ...local };
  return {
    shopName: merged.shopName || 'POS ร้านค้าปลีก',
    shopAddress: merged.shopAddress || '',
    shopPhone: merged.shopPhone || '',
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
    console.warn('[retail-pos-receipt-tax-invoice] settings fallback', error);
    settingsCache = normalizeSettings({}, {}, {}, local);
  }
  return settingsCache;
}

function sales() {
  const rows = readJson(SALES_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function saleNumberOf(sale = {}) {
  return String(sale.saleNumber || sale.number || sale.id || '').trim();
}

function findSaleForPaper(paper) {
  const text = paper?.textContent || '';
  return sales().find(sale => saleNumberOf(sale) && text.includes(saleNumberOf(sale))) || sales()[0] || null;
}

function taxEnabled(sale, settings) {
  return normalizeVatRegistered(sale?.vatRegistered) || (settings.vatRegistered && Number(sale?.vatAmount || 0) > 0);
}

function branchText(settings) {
  return settings.taxBranchType === 'branch' ? `สาขา ${settings.taxBranchCode || '-'}` : 'สำนักงานใหญ่';
}

function ensureLine(className, text, afterNode) {
  const parent = afterNode?.parentElement;
  if (!parent) return null;
  let node = parent.querySelector(`.${className}`);
  if (!node) {
    node = document.createElement('div');
    node.className = `receipt-muted ${className}`;
    afterNode.insertAdjacentElement('afterend', node);
  }
  node.textContent = text;
  return node;
}

function createRow(label, value) {
  const row = document.createElement('div');
  row.className = 'receipt-row';
  row.dataset.vatReceiptRow = 'true';
  row.innerHTML = '<span></span><span></span>';
  row.children[0].textContent = label;
  row.children[1].textContent = value;
  return row;
}

function removeReceiptLogo(paper) {
  paper?.querySelectorAll('.receipt-logo').forEach(node => node.remove());
}

async function enhancePaper(paper) {
  if (!paper || paper.dataset.taxInvoiceEnhanced === '1') return;
  removeReceiptLogo(paper);
  const sale = findSaleForPaper(paper);
  const settings = await getSettings();
  if (!sale || !taxEnabled(sale, settings)) return;
  paper.dataset.taxInvoiceEnhanced = '1';

  const shop = paper.querySelector('.receipt-shop');
  if (shop && settings.taxInvoiceName) shop.textContent = settings.taxInvoiceName;
  const header = paper.querySelector('.receipt-center');
  if (header) {
    const title = [...header.querySelectorAll('.receipt-muted')].find(node => node.textContent.includes('ใบเสร็จรับเงิน'));
    if (title) title.textContent = 'ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน';
    const address = [...header.querySelectorAll('.receipt-muted')].find(node => node.textContent === settings.shopAddress);
    if (address && settings.taxInvoiceAddress) address.textContent = settings.taxInvoiceAddress;
    const taxIdLine = [...header.querySelectorAll('.receipt-muted')].find(node => node.textContent.includes('เลขประจำตัวผู้เสียภาษี')) || title;
    if (taxIdLine) ensureLine('receipt-tax-branch', branchText(settings), taxIdLine);
  }

  paper.querySelectorAll('[data-vat-receipt-row="true"]').forEach(row => row.remove());
  const totalRow = paper.querySelector('.receipt-total');
  if (!totalRow) return;
  const rate = Number.isFinite(Number(sale.vatRate)) ? Number(sale.vatRate) : settings.vatRate;
  const mode = normalizeVatMode(sale.vatMode || settings.defaultVatMode);
  const rows = [];
  if (Number(sale.pointDiscount || 0)) rows.push(createRow('ส่วนลดแต้ม', money(sale.pointDiscount)));
  rows.push(createRow('ยอดก่อน VAT', money(sale.beforeVat ?? sale.taxableBase ?? sale.discountedBase ?? sale.subtotal)));
  rows.push(createRow(`VAT ${money(rate).replace(/\.00$/, '')}%`, money(sale.vatAmount || 0)));
  rows.push(createRow(mode === 'exclude' ? 'ราคาไม่รวม VAT' : 'ราคารวม VAT', ''));
  rows.forEach(row => totalRow.insertAdjacentElement('beforebegin', row));
}

function scan() {
  document.querySelectorAll('.receipt-paper').forEach(paper => {
    removeReceiptLogo(paper);
    enhancePaper(paper);
  });
}

new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
window.addEventListener('storage', event => { if (!event.key || event.key === STORE_SETTINGS_KEY) settingsCache = null; });
scan();