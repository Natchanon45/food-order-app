"use strict";
// Stripe TEST *shadow* settlement. Does not mutate operational invoices,
// period seals, bank-paid cash, Service Credit, access/holds or wallets.
// Require independently fetched TEST session/intent, NOT a redirect/event body.
const {FieldValue}=require("firebase-admin/firestore");
const invoicePolicy=require("./m7-stripe-test-reservation-policy");
const provider=require("./m7-stripe-test-provider-policy");
const {validInvoiceId}=require("./hybrid-billing-payment-policy");
const failure=message=>{throw Error("M7_TEST_SHADOW_"+message);};
const refs=(db,tenantId,invoiceId,attemptId)=>{
 if(!invoicePolicy.TENANT.test(tenantId)||!invoicePolicy.UUID.test(attemptId))
  failure("IDENTITY_INVALID");
 validInvoiceId(invoiceId);
 const tenant=db.collection("tenants").doc(tenantId);
 return {tenant,invoice:tenant.collection("hybridBillingInvoices").doc(invoiceId),
  lock:tenant.collection("m7StripeTestInvoiceQuotes").doc(invoicePolicy.lockId(tenantId,invoiceId)),
  attempt:tenant.collection("m7StripeTestReservations").doc(attemptId),
  settlement:tenant.collection("m7StripeTestSettlements").doc(attemptId),
  manual:tenant.collection("hybridBillingPaymentAttempts").where("invoiceId","==",invoiceId).limit(26),
  adjustments:tenant.collection("hybridBillingAdjustments").where("invoiceId","==",invoiceId).limit(1)};
};
function checkLocked(invoice,lock,attempt,kind){
 if(!invoice||!lock||!attempt||!["provider_requesting","checkout_ready"].includes(attempt.status)||
    lock.status!==attempt.status||lock.attemptId!==attempt.attemptId||
    lock.attemptNo!==attempt.attemptNo||lock.mode!=="test"||attempt.mode!=="test"||
    lock.invoiceSignature!==attempt.invoiceSignature||
    attempt.invoiceSignature!==invoice.signature||
    attempt.invoiceId!==invoice.id||
    !Number.isSafeInteger(attempt.amountSatang)||attempt.amountSatang!==lock.amountSatang||
    attempt.kind!==kind||lock.kind!==kind||
    invoice.status!=="issued"&&invoice.status!=="rejected"||
    invoice.paidAttemptId||invoice.pendingAttemptId)return false;
 try{
  const expected=invoicePolicy.quote(invoice,invoice.id,attempt.tenantId);
  return expected.kind===kind&&expected.amountSatang===attempt.amountSatang&&
    expected.invoiceSignature===attempt.invoiceSignature;
 }catch{return false;}
}
function shadowStatus(session,attempt){
 const current=attempt.status;
 if(current==="provider_requesting"&&attempt.providerCheckoutCreated===false&&
    attempt.checkoutSessionId===""&&session?.id&&provider.metadata(session.metadata,attempt))
  return {...attempt,status:"checkout_ready",providerCheckoutCreated:true,
   checkoutSessionId:session.id};
 return attempt;
}
async function settle({db,config,eventId,reservation,session,intent,now=Date.now()}){
 if(!config||!provider.EVENT.test(eventId||"")||
    !invoicePolicy.TENANT.test(config.tenantId||"")||
    !provider.ACCOUNT.test(config.accountId||"")||
    !Number.isSafeInteger(now)||now<=0)failure("INVALID_ARGUMENTS");
 if(reservation?.tenantId!==config.tenantId||
    !invoicePolicy.UUID.test(reservation.attemptId||""))failure("RESERVATION_UNTRUSTED");
 const r=refs(db,config.tenantId,reservation.invoiceId,reservation.attemptId);
 const intentClaim=db.collection("m7StripeTestIntentClaims").doc(intent?.id||"_invalid");
 const eventClaim=db.collection("m7StripeTestEventClaims").doc(eventId);
 const effective=reservation.status==="verified_test"
  ?{...reservation,status:"checkout_ready",providerCheckoutCreated:true,
    checkoutSessionId:session.id}
  :shadowStatus(session,reservation);
 if(!provider.verifiedTestSettlement({
  reservation:effective,session,intent,expectedAccount:config.accountId
 }))failure("PROVIDER_PROOF_MISMATCH");
 // Once a provider has verified the money, the transaction is idempotent and
 // the replay proof is compared to the immutable settlement record.
 return db.runTransaction(async tx=>{
  const [tenant,invoice,lock,attempt,settlement,claim,event,manual,adjustments]=await Promise.all([
   tx.get(r.tenant),tx.get(r.invoice),tx.get(r.lock),tx.get(r.attempt),
   tx.get(r.settlement),tx.get(intentClaim),tx.get(eventClaim),
   tx.get(r.manual),tx.get(r.adjustments),
  ]);
  if(tenant.data()?.active!==true)failure("TENANT_INACTIVE");
  const inv=invoice.data(),old=attempt.data(),currentLock=lock.data();
  if(!old||!inv||!currentLock||old.tenantId!==config.tenantId||
    old.invoiceId!==reservation.invoiceId||old.attemptId!==reservation.attemptId||
    old.accountId!==config.accountId||
    old.providerFingerprint!==config.fingerprint)failure("RESERVATION_CHANGED");
  const settled=settlement.data();
  if(old.status==="verified_test"){
   if(!settled||settled.tenantId!==config.tenantId||
      settled.invoiceId!==reservation.invoiceId||
      settled.attemptId!==old.attemptId||
      settled.intentId!==intent.id||settled.sessionId!==session.id||
      settled.amountSatang!==old.amountSatang||claim.data()?.attemptId!==old.attemptId||
      claim.data()?.tenantId!==config.tenantId||currentLock.status!=="verified_test")
    failure("REPLAY_SETTLEMENT_CONFLICT");
   return {ok:true,alreadySettled:true,providerVerified:true,
    invoicePaid:false,operationalSettlementEnabled:false,attemptId:old.attemptId};
  }
  if(settlement.exists||claim.exists||event.exists||
    !manual.empty||!adjustments.empty)failure("FINANCIAL_EVIDENCE_CONFLICT");
  if(!checkLocked(inv,currentLock,old,old.kind))failure("INVOICE_OR_LOCK_CHANGED");
  // Invoice cannot become Paid due to *any* callback in the shadow ledger.
  // Effective reservation may have been attached by this same signed event.
  const original=shadowStatus(session,old);
  if(!provider.verifiedTestSettlement({reservation:original,session,intent,
     expectedAccount:config.accountId}))failure("PROOF_CHANGED_DURING_TRANSACTION");
  const hash=require("node:crypto").createHash("sha256")
   .update(JSON.stringify([config.tenantId,old.invoiceId,old.attemptId,inv.signature,
     session.id,intent.id,old.amountSatang])).digest("hex");
  tx.create(intentClaim,{tenantId:config.tenantId,invoiceId:old.invoiceId,
   attemptId:old.attemptId,sessionId:session.id,mode:"test_shadow"});
  tx.create(eventClaim,{tenantId:config.tenantId,invoiceId:old.invoiceId,
   attemptId:old.attemptId,intentId:intent.id,mode:"test_shadow"});
  tx.create(r.settlement,{tenantId:config.tenantId,invoiceId:old.invoiceId,
   attemptId:old.attemptId,kind:old.kind,invoiceSignature:inv.signature,
   sessionId:session.id,intentId:intent.id,eventId,
   amountSatang:old.amountSatang,currency:"THB",accountId:config.accountId,
   proofDigest:hash,status:"verified_test_shadow",providerVerified:true,
   operationalInvoicePaid:false,serviceCreditChanged:false,
   walletChanged:false,customerPaymentChanged:false,mode:"test_shadow",
   verifiedAtMs:now,createdAt:FieldValue.serverTimestamp()});
  const patch={status:"verified_test",providerCheckoutCreated:true,
   checkoutSessionId:session.id,checkoutUrl:"",intentId:intent.id,
   settled:true,providerVerified:true,verifiedAtMs:now,
   updatedAt:FieldValue.serverTimestamp()};
  tx.update(r.attempt,patch);
  tx.update(r.lock,{status:"verified_test",verifiedAtMs:now,
   updatedAt:FieldValue.serverTimestamp()});
  return {ok:true,alreadySettled:false,providerVerified:true,
   invoicePaid:false,operationalSettlementEnabled:false,attemptId:old.attemptId};
 });
}
module.exports={refs,checkLocked,shadowStatus,settle};
