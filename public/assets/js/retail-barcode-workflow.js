const styleId = 'retailBarcodeWorkflowStyle';
let lastQty = 0;
let focusTimer = null;

function ensureStyle() {
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
.barcode-focus-pulse{box-shadow:0 0 0 3px rgba(21,148,71,.18)!important;border-color:#159447!important}.barcode-scan-flash{position:fixed;left:50%;top:84px;z-index:9997;transform:translateX(-50%) translateY(-8px);opacity:0;pointer-events:none;display:flex;align-items:center;gap:8px;padding:9px 13px;border-radius:999px;background:rgba(21,148,71,.94);color:#fff;font-weight:900;font-size:.9rem;box-shadow:0 14px 34px rgba(15,23,42,.22);transition:opacity .14s ease,transform .14s ease}.barcode-scan-flash.show{opacity:1;transform:translateX(-50%) translateY(0)}.barcode-scan-flash .bi{font-size:18px;line-height:1}@media(max-width:600px){.barcode-scan-flash{top:72px;font-size:.82rem;padding:8px 11px}}
`;
  document.head.appendChild(style);
}

function barcodeInput() {
  return document.querySelector('#barcodeInput');
}

function isTypingElsewhere() {
  const active = document.activeElement;
  if (!active || active === document.body) return false;
  if (active === barcodeInput()) return false;
  if (active.closest('dialog[open]')) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable;
}

function focusBarcode({ force = false } = {}) {
  const input = barcodeInput();
  if (!input || input.disabled) return;
  if (!force && isTypingElsewhere()) return;
  window.clearTimeout(focusTimer);
  focusTimer = window.setTimeout(() => {
    if (!force && isTypingElsewhere()) return;
    input.focus({ preventScroll: true });
    input.select?.();
    input.classList.add('barcode-focus-pulse');
    window.setTimeout(() => input.classList.remove('barcode-focus-pulse'), 220);
  }, 40);
}

function totalQty() {
  const text = document.querySelector('#itemCount')?.textContent || '0';
  return Number(String(text).replace(/[^0-9]/g, '') || 0);
}

function flash(message = 'เพิ่มสินค้าแล้ว') {
  let el = document.querySelector('[data-barcode-scan-flash]');
  if (!el) {
    el = document.createElement('div');
    el.dataset.barcodeScanFlash = 'true';
    el.className = 'barcode-scan-flash';
    el.innerHTML = '<i class="bi bi-check-circle" aria-hidden="true"></i><span></span>';
    document.body.appendChild(el);
  }
  el.querySelector('span').textContent = message;
  el.classList.add('show');
  window.clearTimeout(el._hideTimer);
  el._hideTimer = window.setTimeout(() => el.classList.remove('show'), 520);
}

function startBarcodeWorkflow() {
  ensureStyle();
  const input = barcodeInput();
  if (!input) return;
  input.autocomplete = 'off';
  input.setAttribute('enterkeyhint', 'done');
  input.setAttribute('aria-label', 'สแกนบาร์โค้ดสินค้า');
  lastQty = totalQty();

  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    focusBarcode({ force: true });
  }, true);

  document.addEventListener('pointerdown', event => {
    if (event.target.closest('dialog,[data-mobile-cart-drawer],[data-app-dev-panel]')) return;
    window.setTimeout(() => focusBarcode(), 120);
  }, { passive: true });

  const itemCount = document.querySelector('#itemCount');
  if (itemCount) {
    new MutationObserver(() => {
      const nextQty = totalQty();
      if (nextQty > lastQty) flash('เพิ่มสินค้าแล้ว');
      lastQty = nextQty;
      if (!document.querySelector('dialog[open]')) focusBarcode({ force: true });
    }).observe(itemCount, { childList: true, characterData: true, subtree: true });
  }

  document.addEventListener('close', event => {
    if (event.target?.matches?.('dialog')) focusBarcode({ force: true });
  }, true);

  window.addEventListener('pageshow', () => focusBarcode({ force: true }));
  window.setTimeout(() => focusBarcode({ force: true }), 250);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startBarcodeWorkflow, { once: true });
} else {
  startBarcodeWorkflow();
}

export {};
