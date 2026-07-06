function receiptModal() {
  return document.querySelector('[data-pos-receipt-modal]');
}

function isReceiptCloseTarget(target) {
  const button = target?.closest?.('button,a,[role="button"]');
  if (!button) return false;
  const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
  const label = (button.getAttribute('aria-label') || '').trim();
  return button.matches('.receipt-close,.receipt-secondary,[data-receipt-close],[data-close-receipt]') || text === 'ปิด' || label === 'ปิด';
}

function closeReceiptModal() {
  const modal = receiptModal();
  if (!modal) return;
  modal.hidden = true;
  modal.classList.remove('show', 'open', 'receipt-print-root');
  modal.removeAttribute('open');
  document.body.classList.remove('modal-open', 'receipt-modal-open', 'is-receipt-open');
  document.documentElement.classList.remove('modal-open', 'receipt-modal-open', 'is-receipt-open');
  document.querySelectorAll('[inert]').forEach(node => {
    if (!node.closest?.('[data-pos-receipt-modal]')) node.removeAttribute('inert');
  });
  const payDialog = document.querySelector('#paymentDialog');
  if (payDialog?.open) {
    try { payDialog.close(); } catch {}
  }
}

document.addEventListener('click', event => {
  const modal = receiptModal();
  if (!modal || modal.hidden) return;
  if (isReceiptCloseTarget(event.target) || event.target.closest('.receipt-modal-backdrop')) {
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
window.addEventListener('focus', () => {
  const modal = receiptModal();
  if (!modal || modal.hidden) return;
  modal.querySelectorAll('button,a,[role="button"]').forEach(el => {
    el.style.pointerEvents = 'auto';
  });
});

window.retailCloseReceiptModal = closeReceiptModal;
