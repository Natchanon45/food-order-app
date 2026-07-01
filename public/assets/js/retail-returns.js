import { auth, db, isFirebaseConfigured, collection, doc, runTransaction, serverTimestamp } from './firebase-config.js?v=20260630-073';
import { getTenantId, watchRecords, RetailCollections } from './retail-db.js?v=20260629-031';
import { getDeviceId, POS_FIRESTORE_VERSION, dateKeyFrom, monthKeyFrom } from './retail-pos-firestore-foundation.js?v=20260630-077';

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
  total:$("#returnTotal"),error:$("#returnError"),confirm:$("#confirmReturnBtn"),voidBtn:$("#voidSaleBtn"),historySearch:$("#returnHistorySearch"),
  history:$("#returnHistory"),historyEmpty:$("#returnHistoryEmpty"),toast:$("#toast")
};

let sales=read(SALES_KEY,[]),returns=read(RETURN_KEY,[]),products=read(PRODUCT_KEY,[]),selectedSale=null,toastTimer,savingReturn=false;

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function money(value){return Number(value||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2})}
function esc(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char])}
function today(){const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
function uid(prefix){return globalThis.crypto?.randomUUID?`${prefix}-${crypto.randomUUID()}`:`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`}
function tenantCollection(name){return collection(db,"tenants",getTenantId(),name)}
function tenantDoc(name,id){return doc(db,"tenants",getTenantId(),name,String(id))}
function toast(message){clearTimeout(toastTimer);els.toast.textContent=message;els.toast.classList.add("show");toastTimer=setTimeout(()=>els.toast.classList.remove("show"),1800)}
function saleNumberOf(sale){return String(sale?.saleNumber||sale?.number||sale?.id||"")}
function movementId(returnId,productId){return `${returnId}_${productId}`.replace(/[^a-zA-Z0-9_-]/g,"_")}
function auditId(action,id){return `${action}_${id}`.replace(/[^a-zA-Z0-9_-]/g,"_")}
function returnTypeFor(items,sale){const sold=(sale.items||[]).reduce((sum,item)=>sum+Number(item.qty||0),0);const returnedBefore=saleReturns(sale.id).flatMap(row=>row.items||[]).reduce((sum,item)=>sum+Number(item.qty||0),0);const returning=items.reduce((sum,item)=>sum+Number(item.qty||0),0);return returnedBefore+returning>=sold?"void":"return"}
function loyaltySettings(){return{enabled:true,spendPerPoint:10,pointValue:1,...read(LOYALTY_SETTINGS_KEY,{})}}
function saleReturns(saleId){return returns.filter(record=>record.saleId===saleId)}
function returnedQty(saleId,item){return saleReturns(saleId).flatMap(record=>record.items||[]).filter(row=>String(row.productId)===String(item.id)).reduce((sum,row)=>sum+Number(row.qty||0),0)}
function remainingQty(sale,item){return Math.max(0,Number(item.qty||0)-returnedQty(sale.id,item))}

function ensureLoyaltyPreview(){
  if($("#returnLoyaltyPreview"))return;
  els.editor?.querySelector(".return-summary")?.insertAdjacentHTML("afterend",`<div id="returnLoyaltyPreview" class="return-loyalty-preview" hidden><strong>ปรับแต้มสมาชิก</strong><span id="returnLoyaltyText"></span></div>`);
}
function previousPointAdjustment(saleId,field){return saleReturns(saleId).reduce((sum,record)=>sum+Number(record.loyaltyAdjustment?.[field]||0),0)}
function calculateLoyaltyAdjustment(sale,refundTotal){
  if(!sale?.customerId||!sale?.loyalty||refundTotal<=0)return null;
  const settings=loyaltySettings(),originalEarned=Math.max(0,Math.floor(Number(sale.loyalty.pointsEarned||0))),originalUsed=Math.max(0,Math.floor(Number(sale.loyalty.pointsUsed||0))),saleTotal=Math.max(0,Number(sale.totalAmount??sale.total??0));
  const previousRefund=saleReturns(sale.id).reduce((sum,record)=>sum+Number(record.refundTotal||0),0),cumulativeRefund=Math.min(saleTotal,previousRefund+refundTotal),remainingNet=Math.max(0,saleTotal-cumulativeRefund);
  const targetEarnedReversal=Math.min(originalEarned,Math.max(0,originalEarned-Math.floor(remainingNet/Math.max(.01,Number(settings.spendPerPoint||10))))),previousEarnedDeducted=previousPointAdjustment(sale.id,"pointsEarnedDeducted");
  const targetUsedRestore=saleTotal<=0?0:(cumulativeRefund>=saleTotal?originalUsed:Math.floor(originalUsed*cumulativeRefund/saleTotal)),previousUsedRestored=previousPointAdjustment(sale.id,"pointsUsedRestored");
  return{customerId:sale.customerId,customerCode:sale.customerCode||"",customerName:sale.customerName||"",pointsEarnedToDeduct:Math.max(0,targetEarnedReversal-previousEarnedDeducted),pointsUsedToRestore:Math.max(0,targetUsedRestore-previousUsedRestored),targetEarnedReversal,targetUsedRestore,cumulativeRefund,remainingNet};
}
function updateLoyaltyPreview(refundTotal){
  ensureLoyaltyPreview();
  const preview=$("#returnLoyaltyPreview"),text=$("#returnLoyaltyText"),adjustment=calculateLoyaltyAdjustment(selectedSale,refundTotal);
  if(!preview||!text||!adjustment||(adjustment.pointsEarnedToDeduct<=0&&adjustment.pointsUsedToRestore<=0)){if(preview)preview.hidden=true;return}
  const parts=[];if(adjustment.pointsEarnedToDeduct>0)parts.push(`หักแต้มที่เคยได้รับ ${adjustment.pointsEarnedToDeduct.toLocaleString("th-TH")} แต้ม`);if(adjustment.pointsUsedToRestore>0)parts.push(`คืนแต้มที่เคยใช้ ${adjustment.pointsUsedToRestore.toLocaleString("th-TH")} แต้ม`);
  text.textContent=parts.join(" • ");preview.hidden=false;
}
function buildLoyaltyReturnBundle(planned,customer,sale,returnId,refundTotal,createdAt,createdBy=""){
  if(!planned||!customer)return null;
  const pointsBefore=Math.max(0,Math.floor(Number(customer.points||0))),pointsUsedRestored=Math.max(0,planned.pointsUsedToRestore),availableAfterRestore=pointsBefore+pointsUsedRestored,pointsEarnedDeducted=Math.min(availableAfterRestore,Math.max(0,planned.pointsEarnedToDeduct)),deductionShortfall=Math.max(0,planned.pointsEarnedToDeduct-pointsEarnedDeducted),pointsAfter=Math.max(0,availableAfterRestore-pointsEarnedDeducted);
  const tenantId=getTenantId(),deviceId=getDeviceId();
  const updatedCustomer={...customer,points:pointsAfter,updatedAt:Date.now()};
  const ledgerEntry={id:auditId("point_return",returnId),type:"return",returnId,saleId:sale.id,customerId:customer.id,customerCode:customer.customerCode||sale.customerCode||"",customerName:customer.name||sale.customerName||"",createdAt,pointsEarned:0,pointsUsed:0,pointsEarnedDeducted,pointsUsedRestored,deductionShortfall,balanceBefore:pointsBefore,balanceAfter:pointsAfter,refundTotal,tenantId,shopId:tenantId,deviceId,schemaVersion:POS_FIRESTORE_VERSION,createdBy};
  const adjustment={customerId:customer.id,customerCode:customer.customerCode||sale.customerCode||"",customerName:customer.name||sale.customerName||"",pointsBefore,pointsEarnedDeducted,pointsUsedRestored,deductionShortfall,pointsAfter};
  return{updatedCustomer,ledgerEntry,adjustment};
}
function cacheLoyaltyReturnBundle(bundle){if(!bundle)return;const customers=read(CUSTOMER_KEY,[]),index=customers.findIndex(customer=>customer.id===bundle.adjustment.customerId);if(index>=0){customers[index]=bundle.updatedCustomer;write(CUSTOMER_KEY,customers)}const ledger=read(LOYALTY_LEDGER_KEY,[]);write(LOYALTY_LEDGER_KEY,[bundle.ledgerEntry,...ledger.filter(row=>row.id!==bundle.ledgerEntry.id)].slice(0,2000))}
function applyLocalLoyaltyAdjustment(sale,returnId,refundTotal,createdAt){const planned=calculateLoyaltyAdjustment(sale,refundTotal);if(!planned)return null;const customer=read(CUSTOMER_KEY,[]).find(row=>row.id===planned.customerId);const bundle=buildLoyaltyReturnBundle(planned,customer,sale,returnId,refundTotal,createdAt,auth?.currentUser?.uid||"");cacheLoyaltyReturnBundle(bundle);return bundle}

function searchSales(){
  sales=read(SALES_KEY,[]);returns=read(RETURN_KEY,[]);
  const query=els.search.value.trim().toLowerCase();
  const rows=sales.filter(sale=>{const itemText=(sale.items||[]).map(item=>`${item.name||""} ${item.id||""} ${item.barcode||""}`).join(" ").toLowerCase();return(!query||saleNumberOf(sale).toLowerCase().includes(query)||String(sale.id||"").toLowerCase().includes(query)||itemText.includes(query))&&(sale.items||[]).some(item=>remainingQty(sale,item)>0)}).slice(0,30);
  els.resultsEmpty.hidden=rows.length>0;els.resultsEmpty.textContent=query?"ไม่พบบิลที่ยังมีสินค้าคืนได้":"ค้นหาบิลที่ต้องการคืนสินค้า";
  els.results.innerHTML=rows.map(sale=>{const available=(sale.items||[]).reduce((sum,item)=>sum+remainingQty(sale,item),0);return`<article class="return-sale-card"><div><strong>${esc(saleNumberOf(sale))}</strong><span>${new Date(sale.createdAt).toLocaleString("th-TH")} • คืนได้ ${available.toLocaleString("th-TH")} ชิ้น</span></div><div class="return-sale-total"><strong>${money(sale.totalAmount??sale.total)} บาท</strong><span>${(sale.items||[]).length} รายการ</span></div><button type="button" data-sale-id="${esc(sale.id)}">เลือกบิล</button></article>`}).join("");
}
function openSale(id){
  selectedSale=sales.find(sale=>sale.id===id)||null;if(!selectedSale)return;
  els.saleId.textContent=saleNumberOf(selectedSale);const member=selectedSale.customerName?` • สมาชิก ${selectedSale.customerCode||""} ${selectedSale.customerName}`:"";
  els.saleMeta.textContent=`${new Date(selectedSale.createdAt).toLocaleString("th-TH")} • ${(selectedSale.paymentMethod||selectedSale.payment?.method)==="cash"?"เงินสด":"PromptPay / โอนเงิน"}${member}`;
  els.date.value=today();els.reason.value="";els.note.value="";els.error.textContent="";
  els.items.innerHTML=(selectedSale.items||[]).map(item=>{const returned=returnedQty(selectedSale.id,item),remaining=remainingQty(selectedSale,item);return`<tr data-product-id="${esc(item.id||item.productId)}"><td class="return-product"><strong>${esc(item.name||item.productName)}</strong><span>${esc(item.id||item.productId)} • ${esc(item.barcode||"")}</span></td><td class="number">${Number(item.qty||0).toLocaleString("th-TH")}</td><td class="number">${returned.toLocaleString("th-TH")}</td><td class="number"><input class="return-qty" type="number" min="0" max="${remaining}" step="0.001" value="0" ${remaining<=0?"disabled":""}></td><td class="number">${money(item.price)}</td><td class="number return-line-total">0.00</td></tr>`}).join("");
  els.editor.hidden=false;updateTotal();els.editor.scrollIntoView({behavior:"smooth",block:"start"});
}
function updateTotal(){if(!selectedSale)return;let total=0;[...els.items.querySelectorAll("tr")].forEach(row=>{const item=selectedSale.items.find(entry=>String(entry.id||entry.productId)===row.dataset.productId),input=row.querySelector(".return-qty"),qty=Math.max(0,Math.min(Number(input.value||0),Number(input.max||0))),line=qty*Number(item?.price||0);input.value=qty;row.querySelector(".return-line-total").textContent=money(line);total+=line});els.total.textContent=`${money(total)} บาท`;updateLoyaltyPreview(total)}
function clearSelected(){selectedSale=null;els.editor.hidden=true;els.items.innerHTML="";els.total.textContent="0.00 บาท";const preview=$("#returnLoyaltyPreview");if(preview)preview.hidden=true}
function collectItems(){if(!selectedSale)return[];return[...els.items.querySelectorAll("tr")].map(row=>{const item=selectedSale.items.find(entry=>String(entry.id||entry.productId)===row.dataset.productId),input=row.querySelector(".return-qty"),qty=Number(input.value||0),max=Number(input.max||0);return{productId:item.id||item.productId,barcode:item.barcode||"",productName:item.name||item.productName,qty,unit:item.unit||"",price:Number(item.price||0),cost:item.cost??null,max,lineTotal:qty*Number(item.price||0)}}).filter(item=>item.qty>0)}
function selectAllRemainingForVoid(){if(!selectedSale)return;els.items.querySelectorAll(".return-qty").forEach(input=>{input.value=input.max||0});els.method.value="original";els.reason.value="ยกเลิกบิล / VOID";updateTotal()}

async function confirmReturn(){
  if(savingReturn)return;els.error.textContent="";if(!selectedSale){els.error.textContent="กรุณาเลือกบิล";return}
  const items=collectItems();if(!items.length){els.error.textContent="กรุณาระบุจำนวนสินค้าที่ต้องการคืน";return}if(items.some(item=>item.qty>item.max)){els.error.textContent="จำนวนคืนมากกว่าจำนวนที่คืนได้";return}if(!els.date.value||!els.reason.value.trim()){els.error.textContent="กรุณากรอกวันที่และเหตุผลการคืน";return}
  const refundTotal=items.reduce((sum,item)=>sum+item.lineTotal,0),returnType=returnTypeFor(items,selectedSale),planned=calculateLoyaltyAdjustment(selectedSale,refundTotal);
  const pointMessage=planned&&(planned.pointsEarnedToDeduct>0||planned.pointsUsedToRestore>0)?`\nปรับแต้ม: ${planned.pointsEarnedToDeduct>0?`หัก ${planned.pointsEarnedToDeduct} แต้ม`:""}${planned.pointsEarnedToDeduct>0&&planned.pointsUsedToRestore>0?" / ":""}${planned.pointsUsedToRestore>0?`คืน ${planned.pointsUsedToRestore} แต้ม`:""}`:"";
  if(!confirm(`ยืนยัน${returnType==="void"?"ยกเลิกบิล/คืนทั้งบิล":"คืนสินค้า"} ${items.reduce((sum,item)=>sum+item.qty,0).toLocaleString("th-TH")} ชิ้น และคืนเงิน ${money(refundTotal)} บาทหรือไม่?${pointMessage}`))return;
  const id=uid(returnType==="void"?"VOID":"RETURN"),createdAt=new Date().toISOString(),tenantId=getTenantId(),deviceId=getDeviceId(),createdBy=auth?.currentUser?.uid||"";
  const baseRecord={id,saleId:selectedSale.id,saleNumber:saleNumberOf(selectedSale),returnType,returnDate:els.date.value,createdAt,dateKey:dateKeyFrom(createdAt),monthKey:monthKeyFrom(createdAt),refundMethod:els.method.value,reason:els.reason.value.trim(),note:els.note.value.trim(),refundTotal,items,tenantId,shopId:tenantId,deviceId,schemaVersion:POS_FIRESTORE_VERSION,deleted:false,createdBy,updatedBy:createdBy,updatedAt:Date.now()};
  savingReturn=true;els.confirm.disabled=true;els.confirm.textContent="กำลังบันทึกการคืน...";
  try{
    const movementRows=[];let nextProducts=products.map(product=>({...product})),committedLoyaltyBundle=null;
    if(isFirebaseConfigured&&db){
      const saleRef=tenantDoc(RetailCollections.sales,selectedSale._documentId||selectedSale.id),returnRef=tenantDoc(RetailCollections.returns,id);
      committedLoyaltyBundle=await runTransaction(db,async transaction=>{
        movementRows.length=0;nextProducts=products.map(product=>({...product}));
        const saleSnapshot=await transaction.get(saleRef),returnSnapshot=await transaction.get(returnRef);
        if(returnSnapshot.exists())throw new Error("RETURN_DUPLICATE");
        if(!saleSnapshot.exists())throw new Error("SALE_NOT_FOUND");
        const saleData=saleSnapshot.data(),previousReturns=Array.isArray(saleData.returns)?saleData.returns:[],productRows=[];
        for(const item of items){const cached=products.find(product=>String(product.id)===String(item.productId));const productRef=tenantDoc(RetailCollections.products,cached?._documentId||item.productId);const productSnapshot=await transaction.get(productRef);if(!productSnapshot.exists())throw new Error(`PRODUCT_NOT_FOUND:${item.productName}`);const soldItem=(saleData.items||[]).find(row=>String(row.id||row.productId)===String(item.productId));const alreadyReturned=previousReturns.flatMap(row=>row.items||[]).filter(row=>String(row.productId)===String(item.productId)).reduce((sum,row)=>sum+Number(row.qty||0),0);if(!soldItem||Number(item.qty||0)>Math.max(0,Number(soldItem.qty||0)-alreadyReturned))throw new Error(`RETURN_QTY_EXCEEDED:${item.productName}`);productRows.push({item,cached,productRef,productData:productSnapshot.data()})}
        let loyaltyBundle=null;if(planned?.customerId){const cachedCustomer=read(CUSTOMER_KEY,[]).find(customer=>String(customer.id)===String(planned.customerId));const customerRef=tenantDoc(RetailCollections.customers,cachedCustomer?._documentId||planned.customerId);const customerSnapshot=await transaction.get(customerRef);if(customerSnapshot.exists()){const customer={id:customerSnapshot.data().id||customerSnapshot.id,...customerSnapshot.data()};loyaltyBundle=buildLoyaltyReturnBundle(planned,customer,{...selectedSale,...saleData},id,refundTotal,createdAt,createdBy);if(loyaltyBundle){transaction.set(customerRef,{...loyaltyBundle.updatedCustomer,tenantId,shopId:tenantId,updatedAt:Date.now(),updatedAtServer:serverTimestamp()},{merge:true});transaction.set(tenantDoc(RetailCollections.loyaltyLedger,loyaltyBundle.ledgerEntry.id),{...loyaltyBundle.ledgerEntry,updatedAt:Date.now(),updatedAtServer:serverTimestamp()},{merge:true})}}}
        const loyaltyAdjustment=loyaltyBundle?.adjustment||null,returnSummary={id,returnType,refundTotal,createdAt,items:items.map(item=>({productId:item.productId,qty:item.qty})),loyaltyAdjustment};
        const saleTotal=Number(saleData.totalAmount??saleData.total??0),nextRefundTotal=Number(saleData.refundTotal||0)+refundTotal,refundStatus=nextRefundTotal>=saleTotal?"fully_refunded":"partially_refunded";
        const currentLoyalty=saleData.loyalty||null,updatedLoyalty=currentLoyalty&&loyaltyAdjustment?{...currentLoyalty,pointsEarnedReversed:Number(currentLoyalty.pointsEarnedReversed||0)+Number(loyaltyAdjustment.pointsEarnedDeducted||0),pointsUsedRestored:Number(currentLoyalty.pointsUsedRestored||0)+Number(loyaltyAdjustment.pointsUsedRestored||0),pointsAfterReturns:loyaltyAdjustment.pointsAfter}:currentLoyalty;
        transaction.set(returnRef,{...baseRecord,loyaltyAdjustment,createdAtServer:serverTimestamp(),updatedAtServer:serverTimestamp()});
        transaction.update(saleRef,{returns:[...previousReturns,returnSummary],refundTotal:nextRefundTotal,refundStatus,status:returnType==="void"?"voided":saleData.status,loyalty:updatedLoyalty,updatedAt:Date.now(),updatedAtServer:serverTimestamp()});
        productRows.forEach(({item,cached,productRef,productData})=>{const before=Number(productData.stock||0),after=before+Number(item.qty||0),moveId=movementId(id,item.productId),movement={id:moveId,tenantId,shopId:tenantId,deviceId,schemaVersion:POS_FIRESTORE_VERSION,deleted:false,dateKey:baseRecord.dateKey,monthKey:baseRecord.monthKey,productId:item.productId,productName:item.productName,type:returnType,direction:"in",qty:Number(item.qty||0),before,after,stockBefore:before,stockAfter:after,note:`${returnType==="void"?"ยกเลิกบิล":"คืนสินค้า"} ${id} จาก ${baseRecord.saleNumber}`,referenceType:returnType,referenceId:id,referenceNumber:id,createdBy,updatedBy:createdBy,createdAt,updatedAt:Date.now(),createdAtServer:serverTimestamp(),updatedAtServer:serverTimestamp()};transaction.update(productRef,{stock:after,tenantId,shopId:tenantId,updatedAt:Date.now(),updatedAtServer:serverTimestamp()});transaction.set(tenantDoc(RetailCollections.stockMovements,moveId),movement,{merge:true});movementRows.push({...movement,createdAtServer:null,updatedAtServer:null});const local=nextProducts.find(product=>String(product.id)===String(item.productId));if(local)local.stock=after;else nextProducts.push({id:item.productId,barcode:item.barcode,name:item.productName,price:item.price,cost:item.cost,stock:after,unit:item.unit||"ชิ้น",minStock:0,showOnPos:true,_documentId:cached?._documentId})});
        transaction.set(tenantDoc("auditLogs",auditId(returnType==="void"?"pos_sale_voided":"pos_return_completed",id)),{id:auditId(returnType==="void"?"pos_sale_voided":"pos_return_completed",id),tenantId,shopId:tenantId,deviceId,schemaVersion:POS_FIRESTORE_VERSION,action:returnType==="void"?"pos_sale_voided":"pos_return_completed",entityType:"return",entityId:id,entityNumber:id,createdBy,updatedBy:createdBy,createdAt,updatedAt:Date.now(),summary:{saleId:selectedSale.id,saleNumber:baseRecord.saleNumber,refundTotal,totalQty:items.reduce((sum,item)=>sum+Number(item.qty||0),0),refundMethod:baseRecord.refundMethod,returnType}},{merge:true});
        return loyaltyBundle;
      });
    }else{items.forEach(item=>{let product=nextProducts.find(entry=>String(entry.id)===String(item.productId));if(!product){product={id:item.productId,barcode:item.barcode,name:item.productName,price:item.price,cost:item.cost,stock:0,unit:item.unit||"ชิ้น",minStock:0,showOnPos:true};nextProducts.push(product)}const before=Number(product.stock||0),after=before+item.qty;product.stock=after;movementRows.push({id:movementId(id,item.productId),tenantId,shopId:tenantId,deviceId,productId:product.id,productName:product.name,type:returnType,direction:"in",qty:item.qty,before,after,note:`${returnType==="void"?"ยกเลิกบิล":"คืนสินค้า"} ${id} จาก ${baseRecord.saleNumber}`,referenceType:returnType,referenceId:id,referenceNumber:id,createdAt})})}
    products=nextProducts;const loyaltyBundle=isFirebaseConfigured&&db?committedLoyaltyBundle:applyLocalLoyaltyAdjustment(selectedSale,id,refundTotal,createdAt);if(isFirebaseConfigured&&db)cacheLoyaltyReturnBundle(loyaltyBundle);
    const loyaltyAdjustment=loyaltyBundle?.adjustment||null,record={...baseRecord,loyaltyAdjustment};returns=[record,...returns.filter(row=>row.id!==id)];
    const saleIndex=sales.findIndex(sale=>sale.id===selectedSale.id);if(saleIndex>=0){const saleReturnList=Array.isArray(sales[saleIndex].returns)?sales[saleIndex].returns:[],currentLoyalty=sales[saleIndex].loyalty||null,updatedLoyalty=currentLoyalty&&loyaltyAdjustment?{...currentLoyalty,pointsEarnedReversed:Number(currentLoyalty.pointsEarnedReversed||0)+Number(loyaltyAdjustment.pointsEarnedDeducted||0),pointsUsedRestored:Number(currentLoyalty.pointsUsedRestored||0)+Number(loyaltyAdjustment.pointsUsedRestored||0),pointsAfterReturns:loyaltyAdjustment.pointsAfter}:currentLoyalty;sales[saleIndex]={...sales[saleIndex],status:returnType==="void"?"voided":sales[saleIndex].status,refundStatus:returnType==="void"?"fully_refunded":"partially_refunded",loyalty:updatedLoyalty,returns:[...saleReturnList.filter(row=>row.id!==id),{id,returnType,refundTotal,createdAt,items:items.map(item=>({productId:item.productId,qty:item.qty})),loyaltyAdjustment}],refundTotal:Number(sales[saleIndex].refundTotal||0)+refundTotal}}
    write(RETURN_KEY,returns.slice(0,500));write(SALES_KEY,sales);write(PRODUCT_KEY,products);write(MOVEMENT_KEY,[...movementRows,...read(MOVEMENT_KEY,[]).filter(row=>row.referenceId!==id)].slice(0,500));
    renderHistory();searchSales();clearSelected();toast(`บันทึก${returnType==="void"?"การยกเลิกบิล":"การคืนสินค้า"} ${id} แล้ว${loyaltyAdjustment?` • แต้มคงเหลือ ${loyaltyAdjustment.pointsAfter}`:""}`);
  }catch(error){console.error("[retail-returns] return failed",error);const message=String(error?.message||error);if(message.startsWith("RETURN_QTY_EXCEEDED:"))els.error.textContent=`จำนวนคืนของ ${message.split(":").slice(1).join(":")} มากกว่าจำนวนที่คืนได้`;else if(message.startsWith("PRODUCT_NOT_FOUND:"))els.error.textContent=`ไม่พบสินค้า ${message.split(":").slice(1).join(":")}`;else if(message==="SALE_NOT_FOUND")els.error.textContent="ไม่พบบิลขายใน Firebase";else if(message==="RETURN_DUPLICATE")els.error.textContent="รายการคืนนี้ถูกบันทึกแล้ว";else els.error.textContent="บันทึกการคืนสินค้าไม่สำเร็จ กรุณาลองใหม่"}
  finally{savingReturn=false;els.confirm.disabled=false;els.confirm.textContent="ยืนยันคืนสินค้าและคืนเงิน"}
}

function renderHistory(){returns=read(RETURN_KEY,[]);const query=els.historySearch.value.trim().toLowerCase();const rows=returns.filter(record=>!query||[record.id,record.saleNumber,record.saleId,record.reason,record.note,(record.items||[]).map(item=>`${item.productName} ${item.productId}`).join(" ")].some(value=>String(value||"").toLowerCase().includes(query)));els.historyEmpty.hidden=rows.length>0;els.history.innerHTML=rows.map(record=>{const adjustment=record.loyaltyAdjustment,loyaltyText=adjustment?`<div class="return-history-loyalty">${adjustment.pointsEarnedDeducted>0?`หักแต้ม ${adjustment.pointsEarnedDeducted}`:""}${adjustment.pointsEarnedDeducted>0&&adjustment.pointsUsedRestored>0?" • ":""}${adjustment.pointsUsedRestored>0?`คืนแต้ม ${adjustment.pointsUsedRestored}`:""} • คงเหลือ ${adjustment.pointsAfter}</div>`:"",typeText=record.returnType==="void"?"VOID / ยกเลิกบิล":"คืนสินค้า";return`<article class="return-history-item"><div class="return-history-head"><div><strong>${esc(record.id)}</strong><span>${typeText} • อ้างอิง ${esc(record.saleNumber||record.saleId)} • ${new Date(`${record.returnDate}T00:00:00`).toLocaleDateString("th-TH")}</span></div><div class="return-history-total"><strong>${money(record.refundTotal)} บาท</strong><span>${esc(record.refundMethod||"")}</span></div></div><div class="return-history-meta">${esc(record.reason)}${record.note?` • ${esc(record.note)}`:""}</div>${loyaltyText}<div class="return-history-lines">${(record.items||[]).map(item=>`<div class="return-history-line"><span>${esc(item.productName)} × ${Number(item.qty).toLocaleString("th-TH")}</span><strong>${money(item.lineTotal)}</strong></div>`).join("")}</div></article>`}).join("")}

ensureLoyaltyPreview();
els.searchBtn.addEventListener("click",searchSales);
els.search.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();searchSales()}});
els.results.addEventListener("click",event=>{const button=event.target.closest("[data-sale-id]");if(button)openSale(button.dataset.saleId)});
els.items.addEventListener("input",event=>{if(event.target.closest(".return-qty"))updateTotal()});
els.clearSale.addEventListener("click",clearSelected);
els.confirm.addEventListener("click",confirmReturn);
els.voidBtn?.addEventListener("click",selectAllRemainingForVoid);
els.historySearch.addEventListener("input",renderHistory);
window.addEventListener("storage",()=>{sales=read(SALES_KEY,[]);returns=read(RETURN_KEY,[]);products=read(PRODUCT_KEY,[]);searchSales();renderHistory()});
renderHistory();

const stopSalesWatch=watchRecords(RetailCollections.sales,rows=>{write(SALES_KEY,rows);document.documentElement.dataset.returnsSalesSource="firestore";window.dispatchEvent(new Event("storage"))},{sortBy:"createdAt",direction:"desc"});
const stopReturnsWatch=watchRecords(RetailCollections.returns,rows=>{write(RETURN_KEY,rows);document.documentElement.dataset.returnsSource="firestore";window.dispatchEvent(new Event("storage"))},{sortBy:"createdAt",direction:"desc"});
const stopProductsWatch=watchRecords(RetailCollections.products,rows=>{write(PRODUCT_KEY,rows);document.documentElement.dataset.returnsProductsSource="firestore";window.dispatchEvent(new Event("storage"))},{sortBy:"updatedAt",direction:"desc"});
const stopSettingsWatch=watchRecords(RetailCollections.settings,rows=>{const settings=rows.find(row=>String(row.id)==="loyalty");if(settings)write(LOYALTY_SETTINGS_KEY,settings)},{sortBy:"updatedAt",direction:"desc"});
window.addEventListener("beforeunload",()=>{stopSalesWatch();stopReturnsWatch();stopProductsWatch();stopSettingsWatch()},{once:true});
