const styleId = 'retailReceiptLogoCleanupStyle';
if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `.receipt-logo,.receipt-header h1 i,.receipt-header h1 svg,.receipt-header h1 img,.receipt-shop i,.receipt-shop svg,.receipt-shop img{display:none!important;visibility:hidden!important}`;
  document.head.appendChild(style);
}

function cleanupReceiptLogo() {
  document.querySelectorAll('.receipt-logo,.receipt-header h1 i,.receipt-header h1 svg,.receipt-header h1 img,.receipt-shop i,.receipt-shop svg,.receipt-shop img').forEach(node => node.remove());
}

new MutationObserver(cleanupReceiptLogo).observe(document.body, { childList: true, subtree: true });
cleanupReceiptLogo();
