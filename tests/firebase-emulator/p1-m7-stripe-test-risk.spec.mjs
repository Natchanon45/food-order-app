import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {createHmac,randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
const project="demo-penguin-hybrid";
if(process.env.GCLOUD_PROJECT!==project||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
if(!getApps().length)initializeApp({projectId:project});
const db=getFirestore(),risk=require("./m7-stripe-test-risk-policy"),
 shadow=require("./m7-stripe-test-shadow-ledger"),
 history=require("./m7-stripe-test-shadow-history"),
 provider=require("./m7-stripe-test-provider-policy");
const tenantId="m7-risk-"+randomUUID(),tenant=db.collection("tenants").doc(tenantId);
const invoiceId="2026-11-22:monthly:fixed",attemptId=randomUUID();
const sessionId="cs_test_"+randomUUID().replaceAll("-","");
const intentId="pi_"+randomUUID().replaceAll("-","");
const paidEventId="evt_paid"+randomUUID().replaceAll("-","");
const refundEventId="evt_refund"+randomUUID().replaceAll("-","");
const disputeEventId="evt_dispute"+randomUUID().replaceAll("-","");
const chargeId="ch_"+randomUUID().replaceAll("-","");
const disputeId="dp_"+randomUUID().replaceAll("-","");
const signature="a".repeat(64);
const config={tenantId,accountId:"acct_1234567890abcdef",
 fingerprint:"b".repeat(64),hook:"whsec_"+("C".repeat(48)),
 key:"sk_test_"+("D".repeat(48)),project:"penguin-risk-test-uat"};
const meta={purpose:provider.PURPOSE,tenantId,invoiceId,attemptId,
 kind:"monthly",invoiceSignature:signature};
const record={tenantId,invoiceId,attemptId,invoiceSignature:signature,
 amountSatang:39900,currency:"THB",kind:"monthly",mode:"test",
 status:"checkout_ready",accountId:config.accountId,
 providerFingerprint:config.fingerprint,attemptNo:1,
 providerCheckoutCreated:true,checkoutSessionId:sessionId,
 checkoutUrl:"https://checkout.stripe.com/c/pay/"+sessionId,settled:false};
const session={id:sessionId,mode:"payment",livemode:false,
 status:"complete",payment_status:"paid",amount_total:39900,
 currency:"thb",client_reference_id:attemptId,metadata:meta,
 payment_method_types:["promptpay"],payment_intent:intentId};
const intent={id:intentId,livemode:false,status:"succeeded",
 currency:"thb",amount:39900,amount_received:39900,metadata:meta,
 payment_method_types:["promptpay"]};
const charge={id:chargeId,object:"charge",livemode:false,
 currency:"thb",amount:39900,amount_refunded:9950,
 refunded:false,paid:true,payment_intent:intentId};
const dispute={id:disputeId,object:"dispute",livemode:false,
 charge:chargeId,currency:"thb",amount:9950,status:"needs_response"};
const r=shadow.refs(db,tenantId,invoiceId,attemptId);
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const exposed={};
new Function("exports","require",readFileSync("functions/m7-stripe-test-checkout.js","utf8"))(
 exposed,name=>({
  "firebase-functions/v2/https":{onCall:(_,fn)=>fn,onRequest:(_,fn)=>fn,HttpsError},
  "firebase-admin/firestore":{getFirestore:()=>db,FieldValue},
 }[name]||require(name)));
const rawEvent=(eventType,object,evtId)=>{
 const event={id:evtId,livemode:false,type:eventType,
  data:{object}};
 const raw=Buffer.from(JSON.stringify(event)),t=Math.floor(Date.now()/1000);
 const header="t="+t+",v1="+createHmac("sha256",config.hook)
  .update(t+".").update(raw).digest("hex");
 return {event,raw,header};
};
const refund=rawEvent("charge.refunded",charge,refundEventId);
const disputed=rawEvent("charge.dispute.created",dispute,disputeEventId);
const readFor=(f,chargeResponse=charge)=>async(_config,path)=>{
 if(path==="/v1/events/"+f.event.id)return f.event;
 if(path==="/v1/charges/"+chargeId)return chargeResponse;
 if(path==="/v1/disputes/"+disputeId)return dispute;
 if(path==="/v1/checkout/sessions/"+sessionId)return session;
 if(path==="/v1/payment_intents/"+intentId)return intent;
 throw Error("UNEXPECTED_STRIPE_GET_"+path);
};
test("start from one verified Stripe TEST shadow settlement; invoice remains issued",async()=>{
 await tenant.set({active:true,name:"Risk UAT only"});
 await r.invoice.set({id:invoiceId,tenantId,version:"hybrid-invoice-v1",
  signature,kind:"fixed_monthly",amount:399,status:"issued",date:"2026-11-22"});
 await r.attempt.set({...record,createdAt:FieldValue.serverTimestamp()});
 await r.lock.set(record);
 const paid=await shadow.settle({db,config,eventId:paidEventId,
  reservation:record,session,intent});
 assert.equal(paid.providerVerified,true);assert.equal(paid.invoicePaid,false);
 assert.equal((await r.settlement.get()).data().status,"verified_test_shadow");
});
test("verified signed partial Refund: one risk audit for six concurrent callbacks, never touches invoice",async()=>{
 const params={db,config,raw:refund.raw,header:refund.header,read:readFor(refund)};
 const results=await Promise.all(Array.from({length:6},()=>exposed._privateForTests.webhookRisk(params)));
 assert.equal(results.filter(x=>x.alreadyAudited===false).length,1);
 assert.equal(results.filter(x=>x.alreadyAudited===true).length,5);
 assert.equal((await r.invoice.get()).data().status,"issued");
 assert.equal((await r.settlement.get()).data().status,"verified_test_shadow");
 const row=(await r.attempt.get()).data();
 assert.equal(row.status,"verified_test");
 assert.equal(row.riskStatus,"refund_review");
 assert.equal(row.riskEventId,refundEventId);
 const audit=(await tenant.collection("m7StripeTestRiskAudits").doc(refundEventId).get()).data();
 assert.equal(audit.reversedSatang,9950);
 assert.equal(audit.providerEvidenceVerified,true);
 assert.equal(audit.invoicePaid,false);assert.equal(audit.walletChanged,false);
 assert.equal((await db.collection("m7StripeTestEventClaims").doc(refundEventId).get()).data().mode,
  "test_shadow_risk");
 const projection=history._privateForTests.view(row,(await r.settlement.get()).data(),null,audit);
 assert.equal(projection.status,"provider_test_refund_review");
 assert.equal(projection.providerVerified,false);
 assert.equal(history._privateForTests.view(row,(await r.settlement.get()).data(),null,null).status,"needs_review");
 const fullHistory=await history._privateForTests.history(db,tenantId);
 assert.equal(fullHistory.items.find(x=>x.attemptId===attemptId).status,"provider_test_refund_review");
 assert.equal((await tenant.collection("m7StripeTestRiskAudits").get()).size,1);
});
test("signed Dispute after Refund never silently restores verified; maintains newest risk audit",async()=>{
 const params={db,config,raw:disputed.raw,header:disputed.header,read:readFor(disputed)};
 const result=await exposed._privateForTests.webhookRisk(params);
 assert.equal(result.status,"dispute_review");assert.equal(result.invoicePaid,false);
 assert.equal((await tenant.collection("m7StripeTestRiskAudits").get()).size,2);
 const row=(await r.attempt.get()).data();
 assert.equal(row.riskStatus,"dispute_review");
 const audit=(await tenant.collection("m7StripeTestRiskAudits").doc(disputeEventId).get()).data();
 assert.equal(history._privateForTests.view(row,(await r.settlement.get()).data(),null,audit).status,
  "provider_test_dispute_review");
 const again=await exposed._privateForTests.webhookRisk(params);
 assert.equal(again.alreadyAudited,true);
 assert.equal((await r.invoice.get()).data().status,"issued");
 assert.equal((await r.settlement.get()).data().operationalInvoicePaid,false);
});
test("forged refund/dispute amount, mismatched charge/intent, live-mode and unsigned proof never create risk",async()=>{
 const badCharge={...charge,amount_refunded:0};
 const id1="evt_invalid"+randomUUID().replaceAll("-","");
 const f1=rawEvent("charge.refunded",charge,id1);
 await assert.rejects(exposed._privateForTests.webhookRisk({
  db,config,raw:f1.raw,header:f1.header,read:readFor(f1,badCharge)}),
  /RISK_PROVIDER_EVIDENCE_INVALID/);
 const f2=rawEvent("charge.refunded",charge,"evt_wrong"+randomUUID().replaceAll("-",""));
 await assert.rejects(exposed._privateForTests.webhookRisk({
  db,config,raw:f2.raw,header:f2.header,
  read:readFor(f2,{...charge,payment_intent:"pi_unknown_1234567890"})}),
  /INTENT_NOT_IN_M7_LEDGER/);
 await assert.rejects(exposed._privateForTests.webhookRisk({
  db,config,raw:f1.raw,header:"t=1,v1="+("0".repeat(64)),read:readFor(f1)}),
  /RISK_EVENT_UNTRUSTED/);
 assert.equal(risk.envelope({raw:Buffer.from("{}"),header:f1.header,secret:config.hook}),null);
 const wrongDispute={...dispute,charge:"ch_wrong_1234567890"};
 assert.equal(risk.evidence({hint:risk.envelope({
  raw:disputed.raw,header:disputed.header,secret:config.hook}),
  event:disputed.event,charge,dispute:wrongDispute}),null);
 assert.equal((await tenant.collection("m7StripeTestRiskAudits").get()).size,2);
});

test("HTTP webhook dispatcher accepts signed TEST Refund as risk review, blocks invalid signatures and never posts cash",async()=>{
 const route={};
 const realShadow=require("./m7-stripe-test-shadow-policy");
 const adapter=require("./m7-stripe-test-provider-adapter");
 const isolated={...realShadow,ingressGate:()=>({project:config.project,tenantId})};
 const adapterInjected={...adapter,stripeSecret:{value:()=>config.key},
  hookSecret:{value:()=>config.hook},config:()=>config,request:readFor(refund)};
 new Function("exports","require",readFileSync("functions/m7-stripe-test-checkout.js","utf8"))(
  route,name=>({
   "firebase-functions/v2/https":{onCall:(_,fn)=>fn,onRequest:(_,fn)=>fn,HttpsError},
   "firebase-admin/firestore":{getFirestore:()=>db,FieldValue},
   "./m7-stripe-test-shadow-policy":isolated,
   "./m7-stripe-test-provider-adapter":adapterInjected,
  }[name]||require(name)));
 const response=()=>({statusCode:0,body:null,status(n){this.statusCode=n;return this;},
  send(x){this.body=x;return this;},json(x){this.body=x;return this;}});
 let res=response();
 await route.m7StripeTestShadowWebhook({method:"POST",rawBody:refund.raw,
  get:()=>refund.header},res);
 assert.equal(res.statusCode,200);
 assert.equal(res.body.requiresRiskReview,true);
 assert.equal(res.body.operationalInvoicePaid,false);
 assert.equal(res.body.alreadyAudited,true);
 res=response();
 await route.m7StripeTestShadowWebhook({method:"POST",rawBody:refund.raw,
  get:()=>refund.header.replace(/v1=[a-f0-9]+/,"v1="+("0".repeat(64)))},res);
 assert.equal(res.statusCode,400);
 assert.equal((await r.invoice.get()).data().status,"issued");
 assert.equal((await r.settlement.get()).data().operationalInvoicePaid,false);
});
