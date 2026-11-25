import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {placeWithFreshLalamoveQuote,lalamoveFeeChanged} from
 "../../react-app/src/data/cashierLalamoveRequote.mjs";
import {paidTakeawayAwaitingHandover} from "../../react-app/src/data/cashierPickupState.js";
import {hideCashierWholeOrderCancel} from
 "../../react-app/src/utils/cashierLalamoveCancelVisibility.mjs";
import {deliveryReceiptTotals} from "../../react-app/src/utils/deliveryReceiptTotal.mjs";
import {originalItemRevision,originalNetRevision} from "../../react-app/src/data/orderRevision.mjs";
const require=createRequire(import.meta.url);
const policy=require("../../functions/cashier-safe-order-policy.js");
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const safeBase={orderType:"delivery",deliveryProvider:"lalamove",paymentStatus:"paid",
 status:"ready",totalAmount:250,lalamoveDispatchQuote:{expiresAt:"2026-11-20T00:00:00Z"}};
test("P3.1 Source active Lalamove booking/uncertain state hides destructive whole-order cancellation",()=>{
 for(const state of ["placing","confirmation_unknown","placed"]){
  assert.equal(hideCashierWholeOrderCancel({...safeBase,lalamoveDispatchAttemptState:state}),true);
  assert.equal(hideCashierWholeOrderCancel({...safeBase,lalamoveDispatchStatus:state}),true);
 }
 assert.equal(hideCashierWholeOrderCancel({...safeBase,lalamoveOrderId:"123",
  lalamoveOrderStatus:"ASSIGNING_DRIVER"}),true);
 for(const s of ["CANCELLED","REJECTED","EXPIRED"])
  assert.equal(hideCashierWholeOrderCancel({...safeBase,lalamoveOrderId:"123",
   lalamoveOrderStatus:s}),false);
 assert.equal(hideCashierWholeOrderCancel(safeBase,true),true);
 assert.equal(policy.hasCourierReservation({...safeBase,lalamoveDispatchAttemptState:"confirmation_unknown"}),true);
 assert.equal(hideCashierWholeOrderCancel({...safeBase,paymentStatus:"unpaid",
  lalamoveDispatchReservation:{id:"provider-post-unknown",state:"reserved"}}),true);
 assert.equal(policy.hasCourierReservation({...safeBase,paymentStatus:"unpaid",
  lalamoveDispatchReservation:{id:"provider-post-unknown",state:"reserved"}}),true);
 assert.equal(policy.canCashierCancel({...safeBase,paymentStatus:"unpaid",status:"pending",
  lalamoveDispatchReservation:{id:"provider-post-unknown"}}),false);
 assert.equal(policy.canCashierCancel({...safeBase,paymentStatus:"unpaid",status:"pending",
  lalamoveWalletDebitPending:true}),false);
 assert.equal(hideCashierWholeOrderCancel({...safeBase,deliveryProvider:"other",
  lalamoveDispatchReservation:{id:"old-courier-reservation"}}),true);
 assert.equal(policy.hasCourierReservation({...safeBase,deliveryProvider:"other",
  lalamoveDispatchReservation:{id:"old-courier-reservation"}}),true);
 assert.equal(policy.canCashierCancel({...safeBase,paymentStatus:"unpaid",status:"pending",
  lalamoveOrderId:"completed",lalamoveOrderStatus:"COMPLETED"}),false);

 assert.equal(policy.canCashierCancel({...safeBase,paymentStatus:"unpaid",
  lalamoveOrderId:"123",lalamoveOrderStatus:"PICKED_UP"}),false);
});
test("P3.1 Source quote refresh requires renewed explicit fee approval, never retries uncertain provider jobs",async()=>{
 const now=Date.parse("2026-11-25T05:00:00Z");
 let quoteCalls=0,placeCalls=0;
 const source={...safeBase,lalamoveDispatchQuote:{expiresAt:new Date(now+60000).toISOString()}};
 const outcome=await placeWithFreshLalamoveQuote({
  order:source,approval:{approveDifference:false,approvedFee:59},
  now,forceRefresh:true,
  quote:async()=>{quoteCalls++;return {item:{quoteFee:61},order:{id:"x"}};},
  place:async()=>{placeCalls++;return {item:{lalamoveOrderId:"booked"}};},
  onQuote:()=>{},
 });
 assert.equal(outcome.kind,"priceChanged");
 assert.equal(quoteCalls,1);
 assert.equal(placeCalls,0);
 assert.equal(lalamoveFeeChanged(59,61),true);
 const unknown=new Error("LALAMOVE_DISPATCH_CONFIRMATION_UNKNOWN");
 await assert.rejects(placeWithFreshLalamoveQuote({
  order:source,approval:{approveDifference:false,approvedFee:59},
  now,quote:async()=>{quoteCalls++;return {item:{quoteFee:59},order:{id:"x"}};},
  onQuote:()=>{},
  place:async()=>{placeCalls++;throw unknown;},
 }),/LALAMOVE_DISPATCH_CONFIRMATION_UNKNOWN/);
 assert.equal(placeCalls,1);
});
test("P3.1 only exact pre-placement quotation expiry may retry once",async()=>{
 const now=Date.parse("2026-11-25T05:00:00Z");
 const source={...safeBase,lalamoveDispatchQuote:{expiresAt:new Date(now+60000).toISOString()}};
 let tries=0,quotes=0;
 const result=await placeWithFreshLalamoveQuote({
  order:source,approval:{approveDifference:false,approvedFee:59},
  now,quote:async()=>{quotes++;return {item:{quoteFee:59},order:{id:"x"}};},
  onQuote:()=>{},
  place:async()=>{tries++;if(tries===1)throw Object.assign(
   new Error("LALAMOVE_QUOTATION_EXPIRED"),{code:"FAILED_PRECONDITION"});
   return {item:{lalamoveOrderId:"booked"}};
  },
 });
 assert.equal(result.kind,"placed");
 assert.equal(tries,2);
 assert.equal(quotes,1);
});
test("P3.1 physical paid Takeaway stays in queue until handed over, and handing over never grants payment",()=>{
 const t={orderType:"takeaway",paymentStatus:"paid",status:"served",pickupStatus:"called"};
 assert.equal(paidTakeawayAwaitingHandover(t),true);
 assert.equal(policy.canCashierHandlePickup(t,"handover"),true);
 assert.equal(policy.canCashierHandlePickup({...t,paymentStatus:"unpaid"},"handover"),false);
 assert.equal(policy.canCashierHandlePickup({...t,pickupStatus:"picked_up"},"handover"),false);
 assert.equal(paidTakeawayAwaitingHandover({...t,pickupStatus:"picked_up"}),false);
});
test("P3.1 cashback eligibility denies slip/bank/LINE/COD, mixed-currency/invalid funds and paid states",()=>{
 const base={orderType:"takeaway",paymentStatus:"unpaid",status:"pending",
  paymentMethod:"cash",totalAmount:450,items:[{name:"rice",qty:2,price:225}]};
 assert.equal(policy.canCashierReceiveCash(base),true);
 for(const patch of [
  {paymentMethod:"promptpay"},{paymentMethod:"cod"},{paymentMethod:"stripe_connect"},
  {bankTransferReviewFlow:"notification_first"},{paymentSlipPath:"tenants/a/receipt.png"},
  {slipEvidenceSha256:"proof"},{companionKitchenRelease:{status:"admitted_unverified"}},
  {paymentStatus:"paid"},{status:"cancelled"},{status:"delivered"},
  {totalAmount:-1},{totalAmount:NaN},{totalAmount:"450"},{totalAmount:450.001},
 ]){
  assert.equal(policy.canCashierReceiveCash({...base,...patch}),false,
   JSON.stringify(patch));
 }
});
test("P3.1 server cancellation refuses active kitchen/paid/review, accepts only unpaid untouched orders",()=>{
 const base={orderType:"takeaway",paymentStatus:"unpaid",paymentMethod:"cash",
  status:"pending",items:[{name:"rice",served:false}]};
 assert.equal(policy.canCashierCancel(base),true);
 for(const patch of [{paymentStatus:"paid"},{status:"accepted"},{status:"cooking"},
  {paymentSlipUrl:"https://example.test/slip"},{paymentMethod:"promptpay"},
  {paymentMethod:"cod"},{companionKitchenRelease:{}},
  {bankTransferReviewFlow:"notification_first"},{items:[{served:true}]},
  {items:[{cooking:true}]},{orderType:"walkin"}])
  assert.equal(policy.canCashierCancel({...base,...patch}),false,JSON.stringify(patch));
 assert.equal(policy.canCashierCancel({...base,orderType:"delivery",deliveryProvider:"lalamove",
  lalamoveDispatchStatus:"confirmation_unknown"}),false);
});
test("P3.1 original vs new amount and delivery discount are display-only, not financial mutations",()=>{
 const item={name:"rice",originalName:"rice",originalQty:3,originalLineTotal:300,
  qty:2,price:100};
 assert.deepEqual(originalItemRevision(item).amount,300);
 assert.equal(originalNetRevision({totalAmount:200,originalTotalAmount:300}),300);
 assert.deepEqual(deliveryReceiptTotals({subtotalAmount:500,deliveryFee:50,
  deliveryPromotionDiscount:30,totalAmount:520}),{
   food:500,deliveryFee:50,beforeDiscount:550,discount:30});
});
test("P3.1 latest Source JSX rewires cash/pickup/cancel to signed Firebase; provider settlement is not client-attested",()=>{
 const page=read("react-app/src/pages/CashierPage.jsx");
 const data=read("react-app/src/data/operationalData.js");
 const backend=read("functions/operational-orders.js");
 const sourceComponents=["DeliveryOrderHeading","CashierLalamoveFieldset",
  "CashierSafeOrderActions","TelegramOrderFocus","OriginalItemLine",
  "RevisedOrderNet"];
 for(const name of sourceComponents)assert.ok(page.includes(name),name);
 for(const name of ["cashierRecordCashReceipt","cashierPickupAction","cashierCancelOrderSafely"]){
  assert.match(page,new RegExp(name+"\\(")); // real path
  assert.ok(data.includes("httpsCallable(functions, "+JSON.stringify(name)+")"),name);
  assert.match(backend,new RegExp("exports\\."+name+" = onCall|exports\\."+name+"=onCall"));
 }
 assert.match(page,/order\.orderType === "takeaway" && order\.pickupStatus === "picked_up"/);
 assert.match(page,/placeWithFreshLalamoveQuote/);
 assert.match(page,/forceRefresh:true/);
 assert.match(page,/getOperationalOrderFromServer/);
 assert.doesNotMatch(page,/const legacyCodBackfill/);
 assert.doesNotMatch(page,/tableSettlementRepairRef/);
 assert.doesNotMatch(page,/cashier-cod-settlement-action/);
 assert.doesNotMatch(page,/patch\.paymentStatus\s*=\s*"paid"/);
 assert.match(backend,/cashierActionAudit/);
});
