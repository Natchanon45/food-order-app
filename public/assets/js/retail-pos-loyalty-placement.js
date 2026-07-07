function moveLoyaltyBox() {
  const anchor = document.querySelector('.customer-picker');
  const box = document.querySelector('#loyaltyBox');
  if (!anchor || !box) return;
  if (anchor.nextElementSibling !== box) anchor.insertAdjacentElement('afterend', box);
}

new MutationObserver(moveLoyaltyBox).observe(document.body, { childList: true, subtree: true });
document.querySelector('#payBtn')?.addEventListener('click', () => setTimeout(moveLoyaltyBox, 0));
document.querySelector('#paymentDialog')?.addEventListener('pos:customer-change', () => setTimeout(moveLoyaltyBox, 0));
setInterval(moveLoyaltyBox, 700);
moveLoyaltyBox();
