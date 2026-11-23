import test from "node:test";
import assert from "node:assert/strict";
import {deliverySuccessCustomerState as view} from "../../react-app/src/utils/deliverySuccessCustomerState.js";
const base={id:"doc-orig-0123456",billNo:"B261123-00017",status:"pending",
  paymentMethod:"promptpay",paymentStatus:"pending_verification"};
test("confirmed QR waiting for bank evidence keeps order receipt hidden, no false Paid or new Stripe action",()=>{
 const r=view({...base,paymentQrMode:"confirmed_order_5m"},{sandboxBadge:true});
 assert.equal(r.orderReceived,false);
 assert.equal(r.hideToolbar,true);
 assert.equal(r.hideReceipt,true);
 assert.equal(r.verifiedPaid,false);
 assert.equal(r.showSandboxBadge,false);
 assert.equal(r.canResumeStripe,false);
 assert.equal(r.bankStatementIndependentlyVerified,false);
});
test("admitted kitchen without bank proof can acknowledge order but cannot claim payment",()=>{
 const r=view({...base,status:"accepted",companionKitchenRelease:{status:"admitted_unverified"}});
 assert.equal(r.orderReceived,true);
 assert.equal(r.note.includes("ยังไม่ยืนยัน"),true);
 assert.equal(r.badge,"PromptPay QR · รอตรวจสอบยอด");
 assert.equal(r.verifiedPaid,false);
 assert.equal(r.paymentNeedsReview,true);
 assert.equal(r.billNo,base.billNo);
});
test("server-recorded paid PromptPay shows unified green card with correct method, never a sandbox badge",()=>{
 const r=view({...base,status:"accepted",paymentStatus:"paid"},{sandboxBadge:true});
 assert.equal(r.orderReceived,true);
 assert.equal(r.title,"รับคำสั่งซื้อสำเร็จ");
 assert.equal(r.badge,"ชำระผ่าน PromptPay QR");
 assert.equal(r.verifiedPaid,true);
 assert.equal(r.hideToolbar,false);
 assert.equal(r.showSandboxBadge,false);
 assert.equal(r.payment,"promptpay");
});
test("Stripe pending, failed, expired and cancelled never show green success or create new checkout",()=>{
 for(const status of ["pending_verification","unpaid","failed","expired","rejected","cancelled"]){
  const r=view({...base,paymentMethod:"stripe_connect",paymentStatus:status,status:"accepted"},
    {sandboxBadge:true});
  assert.equal(r.orderReceived,false,status);
  assert.equal(r.hideToolbar,true,status);
  assert.equal(r.hideReceipt,true,status);
  assert.equal(r.canResumeStripe,false,status);
  assert.equal(r.showSandboxBadge,true,status);
  assert.equal(r.stripePending||r.stripeFailed,true,status);
 }
 const cancelledPaid=view({...base,paymentMethod:"stripe_connect",paymentStatus:"paid",status:"cancelled"});
 assert.equal(cancelledPaid.orderReceived,false);
});
test("only signed-in order document Paid field yields Stripe paid presentation; badge environment is cosmetic",()=>{
 const order={...base,paymentMethod:"stripe_connect",paymentStatus:"paid",status:"accepted"};
 const uat=view(order,{sandboxBadge:true});
 const live=view(order,{sandboxBadge:false});
 for(const v of [uat,live]){
  assert.equal(v.orderReceived,true);
  assert.equal(v.badge,"ชำระผ่าน Stripe");
  assert.equal(v.verifiedPaid,true);
  assert.equal(v.bankStatementIndependentlyVerified,false);
 }
 assert.equal(uat.showSandboxBadge,true);
 assert.equal(live.showSandboxBadge,false);
});
test("COD and manually accepted PromptPay never become bank-paid by showing receipt",()=>{
 const cod=view({...base,paymentMethod:"cod",paymentStatus:"unpaid",status:"accepted"});
 assert.equal(cod.orderReceived,true);
 assert.match(cod.badge,/ยังไม่ชำระ/);
 assert.equal(cod.verifiedPaid,false);
 assert.equal(cod.showSandboxBadge,false);
 const codPaid=view({...base,paymentMethod:"cod",paymentStatus:"paid",status:"served"});
 assert.equal(codPaid.badge,"เก็บเงินปลายทาง · ชำระแล้ว");
 assert.equal(codPaid.bankStatementIndependentlyVerified,false);
 const pending=view({...base,paymentStatus:"pending_verification",status:"pending"});
 assert.equal(pending.orderReceived,false);
 assert.equal(pending.hideToolbar,false);
});
test("input from public order is safely reduced to sanitized bill label",()=>{
 const r=view({id:"0000000unsafe +<script>alert(1)</script>",
  billNo:"<script>",status:"accepted",paymentStatus:"unpaid",paymentMethod:"promptpay"});
 assert.equal(r.billNo.includes("<"),false);
 assert.equal(r.billNo.includes("script>"),false);
 assert.equal(r.verifiedPaid,false);
});
