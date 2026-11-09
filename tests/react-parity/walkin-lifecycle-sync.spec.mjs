import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  unfinishedWalkInItems, walkInKitchenPending, walkInKitchenStatus,
  walkInCashierPending, walkInOwnedTable,
} from "../../react-app/src/data/walkInLifecycle.mjs";
const base={
 id:"walkin-queue-Q001",orderType:"walkin",serviceType:"dine_in",tableCode:"09",
 status:"pending",paymentStatus:"paid",paidAt:"2026-10-31T06:42:00+07:00",totalAmount:255,
 items:[{name:"dish",qty:1,price:255,served:false}],
};
const claimed=[{status:"occupied",code:"09",walkInOrderId:base.id,orderToken:""}];
const available=[{status:"available",code:"09",walkInOrderId:"",orderToken:""}];
test("paid first: payment and revenue cannot conceal unfinished kitchen work",()=>{
 assert.equal(walkInKitchenPending(base),true);
 assert.equal(walkInKitchenStatus(base),"pending");
 assert.equal(walkInCashierPending(base,claimed),true);
 assert.equal(walkInCashierPending(base,available),true);
 assert.equal(unfinishedWalkInItems(base),true);
});
test("legacy operational paid status without served items is still a kitchen order",()=>{
 const legacy={...base,status:"paid"};
 assert.equal(walkInKitchenPending(legacy),true);
 assert.equal(walkInKitchenStatus(legacy),"pending");
 assert.equal(walkInCashierPending(legacy,available),true);
 assert.equal(walkInKitchenPending({...legacy,completedAt:"2026-10-31T06:45:00Z"}),false);
});
test("finished paid bill stays in sales history but cannot remain forever in Cashier",()=>{
 const finished={...base,status:"paid",completedAt:"2026-10-31T06:45:00Z",items:[{...base.items[0],served:true}]};
 assert.equal(walkInKitchenPending(finished),false);
 assert.equal(walkInCashierPending(finished,available),false);
 assert.equal(walkInCashierPending(finished,claimed),true);
 assert.equal(walkInOwnedTable(finished,available),false);
 assert.equal(walkInOwnedTable(finished,claimed),true);
 assert.equal(walkInCashierPending({...finished,tableClosedAt:"2026-10-31T06:50:00Z"},available),false);
});
test("unpaid awaiting cashier settlement remains visible while closed/voided do not",()=>{
 const unpaid={...base,status:"served",paymentStatus:"unpaid",paymentTiming:"after"};
 assert.equal(walkInCashierPending(unpaid,available),true);
 for(const status of ["cancelled","voided","deleted","completed"]){
  assert.equal(walkInKitchenPending({...base,status}),false);
  assert.equal(walkInCashierPending({...base,status},claimed),false);
 }
});
test("table ownership is exact, and other customers' table cannot be treated as ours",()=>{
 const other=[{...claimed[0],walkInOrderId:"walkin-other"}];
 assert.equal(walkInOwnedTable(base,other),false);
 assert.equal(walkInOwnedTable(base,[{...claimed[0],orderToken:"qr-active"}]),false);
 assert.equal(walkInCashierPending({...base,status:"paid",completedAt:"done",items:[{served:true}]},other),false);
});
test("Quick Order bag is a theme-colored Bootstrap icon rather than a black external SVG image",()=>{
 const page=readFileSync("react-app/src/pages/QuickOrderPage.jsx","utf8");
 const css=readFileSync("react-app/public/parity/css/quick-order-emerald-port.css","utf8");
 assert.match(page,/className="bi bi-bag app-icon quick-service-icon"/);
 assert.doesNotMatch(page,/src="\/assets\/vendor\/bootstrap-icons\/icons\/bag\.svg"/);
 assert.match(css,/\.quick-order-settings \.quick-segment button\.active/);
});
test("Kitchen and Cashier both consume same lifecycle and server permits only incomplete legacy paid orders",()=>{
 const kitchen=readFileSync("react-app/src/pages/KitchenPage.jsx","utf8");
 const cashier=readFileSync("react-app/src/pages/CashierPage.jsx","utf8");
 const server=readFileSync("functions/operational-orders.js","utf8");
 assert.match(kitchen,/ACTIVE_STATUSES\.has\(order\.status\) \|\| walkInKitchenPending\(order\)/);
 assert.match(kitchen,/walkInKitchenStatus\(order\)/);
 assert.match(cashier,/activeOrders\(normalizedOrders, tables\)/);
 assert.match(cashier,/walkInCashierPending\(order, tables\)/);
 assert.match(server,/legacyPaidAwaitingKitchen/);
 assert.match(server,/!order\.completedAt && !order\.tableClosedAt/);
});
