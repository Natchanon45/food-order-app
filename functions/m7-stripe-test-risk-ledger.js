"use strict";
// Record verified TEST refund/dispute evidence without creating a refund,
// reversing cash, changing an invoice, wallet, hold or Service Credit.
const {FieldValue}=require("firebase-admin/firestore");
const shadow=require("./m7-stripe-test-shadow-ledger");
const stripe=require("./m7-stripe-test-provider-policy");
const risk=require("./m7-stripe-test-risk-policy");
const invoice=require("./m7-stripe-test-reservation-policy");
function fail(code){throw Error("M7_TEST_RISK_"+code);}
async function record({db,config,riskEvidence,session,intent,now=Date.now()}){
 const e=riskEvidence;
 if(!config||!invoice.TENANT.test(config.tenantId||"")||
    !stripe.ACCOUNT.test(config.accountId||"")||
    !stripe.EVENT.test(e?.eventId||"")||
    !risk.EVENTS.has(e?.eventType)||
    !risk.CHARGE.test(e?.chargeId||"")||
    !stripe.INTENT.test(e?.intentId||"")||
    !Number.isSafeInteger(e.reversedSatang)||e.reversedSatang<1||
    e.providerEvidenceVerified!==true||
    !Number.isSafeInteger(now)||now<=0)fail("PROVIDER_PROOF_INVALID");
 const claim=db.collection("m7StripeTestIntentClaims").doc(e.intentId);
 const claimSnapshot=await claim.get(),owner=claimSnapshot.data();
 if(!owner||owner.tenantId!==config.tenantId||
    !invoice.UUID.test(owner.attemptId||""))fail("INTENT_NOT_IN_M7_TEST_LEDGER");
 const r=shadow.refs(db,config.tenantId,owner.invoiceId,owner.attemptId);
 const eventClaim=db.collection("m7StripeTestEventClaims").doc(e.eventId);
 const audit=r.tenant.collection("m7StripeTestRiskAudits").doc(e.eventId);
 return db.runTransaction(async tx=>{
  const [t,invoiceSnap,attemptSnap,lockSnap,settlementSnap,intentSnap,
   eventSnap,auditSnap]=await Promise.all([
    tx.get(r.tenant),tx.get(r.invoice),tx.get(r.attempt),tx.get(r.lock),
    tx.get(r.settlement),tx.get(claim),tx.get(eventClaim),tx.get(audit),
   ]);
  if(t.data()?.active!==true)fail("TENANT_INACTIVE");
  const row=attemptSnap.data(),lock=lockSnap.data(),settled=settlementSnap.data();
  if(!row||!lock||!settled||!invoiceSnap.exists||
    row.tenantId!==config.tenantId||row.attemptId!==owner.attemptId||
    row.invoiceId!==owner.invoiceId||
    row.status!=="verified_test"||lock.status!=="verified_test"||
    lock.attemptId!==owner.attemptId||
    row.accountId!==config.accountId||
    row.providerFingerprint!==config.fingerprint||
    settled.status!=="verified_test_shadow"||settled.providerVerified!==true||
    settled.operationalInvoicePaid!==false||
    settled.tenantId!==row.tenantId||settled.invoiceId!==row.invoiceId||
    settled.attemptId!==row.attemptId||settled.invoiceSignature!==row.invoiceSignature||
    settled.amountSatang!==row.amountSatang||
    settled.intentId!==e.intentId||settled.sessionId!==row.checkoutSessionId||
    intentSnap.data()?.tenantId!==row.tenantId||
    intentSnap.data()?.invoiceId!==row.invoiceId||
    intentSnap.data()?.attemptId!==row.attemptId||
    intentSnap.data()?.sessionId!==row.checkoutSessionId||
    e.chargeTotalSatang!==row.amountSatang||
    e.reversedSatang>row.amountSatang)
   fail("SHADOW_SETTLEMENT_NOT_BOUND");
  const original={...row,status:"checkout_ready",
   providerCheckoutCreated:true,checkoutSessionId:row.checkoutSessionId};
  if(!stripe.verifiedTestSettlement({reservation:original,session,intent,
    expectedAccount:config.accountId}))fail("PROVIDER_INTENT_MISMATCH");
  if(eventSnap.exists){
   const prev=auditSnap.data();
   if(!auditSnap.exists||eventSnap.data()?.tenantId!==row.tenantId||
      eventSnap.data()?.attemptId!==row.attemptId||
      prev?.eventId!==e.eventId||prev?.eventType!==e.eventType||
      prev?.status!==e.status||prev?.intentId!==e.intentId||
      prev?.chargeId!==e.chargeId||prev?.reversedSatang!==e.reversedSatang)
    fail("RISK_REPLAY_CONFLICT");
   return {ok:true,alreadyAudited:true,status:e.status,
    providerTestModeOnly:true,invoicePaid:false};
  }
  if(auditSnap.exists)fail("RISK_AUDIT_EXISTS_WITHOUT_EVENT");
  tx.create(eventClaim,{tenantId:row.tenantId,invoiceId:row.invoiceId,
   attemptId:row.attemptId,sessionId:row.checkoutSessionId,
   mode:"test_shadow_risk"});
  tx.create(audit,{tenantId:row.tenantId,invoiceId:row.invoiceId,
   attemptId:row.attemptId,eventId:e.eventId,eventType:e.eventType,
   status:e.status,sessionId:row.checkoutSessionId,intentId:e.intentId,
   chargeId:e.chargeId,accountId:config.accountId,
   amountSatang:row.amountSatang,reversedSatang:e.reversedSatang,
   providerEvidenceVerified:true,invoicePaid:false,
   serviceCreditChanged:false,walletChanged:false,
   mode:"test_shadow_risk",recordedAtMs:now,
   createdAt:FieldValue.serverTimestamp()});
  tx.update(r.attempt,{riskStatus:e.status,riskEventId:e.eventId,
   riskLastAtMs:now,updatedAt:FieldValue.serverTimestamp()});
  return {ok:true,alreadyAudited:false,status:e.status,
   providerTestModeOnly:true,invoicePaid:false};
 });
}
module.exports={record};
