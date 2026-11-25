import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifyCompleteTenantSalesSnapshot,MAX_COMPLETE_SALES_ORDERS} from
 "../../react-app/src/data/completeSalesSnapshot.mjs";
import {bangkokDateKey,bangkokMonthKey,bangkokHour,bangkokStartOfDay,
 bangkokEndOfDay,bangkokDaysInRange,bangkokMonthRange,bangkokYearRange} from
 "../../react-app/src/utils/salesReportBangkok.mjs";
import {isReceiptHistoryOrder,isCancelledSalesOrder,reportedSalesNet,
 receiptHistoryDisplayNet} from "../../react-app/src/data/salesCancellationReport.mjs";
const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");
const TENANT="p24-merchant-tenant";
const d=(id,values={})=>({id,data:()=>({tenantId:TENANT,totalAmount:250,
 status:"paid",paymentStatus:"paid",items:[{name:"Rice",qty:1,price:250}],...values})});
const snap=(docs=[],meta={})=>({docs,metadata:{fromCache:false,hasPendingWrites:false,...meta}});
test("P2.4 full Firebase server snapshot publishes all valid Tenant rows, not last-250 or cache",()=>{
 const docs=Array.from({length:350},(_,i)=>d("doc-"+i));
 assert.equal(verifyCompleteTenantSalesSnapshot(snap(docs),TENANT).length,350);
 assert.equal(MAX_COMPLETE_SALES_ORDERS,20000);
 assert.throws(()=>verifyCompleteTenantSalesSnapshot(snap(docs,{fromCache:true}),TENANT),
  /SALES_REPORT_SERVER_CONFIRMATION_REQUIRED/);
 assert.throws(()=>verifyCompleteTenantSalesSnapshot(snap(docs,{hasPendingWrites:true}),TENANT),
  /SALES_REPORT_SERVER_CONFIRMATION_REQUIRED/);
 assert.throws(()=>verifyCompleteTenantSalesSnapshot({},TENANT),
  /SALES_REPORT_SERVER_CONFIRMATION_REQUIRED/);
});
test("P2.4 financial read fails closed on invalid totals, corrupt tenant, duplicate IDs and >20k",()=>{
 const invalid=[
  [d("x",{totalAmount:NaN})],
  [d("x",{totalAmount:-1})],
  [d("x",{totalAmount:"200"})],
  [d("x",{totalAmount:Infinity})],
  [d("x",{totalAmount:1000000001})],
  [d("x",{tenantId:"foreign"})],
  [d("x",{items:"invalid"})],
  [d("x"),d("x")],
  [{id:"../invalid",data:()=>({totalAmount:100,items:[]})}],
 ];
 for(const docs of invalid)assert.throws(()=>verifyCompleteTenantSalesSnapshot(snap(docs),TENANT),
  /SALES_REPORT_(?:TOTAL_AMOUNT_INVALID|ORDER_INVALID|DUPLICATE_OR_INVALID_ID)/);
 assert.throws(()=>verifyCompleteTenantSalesSnapshot(snap([]),"../foreign"),/SALES_REPORT_TENANT_INVALID/);
 assert.throws(()=>verifyCompleteTenantSalesSnapshot(snap(Array.from({length:20001},
  (_,i)=>({id:"doc-"+i,data:()=>{throw Error("SHOULD_NOT_READ");}}))),TENANT),
   /SALES_REPORT_HISTORY_LIMIT_EXCEEDED/);
});
test("P2.4 Asia/Bangkok accounting day/month/year boundaries are identical in any browser timezone",()=>{
 const early=new Date("2026-11-24T17:02:00Z");
 const late=new Date("2026-11-25T16:59:59.999Z");
 assert.equal(bangkokDateKey(early),"2026-11-25");
 assert.equal(bangkokDateKey(late),"2026-11-25");
 assert.equal(bangkokHour(early),0);
 assert.equal(bangkokHour(late),23);
 assert.equal(bangkokMonthKey(early),"2026-11");
 assert.equal(bangkokStartOfDay("2026-11-25").toISOString(),"2026-11-24T17:00:00.000Z");
 assert.equal(bangkokEndOfDay("2026-11-25").toISOString(),"2026-11-25T16:59:59.999Z");
 assert.equal(bangkokMonthRange("2026-02").end.toISOString(),"2026-02-28T16:59:59.999Z");
 assert.equal(bangkokYearRange(2026).start.toISOString(),"2025-12-31T17:00:00.000Z");
 assert.equal(bangkokYearRange(2026).end.toISOString(),"2026-12-31T16:59:59.999Z");
 assert.deepEqual(bangkokDaysInRange(bangkokStartOfDay("2026-11-24"),
  bangkokEndOfDay("2026-11-26")),["2026-11-24","2026-11-25","2026-11-26"]);
 assert.equal(bangkokDaysInRange(bangkokStartOfDay("2025-01-01"),
  bangkokEndOfDay("2026-12-31")),null,"Reject >367-day custom chart");
 assert.equal(bangkokStartOfDay("2026-02-30"),null);
 assert.equal(bangkokMonthRange("2026-13"),null);
});
test("P2.4 voided paid orders remain inspectable but sales KPI/chart never counts them",()=>{
 const paid={status:"paid",paymentStatus:"paid",totalAmount:250,
  items:[{name:"Rice",qty:1,price:250}]};
 const voided={...paid,status:"cancelled",originalPaidTotal:250,
  cancellationSource:"cashier"};
 assert.equal(isReceiptHistoryOrder(voided),true);
 assert.equal(isCancelledSalesOrder(voided),true);
 assert.equal(reportedSalesNet([paid,voided]),250);
 assert.equal(receiptHistoryDisplayNet([voided]),250);
 const page=read("react-app/src/pages/AdminSalesReportPage.jsx");
 assert.match(page,/const matchingReceipts = useMemo/);
 assert.match(page,/matchingReceipts\.filter\(r => r\.status === "normal"\)/);
 assert.match(page,/receiptRows = useMemo/);
 assert.match(page,/selectedReceipt\.allItems/);
 assert.match(page,/itemCancellationSource\(item\)/);
 assert.match(page,/SalesReportReadFailure/);
 assert.match(page,/bangkokHour\(receipt\.paidAt\)/);
 assert.match(page,/data-sales-report-range-state="invalid"/);
});
test("P2.4 Source sale report read-only adapter requires verified server snapshots with fail-closed state",()=>{
 const adapter=read("react-app/src/data/salesReportData.js");
 const page=read("react-app/src/pages/AdminSalesReportPage.jsx");
 assert.match(adapter,/onSnapshot\(ref,\{includeMetadataChanges:true\}/);
 assert.match(adapter,/snapshot\.metadata\.fromCache \|\| snapshot\.metadata\.hasPendingWrites/);
 assert.match(adapter,/verifyCompleteTenantSalesSnapshot\(snapshot,id\)/);
 assert.doesNotMatch(page,/subscribeTenantOrders\(/);
 assert.match(page,/readyTenantId !== tenant\.id/);
 assert.match(page,/setLoadError\(error\?\.message/);
 assert.match(page,/return createElement\(SalesReportReadFailure/);
 assert.doesNotMatch(adapter,/limit\(250\)|limit\(100\)/);
});

test("Sales Report preserves the centered 1320px Source layout on desktop",()=>{
 const page=read("react-app/src/pages/AdminSalesReportPage.jsx");
 const mobile=read("react-app/src/ui/sales-report-source-mobile.css");
 const cascade=read("react-app/public/parity/css/sales-report-source-cascade.css");
 assert.match(cascade,/main\.sales-report-page\s*\{\s*width:\s*min\(1320px, 100%\)/);
 assert.doesNotMatch(mobile,/\bwidth:\s*100%\s*!important/);
 assert.ok(page.indexOf('"sales-report-source-cascade.css"')>page.indexOf('"admin-sales-source-polish.css"'));
 assert.match(cascade,/font-size:\.86rem;font-weight:800/);
 assert.match(cascade,/\.sales-back-link\s*\{\s*padding: 10px 14px/);
});
