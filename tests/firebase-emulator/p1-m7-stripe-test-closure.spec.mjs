import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
const project="demo-penguin-hybrid";
if(process.env.GCLOUD_PROJECT!==project||
  !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore,FieldValue,Timestamp}=require("firebase-admin/firestore");
if(!getApps().length)initializeApp({projectId:project});
const db=getFirestore();
const policy=require("./m7-stripe-test-reservation-policy");
const lifecycle=require("./m7-stripe-test-lifecycle-ledger");
const closure=require("./m7-stripe-test-closure");
const shadow=require("./m7-stripe-test-shadow-ledger");
const history=require("./m7-stripe-test-shadow-history");
const tenantId="m7-closure-"+randomUUID(),tenant=db.collection("tenants").doc(tenantId);
const superId="super-"+randomUUID(),ownerId="owner-"+randomUUID(),cashierId="cashier-"+randomUUID();
const config={tenantId,project:"private-uat",key:"sk_test_"+("A".repeat(48)),
 hook:"whsec_"+("B".repeat(48)),accountId:"acct_1234567890abcdef",
 fingerprint:"f".repeat(64)};
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const reservationModule={};
new Function("exports","require",readFileSync("functions/m7-stripe-test-reservation.js","utf8"))(
 reservationModule,name=>({
  "firebase-functions/v2/https":{onCall:(_,fn)=>fn,HttpsError},
  "firebase-admin/firestore":{getFirestore:()=>db,FieldValue},
  "./m7-stripe-test-reservation-policy":{...policy,testTenant:()=>tenantId},
 }[name]||require(name)));
const records=[];
async function seed(day){
 const invoiceId=day+":monthly:fixed",attemptId=randomUUID(),
  sessionId="cs_test_"+randomUUID().replaceAll("-"),
  eventId="evt_"+randomUUID().replaceAll("-"),
  stamp="a".repeat(64),now=Date.now(),
  reqMs=now-80*60000,expiredMs=now-65*60000,auditedMs=now-55*60000;
 const r=shadow.refs(db,tenantId,invoiceId,attemptId);
 const metadata={purpose:"penguin_m7_invoice_test",tenantId,invoiceId,
  invoiceSignature:stamp,attemptId,kind:"monthly"};
 const quote={tenantId,invoiceId,attemptId,invoiceSignature:stamp,
  amountSatang:39900,currency:"THB",mode:"test",kind:"monthly",
  attemptNo:1,status:"checkout_ready",settled:false,
  providerClosureVerified:false,providerCheckoutCreated:true,
  checkoutSessionId:sessionId,checkoutUrl:"https://checkout.stripe.com/c/pay/"+sessionId,
  accountId:config.accountId,providerFingerprint:config.fingerprint,
  providerRequestedAt:Timestamp.fromMillis(reqMs),createdAt:FieldValue.serverTimestamp()};
 const session={object:"checkout.session",id:sessionId,
  livemode:false,status:"expired",payment_status:"unpaid",mode:"payment",
  currency:"thb",amount_total:39900,metadata,client_reference_id:attemptId,
  payment_method_types:["promptpay"],payment_intent:null,
  created:Math.floor(reqMs/1000)+5,expires_at:Math.floor(expiredMs/1000)};
 const event={id:eventId,type:"checkout.session.expired",livemode:false,
  data:{object:session}};
 await r.invoice.set({id:invoiceId,tenantId,version:"hybrid-invoice-v1",
  signature:stamp,kind:"fixed_monthly",amount:399,status:"issued",date:day});
 await r.attempt.set(quote);await r.lock.set(quote);
 await lifecycle.record({db,config,eventId,eventType:event.type,
  attempt:quote,session,intent:null,now:auditedMs});
 const f={invoiceId,attemptId,sessionId,eventId,r,session,event,meta:metadata,
  request:{tenantId,invoiceId,attemptId},now};
 records.push(f);return f;
}
const verify=async()=>true;
const remote=(f,options={})=>async(c,path)=>{
 if(path==="/v1/checkout/sessions/"+f.sessionId)return options.session||f.session;
 if(path==="/v1/events/"+f.eventId)return options.event||f.event;
 if(path.startsWith("/v1/checkout/sessions?")){
  const cursor=new URLSearchParams(path.split("?")[1]).get("starting_after");
  if(options.ambiguous)return {object:"list",has_more:false,
   data:[f.session,{...f.session,id:"cs_test_"+randomUUID().replaceAll("-")}]};
  if(options.empty)return {object:"list",has_more:false,data:[]};
  if(cursor)return {object:"list",has_more:false,data:[options.session||f.session]};
  return {object:"list",has_more:true,data:[{object:"checkout.session",
   id:"cs_test_"+randomUUID().replaceAll("-"),metadata:{purpose:"another"},
   created:f.session.created,client_reference_id:"not-ours"}]};
 }
 throw Error("UNEXPECTED_PROVIDER_PATH "+path);
};
test("signed expiry with no intent, cooldown and unique Stripe TEST Session: Superadmin read-only review",async()=>{
 await tenant.set({active:true,name:"closure TEST only"});
 await Promise.all([
  db.collection("users").doc(superId).set({active:true,role:"super_admin"}),
  db.collection("users").doc(ownerId).set({active:true,role:"owner",tenantId}),
  db.collection("users").doc(cashierId).set({active:true,role:"cashier",tenantId}),
 ]);
 const f=await seed("2026-11-27");
 const reviewed=await closure._privateForTests.review({db,auth:{uid:superId},
  config,data:f.request,read:remote(f),verify,now:f.now});
 assert.equal(reviewed.status,"can_review_closure");
 assert.equal(reviewed.eligibleForOperatorApproval,true);
 assert.equal(reviewed.canCreateNewCheckout,false);
 assert.equal(reviewed.operationalInvoicePaid,false);
 assert.equal(reviewed.scannedPages,2);
 assert.equal((await f.r.attempt.get()).data().status,"expired_test");
 assert.equal((await tenant.collection("m7StripeTestClosureAudits").get()).size,0);
 await assert.rejects(closure._privateForTests.review({db,auth:{uid:ownerId},
  config,data:f.request,read:remote(f),verify,now:f.now}),{code:"permission-denied"});
 await assert.rejects(closure._privateForTests.review({db,auth:{uid:cashierId},
  config,data:f.request,read:remote(f),verify,now:f.now}),{code:"permission-denied"});
});
test("five simultaneous Superadmin approvals create exactly one closure audit and no provider POST",async()=>{
 const f=records[0],calls=[];
 const read=async(c,path)=>{calls.push(path);return remote(f)(c,path);};
 const args={db,auth:{uid:superId},config,data:f.request,read,verify,now:f.now};
 const settled=await Promise.allSettled(Array.from({length:5},()=>closure._privateForTests.approve(args)));
 assert.equal(settled.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(settled.filter(x=>x.status==="rejected").length,4);
 const result=settled.find(x=>x.status==="fulfilled").value;
 assert.equal(result.status,"reviewed_expired_no_intent");
 assert.equal(result.newQuotePermitted,true);
 assert.equal(result.operationalInvoicePaid,false);
 assert.equal(result.newCheckoutCreated,false);
 assert.equal(calls.every(x=>x.startsWith("/v1/checkout/sessions")||x.startsWith("/v1/events/")),true);
 const old=(await f.r.attempt.get()).data();
 assert.equal(old.status,"expired");
 assert.equal(old.providerClosureVerified,true);
 assert.equal(old.checkoutUrl,"");
 assert.equal((await f.r.lock.get()).data().status,"expired");
 const audit=(await tenant.collection("m7StripeTestClosureAudits").doc(f.attemptId).get()).data();
 assert.equal(audit.operatorUid,superId);
 assert.equal(audit.providerPaymentIntentAbsent,true);
 assert.equal(audit.newReservationAllowed,true);
 assert.equal(audit.newCheckoutCreated,false);
 assert.equal((await f.r.invoice.get()).data().status,"issued");
 assert.equal((await f.r.settlement.get()).exists,false);
 assert.equal((await tenant.collection("m7StripeTestClosureAudits").get()).size,1);
});
test("owner manually makes one new non-chargeable quote after verified closure; 7 tabs produce exactly one; old audit survives",async()=>{
 const f=records[0];
 const mk=()=>reservationModule._privateForTests.reserve({db,auth:{uid:ownerId},
  allowedTenant:tenantId,invoiceId:f.invoiceId});
 const rows=await Promise.all(Array.from({length:7},()=>mk()));
 assert.equal(rows.filter(x=>x.reused===false).length,1);
 assert.equal(rows.filter(x=>x.reused===true).length,6);
 assert.equal(new Set(rows.map(x=>x.quote.attemptId)).size,1);
 assert.equal(rows[0].quote.attemptNo,2);
 assert.notEqual(rows[0].quote.attemptId,f.attemptId);
 assert.equal(rows[0].quote.checkoutEnabled,false);
 assert.equal(rows[0].quote.settlementEnabled,false);
 const old=(await f.r.attempt.get()).data();
 assert.equal(old.status,"expired");
 assert.equal(old.providerClosureVerified,true);
 assert.equal((await f.r.lock.get()).data().status,"reserved");
 assert.equal((await f.r.lock.get()).data().attemptNo,2);
 assert.equal((await f.r.invoice.get()).data().status,"issued");
 assert.equal((await f.r.settlement.get()).exists,false);
 assert.equal((await tenant.collection("m7StripeTestClosureAudits").doc(f.attemptId).get()).exists,true);
 const lifecycle=require("./m7-stripe-test-lifecycle-ledger");
 const replay=await lifecycle.record({db,config,eventId:f.eventId,
  eventType:"checkout.session.expired",attempt:(await f.r.attempt.get()).data(),
  session:f.session,intent:null});
 assert.equal(replay.reused,true);
 assert.equal((await f.r.lock.get()).data().status,"reserved");
 assert.equal((await tenant.collection("m7StripeTestClosureAudits").get()).size,1);
 const listed=await history._privateForTests.history(db,tenantId);
 assert.equal(listed.items.find(x=>x.attemptId===f.attemptId).status,"closed_expired_test");
});
test("closure history downgrades missing or falsified audit and blocks new quote",async()=>{
 const f=records[0];
 const closureRef=tenant.collection("m7StripeTestClosureAudits").doc(f.attemptId);
 const stored=(await closureRef.get()).data();
 const old=(await f.r.attempt.get()).data();
 assert.equal(history._privateForTests.view(old,null,null,null,stored).status,"closed_expired_test");
 assert.equal(history._privateForTests.view(old,null,null,null,{
  ...stored,providerPaymentIntentAbsent:false}).status,"needs_review");
 assert.equal(history._privateForTests.view(old,null,null,null,null).status,"needs_review");
});
test("provider mismatches: paid, intent present, recent expiry, duplicate session, missing results; none grant approval",async()=>{
 const f=await seed("2026-11-28");
 for(const changes of [
  {session:{...f.session,payment_status:"paid"}},
  {session:{...f.session,payment_intent:"pi_1234567890abcdef"}},
  {session:{...f.session,expires_at:Math.floor(f.now/1000)-10}},
  {session:{...f.session,amount_total:39901}},
  {ambiguous:true},{empty:true},
 ]){
  const result=await closure._privateForTests.review({db,auth:{uid:superId},
   config,data:f.request,read:remote(f,changes),verify,now:f.now});
  assert.notEqual(result.status,"can_review_closure",JSON.stringify(changes));
  assert.equal(result.canCreateNewCheckout,false);
  assert.equal(result.eligibleForOperatorApproval,false);
 }
 assert.equal((await f.r.attempt.get()).data().status,"expired_test");
 assert.equal((await tenant.collection("m7StripeTestClosureAudits").doc(f.attemptId).get()).exists,false);
});
test("transaction rejects changed invoice or pending manual financial evidence before approval",async()=>{
 const f=await seed("2026-11-29");
 await f.r.tenant.collection("hybridBillingAdjustments").doc("pending-"+randomUUID()).set({
  invoiceId:f.invoiceId,tenantId,status:"pending_review"});
 await assert.rejects(closure._privateForTests.approve({db,auth:{uid:superId},
  config,data:f.request,read:remote(f),verify,now:f.now}),{code:"failed-precondition"});
 assert.equal((await f.r.attempt.get()).data().status,"expired_test");
 assert.equal((await f.r.lock.get()).data().status,"expired_test");
 assert.equal((await tenant.collection("m7StripeTestClosureAudits").doc(f.attemptId).get()).exists,false);
});
test("Emulator deployment gate disabled, no live Stripe credentials, no arbitrary request fields",async()=>{
 const f=records[0];
 await assert.rejects(closure.reviewPlatformM7StripeTestClosure.run({
  data:f.request,auth:{uid:superId}}),{code:"failed-precondition"});
 await assert.rejects(closure.approvePlatformM7StripeTestClosure.run({
  data:f.request,auth:{uid:superId}}),{code:"failed-precondition"});
 assert.throws(()=>closure._privateForTests.canonical({...f.request,chargeAmount:399}),
  {code:"invalid-argument"});
 assert.equal(policy.testTenant(), "");
});
