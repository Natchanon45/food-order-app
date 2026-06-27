const TOAST_ICON={success:'<svg class="toast-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m8.5 12.2 2.2 2.2 4.8-5"></path></svg>',error:'<svg class="toast-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m9 9 6 6"></path><path d="m15 9-6 6"></path></svg>'};
function cleanToastText(text){return String(text||'').replace(/[✅❌✔✘✕✖✓×]/g,'').trim()}
function isErrorText(text){return /ไม่พบ|เกิน|ไม่ครบ|ผิด|ล้มเหลว|ไม่สำเร็จ|กรุณา|error|failed/i.test(text)}
function renderToast(el,text){
  text=cleanToastText(text);
  if(!text){el.dataset.toastRendered='';el.dataset.toastText='';el.innerHTML='';el.classList.remove('error','is-error');return}
  if(el.dataset.toastRendered==='1'&&el.dataset.toastText===text)return;
  const bad=isErrorText(text),type=bad?'error':'success';
  el.dataset.toastRendered='1';
  el.dataset.toastText=text;
  el.classList.toggle('error',bad);
  el.classList.toggle('is-error',bad);
  el.innerHTML='<span class="toast-icon toast-icon-'+type+'">'+TOAST_ICON[type]+'</span><span class="toast-message"></span>';
  const msg=el.querySelector('.toast-message');
  if(msg)msg.textContent=text;
}
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.toast').forEach(el=>{
    let locked=false;
    const observer=new MutationObserver(()=>{
      if(locked)return;
      const already=el.dataset.toastRendered==='1';
      const text=already?el.dataset.toastText:el.textContent;
      if(already)return;
      locked=true;
      renderToast(el,text);
      requestAnimationFrame(()=>{locked=false});
    });
    observer.observe(el,{childList:true,characterData:true,subtree:true});
  });
});
