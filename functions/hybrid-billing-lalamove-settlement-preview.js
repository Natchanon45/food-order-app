"use strict";
// Phase 3V: SOURCE-ONLY, UNEXPORTED, READ-ONLY Lalamove COD settlement preview.
// Real authenticated provider AND independent bank/Wallet adapters are NOT wired.
// A successful comparison is NOT authorisation to mark an order paid.
const {createHash}=require("node:crypto");
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const SHA=/^[a-f0-9]{64}$/;
const MAX_AGE=15*60*1000;
const digest=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
function fresh(instant,now){
 return instant instanceof Date && Number.isFinite(instant.getTime())
   && instant<=now && now.getTime()-instant.getTime()<=MAX_AGE;
}
function positiveCents(value){return Number.isSafeInteger(value)&&value>0&&value<=100000000000;}
function nonnegativeCents(value){return Number.isSafeInteger(value)&&value>=0&&value<=100000000000;}
function orderCents(value){
 if(typeof value!=="number"||!Number.isFinite(value)||value<=0
    ||value>1000000000||Math.abs(value*100-Math.round(value*100))>0.00001)
   return null;
 return Math.round(value*100);
}
/**
 * In-memory equality checks on TWO separately authenticated LOOKUPS.
 * In particular, a delivered order, wallet balance, remittance advice, slip
 * screenshot or provider-generated "bank confirmed" field is NOT bank proof.
 * One bank transfer per order only. Batch payouts are intentionally blocked.
 */
function reconcileLalamoveCodEvidence({tenantId,orderId,order,deliveryProof,
 provider,bank,accountScopeSha256,recipientAccountSha256,now}){
 const fail=()=>{throw Error("HYBRID_LALAMOVE_INDEPENDENT_SETTLEMENT_PROOFS_REQUIRED");};
 if(!ID.test(String(tenantId||""))||!ID.test(String(orderId||""))
   ||!(now instanceof Date)||!Number.isFinite(now.getTime())
   ||!SHA.test(accountScopeSha256||"")||!SHA.test(recipientAccountSha256||"")
   ||!order||order.orderType!=="delivery"||order.deliveryProvider!=="lalamove"
   ||order.paymentMethod!=="cod"||order.lalamoveCodEnabled!==true
   ||order.paymentStatus!=="unpaid"||typeof order.lalamoveOrderId!=="string"
   ||!order.lalamoveOrderId.trim()||orderCents(order.totalAmount)===null
   ||!deliveryProof||deliveryProof.tenantId!==tenantId
   ||deliveryProof.orderId!==orderId
   ||deliveryProof.providerOrderId!==order.lalamoveOrderId
   ||deliveryProof.accountScopeSha256!==accountScopeSha256
   ||deliveryProof.deliveryVerified!==true
   ||deliveryProof.codSettlementVerified!==false
   ||deliveryProof.bankReconciled!==false
   ||deliveryProof.status!=="delivery_verified_settlement_pending"
   ||!SHA.test(deliveryProof.providerEvidenceSha256||"")
   ||!SHA.test(deliveryProof.eventHash||""))fail();
 if(!provider||provider.source!=="authenticated_lalamove_remittance_lookup"
   ||provider.authenticated!==true||provider.tenantId!==tenantId
   ||provider.orderId!==orderId||provider.providerOrderId!==order.lalamoveOrderId
   ||provider.accountScopeSha256!==accountScopeSha256
   ||provider.market!=="TH"||provider.currency!=="THB"
   ||provider.settlementStatus!=="PAID_OUT"
   ||provider.batchPayout!==false||provider.orderCount!==1
   ||!positiveCents(provider.collectedCodCents)
   ||provider.collectedCodCents!==orderCents(order.totalAmount)
   ||!nonnegativeCents(provider.feeCents)
   ||!positiveCents(provider.remittedCents)
   ||provider.remittedCents!==provider.collectedCodCents-provider.feeCents
   ||provider.recipientAccountSha256!==recipientAccountSha256
   ||!SHA.test(provider.transferReferenceSha256||"")
   ||!SHA.test(provider.evidenceSha256||"")
   ||!fresh(provider.checkedAt,now)
   ||!(provider.paidOutAt instanceof Date)
   ||!Number.isFinite(provider.paidOutAt.getTime())
   ||provider.paidOutAt>now)fail();
 if(!bank||bank.source!=="independent_bank_credit_record"
   ||bank.authenticated!==true||bank.tenantId!==tenantId
   ||bank.orderId!==orderId||bank.status!=="POSTED"
   ||bank.currency!=="THB"||bank.recipientConfirmed!==true
   ||bank.recipientAccountSha256!==recipientAccountSha256
   ||bank.transferReferenceSha256!==provider.transferReferenceSha256
   ||!SHA.test(bank.evidenceSha256||"")
   ||bank.evidenceSha256===provider.evidenceSha256
   ||bank.creditedCents!==provider.remittedCents
   ||!fresh(bank.checkedAt,now)
   ||!(bank.postedAt instanceof Date)
   ||!Number.isFinite(bank.postedAt.getTime())
   ||bank.postedAt>now||bank.postedAt<provider.paidOutAt)fail();
 return {tenantId,orderId,providerOrderId:order.lalamoveOrderId,
   collectedCodCents:provider.collectedCodCents,providerFeeCents:provider.feeCents,
   matchedBankCreditCents:bank.creditedCents,
   evidencePairDigest:digest(["hybrid_cod_preview_v1",tenantId,orderId,
     deliveryProof.eventHash,provider.transferReferenceSha256,
     provider.evidenceSha256,bank.evidenceSha256,provider.remittedCents]),
   status:"mockable_evidence_match_not_payment_authorisation",
   settlementCertified:false,paymentChanged:false,canMarkPaid:false,
   canIssueInvoice:false,coverageCertified:false};
}
/**
 * Privileged internal read-only helper. The caller must derive reviewerUid
 * from verified server auth. Adapters are trusted server implementations,
 * NEVER request data. This function has no Firestore writes or exports.
 */
async function previewHybridLalamoveCodSettlement({
 db,tenantId,orderId,reviewerUid,resolveProviderRemittance,
 resolveIndependentBankCredit,now=new Date()
}){
 if(!db||![tenantId,orderId,reviewerUid].every(x=>typeof x==="string"&&ID.test(x))
   ||!fresh(now,now)
   ||typeof resolveProviderRemittance!=="function"
   ||typeof resolveIndependentBankCredit!=="function")
   throw Error("HYBRID_LALAMOVE_SETTLEMENT_ADAPTERS_NOT_CONNECTED");
 const t=db.collection("tenants").doc(tenantId);
 const [tenantSnap,orderSnap,userSnap,deliverySnap]=await Promise.all([
   t.get(),t.collection("orders").doc(orderId).get(),
   db.collection("users").doc(reviewerUid).get(),
   t.collection("hybridLalamoveCodCompletionProof").doc(orderId).get()]);
 if(!userSnap.exists||userSnap.data()?.role!=="super_admin"
   ||userSnap.data()?.active!==true)
   throw Error("HYBRID_LALAMOVE_SETTLEMENT_SUPER_ADMIN_REQUIRED");
 const tenant=tenantSnap.data()||{};
 if(!tenantSnap.exists||tenant.billingPolicyVersion!=="hybrid_v1"
   ||tenant.hybridBillingEnabled!==true||tenant.active!==true
   ||tenant.hybridBillingSuspended===true||tenant.businessType==="retail"
   ||!orderSnap.exists||!deliverySnap.exists)
   throw Error("HYBRID_LALAMOVE_SETTLEMENT_TENANT_OR_PROOF_NOT_READY");
 const context={tenantId,orderId,providerOrderId:orderSnap.data()?.lalamoveOrderId,
   accountScopeSha256:tenant.lalamoveAccountScopeSha256,
   recipientAccountSha256:tenant.lalamoveCodRecipientAccountSha256};
 if(!SHA.test(context.accountScopeSha256||"")
   ||!SHA.test(context.recipientAccountSha256||""))
   throw Error("HYBRID_LALAMOVE_SETTLEMENT_ACCOUNT_SCOPE_REQUIRED");
 // Independent source calls: never reuse the provider reply as bank evidence.
 const [provider,bank]=await Promise.all([
   resolveProviderRemittance({...context}),
   resolveIndependentBankCredit({...context})]);
 return reconcileLalamoveCodEvidence({order:orderSnap.data(),
   deliveryProof:deliverySnap.data(),provider,bank,now,...context});
}
module.exports={reconcileLalamoveCodEvidence,previewHybridLalamoveCodSettlement};
