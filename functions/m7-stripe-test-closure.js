"use strict";
// Superadmin-only independent Stripe TEST expiry closure. One recorded
// provider-expired, unpaid, NO-INTENT Session after cooldown may be closed
// for a NEW non-chargeable quote only. No provider writes or real Paid.
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {randomUUID}=require("node:crypto");
const {validInvoiceId}=require("./hybrid-billing-payment-policy");
const invoice=require("./m7-stripe-test-reservation-policy");
const recovery=require("./m7-stripe-test-recovery");
const list=require("./m7-stripe-test-recovery-policy");
const policy=require("./m7-stripe-test-closure-policy");
const provider=require("./m7-stripe-test-provider-policy");
const shadow=require("./m7-stripe-test-shadow-policy");
const ledger=require("./m7-stripe-test-shadow-ledger");
const adapter=require("./m7-stripe-test-provider-adapter");
const opts={region:"asia-southeast1",timeoutSeconds:80,
 secrets:[adapter.stripeSecret,adapter.hookSecret]};
const fail=(code,message)=>new HttpsError(code,message);
function canonical(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||
   Object.keys(data).length!==3||
   Object.keys(data).some(x=>!["tenantId","invoiceId","attemptId"].includes(x))||
   !invoice.TENANT.test(data.tenantId||"")||
   !invoice.UUID.test(data.attemptId||""))
  throw fail("invalid-argument","M7_TEST_CLOSURE_INPUT_INVALID");
 try{validInvoiceId(data.invoiceId);}catch{
  throw fail("invalid-argument","M7_TEST_CLOSURE_INVOICE_INVALID");
 }
 return data;
}
function config(env=process.env){
 const scope=shadow.ingressGate(env);
 return scope?adapter.config(env,adapter.stripeSecret.value(),
    adapter.hookSecret.value(),"ingress"):null;
}
async function base(db,auth,cfg,data){
 canonical(data);
 await recovery._privateForTests.readActor(db,auth,cfg,data.tenantId);
 const r=ledger.refs(db,data.tenantId,data.invoiceId,data.attemptId);
 const [tenant,invoiceSnap,attemptSnap,lockSnap,settled]=await Promise.all([
  r.tenant.get(),r.invoice.get(),r.attempt.get(),r.lock.get(),r.settlement.get()]);
 const row=attemptSnap.data(),lock=lockSnap.data();
 if(tenant.data()?.active!==true||settled.exists||
    !row||row.invoiceId!==data.invoiceId||row.attemptId!==data.attemptId||
    !list.validConfig(cfg,row,{allowExpired:true})||
    !lock||lock.attemptId!==row.attemptId||lock.status!=="expired_test")
  throw fail("failed-precondition","M7_TEST_CLOSURE_NOT_ELIGIBLE");
 const eventId=row.lifecycleLastEventId;
 if(!provider.EVENT.test(eventId||""))
  throw fail("failed-precondition","M7_TEST_CLOSURE_EVENT_MISSING");
 const lifecycleRef=r.tenant.collection("m7StripeTestLifecycleAudits").doc(eventId);
 const claimRef=db.collection("m7StripeTestEventClaims").doc(eventId);
 const closureRef=r.tenant.collection("m7StripeTestClosureAudits").doc(data.attemptId);
 const [event,claim,closed]=await Promise.all([
  lifecycleRef.get(),claimRef.get(),closureRef.get()]);
 if(closed.exists||!policy.validLocal(row,lock,event.data(),claim.data(),cfg,Date.now()))
  throw fail("failed-precondition","M7_TEST_CLOSURE_PROOF_INVALID");
 let quote;
 try{quote=invoice.quote(invoiceSnap.data(),data.invoiceId,cfg.tenantId);}catch{
  throw fail("failed-precondition","M7_TEST_CLOSURE_INVOICE_CHANGED");
 }
 if(quote.invoiceSignature!==row.invoiceSignature||quote.amountSatang!==row.amountSatang||
    quote.kind!==row.kind)
  throw fail("failed-precondition","M7_TEST_CLOSURE_QUOTE_CHANGED");
 return {r,row,closureRef,lifecycleRef,claimRef};
}
function verifyEvent(row,event,cfg){
 return event?.id===row.lifecycleLastEventId&&
  event.livemode===false&&event.type==="checkout.session.expired"&&
  (!event.account||event.account===cfg.accountId)&&
  event.data?.object?.object==="checkout.session"&&
  event.data.object.livemode===false&&
  event.data.object.id===row.checkoutSessionId&&
  event.data.object.status==="expired"&&
  event.data.object.payment_status==="unpaid"&&
  !event.data.object.payment_intent&&
  event.data.object.metadata?.purpose===provider.PURPOSE&&
  event.data.object.metadata?.tenantId===row.tenantId&&
  event.data.object.metadata?.invoiceId===row.invoiceId&&
  event.data.object.metadata?.attemptId===row.attemptId&&
  event.data.object.metadata?.invoiceSignature===row.invoiceSignature&&
  event.data.object.metadata?.kind===row.kind;
}
async function evidence({config:cfg,row,read,verify,now}){
 try{
  await verify(cfg,read);
  const scanned=await list.scan({config:cfg,row,read,now,allowExpired:true});
  if(scanned.status!=="already_expired")
   return {status:scanned.status==="scan_incomplete"?"scan_incomplete":"no_single_match",
    scannedPages:scanned.scannedPages};
  const session=await read(cfg,"/v1/checkout/sessions/"+row.checkoutSessionId);
  if(!policy.exactExpired(row,session,now))
   return {status:"provider_changed",scannedPages:scanned.scannedPages};
  const event=await read(cfg,"/v1/events/"+row.lifecycleLastEventId);
  if(!verifyEvent(row,event,cfg))
   return {status:"provider_changed",scannedPages:scanned.scannedPages};
  return {status:"can_review_closure",scannedPages:scanned.scannedPages,
   session,verifiedEventId:event.id};
 }catch{
  return {status:"scan_incomplete",scannedPages:0};
 }
}
async function review({db,auth,config:cfg,data,read=adapter.request,
 verify=adapter.verifyAccount,now=Date.now()}){
 const {row}=await base(db,auth,cfg,data);
 const result=await evidence({config:cfg,row,read,verify,now});
 return {...policy.report(row,result.status,result.scannedPages),readOnly:true,
   requiresSuperadminConfirmation:result.status==="can_review_closure"};
}
async function approve({db,auth,config:cfg,data,read=adapter.request,
 verify=adapter.verifyAccount,now=Date.now()}){
 const {r,row,closureRef,lifecycleRef,claimRef}=await base(db,auth,cfg,data);
 const verified=await evidence({config:cfg,row,read,verify,now});
 if(verified.status!=="can_review_closure"||!verified.session||
    verified.verifiedEventId!==row.lifecycleLastEventId)
  throw fail("failed-precondition","M7_TEST_CLOSURE_PROVIDER_UNCONFIRMED");
 const recordId=randomUUID();
 return db.runTransaction(async tx=>{
  const [operator,tenant,inv,l,a,settled,closed,life,claim,manual,adjust]=await Promise.all([
   tx.get(db.collection("users").doc(auth.uid)),
   tx.get(r.tenant),tx.get(r.invoice),tx.get(r.lock),tx.get(r.attempt),
   tx.get(r.settlement),tx.get(closureRef),tx.get(lifecycleRef),
   tx.get(claimRef),tx.get(r.manual),tx.get(r.adjustments),
  ]);
  if(operator.data()?.role!=="super_admin"||operator.data()?.active!==true)
   throw fail("permission-denied","M7_TEST_CLOSURE_OPERATOR_CHANGED");
  const old=a.data(),lock=l.data(),invoiceRow=inv.data();
  if(tenant.data()?.active!==true||settled.exists||closed.exists||
    !old||!lock||old.status!=="expired_test"||
    old.attemptId!==data.attemptId||old.invoiceId!==data.invoiceId||
    old.invoiceSignature!==row.invoiceSignature||
    old.amountSatang!==row.amountSatang||
    old.checkoutSessionId!==row.checkoutSessionId||
    lock.status!=="expired_test"||
    !policy.validLocal(old,lock,life.data(),claim.data(),cfg,now)||
    !manual.empty||!adjust.empty)
   throw fail("failed-precondition","M7_TEST_CLOSURE_STATE_CHANGED");
  let q;
  try{q=invoice.quote(invoiceRow,data.invoiceId,cfg.tenantId);}catch{
   throw fail("failed-precondition","M7_TEST_CLOSURE_INVOICE_CHANGED");
  }
  if(q.invoiceSignature!==old.invoiceSignature||
     q.amountSatang!==old.amountSatang||q.kind!==old.kind)
   throw fail("failed-precondition","M7_TEST_CLOSURE_QUOTE_CHANGED");
  const closedState={status:"expired",providerClosureVerified:true,
   closureAuditId:old.attemptId,checkoutUrl:"",canRetry:false,
   closedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()};
  tx.create(closureRef,{
   tenantId:cfg.tenantId,invoiceId:old.invoiceId,attemptId:old.attemptId,
   invoiceSignature:old.invoiceSignature,amountSatang:old.amountSatang,
   sessionId:old.checkoutSessionId,lifecycleEventId:old.lifecycleLastEventId,
   operatorUid:auth.uid,accountId:cfg.accountId,providerFingerprint:cfg.fingerprint,
   closureReviewId:recordId,status:"reviewed_expired_no_intent",
   providerEvidenceVerified:true,providerPaymentIntentAbsent:true,
   originalLifecycleStatus:"expired_test",newReservationAllowed:true,
   newCheckoutCreated:false,operationalInvoicePaid:false,
   serviceCreditChanged:false,mode:"test_closure",
   scanPages:verified.scannedPages,approvedAtMs:now,
   createdAt:FieldValue.serverTimestamp(),
  });
  tx.update(r.attempt,closedState);
  tx.update(r.lock,closedState);
  return {ok:true,mode:"test",status:"reviewed_expired_no_intent",
   tenantId:cfg.tenantId,invoiceId:old.invoiceId,attemptId:old.attemptId,
   newQuotePermitted:true,newCheckoutCreated:false,
   operationalInvoicePaid:false,serviceCreditChanged:false};
 });
}
exports.reviewPlatformM7StripeTestClosure=onCall(opts,async request=>{
 const cfg=config();
 if(!cfg)throw fail("failed-precondition","M7_TEST_CLOSURE_DISABLED");
 return review({db:getFirestore(),auth:request.auth,config:cfg,data:request.data});
});
exports.approvePlatformM7StripeTestClosure=onCall(opts,async request=>{
 const cfg=config();
 if(!cfg)throw fail("failed-precondition","M7_TEST_CLOSURE_DISABLED");
 return approve({db:getFirestore(),auth:request.auth,config:cfg,data:request.data});
});
exports._privateForTests={config,canonical,base,verifyEvent,evidence,review,approve};
