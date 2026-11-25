import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isCurrentQrTicket,sameQrTicketSession,isCurrentQrTicketInTables} from "../../react-app/src/data/qrTicketSession.mjs";
const read=name=>readFileSync("react-app/src/"+name,"utf8");
test("QR tickets expire after table close, move, reissue or walk-in conversion",()=>{
 const table={id:"table-1",active:true,status:"occupied",orderToken:"token-1"},ticket={table,token:"token-1"};
 assert.equal(isCurrentQrTicket(ticket,table),true);
 for(const patch of [{status:"available"},{orderToken:"token-2"},{active:false},{walkInOrderId:"w"},{occupancyType:"walkin"},{id:"other"}])
  assert.equal(isCurrentQrTicket(ticket,{...table,...patch}),false);
 assert.equal(isCurrentQrTicketInTables(ticket,[]),false);
 assert.equal(sameQrTicketSession(ticket,{table,token:"token-2"}),false);
});
test("table issue and close re-read the expected session transactionally; print rechecks server",()=>{
 const data=read("data/operationalData.js"),page=read("pages/CashierTableQrPage.jsx");
 assert.match(data,/runTransaction\(db,async tx=>/);
 assert.match(data,/String\(row.orderToken\|\|""\)!==expectedOrderToken/);
 assert.match(data,/TABLE_HAS_UNPAID_ORDERS/);
 assert.match(page,/expectedOrderToken: String\(target.orderToken/);
 assert.match(page,/getOperationalTable\(tenant.id,nextTicket.table.id,\{server:true\}\)/);
 assert.match(page,/if\(!isCurrentQrTicket\(nextTicket,latest\)\)/);
});
test("queue opens without automatic table repair; display announces only after audio arm",()=>{
 const staff=read("pages/WaitingQueuePage.jsx"),display=read("pages/WaitingQueueDisplayPage.jsx");
 assert.doesNotMatch(staff,/allowSeatRepair|repairInFlight/);
 assert.match(staff,/ไม่สามารถเปิดหน้าจัดการคิวได้/);
 assert.match(display,/if \(!soundEnabled \|\| !soundArmed\) return;/);
 assert.match(display,/if \(primary\) lastSignature.current = "";/);
 assert.match(read("pages/WaitingQueueCustomerPage.jsx"),/bodyClass: "waiting-queue-customer-react-port"/);
});
test("receipt uses canonical bill number, original revisions and cancelled totals; refuses incomplete combined receipt",()=>{
 const src=read("pages/CashierReceiptPage.jsx");
 assert.match(src,/first.billNo/);
 assert.match(src,/ReceiptOriginalItemRow/);
 assert.match(src,/deliveryReceiptTotals\(first\)/);
 assert.match(src,/loadedOrders.some\(order=>!order\)/);
 assert.match(src,/order.tableToken!==loadedOrders\[0\].tableToken/);
 assert.match(src,/order.status === "cancelled" \? 0/);
});
