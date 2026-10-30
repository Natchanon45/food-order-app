import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 isCancelledSalesOrder,isReceiptHistoryOrder,receiptCancellationSource,
 historicalReceiptNet,reportedSalesNet
} from "../../react-app/src/data/salesCancellationReport.mjs";
const page=n=>readFileSync("react-app/src/pages/"+n+".jsx","utf8");
const rules=readFileSync("firestore.rules","utf8");
const functionsCode=readFileSync("functions/operational-orders.js","utf8");
const locales=JSON.parse(readFileSync("react-app/src/i18n/parity-translations.json","utf8"));
test("cancelled paid and unpaid receipts remain history but contribute zero sales",()=>{
 const paid={status:"paid",paymentStatus:"paid",totalAmount:251};
 const voidPaid={status:"cancelled",paymentStatus:"paid",totalAmount:251,originalPaidTotal:251,cancellationSource:"cashier"};
 const voidUnpaid={status:"cancelled",paymentStatus:"unpaid",totalAmount:0,originalUnpaidTotal:125,cancellationSource:"kitchen"};
 assert.equal(isReceiptHistoryOrder(voidPaid),true);
 assert.equal(isReceiptHistoryOrder(voidUnpaid),true);
 assert.equal(isCancelledSalesOrder(voidUnpaid),true);
 assert.equal(historicalReceiptNet(voidPaid),251);
 assert.equal(reportedSalesNet([paid,voidPaid,voidUnpaid]),251);
 assert.equal(receiptCancellationSource([voidPaid]),"cashier");
 assert.equal(receiptCancellationSource([voidPaid,voidUnpaid]),"mixed");
});
test("sales KPI and receipt history use different inputs, filter defaults to all",()=>{
 const src=page("AdminSalesReportPage");
 assert.match(src,/orders\.filter\(isReceiptHistoryOrder\)/);
 assert.match(src,/const salesReceipts = useMemo\(/);
 assert.match(src,/filteredReceipts\.filter\(receipt => receipt\.status !== "cancelled"\)/);
 assert.match(src,/const \[receiptStatus, setReceiptStatus\] = useState\(""\)/);
 assert.match(src,/receiptStatusFilter/);
 assert.match(src,/reportedSalesNet\(sorted\)/);
 assert.match(src,/historicalReceiptNet\(order\)/);
 assert.match(src,/receipt-cancelled-banner/);
});
test("all five locales identify role, no refund and sale-excluded cancelled history",()=>{
 for(const lang of ["th","en","my","lo","km"]){
  assert.ok(locales[lang].sales_report.cancel.source_cashier);
  assert.ok(locales[lang].sales_report.cancel.source_kitchen);
  assert.ok(locales[lang].sales_report.cancel.sales_counted_total);
  assert.ok(locales[lang].cashier.cancel_order.review_recorded);
  assert.ok(locales[lang].quick_order.deferred.pay_and_close);
 }
});
test("receipt prints a nonfinancial 30-degree actor watermark and only real cash evidence",()=>{
 const src=page("CashierReceiptPage");
 const css=readFileSync("react-app/public/parity/css/cashier-receipt-cancelled-port.css","utf8");
 assert.match(src,/receipt-cancelled-watermark/);
 assert.match(src,/receipt-cancelled-code/);
 assert.match(src,/displayedNet/);
 assert.match(src,/first\?\.cashReceived !== null/);
 assert.match(css,/rotate\(-30deg\)/);
 assert.match(css,/opacity: \.28/);
});
test("server owns all walkin writes, role audit, funds and releases",()=>{
 for(const op of ["appendUnpaidWalkInItems","settleDeferredWalkIn","cancelDeferredWalkIn","updateDeferredKitchen","cancelReviewedPaidWalkIn"]){
  assert.match(functionsCode,new RegExp("exports\\."+op+" = onCall"));
 }
 assert.match(functionsCode,/tx\.create\(audit/);
 assert.match(functionsCode,/manualRefundNotRecorded: true/);
 assert.match(functionsCode,/if \(paymentMethod === "promptpay"/);
 assert.match(rules,/request\.resource\.data\.get\('orderType', ''\) != 'walkin'/);
 assert.match(rules,/resource\.data\.get\('paymentTiming', ''\) != 'after'/);
 assert.match(rules,/resource\.data\.get\('paymentStatus', ''\) == 'paid'/);
});
