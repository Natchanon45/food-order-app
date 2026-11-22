import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
const project="demo-penguin-hybrid";
if(process.env.GCLOUD_PROJECT!==project||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore,Timestamp}=require("firebase-admin/firestore");
if(!getApps().length)initializeApp({projectId:project});
const db=getFirestore(),realPolicy=require("./m7-stripe-test-reservation-policy");
const tenantId="m7-stripe-test-"+randomUUID(),otherTenant="m7-stripe-other-"+randomUUID();
const ownerId="owner-"+randomUUID(),adminId="admin-"+randomUUID(),cashierId="cashier-"+randomUUID(),otherId="other-"+randomUUID(),superId="super-"+randomUUID();
const tenant=db.collection("tenants").doc(tenantId);
const invoiceId="2026-11-22:monthly:fixed",invoiceDaily="2026-11-22:delivery:2026-11-21";
const signature="c".repeat(64);
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const pilotPolicy={...realPolicy,testTenant:()=>tenantId};
const exports={};
new Function("exports","require",readFileSync("functions/m7-stripe-test-reservation.js","utf8"))(
 exports,name=>({
  "firebase-functions/v2/https":{onCall:(_,fn)=>fn,HttpsError},
  "firebase-admin/firestore":{getFirestore:()=>db,FieldValue:require("firebase-admin/firestore").FieldValue},
  "./m7-stripe-test-reservation-policy":pilotPolicy,
 }[name]||require(name)));
const reserve=async(id=invoiceId,uid=ownerId)=>exports._privateForTests.reserve({
 db,auth:{uid},invoiceId:id,allowedTenant:tenantId});
test("server-only reservation matches immutable invoice, reuses one across 7 concurrent tabs",async()=>{
 await Promise.all([
  tenant.set({active:true,billingPolicyVersion:"hybrid_v1",name:"Synthetic Test Tenant"}),
  db.collection("tenants").doc(otherTenant).set({active:true}),
  db.collection("users").doc(ownerId).set({active:true,role:"owner",tenantId}),
  db.collection("users").doc(adminId).set({active:true,role:"admin",tenantId}),
  db.collection("users").doc(cashierId).set({active:true,role:"cashier",tenantId}),
  db.collection("users").doc(otherId).set({active:true,role:"owner",tenantId:otherTenant}),
  db.collection("users").doc(superId).set({active:true,role:"super_admin"}),
 ]);
 const inv=tenant.collection("hybridBillingInvoices");
 await inv.doc(invoiceId).set({id:invoiceId,tenantId,version:"hybrid-invoice-v1",
  signature,kind:"fixed_monthly",amount:399.00,status:"issued",date:"2026-11-22"});
 await inv.doc(invoiceDaily).set({id:invoiceDaily,tenantId,version:"hybrid-invoice-v1",
  signature:"d".repeat(64),kind:"delivery_daily",amount:75.55,status:"issued",date:"2026-11-21"});
 const quotes=await Promise.all(Array.from({length:7},()=>reserve()));
 assert.equal(quotes.filter(x=>x.reused===false).length,1);
 assert.equal(quotes.filter(x=>x.reused===true).length,6);
 assert.equal(new Set(quotes.map(x=>x.quote.attemptId)).size,1);
 assert.ok(quotes.every(x=>x.quote.checkoutEnabled===false&&x.quote.settlementEnabled===false&&x.readOnlyFinancials===true));
 assert.equal(quotes[0].quote.amountSatang,39900);
 assert.equal(quotes[0].quote.currency,"THB");
 const attempts=await tenant.collection("m7StripeTestReservations").get();
 assert.equal(attempts.size,1);
 assert.equal(attempts.docs[0].data().providerCheckoutCreated,false);
 assert.equal(attempts.docs[0].data().checkoutSessionId,"");
 assert.equal(attempts.docs[0].data().settled,false);
 const locked=await tenant.collection("m7StripeTestInvoiceQuotes").get();
 assert.equal(locked.size,1);
 assert.equal((await inv.doc(invoiceId).get()).data().status,"issued");
 assert.equal((await reserve(invoiceDaily,adminId)).quote.amountSatang,7555);
 assert.equal((await tenant.collection("hybridBillingInvoices").doc(invoiceDaily).get()).data().status,"issued");
});
test("fail-closed role/tenant/cross-writer/adjustment/invoice amount changes",async()=>{
 for(const id of [cashierId,superId])
  await assert.rejects(reserve(invoiceId,id),{code:"permission-denied"});
 await assert.rejects(reserve(invoiceId,otherId),{code:"failed-precondition"});
 await assert.rejects(reserve("not-an-invoice"),{code:"invalid-argument"});
 await assert.rejects(reserve("2026-11-23:monthly:fixed"),{code:"not-found"});
 const ref=tenant.collection("hybridBillingInvoices").doc(invoiceId);
 await ref.update({amount:399.01});
 await assert.rejects(reserve(),{code:"failed-precondition"});
 await ref.update({amount:399});
 await tenant.collection("hybridBillingAdjustments").doc("adj-"+randomUUID()).set({invoiceId,status:"proposed",amount:1});
 await assert.rejects(reserve(),{code:"failed-precondition"});
 const adjustments=await tenant.collection("hybridBillingAdjustments").get();
 for(const d of adjustments.docs)await d.ref.delete();
 await tenant.collection("hybridBillingPaymentAttempts").doc("manual-"+randomUUID()).set({
  tenantId,invoiceId,status:"pending_review",amount:399});
 await assert.rejects(reserve(),{code:"failed-precondition"});
 const originals=await tenant.collection("hybridBillingPaymentAttempts").get();
 for(const d of originals.docs)await d.ref.update({status:"rejected"});
 assert.equal((await reserve()).reused,true);
 await ref.update({status:"paid"});
 await assert.rejects(reserve(),{code:"failed-precondition"});
 await ref.update({status:"issued"});
 const quoteRef=tenant.collection("m7StripeTestInvoiceQuotes").doc(realPolicy.lockId(tenantId,invoiceId));
 await quoteRef.update({status:"checkout_ready"});
 await assert.rejects(reserve(),{code:"failed-precondition"});
 await quoteRef.update({status:"reserved",invoiceSignature:"e".repeat(64)});
 await assert.rejects(reserve(),{code:"failed-precondition"});
 await quoteRef.update({invoiceSignature:signature});
 const attempts=await tenant.collection("m7StripeTestReservations").get();
 const selected=attempts.docs.find(doc=>doc.data().invoiceId===invoiceId);
 await selected.ref.update({providerCheckoutCreated:true,checkoutSessionId:"cs_test_unknown"});
 await assert.rejects(reserve(),{code:"failed-precondition"});
 await db.collection("users").doc(ownerId).update({active:false});
 await assert.rejects(reserve(),{code:"permission-denied"});
});
test("only exact isolated TEST project enables quote availability; no provider charge path",async()=>{
 const env={GCLOUD_PROJECT:"penguin-m7-private-uat",PENGUIN_M7_STRIPE_TEST_PROJECT_ID:"penguin-m7-private-uat",
  PENGUIN_M7_STRIPE_TEST_TENANT_ID:tenantId,PENGUIN_M7_STRIPE_TEST_RESERVATIONS_ENABLED:"1"};
 assert.equal(realPolicy.testTenant(env),tenantId);
 for(const patch of [
  {GCLOUD_PROJECT:"penguin-food",PENGUIN_M7_STRIPE_TEST_PROJECT_ID:"penguin-food"},
  {GCLOUD_PROJECT:"demo-any",PENGUIN_M7_STRIPE_TEST_PROJECT_ID:"demo-any"},
  {PENGUIN_M7_STRIPE_TEST_PROJECT_ID:"wrong-id"},
  {FUNCTIONS_EMULATOR:"true"},
  {FIRESTORE_EMULATOR_HOST:"127.0.0.1:18080"},
  {PENGUIN_M7_STRIPE_TEST_CHECKOUT_ENABLED:"1"},
  {PENGUIN_M7_STRIPE_TEST_SETTLEMENT_ENABLED:"1"},
  {PENGUIN_M7_STRIPE_TEST_RESERVATIONS_ENABLED:"0"},
 ]){
  assert.equal(realPolicy.testTenant({...env,...patch}),"",JSON.stringify(patch));
 }
 const real=require("./m7-stripe-test-reservation");
 const available=await real.getOwnM7StripeTestQuoteReadiness.run({data:{},auth:{uid:ownerId}});
 assert.equal(available.quoteEnabled,false);
 assert.equal(available.checkoutEnabled,false);
 assert.equal(available.settlementEnabled,false);
 await assert.rejects(real.reserveOwnM7StripeTestInvoice.run({data:{invoiceId},auth:{uid:ownerId}}),{code:"failed-precondition"});
});
