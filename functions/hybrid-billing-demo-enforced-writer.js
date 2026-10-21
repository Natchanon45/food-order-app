"use strict";
// Phase 3Z - source-only demo gateway. Never exported via functions/index.js.
// This gateway always enables the SAME transaction epoch barrier, while the
// standalone existing candidate functions and all legacy writers still can
// bypass it. An enforced gateway is NOT all-writer enforcement.
const {assertHybridEpochDemoOptIn}=require("./hybrid-billing-writer-epoch-candidate");
const {requireHybridDemoGatewayPreflight}=require("./hybrid-billing-demo-gateway-preflight");
const {settleHybridCodDeliveryPayment}=require("./hybrid-billing-cod-payment");
const {recordHybridVerifiedPromptPay}=require("./hybrid-billing-promptpay-payment");
const {recordHybridVerifiedRefund}=require("./hybrid-billing-refund-reversal");
const {appendHybridVerifiedPartialRefund}=require("./hybrid-billing-multi-refund");
const SOURCE_KEYS=Object.freeze(["cod_cashier","promptpay_bank",
 "refund_initial","refund_partial"]);
const ALLOWED=new Set(SOURCE_KEYS);
function assertGatewayRequest(sourceKey,args){
 assertHybridEpochDemoOptIn(true);
 if(typeof sourceKey!=="string"||!ALLOWED.has(sourceKey))
  throw Error("HYBRID_DEMO_GATEWAY_UNKNOWN_SOURCE");
 if(!args||typeof args!=="object"||Array.isArray(args)
  ||Object.hasOwn(args,"epochAdmissionDemo")
  ||typeof args.tenantId!=="string"
  ||typeof args.orderId!=="string")
  throw Error("HYBRID_DEMO_GATEWAY_BAD_REQUEST");
 // These are deliberately fixed server-side entrypoints, NOT dispatching
 // to an arbitrary caller-provided callback or a new unknown source key.
}
/**
 * Code-review-safe demo adapter for the four UNEXPORTED financial candidates.
 * Proof resolvers/clock hooks are internal test hooks, never browser fields.
 */
async function executeHybridDemoEnforcedWriter({sourceKey,args}={}){
 assertGatewayRequest(sourceKey,args);
 const {db,tenantId,orderId,actorUid,reviewerUid,
  resolveIndependentBankPayment,resolveIndependentRefund,now,
  clock,serverTimestamp}=args;
 // Preflight rejects suspended/unauthorized demo tenants BEFORE mock provider calls.
 // Not atomic: each financial writer still rechecks tenant/actor in its transaction.
 await requireHybridDemoGatewayPreflight({db,tenantId,actorUid,reviewerUid,sourceKey});
 if(sourceKey==="cod_cashier")
  return settleHybridCodDeliveryPayment({db,tenantId,orderId,actorUid,
   ...(clock!==undefined?{clock}:{}),
   ...(serverTimestamp!==undefined?{serverTimestamp}:{}),
   epochAdmissionDemo:true});
 if(sourceKey==="promptpay_bank")
  return recordHybridVerifiedPromptPay({db,tenantId,orderId,reviewerUid,
   resolveIndependentBankPayment,...(now!==undefined?{now}:{}),
   ...(serverTimestamp!==undefined?{serverTimestamp}:{}),
   epochAdmissionDemo:true});
 if(sourceKey==="refund_initial")
  return recordHybridVerifiedRefund({db,tenantId,orderId,reviewerUid,
   resolveIndependentRefund,...(now!==undefined?{now}:{}),
   ...(serverTimestamp!==undefined?{serverTimestamp}:{}),
   epochAdmissionDemo:true});
 return appendHybridVerifiedPartialRefund({db,tenantId,orderId,reviewerUid,
  resolveIndependentRefund,...(now!==undefined?{now}:{}),
  ...(serverTimestamp!==undefined?{serverTimestamp}:{}),
  epochAdmissionDemo:true});
}
function describeHybridDemoGateway(){
 return {sourceKeys:[...SOURCE_KEYS],gatewayRequiresEpoch:true,
  defaultCandidatePathsUnenrolled:true,legacyPathsUnenrolled:true,
  missingBankProviderAdapter:true,missingLalamoveMoneyWriter:true,
  writerParticipationComplete:false,coverageCertified:false,
  canIssueInvoice:false};
}
module.exports={SOURCE_KEYS,executeHybridDemoEnforcedWriter,describeHybridDemoGateway};
