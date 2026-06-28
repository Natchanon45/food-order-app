const styleId = 'retailMobileCartBarStyle';
let drawerOpen = false;
let touchStartY = 0;

function ensureMobileCartStyle() {
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
.mobile-cart-bar,.mobile-cart-drawer,.mobile-cart-backdrop{display:none}
@media(max-width:600px){
  body{padding-bottom:calc(74px + env(safe-area-inset-bottom,0px))}
  body.mobile-cart-drawer-open{overflow:hidden}
  .mobile-cart-bar{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:9998;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;min-height:56px;padding:9px 12px;border:0;border-radius:18px;background:linear-gradient(135deg,#151515,#0d6f34);color:#fff;box-shadow:0 18px 42px rgba(15,23,42,.28);text-align:left;cursor:pointer}
  .mobile-cart-bar[hidden]{display:none!important}
  .mobile-cart-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:rgba(255,255,255,.13)}
  .mobile-cart-icon svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round}
  .mobile-cart-main{min-width:0;display:grid;gap:2px}
  .mobile-cart-title{font-size:.76rem;font-weight:700;opacity:.84;line-height:1.1}
  .mobile-cart-meta{font-size:.98rem;font-weight:800;line-height:1.12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mobile-cart-pay{border-radius:999px;background:#fff;color:#0d6f34;padding:8px 11px;font-size:.84rem;font-weight:900;white-space:nowrap}
  .mobile-cart-backdrop{position:fixed;inset:0;z-index:9996;background:rgba(15,23,42,.52);backdrop-filter:blur(2px);opacity:0;pointer-events:none;transition:opacity .18s ease;display:block}
  .mobile-cart-backdrop.open{opacity:1;pointer-events:auto}
  .mobile-cart-drawer{position:fixed;left:0;right:0;bottom:0;z-index:9997;display:flex;flex-direction:column;max-height:78dvh;min-height:310px;padding:8px 12px calc(14px + env(safe-area-inset-bottom,0px));border-radius:24px 24px 0 0;background:#fff;color:#151515;box-shadow:0 -24px 70px rgba(15,23,42,.34);transform:translateY(105%);transition:transform .22s ease;overflow:hidden}
  .mobile-cart-drawer.open{transform:translateY(0)}
  .mobile-cart-handle{width:46px;height:5px;border-radius:999px;background:#d7e1dc;margin:0 auto 10px;flex:0 0 auto}
  .mobile-cart-drawer-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 2px 10px;border-bottom:1px solid #dde5df;flex:0 0 auto}
  .mobile-cart-drawer-head h3{margin:0;font-size:1.05rem;line-height:1.2}
  .mobile-cart-drawer-head small{display:block;margin-top:2px;color:#6b746f;font-size:.78rem}
  .mobile-cart-close{border:0;border-radius:999px;width:34px;height:34px;background:#eef3f0;font-size:22px;line-height:1;color:#151515}
  .mobile-cart-items{flex:1 1 auto;overflow:auto;padding:6px 0;overscroll-behavior:contain}
  .mobile-cart-empty{padding:32px 10px;text-align:center;color:#6b746f}
  .mobile-cart-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:10px 0;border-bottom:1px solid #edf2ef}
  .mobile-cart-row strong{display:block;font-size:.92rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mobile-cart-row span{display:block;margin-top:3px;color:#6b746f;font-size:.76rem;line-height:1.2}
  .mobile-cart-row b{font-size:.9rem;white-space:nowrap}
  .mobile-cart-footer{flex:0 0 auto;border-top:1px solid #dde5df;padding-top:10px;display:grid;gap:8px}
  .mobile-cart-total{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:1.02rem;font-weight:900;color:#0d6f34}
  .mobile-cart-checkout{border:0;border-radius:14px;min-height:48px;background:#159447;color:#fff;font-weight:900;font-size:1rem}
  .mobile-cart-checkout:disabled{opacity:.45}
  .app-version-badge{bottom:calc(78px + env(safe-area-inset-bottom,0px))!important}
}
`;
  document.head.appendChild(style);
}

function readNumber(text) {
  const value = String(text || '').replace(/[^0-9.]/g, '');
  return Number(value || 0);
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
  bar.addEventListener('click', openDrawer);
  document.body.appendChild(bar);
  return bar;
}

function createDrawer() {
  let drawer = document.querySelector('[data-mobile-cart-drawer]');
  if (drawer) return drawer;
  const backdrop = document.createElement('div');
  backdrop.className = 'mobile-cart-backdrop';
  backdrop.dataset.mobileCartBackdrop = 'true';
  backdrop.addEventListener('click', closeDrawer);
  document.body.appendChild(backdrop);

  drawer = document.createElement('section');
  drawer.className = 'mobile-cart-drawer';
  drawer.dataset.mobileCartDrawer = 'true';
  drawer.innerHTML = `
    <div class="mobile-cart-handle" data-mobile-cart-close></div>
    <header class="mobile-cart-drawer-head">
      <div><h3>รายการขาย</h3><small data-mobile-cart-drawer-meta>0 รายการ</small></div>
      <button type="button" class="mobile-cart-close" data-mobile-cart-close aria-label="ปิด">×</button>
    </header>
    <div class="mobile-cart-items" data-mobile-cart-items></div>
    <footer class="mobile-cart-footer">
      <div class="mobile-cart-total"><span>ยอดสุทธิ</span><strong data-mobile-cart-drawer-total>0.00 บาท</strong></div>
      <button type="button" class="mobile-cart-checkout" data-mobile-cart-checkout>รับชำระเงิน</button>
    </footer>`;
  drawer.querySelectorAll('[data-mobile-cart-close]').forEach(el => el.addEventListener('click', closeDrawer));
  drawer.querySelector('[data-mobile-cart-checkout]')?.addEventListener('click', () => {
    closeDrawer();
    document.querySelector('#payBtn')?.click();
  });
  drawer.addEventListener('touchstart', event => { touchStartY = event.touches?.[0]?.clientY || 0; }, { passive: true });
  drawer.addEventListener('touchend', event => {
    const endY = event.changedTouches?.[0]?.clientY || 0;
    if (endY - touchStartY > 80) closeDrawer();
  }, { passive: true });
  document.body.appendChild(drawer);
  return drawer;
}

function getCartRows() {
  return [...document.querySelectorAll('#cartList .cart-row')].map(row => {
    const name = row.querySelector('.cart-name')?.textContent?.trim() || '-';
    const meta = row.querySelector('.cart-meta')?.textContent?.trim() || '';
    const qty = row.querySelector('.qty-tools strong')?.textContent?.trim() || '1';
    const total = row.querySelector('.line-total')?.textContent?.trim() || '0.00';
    return { name, meta, qty, total };
  });
}

function updateMobileCartBar() {
  ensureMobileCartStyle();
  const bar = createBar();
  const drawer = createDrawer();
  const itemCount = document.querySelector('#itemCount')?.textContent || '0 รายการ';
  const totalText = document.querySelector('#grandTotal')?.textContent || '0.00';
  const total = readNumber(totalText);
  const rows = getCartRows();

  bar.querySelector('[data-mobile-cart-meta]').textContent = `${itemCount} • ${totalText} บาท`;
  bar.hidden = total <= 0;

  drawer.querySelector('[data-mobile-cart-drawer-meta]').textContent = itemCount;
  drawer.querySelector('[data-mobile-cart-drawer-total]').textContent = `${totalText} บาท`;
  drawer.querySelector('[data-mobile-cart-checkout]').disabled = total <= 0;
  drawer.querySelector('[data-mobile-cart-items]').innerHTML = rows.length
    ? rows.map(row => `<div class="mobile-cart-row"><div><strong>${row.name}</strong><span>${row.meta} • x${row.qty}</span></div><b>${row.total}</b></div>`).join('')
    : '<div class="mobile-cart-empty">ยังไม่มีสินค้าในบิล</div>';

  if (total <= 0) closeDrawer();
}

function openDrawer() {
  updateMobileCartBar();
  if (readNumber(document.querySelector('#grandTotal')?.textContent) <= 0) return;
  drawerOpen = true;
  document.body.classList.add('mobile-cart-drawer-open');
  document.querySelector('[data-mobile-cart-backdrop]')?.classList.add('open');
  document.querySelector('[data-mobile-cart-drawer]')?.classList.add('open');
}

function closeDrawer() {
  drawerOpen = false;
  document.body.classList.remove('mobile-cart-drawer-open');
  document.querySelector('[data-mobile-cart-backdrop]')?.classList.remove('open');
  document.querySelector('[data-mobile-cart-drawer]')?.classList.remove('open');
}

function startMobileCartBar() {
  ensureMobileCartStyle();
  updateMobileCartBar();
  const targets = ['#itemCount', '#grandTotal', '#cartList'].map(selector => document.querySelector(selector)).filter(Boolean);
  const observer = new MutationObserver(updateMobileCartBar);
  targets.forEach(target => observer.observe(target, { childList: true, subtree: true, characterData: true }));
  window.addEventListener('resize', updateMobileCartBar);
  window.addEventListener('storage', updateMobileCartBar);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && drawerOpen) closeDrawer(); });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startMobileCartBar, { once: true });
} else {
  startMobileCartBar();
}

export {};
