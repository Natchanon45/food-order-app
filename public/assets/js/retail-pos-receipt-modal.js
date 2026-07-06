const RECEIPT_PATH = '/pos/receipt/';
let lastReceiptSaleId = '';

function closeExistingReceiptModal() {
  const modal = document.querySelector('[data-pos-receipt-modal]');
  if (modal) {
    modal.hidden = true;
    modal.removeAttribute('open');
    modal.style.display = '';
    modal.style.pointerEvents = '';
  }
  document.body.classList.remove('modal-open', 'receipt-modal-open', 'is-receipt-open');
  document.documentElement.classList.remove('modal-open', 'receipt-modal-open', 'is-receipt-open');
  document.body.style.pointerEvents = '';
  document.documentElement.style.pointerEvents = '';
  document.body.style.overflow = '';
  document.querySelectorAll('[inert]').forEach(node => node.removeAttribute('inert'));
}

function focusNextSale() {
  document.querySelector('#barcodeInput')?.focus();
  window.dispatchEvent(new CustomEvent('retail-pos-ready-for-next-sale'));
}

function receiptUrl(sale, { autoPrint = true } = {}) {
  const id = encodeURIComponent(sale?.id || sale?.saleNumber || '');
  const auto = autoPrint ? '1' : '0';
  return `${RECEIPT_PATH}?saleId=${id}&auto=${auto}`;
}

function openReceiptWindow(sale, options = {}) {
  if (!sale) return null;
  const saleId = String(sale.id || sale.saleNumber || '');
  if (!saleId) return null;
  lastReceiptSaleId = saleId;
  const width = 460;
  const height = 760;
  const left = Math.max(0, Math.round((screen.width - width) / 2));
  const top = Math.max(0, Math.round((screen.height - height) / 2));
  const features = `popup=yes,width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`;
  const url = receiptUrl(sale, options);
  const popup = window.open(url, `pos_receipt_${saleId.replace(/[^a-zA-Z0-9]/g, '_')}`, features);
  if (!popup) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  window.dispatchEvent(new CustomEvent('retail-pos-receipt-window-opened', { detail: { saleId, saleNumber: sale.saleNumber || '' } }));
  return popup;
}

async function showReceipt(sale, options = {}) {
  closeExistingReceiptModal();
  focusNextSale();
  setTimeout(() => openReceiptWindow(sale, { autoPrint: options.autoPrint !== false }), 120);
}

async function printCurrentReceipt() {
  const sales = (() => { try { return JSON.parse(localStorage.getItem('retail_pos_sales_v1')) || []; } catch { return []; } })();
  const sale = sales.find(row => String(row.id || row.saleNumber || '') === lastReceiptSaleId) || sales[0];
  closeExistingReceiptModal();
  focusNextSale();
  if (sale) openReceiptWindow(sale, { autoPrint: true });
}

window.addEventListener('beforeprint', () => closeExistingReceiptModal());

export { showReceipt, printCurrentReceipt };
