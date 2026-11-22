"use strict";
// Never release a payment lock without independent, complete TEST provider
// closure. This policy intentionally supports ONLY expired sessions with NO
// PaymentIntent, never asynchronous failures or partial/paid intents.
const provider=require("./m7-stripe-test-provider-policy");
const recovery=require("./m7-stripe-test-recovery-policy");
const MIN_COOLDOWN_MS=30*60*1000;
function validLocal(row,lock,lifecycle,claim,config,now=Date.now()){
 if(!config||!recovery.validConfig(config,row,{allowExpired:true})||
    !lock||lock.attemptId!==row.attemptId||lock.status!=="expired_test"||
    lock.tenantId!==row.tenantId||lock.invoiceId!==row.invoiceId||
    lock.invoiceSignature!==row.invoiceSignature||
    lock.amountSatang!==row.amountSatang||lock.kind!==row.kind||
    lock.accountId!==config.accountId||
    lock.providerFingerprint!==config.fingerprint||
    lock.providerClosureVerified!==false||
    lock.checkoutSessionId!==row.checkoutSessionId||
    row.providerClosureVerified!==false||
    !provider.EVENT.test(row.lifecycleLastEventId||"")||
    !lifecycle||lifecycle.mode!=="test_shadow_lifecycle"||
    lifecycle.status!=="expired_test"||
    lifecycle.eventType!=="checkout.session.expired"||
    lifecycle.eventId!==row.lifecycleLastEventId||
    lifecycle.sessionId!==row.checkoutSessionId||
    lifecycle.tenantId!==row.tenantId||
    lifecycle.invoiceId!==row.invoiceId||
    lifecycle.attemptId!==row.attemptId||
    lifecycle.invoiceSignature!==row.invoiceSignature||
    lifecycle.amountSatang!==row.amountSatang||
    lifecycle.accountId!==config.accountId||
    lifecycle.providerVerifiedUnpaid!==true||
    lifecycle.invoicePaid!==false||lifecycle.canRetry!==false||
    !claim||claim.mode!=="test_shadow_lifecycle"||
    claim.tenantId!==row.tenantId||
    claim.invoiceId!==row.invoiceId||
    claim.attemptId!==row.attemptId||
    claim.sessionId!==row.checkoutSessionId||
    !Number.isSafeInteger(lifecycle.auditedAtMs)||lifecycle.auditedAtMs<=0||
    !Number.isSafeInteger(now)||now-lifecycle.auditedAtMs<MIN_COOLDOWN_MS)
  return false;
 return true;
}
function exactExpired(row,session,now=Date.now()){
 const range=recovery.windowFor(row,now);
 if(!range||!recovery.validSession(row,session)||
    session.id!==row.checkoutSessionId||
    session.created<range.gte||session.created>range.lte||
    session.status!=="expired"||session.payment_status!=="unpaid"||
    session.payment_intent!==null&&session.payment_intent!==undefined||
    !Number.isSafeInteger(session.expires_at)||session.expires_at<=0||
    now-session.expires_at*1000<MIN_COOLDOWN_MS)
  return false;
 return true;
}
function report(row,state,scannedPages=0){
 if(!["can_review_closure","requires_review","provider_changed",
       "scan_incomplete","cooldown","no_single_match"].includes(state))
  throw Error("M7_TEST_CLOSURE_REPORT_INVALID");
 return {ok:true,mode:"test",tenantId:row.tenantId,invoiceId:row.invoiceId,
  attemptId:row.attemptId,amountSatang:row.amountSatang,currency:"THB",
  status:state,scannedPages,eligibleForOperatorApproval:state==="can_review_closure",
  canCreateNewCheckout:false,operationalInvoicePaid:false,
  serviceCreditChanged:false,providerClosureVerified:false};
}
module.exports={MIN_COOLDOWN_MS,validLocal,exactExpired,report};
