function receiptModal() {
  return document.querySelector('[data-pos-receipt-modal]');
}

function paymentDialog() {
  return document.querySelector('#paymentDialog');
}

function isReceiptOpen(modal = receiptModal()) {
  return Boolean(modal && modal.hidden === false);
}

function unlockPage() {
  document.body.classList.remove('modal-open', 'receipt-modal-open', 'is-receipt-open');
  document.documentElement.classList.remove('modal-open', 'receipt-modal-open', 'is-receipt-open');
  document.body.style.pointerEvents = '';
  document.documentElement.style.pointerEvents = '';
  document.querySelectorAll('[inert]').forEach(node => {
    if (!node.closest?.('[data-pos-receipt-modal]')) node.removeAttribute('inert');
  });
}

function closeNativePaymentDialog() {
  const dialog = paymentDialog();
  if (!dialog?.open) return;
  try { dialog.close(); }
  catch { dialog.removeAttribute('open'); }
}

function normalizeReceiptModal() {
  const modal = receiptModal();
  if (!isReceiptOpen(modal)) return;
  closeNativePaymentDialog();
  unlockPage();
  modal.classList.add('receipt-print-root');
  modal.style.display = 'grid';
  modal.style.pointerEvents = 'auto';
  modal.style.zIndex = '2147483647';
  modal.querySelectorAll('button,a,[role="button"],[data-close-receipt],[data-print-receipt]').forEach(el => {
    el.style.pointerEvents = 'auto';
    el.disabled = false;
  });
}

function isReceiptCloseTarget(target) {
  const button = target?.closest?.('button,a,[role="button"],[data-close-receipt]');
  if (!button) return false;
  const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
  const label = (button.getAttribute('aria-label') || '').trim();
  return button.matches('.receipt-close,.receipt-secondary,[data-receipt-close],[data-close-receipt]') || text === 'ปิด' || label === 'ปิด';
}

function closeReceiptModal() {
  const modal = receiptModal();
  if (modal) {
    modal.hidden = true;
    modal.style.display = '';
    modal.style.pointerEvents = '';
    modal.style.zIndex = '';
    modal.classList.remove('show', 'open');
    modal.removeAttribute('open');
  }
  closeNativePaymentDialog();
  unlockPage();
}

document.addEventListener('click', event => {
  normalizeReceiptModal();
  const modal = receiptModal();
  if (!isReceiptOpen(modal)) return;
  if (isReceiptCloseTarget(event.target) || event.target.closest?.('.receipt-modal-backdrop')) {
    event.preventDefault();
    event.stopPropagation();
    closeReceiptModal();
  }
}, true);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && isReceiptOpen()) {
    event.preventDefault();
    closeReceiptModal();
  }
}, true);

new MutationObserver(normalizeReceiptModal).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open', 'class', 'style'] });
setInterval(normalizeReceiptModal, 500);
window.addEventListener('afterprint', () => setTimeout(closeReceiptModal, 80));
window.addEventListener('focus', normalizeReceiptModal);
window.addEventListener('pageshow', normalizeReceiptModal);
window.retailCloseReceiptModal = closeReceiptModal;
normalizeReceiptModal();
