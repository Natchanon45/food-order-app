const nativeSetItem = Storage.prototype.setItem;

function restoreNativeLocalStorageSetItem() {
  try {
    localStorage.setItem = function safeSetItem(key, value) {
      nativeSetItem.call(localStorage, key, value);
      if (key === 'retail_pos_store_settings_v1' || key === 'food_order_store_settings') {
        window.dispatchEvent(new CustomEvent('retail-pos-receipt-settings-updated'));
      }
    };
  } catch (error) {
    console.warn('[retail-pos-receipt-modal-guard] unable to restore localStorage.setItem', error);
  }
}

function receiptModal() {
  return document.querySelector('[data-pos-receipt-modal]');
}

function paymentDialog() {
  return document.querySelector('#paymentDialog');
}

function unlockPage() {
  document.body.classList.remove('modal-open', 'receipt-modal-open', 'is-receipt-open');
  document.documentElement.classList.remove('modal-open', 'receipt-modal-open', 'is-receipt-open');
  document.body.style.pointerEvents = '';
  document.documentElement.style.pointerEvents = '';
  document.body.style.overflow = '';
  document.querySelectorAll('[inert]').forEach(node => {
    if (!node.closest?.('[data-pos-receipt-modal]')) node.removeAttribute('inert');
  });
}

function closeNativePaymentDialog() {
  const dialog = paymentDialog();
  if (dialog?.open) {
    try { dialog.close(); }
    catch { dialog.removeAttribute('open'); }
  }
}

function normalizeReceiptModal() {
  const modal = receiptModal();
  if (!modal || modal.hidden) return;
  closeNativePaymentDialog();
  unlockPage();
  modal.style.display = 'grid';
  modal.style.pointerEvents = 'auto';
  modal.style.zIndex = '2147483647';
  modal.querySelectorAll('button,a,[role="button"],[data-close-receipt],[data-print-receipt]').forEach(el => {
    el.disabled = false;
    el.style.pointerEvents = 'auto';
  });
}

function isReceiptCloseTarget(target) {
  const button = target?.closest?.('button,a,[role="button"],[data-close-receipt]');
  if (!button) return false;
  const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
  const label = (button.getAttribute('aria-label') || '').trim();
  return button.matches('.receipt-close,.receipt-secondary,[data-receipt-close],[data-close-receipt]') || text === 'ปิด' || label === 'ปิด';
}

function notifyReceiptClosed() {
  window.dispatchEvent(new CustomEvent('retail-pos-receipt-closed'));
}

function closeReceiptModal() {
  const modal = receiptModal();
  if (modal) {
    modal.hidden = true;
    modal.style.display = '';
    modal.style.pointerEvents = '';
    modal.style.zIndex = '';
    modal.removeAttribute('open');
  }
  unlockPage();
  notifyReceiptClosed();
  document.querySelector('#barcodeInput')?.focus();
}

restoreNativeLocalStorageSetItem();
window.addEventListener('retail-pos-safe-confirm-ready', restoreNativeLocalStorageSetItem);
window.addEventListener('retail-pos-ready-for-next-sale', restoreNativeLocalStorageSetItem);

document.addEventListener('click', event => {
  const modal = receiptModal();
  if (!modal || modal.hidden) return;
  if (isReceiptCloseTarget(event.target) || event.target.closest?.('.receipt-modal-backdrop')) {
    event.preventDefault();
    event.stopPropagation();
    closeReceiptModal();
  }
}, true);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && receiptModal() && !receiptModal().hidden) {
    event.preventDefault();
    closeReceiptModal();
  }
}, true);

window.addEventListener('afterprint', () => setTimeout(closeReceiptModal, 80));
window.addEventListener('focus', normalizeReceiptModal);
window.retailCloseReceiptModal = closeReceiptModal;
