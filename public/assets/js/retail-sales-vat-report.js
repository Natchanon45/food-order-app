const SALES_KEY = 'retail_pos_sales_v1';

const els = {
  table: document.querySelector('#salesTableBody'),
  beforeVatTotal: document.querySelector('#beforeVatTotal'),
  vatTotal: document.querySelector('#vatTotal'),
  vatBillCount: document.querySelector('#vatBillCount'),
  exportCsvBtn: document.querySelector('#exportCsvBtn'),
  dateFrom: document.querySelector('#dateFrom'),
  dateTo: document.querySelector('#dateTo'),
  saleSearch: document.querySelector('#saleSearch'),
  paymentFilter: document.querySelector('#paymentFilter')
};

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function money(value) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function sales() {
  const rows = readJson(SALES_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function saleNumber(sale = {}) {
  return String(sale.saleNumber || sale.number || sale.id || '').trim();
}

function saleTotal(sale = {}) {
  return Number(sale.totalAmount ?? sale.total ?? 0);
}

function paymentMethod(sale = {}) {
  return sale.payment?.method || sale.paymentMethod || 'cash';
}

function paymentName(method) {
  return method === 'cash' ? 'เงินสด' : 'PromptPay / โอนเงิน';
}

function vatSale(sale = {}) {
  return sale.vatRegistered === true || sale.vatRegistered === 'yes' || Number(sale.vatAmount || 0) > 0;
}

function vatMode(sale = {}) {
  if (!vatSale(sale)) return '-';
  return String(sale.vatMode || '') === 'exclude' ? 'exclude' : 'include';
}

function beforeVat(sale = {}) {
  if (!vatSale(sale)) return 0;
  return Number(sale.beforeVat ?? sale.taxableBase ?? sale.discountedBase ?? sale.subtotal ?? 0);
}

function localDateKey(value) {
  const date = new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function filteredSales() {
  const keyword = (els.saleSearch?.value || '').trim().toLowerCase();
  const from = els.dateFrom?.value || '';
  const to = els.dateTo?.value || '';
  const method = els.paymentFilter?.value || 'all';
  return sales().filter(sale => {
    const date = localDateKey(sale.createdAt);
    const items = (sale.items || []).map(item => `${item.name || ''} ${item.id || ''} ${item.barcode || ''}`).join(' ').toLowerCase();
    const matchesKeyword = !keyword || saleNumber(sale).toLowerCase().includes(keyword) || String(sale.id || '').toLowerCase().includes(keyword) || items.includes(keyword);
    return matchesKeyword && (!from || date >= from) && (!to || date <= to) && (method === 'all' || paymentMethod(sale) === method);
  });
}

function findSaleByNumber(value) {
  const text = String(value || '').trim();
  return sales().find(sale => saleNumber(sale) === text || String(sale.id || '') === text) || null;
}

function cell(text, className = '') {
  const td = document.createElement('td');
  if (className) td.className = className;
  td.textContent = text;
  return td;
}

function enhanceRows() {
  if (!els.table) return;
  [...els.table.querySelectorAll('tr')].forEach(row => {
    if (row.dataset.vatReportReady === '1') return;
    const sale = findSaleByNumber(row.querySelector('.sale-id')?.textContent);
    if (!sale) return;
    row.dataset.vatReportReady = '1';
    const paymentCell = row.children[3];
    if (!paymentCell) return;
    paymentCell.insertAdjacentElement('afterend', cell(vatMode(sale)));
    paymentCell.nextElementSibling.insertAdjacentElement('afterend', cell(vatSale(sale) ? money(beforeVat(sale)) : '-', 'number'));
    paymentCell.nextElementSibling.nextElementSibling.insertAdjacentElement('afterend', cell(vatSale(sale) ? money(sale.vatAmount) : '-', 'number'));
  });
}

function updateStats() {
  const rows = filteredSales();
  const beforeTotal = rows.reduce((sum, sale) => sum + beforeVat(sale), 0);
  const vatTotal = rows.reduce((sum, sale) => sum + Number(sale.vatAmount || 0), 0);
  const billCount = rows.filter(vatSale).length;
  if (els.beforeVatTotal) els.beforeVatTotal.textContent = money(beforeTotal);
  if (els.vatTotal) els.vatTotal.textContent = money(vatTotal);
  if (els.vatBillCount) els.vatBillCount.textContent = billCount.toLocaleString('th-TH');
}

function exportVatCsv(event) {
  const rows = filteredSales();
  if (!rows.length) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const lines = [[
    'เลขที่บิล', 'วันและเวลา', 'ช่องทางชำระ', 'จำนวนสินค้า', 'โหมด VAT', 'รวมสินค้า', 'ส่วนลด', 'ส่วนลดแต้ม', 'ยอดก่อน VAT', 'VAT', 'ยอดสุทธิ', 'รับเงิน', 'เงินทอน', 'พนักงาน', 'เครื่อง POS'
  ]];
  rows.forEach(sale => {
    const qty = (sale.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
    lines.push([
      saleNumber(sale),
      new Date(sale.createdAt).toLocaleString('th-TH'),
      paymentName(paymentMethod(sale)),
      qty,
      vatMode(sale),
      Number(sale.subtotal || 0).toFixed(2),
      Number(sale.discount || 0).toFixed(2),
      Number(sale.pointDiscount || 0).toFixed(2),
      Number(beforeVat(sale) || 0).toFixed(2),
      Number(sale.vatAmount || 0).toFixed(2),
      Number(saleTotal(sale) || 0).toFixed(2),
      Number(sale.payment?.received ?? sale.receivedAmount ?? 0).toFixed(2),
      Number(sale.payment?.change ?? sale.changeAmount ?? 0).toFixed(2),
      sale.cashierName || '',
      sale.terminalCode || ''
    ]);
  });
  const csv = `\uFEFF${lines.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `retail-sales-vat-${els.dateFrom?.value || 'all'}-${els.dateTo?.value || 'all'}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function refresh() {
  enhanceRows();
  updateStats();
}

new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true });
els.exportCsvBtn?.addEventListener('click', exportVatCsv, true);
window.addEventListener('storage', refresh);
refresh();
