const paymentDialog = document.querySelector('#paymentDialog');
const receivedInput = document.querySelector('#receivedInput');
const payButton = document.querySelector('#payBtn');

function selectReceivedAmount() {
  if (!receivedInput || receivedInput.hidden || receivedInput.offsetParent === null) return;
  requestAnimationFrame(() => {
    receivedInput.focus({ preventScroll: true });
    try { receivedInput.select(); } catch {}
    setTimeout(() => { try { receivedInput.select(); } catch {} }, 30);
  });
}

if (paymentDialog && receivedInput) {
  payButton?.addEventListener('click', () => setTimeout(selectReceivedAmount, 80));
  paymentDialog.addEventListener('focusin', event => {
    if (event.target === receivedInput) selectReceivedAmount();
  });
  receivedInput.addEventListener('pointerup', () => setTimeout(selectReceivedAmount, 0));
  receivedInput.addEventListener('click', () => setTimeout(selectReceivedAmount, 0));
  receivedInput.addEventListener('keydown', event => {
    if (event.key === 'Tab' || event.key.startsWith('Arrow')) return;
    if (receivedInput.selectionStart === receivedInput.selectionEnd) {
      try { receivedInput.select(); } catch {}
    }
  }, { once: true });

  new MutationObserver(() => {
    if (paymentDialog.open) setTimeout(selectReceivedAmount, 80);
  }).observe(paymentDialog, { attributes: true, attributeFilter: ['open'] });
}
