import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const p=require("../../functions/delivery-notification-intake");
const {__test:backend}=require("../../functions/public-delivery-submit");
const {kitchenAdmitted,proofBoundToOrder}=require("../../functions/delivery-slip-policy");
const id="p34-notify-tenant",now=Date.now();
const snap=data=>({exists:true,data:()=>data,updateTime:{seconds:1,nanoseconds:2}});
const store={deliveryProvider:"self",deliveryPromptPayEnabled:true,storeLatitude:13.75,storeLongitude:100.5,
 bankName:"SCB",bankAccountName:"DEMO",bankAccountNumber:"0000000000",promptPayId:"0800000000",
 deliveryFeeOptions:[{id:"nearby",label:"Near",fee:30,maxDistanceKm:5}]};
const menu=snap({name:"Canonical",price:120,active:true});
const order={id:"p34-order-000001",orderType:"delivery",paymentMethod:"promptpay",
 bankTransferReviewFlow:"notification_first",paymentRecipientId:"0800000000",
 recipientName:"Demo",recipientPhone:"0800000000",deliveryAddress:"Demo",deliveryProvider:"self",
 deliveryLatitude:13.76,deliveryLongitude:100.51,deliveryZone:"nearby",deliveryBaseFee:30,
 subtotalAmount:120,totalAmount:150,deliveryFee:30,deliveryFeeDiscount:0,
 items:[{menuId:"menu-000001",name:"FORGED",price:120,qty:1,note:"demo",extra:"bad"}]};
const route={tenantId:id,origin:{latitude:13.75,longitude:100.5},
 destination:{latitude:13.76,longitude:100.51},distanceMeters:2000,duration:"300s",
 updatedAt:{toMillis:()=>now-1000}};
const canonical=(o=order,s=store,r=route,docs=[menu])=>p.canonical(id,snap(s),o,docs,snap(r),now);
test("notification intake is strictly isolated to the demo project, emulator host and fixture tenant",()=>{
 const env={FUNCTIONS_EMULATOR:"true",GCLOUD_PROJECT:"demo-penguin-hybrid",FIRESTORE_EMULATOR_HOST:"127.0.0.1:8189"};
 assert.equal(p.demoEnabled(id,env),true);
 for(const patch of [{GCLOUD_PROJECT:"production"},{FUNCTIONS_EMULATOR:"false"},{FIRESTORE_EMULATOR_HOST:"remote:8189"}])
  assert.equal(p.demoEnabled(id,{...env,...patch}),false);
 assert.equal(p.demoEnabled("real-tenant-0001",env),false);
});
test("canonical self delivery rebuilds items and locks amount, receiver, route, no paid status",()=>{
 const row=canonical();
 assert.equal(row.items[0].name,"Canonical");
 assert.equal(row.items[0].extra,undefined);
 assert.equal(row.totalAmount,150);
 assert.equal(row.paymentRecipientId,"0800000000");
 assert.match(row.paymentReceiverRevision,/^[a-f0-9]{64}$/);
 assert.equal(row.bankTransferReviewFlow,"notification_first");
 assert.equal(row.paymentSlipPath,"");
 assert.equal(row.paymentStatus,undefined);
 assert.equal(kitchenAdmitted({...row,orderType:"delivery",paymentMethod:"promptpay",paymentStatus:"pending_verification"}),false);
 assert.match(p.routeKey(id,store,order),/^p34-notify-tenant_13\.75000_/);
});
test("reject changed price, total, duplicated/hidden items, wrong zone, receiver, stale route and distance overflow",()=>{
 for(const [o,s,r,d] of [
  [{...order,items:[{...order.items[0],price:1}]},store,route,[menu]],
  [{...order,totalAmount:149},store,route,[menu]],
  [{...order,items:[order.items[0],order.items[0]],subtotalAmount:240},store,route,[menu,menu]],
  [order,store,route,[snap({name:"Hidden",price:120,hidden:true})]],
  [{...order,deliveryZone:"far"},store,route,[menu]],
  [{...order,paymentRecipientId:"0899999999"},store,route,[menu]],
  [order,store,{...route,updatedAt:{toMillis:()=>now-86400001}},[menu]],
  [order,store,{...route,tenantId:"foreign"},[menu]],
  [order,{...store,deliveryMaxDistanceKm:1},route,[menu]],
  [order,store,{...route,destination:{latitude:13.760001,longitude:100.51}},[menu]],
  [order,{...store,storeLatitude:0,storeLongitude:0},route,[menu]],
 ]) assert.throws(()=>canonical(o,s,r,d),/DELIVERY_NOTIFICATION|QR_PAYEE/);
});
test("free shipping is server-derived; gift promotions fail closed",()=>{
 const s={...store,deliveryPromotion:{freeShipping:{enabled:true,minimumSubtotal:100}}};
 const o={...order,deliveryFee:0,totalAmount:120,deliveryFeeDiscount:30,freeShippingApplied:true};
 assert.equal(canonical(o,s).deliveryFee,0);
 assert.throws(()=>canonical(order,s),/TOTAL_CHANGED/);
 assert.throws(()=>canonical(order,{...store,deliveryPromotion:{freeGift:{enabled:true}}}),/GIFT_NOT_PORTED/);
});
test("Lalamove quote identity, expiry and coordinates are canonical, not browser dispatch data",()=>{
 const s={...store,deliveryProvider:"lalamove"};
 const o={...order,deliveryProvider:"lalamove",deliveryZone:"lalamove",lalamoveQuotationId:"quote-00001",
  lalamoveDispatchQuote:{fee:1},lalamoveCodEnabled:true};
 const q={tenantId:id,quotationId:"quote-00001",paymentMethod:"promptpay",latitude:13.76,longitude:100.51,
  fee:30,expiresAt:new Date(now+120000).toISOString()};
 const row=canonical(o,s,q);
 assert.equal(row.lalamoveCodEnabled,false);
 assert.equal(row.lalamoveDispatchQuote,undefined);
 assert.throws(()=>canonical(o,s,{...q,expiresAt:new Date(now+5000).toISOString()}),/QUOTE_INVALID/);
 assert.throws(()=>canonical(o,s,{...q,paymentMethod:"cod"}),/QUOTE_INVALID/);
 assert.throws(()=>canonical(o,{...s,deliveryMaxDistanceKm:5},q),/QUOTE_INVALID/);
});
test("public submission forbids mixed QR/slip/COD and leaves legacy receipt gate intact",()=>{
 assert.equal(backend.validateSubmission({tenantId:id,order}).id,order.id);
 for(const patch of [{paymentQrMode:"confirmed_order_5m"},{paymentSlipPath:"x"},
  {slipCheckStatus:"matched"},{paymentReviewRequired:true},{paymentMethod:"cod"},
  {paymentRecipientId:"invalid"},{deliveryProvider:"lalamove",lalamoveQuotationId:"../bad"},
  {bankTransferReviewFlow:"invalid"}])
  assert.throws(()=>backend.validateSubmission({tenantId:id,order:{...order,...patch}}));
 assert.throws(()=>backend.validateSubmission({tenantId:id,order:{...order,bankTransferReviewFlow:undefined}}));
 const rules=readFileSync("firestore.rules","utf8");
 assert.match(rules,/allow update: if resource\.data\.get\('bankTransferReviewFlow', ''\) != 'notification_first'/);
 assert.match(rules,/allow delete: if resource\.data\.get\('bankTransferReviewFlow', ''\) != 'notification_first'/);
});

test("new flow cannot reuse legacy settlement, manual approval or advisory matching",()=>{
 const row={...canonical(),orderType:"delivery",paymentMethod:"promptpay",paymentStatus:"pending_verification",paymentSlipPath:"demo.png"};
 const proof={slipPath:"demo.png",foodCents:12000,feeCents:3000,amountCents:15000,
  itemsSignature:JSON.stringify([{id:"menu-000001",qty:1,priceCents:12000}])};
 assert.equal(proofBoundToOrder({...row,bankTransferReviewFlow:undefined},proof),true);
 assert.equal(proofBoundToOrder(row,proof),false);
 assert.match(readFileSync("functions/payment-companion.js","utf8"),/o.bankTransferReviewFlow==="notification_first"/);
});
