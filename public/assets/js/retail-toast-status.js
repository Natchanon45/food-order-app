import './app-version-badge.js?v=20260629-021';

const styleId='retailToastMainStyle';
if(!document.getElementById(styleId)){
  const style=document.createElement('style');
  style.id=styleId;
  style.textContent=`
.toast{position:fixed!important;right:auto!important;bottom:auto!important;margin:0!important;z-index:2147483647!important;border:0!important;border-radius:14px!important;outline:0!important;font-weight:400!important}
.toast *{font-weight:400!important}
.toast::before{content:""!important;flex:0 0 auto;width:24px!important;height:24px!important;border:0!important;border-radius:0!important;background-repeat:no-repeat;background-position:center;background-size:24px 24px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2322c55e' stroke-width='2.35' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='m8.5 12.2 2.2 2.2 4.8-5'/%3E%3C/svg%3E")!important}
.toast.error,.toast.is-error{z-index:2147483647!important;border-radius:14px!important;font-weight:400!important}
.toast.error::before,.toast.is-error::before{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2.35' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='m9 9 6 6'/%3E%3Cpath d='m15 9-6 6'/%3E%3C/svg%3E")!important}
.toast:popover-open{display:flex!important;opacity:1!important;transform:translate(-50%,-50%)!important}
.pos-svg-status-icon{display:grid!important;place-items:center!important;width:58px!important;height:58px!important;margin:0 auto 18px!important;border-radius:999px!important;background:#e8f3ec!important;color:#159447!important;font-size:0!important;line-height:0!important;text-align:center!important}
.pos-svg-status-icon svg{width:34px!important;height:34px!important;display:block!important;fill:none!important;stroke:currentColor!important;stroke-width:2.6!important;stroke-linecap:round!important;stroke-linejoin:round!important}
.app-version-badge{box-sizing:border-box!important;position:fixed!important;right:14px!important;bottom:14px!important;z-index:9999!important;width:26px!important;height:26px!important;min-width:26px!important;min-height:26px!important;max-width:26px!important;max-height:26px!important;padding:0!important;margin:0!important;border:0!important;border-radius:999px!important;background:rgba(21,148,71,.82)!important;color:transparent!important;font-size:0!important;line-height:0!important;display:grid!important;place-items:center!important;box-shadow:0 8px 22px rgba(15,23,42,.18)!important;backdrop-filter:blur(10px);cursor:pointer!important;opacity:.68!important;overflow:hidden!important;text-indent:-9999px!important}
.app-version-badge::before{content:""!important;width:8px!important;height:8px!important;border-radius:999px!important;background:#fff!important;grid-area:1/1!important;display:block!important;margin:0!important;padding:0!important;box-shadow:0 0 0 4px rgba(255,255,255,.16)!important}
.app-version-badge:hover{opacity:1!important}
@media(max-width:640px){.app-version-badge{right:14px!important;bottom:calc(92px + env(safe-area-inset-bottom,0px))!important;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;max-width:22px!important;max-height:22px!important;padding:0!important}.app-version-badge::before{width:7px!important;height:7px!important;box-shadow:0 0 0 3px rgba(255,255,255,.16)!important}}
`;
  document.head.appendChild(style);
}

function cleanToastText(toast){
  const text=toast.textContent||'';
  const cleaned=text.replace(/^[\s✅✔✓☑️]+/u,'').trimStart();
  if(cleaned!==text)toast.textContent=cleaned;
}

function setupToastTopLayer(){
  document.querySelectorAll('.toast').forEach(toast=>{
    if(toast.dataset.topLayerReady==='1')return;
    toast.dataset.topLayerReady='1';
    try{toast.setAttribute('popover','manual')}catch{}
    const sync=()=>{
      try{
        cleanToastText(toast);
        if(toast.classList.contains('show')){
          if(toast.matches(':popover-open'))toast.hidePopover();
          toast.showPopover();
        }else if(toast.matches(':popover-open')){
          toast.hidePopover();
        }
      }catch{}
    };
    new MutationObserver(sync).observe(toast,{attributes:true,childList:true,subtree:true,characterData:true,attributeFilter:['class']});
    sync();
  });
}

function replaceLooseStatusIcons(root=document){
  const symbols=new Set(['✓','✔','✅']);
  root.querySelectorAll('dialog *,.modal *,.payment-success *,.success-modal *').forEach(el=>{
    const text=(el.textContent||'').trim();
    if(!symbols.has(text))return;
    if(el.dataset.svgStatusIcon==='1'){
      el.classList.add('pos-svg-status-icon');
      return;
    }
    if(el.children.length>0&&el.querySelector('svg'))return;
    el.dataset.svgStatusIcon='1';
    el.classList.add('pos-svg-status-icon');
    el.setAttribute('aria-label','สำเร็จ');
    el.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m8.5 12.2 2.2 2.2 4.8-5"></path></svg>';
  });
}

const iconObserver=new MutationObserver(mutations=>{
  for(const mutation of mutations){
    mutation.addedNodes.forEach(node=>{
      if(node.nodeType===1)replaceLooseStatusIcons(node);
    });
  }
  replaceLooseStatusIcons(document);
});

document.addEventListener('DOMContentLoaded',()=>{
  setupToastTopLayer();
  replaceLooseStatusIcons(document);
  iconObserver.observe(document.body,{childList:true,subtree:true});
});
setupToastTopLayer();
replaceLooseStatusIcons(document);
if(document.body)iconObserver.observe(document.body,{childList:true,subtree:true});
export {};
