import './app-version-badge.js?v=20260710-004';

const styleId = 'retailToastMainStyle';
if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
.toast{box-sizing:border-box!important;position:fixed!important;left:50%!important;right:auto!important;top:auto!important;bottom:25vh!important;margin:0!important;z-index:2147483647!important;width:min(520px,calc(100% - 28px))!important;padding:20px!important;border:0!important;border-radius:14px!important;background:#111827!important;color:#fff!important;box-shadow:0 16px 42px rgba(0,0,0,.34)!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;font-size:15px!important;font-weight:400!important;line-height:1.35!important;text-align:left!important;opacity:0!important;pointer-events:none!important;transform:translate(-50%,12px)!important;transition:opacity .2s ease,transform .2s ease!important;white-space:normal!important;word-break:normal!important;overflow-wrap:break-word!important}
.toast.show{opacity:1!important;transform:translate(-50%,0)!important}
.toast::before,.toast::after{content:none!important;display:none!important}
.toast .retail-toast-icon{width:18px!important;height:18px!important;flex:0 0 18px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;margin:0!important;font-size:18px!important;line-height:1!important;color:#22c55e!important}
.toast.error .retail-toast-icon,.toast.is-error .retail-toast-icon{color:#ef4444!important}
.toast .retail-toast-message{min-width:0!important;flex:1 1 auto!important;display:block!important;color:#fff!important;font-size:15px!important;font-weight:400!important;line-height:1.35!important;white-space:normal!important;word-break:normal!important;overflow-wrap:break-word!important}
.toast:popover-open{display:flex!important;opacity:1!important;transform:translate(-50%,0)!important;inset:auto auto 25vh 50%!important;position:fixed!important;margin:0!important}
.app-version-badge{box-sizing:border-box!important;position:fixed!important;right:14px!important;bottom:14px!important;z-index:9999!important;width:26px!important;height:26px!important;min-width:26px!important;min-height:26px!important;max-width:26px!important;max-height:26px!important;padding:0!important;margin:0!important;border:0!important;border-radius:999px!important;background:rgba(21,148,71,.82)!important;color:transparent!important;font-size:0!important;line-height:0!important;display:grid!important;place-items:center!important;box-shadow:0 8px 22px rgba(15,23,42,.18)!important;cursor:pointer!important;opacity:.68!important;overflow:hidden!important;text-indent:-9999px!important}
.app-version-badge::before{content:""!important;width:8px!important;height:8px!important;border-radius:999px!important;background:#fff!important;grid-area:1/1!important;display:block!important;box-shadow:0 0 0 4px rgba(255,255,255,.16)!important}
.app-version-badge:hover{opacity:1!important}
@media(max-width:640px){.toast{bottom:24vh!important;width:calc(100% - 20px)!important;padding:20px!important;font-size:14px!important}.toast .retail-toast-icon{width:18px!important;height:18px!important;flex-basis:18px!important;font-size:18px!important}.toast .retail-toast-message{font-size:14px!important}.toast:popover-open{inset:auto auto 24vh 50%!important}.app-version-badge{right:14px!important;bottom:calc(92px + env(safe-area-inset-bottom,0px))!important;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;max-width:22px!important;max-height:22px!important}.app-version-badge::before{width:7px!important;height:7px!important;box-shadow:0 0 0 3px rgba(255,255,255,.16)!important}}
`;
  document.head.appendChild(style);
}

function ensureToastElement() {
  let toast = document.querySelector('#toast.toast') || document.querySelector('.toast');
  if (toast) return toast;
  toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  document.body.appendChild(toast);
  return toast;
}

function getToastText(toast) {
  const message = toast.querySelector('.retail-toast-message');
  if (message) return message.textContent.trim();
  return (toast.textContent || '').replace(/\s+/g, ' ').trim();
}

function renderToastContent(toast) {
  const text = getToastText(toast);
  if (!text) return;
  const isError = toast.classList.contains('error') || toast.classList.contains('is-error');
  const iconClass = isError ? 'bi-x-circle' : 'bi-check-circle';
  const currentIcon = toast.querySelector('.retail-toast-icon');
  const currentMessage = toast.querySelector('.retail-toast-message');
  if (currentIcon && currentIcon.classList.contains(iconClass) && currentMessage && currentMessage.textContent === text && toast.children.length === 2) return;
  toast.replaceChildren();
  const icon = document.createElement('i');
  icon.className = `bi ${iconClass} retail-toast-icon`;
  icon.setAttribute('aria-hidden', 'true');
  const message = document.createElement('span');
  message.className = 'retail-toast-message';
  message.textContent = text;
  toast.append(icon, message);
}

function setupToast() {
  ensureToastElement();
  document.querySelectorAll('.toast').forEach(toast => {
    if (toast.dataset.toastBootstrapReady === '1') return;
    toast.dataset.toastBootstrapReady = '1';
    try { toast.setAttribute('popover', 'manual'); } catch {}
    const sync = () => {
      try {
        renderToastContent(toast);
        if (toast.classList.contains('show')) {
          if (!toast.matches(':popover-open')) toast.showPopover();
        } else if (toast.matches(':popover-open')) {
          toast.hidePopover();
        }
      } catch {}
    };
    new MutationObserver(sync).observe(toast, { attributes: true, childList: true, subtree: true, characterData: true, attributeFilter: ['class'] });
    sync();
  });
}

document.addEventListener('DOMContentLoaded', setupToast);
setupToast();
export {};
