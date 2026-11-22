"use strict";
const {onDocumentCreated}=require("firebase-functions/v2/firestore");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const policy=require("./payment-companion-kitchen-policy");
const companion=require("./payment-companion");
const id=/^[A-Za-z0-9_-]{8,128}$/;
async function admit(db,tenantId,notificationId){
 if(policy.configuredUatTenant()!==tenantId||!id.test(tenantId)||!/^[a-f0-9]{64}$/.test(notificationId))
  return {admitted:false,reason:"UAT_DISABLED"};
 return db.runTransaction(async tx=>{
  const context=await companion.__kitchenInternal.candidateSnapshot(db,tenantId,tx);
  if(context.matchStatus!=="advisory")return {admitted:false,reason:context.matchStatus};
  const notice=context.validRows.find(row=>row.id===notificationId);
  if(!notice)return {admitted:false,reason:"NOTICE_NOT_ELIGIBLE"};
  const matches=context.matches.filter(row=>row.status==="candidate"&&row.notificationId===notificationId);
  if(matches.length!==1)return {admitted:false,reason:"NOT_UNIQUE"};
  const match=matches[0],orderRef=context.tenant.collection("orders").doc(match.orderId);
  const claimRef=context.root.collection("kitchenClaims").doc(notificationId);
  const eventRef=context.root.collection("kitchenAdmissions").doc(match.orderId);
  const [tenant,order,claim,event]=await Promise.all([
   tx.get(context.tenant),tx.get(orderRef),tx.get(claimRef),tx.get(eventRef),
  ]);
  if(tenant.data()?.active!==true)return {admitted:false,reason:"TENANT_INACTIVE"};
  if(claim.exists||event.exists)return {admitted:false,reason:"ALREADY_CLAIMED"};
  const entry=order.data(),link=context.link,autoConsent=context.meta.autoKitchenConsent;
  const eligible=policy.admitEligible({order:entry,match,notice,recipient:context.recipient,link,autoConsent,store:context.store});
  if(!eligible)return {admitted:false,reason:"BANK_EVIDENCE_UNCONFIRMED"};
  const stamped=Date.now();
  const release={
   status:"admitted_unverified",notificationId,source:notice.source,
   amountSatang:match.amountSatang,receiverRevision:link.revision,
   admittedAtMs:stamped,purpose:"uat_merchant_risk_kitchen_only",
   bankConfirmed:false,paymentVerified:false,canSettleInvoice:false,
   canDispatchRider:false,
  };
  tx.create(claimRef,{tenantId,orderId:match.orderId,notificationId,status:"admitted_unverified",
   createdAtMs:stamped});
  tx.create(eventRef,{tenantId,orderId:match.orderId,notificationId,mode:"uat_merchant_risk_kitchen_only",
    amountSatang:match.amountSatang,createdAtMs:stamped,...{
    bankConfirmed:false,paymentVerified:false,canSettleInvoice:false,canDispatchRider:false}});
  tx.update(orderRef,{companionKitchenRelease:release,
    companionKitchenAdmittedAt:FieldValue.serverTimestamp(),
    updatedAt:FieldValue.serverTimestamp()});
  return {admitted:true,orderId:match.orderId,notificationId,paymentVerified:false,
    bankConfirmed:false,canDispatchRider:false};
 });
}
// On the first server-accepted bank observation, attempt the exact candidate
// transaction. Retry transient errors; never change Paid or call Lalamove.
exports.onPaymentCompanionNoticeForKitchen=onDocumentCreated(
 {document:"paymentCompanionTenants/{tenantId}/notices/{notificationId}",
 region:"asia-southeast1",timeoutSeconds:60,retry:true},
 async event=>{
  const {tenantId,notificationId}=event.params||{};
  if(!event.data||policy.configuredUatTenant()!==tenantId)return;
  try{return await admit(getFirestore(),tenantId,notificationId);}
  catch(error){
   // Firestore failures should retry; account mismatch or ambiguous evidence
   // returns admitted:false from the transaction, never a partial update.
   console.error("COMPANION_UAT_ADMISSION_UNCONFIRMED",String(error?.code||"transaction"));
   throw error;
  }
 });
exports.__test={admit};
