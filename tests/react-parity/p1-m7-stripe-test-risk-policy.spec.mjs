import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {createHmac} from "node:crypto";
const require=createRequire(import.meta.url);
const p=require("../../functions/m7-stripe-test-risk-policy.js");
const adapter=require("../../functions/m7-stripe-test-provider-adapter.js");
const secret="whsec_"+("A".repeat(48)),when=1763800000;
const refund={id:"ch_1234567890abcDEF",object:"charge",livemode:false,
 amount:39900,amount_refunded:12000,currency:"thb",
 payment_intent:"pi_1234567890abcDEF",refunded:false};
const dispute={id:"dp_1234567890abcDEF",object:"dispute",livemode:false,
 charge:refund.id,amount:9950,currency:"thb",status:"needs_response"};
function sign(type,body,over={}){
 const event={id:"evt_1234567890abcDEF",type,livemode:false,
  data:{object:body},...over};
 const raw=Buffer.from(JSON.stringify(event));
 const header="t="+when+",v1="+createHmac("sha256",secret).update(when+".").update(raw).digest("hex");
 return {event,raw,header,secret,nowSeconds:when};
}
test("charge.refunded must be a signed Stripe TEST event; issuer metadata alone never proves refund",()=>{
 const signed=sign("charge.refunded",refund),hint=p.envelope(signed);
 assert.equal(hint.status,"refund_review");
 assert.equal(hint.providerVerified,false);
 assert.equal(hint.financialChange,false);
 const proof=p.evidence({hint,event:signed.event,charge:refund});
 assert.equal(proof.intentId,refund.payment_intent);
 assert.equal(proof.reversedSatang,12000);
 assert.equal(proof.operationalInvoicePaid,false);
 assert.equal(p.envelope({...signed,nowSeconds:when+301}),null);
 assert.equal(p.envelope({...signed,header:"t=1,v1="+("0".repeat(64))}),null);
 assert.equal(p.envelope(sign("charge.succeeded",refund)),null);
 assert.equal(p.envelope(sign("charge.refunded",{...refund,livemode:true})),null);
 assert.equal(p.envelope(sign("charge.refunded",{...refund,id:"fake_charge"})),null);
 for(const bad of [
  {...refund,amount_refunded:0},{...refund,amount_refunded:39901},
  {...refund,currency:"usd"},{...refund,livemode:true},
  {...refund,payment_intent:"pi_invalid"},
 ]){
  assert.equal(p.evidence({hint,event:signed.event,charge:bad}),null);
 }
});
test("dispute.created must be independently re-read, charge must match dispute and payment intent",()=>{
 const signed=sign("charge.dispute.created",dispute),hint=p.envelope(signed);
 assert.equal(hint.status,"dispute_review");
 const proof=p.evidence({hint,event:signed.event,charge:refund,dispute});
 assert.equal(proof.reversedSatang,9950);
 assert.equal(proof.chargeId,refund.id);
 for(const forged of [
  {...dispute,charge:"ch_9876543210abcDEF"},
  {...dispute,amount:39901},
  {...dispute,currency:"usd"},{...dispute,livemode:true},
  {...dispute,id:"dp_9876543210abcDEF"},
 ]){
  assert.equal(p.evidence({hint,event:signed.event,charge:refund,dispute:forged}),null);
 }
 assert.equal(p.evidence({hint,event:signed.event,charge:refund,dispute:null}),null);
 assert.equal(p.envelope(sign("charge.dispute.created",{...dispute,object:"charge"})),null);
});
test("fixed-origin Stripe TEST transport permits only read-only charges/disputes endpoints",()=>{
 assert.equal(adapter.safePath("/v1/charges/"+refund.id,"GET"),true);
 assert.equal(adapter.safePath("/v1/disputes/"+dispute.id,"GET"),true);
 assert.equal(adapter.safePath("/v1/charges/"+refund.id,"POST"),false);
 assert.equal(adapter.safePath("/v1/disputes/"+dispute.id,"POST"),false);
 assert.equal(adapter.safePath("/v1/refunds","POST"),false);
 assert.equal(adapter.safePath("/v1/refunds","GET"),false);
 assert.equal(adapter.safePath("/v1/balance","GET"),false);
});
