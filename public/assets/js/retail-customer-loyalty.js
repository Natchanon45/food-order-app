const CUSTOMER_KEY="retail_pos_customers_v1",LEDGER_KEY="retail_pos_loyalty_ledger_v1";
const grid=document.querySelector("#customerGrid");
function read(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c])}
if(grid){
  const dialog=document.createElement("dialog");
  dialog.innerHTML=`<div class="loyalty-history-dialog"><div class="dialog-head"><h2 id="loyaltyHistoryTitle">ประวัติแต้ม</h2><button id="closeLoyaltyHistory" class="icon-btn" type="button">×</button></div><div id="loyaltyHistoryList" class="loyalty-history-list"></div></div>`;
  document.body.appendChild(dialog);

  function decorate(){
    const customers=read(CUSTOMER_KEY,[]);
    [...grid.querySelectorAll(".customer-card")].forEach(card=>{
      const code=card.querySelector(".customer-card-head>div>span")?.textContent.replace("สมาชิก","").trim();
      const customer=customers.find(c=>(c.customerCode||c.id)===code);
      if(!customer)return;
      let badge=card.querySelector(".customer-points-badge");
      if(!badge){
        badge=document.createElement("button");
        badge.type="button";
        badge.className="customer-points-badge";
        badge.dataset.loyaltyCustomerId=customer.id;
        card.querySelector(".customer-card-head>div")?.appendChild(badge);
      }
      const nextText=`${Math.floor(Number(customer.points||0)).toLocaleString("th-TH")} แต้ม`;
      if(badge.textContent!==nextText)badge.textContent=nextText;
    });
  }

  function ledgerValues(row){
    if(row.type==="return"){
      const restored=Number(row.pointsUsedRestored||0);
      const deducted=Number(row.pointsEarnedDeducted||0);
      return{
        title:`คืนสินค้า ${row.returnId||""}`.trim(),
        detail:`อ้างอิง ${row.saleId||"-"}`,
        positive:restored,
        negative:deducted
      };
    }
    return{
      title:row.saleId||"ปรับแต้ม",
      detail:"รายการขาย",
      positive:Number(row.pointsEarned||0),
      negative:Number(row.pointsUsed||0)
    };
  }

  function openHistory(id){
    const customer=read(CUSTOMER_KEY,[]).find(c=>c.id===id);
    if(!customer)return;
    document.querySelector("#loyaltyHistoryTitle").textContent=`ประวัติแต้ม: ${customer.customerCode} • ${customer.name}`;
    const rows=read(LEDGER_KEY,[]).filter(row=>row.customerId===id);
    document.querySelector("#loyaltyHistoryList").innerHTML=rows.map(row=>{
      const values=ledgerValues(row);
      return`<article class="loyalty-history-item"><div><strong>${esc(values.title)}</strong><span>${esc(values.detail)} • ${new Date(row.createdAt).toLocaleString("th-TH")}</span></div><div><strong class="${values.positive>0?"loyalty-positive":""}">+${values.positive.toLocaleString("th-TH")}</strong><strong class="${values.negative>0?"loyalty-negative":""}">-${values.negative.toLocaleString("th-TH")}</strong><span>คงเหลือ ${Number(row.balanceAfter||0).toLocaleString("th-TH")}</span></div></article>`;
    }).join("")||'<div class="empty-state">ยังไม่มีประวัติแต้ม</div>';
    dialog.showModal();
  }

  grid.addEventListener("click",event=>{
    const button=event.target.closest("[data-loyalty-customer-id]");
    if(button)openHistory(button.dataset.loyaltyCustomerId);
  });
  document.querySelector("#closeLoyaltyHistory")?.addEventListener("click",()=>dialog.close());
  new MutationObserver(()=>requestAnimationFrame(decorate)).observe(grid,{childList:true});
  window.addEventListener("storage",decorate);
  window.addEventListener("pos:loyalty-updated",decorate);
  decorate();
}