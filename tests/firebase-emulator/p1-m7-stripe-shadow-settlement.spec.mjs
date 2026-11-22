import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const project="demo-penguin-hybrid";
if(process.env.GCLOUD_PROJECT!==project||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
if(!getApps().length)initializeApp({projectId:project});
const db=getFirestore(),ledger=require("./m7-stripe-test-shadow-ledger"),
 provider=require("./m7-stripe-test-provider-policy"),
 policy=require("./m7-stripe-test-reservation-policy");
const tenantId="shadow-"+randomUUID(),tenant=db.collection("tenants").doc(tenantId);
const invoiceId="2026-11-22:monthly:fixed",id=randomUUID(),snapshot="a".repeat(64);
const accountId="acct_1234567890abcdef",fingerprint="b".repeat(64);
const cfg={tenantId,accountId,fingerprint};
const sessionId="cs_test_1234567890abcdef",intentId="pi_1234567890abcdef";
const metadata={purpose:provider.PURPOSE,tenantId,invoiceId,invoiceSignature:snapshot,kind:"monthly",attemptId:id};
const session={id:sessionId,mode:"payment",livemode:false,status:"complete",payment_status:"paid",
 amount_total:39900,currency:"thb",client_reference_id:id,metadata,
 payment_method_types:["promptpay"],payment_intent:intentId};
const intent={id:intentId,livemode:false,status:"succeeded",currency:"thb",amount:39900,
 amount_received:39900,metadata,payment_method_types:["promptpay"]};
const eventId="evt_shadow_1234567890abc";
const attempt={tenantId,invoiceId,invoiceSignature:snapshot,kind:"monthly",amountSatang:39900,
 currency:"THB",mode:"test",attemptId:id,attemptNo:1,status:"provider_requesting",
 providerCheckoutCreated:false,checkoutSessionId:"",checkoutUrl:"",settled:false,
 accountId,providerFingerprint:fingerprint};
const r=ledger.refs(db,tenantId,invoiceId,id);
async function init(){
 await tenant.set({active:true,billingPolicyVersion:"hybrid_v1"});
 await r.invoice.set({id:invoiceId,tenantId,version:"hybrid-invoice-v1",signature:snapshot,
  kind:"fixed_monthly",amount:399,status:"issued",date:"2026-11-22",createdAt:new Date()});
 await r.attempt.set(attempt);
 await r.lock.set({...attempt,providerClosureVerified:false});
}
test("signed-independent TEST proof: atomic single shadow settlement across 7 concurrent webhooks; invoice stays issued",async()=>{
 await init();
 const results=await Promise.all(Array.from({length:7},()=>ledger.settle({
  db,config:cfg,eventId,reservation:attempt,session,intent})));
 assert.equal(results.filter(r=>r.alreadySettled===false).length,1);
 assert.equal(results.filter(r=>r.alreadySettled===true).length,6);
 const saved=(await r.settlement.get()).data(),after=(await r.invoice.get()).data();
 assert.equal(saved.status,"verified_test_shadow");
 assert.equal(saved.accountId,accountId);assert.equal(saved.amountSatang,39900);
 assert.equal(saved.operationalInvoicePaid,false);
 assert.equal(saved.serviceCreditChanged,false);
 assert.equal(saved.walletChanged,false);
 assert.equal(after.status,"issued");
 assert.equal(after.paidAttemptId,undefined);
 assert.equal(after.serviceCreditApplied,undefined);
 assert.equal((await r.attempt.get()).data().status,"verified_test");
 const intentClaim=(await db.collection("m7StripeTestIntentClaims").doc(intentId).get()).data();
 const eventClaim=(await db.collection("m7StripeTestEventClaims").doc(eventId).get()).data();
 assert.equal(intentClaim.attemptId,id);
 assert.equal(intentClaim.tenantId,tenantId);
 assert.equal(eventClaim.attemptId,id);
 assert.equal(eventClaim.tenantId,tenantId);
 assert.equal((await r.tenant.collection("m7StripeTestSettlements").get()).size,1);
 const retry=await ledger.settle({db,config:cfg,eventId,reservation:(await r.attempt.get()).data(),session,intent});
 assert.equal(retry.alreadySettled,true);
});
test("replayed intent with a different event/amount cannot produce a second shadow credit",async()=>{
 const second="evt_second_1234567890abc";
 const retry=await ledger.settle({db,config:cfg,eventId:second,reservation:(await r.attempt.get()).data(),session,intent});
 assert.equal(retry.alreadySettled,true);
 assert.equal((await r.tenant.collection("m7StripeTestSettlements").get()).size,1);
 const corrupted={...intent,amount_received:10};
 await assert.rejects(ledger.settle({db,config:cfg,eventId:second,reservation:attempt,session,intent:corrupted}),
  /PROVIDER_PROOF_MISMATCH/);
 await assert.rejects(ledger.settle({db,config:{...cfg,accountId:"acct_9876543210abcdef"},
  eventId:second,reservation:attempt,session,intent}),/PROVIDER_PROOF_MISMATCH|RESERVATION_CHANGED/);
});
test("manual invoice payment or adjustment blocks shadow posting without changing any operational record",async()=>{
 const newInvoiceId="2026-11-23:monthly:fixed",newId=randomUUID(),s="c".repeat(64);
 const rr=ledger.refs(db,tenantId,newInvoiceId,newId),meta={...metadata,invoiceId:newInvoiceId,invoiceSignature:s,attemptId:newId};
 const a={...attempt,attemptId:newId,invoiceId:newInvoiceId,invoiceSignature:s};
 const sess={...session,id:"cs_test_9876543210abcdef",client_reference_id:newId,
  metadata:meta,payment_intent:"pi_9876543210abcdef"};
 const int={...intent,id:"pi_9876543210abcdef",metadata:meta};
 await rr.invoice.set({id:newInvoiceId,version:"hybrid-invoice-v1",tenantId,signature:s,
  kind:"fixed_monthly",amount:399,status:"paid",paidAttemptId:"manual-paid"});
 await rr.lock.set(a);await rr.attempt.set(a);
 await assert.rejects(ledger.settle({db,config:cfg,eventId:"evt_conflict_1234567",
  reservation:a,session:sess,intent:int}),/INVOICE_OR_LOCK_CHANGED/);
 assert.equal((await rr.invoice.get()).data().status,"paid");
 assert.equal((await rr.settlement.get()).exists,false);
 await rr.invoice.update({status:"issued",paidAttemptId:null});
 await rr.tenant.collection("hybridBillingAdjustments").doc("adj-"+randomUUID()).set({
  tenantId,invoiceId:newInvoiceId,status:"proposed"});
 await assert.rejects(ledger.settle({db,config:cfg,eventId:"evt_conflict_1234567",
  reservation:a,session:sess,intent:int}),/FINANCIAL_EVIDENCE_CONFLICT/);
 assert.equal((await rr.settlement.get()).exists,false);
});
test("signed metadata mismatch and changed TEST account cannot be proof",async()=>{
 assert.equal(policy.testTenant(), "");
 assert.equal(provider.verifiedTestSettlement({
  reservation:{...attempt,status:"checkout_ready",providerCheckoutCreated:true,
   checkoutSessionId:sessionId},session,intent,expectedAccount:accountId}),true);
 assert.equal(provider.verifiedTestSettlement({
  reservation:{...attempt,status:"checkout_ready",providerCheckoutCreated:true,
   checkoutSessionId:sessionId},session:{...session,metadata:{...metadata,invoiceId:"else"}},
  intent,expectedAccount:accountId}),false);
});
