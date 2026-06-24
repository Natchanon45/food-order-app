const SALES_KEY="retail_pos_sales_v1",CUSTOMER_KEY="retail_pos_customers_v1";
const receiptMeta=document.querySelector(".receipt-meta"),salesBody=document.querySelector("#salesTableBody");
function read(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
if(receiptMeta&&!document.querySelector("#receiptCustomerRow")){receiptMeta.insertAdjacentHTML("beforeend",`<div id="receiptCustomerRow" hidden><span>สมาชิก</span><strong id="receiptCustomer">-</strong></div>`)}
function customerText(sale){if(!sale)return"";const customer=read(CUSTOMER_KEY,[]).find(c=>c.id===sale.customerId);return[sale.customerCode||customer?.customerCode,sale.customerName||customer?.name,sale.customerPhone||customer?.phone].filter(Boolean).join(" • ")}
function renderCustomer(saleId){const sale=read(SALES_KEY,[]).find(s=>s.id===saleId),row=document.querySelector("#receiptCustomerRow"),value=customerText(sale);if(!row)return;row.hidden=!value;document.querySelector("#receiptCustomer").textContent=value||"-"}
salesBody?.addEventListener("click",event=>{const button=event.target.closest("[data-sale-id]");if(button)setTimeout(()=>renderCustomer(button.dataset.saleId),0)},true);