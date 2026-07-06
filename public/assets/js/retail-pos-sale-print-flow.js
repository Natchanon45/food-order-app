import { showReceipt } from './retail-pos-receipt-modal.js?v=20260705-002';

const SALES_KEY = 'retail_pos_sales_v1';
const nativeSetItem = localStorage.setItem.bind(localStorage);
let lastPromptedSaleId = '';

function readSaleId(sale = {}) {
  return String(sale.id || sale.saleNumber || '').trim();
}

function latestSaleFromValue(value) {
  try {
    const rows = JSON.parse(value);
    return Array.isArray(rows) ? rows[0] : null;
  } catch {
    return null;
  }
}

function closePaymentDialog() {
  const dialog = document.querySelector('#paymentDialog');
  if (!dialog) return;
  if (dialog.open) {
    try { dialog.close(); }
    catch { dialog.removeAttribute('open'); }
  }
  dialog.removeAttribute('open');
}

function clearBlockingState() {
  closePaymentDialog();
  document.body.classList.remove('modal-open', 'receipt-modal-open', 'is-receipt-open');
  document.documentElement.classList.remove('modal-open', 'receipt-modal-open', 'is-receipt-open');
  document.body.style.pointerEvents = '';
  document.documentElement.style.pointerEvents = '';
  document.body.style.overflow = '';
  document.querySelectorAll('[inert]').forEach(node => {
    if (!node.closest?.('[data-pos-receipt-modal]')) node.removeAttribute('inert');
  });
}

async function openReceiptPrompt(sale) {
  const id = readSaleId(sale);
  if (!id || id === lastPromptedSaleId) return;
  lastPromptedSaleId = id;
  clearBlockingState();
  try {
    await showReceipt(sale, { autoPrint: false });
    clearBlockingState();
    const modal = document.querySelector('[data-pos-receipt-modal]');
    if (modal) {
      modal.hidden = false;
      modal.style.display = 'grid';
      modal.style.pointerEvents = 'auto';
      modal.style.zIndex = '2147483647';
      modal.querySelectorAll('button,a,[role="button"],[data-close-receipt],[data-print-receipt]').forEach(el => {
        el.disabled = false;
        el.style.pointerEvents = 'auto';
      });
    }
  } catch (error) {
    console.error('[retail-pos-sale-print-flow] open receipt failed', error);
  }
}

function scheduleReceiptPrompt(sale) {
  [80, 220, 520].forEach(delay => setTimeout(() => openReceiptPrompt(sale), delay));
}

localStorage.setItem = function salePrintSetItem(key, value) {
  const result = nativeSetItem(key, value);
  if (key === SALES_KEY) {
    const sale = latestSaleFromValue(value);
    if (sale) scheduleReceiptPrompt(sale);
  }
  return result;
};

window.addEventListener('retail:pos-sale-completed', event => {
  const sale = event.detail?.sale;
  if (sale) scheduleReceiptPrompt(sale);
});

window.retailOpenReceiptAfterSale = scheduleReceiptPrompt;
