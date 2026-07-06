const DISABLED_REASON = 'Receipt modal and print flow are temporarily disabled to prevent POS freeze after successful sale.';

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

async function showReceipt(sale) {
  closeExistingReceiptModal();
  focusNextSale();
  window.dispatchEvent(new CustomEvent('retail-pos-receipt-skipped', {
    detail: {
      reason: DISABLED_REASON,
      saleId: sale?.id || '',
      saleNumber: sale?.saleNumber || ''
    }
  }));
}

async function printCurrentReceipt() {
  closeExistingReceiptModal();
  focusNextSale();
  console.warn('[retail-pos-receipt-modal] print disabled:', DISABLED_REASON);
}

window.addEventListener('beforeprint', event => {
  closeExistingReceiptModal();
});

export { showReceipt, printCurrentReceipt };
