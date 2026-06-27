const TOAST_ICON = {
  success: '<svg class="toast-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m8.5 12.2 2.2 2.2 4.8-5"></path></svg>',
  error: '<svg class="toast-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m9 9 6 6"></path><path d="m15 9-6 6"></path></svg>'
};

function cleanToastText(text){
  return String(text||"").replace(/[✅❌✔✘✕✖✓×]/g,"").trim();
}

function applyToastStatus(el){
  if(!el) return;
  const raw=el.dataset.toastText||el.textContent||"";
  const text=cleanToastText(raw);
  const isBad=/ไม่พบ|เกิน|ไม่ครบ|ผิด|ล้มเหลว|ไม่สำเร็จ|กรุณา|error|failed/i.test(text);
  const type=isBad?"error":"success";
  el.dataset.toastText=text;
  el.classList.toggle("error",isBad);
  el.classList.toggle("is-error",isBad);
  el.innerHTML=`<span class="toast-icon toast-icon-${type}">${TOAST_ICON[type]}</span><span class="toast-message">${text}</span>`;
}

document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".toast").forEach(el=>{
    let busy=false;
    const observer=new MutationObserver(()=>{
      if(busy) return;
      busy=true;
      applyToastStatus(el);
      busy=false;
    });
    observer.observe(el,{childList:true,subtree:true,characterData:true});
    applyToastStatus(el);
  });
});
