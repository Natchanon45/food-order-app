"use strict";
// Phase3AJ SOURCE-ONLY, UNEXPORTED, DEMO-EMULATOR-ONLY.
// Stops provider/bank test-double calls for a suspended/unauthorized tenant.
// A PRE-FLIGHT snapshot is not transactional enforcement. The four candidate
// financial writers MUST independently re-read tenant and actor in their TX.
const {assertHybridEpochDemoOptIn}=require("./hybrid-billing-writer-epoch-candidate");
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const CASHIER=new Set(["owner","admin","cashier","manager","super_admin"]);
async function requireHybridDemoGatewayPreflight({db,tenantId,actorUid,reviewerUid,sourceKey}={}){
 assertHybridEpochDemoOptIn(true);
 if(!db||typeof db.collection!=="function"
   ||!ID.test(String(tenantId||""))
   ||!["cod_cashier","promptpay_bank","refund_initial","refund_partial"].includes(sourceKey))
  throw Error("HYBRID_DEMO_GATEWAY_PREFLIGHT_INVALID");
 const uid=sourceKey==="cod_cashier"?actorUid:reviewerUid;
 if(!ID.test(String(uid||"")))throw Error("HYBRID_DEMO_GATEWAY_ACTOR_REQUIRED");
 const t=db.collection("tenants").doc(tenantId),u=db.collection("users").doc(uid);
 const [tenant,user]=await Promise.all([t.get(),u.get()]);
 const info=tenant.data()||{};
 if(!tenant.exists||info.active!==true||info.hybridBillingSuspended===true
  ||info.billingPolicyVersion!=="hybrid_v1"||info.hybridBillingEnabled!==true
  ||info.businessType==="retail")
  throw Error("HYBRID_DEMO_GATEWAY_TENANT_SUSPENDED_OR_INELIGIBLE");
 const profile=user.data()||{};
 if(!user.exists||profile.active!==true
  ||(sourceKey==="cod_cashier"
    ?(!CASHIER.has(profile.role)
      ||(profile.role!=="super_admin"&&profile.tenantId!==tenantId))
    :profile.role!=="super_admin"))
  throw Error("HYBRID_DEMO_GATEWAY_ACTOR_UNAUTHORIZED");
 return {preflightOnly:true,transactionalEnforcementProven:false,
   sourceAttested:false,writerParticipationComplete:false,
   coverageCertified:false,canMarkPaid:false,canIssueInvoice:false};
}
module.exports={requireHybridDemoGatewayPreflight};
