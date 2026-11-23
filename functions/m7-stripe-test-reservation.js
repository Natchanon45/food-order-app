"use strict";
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {randomUUID}=require("node:crypto");
const policy=require("./m7-stripe-test-reservation-policy");
const options={region:"asia-southeast1",timeoutSeconds:30};
const ID=policy.TENANT;
const error=(code,message)=>new HttpsError(code,message);
function canonical(payload,fields){
 if(!payload||typeof payload!=="object"||Array.isArray(payload)||
    Object.keys(payload).some(k=>!fields.includes(k)))throw error("invalid-argument","M7_STRIPE_TEST_REQUEST_INVALID");
 return payload;
}
async function merchant(db,auth,tx){
 const uid=auth?.uid;
 if(typeof uid!=="string"||!ID.test(uid))throw error("unauthenticated","Sign-in required");
 const u=(await (tx?tx.get(db.collection("users").doc(uid)):db.collection("users").doc(uid).get())).data();
 if(u?.active!==true||!["owner","admin"].includes(u.role)||!ID.test(u.tenantId||""))
  throw error("permission-denied","Merchant finance admin required");
 if(policy.testTenant()!==u.tenantId)throw error("failed-precondition","M7_STRIPE_TEST_QUOTE_DISABLED");
 const tenant=(await (tx?tx.get(db.collection("tenants").doc(u.tenantId)):db.collection("tenants").doc(u.tenantId).get())).data();
 if(!tenant||tenant.active!==true)throw error("failed-precondition","M7_STRIPE_TEST_TENANT_UNAVAILABLE");
 return u.tenantId;
}
function refs(db,tenantId,invoiceId,attemptId){
 const tenant=db.collection("tenants").doc(tenantId);
 return {tenant,invoice:tenant.collection("hybridBillingInvoices").doc(invoiceId),
  lock:tenant.collection("m7StripeTestInvoiceQuotes").doc(policy.lockId(tenantId,invoiceId)),
  attempt:attemptId?tenant.collection("m7StripeTestReservations").doc(attemptId):null};
}
async function reserve({db,auth,invoiceId,allowedTenant,uuid=randomUUID}){
 if(typeof invoiceId!=="string")throw error("invalid-argument","M7_STRIPE_TEST_INVOICE_ID_INVALID");
 try{policy.invoiceKey(invoiceId);}catch{throw error("invalid-argument","M7_STRIPE_TEST_INVOICE_ID_INVALID");}
 return db.runTransaction(async tx=>{
  const tenantId=await merchant(db,auth,tx);
  if(!allowedTenant||allowedTenant!==tenantId)throw error("failed-precondition","M7_STRIPE_TEST_QUOTE_DISABLED");
  const {tenant,invoice,lock}=refs(db,tenantId,invoiceId);
  const adjustments=tenant.collection("hybridBillingAdjustments").where("invoiceId","==",invoiceId).limit(1);
  const manual=tenant.collection("hybridBillingPaymentAttempts").where("invoiceId","==",invoiceId).limit(policy.MAX_ATTEMPTS+1);
  // Every read precedes any write; the transaction retries on invoice/lock change.
  const [inv,old,adjustSnap,manualSnap]=await Promise.all([
   tx.get(invoice),tx.get(lock),tx.get(adjustments),tx.get(manual)]);
  if(!inv.exists)throw error("not-found","M7_STRIPE_TEST_INVOICE_NOT_FOUND");
  let quote;
  try{
   quote=policy.quote(inv.data(),invoiceId,tenantId);
   if(!adjustSnap.empty)throw Error("M7_STRIPE_TEST_ADJUSTMENT_UNRESOLVED");
   policy.blockOriginalAttempts(manualSnap.docs.map(d=>d.data()));
  }catch{
   throw error("failed-precondition","M7_STRIPE_TEST_QUOTE_CONFLICT");
  }
  let saved=null,attemptNo=1;
  if(old.exists){
   const prior=old.data();
   if(!policy.validatePrior(prior,tenantId,invoiceId,quote))
    throw error("failed-precondition","M7_STRIPE_TEST_LOCK_CONFLICT");
   const priorAttempt=await tx.get(refs(db,tenantId,invoiceId,prior.attemptId).attempt);
   if(!priorAttempt.exists||!policy.validatePrior(priorAttempt.data(),tenantId,invoiceId,quote)||
      priorAttempt.data().attemptNo!==prior.attemptNo||
      priorAttempt.data().status!==prior.status||
      prior.status==="reserved"&&(
        prior.providerCheckoutCreated===true||prior.checkoutSessionId||prior.checkoutUrl||prior.settled||
        priorAttempt.data().providerCheckoutCreated!==false||
        priorAttempt.data().checkoutSessionId!==""||
        priorAttempt.data().checkoutUrl!==""||
        priorAttempt.data().settled!==false))
    throw error("failed-precondition","M7_STRIPE_TEST_ATTEMPT_INCONSISTENT");
   if(prior.status==="reserved")saved=priorAttempt.data();
   else if(prior.status==="expired"&&prior.providerClosureVerified===true&&
      priorAttempt.data().providerClosureVerified===true&&
      prior.closureAuditId===prior.attemptId&&
      priorAttempt.data().closureAuditId===prior.attemptId){
    const oldAttempt=priorAttempt.data();
    const eventId=oldAttempt.lifecycleLastEventId;
    if(!/^evt_[A-Za-z0-9_]{8,240}$/.test(eventId||"")||
      !/^cs_test_[A-Za-z0-9_]{8,240}$/.test(oldAttempt.checkoutSessionId||"")||
      oldAttempt.checkoutSessionId!==prior.checkoutSessionId||
      oldAttempt.checkoutUrl!==""||prior.checkoutUrl!==""||
      oldAttempt.settled!==false||prior.settled!==false)
     throw error("failed-precondition","M7_STRIPE_TEST_CLOSURE_PROOF_MISSING");
    const [closure,terminal,eventClaim,settlement]=await Promise.all([
     tx.get(tenant.collection("m7StripeTestClosureAudits").doc(prior.attemptId)),
     tx.get(tenant.collection("m7StripeTestLifecycleAudits").doc(eventId)),
     tx.get(db.collection("m7StripeTestEventClaims").doc(eventId)),
     tx.get(tenant.collection("m7StripeTestSettlements").doc(prior.attemptId)),
    ]);
    const evidence=closure.data(),life=terminal.data(),claim=eventClaim.data();
    if(settlement.exists||
      evidence?.mode!=="test_closure"||
      evidence.status!=="reviewed_expired_no_intent"||
      evidence.providerEvidenceVerified!==true||
      evidence.providerPaymentIntentAbsent!==true||
      evidence.newReservationAllowed!==true||
      evidence.newCheckoutCreated!==false||
      evidence.operationalInvoicePaid!==false||
      evidence.tenantId!==tenantId||evidence.invoiceId!==invoiceId||
      evidence.attemptId!==prior.attemptId||
      evidence.invoiceSignature!==quote.invoiceSignature||
      evidence.amountSatang!==quote.amountSatang||
      evidence.sessionId!==oldAttempt.checkoutSessionId||
      evidence.lifecycleEventId!==eventId||
      evidence.accountId!==oldAttempt.accountId||
      evidence.providerFingerprint!==oldAttempt.providerFingerprint||
      evidence.operatorUid==null||
      life?.mode!=="test_shadow_lifecycle"||
      life.eventType!=="checkout.session.expired"||
      life.status!=="expired_test"||
      life.tenantId!==tenantId||life.invoiceId!==invoiceId||
      life.attemptId!==prior.attemptId||
      life.invoiceSignature!==quote.invoiceSignature||
      life.amountSatang!==quote.amountSatang||
      life.sessionId!==oldAttempt.checkoutSessionId||
      life.providerVerifiedUnpaid!==true||life.invoicePaid!==false||
      claim?.mode!=="test_shadow_lifecycle"||
      claim.tenantId!==tenantId||claim.invoiceId!==invoiceId||
      claim.attemptId!==prior.attemptId||
      claim.sessionId!==oldAttempt.checkoutSessionId)
     throw error("failed-precondition","M7_STRIPE_TEST_CLOSURE_AUDIT_CONFLICT");
    attemptNo=prior.attemptNo+1;
    if(attemptNo>policy.MAX_ATTEMPTS)throw error("failed-precondition","M7_STRIPE_TEST_ATTEMPT_LIMIT");
   }else throw error("failed-precondition","M7_STRIPE_TEST_PRIOR_ATTEMPT_NEEDS_REVIEW");
  }
  if(saved)return {ok:true,quote:policy.publicQuote(saved),reused:true,readOnlyFinancials:true};
  const attemptId=uuid();
  if(!policy.UUID.test(attemptId))throw error("failed-precondition","M7_STRIPE_TEST_UUID_UNAVAILABLE");
  const attempt=refs(db,tenantId,invoiceId,attemptId).attempt;
  const preexisting=await tx.get(attempt);
  if(preexisting.exists)throw error("already-exists","M7_STRIPE_TEST_DUPLICATE_ATTEMPT");
  const row={...quote,attemptId,attemptNo,status:"reserved",providerCheckoutCreated:false,
   checkoutSessionId:"",checkoutUrl:"",settled:false,createdBy:auth.uid,
   createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()};
  tx.create(attempt,row);
  tx.set(lock,{...quote,attemptId,attemptNo,status:"reserved",providerClosureVerified:false,
   createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  return {ok:true,quote:policy.publicQuote(row),reused:false,readOnlyFinancials:true};
 });
}
exports.getOwnM7StripeTestQuoteReadiness=onCall(options,async request=>{
 canonical(request.data||{},[]);
 const enabled=policy.testTenant();
 if(!enabled)return {ok:true,quoteEnabled:false,checkoutEnabled:false,settlementEnabled:false,invoices:[]};
 const db=getFirestore(),tenantId=await merchant(db,request.auth);
 const inv=await db.collection("tenants").doc(tenantId).collection("hybridBillingInvoices")
  .orderBy("date","desc").limit(31).get();
 const invoices=[];
 for(const d of inv.docs){
  try{
   const q=policy.quote(d.data(),d.id,tenantId);
   invoices.push({invoiceId:d.id,amountSatang:q.amountSatang,kind:q.kind,currency:"THB",
    status:"eligible_for_quote_only"});
  }catch{}
 }
 return {ok:true,quoteEnabled:true,checkoutEnabled:false,settlementEnabled:false,invoices:invoices.slice(0,30),
  hasMore:inv.size>30};
});
exports.reserveOwnM7StripeTestInvoice=onCall(options,async request=>{
 canonical(request.data||{},["invoiceId"]);
 const allowedTenant=policy.testTenant();
 if(!allowedTenant)throw error("failed-precondition","M7_STRIPE_TEST_QUOTE_DISABLED");
 return reserve({db:getFirestore(),auth:request.auth,invoiceId:request.data.invoiceId,allowedTenant});
});
exports._privateForTests={merchant,canonical,refs,reserve};
