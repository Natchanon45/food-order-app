// Delivery buttons keep their native click handlers.
// This helper only normalizes the payment-action UI to match the canonical checkout.
const removePaymentSlip = document.querySelector('#removePaymentSlip');
const promptPaySection = document.querySelector('#promptPaySection');

function isThaiLocale() {
  let stored = '';
  try {
    stored = String(localStorage.getItem('food_order_locale') || '').toLowerCase();
  } catch (_) {
    stored = '';
  }
  if (stored) return stored.startsWith('th');
  return !String(document.documentElement.lang || 'th').toLowerCase().startsWith('en');
}

function ensurePaymentActionStyle() {
  if (document.querySelector('#deliveryPaymentActionUiPatch')) return;
  const style = document.createElement('style');
  style.id = 'deliveryPaymentActionUiPatch';
  style.textContent = `
    #paymentLockPanel .payment-lock-actions .btn {
      min-width: 0 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    .payment-slip-wrap { position: relative !important; }
    .payment-slip-wrap #removePaymentSlip[hidden] { display: none !important; }
    .payment-slip-wrap #removePaymentSlip.payment-slip-remove-icon {
      position: absolute !important;
      top: 29px !important;
      right: 9px !important;
      z-index: 12 !important;
      width: 42px !important;
      height: 42px !important;
      min-width: 42px !important;
      min-height: 42px !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 2px solid rgba(15, 23, 42, .24) !important;
      border-radius: 50% !important;
      background: rgba(255, 255, 255, .96) !important;
      color: #111827 !important;
      box-shadow: 0 4px 14px rgba(15, 23, 42, .22) !important;
      display: inline-grid !important;
      place-items: center !important;
      line-height: 1 !important;
    }
    .payment-slip-wrap #removePaymentSlip.payment-slip-remove-icon .app-icon {
      width: 20px !important;
      height: 20px !important;
      margin: 0 !important;
      font-size: 20px !important;
      line-height: 1 !important;
    }
  `;
  document.head.appendChild(style);
}

function normalizePaymentActions() {
  ensurePaymentActionStyle();
  const thai = isThaiLocale();
  if (removePaymentSlip) {
    const label = thai ? 'ลบสลิป' : 'Remove slip';
    removePaymentSlip.classList.remove('btn-danger');
    removePaymentSlip.classList.add('payment-slip-remove-icon');
    removePaymentSlip.setAttribute('aria-label', label);
    removePaymentSlip.setAttribute('title', label);
    if (removePaymentSlip.children.length != 1 || !removePaymentSlip.querySelector('.bi-x-lg')) {
      removePaymentSlip.innerHTML = '<i class="bi bi-x-lg app-icon" aria-hidden="true"></i>';
    }
  }
  const downloadButton = document.querySelector('#downloadPaymentQr');
  const downloadLabel = downloadButton?.querySelector('span');
  if (downloadLabel) {
    const expected = thai ? 'ดาวน์โหลด' : 'Download';
    if (downloadLabel.textContent !== expected) downloadLabel.textContent = expected;
  }
  const editButton = document.querySelector('#editLockedOrder');
  const editLabel = editButton?.querySelector('span') || editButton;
  if (editLabel) {
    const expected = thai ? 'แก้ไข' : 'Edit';
    if (editLabel.textContent !== expected) editLabel.textContent = expected;
  }
}

if (promptPaySection) {
  new MutationObserver(normalizePaymentActions).observe(promptPaySection, {
    childList: true,
    subtree: true,
  });
}
new MutationObserver(normalizePaymentActions).observe(document.body, {
  attributes: true,
  attributeFilter: ['class'],
});
document.addEventListener('food-order-locale-changed', normalizePaymentActions);
normalizePaymentActions();
