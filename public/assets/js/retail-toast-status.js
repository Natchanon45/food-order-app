import './app-version-badge.js?v=20260702-001';

const styleId='retailToastMainStyle';
if(!document.getElementById(styleId)){
  const style=document.createElement('style');
  style.id=styleId;
  style.textContent=`
.toast{box-sizing:border-box!important;position:fixed!important;left:50%!important;right:auto!important;top:auto!important;bottom:25vh!important;margin:0!important;z-index:2147483647!important;width:min(520px,calc(100% - 28px))!important;padding:10px!important;border:0!important;border-radius:14px!important;background:#111827!important;color:#fff!important;box-shadow:0 16px 42px rgba(0,0,0,.34)!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;font-size:15px!important;font-weight:400!important;line-height:1.35!important;text-align:left!important;opacity:0!important;pointer-events:none!important;transform:translate(-50%,12px)!important;transition:opacity .2s ease,transform .2s ease!important;white-space:normal!important;word-break:normal!important;overflow-wrap:break-word!important}
.toast.show{opacity:1!important;transform:translate(-50%,0)!important}
.toast::before{content:"\f26b"!important;flex:0 0 20px!important;width:20px!important;height:20px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-family:"bootstrap-icons"!important;font-size:20px!important;line-height:1!important;color:#22c55e!important}
.toast.error::before,.toast.is-error::before{content:"\f623"!important;color:#ef4444!important}
.toast>span,.toast .retail-toast-message{min-width:0!important;flex:1 1 auto!important;color:#fff!important;font-size:15px!important;font-weight:400!important;line-height:1.35!important;white-space:normal!important;word-break:normal!important;overflow-wrap:break-word!important}
.app-version-badge{box-sizing:border-box!important;position:fixed!important;right:14px!important;bottom:14px!important;z-index:9999!important;width:26px!important;height:26px!important;min-width:26px!important;min-height:26px!important;max-width:26px!important;max-height:26px!important;padding:0!important;margin:0!important;border:0!important;border-radius:999px!important;background:rgba(21,148,71,.82)!important;color:transparent!important;font-size:0!important;line-height:0!important;display:grid!important;place-items:center!important;box-shadow:0 8px 22px rgba(15,23,42,.18)!important;cursor:pointer!important;opacity:.68!important;overflow:hidden!important;text-indent:-9999px!important}
.app-version-badge::before{content:""!important;width:8px!important;height:8px!important;border-radius:999px!important;background:#fff!important;grid-area:1/1!important;display:block!important;box-shadow:0 0 0 4px rgba(255,255,255,.16)!important}
.app-version-badge:hover{opacity:1!important}
@media(max-width:640px){.toast{bottom:24vh!important;width:calc(100% - 20px)!important;font-size:14px!important}.toast::before{width:18px!important;height:18px!important;flex-basis:18px!important;font-size:18px!important}.toast>span,.toast .retail-toast-message{font-size:14px!important}.app-version-badge{right:14px!important;bottom:calc(92px + env(safe-area-inset-bottom,0px))!important;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;max-width:22px!important;max-height:22px!important}.app-version-badge::before{width:7px!important;height:7px!important;box-shadow:0 0 0 3px rgba(255,255,255,.16)!important}}
`;
  document.head.appendChild(style);
}

function setupToast(){
  document.querySelectorAll('.toast').forEach(toast=>{
    if(toast.dataset.toastFlexReady==='1')return;
    toast.dataset.toastFlexReady='1';
    try{toast.removeAttribute('popover')}catch{}
  });
}

document.addEventListener('DOMContentLoaded',setupToast);
setupToast();
export {};