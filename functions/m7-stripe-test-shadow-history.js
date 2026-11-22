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
function view(attempt,settlement){
 const a=attempt||{},s=settlement||{};
 const expected=a.status==="verified_test"&&s.status==="verified_test_shadow"&&
  s.providerVerified===true&&s.operationalInvoicePaid===false&&
  s.mode==="test_shadow"&&
  s.tenantId===a.tenantId&&s.invoiceId===a.invoiceId&&
  s.attemptId===a.attemptId&&s.invoiceSignature===a.invoiceSignature&&
  s.amountSatang===a.amountSatang&&s.currency==="THB"&&
  s.intentId===a.intentId&&s.sessionId===a.checkoutSessionId&&
  s.accountId===a.accountId&&s.proofDigest&&/^[a-f0-9]{64}$/.test(s.proofDigest);
 const state=a.status==="verified_test"?(expected?"provider_test_verified":"needs_review"):
  ["reserved","provider_requesting","checkout_ready"].includes(a.status)?a.status:"needs_review";
 const timestamp=a.createdAt?.toDate?.()||null;
 return {invoiceId:String(a.invoiceId||"").slice(0,100),
  attemptId:String(a.attemptId||"").slice(0,60),
  amountSatang:Number.isSafeInteger(a.amountSatang)?a.amountSatang:null,
  currency:"THB",kind:a.kind==="monthly"?"monthly":"delivery_daily",
  attemptNo:Number.isSafeInteger(a.attemptNo)?a.attemptNo:0,
  status:state,providerVerified:expected,
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
 const items=attempts.map((doc,i)=>view(doc.data(),matching[i]?.data()));
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
