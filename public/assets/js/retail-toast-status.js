function applyToastStatus(el){
  if(!el) return;
  const text=(el.textContent||"").trim();
  const isBad=/ไม่พบ|เกิน|ไม่ครบ|ผิด|ล้มเหลว|ไม่สำเร็จ|กรุณา|error|failed/i.test(text);
  el.classList.toggle("error",isBad);
}

document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".toast").forEach(el=>{
    applyToastStatus(el);
    new MutationObserver(()=>applyToastStatus(el)).observe(el,{childList:true,subtree:true,characterData:true});
  });
});
