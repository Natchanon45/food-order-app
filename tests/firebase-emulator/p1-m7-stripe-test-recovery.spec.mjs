import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const project="demo-penguin-hybrid";
if(process.env.GCLOUD_PROJECT!==project||
   !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
if(!getApps().length)initializeApp({projectId:project});
const db=getFirestore(),real=require("./m7-stripe-test-recovery"),
  ledger=require("./m7-stripe-test-shadow-ledger"),
  invoicePolicy=require("./m7-stripe-test-reservation-policy");
const tenantId="recovery-"+randomUUID(),tenant=db.collection("tenants").doc(tenantId);
const ownerId="owner-"+randomUUID(),superId="super-"+randomUUID(),cashierId="cashier-"+randomUUID();
const config={tenantId,project:"penguin-private-test-uat",key:"sk_test_"+("A".repeat(48)),
 hook:"whsec_"+("B".repeat(48)),accountId:"acct_1234567890abcdef",
 fingerprint:"a".repeat(64)};
const fixtures=[];
async function seed({day="2026-11-22",amount=399}={}){
 const invoiceId=day+":monthly:fixed",attemptId=randomUUID();
 const sessionId="cs_test_"+randomUUID().replaceAll("-","");
 const signature="b".repeat(64),refs=ledger.refs(db,tenantId,invoiceId,attemptId);
 const row={tenantId,invoiceId,attemptId,invoiceSignature:signature,
  amountSatang:amount*100,currency:"THB",kind:"monthly",mode:"test",
  attemptNo:1,status:"provider_requesting",
  providerCheckoutCreated:false,checkoutSessionId:"",checkoutUrl:"",
  settled:false,accountId:config.accountId,providerFingerprint:config.fingerprint,
  providerRequestedAt:FieldValue.serverTimestamp(),createdAt:FieldValue.serverTimestamp()};
 await refs.invoice.set({id:invoiceId,tenantId,version:"hybrid-invoice-v1",
  signature,amount,kind:"fixed_monthly",status:"issued",date:day});
 await refs.lock.set(row);await refs.attempt.set(row);
 const requestAt=(await refs.attempt.get()).data().providerRequestedAt.toMillis();
 const meta={purpose:"penguin_m7_invoice_test",tenantId,invoiceId,
  invoiceSignature:signature,attemptId,kind:"monthly"};
 const session={id:sessionId,object:"checkout.session",
  created:Math.floor(requestAt/1000),
  livemode:false,mode:"payment",status:"open",payment_status:"unpaid",
  currency:"thb",amount_total:amount*100,client_reference_id:attemptId,
  payment_method_types:["promptpay"],metadata:meta,payment_intent:null,
  url:"https://checkout.stripe.com/c/pay/"+sessionId};
 const output={invoiceId,attemptId,sessionId,signature,refs,row,meta,session,
  data:{tenantId,invoiceId,attemptId,sessionId}};
 fixtures.push(output);return output;
}
async function setup(){
 await tenant.set({active:true,name:"Recovery TEST only"});
 await Promise.all([
  db.collection("users").doc(ownerId).set({active:true,role:"owner",tenantId}),
  db.collection("users").doc(superId).set({active:true,role:"super_admin"}),
  db.collection("users").doc(cashierId).set({active:true,role:"cashier",tenantId}),
 ]);
}
function provider(f,rows=[f.session]){
 const unrelated={id:"cs_test_other"+randomUUID().replaceAll("-"),
  created:f.session.created,client_reference_id:"not-this-attempt",
  metadata:{purpose:"another_app"}};
 let calls=[];
 const read=async(_config,path)=>{
  calls.push(path);
  if(path==="/v1/checkout/sessions/"+f.sessionId)return rows.find(x=>x.id===f.sessionId)||f.session;
  if(path.startsWith("/v1/checkout/sessions?")){
   const qs=new URLSearchParams(path.split("?")[1]);
   if(qs.has("starting_after"))return {object:"list",data:rows,has_more:false};
   return {object:"list",data:[unrelated],has_more:true};
  }
  throw Error("PROVIDER_NETWORK_WRITE_OR_UNEXPECTED_PATH "+path);
 };
 return {read,calls};
}
const actor={uid:superId};
test("Superadmin review checks TEST account and two pages; is read-only, scoped and doesn't unlock a retry",async()=>{
 await setup();
 const f=await seed(),p=provider(f);
 const output=await real._privateForTests.review({db,auth:actor,config,
  data:{tenantId,invoiceId:f.invoiceId,attemptId:f.attemptId},
  read:p.read,verify:async()=>true});
 assert.equal(output.status,"single_open");
 assert.equal(output.scannedPages,2);
 assert.equal(output.sessionId,f.sessionId);
 assert.equal(output.readOnly,true);
 assert.equal(output.canCreateNewCheckout,false);
 assert.equal(output.canSettleInvoice,false);
 assert.equal(output.needsSuperadminConfirmation,true);
 assert.equal(p.calls.length,2);
 assert.equal(p.calls.every(x=>x.startsWith("/v1/checkout/sessions?")),true);
 assert.equal((await f.refs.attempt.get()).data().status,"provider_requesting");
 assert.equal((await f.refs.invoice.get()).data().status,"issued");
 assert.equal((await tenant.collection("m7StripeTestRecoveryAudits").get()).size,0);
 await assert.rejects(real._privateForTests.review({db,auth:{uid:ownerId},config,
  data:{tenantId,invoiceId:f.invoiceId,attemptId:f.attemptId},read:p.read,verify:async()=>true}),
  {code:"permission-denied"});
 await assert.rejects(real._privateForTests.review({db,auth:{uid:cashierId},config,
  data:{tenantId,invoiceId:f.invoiceId,attemptId:f.attemptId},read:p.read,verify:async()=>true}),
  {code:"permission-denied"});
 await assert.rejects(real._privateForTests.review({db,auth:actor,
  config:{...config,tenantId:"other-uat-tenant"},
  data:{tenantId,invoiceId:f.invoiceId,attemptId:f.attemptId},read:p.read,verify:async()=>true}),
  {code:"failed-precondition"});
});
test("explicit Superadmin bind of exact one existing open TEST session: one transaction, one audit under concurrency, no provider POST",async()=>{
 const f=fixtures[0],p=provider(f);
 const args={db,auth:actor,config,data:f.data,read:p.read,verify:async()=>true};
 const results=await Promise.allSettled(Array.from({length:5},()=>real._privateForTests.bind(args)));
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected").length,4);
 const success=results.find(x=>x.status==="fulfilled").value;
 assert.equal(success.existingSessionReattached,true);
 assert.equal(success.createdStripeSession,false);
 assert.equal(success.operationalInvoicePaid,false);
 assert.equal(success.canCreateNewCheckout,false);
 const attempt=(await f.refs.attempt.get()).data(),lock=(await f.refs.lock.get()).data();
 assert.equal(attempt.status,"checkout_ready");
 assert.equal(attempt.checkoutSessionId,f.sessionId);
 assert.equal(attempt.checkoutUrl,f.session.url);
 assert.equal(lock.status,"checkout_ready");
 const aud=(await tenant.collection("m7StripeTestRecoveryAudits").doc(f.attemptId).get()).data();
 assert.equal(aud.sessionId,f.sessionId);
 assert.equal(aud.operatorUid,superId);
 assert.equal(aud.mode,"test_recovery");
 assert.equal(aud.createdStripeSession,false);
 assert.equal(aud.operationalInvoicePaid,false);
 assert.equal((await tenant.collection("m7StripeTestRecoveryAudits").get()).size,1);
 assert.equal((await f.refs.invoice.get()).data().status,"issued");
 assert.equal((await f.refs.settlement.get()).exists,false);
 assert.equal(p.calls.some(x=>!x.startsWith("/v1/checkout/sessions")),false);
 await assert.rejects(real._privateForTests.bind(args),{code:"failed-precondition"});
});
test("zero/ambiguous/paid provider sessions are read-only investigations, never bind or new checkout",async()=>{
 const f=await seed({day:"2026-11-23"}),basic={db,auth:actor,config,
  data:{tenantId,invoiceId:f.invoiceId,attemptId:f.attemptId},
  verify:async()=>true};
 const none=provider(f,[]);
 const result=await real._privateForTests.review({...basic,read:none.read});
 assert.equal(result.status,"not_found_uncertain");
 assert.equal(result.canCreateNewCheckout,false);
 const duplicates=provider(f,[f.session,{...f.session,
  id:"cs_test_other"+randomUUID().replaceAll("-")}]);
 const ambiguous=await real._privateForTests.review({...basic,read:duplicates.read});
 assert.equal(ambiguous.status,"ambiguous");
 await assert.rejects(real._privateForTests.bind({...basic,
  data:f.data,read:duplicates.read}),{code:"failed-precondition"});
 const paid=provider(f,[{...f.session,status:"complete",payment_status:"paid",
  payment_intent:"pi_1234567890abcdef",url:null}]);
 const paidReport=await real._privateForTests.review({...basic,read:paid.read});
 assert.equal(paidReport.status,"already_paid_wait_webhook");
 await assert.rejects(real._privateForTests.bind({...basic,data:f.data,
  read:paid.read}),{code:"failed-precondition"});
 assert.equal((await f.refs.attempt.get()).data().status,"provider_requesting");
 assert.equal((await f.refs.invoice.get()).data().status,"issued");
 assert.equal((await tenant.collection("m7StripeTestRecoveryAudits").doc(f.attemptId).get()).exists,false);
});
test("manual-payment evidence changes between Superadmin review and bind: all-or-nothing, invoice remains unchanged",async()=>{
 const f=await seed({day:"2026-11-24"}),p=provider(f);
 const data={tenantId,invoiceId:f.invoiceId,attemptId:f.attemptId};
 assert.equal((await real._privateForTests.review({db,auth:actor,config,data,
  read:p.read,verify:async()=>true})).status,"single_open");
 await tenant.collection("hybridBillingAdjustments").doc("guard-"+randomUUID()).set({
  invoiceId:f.invoiceId,tenantId,status:"pending_review"});
 await assert.rejects(real._privateForTests.bind({db,auth:actor,config,data:f.data,
  read:p.read,verify:async()=>true}),{code:"failed-precondition"});
 assert.equal((await f.refs.attempt.get()).data().status,"provider_requesting");
 assert.equal((await f.refs.lock.get()).data().status,"provider_requesting");
 assert.equal((await tenant.collection("m7StripeTestRecoveryAudits").doc(f.attemptId).get()).exists,false);
 assert.equal((await f.refs.invoice.get()).data().status,"issued");
});
test("signed TEST paid webhook wins before operator bind; never reopens checkout or downgrades provider settlement",async()=>{
 const f=await seed({day:"2026-11-25"}),p=provider(f),id="pi_"+randomUUID().replaceAll("-","");
 const paidSession={...f.session,status:"complete",payment_status:"paid",
   payment_intent:id,url:null};
 const intent={id,livemode:false,status:"succeeded",currency:"thb",
  amount:f.session.amount_total,amount_received:f.session.amount_total,
  metadata:f.session.metadata,payment_method_types:["promptpay"]};
 const read=async(c,path)=>{
  if(path==="/v1/checkout/sessions/"+f.sessionId)return paidSession;
  if(path.startsWith("/v1/checkout/sessions?")){
   const cursor=new URLSearchParams(path.split("?")[1]).get("starting_after");
   return cursor?{object:"list",data:[paidSession],has_more:false}:
    {object:"list",data:[],has_more:true};
  }
  throw Error("UNEXPECTED_PROVIDER_PATH");
 };
 const result=await real._privateForTests.review({db,auth:actor,config,
  data:{tenantId,invoiceId:f.invoiceId,attemptId:f.attemptId},
  read:async(c,path)=>path.startsWith("/v1/checkout/sessions?")?
    {object:"list",data:[paidSession],has_more:false}:read(c,path),
  verify:async()=>true});
 assert.equal(result.status,"already_paid_wait_webhook");
 const settled=await ledger.settle({db,config,
  eventId:"evt_"+randomUUID().replaceAll("-"),
  reservation:(await f.refs.attempt.get()).data(),
  session:paidSession,intent});
 assert.equal(settled.ok,true);assert.equal(settled.invoicePaid,false);
 await assert.rejects(real._privateForTests.bind({db,auth:actor,config,
  data:f.data,read:p.read,verify:async()=>true}),{code:"failed-precondition"});
 assert.equal((await f.refs.attempt.get()).data().status,"verified_test");
 assert.equal((await f.refs.invoice.get()).data().status,"issued");
 assert.equal((await f.refs.settlement.get()).data().status,"verified_test_shadow");
 assert.equal((await tenant.collection("m7StripeTestRecoveryAudits").doc(f.attemptId).get()).exists,false);
});
test("webhook commits between provider re-read and recovery transaction; transaction rejects stale open Session",async()=>{
 const f=await seed({day:"2026-11-26"}),p=provider(f),
  id="pi_"+randomUUID().replaceAll("-"),eventId="evt_"+randomUUID().replaceAll("-","");
 const paid={...f.session,status:"complete",payment_status:"paid",
  payment_intent:id,url:null};
 const intent={id,livemode:false,status:"succeeded",currency:"thb",
  amount:f.session.amount_total,amount_received:f.session.amount_total,
  metadata:f.session.metadata,payment_method_types:["promptpay"]};
 let collided=false;
 const read=async(c,path)=>{
  if(path==="/v1/checkout/sessions/"+f.sessionId&&!collided){
   collided=true;
   const settled=await ledger.settle({db,config,eventId,
    reservation:(await f.refs.attempt.get()).data(),session:paid,intent});
   assert.equal(settled.ok,true);
   return f.session; // stale provider GET, Firestore must protect immutable state
  }
  return p.read(c,path);
 };
 await assert.rejects(real._privateForTests.bind({db,auth:actor,config,
  data:f.data,read,verify:async()=>true}),{code:"failed-precondition"});
 assert.equal(collided,true);
 assert.equal((await f.refs.attempt.get()).data().status,"verified_test");
 assert.equal((await f.refs.lock.get()).data().status,"verified_test");
 assert.equal((await tenant.collection("m7StripeTestRecoveryAudits").doc(f.attemptId).get()).exists,false);
 assert.equal((await f.refs.invoice.get()).data().status,"issued");
});
test("real deployment Callables reject emulator, malformed input and missing active Superadmin",async()=>{
 const f=fixtures[0],p=provider(f);
 await assert.rejects(real.reviewPlatformM7StripeTestRecovery.run({
  data:{tenantId,invoiceId:f.invoiceId,attemptId:f.attemptId},auth:actor}),
  {code:"failed-precondition"});
 await assert.rejects(real.bindPlatformM7StripeTestRecovery.run({
  data:f.data,auth:actor}),{code:"failed-precondition"});
 assert.throws(()=>real._privateForTests.input({...f.data,untrustedAmount:1},true),
  {code:"invalid-argument"});
 assert.throws(()=>real._privateForTests.input({...f.data,sessionId:"cs_live_unknown"},true),
  {code:"invalid-argument"});
 await db.collection("users").doc(superId).update({active:false});
 await assert.rejects(real._privateForTests.review({db,auth:actor,config,
  data:{tenantId,invoiceId:f.invoiceId,attemptId:f.attemptId},
  read:p.read,verify:async()=>true}),{code:"permission-denied"});
 assert.equal(invoicePolicy.testTenant(), "");
});
