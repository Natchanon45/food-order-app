import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {createHmac} from "node:crypto";
const require=createRequire(import.meta.url);
const life=require("../../functions/m7-stripe-test-lifecycle-policy.js");
const stripe=require("../../functions/m7-stripe-test-provider-policy.js");
const invoiceId="2026-11-22:monthly:fixed",
 attemptId="abcdef12-1234-1234-1234-123456789abc",
 sessionId="cs_test_1234567890abcdef",intentId="pi_1234567890abcdef";
const metadata={purpose:stripe.PURPOSE,tenantId:"tenant-demo-uat-1",
 invoiceId,invoiceSignature:"a".repeat(64),attemptId,kind:"monthly"};
const record={...metadata,amountSatang:39900,currency:"THB",
 mode:"test",status:"checkout_ready",providerCheckoutCreated:true,checkoutSessionId:sessionId};
const expired={id:sessionId,status:"expired",payment_status:"unpaid",mode:"payment",
 livemode:false,currency:"thb",amount_total:39900,metadata,client_reference_id:attemptId,
 payment_method_types:["promptpay"],payment_intent:null};
const failed={...expired,status:"complete",payment_intent:intentId};
const intent={id:intentId,livemode:false,currency:"thb",amount:39900,
 amount_received:0,status:"requires_payment_method",metadata};
const hook="whsec_"+("B".repeat(48)),at=1763800000;
function signed(type,session,override={}){
 const e={id:"evt_1234567890abcdef",livemode:false,type,
  data:{object:{...session}},...override};
 const raw=Buffer.from(JSON.stringify(e));
 const header="t="+at+",v1="+createHmac("sha256",hook).update(at+".").update(raw).digest("hex");
 return {raw,header,secret:hook,nowSeconds:at};
}
test("terminal unpaid events must be independently linked to exact TEST invoice and amount",()=>{
 assert.equal(life.terminalUnpaid("checkout.session.expired",record,expired,null),true);
 assert.equal(life.terminalUnpaid("checkout.session.async_payment_failed",record,failed,intent),true);
 assert.equal(life.inspect(record,{...expired,status:"open"},null),"awaiting_payment");
 assert.equal(life.inspect(record,expired,null),"provider_expired_unpaid");
 assert.equal(life.inspect(record,failed,intent),"provider_failed_unpaid");
 for(const invalid of [
  {session:{...expired,amount_total:39901}},
  {session:{...expired,livemode:true}},
  {session:{...expired,currency:"usd"}},
  {session:{...expired,client_reference_id:"another"}},
  {session:{...expired,metadata:{...metadata,invoiceSignature:"b".repeat(64)}}},
  {session:{...expired,payment_status:"paid"}},
  {session:{...expired,payment_intent:intentId},intent:{...intent,status:"succeeded",amount_received:39900}},
  {record:{...record,checkoutSessionId:"cs_test_9876543210abcdef"}},
 ]){
  assert.equal(life.terminalUnpaid("checkout.session.expired",
   invalid.record||record,invalid.session||expired,invalid.intent??null),false);
 }
 assert.equal(life.terminalUnpaid("checkout.session.expired",record,failed,intent),false);
 assert.equal(life.terminalUnpaid("checkout.session.async_payment_failed",record,expired,null),false);
 assert.equal(life.terminalUnpaid("checkout.session.async_payment_failed",
   record,failed,{...intent,amount_received:1}),false);
});
test("signed lifecycle envelope is not a settlement; malformed/hijacked metadata and stale signed event refused",()=>{
 const e=signed("checkout.session.expired",expired);
 const hint=life.verifiedEnvelope(e);
 assert.equal(hint.eventId,"evt_1234567890abcdef");
 assert.equal(hint.attemptId,attemptId);
 assert.equal(hint.invoiceSignature,metadata.invoiceSignature);
 assert.equal(hint.kind,"monthly");
 assert.equal(hint.providerVerified,false);
 assert.equal(hint.invoicePaid,false);
 assert.equal(life.verifiedEnvelope({...e,nowSeconds:at+301}),null);
 assert.equal(life.verifiedEnvelope({...e,header:"t="+at+",v1="+("0".repeat(64))}),null);
 assert.equal(life.verifiedEnvelope(signed("checkout.session.completed",expired)),null);
 assert.equal(life.verifiedEnvelope(signed("checkout.session.expired",expired,{
  livemode:true})),null);
 assert.equal(life.verifiedEnvelope(signed("checkout.session.expired",{
  ...expired,metadata:{...metadata,tenantId:"../../another"}})),null);
 assert.equal(life.verifiedEnvelope(signed("checkout.session.expired",{
  ...expired,metadata:{...metadata,invoiceSignature:"forged"}})),null);
});
test("browser inspection is advisory, never invoice Paid or canRetry=true",()=>{
 for(const state of ["awaiting_payment","awaiting_signed_webhook","provider_expired_unpaid",
  "provider_failed_unpaid","needs_review","provider_request_uncertain",
  "already_recorded_test","provider_risk_review"]){
  const res=life.publicInspection(record,state);
  assert.equal(res.operationalInvoicePaid,false);
  assert.equal(res.serviceCreditChanged,false);
  assert.equal(res.canRetry,false);
  assert.equal(res.providerTestModeOnly,true);
  assert.equal(res.amountSatang,39900);
  assert.equal(res.status,state);
 }
 assert.throws(()=>life.publicInspection(record,"paid"),/INSPECTION_INVALID/);
 assert.throws(()=>life.publicInspection(record,"refunded"),/INSPECTION_INVALID/);
});
