const SALES_KEY="retail_pos_sales_v1";
const RETURN_KEY="retail_pos_returns_v1";
const PRODUCT_KEY="retail_pos_products_v1";
const MOVEMENT_KEY="retail_pos_stock_movements_v1";
const CUSTOMER_KEY="retail_pos_customers_v1";
const LOYALTY_SETTINGS_KEY="retail_pos_loyalty_settings_v1";
const LOYALTY_LEDGER_KEY="retail_pos_loyalty_ledger_v1";

const $=selector=>document.querySelector(selector);
const els={
  search:$("#returnSaleSearch"),searchBtn:$("#returnSearchBtn"),results:$("#returnSaleResults"),resultsEmpty:$("#returnSaleEmpty"),
  editor:$("#returnEditorPanel"),saleId:$("#returnSaleId"),saleMeta:$("#returnSaleMeta"),clearSale:$("#clearSelectedSale"),
  items:$("#returnItemsBody"),date:$("#returnDate"),method:$("#refundMethod"),reason:$("#returnReason"),note:$("#returnNote"),
  total:$("#returnTotal"),error:$("#returnError"),confirm:$("#confirmReturnBtn"),historySearch:$("#returnHistorySearch"),
  history:$("#returnHistory"),historyEmpty:$("#returnHistoryEmpty"),toast:$("#toast")
};

let sales=read(SALES_KEY,[]),returns=read(RETURN_KEY,[]),products=read(PRODUCT_KEY,[]),selectedSale=null,toastTimer;

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function money(value){return Number(value||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2})}
function esc(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char])}
function today(){const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
function uid(prefix){return globalThis.crypto?.randomUUID?`${prefix}-${crypto.randomUUID()}`:`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`}
function toast(message){clearTimeout(toastTimer);els.toast.textContent=message;els.toast.classList.add("show");toastTimer=setTimeout(()=>els.toast.classList.remove("show"),1800)}
function loyaltySettings(){return{enabled:true,spendPerPoint:10,pointValue:1,...read(LOYALTY_SETTINGS_KEY,{})}}
function saleReturns(saleId){return returns.filter(record=>record.saleId===saleId)}
function returnedQty(saleId,item){return saleReturns(saleId).flatMap(record=>record.items||[]).filter(row=>String(row.productId)===String(item.id)).reduce((sum,row)=>sum+Number(row.qty||0),0)}
function remainingQty(sale,item){return Math.max(0,Number(item.qty||0)-returnedQty(sale.id,item))}

function ensureLoyaltyPreview(){
  if($("#returnLoyaltyPreview"))return;
  const summary=els.editor?.querySelector(".return-summary");
  summary?.insertAdjacentHTML("afterend",`<div id="returnLoyaltyPreview" class="return-loyalty-preview" hidden><strong>ปรับแต้มสมาชิก</strong><span id="returnLoyaltyText"></span></div>`);
}

function previousPointAdjustment(saleId,field){
  return saleReturns(saleId).reduce((sum,record)=>sum+Number(record.loyaltyAdjustment?.[field]||0),0);
}

function calculateLoyaltyAdjustment(sale,refundTotal){
  if(!sale?.customerId||!sale?.loyalty||refundTotal<=0)return null;
  const settings=loyaltySettings();
  const originalEarned=Math.max(0,Math.floor(Number(sale.loyalty.pointsEarned||0)));
  const originalUsed=Math.max(0,Math.floor(Number(sale.loyalty.pointsUsed||0)));
  const saleTotal=Math.max(0,Number(sale.total||0));
  const previousRefund=saleReturns(sale.id).reduce((sum,record)=>sum+Number(record.refundTotal||0),0);
  const cumulativeRefund=Math.min(saleTotal,previousRefund+refundTotal);
  const remainingNet=Math.max(0,saleTotal-cumulativeRefund);

  const targetEarnedReversal=Math.min(originalEarned,Math.max(0,originalEarned-Math.floor(remainingNet/Math.max(.01,Number(settings.spendPerPoint||10)))));
  const previousEarnedDeducted=previousPointAdjustment(sale.id,"pointsEarnedDeducted");
  const pointsEarnedToDeduct=Math.max(0,targetEarnedReversal-previousEarnedDeducted);

  const targetUsedRestore=saleTotal<=0?0:(cumulativeRefund>=saleTotal?originalUsed:Math.floor(originalUsed*cumulativeRefund/saleTotal));
  const previousUsedRestored=previousPointAdjustment(sale.id,"pointsUsedRestored");
  const pointsUsedToRestore=Math.max(0,targetUsedRestore-previousUsedRestored);

  return{
    customerId:sale.customerId,
    customerCode:sale.customerCode||"",
    customerName:sale.customerName||"",
    pointsEarnedToDeduct,
    pointsUsedToRestore,
    targetEarnedReversal,
    targetUsedRestore,
    cumulativeRefund,
    remainingNet
  };
}

function updateLoyaltyPreview(refundTotal){
  ensureLoyaltyPreview();
  const preview=$("#returnLoyaltyPreview"),text=$("#returnLoyaltyText");
  const adjustment=calculateLoyaltyAdjustment(selectedSale,refundTotal);
  if(!preview||!text||!adjustment||(adjustment.pointsEarnedToDeduct<=0&&adjustment.pointsUsedToRestore<=0)){
    if(preview)preview.hidden=true;
    return;
  }
  const parts=[];
  if(adjustment.pointsEarnedToDeduct>0)parts.push(`หักแต้มที่เคยได้รับ ${adjustment.pointsEarnedToDeduct.toLocaleString("th-TH")} แต้ม`);
  if(adjustment.pointsUsedToRestore>0)parts.push(`คืนแต้มที่เคยใช้ ${adjustment.pointsUsedToRestore.toLocaleString("th-TH")} แต้ม`);
  text.textContent=parts.join(" • ");
  preview.hidden=false;
}

function applyLoyaltyAdjustment(sale,returnId,refundTotal,createdAt){
  const planned=calculateLoyaltyAdjustment(sale,refundTotal);
  if(!planned)return null;
  const customers=read(CUSTOMER_KEY,[]);
  const customerIndex=customers.findIndex(customer=>customer.id===planned.customerId);
  if(customerIndex<0)return null;

  const customer=customers[customerIndex];
  const pointsBefore=Math.max(0,Math.floor(Number(customer.points||0)));
  const pointsUsedRestored=Math.max(0,planned.pointsUsedToRestore);
  const availableAfterRestore=pointsBefore+pointsUsedRestored;
  const pointsEarnedDeducted=Math.min(availableAfterRestore,Math.max(0,planned.pointsEarnedToDeduct));
  const deductionShortfall=Math.max(0,planned.pointsEarnedToDeduct-pointsEarnedDeducted);
  const pointsAfter=Math.max(0,availableAfterRestore-pointsEarnedDeducted);

  customers[customerIndex]={...customer,points:pointsAfter,updatedAt:createdAt};
  const ledger=read(LOYALTY_LEDGER_KEY,[]);
  ledger.unshift({
    id:uid("point-return"),type:"return",returnId,saleId:sale.id,customerId:customer.id,
    customerCode:customer.customerCode||sale.customerCode||"",customerName:customer.name||sale.customerName||"",
    createdAt,pointsEarned:0,pointsUsed:0,pointsEarnedDeducted,pointsUsedRestored,
    deductionShortfall,balanceBefore:pointsBefore,balanceAfter:pointsAfter,refundTotal
  });

  write(CUSTOMER_KEY,customers);
  write(LOYALTY_LEDGER_KEY,ledger.slice(0,2000));

  return{
    customerId:customer.id,customerCode:customer.customerCode||sale.customerCode||"",customerName:customer.name||sale.customerName||"",
    pointsBefore,pointsEarnedDeducted,pointsUsedRestored,deductionShortfall,pointsAfter
  };
}

function searchSales(){
  sales=read(SALES_KEY,[]);
  returns=read(RETURN_KEY,[]);
  const query=els.search.value.trim().toLowerCase();
  const rows=sales.filter(sale=>{
    const itemText=(sale.items||[]).map(item=>`${item.name||""} ${item.id||""} ${item.barcode||""}`).join(" ").toLowerCase();
    return(!query||String(sale.id||"").toLowerCase().includes(query)||itemText.includes(query))&&(sale.items||[]).some(item=>remainingQty(sale,item)>0);
  }).slice(0,30);
  els.resultsEmpty.hidden=rows.length>0;
  els.resultsEmpty.textContent=query?"ไม่พบบิลที่ยังมีสินค้าคืนได้":"ค้นหาบิลที่ต้องการคืนสินค้า";
  els.results.innerHTML=rows.map(sale=>{
    const available=(sale.items||[]).reduce((sum,item)=>sum+remainingQty(sale,item),0);
    return`<article class="return-sale-card"><div><strong>${esc(sale.id)}</strong><span>${new Date(sale.createdAt).toLocaleString("th-TH")} • คืนได้ ${available.toLocaleString("th-TH")} ชิ้น</span></div><div class="return-sale-total"><strong>${money(sale.total)} บาท</strong><span>${(sale.items||[]).length} รายการ</span></div><button type="button" data-sale-id="${esc(sale.id)}">เลือกบิล</button></article>`;
  }).join("");
}

function openSale(id){
  selectedSale=sales.find(sale=>sale.id===id)||null;
  if(!selectedSale)return;
  els.saleId.textContent=selectedSale.id;
  const member=selectedSale.customerName?` • สมาชิก ${selectedSale.customerCode||""} ${selectedSale.customerName}`:"";
  els.saleMeta.textContent=`${new Date(selectedSale.createdAt).toLocaleString("th-TH")} • ${selectedSale.payment?.method==="cash"?"เงินสด":"PromptPay / โอนเงิน"}${member}`;
  els.date.value=today();els.reason.value="";els.note.value="";els.error.textContent="";
  els.items.innerHTML=(selectedSale.items||[]).map(item=>{
    const returned=returnedQty(selectedSale.id,item),remaining=remainingQty(selectedSale,item);
    return`<tr data-product-id="${esc(item.id)}"><td class="return-product"><strong>${esc(item.name)}</strong><span>${esc(item.id)} • ${esc(item.barcode||"")}</span></td><td class="number">${Number(item.qty||0).toLocaleString("th-TH")}</td><td class="number">${returned.toLocaleString("th-TH")}</td><td class="number"><input class="return-qty" type="number" min="0" max="${remaining}" step="0.001" value="0" ${remaining<=0?"disabled":""}></td><td class="number">${money(item.price)}</td><td class="number return-line-total">0.00</td></tr>`;
  }).join("");
  els.editor.hidden=false;updateTotal();els.editor.scrollIntoView({behavior:"smooth",block:"start"});
}

function updateTotal(){
  if(!selectedSale)return;
  let total=0;
  [...els.items.querySelectorAll("tr")].forEach(row=>{
    const item=selectedSale.items.find(entry=>String(entry.id)===row.dataset.productId);
    const input=row.querySelector(".return-qty");
    const qty=Math.max(0,Math.min(Number(input.value||0),Number(input.max||0)));
    const line=qty*Number(item?.price||0);
    row.querySelector(".return-line-total").textContent=money(line);total+=line;
  });
  els.total.textContent=`${money(total)} บาท`;
  updateLoyaltyPreview(total);
}

function clearSelected(){selectedSale=null;els.editor.hidden=true;els.items.innerHTML="";els.total.textContent="0.00 บาท";const preview=$("#returnLoyaltyPreview");if(preview)preview.hidden=true}

function collectItems(){
  if(!selectedSale)return[];
  return[...els.items.querySelectorAll("tr")].map(row=>{
    const item=selectedSale.items.find(entry=>String(entry.id)===row.dataset.productId),input=row.querySelector(".return-qty"),qty=Number(input.value||0),max=Number(input.max||0);
    return{productId:item.id,barcode:item.barcode||"",productName:item.name,qty,unit:item.unit||"",price:Number(item.price||0),cost:item.cost??null,max,lineTotal:qty*Number(item.price||0)};
  }).filter(item=>item.qty>0);
}

function confirmReturn(){
  els.error.textContent="";
  if(!selectedSale){els.error.textContent="กรุณาเลือกบิล";return}
  const items=collectItems();
  if(!items.length){els.error.textContent="กรุณาระบุจำนวนสินค้าที่ต้องการคืน";return}
  if(items.some(item=>item.qty>item.max)){els.error.textContent="จำนวนคืนมากกว่าจำนวนที่คืนได้";return}
  if(!els.date.value||!els.reason.value.trim()){els.error.textContent="กรุณากรอกวันที่และเหตุผลการคืน";return}

  const refundTotal=items.reduce((sum,item)=>sum+item.lineTotal,0);
  const planned=calculateLoyaltyAdjustment(selectedSale,refundTotal);
  const pointMessage=planned&&(planned.pointsEarnedToDeduct>0||planned.pointsUsedToRestore>0)
    ?`\nปรับแต้ม: ${planned.pointsEarnedToDeduct>0?`หัก ${planned.pointsEarnedToDeduct} แต้ม`:""}${planned.pointsEarnedToDeduct>0&&planned.pointsUsedToRestore>0?" / ":""}${planned.pointsUsedToRestore>0?`คืน ${planned.pointsUsedToRestore} แต้ม`:""}`:"";
  if(!confirm(`ยืนยันคืนสินค้า ${items.reduce((sum,item)=>sum+item.qty,0).toLocaleString("th-TH")} ชิ้น และคืนเงิน ${money(refundTotal)} บาทหรือไม่?${pointMessage}`))return;

  const id=`RETURN-${Date.now()}`,createdAt=new Date().toISOString(),movements=read(MOVEMENT_KEY,[]);
  items.forEach(item=>{
    let product=products.find(entry=>String(entry.id)===String(item.productId));
    if(!product){product={id:item.productId,barcode:item.barcode,name:item.productName,price:item.price,cost:item.cost,stock:0,unit:item.unit||"ชิ้น",minStock:0,showOnPos:true};products.push(product)}
    const before=Number(product.stock||0),after=before+item.qty;product.stock=after;
    movements.unshift({id:uid("movement"),productId:product.id,productName:product.name,before,after,note:`คืนสินค้า ${id} จาก ${selectedSale.id}`,createdAt});
  });

  const loyaltyAdjustment=applyLoyaltyAdjustment(selectedSale,id,refundTotal,createdAt);
  const record={id,saleId:selectedSale.id,returnDate:els.date.value,createdAt,refundMethod:els.method.value,reason:els.reason.value.trim(),note:els.note.value.trim(),refundTotal,items,loyaltyAdjustment};
  returns.unshift(record);

  const saleIndex=sales.findIndex(sale=>sale.id===selectedSale.id);
  if(saleIndex>=0){
    const saleReturnList=Array.isArray(sales[saleIndex].returns)?sales[saleIndex].returns:[];
    const currentLoyalty=sales[saleIndex].loyalty||null;
    const updatedLoyalty=currentLoyalty&&loyaltyAdjustment?{
      ...currentLoyalty,
      pointsEarnedReversed:Number(currentLoyalty.pointsEarnedReversed||0)+Number(loyaltyAdjustment.pointsEarnedDeducted||0),
      pointsUsedRestored:Number(currentLoyalty.pointsUsedRestored||0)+Number(loyaltyAdjustment.pointsUsedRestored||0),
      pointsAfterReturns:loyaltyAdjustment.pointsAfter
    }:currentLoyalty;
    sales[saleIndex]={...sales[saleIndex],loyalty:updatedLoyalty,returns:[...saleReturnList,{id,refundTotal,createdAt,loyaltyAdjustment}],refundTotal:Number(sales[saleIndex].refundTotal||0)+refundTotal};
  }

  write(RETURN_KEY,returns.slice(0,500));write(SALES_KEY,sales);write(PRODUCT_KEY,products);write(MOVEMENT_KEY,movements.slice(0,500));
  renderHistory();searchSales();clearSelected();
  const pointResult=loyaltyAdjustment?` • แต้มคงเหลือ ${loyaltyAdjustment.pointsAfter}`:"";
  toast(`บันทึกการคืนสินค้า ${id} แล้ว${pointResult}`);
}

function renderHistory(){
  returns=read(RETURN_KEY,[]);
  const query=els.historySearch.value.trim().toLowerCase();
  const rows=returns.filter(record=>!query||[record.id,record.saleId,record.reason,record.note,(record.items||[]).map(item=>`${item.productName} ${item.productId}`).join(" ")].some(value=>String(value||"").toLowerCase().includes(query)));
  els.historyEmpty.hidden=rows.length>0;
  els.history.innerHTML=rows.map(record=>{
    const adjustment=record.loyaltyAdjustment;
    const loyaltyText=adjustment?`<div class="return-history-loyalty">${adjustment.pointsEarnedDeducted>0?`หักแต้ม ${adjustment.pointsEarnedDeducted}`:""}${adjustment.pointsEarnedDeducted>0&&adjustment.pointsUsedRestored>0?" • ":""}${adjustment.pointsUsedRestored>0?`คืนแต้ม ${adjustment.pointsUsedRestored}`:""} • คงเหลือ ${adjustment.pointsAfter}</div>`:"";
    return`<article class="return-history-item"><div class="return-history-head"><div><strong>${esc(record.id)}</strong><span>อ้างอิง ${esc(record.saleId)} • ${new Date(`${record.returnDate}T00:00:00`).toLocaleDateString("th-TH")}</span></div><div class="return-history-total"><strong>${money(record.refundTotal)} บาท</strong><span>${esc(record.refundMethod||"")}</span></div></div><div class="return-history-meta">${esc(record.reason)}${record.note?` • ${esc(record.note)}`:""}</div>${loyaltyText}<div class="return-history-lines">${(record.items||[]).map(item=>`<div class="return-history-line"><span>${esc(item.productName)} × ${Number(item.qty).toLocaleString("th-TH")}</span><strong>${money(item.lineTotal)}</strong></div>`).join("")}</div></article>`;
  }).join("");
}

ensureLoyaltyPreview();
els.searchBtn.addEventListener("click",searchSales);
els.search.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();searchSales()}});
els.results.addEventListener("click",event=>{const button=event.target.closest("[data-sale-id]");if(button)openSale(button.dataset.saleId)});
els.items.addEventListener("input",event=>{if(event.target.closest(".return-qty"))updateTotal()});
els.clearSale.addEventListener("click",clearSelected);
els.confirm.addEventListener("click",confirmReturn);
els.historySearch.addEventListener("input",renderHistory);
window.addEventListener("storage",()=>{sales=read(SALES_KEY,[]);returns=read(RETURN_KEY,[]);products=read(PRODUCT_KEY,[]);searchSales();renderHistory()});
renderHistory();