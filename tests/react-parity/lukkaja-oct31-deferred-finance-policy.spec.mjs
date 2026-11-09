import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const policy=require("../../functions/walkin-finance-policy.js");
const NOW="2026-10-31T05:20:00.000Z";
const bill=()=>({
 id:"walkin-12345",orderType:"walkin",serviceType:"dine_in",tableCode:"08",
 paymentTiming:"after",paymentMethod:"cash",paymentStatus:"unpaid",status:"served",
 totalAmount:100,items:[{menuId:"rice-123",qty:1,price:100,served:true,cancelled:false}],
});
const fails=(f,code)=>assert.throws(f,e=>e?.code===code);
test("Firebase Walk-in payment policy accepts only explicitly unpaid cash deferred",()=>{
 assert.deepEqual(policy.prepareWalkInPayment({
  serviceType:"dine_in",tableCode:"08",paymentMethod:"cash",paymentTiming:"after",cashReceived:null,
 },100),{paymentTiming:"after",paymentStatus:"unpaid",paymentMethod:"cash"});
 fails(()=>policy.prepareWalkInPayment({serviceType:"dine_in",paymentMethod:"cash",paymentTiming:"after"},100),"TABLE_REQUIRED");
 fails(()=>policy.prepareWalkInPayment({paymentMethod:"promptpay",paymentTiming:"after"},100),"DEFERRED_CASH_ONLY");
 fails(()=>policy.prepareWalkInPayment({paymentMethod:"cash",paymentTiming:"after",paidAt:NOW},100),"DEFERRED_PAYMENT_FORGED");
 fails(()=>policy.prepareWalkInPayment({paymentMethod:"cash",paymentTiming:"after",cashReceived:100},100),"DEFERRED_PAYMENT_FORGED");
 fails(()=>policy.prepareWalkInPayment({paymentMethod:"cash",cashReceived:99.99},100),"CASH_RECEIVED_INSUFFICIENT");
 assert.equal(policy.prepareWalkInPayment({paymentMethod:"cash",cashReceived:500},100).changeAmount,400);
});
test("Firebase add-on kitchen rounds have server-priced exact money and idempotency",()=>{
 const o=bill();
 const menus=new Map([["soup-123",{name:"Soup",price:150,active:true}]]);
 const r=policy.addKitchenRound(o,"cashier","append-round-001",[{menuId:"soup-123",qty:2,note:"less salt"}],menus,NOW);
 assert.equal(r.patch.totalAmount,400);
 assert.equal(r.patch.status,"pending");
 assert.equal(r.patch.items[0].kitchenPreviouslyServed,true);
 assert.equal(r.patch.items[1].kitchenAddOperationId,"append-round-001");
 assert.equal(r.addedAmount,300);
 const retry=policy.addKitchenRound({...o,...r.patch},"cashier","append-round-001",[{menuId:"soup-123",qty:2}],menus,NOW);
 assert.equal(retry.duplicate,true);
 assert.equal(retry.patch,null);
 fails(()=>policy.addKitchenRound(o,"kitchen","append-round-002",[{menuId:"soup-123",qty:1}],menus,NOW),"ROLE_FORBIDDEN");
 fails(()=>policy.addKitchenRound(o,"cashier","append-round-002",[{menuId:"soup-123",qty:1,price:0}],menus,NOW),"CLIENT_PRICE_FORBIDDEN");
 fails(()=>policy.addKitchenRound({...o,paymentStatus:"paid"},"cashier","append-round-002",[{menuId:"soup-123",qty:1}],menus,NOW),"DEFERRED_BILL_NOT_ELIGIBLE");
 fails(()=>policy.addKitchenRound({...o,totalAmount:0},"cashier","append-round-002",[{menuId:"soup-123",qty:1}],menus,NOW),"ORIGINAL_TOTAL_MISMATCH");
});
test("Cash settlement must be server-priced, fully served, idempotency and stale total gated",()=>{
 const o=bill();
 assert.equal(policy.settleDeferredWalkIn(o,"cashier",200,100,NOW).changeAmount,100);
 fails(()=>policy.settleDeferredWalkIn({...o,status:"pending"},"cashier",100,100,NOW),"WAIT_FOR_KITCHEN");
 fails(()=>policy.settleDeferredWalkIn(o,"kitchen",100,100,NOW),"ROLE_FORBIDDEN");
 fails(()=>policy.settleDeferredWalkIn(o,"cashier",100,99,NOW),"STALE_CASHIER_TOTAL");
 fails(()=>policy.settleDeferredWalkIn(o,"cashier",0,100,NOW),"CASH_RECEIVED_INSUFFICIENT");
 fails(()=>policy.settleDeferredWalkIn({...o,items:[{...o.items[0],served:false}]},"cashier",100,100,NOW),"WAIT_FOR_KITCHEN");
 fails(()=>policy.settleDeferredWalkIn({...o,paidAt:NOW},"cashier",100,100,NOW),"DEFERRED_BILL_NOT_ELIGIBLE");
});
test("Unpaid cancellation preserves monetary evidence and actor but never writes refund",()=>{
 const o=bill();
 const cancelled=policy.cancelDeferredWalkIn(o,"kitchen","kitchen",NOW);
 assert.equal(cancelled.cancelledNetAmount,100);
 assert.equal(cancelled.cancellationSource,"kitchen");
 assert.equal(cancelled.status,"cancelled");
 assert.ok(!("paymentStatus" in cancelled));
 assert.ok(!JSON.stringify(cancelled).toLowerCase().includes("refund"));
 fails(()=>policy.cancelDeferredWalkIn(o,"cashier","kitchen",NOW),"ROLE_FORBIDDEN");
 fails(()=>policy.cancelDeferredWalkIn({...o,paymentStatus:"paid"},"cashier","cashier",NOW),"DEFERRED_BILL_NOT_ELIGIBLE");
 fails(()=>policy.cancelDeferredWalkIn({...o,tableToken:"forged-qr"},"cashier","cashier",NOW),"DEFERRED_BILL_NOT_ELIGIBLE");
 const p=policy.cancelDeferredItem({...o,items:[{...o.items[0],served:false}]},"kitchen",0,NOW);
 assert.equal(p.status,"cancelled");
 assert.equal(p.totalAmount,0);
 assert.equal(p.originalUnpaidTotal,100);
 assert.ok(!("originalPaidTotal" in p));
 fails(()=>policy.cancelDeferredItem(o,"kitchen",5,NOW),"ITEM_NOT_FOUND");
});
