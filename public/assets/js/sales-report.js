import { dataService, usingDemoMode } from "./data-service.js";
import { money, formatTime } from "./ui.js?v=20260701-001";

const backIcon = document.querySelector('.app-header a[href="/admin/"] .bi:not(.app-icon)');
if (backIcon) backIcon.remove();

if (usingDemoMode) {
  const banner = document.querySelector("#demoBanner");
  if (banner) banner.innerHTML = '<div class="demo-banner">โหมดตัวอย่าง: รายงานจากข้อมูลในเบราว์เซอร์นี้</div>';
}

const state = { period: "daily", orders: [], receipts: [], filteredReceipts: [], page: 1, pageSize: 20 };
const els = {
  reportDate: document.querySelector("#reportDate"), reportMonth: document.querySelector("#reportMonth"), reportYear: document.querySelector("#reportYear"), startDate: document.querySelector("#startDate"), endDate: document.querySelector("#endDate"), orderType: document.querySelector("#orderTypeFilter"), paymentMethod: document.querySelector("#paymentMethodFilter"), search: document.querySelector("#receiptSearch"), totalSales: document.querySelector("#totalSales"), receiptCount: document.querySelector("#receiptCount"), averageReceipt: document.querySelector("#averageReceipt"), soldItemCount: document.querySelector("#soldItemCount"), orderTypeSummary: document.querySelector("#orderTypeSummary"), paymentSummary: document.querySelector("#paymentSummary"), chartTitle: document.querySelector("#chartTitle"), chartSubtitle: document.querySelector("#chartSubtitle"), salesChart: document.querySelector("#salesChart"), topItems: document.querySelector("#topItems"), bestPeriod: document.querySelector("#bestPeriod"), receiptRows: document.querySelector("#receiptRows"), receiptResultCount: document.querySelector("#receiptResultCount"), receiptRangeLabel: document.querySelector("#receiptRangeLabel"), pagination: document.querySelector("#receiptPagination"), dialog: document.querySelector("#receiptDialog"), detail: document.querySelector("#receiptDetail")
};

function setChartTitle(text){if(els.chartTitle)els.chartTitle.innerHTML=`<i class="bi bi-bar-chart-steps" aria-hidden="true"></i><span>${escapeHtml(text)}</span>`}
function toDate(value){if(!value)return null;if(typeof value.toDate==="function")return value.toDate();if(value.seconds)return new Date(value.seconds*1000);const date=new Date(value);return Number.isNaN(date.getTime())?null:date}
function localDateKey(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
function monthKey(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`}
function startOfDay(value){const date=new Date(`${value}T00:00:00`);return Number.isNaN(date.getTime())?null:date}
function endOfDay(value){const date=new Date(`${value}T23:59:59.999`);return Number.isNaN(date.getTime())?null:date}
function escapeHtml(value=""){return String(value).replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[char])}
function paidDate(order){return toDate(order.paidAt)||toDate(order.completedAt)||toDate(order.updatedAt)||toDate(order.createdAt)}
function isPaidOrder(order){return order?.paymentStatus==="paid"||order?.status==="paid"}
function isCancelledItem(item){return item?.cancelled===true}
function orderNet(order){if(Number.isFinite(Number(order.totalAmount)))return Number(order.totalAmount||0);return(order.items||[]).filter(item=>!isCancelledItem(item)).reduce((sum,item)=>sum+Number(item.price||0)*Number(item.qty||0),0)+Number(order.deliveryFee||0)}
function paymentMethodKey(order){const value=String(order.paymentMethod||"").toLowerCase();if(["cash","เงินสด"].includes(value))return"cash";if(["promptpay","transfer","bank","qr"].includes(value))return"promptpay";if(value==="cod")return"cod";return"other"}
function paymentMethodLabel(key){return({cash:"เงินสด",promptpay:"พร้อมเพย์/โอนเงิน",cod:"เก็บเงินปลายทาง",other:"อื่น ๆ"})[key]||"อื่น ๆ"}
function orderTypeLabel(key){return key==="delivery"?"Delivery":"หน้าร้าน"}