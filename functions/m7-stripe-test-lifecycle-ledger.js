"use strict";
// Terminal TEST-only provider outcomes are append-only audit facts.
// They cannot mark an invoice paid, release a shop or allow a new charge.
const {FieldValue}=require("firebase-admin/firestore");
const invoice=require("./m7-stripe-test-reservation-policy");
const life=require("./m7-stripe-test-lifecycle-policy");
const provider=require("./m7-stripe-test-provider-policy");
const {refs}=require("./m7-stripe-test-shadow-ledger");
function fail(s){throw Error("M7_TEST_LIFECYCLE_"+s);}
async function record({db,config,eventId,eventType,attempt,session,intent,now=Date.now()}){
 if(!config||!provider.EVENT.test(eventId||"")||!life.EVENTS.has(eventType)||
  !Number.isSafeInteger(now)||now<=0||
  !invoice.TENANT.test(config.tenantId||"")||
  !invoice.UUID.test(attempt?.attemptId||"")||
  attempt.tenantId!==config.tenantId||
  !life.terminalUnpaid(eventType,{
   ...attempt,status:attempt?.status==="expired"?"expired_test":attempt?.status
  },session,intent))
  fail("PROVIDER_PROOF_INVALID");
 const r=refs(db,config.tenantId,attempt.invoiceId,attempt.attemptId);
 const state=life.CLOSED_STATES[eventType];
 const claim=db.collection("m7StripeTestEventClaims").doc(eventId);
 const audit=r.tenant.collection("m7StripeTestLifecycleAudits").doc(eventId);
 const closure=r.tenant.collection("m7StripeTestClosureAudits").doc(attempt.attemptId);
 return db.runTransaction(async tx=>{
  const [t,inv,l,a,s,c,x,manual,adjust,closed]=await Promise.all([
   tx.get(r.tenant),tx.get(r.invoice),tx.get(r.lock),tx.get(r.attempt),
   tx.get(r.settlement),tx.get(claim),tx.get(audit),tx.get(r.manual),tx.get(r.adjustments),
   tx.get(closure),
  ]);
  if(t.data()?.active!==true)fail("TENANT_INACTIVE");
  const old=a.data(),lock=l.data(),invoiceRow=inv.data();
  if(!old||!invoiceRow||
    old.tenantId!==config.tenantId||old.attemptId!==attempt.attemptId||
    old.invoiceId!==attempt.invoiceId||
    old.mode!=="test"||
    old.accountId!==config.accountId||
    old.providerFingerprint!==config.fingerprint||
    old.invoiceSignature!==attempt.invoiceSignature||
    old.amountSatang!==attempt.amountSatang||
    old.kind!==attempt.kind)
   fail("IMMUTABLE_RESERVATION_CHANGED");
  if(!life.terminalUnpaid(eventType,{
   ...old,status:old.status==="expired"?"expired_test":old.status
  },session,intent))
   fail("PROOF_CHANGED_DURING_TRANSACTION");
  if(c.exists){
   const proof=x.data(),claimData=c.data(),close=closed.data();
   const alreadyRecorded=!!proof&&
    claimData.mode==="test_shadow_lifecycle"&&
    claimData.tenantId===config.tenantId&&
    claimData.invoiceId===old.invoiceId&&
    claimData.attemptId===old.attemptId&&
    claimData.sessionId===session.id&&
    proof.mode==="test_shadow_lifecycle"&&
    proof.eventId===eventId&&proof.eventType===eventType&&
    proof.status===state&&proof.tenantId===config.tenantId&&
    proof.invoiceId===old.invoiceId&&proof.attemptId===old.attemptId&&
    proof.invoiceSignature===old.invoiceSignature&&
    proof.amountSatang===old.amountSatang&&
    proof.sessionId===session.id&&
    proof.providerVerifiedUnpaid===true&&proof.invoicePaid===false;
   const normal=old.status===state&&lock?.status===state&&
    lock.attemptId===old.attemptId;
   const postClosure=state==="expired_test"&&old.status==="expired"&&
    old.providerClosureVerified===true&&
    close?.mode==="test_closure"&&
    close.status==="reviewed_expired_no_intent"&&
    close.tenantId===config.tenantId&&
    close.invoiceId===old.invoiceId&&close.attemptId===old.attemptId&&
    close.invoiceSignature===old.invoiceSignature&&
    close.amountSatang===old.amountSatang&&
    close.sessionId===session.id&&
    close.lifecycleEventId===eventId&&
    close.providerPaymentIntentAbsent===true&&
    close.providerEvidenceVerified===true&&
    close.newReservationAllowed===true&&
    close.operationalInvoicePaid===false;
   if(!alreadyRecorded||(!normal&&!postClosure))
    fail("REPLAY_AUDIT_CONFLICT");
   return {ok:true,reused:true,status:state,invoicePaid:false,canRetry:false};
  }
  if(!lock||lock.attemptId!==old.attemptId||
    lock.mode!=="test"||
    lock.invoiceSignature!==attempt.invoiceSignature||
    lock.amountSatang!==attempt.amountSatang||
    lock.kind!==attempt.kind)
   fail("IMMUTABLE_RESERVATION_CHANGED");
  if(s.exists||x.exists||!manual.empty||!adjust.empty||
    invoiceRow.status!=="issued"&&invoiceRow.status!=="rejected"||
    invoiceRow.paidAttemptId||invoiceRow.pendingAttemptId)
   fail("FINANCIAL_STATE_CONFLICT");
  const q=invoice.quote(invoiceRow,old.invoiceId,config.tenantId);
  if(q.invoiceSignature!==old.invoiceSignature||q.amountSatang!==old.amountSatang)
   fail("INVOICE_SNAPSHOT_CONFLICT");
  if(old.status!==state&&
     !["checkout_ready","provider_requesting"].includes(old.status))
   fail("LIFECYCLE_STATUS_CONFLICT");
  if(lock.status!==old.status)fail("LOCK_STATUS_CONFLICT");
  const patch={status:state,providerCheckoutCreated:true,
   checkoutSessionId:session.id,checkoutUrl:"",providerClosureVerified:false,
   canRetry:false,lifecycleLastEventId:eventId,
   updatedAt:FieldValue.serverTimestamp()};
  tx.create(claim,{tenantId:config.tenantId,invoiceId:old.invoiceId,
   attemptId:old.attemptId,sessionId:session.id,mode:"test_shadow_lifecycle"});
  tx.create(audit,{tenantId:config.tenantId,invoiceId:old.invoiceId,
   attemptId:old.attemptId,invoiceSignature:old.invoiceSignature,
   sessionId:session.id,eventId,eventType,status:state,
   amountSatang:old.amountSatang,accountId:config.accountId,
   providerVerifiedUnpaid:true,invoicePaid:false,canRetry:false,
   mode:"test_shadow_lifecycle",auditedAtMs:now,
   createdAt:FieldValue.serverTimestamp()});
  tx.update(r.attempt,patch);
  tx.update(r.lock,patch);
  return {ok:true,reused:false,status:state,invoicePaid:false,canRetry:false};
 });
}
module.exports={record};
