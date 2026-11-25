import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const k=require("../../functions/kitchen-order-policy.js");
const read=name=>readFileSync(new URL("../../"+name,import.meta.url),"utf8");
const base={orderType:"delivery",deliveryProvider:"lalamove",status:"pending",
 paymentMethod:"promptpay",paymentStatus:"paid",totalAmount:354,deliveryFee:59,
 subtotalAmount:295,items:[{name:"rice",qty:1,price:295,menuId:"rice"}]};
const table={...base,orderType:"table",deliveryProvider:"",paymentMethod:"cash",
 deliveryFee:0,totalAmount:295};
test("P3.2 Kitchen requires canonical paid delivery or strictly limited unverified merchant-risk release",()=>{
 assert.equal(k.admitted(base),true);
 assert.equal(k.admitted({...base,paymentStatus:"pending_verification"}),false);
 const pending={...base,paymentStatus:"pending_verification",
  paymentQrMode:"confirmed_order_5m",paymentQrSlipFallbackStatus:"not_required",
  companionKitchenRelease:{status:"admitted_unverified",bankConfirmed:false,
   paymentVerified:false,canDispatchRider:false}};
 assert.equal(k.admitted(pending),true);
 for(const patch of [{paymentSlipPath:"tenants/abc/slip.png"},
  {companionKitchenRelease:{...pending.companionKitchenRelease,bankConfirmed:true}},
  {companionKitchenRelease:{...pending.companionKitchenRelease,canDispatchRider:true}},
  {paymentQrSlipFallbackStatus:"required"},
  {paymentMethod:"cod"},{paymentQrMode:"unknown"}]){
  assert.equal(k.admitted({...pending,...patch}),false,JSON.stringify(patch));
 }
 assert.equal(k.admitted({...base,paymentMethod:"cod"}),false);
});
test("P3.2 Kitchen locks real Lalamove reservation BEFORE provider POST",()=>{
 for(const patch of [
  {lalamoveDispatchReservation:{id:"reserved"},lalamoveOrderId:""},
  {lalamoveWalletDebitPending:true},
  {lalamoveOrderId:"job",lalamoveOrderStatus:"ASSIGNING_DRIVER"},
  {lalamoveShareLink:"https://example.test/provider"},
  {lalamoveOrderStatus:"ON_GOING"},
 ]){
  assert.equal(k.locked({...base,...patch}),true,JSON.stringify(patch));
  assert.equal(k.eligible({...base,...patch},"cancel_order"),false);
 }
 assert.equal(k.locked({...base,deliveryProvider:"self",
  lalamoveDispatchReservation:{id:"unknown-old-job"}}),true);
 assert.equal(k.locked({...base,deliveryProvider:"self",
  lalamoveDispatchAttemptState:"confirmation_unknown"}),true);
 for(const done of ["CANCELED","CANCELLED","REJECTED","EXPIRED"]){
  assert.equal(k.locked({...base,lalamoveOrderId:"old-confirmed-job",
   lalamoveOrderStatus:done}),false,
   "Definitively terminated courier jobs unlock Kitchen when no reserve remains");
  assert.equal(k.locked({...base,lalamoveOrderId:"old-confirmed-job",
   lalamoveOrderStatus:done,lalamoveDispatchReservation:{id:"new-reserved-job"}}),
   true,"A new pending reservation overrides old terminal status");
 }
 assert.equal(k.eligible({...base,paymentStatus:"pending_verification"},"status"),false);
});
test("P3.2 Kitchen status transitions strictly follow pending→accepted→cooking→ready→served; Lalamove never served by kitchen",()=>{
 const statuses=["pending","accepted","cooking","ready","served"];
 for(let i=0;i<4;i++){
  const t={...table,status:statuses[i]};
  assert.equal(k.validateStatus(t,statuses[i+1]),true);
  assert.equal(k.validateStatus(t,i<3?statuses[i+2]:"ready"),false);
 }
 assert.equal(k.validateStatus({...base,status:"ready"},"served"),false);
 assert.equal(k.validateStatus({...table,status:"paid"},"served"),false);
 assert.equal(k.validateStatus({...table,status:"pending",
  waitingQueueId:"waiting",items:[],totalAmount:0},"accepted"),false);
});
test("P3.2 Kitchen individual item serving requires ready Table; edits/cancels cannot target dispatch-active or cancelled items",()=>{
 assert.equal(k.itemEligible({...table,status:"ready"},0,"serve_item"),true);
 assert.equal(k.itemEligible({...table,status:"cooking"},0,"serve_item"),false);
 assert.equal(k.itemEligible({...base,status:"ready"},0,"serve_item"),false);
 assert.equal(k.itemEligible({...table,status:"ready",items:[{...table.items[0],served:true}]},0,"serve_item"),false);
 assert.equal(k.itemEligible({...table,status:"ready",items:[{...table.items[0],cancelled:true}]},0,"edit_item"),false);
 assert.equal(k.itemEligible({...table,status:"ready",lalamoveDispatchReservation:{id:"job"}},0,"cancel_item"),false);
 assert.equal(k.itemEligible({...table,status:"ready"},-1,"edit_item"),false);
});
test("P3.2 Kitchen calculates exact THB satang and discounts without inferring an external refund",()=>{
 assert.deepEqual(k.nextFinancials({...base,deliveryPromotionDiscount:30},
  [{qty:1,price:295},{qty:1,price:100}]),{
  subtotalAmount:395,deliveryFee:59,deliveryPromotionDiscount:30,totalAmount:424});
 assert.deepEqual(k.nextFinancials(table,[{qty:2,price:25.5}]),{
  subtotalAmount:51,deliveryFee:0,deliveryPromotionDiscount:0,totalAmount:51});
 assert.throws(()=>k.nextFinancials(table,[{qty:1,price:NaN}]),/KITCHEN_INVALID_ITEM_PRICE/);
 assert.throws(()=>k.nextFinancials(table,[{qty:1,price:12.012}]),/KITCHEN_INVALID_ITEM_PRICE/);
 assert.deepEqual(k.nextFinancials({...base,deliveryPromotionDiscount:30},[]),{
  subtotalAmount:0,deliveryFee:0,deliveryPromotionDiscount:0,totalAmount:0});
});
test("P3.2 final Kitchen JSX ports Source bill, revised net, payment caveats and frontend status lock",()=>{
 const page=read("react-app/src/pages/KitchenPage.jsx");
 for(const item of ["DeliveryOrderHeading","OriginalItemLine","RevisedOrderNet",
  "deliveryReceiptTotals","TelegramOrderFocus",
  "kitchen-source-safe-actions.css","kitchen-source-delivery-heading.css",
  "kitchenFinanceReviewRequired","lalamoveDispatchReservation?.id"])
  assert.ok(page.includes(item),item);
 assert.ok(page.includes("runKitchenAction(order,\"cancel_order\")"));
 assert.ok(page.includes("isWaitingQueuePlaceholder(order)"));
 assert.ok(page.includes('["placing","confirmation_unknown","placed"].includes(attempt)'));
 assert.ok(page.includes("KITCHEN_CANCELLED_TABLE_SETTLEMENT_PENDING"));
 assert.ok(page.includes("runKitchenAction(order,\"serve_item\",{index})"));
 assert.ok(page.includes("runKitchenAction(order,\"edit_item\""));
 assert.ok(page.includes("runKitchenAction(order,\"status\",{status})"));
 for(const item of ["KITCHEN_TABLE_SETTLEMENT_REPAIR_FAILED",
  "KITCHEN_LALAMOVE_COMPLETION_REPAIR_FAILED",
  "await updateOrder(order.id, patch)","await cancelOperationalOrder("])
  assert.equal(page.includes(item),false,item);
});
test("P3.2 Kitchen canonical transaction protects original paid amount, never attests refund or bank deposit",()=>{
 const fn=read("functions/operational-orders.js");
 const action=fn.slice(fn.indexOf("exports.kitchenApplyOrderAction=onCall"));
 assert.ok(action.startsWith("exports.kitchenApplyOrderAction=onCall"));
 for(const item of ["callerContext(request,KITCHEN_SIGNED_ROLES)",
  "tx.get(ref)","tx.get(auditRef)","tx.get(menuRef)",
  "KITCHEN_ORDER_REVISION_CHANGED","KITCHEN_ORDER_PAYMENT_OR_STATUS_CHANGED",
  "KITCHEN_MENU_INACTIVE","KITCHEN_EDIT_NOTE_REQUIRED",
  "KITCHEN_TENANT_NOT_ACTIVE",
  "kitchenRevisedTotals","kitchenFinanceReviewRequired",
  "kitchenActionAudit","FieldValue.serverTimestamp()"])
  assert.ok(action.includes(item),item);
 assert.ok(action.includes('const KITCHEN_SIGNED_ROLES=new Set(["owner","admin","kitchen"])') ||
  fn.includes('const KITCHEN_SIGNED_ROLES=new Set(["owner","admin","kitchen"])'));
 for(const item of ["patch.paymentStatus=","patch.paidAt=","refundAmount=",
  "patch.bankConfirmed="])
  assert.equal(action.includes(item),false,item);
 assert.ok(action.includes("if(paid){"));
 assert.ok(action.includes("patch.originalTotalAmount="));
 assert.ok(action.includes("tx.create(auditRef"));
 assert.ok(action.includes("old.expectedRevision!==revision"));
});
test("P3.2 Firestore denies direct kitchen user order writes, requiring signed transaction",()=>{
 const rules=read("firestore.rules");
 assert.ok(rules.includes("tenantCashierRole(tenantId) || tenantAdminRole(tenantId)"));
 assert.equal(rules.includes("tenantKitchenRole(tenantId) && request.resource.data.get('paymentStatus'"),false);
 assert.equal(rules.includes("cashierRole() || kitchenRole() || adminRole()"),false);
 assert.ok(read("react-app/src/data/operationalData.js").includes(
  'httpsCallable(functions, "kitchenApplyOrderAction")'));
 assert.ok(read("functions/index.js").includes(
  "exports.kitchenApplyOrderAction = operationalOrders.kitchenApplyOrderAction;"));
});
