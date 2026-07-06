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
  return `${RECEIPT_PATH}?saleId=${id}&auto=${autoPrint ? '1' : '0'}`;
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
  const popup = window.open(receiptUrl(sale, options), `pos_receipt_${saleId.replace(/[^a-zA-Z0-9]/g, '_')}`, features);
  window.dispatchEvent(new CustomEvent('retail-pos-receipt-window-opened', { detail: { saleId, saleNumber: sale.saleNumber || '' } }));
  return popup;
}

async function showReceipt(sale) {
  closeExistingReceiptModal();
  const popup = openReceiptWindow(sale, { autoPrint: true });
  focusNextSale();
  if (!popup) {
    const url = receiptUrl(sale, { autoPrint: true });
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'เปิดใบเสร็จ';
    link.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#159447;color:#fff;padding:12px 16px;border-radius:14px;font-weight:800;text-decoration:none';
    document.body.appendChild(link);
    setTimeout(() => link.remove(), 8000);
  }
}

async function printCurrentReceipt() {
  const sales = (() => { try { return JSON.parse(localStorage.getItem('retail_pos_sales_v1')) || []; } catch { return []; } })();
  const sale = sales.find(row => String(row.id || row.saleNumber || '') === lastReceiptSaleId) || sales[0];
  closeExistingReceiptModal();
  if (sale) openReceiptWindow(sale, { autoPrint: true });
  focusNextSale();
}

window.addEventListener('beforeprint', () => closeExistingReceiptModal());

export { showReceipt, printCurrentReceipt };
