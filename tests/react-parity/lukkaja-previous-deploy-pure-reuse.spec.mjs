import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const loadPure = path =>
  import("data:text/javascript," + encodeURIComponent(readFileSync(path, "utf8")));
const data = await loadPure("react-app/src/data/salesCancellationReport.mjs");
const walkIn = await loadPure("react-app/src/data/walkInLifecycle.mjs");
const report = await loadPure("react-app/src/utils/revenueReportPeriod.mjs");
const favicon = await loadPure("react-app/src/utils/printFavicon.js");

test("selectively restored Oct31 modules are inert and contain no secret/network/Firestore writer", () => {
  const paths = [
    "react-app/src/data/salesCancellationReport.mjs",
    "react-app/src/data/walkInLifecycle.mjs",
    "react-app/src/utils/revenueReportPeriod.mjs",
    "react-app/src/utils/printFavicon.js",
    "react-app/src/components/MerchantServiceTerms.jsx",
    "react-app/public/parity/css/merchant-service-terms-port.css",
  ];
  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /httpsCallable\s*\(|\b(?:addDoc|setDoc|updateDoc|deleteDoc|runTransaction|fetch)\s*\(|process\.env|apiSecret\s*:/i, path);
    assert.ok(source.length > 10, path);
  }
  const terms = readFileSync(paths[4], "utf8");
  assert.match(terms, /storageReady === true/);
  assert.match(terms, /not confirmed active merely by displaying these terms/);
});

test("cancellation remains visible on receipt but excluded from revenue KPI", () => {
  const cancelled = { status: "cancelled", paymentStatus: "paid", totalAmount: 0, originalPaidTotal: 1200 };
  const good = { status: "paid", paymentStatus: "paid", totalAmount: 250 };
  assert.equal(data.isCancelledSalesOrder(cancelled), true);
  assert.equal(data.isReceiptHistoryOrder(cancelled), true);
  assert.equal(data.historicalReceiptNet(cancelled), 1200);
  assert.equal(data.receiptHistoryDisplayNet([cancelled, good]), 1450);
  assert.equal(data.reportedSalesNet([cancelled, good]), 250);
  assert.equal(data.receiptCancellationSource([{cancellationSource:"kitchen"}]), "kitchen");
});

test("Walk-in payment is not equated with served/closed table", () => {
  const order = {orderType:"walkin", serviceType:"dine_in", status:"paid", paymentStatus:"paid",
    id:"test-1", items:[{served:false}], completedAt:null};
  assert.equal(walkIn.unfinishedWalkInItems(order), true);
  assert.equal(walkIn.walkInKitchenPending(order), true);
  assert.equal(walkIn.walkInKitchenStatus(order), "pending");
  const tables = [{status:"occupied", walkInOrderId:"test-1"}];
  assert.equal(walkIn.walkInCashierPending(order,tables), true);
  assert.equal(walkIn.walkInCashierPending({...order,status:"cancelled"},tables), false);
  assert.equal(walkIn.walkInCashierPending({...order,items:[{served:true}]},[]), false);
});

test("calendar-month reporting never rewrites anniversary billing submission", () => {
  assert.deepEqual(report.calendarMonthRange("2026-02"), {startDate:"2026-02-01",endDate:"2026-02-28"});
  assert.deepEqual(report.calendarMonthRange("2028-02"), {startDate:"2028-02-01",endDate:"2028-02-29"});
  assert.equal(report.calendarMonthRange("2026-13"), null);
  assert.deepEqual(report.reportingQuery({period:"monthly",month:"2026-10"}), {
    period:"custom",startDate:"2026-10-01",endDate:"2026-10-31"
  });
  assert.deepEqual(report.reportingQuery({period:"daily",date:"2026-10-05"}), {period:"daily",date:"2026-10-05"});
  assert.equal(report.formatReportDateRange("2026-02-30","2026-03-01"),"");
});

test("print favicon is HTML-escaped, never JavaScript protocol", () => {
  const safeDocument = {baseURI:"https://penguin-food.web.app/",getElementById:()=>({href:"https://example.com/icon.png?a=1&b=%22"})};
  const link=favicon.printFaviconLink(safeDocument);
  assert.ok(link.startsWith('<link rel="icon" href="https://example.com/'));
  assert.ok(link.includes("&amp;"),link);
  assert.equal(favicon.printFaviconLink({baseURI:"https://example.com/",getElementById:()=>({href:"javascript:alert(1)"})}),"");
});
