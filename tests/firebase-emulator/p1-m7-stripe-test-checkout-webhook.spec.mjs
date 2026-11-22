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
const db=getFirestore(),realReservation=require("./m7-stripe-test-reservation"),
  realAdapter=require("./m7-stripe-test-provider-adapter"),
  policy=require("./m7-stripe-test-provider-policy"),
  shadow=require("./m7-stripe-test-shadow-policy"),
  ledger=require("./m7-stripe-test-shadow-ledger"),
  quote=require("./m7-stripe-test-reservation-policy");
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const tenantId="m7-shadow-checkout-"+randomUUID(),tenant=db.collection("tenants").doc(tenantId);
const owner="owner-"+randomUUID(),cashier="cashier-"+randomUUID();
const invoiceId="2026-11-22:monthly:fixed",signature="a".repeat(64),attemptId=randomUUID();
const key="sk_test_"+("A".repeat(48)),hook="whsec_"+("B".repeat(48));
const accountId="acct_1234567890abcdef",cfg={tenantId,project:"private-uat",
  key,hook,accountId,fingerprint:"d".repeat(64)};
const sessionId="cs_test_checkout"+randomUUID().replaceAll("-",""),
 intentId="pi_checkout"+randomUUID().replaceAll("-",""),
 eventId="evt_checkout"+randomUUID().replaceAll("-","");
const metadata={purpose:policy.PURPOSE,tenantId,invoiceId,invoiceSignature:signature,
 attemptId,kind:"monthly"};
const session={id:sessionId,mode:"payment",livemode:false,status:"open",payment_status:"unpaid",
 amount_total:39900,currency:"thb",client_reference_id:attemptId,metadata,
 payment_method_types:["promptpay"],payment_intent:null,
 url:"https://checkout.stripe.com/c/pay/"+sessionId};
const paidSession={...session,status:"complete",payment_status:"paid",payment_intent:intentId,url:null};
const intent={id:intentId,livemode:false,status:"succeeded",currency:"thb",amount:39900,
 amount_received:39900,metadata,payment_method_types:["promptpay"]};
const event={id:eventId,type:"checkout.session.completed",livemode:false,
 data:{object:{...paidSession,metadata}}};
const raw=Buffer.from(JSON.stringify(event));
const stamp=Math.floor(Date.now()/1000);
const signatureHeader="t="+stamp+",v1="+createHmac("sha256",hook).update(stamp+".").update(raw).digest("hex");
const refs=ledger.refs(db,tenantId,invoiceId,attemptId);
const mockReservation={_privateForTests:{...realReservation._privateForTests,
 merchant:async(_db,auth)=>{
  const person=(await db.collection("users").doc(auth.uid||"_anonymous").get()).data();
  if(person?.active!==true||!["owner","admin"].includes(person.role))
   throw new HttpsError("permission-denied","OWNER_REQUIRED");
  if(person.tenantId!==tenantId)throw new HttpsError("permission-denied","TENANT_DENIED");
  return tenantId;
 }}};
const fakeAdapter={...realAdapter,
 stripeSecret:{value:()=>key},hookSecret:{value:()=>hook},
 returnOrigin:()=> "https://private-uat.web.app",
 checkoutForm:(config,row)=>realAdapter.checkoutForm(config,row,{
  PENGUIN_M7_STRIPE_TEST_RETURN_ORIGIN:"https://private-uat.web.app"}),
};
const exposed={};
new Function("exports","require",readFileSync("functions/m7-stripe-test-checkout.js","utf8"))(
 exposed,name=>({
  "firebase-functions/v2/https":{onCall:(_,fn)=>fn,onRequest:(_,fn)=>fn,HttpsError},
  "firebase-admin/firestore":{getFirestore:()=>db,FieldValue},
  "./m7-stripe-test-reservation":mockReservation,
  "./m7-stripe-test-provider-adapter":fakeAdapter,
 }[name]||require(name)));
let providerCreateCount=0,lastForm=null,selectedSession=paidSession,selectedIntent=intent;
const fakeRequest=async(config,path,options={})=>{
 assert.equal(config.key,key);
 if(path==="/v1/account")return {id:accountId,country:"TH",charges_enabled:true,livemode:false};
 if(path==="/v1/payment_method_configurations?limit=30")
  return {data:[{active:true,promptpay:{available:true,display_preference:{value:"on"}}}]};
 if(path==="/v1/checkout/sessions"){
  providerCreateCount++;lastForm=options.form;
  assert.equal(options.idempotency,"penguin-m7-test-"+attemptId);
  assert.equal(options.method,"POST");
  return session;
 }
 if(path==="/v1/events/"+eventId)return event;
 if(path==="/v1/checkout/sessions/"+sessionId)return selectedSession;
 if(path==="/v1/payment_intents/"+intentId)return selectedIntent;
 throw Error("STRIPE_REQUEST_UNEXPECTED_"+path);
};
async function initial(){
 await tenant.set({active:true,billingPolicyVersion:"hybrid_v1"});
 await Promise.all([
  db.collection("users").doc(owner).set({active:true,role:"owner",tenantId}),
  db.collection("users").doc(cashier).set({active:true,role:"cashier",tenantId}),
 ]);
 await refs.invoice.set({id:invoiceId,tenantId,version:"hybrid-invoice-v1",signature,
  kind:"fixed_monthly",amount:399,status:"issued",date:"2026-11-22"});
 const row={tenantId,invoiceId,attemptId,kind:"monthly",invoiceSignature:signature,
  amountSatang:39900,currency:"THB",mode:"test",attemptNo:1,status:"reserved",
  providerCheckoutCreated:false,checkoutSessionId:"",checkoutUrl:"",settled:false};
 await refs.attempt.set({...row,createdBy:owner,createdAt:FieldValue.serverTimestamp()});
 await refs.lock.set({...row,providerClosureVerified:false});
}
test("realistic checkout: distinct test account, one provider idempotency, server-generated amount, no paid invoice",async()=>{
 await initial();
 const params={db,config:cfg,auth:{uid:owner},invoiceId,
  request:fakeRequest,verify:async(c,req)=>realAdapter.verifyAccount(c,req)};
 const first=await Promise.all([exposed._privateForTests.checkout(params),
  exposed._privateForTests.checkout(params)]);
 assert.equal(first.length,2);
 assert.ok(first.every(x=>["checkout_ready","provider_requesting"].includes(x.providerStatus)));
 assert.ok(first.some(x=>x.providerStatus==="checkout_ready"));
 assert.equal(providerCreateCount,1);
 assert.equal(first.find(x=>x.providerStatus==="checkout_ready").item.checkoutUrl,session.url);
 assert.equal(lastForm.get("line_items[0][price_data][unit_amount]"),"39900");
 assert.equal(lastForm.get("metadata[invoiceSignature]"),signature);
 assert.equal(lastForm.get("payment_intent_data[metadata][invoiceSignature]"),signature);
 assert.equal(lastForm.get("metadata[purpose]"),policy.PURPOSE);
 const second=await exposed._privateForTests.checkout(params);
 assert.equal(second.reused,true);
 assert.equal(second.item.checkoutUrl,session.url);
 assert.equal(providerCreateCount,1);
 assert.equal((await refs.attempt.get()).data().status,"checkout_ready");
 assert.equal((await refs.invoice.get()).data().status,"issued");
 assert.equal((await refs.settlement.get()).exists,false);
 await assert.rejects(exposed._privateForTests.checkout({...params,auth:{uid:cashier}}),
  {code:"permission-denied"});
});
test("missing account and ambiguous provider response cannot cause a second chargeable TEST checkout",async()=>{
 const invoiceId2="2026-11-23:monthly:fixed",attempt2=randomUUID();
 const r2=ledger.refs(db,tenantId,invoiceId2,attempt2);
 const saved={tenantId,invoiceId:invoiceId2,invoiceSignature:"b".repeat(64),
  amountSatang:49900,kind:"monthly",currency:"THB",mode:"test",attemptId:attempt2,
  attemptNo:1,status:"reserved",providerCheckoutCreated:false,
  checkoutSessionId:"",checkoutUrl:"",settled:false};
 await r2.invoice.set({id:invoiceId2,tenantId,version:"hybrid-invoice-v1",
  signature:saved.invoiceSignature,kind:"fixed_monthly",amount:499,
  status:"issued",date:"2026-11-23"});
 await r2.attempt.set(saved);await r2.lock.set(saved);
 const args={db,config:cfg,auth:{uid:owner},invoiceId:invoiceId2};
 await assert.rejects(exposed._privateForTests.checkout({...args,
  verify:async()=>{throw Error("ACCOUNT_DISABLED")},request:fakeRequest}),
  {code:"failed-precondition"});
 assert.equal((await r2.attempt.get()).data().status,"reserved");
 assert.equal((await r2.lock.get()).data().status,"reserved");
 let posts=0;
 await assert.rejects(exposed._privateForTests.checkout({...args,
  verify:async()=>true,request:async(c,path,options)=>{
   if(path==="/v1/checkout/sessions"){posts++;throw Error("PROVIDER_TIMEOUT_AFTER_UNCERTAIN_POST")}
   return fakeRequest(c,path,options);
  }}),{code:"failed-precondition"});
 assert.equal(posts,1);
 assert.equal((await r2.attempt.get()).data().status,"provider_requesting");
 assert.equal((await r2.lock.get()).data().status,"provider_requesting");
 const follow=await exposed._privateForTests.checkout({...args,
  verify:async()=>true,request:async()=>{throw Error("MUST_NOT_RETRY_POST")}});
 assert.equal(follow.providerStatus,"provider_requesting");
 assert.equal(follow.requiresReview,true);
 assert.equal(posts,1);
 assert.equal((await r2.invoice.get()).data().status,"issued");
 assert.equal((await r2.settlement.get()).exists,false);
});
test("signed webhook, separately re-read TEST session+intent and immutable shadow claims, replay once",async()=>{
 const params={db,config:cfg,raw,header:signatureHeader,read:fakeRequest};
 const results=await Promise.all(Array.from({length:5},()=>exposed._privateForTests.webhook(params)));
 assert.equal(results.filter(x=>x.alreadySettled===false).length,1);
 assert.equal(results.filter(x=>x.alreadySettled===true).length,4);
 assert.equal((await refs.settlement.get()).data().status,"verified_test_shadow");
 assert.equal((await refs.invoice.get()).data().status,"issued");
 assert.equal((await refs.invoice.get()).data().paidAttemptId,undefined);
 assert.equal((await refs.attempt.get()).data().status,"verified_test");
 const again=await exposed._privateForTests.webhook(params);
 assert.equal(again.alreadySettled,true);
 const globalIntent=(await db.collection("m7StripeTestIntentClaims").doc(intentId).get()).data();
 const globalEvent=(await db.collection("m7StripeTestEventClaims").doc(eventId).get()).data();
 assert.equal(globalIntent.tenantId,tenantId);
 assert.equal(globalIntent.attemptId,attemptId);
 assert.equal(globalEvent.tenantId,tenantId);
 assert.equal(globalEvent.attemptId,attemptId);
});
test("never settle unsigned, mismatched invoice, live event, unpaid provider, missing proof or bad account",async()=>{
 const before=(await refs.settlement.get()).data();
 const badHeader="t="+stamp+",v1="+("f".repeat(64));
 await assert.rejects(exposed._privateForTests.webhook({
  db,config:cfg,raw,header:badHeader,read:fakeRequest}),/WEBHOOK_UNTRUSTED/);
 selectedSession={...paidSession,amount_total:39901};
 await assert.rejects(exposed._privateForTests.webhook({
  db,config:cfg,raw,header:signatureHeader,read:fakeRequest}),/PROVIDER_PROOF_MISMATCH/);
 selectedSession=paidSession;
 selectedIntent={...intent,status:"requires_payment_method"};
 await assert.rejects(exposed._privateForTests.webhook({
  db,config:cfg,raw,header:signatureHeader,read:fakeRequest}),/PROVIDER_PROOF_MISMATCH/);
 selectedIntent=intent;
 assert.deepEqual((await refs.settlement.get()).data().proofDigest,before.proofDigest);
 const real=require("./m7-stripe-test-checkout");
 assert.equal((await real.getOwnM7StripeTestCheckoutStatus.run({
  data:{},auth:{uid:owner}})).available,false);
 await assert.rejects(real.createOwnM7StripeTestCheckout.run({
  data:{invoiceId},auth:{uid:owner}}),{code:"failed-precondition"});
});

test("HTTP webhook route: production closed, bad HMAC 400, signed TEST duplicate 200; no live provider access",async()=>{
 const routeExports={};
 const shadowForTest={...shadow,gate:()=>({project:cfg.project,tenantId}),
  ingressGate:()=>({project:cfg.project,tenantId})};
 const adapterForTest={...fakeAdapter,
  config:()=>cfg,request:fakeRequest};
 new Function("exports","require",readFileSync("functions/m7-stripe-test-checkout.js","utf8"))(
  routeExports,name=>({
   "firebase-functions/v2/https":{onCall:(_,fn)=>fn,onRequest:(_,fn)=>fn,HttpsError},
   "firebase-admin/firestore":{getFirestore:()=>db,FieldValue},
   "./m7-stripe-test-reservation":mockReservation,
   "./m7-stripe-test-shadow-policy":shadowForTest,
   "./m7-stripe-test-provider-adapter":adapterForTest,
  }[name]||require(name)));
 const result=()=>({statusCode:0,body:null,status(n){this.statusCode=n;return this;},
  send(body){this.body=body;return this;},json(body){this.body=body;return this;}});
 let response=result();
 await routeExports.m7StripeTestShadowWebhook({method:"GET",rawBody:raw,get:()=>signatureHeader},response);
 assert.equal(response.statusCode,404);
 response=result();
 await routeExports.m7StripeTestShadowWebhook({method:"POST",rawBody:raw,get:()=>signatureHeader},response);
 assert.equal(response.statusCode,200);
 assert.equal(response.body.operationalInvoicePaid,false);
 assert.equal(response.body.alreadySettled,true);
 response=result();
 await routeExports.m7StripeTestShadowWebhook({method:"POST",rawBody:raw,
  get:()=>signatureHeader.replace(/v1=[a-f0-9]+/,"v1="+("f".repeat(64)))},response);
 assert.equal(response.statusCode,400);
 const unsupported={id:"evt_other_1234567890",type:"payment_intent.canceled",livemode:false};
 const bytes=Buffer.from(JSON.stringify(unsupported));
 const stampNow=Math.floor(Date.now()/1000);
 const signed="t="+stampNow+",v1="+createHmac("sha256",hook)
  .update(stampNow+".").update(bytes).digest("hex");
 response=result();
 await routeExports.m7StripeTestShadowWebhook({method:"POST",rawBody:bytes,get:()=>signed},response);
 assert.equal(response.statusCode,200);
 assert.equal(response.body,"Ignored");
 assert.equal((await refs.invoice.get()).data().status,"issued");
});

test("Superadmin-only shadow history rejects merchant, cashier and inactive Superadmin even with UAT gate closed",async()=>{
 const history=require("./m7-stripe-test-shadow-history");
 const superId="super-"+randomUUID();
 await db.collection("users").doc(superId).set({active:true,role:"super_admin"});
 await assert.rejects(history.getPlatformM7StripeTestShadowHistory.run({
  data:{tenantId},auth:{uid:owner}}),{code:"permission-denied"});
 await assert.rejects(history.getPlatformM7StripeTestShadowHistory.run({
  data:{tenantId},auth:{uid:cashier}}),{code:"permission-denied"});
 await assert.rejects(history.getPlatformM7StripeTestShadowHistory.run({
  data:{tenantId},auth:null}),{code:"unauthenticated"});
 const closed=await history.getPlatformM7StripeTestShadowHistory.run({
  data:{tenantId},auth:{uid:superId}});
 assert.equal(closed.available,false);
 assert.equal(closed.operationalSettlementEnabled,false);
 assert.equal(closed.items.length,0);
 await db.collection("users").doc(superId).update({active:false});
 await assert.rejects(history.getPlatformM7StripeTestShadowHistory.run({
  data:{tenantId},auth:{uid:superId}}),{code:"permission-denied"});
});
