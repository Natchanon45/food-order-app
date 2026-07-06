import { getTenantId, saveRecord } from './retail-db.js?v=20260629-032';

const TAX_INVOICE_COLLECTION = 'taxInvoices';
const TAX_INVOICE_LOCAL_KEY = 'retail_pos_tax_invoices_v1';
const STORE_SETTINGS_KEY = 'retail_pos_store_settings_v1';
const LEGACY_STORE_SETTINGS_KEY = 'food_order_store_settings';

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTaxId(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 13);
}

function saleKey(sale = {}) {
  return String(sale.id || sale.saleNumber || '').trim();
}

function moneyNumber(value) {
  return Number(Number(value || 0).toFixed(2));
}

function settings() {
  const legacy = readJson(LEGACY_STORE_SETTINGS_KEY, {});
  const local = readJson(STORE_SETTINGS_KEY, {});
  const merged = { ...legacy, ...local };
  return {
    sellerName: normalizeText(merged.taxInvoiceName || merged.shopName || merged.name || 'POS ร้านค้าปลีก'),
    sellerAddress: normalizeText(merged.taxInvoiceAddress || merged.shopAddress || merged.address || ''),
    sellerPhone: normalizeText(merged.shopPhone || merged.phone || ''),
    sellerTaxId: normalizeTaxId(merged.taxId || merged.shopTaxId || ''),
    sellerBranchType: String(merged.taxBranchType || 'headOffice') === 'branch' ? 'branch' : 'headOffice',
    sellerBranchCode: normalizeText(merged.taxBranchCode || ''),
    vatRate: Number.isFinite(Number(merged.vatRate)) ? Number(merged.vatRate) : 7
  };
}

function listLocalInvoices() {
  const rows = readJson(TAX_INVOICE_LOCAL_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function saveLocalInvoice(invoice) {
  const rows = listLocalInvoices().filter(row => String(row.id) !== String(invoice.id));
  rows.push(invoice);
  writeJson(TAX_INVOICE_LOCAL_KEY, rows);
}

function nextInvoiceNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TAX-${ymd}-`;
  const max = listLocalInvoices()
    .map(row => String(row.invoiceNumber || ''))
    .filter(value => value.startsWith(prefix))
    .map(value => Number(value.slice(prefix.length)) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

function defaultBuyerFromSale(sale = {}) {
  return {
    buyerName: normalizeText(sale.taxBuyerName || sale.customerName || sale.customerDisplayName || ''),
    buyerTaxId: normalizeTaxId(sale.taxBuyerTaxId || sale.customerTaxId || ''),
    buyerAddress: normalizeText(sale.taxBuyerAddress || sale.customerAddress || ''),
    buyerBranchName: normalizeText(sale.taxBuyerBranchName || sale.customerBranchName || 'สำนักงานใหญ่')
  };
}

function collectBuyerInput(sale = {}) {
  const defaults = defaultBuyerFromSale(sale);
  const buyerName = normalizeText(window.prompt('ชื่อลูกค้า / บริษัท สำหรับใบกำกับภาษีเต็มรูปแบบ', defaults.buyerName || ''));
  if (!buyerName) return null;
  const buyerTaxId = normalizeTaxId(window.prompt('เลขประจำตัวผู้เสียภาษีลูกค้า 13 หลัก', defaults.buyerTaxId || ''));
  const buyerAddress = normalizeText(window.prompt('ที่อยู่ลูกค้าสำหรับใบกำกับภาษี', defaults.buyerAddress || ''));
  const buyerBranchName = normalizeText(window.prompt('สำนักงานใหญ่ / สาขาของลูกค้า', defaults.buyerBranchName || 'สำนักงานใหญ่')) || 'สำนักงานใหญ่';
  return { buyerName, buyerTaxId, buyerAddress, buyerBranchName };
}

function buildInvoiceFromSale(sale, buyer) {
  const store = settings();
  const id = `tax-${saleKey(sale) || Date.now()}`;
  const vatRate = Number.isFinite(Number(sale.vatRate)) ? Number(sale.vatRate) : store.vatRate;
  const total = moneyNumber(sale.totalAmount ?? sale.total);
  const vatAmount = moneyNumber(sale.vatAmount || 0);
  const beforeVat = moneyNumber(sale.beforeVat ?? sale.taxableBase ?? sale.discountedBase ?? (total - vatAmount));
  return {
    id,
    tenantId: getTenantId(),
    saleId: saleKey(sale),
    saleNumber: sale.saleNumber || sale.number || '',
    invoiceNumber: nextInvoiceNumber(),
    invoiceType: 'fullTaxInvoice',
    status: 'issued',
    issuedAt: Date.now(),
    seller: store,
    buyer,
    items: Array.isArray(sale.items) ? sale.items : [],
    subtotal: moneyNumber(sale.subtotal),
    discount: moneyNumber(sale.discount),
    pointDiscount: moneyNumber(sale.pointDiscount),
    beforeVat,
    vatRate,
    vatAmount,
    vatMode: String(sale.vatMode || 'include') === 'exclude' ? 'exclude' : 'include',
    totalAmount: total,
    paymentMethod: sale.paymentMethod || sale.payment?.method || '',
    sourceSale: {
      id: sale.id || '',
      saleNumber: sale.saleNumber || sale.number || '',
      createdAt: sale.createdAt || null
    }
  };
}

export async function createFullTaxInvoiceFromSale(sale) {
  if (!sale) throw new Error('ไม่พบข้อมูลบิล');
  const buyer = collectBuyerInput(sale);
  if (!buyer) return null;
  const invoice = buildInvoiceFromSale(sale, buyer);
  saveLocalInvoice(invoice);
  try { await saveRecord(TAX_INVOICE_COLLECTION, invoice); }
  catch (error) { console.warn('[retail-pos-full-tax-invoice] save firebase failed', error); }
  return invoice;
}

export function taxInvoiceUrl(invoice, { autoPrint = false } = {}) {
  const id = encodeURIComponent(invoice?.id || invoice?.invoiceNumber || '');
  return `/pos/tax-invoice/?invoiceId=${id}&auto=${autoPrint ? '1' : '0'}`;
}
