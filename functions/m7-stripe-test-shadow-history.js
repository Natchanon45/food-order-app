"use strict";
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {getFirestore}=require("firebase-admin/firestore");
const shadow=require("./m7-stripe-test-shadow-policy");
const policy=require("./m7-stripe-test-reservation-policy");
const options={region:"asia-southeast1",timeoutSeconds:25};
async function actor(db,auth){
 if(!policy.TENANT.test(auth?.uid||""))
  throw new HttpsError("unauthenticated","Sign-in required");
 const doc=(await db.collection("users").doc(auth.uid).get()).data();
 if(doc?.active!==true)throw new HttpsError("permission-denied","Active profile required");
 return doc;
}
function view(attempt,settlement,lifecycleAudit,riskAudit){
 const a=attempt||{},s=settlement||{},audit=lifecycleAudit||{},risk=riskAudit||{};
 const expected=a.status==="verified_test"&&s.status==="verified_test_shadow"&&
  s.providerVerified===true&&s.operationalInvoicePaid===false&&
  s.mode==="test_shadow"&&
  s.tenantId===a.tenantId&&s.invoiceId===a.invoiceId&&
  s.attemptId===a.attemptId&&s.invoiceSignature===a.invoiceSignature&&
  s.amountSatang===a.amountSatang&&s.currency==="THB"&&
  s.intentId===a.intentId&&s.sessionId===a.checkoutSessionId&&
  s.accountId===a.accountId&&s.proofDigest&&/^[a-f0-9]{64}$/.test(s.proofDigest);
 const lifecycleType=a.status==="expired_test"?"checkout.session.expired":
   a.status==="payment_failed_test"?"checkout.session.async_payment_failed":"";
 const terminal=!!lifecycleType&&audit.mode==="test_shadow_lifecycle"&&
  audit.eventType===lifecycleType&&audit.status===a.status&&
  audit.eventId===a.lifecycleLastEventId&&
  audit.tenantId===a.tenantId&&audit.invoiceId===a.invoiceId&&
  audit.attemptId===a.attemptId&&audit.invoiceSignature===a.invoiceSignature&&
  audit.amountSatang===a.amountSatang&&audit.sessionId===a.checkoutSessionId&&
  audit.accountId===a.accountId&&audit.providerVerifiedUnpaid===true&&
  audit.invoicePaid===false&&audit.canRetry===false&&
  a.providerClosureVerified===false&&a.settled!==true&&!settlement;
 const riskType=a.riskStatus==="refund_review"?"charge.refunded":
  a.riskStatus==="dispute_review"?"charge.dispute.created":"";
 const riskConfirmed=!!riskType&&risk.mode==="test_shadow_risk"&&
  risk.eventId===a.riskEventId&&risk.eventType===riskType&&
  risk.status===a.riskStatus&&risk.tenantId===a.tenantId&&
  risk.invoiceId===a.invoiceId&&risk.attemptId===a.attemptId&&
  risk.sessionId===a.checkoutSessionId&&risk.intentId===a.intentId&&
  risk.accountId===a.accountId&&risk.amountSatang===a.amountSatang&&
  Number.isSafeInteger(risk.reversedSatang)&&risk.reversedSatang>0&&
  risk.reversedSatang<=a.amountSatang&&
  risk.providerEvidenceVerified===true&&risk.invoicePaid===false&&
  risk.serviceCreditChanged===false&&risk.walletChanged===false;
 const state=a.status==="verified_test"?
   riskType?(riskConfirmed&&expected?
     (riskType==="charge.refunded"?"provider_test_refund_review":"provider_test_dispute_review"):"needs_review"):
    (expected?"provider_test_verified":"needs_review"):
  lifecycleType?(terminal?a.status:"needs_review"):
  ["reserved","provider_requesting","checkout_ready"].includes(a.status)?a.status:"needs_review";
 const timestamp=a.createdAt?.toDate?.()||null;
 return {invoiceId:String(a.invoiceId||"").slice(0,100),
  attemptId:String(a.attemptId||"").slice(0,60),
  amountSatang:Number.isSafeInteger(a.amountSatang)?a.amountSatang:null,
  currency:"THB",kind:a.kind==="monthly"?"monthly":"delivery_daily",
  attemptNo:Number.isSafeInteger(a.attemptNo)?a.attemptNo:0,
  status:state,providerVerified:expected&&!riskType,
  terminalUnpaidAudited:terminal,riskAuditConfirmed:riskConfirmed,canRetry:false,
  operationalSettlementEnabled:false,
  createdAt:timestamp instanceof Date&&Number.isFinite(timestamp.getTime())?
   timestamp.toISOString():"",
  providerTestAccountOnly:true};
}
async function history(db,tenantId){
 const root=db.collection("tenants").doc(tenantId);
 const rows=await root.collection("m7StripeTestReservations")
  .orderBy("createdAt","desc").limit(51).get();
 const attempts=rows.docs.slice(0,50);
 const refs=attempts.map(doc=>root.collection("m7StripeTestSettlements").doc(doc.id));
 const matching=refs.length?await db.getAll(...refs):[];
 const audits=attempts.map(doc=>{
  const a=doc.data();
  return ["expired_test","payment_failed_test"].includes(a.status)&&
    policy.UUID.test(a.attemptId||"")&&
    /^evt_[A-Za-z0-9_]{8,240}$/.test(a.lifecycleLastEventId||"")
    ?root.collection("m7StripeTestLifecycleAudits").doc(a.lifecycleLastEventId):null;
 });
 const auditDocs=audits.filter(Boolean);
 const auditResults=auditDocs.length?await db.getAll(...auditDocs):[];
 let auditIndex=0;
 const risks=attempts.map(doc=>{
  const a=doc.data();
  return ["refund_review","dispute_review"].includes(a.riskStatus)&&
    /^evt_[A-Za-z0-9_]{8,240}$/.test(a.riskEventId||"")
    ?root.collection("m7StripeTestRiskAudits").doc(a.riskEventId):null;
 });
 const riskDocs=risks.filter(Boolean);
 const riskResults=riskDocs.length?await db.getAll(...riskDocs):[];
 let riskIndex=0;
 const items=attempts.map((doc,i)=>view(doc.data(),matching[i]?.data(),
  audits[i]?auditResults[auditIndex++]?.data():null,
  risks[i]?riskResults[riskIndex++]?.data():null));
 return {ok:true,available:true,tenantId,mode:"test_shadow",currency:"THB",
  operationalSettlementEnabled:false,items,hasMore:rows.size>50};
}
exports.getPlatformM7StripeTestShadowHistory=onCall(options,async request=>{
 if(!request.data||typeof request.data!=="object"||Array.isArray(request.data)||
  Object.keys(request.data).some(k=>k!=="tenantId")||
  typeof request.data.tenantId!=="string")
  throw new HttpsError("invalid-argument","M7_TEST_HISTORY_SELECTION_INVALID");
 const db=getFirestore(),u=await actor(db,request.auth);
 if(u.role!=="super_admin")throw new HttpsError("permission-denied","Superadmin only");
 const gate=shadow.auditGate();
 if(!gate||request.data.tenantId!==gate.tenantId)
  return {ok:true,available:false,mode:"test_shadow",currency:"THB",
   operationalSettlementEnabled:false,items:[],hasMore:false};
 return history(db,gate.tenantId);
});
exports._privateForTests={actor,view,history};
