import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID,createHmac} from "node:crypto";
import {readFileSync} from "node:fs";
const project="demo-penguin-hybrid";
if(process.env.GCLOUD_PROJECT!==project||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
if(!getApps().length)initializeApp({projectId:project});
const db=getFirestore();
const lifecycle=require("./m7-stripe-test-lifecycle-policy");
const ledger=require("./m7-stripe-test-lifecycle-ledger");
const shadow=require("./m7-stripe-test-shadow-ledger");
const history=require("./m7-stripe-test-shadow-history");
const quote=require("./m7-stripe-test-reservation-policy");
const stripe=require("./m7-stripe-test-provider-policy");
const realCheckout=require("./m7-stripe-test-checkout");
const tenantId="m7-lifecycle-"+randomUUID(),tenant=db.collection("tenants").doc(tenantId);
const ownerId="owner-"+randomUUID(),cashierId="cashier-"+randomUUID();
const config={tenantId,project:"penguin-m7-test-uat",key:"sk_test_"+("A".repeat(48)),
 hook:"whsec_"+("B".repeat(48)),accountId:"acct_1234567890abcdef",
 fingerprint:"a".repeat(64)};
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const quoteAdapter={
 ...require("./m7-stripe-test-provider-adapter"),
 stripeSecret:{value:()=>config.key},hookSecret:{value:()=>config.hook},
 config:()=>config,
};
const exposed={};
new Function("exports","require",readFileSync("functions/m7-stripe-test-checkout.js","utf8"))(
 exposed,name=>({
  "firebase-functions/v2/https":{onCall:(_,fn)=>fn,onRequest:(_,fn)=>fn,HttpsError},
  "firebase-admin/firestore":{getFirestore:()=>db,FieldValue},
  "./m7-stripe-test-provider-adapter":quoteAdapter,
  "./m7-stripe-test-reservation":{
   _privateForTests:{...require("./m7-stripe-test-reservation")._privateForTests,
    merchant:async(_,auth)=>{
     const profile=(await db.collection("users").doc(auth.uid||"_anonymous").get()).data();
     if(!profile||profile.active!==true||!["owner","admin"].includes(profile.role))
      throw new HttpsError("permission-denied","Merchant only");
     if(profile.tenantId!==tenantId)throw new HttpsError("permission-denied","Other tenant");
     return tenantId;
    }},
  },
 }[name]||require(name)));
const fixtures=[];
function data(kind="expired"){
 const day=fixtures.length===0?"2026-11-22":"2026-11-23";
 const invoiceId=day+":monthly:fixed";
 const attemptId=randomUUID(),signature="b".repeat(64);
 const sessionId="cs_test_"+randomUUID().replaceAll("-","");
 const eventId="evt_"+randomUUID().replaceAll("-","");
 const intentId="pi_"+randomUUID().replaceAll("-","");
 const metadata={purpose:stripe.PURPOSE,tenantId,invoiceId,
  invoiceSignature:signature,attemptId,kind:"monthly"};
 const record={tenantId,invoiceId,attemptId,invoiceSignature:signature,
  amountSatang:39900,currency:"THB",kind:"monthly",mode:"test",
  status:"checkout_ready",accountId:config.accountId,providerFingerprint:config.fingerprint,
  attemptNo:1,providerCheckoutCreated:true,checkoutSessionId:sessionId,
  checkoutUrl:"https://checkout.stripe.com/c/pay/"+sessionId,
  settled:false,createdBy:ownerId};
 const intent={id:intentId,livemode:false,status:"requires_payment_method",currency:"thb",
  amount:39900,amount_received:0,metadata,payment_method_types:["promptpay"]};
 const session={id:sessionId,mode:"payment",livemode:false,
  status:kind==="expired"?"expired":"complete",
  payment_status:"unpaid",currency:"thb",amount_total:39900,
  client_reference_id:attemptId,metadata,payment_method_types:["promptpay"],
  payment_intent:kind==="expired"?null:intentId};
 const eventType=kind==="expired"?"checkout.session.expired":"checkout.session.async_payment_failed";
 const event={id:eventId,type:eventType,livemode:false,
  data:{object:session}};
 const raw=Buffer.from(JSON.stringify(event)),stamp=Math.floor(Date.now()/1000);
 const header="t="+stamp+",v1="+createHmac("sha256",config.hook)
  .update(stamp+".").update(raw).digest("hex");
 const obj={kind,invoiceId,attemptId,signature,sessionId,intentId,eventId,
  metadata,record,session,intent,event,eventType,raw,header,refs:shadow.refs(db,tenantId,invoiceId,attemptId)};
 fixtures.push(obj);return obj;
}
async function seed(f){
 await f.refs.invoice.set({id:f.invoiceId,tenantId,version:"hybrid-invoice-v1",
  signature:f.signature,kind:"fixed_monthly",amount:399,status:"issued",date:f.invoiceId.slice(0,10)});
 await f.refs.lock.set(f.record);
 await f.refs.attempt.set({...f.record,createdAt:FieldValue.serverTimestamp()});
}
const remote=f=>async(_config,path)=>{
 if(path==="/v1/events/"+f.eventId)return f.event;
 if(path==="/v1/checkout/sessions/"+f.sessionId)return f.session;
 if(path==="/v1/payment_intents/"+f.intentId)return f.intent;
 throw Error("UNAUTHORIZED_STRIPE_PATH");
};
test("signed expired TEST session: exactly one audit in 6 concurrent callbacks, never unlocks invoice/retry",async()=>{
 await tenant.set({active:true,name:"Synthetic TEST"});
 await Promise.all([
  db.collection("users").doc(ownerId).set({active:true,role:"owner",tenantId}),
  db.collection("users").doc(cashierId).set({active:true,role:"cashier",tenantId}),
 ]);
 const f=data("expired");await seed(f);
 const p={db,config,raw:f.raw,header:f.header,read:remote(f)};
 const results=await Promise.all(Array.from({length:6},()=>exposed._privateForTests.webhookTerminal(p)));
 assert.equal(results.filter(r=>r.reused===false).length,1);
 assert.equal(results.filter(r=>r.reused===true).length,5);
 const attempt=(await f.refs.attempt.get()).data();
 assert.equal(attempt.status,"expired_test");
 assert.equal(attempt.checkoutUrl,"");
 assert.equal(attempt.providerClosureVerified,false);
 assert.equal(attempt.canRetry,false);
 assert.equal((await f.refs.lock.get()).data().status,"expired_test");
 const audit=(await tenant.collection("m7StripeTestLifecycleAudits").doc(f.eventId).get()).data();
 assert.equal(audit.providerVerifiedUnpaid,true);
 assert.equal(audit.invoicePaid,false);
 assert.equal(audit.canRetry,false);
 assert.equal(audit.eventType,"checkout.session.expired");
 assert.equal((await db.collection("m7StripeTestEventClaims").doc(f.eventId).get()).data().attemptId,f.attemptId);
 assert.equal((await f.refs.invoice.get()).data().status,"issued");
 assert.equal((await f.refs.settlement.get()).exists,false);
 const projected=history._privateForTests.view(attempt,null,audit);
 assert.equal(projected.status,"expired_test");
 assert.equal(projected.terminalUnpaidAudited,true);
 assert.equal(projected.operationalSettlementEnabled,false);
 assert.equal(history._privateForTests.view(attempt,null,null).status,"needs_review");
 const all=await history._privateForTests.history(db,tenantId);
 assert.equal(all.items.find(x=>x.attemptId===f.attemptId).status,"expired_test");
 assert.equal(all.items.find(x=>x.attemptId===f.attemptId).canRetry,false);
});
test("signed asynchronous failure: independent PaymentIntent must confirm no received funds",async()=>{
 const f=data("failed");await seed(f);
 const p={db,config,raw:f.raw,header:f.header,read:remote(f)};
 const response=await exposed._privateForTests.webhookTerminal(p);
 assert.equal(response.status,"payment_failed_test");
 assert.equal(response.invoicePaid,false);
 const after=(await f.refs.attempt.get()).data();
 assert.equal(after.status,"payment_failed_test");
 assert.equal(after.providerClosureVerified,false);
 assert.equal((await f.refs.invoice.get()).data().status,"issued");
 assert.equal(history._privateForTests.view(after,null,
  (await tenant.collection("m7StripeTestLifecycleAudits").doc(f.eventId).get()).data()).status,"payment_failed_test");
 const replay=await exposed._privateForTests.webhookTerminal(p);
 assert.equal(replay.reused,true);
 await assert.rejects(exposed._privateForTests.webhookTerminal({
  ...p,raw:Buffer.from("{}")}),/UNTRUSTED/);
});
test("merchant inspection is read-only: open, paid, expired status never posts invoice or settlement",async()=>{
 const f=fixtures[0],auth={uid:ownerId};
 const sessionOpen={...f.session,status:"open",payment_status:"unpaid",payment_intent:null};
 await f.refs.attempt.update({status:"checkout_ready",providerClosureVerified:false});
 await f.refs.lock.update({status:"checkout_ready"});
 let results=await exposed._privateForTests.inspect({db,auth,config,
  invoiceId:f.invoiceId,read:async(_,path)=>path==="/v1/checkout/sessions/"+f.sessionId?sessionOpen:remote(f)(_,path)});
 assert.equal(results.status,"awaiting_payment");
 assert.equal(results.operationalInvoicePaid,false);
 results=await exposed._privateForTests.inspect({db,auth,config,
  invoiceId:f.invoiceId,read:remote(f)});
 assert.equal(results.status,"provider_expired_unpaid");
 assert.equal(results.canRetry,false);
 const paid={...f.session,status:"complete",payment_status:"paid",
  payment_intent:f.intentId};
 const fullIntent={...f.intent,status:"succeeded",amount_received:39900};
 results=await exposed._privateForTests.inspect({db,auth,config,
  invoiceId:f.invoiceId,read:async(_,path)=>{
   if(path==="/v1/checkout/sessions/"+f.sessionId)return paid;
   if(path==="/v1/payment_intents/"+f.intentId)return fullIntent;
   throw Error("UNEXPECTED");}});
 assert.equal(results.status,"awaiting_signed_webhook");
 assert.equal(results.operationalInvoicePaid,false);
 assert.equal((await f.refs.invoice.get()).data().status,"issued");
 assert.equal((await f.refs.settlement.get()).exists,false);
 await assert.rejects(exposed._privateForTests.inspect({db,auth:{uid:cashierId},config,
  invoiceId:f.invoiceId,read:remote(f)}),{code:"permission-denied"});
});
test("unsigned/mismatched terminal proof and changing invoice after checkout never records unpaid audit",async()=>{
 const f=data("expired");await seed(f);
 const forged={...f.session,amount_total:39901};
 await assert.rejects(exposed._privateForTests.webhookTerminal({
  db,config,raw:f.raw,header:f.header,read:async(c,path)=>
    path==="/v1/checkout/sessions/"+f.sessionId?forged:remote(f)(c,path)}),
  /PROVIDER_PROOF_INVALID/);
 await f.refs.invoice.update({status:"paid",paidAttemptId:"manual-paid"});
 await assert.rejects(exposed._privateForTests.webhookTerminal({
  db,config,raw:f.raw,header:f.header,read:remote(f)}),/FINANCIAL_STATE_CONFLICT/);
 assert.equal((await tenant.collection("m7StripeTestLifecycleAudits").doc(f.eventId).get()).exists,false);
 assert.equal((await f.refs.attempt.get()).data().status,"checkout_ready");
 assert.equal((await f.refs.invoice.get()).data().status,"paid");
});
test("real Callables in emulator remain off; no merchant can use an arbitrary invoice or TEST credentials",async()=>{
 const f=fixtures[0];
 await assert.rejects(realCheckout.inspectOwnM7StripeTestCheckout.run({
  data:{invoiceId:f.invoiceId},auth:{uid:ownerId}}),{code:"failed-precondition"});
 assert.equal(lifecycle.verifiedEnvelope({raw:f.raw,header:f.header,secret:config.hook}).type,
  "checkout.session.expired");
 const forged={...f.session,payment_status:"paid"};
 assert.equal(lifecycle.terminalUnpaid("checkout.session.expired",f.record,forged,null),false);
 assert.equal(lifecycle.publicInspection(f.record,"provider_request_uncertain").canRetry,false);
 assert.equal(quote.testTenant(), "");
});
