const styleId = 'retailMobileCartBarStyle';

function ensureMobileCartStyle() {
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
.mobile-cart-bar{display:none}
@media(max-width:600px){
  body{padding-bottom:calc(74px + env(safe-area-inset-bottom,0px))}
  .mobile-cart-bar{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:9998;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;min-height:56px;padding:9px 12px;border:0;border-radius:18px;background:linear-gradient(135deg,#151515,#0d6f34);color:#fff;box-shadow:0 18px 42px rgba(15,23,42,.28);text-align:left;cursor:pointer}
  .mobile-cart-bar[hidden]{display:none!important}
  .mobile-cart-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:rgba(255,255,255,.13)}
  .mobile-cart-icon svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round}
  .mobile-cart-main{min-width:0;display:grid;gap:2px}
  .mobile-cart-title{font-size:.76rem;font-weight:700;opacity:.84;line-height:1.1}
  .mobile-cart-meta{font-size:.98rem;font-weight:800;line-height:1.12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mobile-cart-pay{border-radius:999px;background:#fff;color:#0d6f34;padding:8px 11px;font-size:.84rem;font-weight:900;white-space:nowrap}
  .app-version-badge{bottom:calc(78px + env(safe-area-inset-bottom,0px))!important}
}
`;
  document.head.appendChild(style);
}

function createBar() {
  let bar = document.querySelector('[data-mobile-cart-bar]');
  if (bar) return bar;
  bar = document.createElement('button');
  bar.type = 'button';
  bar.className = 'mobile-cart-bar';
  bar.dataset.mobileCartBar = 'true';
  bar.innerHTML = `
    <span class="mobile-cart-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 6h15l-1.5 8.5a2 2 0 0 1-2 1.5H9a2 2 0 0 1-2-1.6L5 3H2"></path><circle cx="9" cy="20" r="1.5"></circle><circle cx="18" cy="20" r="1.5"></circle></svg></span>
    <span class="mobile-cart-main"><span class="mobile-cart-title">ตะกร้าขาย</span><span class="mobile-cart-meta" data-mobile-cart-meta>0 รายการ • 0.00 บาท</span></span>
    <span class="mobile-cart-pay">ดูบิล</span>`;
  bar.addEventListener('click', () => {
    const cart = document.querySelector('.cart-panel');
    if (cart) cart.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.body.appendChild(bar);
  return bar;
}

function readNumber(text) {
  const value = String(text || '').replace(/[^0-9.]/g, '');
  return Number(value || 0);
}

function updateMobileCartBar() {
  ensureMobileCartStyle();
  const bar = createBar();
  const itemCount = document.querySelector('#itemCount')?.textContent || '0 รายการ';
  const totalText = document.querySelector('#grandTotal')?.textContent || '0.00';
  const total = readNumber(totalText);
  const meta = bar.querySelector('[data-mobile-cart-meta]');
  if (meta) meta.textContent = `${itemCount} • ${totalText} บาท`;
  bar.hidden = total <= 0;
}

function startMobileCartBar() {
  ensureMobileCartStyle();
  updateMobileCartBar();
  const targets = ['#itemCount', '#grandTotal', '#cartList'].map(selector => document.querySelector(selector)).filter(Boolean);
  const observer = new MutationObserver(updateMobileCartBar);
  targets.forEach(target => observer.observe(target, { childList: true, subtree: true, characterData: true }));
  window.addEventListener('resize', updateMobileCartBar);
  window.addEventListener('storage', updateMobileCartBar);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startMobileCartBar, { once: true });
} else {
  startMobileCartBar();
}

export {};
