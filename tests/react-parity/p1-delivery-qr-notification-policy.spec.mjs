import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const p=require("../../functions/delivery-qr-notify-policy.js");
const base={orderType:"delivery",paymentQrMode:"confirmed_order_5m",paymentMethod:"promptpay",
 paymentStatus:"pending_verification",status:"pending"};
test("confirmed order QR never sends legacy immediate cashier alert",()=>{
 assert.equal(p.suppressCreated(base),true);
 assert.equal(p.suppressCreated({...base,paymentMethod:"cod"}),false);
 assert.equal(p.suppressCreated({...base,paymentQrMode:"legacy"}),false);
 assert.equal(p.suppressCreated({...base,paymentStatus:"paid"}),false);
 const source=readFileSync("functions/index.js","utf8");
 assert.match(source,/deliveryQrNotify\.suppressCreated\(order\)/);
 assert.match(source,/exports\.notifyCompanionQrCashierReview/);
});
test("only audited UAT kitchen or original-slip review transitions notify cashier",()=>{
 const uat={...base,companionKitchenRelease:{status:"admitted_unverified",
  bankConfirmed:false,paymentVerified:false,canDispatchRider:false}};
 assert.equal(p.cashierEvent(base,uat),"uat_kitchen");
 assert.equal(p.cashierEvent(base,{...uat,companionKitchenRelease:{...uat.companionKitchenRelease,paymentVerified:true}}),"");
 assert.equal(p.cashierEvent(uat,uat),"");
 const slip={...base,paymentQrSlipFallbackStatus:"submitted",paymentReviewRequired:true,
  slipCheckStatus:"manual_review",paymentSlipPath:"tenants/t/payment-slips/o/original.png"};
 assert.equal(p.cashierEvent(base,slip),"original_slip");
 assert.equal(p.cashierEvent(slip,slip),"");
 assert.equal(p.cashierEvent(base,{...slip,slipCheckStatus:"matched"}),"");
 assert.equal(p.cashierEvent(base,{...slip,paymentStatus:"paid"}),"");
 assert.equal(p.cashierEvent(null,slip),"");
});
