"use strict";
// SOURCE-ONLY, UNEXPORTED. This records a verified DELIVERY completion, NOT COD
// funds received. Even a genuine Lalamove COMPLETED webhook is NOT a bank
// settlement, cannot create a paid receipt, and MUST NOT issue a Hybrid invoice.
// The independently authenticated live API lookup is an injected server adapter;
// no actual Lalamove API/secret is wired here.
const {createHash,createHmac,timingSafeEqual}=require("node:crypto");
const {FieldValue}=require("firebase-admin/firestore");
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const EVENT=/^[A-Za-z0-9_-]{8,128}$/;
const SHA=/^[a-f0-9]{64}$/;
const PATH="/api/lalamove/webhook"; // existing functions/lalamove-webhook.js path
const MAX_AGE_MS=15*60*1000;
const digest=s=>createHash("sha256").update(s).digest("hex");
const equal=(a,b)=>{
 const x=Buffer.from(String(a||""),"utf8"),y=Buffer.from(String(b||""),"utf8");
 return x.length===y.length&&timingSafeEqual(x,y);
};
function webhookInstant(timestamp){
 if(typeof timestamp!=="number"&&typeof timestamp!=="string")return null;
 const value=Number(timestamp);
 if(!Number.isSafeInteger(value)||value<=0)return null;
 const millis=value<100000000000?value*1000:value;
 return Number.isSafeInteger(millis)?millis:null;
}
/** Verify HMAC with the SAME documented payload-data signature form used in
 * current lalamove-webhook.js. This check proves message origin only,
 * NOT settlement. The API key and secret must come from server credentials.
 */
function validateSignedLalamoveCompletion({payload,credentials,now}){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime())
    ||!payload||Array.isArray(payload)||typeof payload!=="object"
    ||!credentials||typeof credentials.apiKey!=="string"
    ||!credentials.apiKey||typeof credentials.apiSecret!=="string"
    ||!credentials.apiSecret
    ||!equal(payload.apiKey,credentials.apiKey)
    ||typeof payload.signature!=="string"||!SHA.test(payload.signature)
    ||payload.eventType!=="ORDER_STATUS_CHANGED"
    ||typeof payload.eventId!=="string"||!EVENT.test(payload.eventId)
    ||!payload.data||Array.isArray(payload.data)||typeof payload.data!=="object"
    ||!payload.data.order||Array.isArray(payload.data.order)
    ||typeof payload.data.order!=="object"
    ||payload.data.order.status!=="COMPLETED"
    ||typeof payload.data.order.orderId!=="string"
    ||!payload.data.order.orderId.trim())
   throw Error("HYBRID_LALAMOVE_SIGNED_COMPLETION_REQUIRED");
 const instant=webhookInstant(payload.timestamp);
 if(instant===null||Math.abs(now.getTime()-instant)>MAX_AGE_MS)
   throw Error("HYBRID_LALAMOVE_WEBHOOK_EXPIRED");
 const data=JSON.stringify(payload.data);
 const message=String(payload.timestamp)+"\r\nPOST\r\n"+PATH+"\r\n\r\n"+data;
 const sig=createHmac("sha256",credentials.apiSecret).update(message).digest("hex");
 if(!equal(sig,payload.signature))
   throw Error("HYBRID_LALAMOVE_WEBHOOK_SIGNATURE_INVALID");
 return {providerOrderId:payload.data.order.orderId.trim(),
    eventId:payload.eventId,eventTimestampMillis:instant,
    eventHash:digest([credentials.apiKey,payload.eventId].join("|")),
    payloadSha256:digest(data)};
}
/** Authenticated order LOOKUP is separately required to guard spoofed,
 * late or replayed webhook status. Credentials must be resolved by privileged
 * server code, never by browser. A mock lookup is NOT real provider proof.
 */
function validateLalamoveProviderLookup({lookup,tenantId,providerOrderId,
    accountScopeSha256,now}){
 if(!lookup||lookup.source!=="authenticated_lalamove_order_lookup"
   ||lookup.authenticated!==true
   ||lookup.tenantId!==tenantId||lookup.orderId!==providerOrderId
   ||lookup.status!=="COMPLETED"||lookup.market!=="TH"
   ||lookup.accountScopeSha256!==accountScopeSha256||!SHA.test(accountScopeSha256||"")
   ||!SHA.test(lookup.evidenceSha256||"")
   ||!(lookup.checkedAt instanceof Date)
   ||!Number.isFinite(lookup.checkedAt.getTime())
   ||lookup.checkedAt>now||now.getTime()-lookup.checkedAt.getTime()>MAX_AGE_MS)
     throw Error("HYBRID_LALAMOVE_AUTHENTICATED_ORDER_LOOKUP_REQUIRED");
 return {evidenceSha256:lookup.evidenceSha256};
}
/** Staging-only completion candidate. NEVER mark paidAt/paymentStatus, mutate
 * Hybrid invoices, claim bank funds, or certify receipt-journal coverage.
 */
async function recordHybridLalamoveCodCompletionCandidate({
 db,tenantId,orderId,reviewerUid,payload,credentials,resolveProviderOrder,
 now=new Date(),serverTimestamp=()=>FieldValue.serverTimestamp()
}){
 if(!db||![tenantId,orderId,reviewerUid].every(v=>typeof v==="string"&&ID.test(v))
   ||typeof resolveProviderOrder!=="function"
   ||!(now instanceof Date)||!Number.isFinite(now.getTime()))
   throw Error("HYBRID_LALAMOVE_PROVIDER_ADAPTER_REQUIRED");
 const signed=validateSignedLalamoveCompletion({payload,credentials,now});
 const t=db.collection("tenants").doc(tenantId),oref=t.collection("orders").doc(orderId);
 const userRef=db.collection("users").doc(reviewerUid);
 // Server-owned authenticated lookup; its implementation must select the
 // tenant's correct Lalamove account; NOT trusted browser input.
 const result=await resolveProviderOrder({tenantId,orderId,
   providerOrderId:signed.providerOrderId});
 const evidenceRef=t.collection("hybridLalamoveCodCompletionProof").doc(orderId);
 const claimRef=db.collection("platformHybridLalamoveEventClaims").doc(signed.eventHash);
 return db.runTransaction(async tx=>{
   const [tenantSnap,orderSnap,userSnap,evidenceSnap,claimSnap]=await Promise.all([
     tx.get(t),tx.get(oref),tx.get(userRef),tx.get(evidenceRef),tx.get(claimRef)]);
   if(!userSnap.exists||userSnap.data()?.role!=="super_admin"
      ||userSnap.data()?.active!==true)
     throw Error("HYBRID_LALAMOVE_SUPER_ADMIN_REQUIRED");
   const tenant=tenantSnap.data()||{},order=orderSnap.data()||{};
   if(!tenantSnap.exists||tenant.billingPolicyVersion!=="hybrid_v1"
     ||tenant.hybridBillingEnabled!==true||tenant.active!==true
     ||tenant.hybridBillingSuspended===true
     ||tenant.businessType==="retail")
     throw Error("HYBRID_LALAMOVE_TENANT_NOT_ACTIVE");
   if(!orderSnap.exists||order.orderType!=="delivery"
     ||order.deliveryProvider!=="lalamove"
     ||order.paymentMethod!=="cod"||order.lalamoveCodEnabled!==true
     ||order.paymentStatus!=="unpaid"
     ||String(order.lalamoveOrderId||"")!==signed.providerOrderId)
     throw Error("HYBRID_LALAMOVE_COD_ORDER_MISMATCH");
   const accountScopeSha256=tenant.lalamoveAccountScopeSha256;
   validateLalamoveProviderLookup({lookup:result,tenantId,
     providerOrderId:signed.providerOrderId,accountScopeSha256,now});
   // Only one immutable delivery proof per local Order; even a new signed
   // event cannot override a prior conclusion. Future corrections need review.
   const prior=evidenceSnap.data()||{},claim=claimSnap.data()||{};
   if(evidenceSnap.exists){
     if(prior.eventHash!==signed.eventHash
       ||prior.payloadSha256!==signed.payloadSha256
       ||prior.providerEvidenceSha256!==result.evidenceSha256
       ||prior.providerOrderId!==signed.providerOrderId
       ||prior.tenantId!==tenantId||prior.orderId!==orderId
       ||!claimSnap.exists||claim.tenantId!==tenantId||claim.orderId!==orderId)
       throw Error("HYBRID_LALAMOVE_PROOF_CONFLICT");
     return {tenantId,orderId,alreadyRecorded:true,
       deliveryVerified:true,codSettlementVerified:false,paymentChanged:false};
   }
   if(claimSnap.exists)throw Error("HYBRID_LALAMOVE_EVENT_REPLAY_CONFLICT");
   const recordedAt=serverTimestamp();
   tx.create(claimRef,{tenantId,orderId,providerOrderId:signed.providerOrderId,
     eventHash:signed.eventHash,recordedAt});
   tx.create(evidenceRef,{tenantId,orderId,
     providerOrderId:signed.providerOrderId,
     eventHash:signed.eventHash,payloadSha256:signed.payloadSha256,
     eventTimestampMillis:signed.eventTimestampMillis,
     providerEvidenceSha256:result.evidenceSha256,
     accountScopeSha256,recordedByUid:reviewerUid,recordedAt,
     deliveryVerified:true,codSettlementVerified:false,bankReconciled:false,
     status:"delivery_verified_settlement_pending"});
   return {tenantId,orderId,alreadyRecorded:false,
     deliveryVerified:true,codSettlementVerified:false,paymentChanged:false};
 });
}
module.exports={validateSignedLalamoveCompletion,
 validateLalamoveProviderLookup,recordHybridLalamoveCodCompletionCandidate};
