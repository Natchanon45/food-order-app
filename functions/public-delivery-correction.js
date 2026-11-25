"use strict";
// P3.4 browser-only customer correction for the ORIGINAL public Delivery bill.
// No bank settlement, no automatic Kitchen admission, no new QR and no COD.
// Only the 256-bit capability delivered once at create authorizes this write.
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {getStorage}=require("firebase-admin/storage");
const {createHash}=require("node:crypto");
const {verifyCapability}=require("./payment-companion-qr-policy");
const REGION="asia-southeast1";
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const PATH=/^[A-Za-z0-9._-]{1,140}\.(?:jpe?g|png|webp)$/i;
const MAX_BYTES=8*1024*1024;
const MAX_AGE=14*24*60*60*1000;
const fail=(name,code="failed-precondition")=>{throw new HttpsError(code,name);};
const cents=value=>{
 const amount=Number(value);
 return Number.isFinite(amount)&&amount>0&&
   Number.isSafeInteger(Math.round(amount*100))?Math.round(amount*100):0;
};
function parse(data){
 const tenantId=String(data?.tenantId||"");
 const orderId=String(data?.orderId||"");
 const capability=String(data?.capability||"");
 if(!ID.test(tenantId)||!ID.test(orderId)||
    !/^[a-f0-9]{64}$/.test(capability))
   fail("DELIVERY_CORRECTION_REFERENCE_INVALID","invalid-argument");
 return {tenantId,orderId,capability};
}
function owned(order,tenantId,capability,now=Date.now()){
 if(!order||order.tenantId!==tenantId||order.orderType!=="delivery"||
    order.paymentMethod!=="promptpay"||
    order.paymentQrMode==="confirmed_order_5m"||
    !verifyCapability(capability,order.customerCorrectionCapabilityDigest))
   return false;
 const created=order.createdAt?.toMillis?.()||Date.parse(String(order.createdAtUTC||order.createdAtText||""));
 return Number.isFinite(created)&&created>0&&created<=now+60000&&now-created<=MAX_AGE;
}
function rights(order){
 const pending=order.paymentStatus==="pending_verification"&&order.status==="pending"&&
    cents(order.totalAmount)>0;
 const old=String(order.paymentSlipPath||"").trim();
 const explicitlyRejected=old&&(
   order.slipCheckStatus==="rejected"||order.slipVerificationStatus==="rejected");
 const canUploadNewSlip=Boolean(pending&&(!old||explicitlyRejected)&&
   Number.isSafeInteger(Number(order.paymentCorrectionRevision||0))&&
   Number(order.paymentCorrectionRevision||0)<3&&
   order.companionKitchenRelease?.status!=="admitted_unverified");
 return {
   ownershipVerified:true,
   canUploadNewSlip,
   canRecheckSlip:false,
   canRequestCODReview:false,
   codRequestPending:false,
   hasOriginalSlip:Boolean(old),
   status:canUploadNewSlip?"awaiting_customer_proof":
      pending?"pending_manual_review":"closed",
   paymentVerified:false,
 };
}
function expectedPath(tenantId,orderId,path){
 if(typeof path!=="string"||!path.startsWith(
   "tenants/"+tenantId+"/payment-slips/"+orderId+"/"))return false;
 const filename=path.slice(("tenants/"+tenantId+"/payment-slips/"+orderId+"/").length);
 return PATH.test(filename);
}
async function lookup(db,request){
 const {tenantId,orderId,capability}=parse(request);
 const tenant=db.collection("tenants").doc(tenantId),ref=tenant.collection("orders").doc(orderId);
 const snap=await ref.get();
 if(!snap.exists||!owned(snap.data(),tenantId,capability))
   fail("DELIVERY_CORRECTION_CAPABILITY_REQUIRED","permission-denied");
 return {tenant,ref,tenantId,orderId,capability,order:snap.data()};
}
exports.getPublicDeliveryCorrectionState=onCall({region:REGION,timeoutSeconds:20},async request=>{
 const found=await lookup(getFirestore(),request.data||{});
 return rights(found.order);
});
exports.submitPublicDeliveryCorrectionSlip=onCall({region:REGION,timeoutSeconds:35,memory:"256MiB"},async request=>{
 const data=request.data||{};
 const {tenant,ref,tenantId,orderId,capability,order}=await lookup(getFirestore(),data);
 const path=data.slipPath;
 if(!expectedPath(tenantId,orderId,path))
   fail("DELIVERY_CORRECTION_SLIP_PATH_INVALID","invalid-argument");
 // Only a real image actually uploaded for this exact order can be claimed.
 let buffer,metadata;
 try{
   const file=getStorage().bucket().file(path);
   [metadata]=await file.getMetadata();
   if(!Number.isSafeInteger(Number(metadata.size))||
      Number(metadata.size)<1||Number(metadata.size)>MAX_BYTES||
      !/^image\/(?:jpeg|png|webp)$/.test(String(metadata.contentType||""))||
      metadata.metadata?.tenantId!==tenantId||
      metadata.metadata?.orderId!==orderId)
      fail("DELIVERY_CORRECTION_IMAGE_INVALID");
   [buffer]=await file.download();
   if(buffer.length!==Number(metadata.size))fail("DELIVERY_CORRECTION_IMAGE_SIZE_MISMATCH");
 }catch{fail("DELIVERY_CORRECTION_FILE_NOT_CONFIRMED");}
 const hash=createHash("sha256").update(buffer).digest("hex");
 const db=getFirestore(),claim=db.collection("deliveryCustomerCorrectionSlipHashes").doc(hash);
 return db.runTransaction(async tx=>{
   // Read everything before the first write to preserve Firestore TX semantics.
   const [current,claimed]=await Promise.all([tx.get(ref),tx.get(claim)]);
   const row=current.data();
   if(!current.exists||!owned(row,tenantId,capability))
     fail("DELIVERY_CORRECTION_CAPABILITY_REQUIRED","permission-denied");
   if(claimed.exists&&claimed.data()?.tenantId===tenantId&&
      claimed.data()?.orderId===orderId&&claimed.data()?.slipPath===path&&
      row.paymentSlipPath===path)
     return {ok:true,alreadySubmitted:true,status:"pending_manual_review",
      paymentVerified:false,kitchenReleased:false};
   if(!rights(row).canUploadNewSlip)
     fail("DELIVERY_CORRECTION_NOT_ELIGIBLE");
   if(claimed.exists)fail("DELIVERY_CORRECTION_DUPLICATE_SLIP");
   const revision=Number(row.paymentCorrectionRevision||0)+1;
   const audit=tenant.collection("deliveryPaymentCorrectionAudit").doc(orderId+"-"+revision);
   const existing=await tx.get(audit);
   if(existing.exists)fail("DELIVERY_CORRECTION_ALREADY_SUBMITTED");
   tx.create(claim,{tenantId,orderId,slipPath:path,createdAt:FieldValue.serverTimestamp()});
   tx.create(audit,{tenantId,orderId,slipPath:path,sha256:hash,
      revision,verification:"unverified",paymentVerified:false,
      kitchenReleased:false,createdAt:FieldValue.serverTimestamp()});
   tx.update(ref,{paymentSlipPath:path,paymentCorrectionRevision:revision,
      slipCheckStatus:"manual_review",paymentReviewRequired:true,
      paymentCorrectionStatus:"pending_manual_review",
      updatedAt:FieldValue.serverTimestamp()});
   return {ok:true,alreadySubmitted:false,status:"pending_manual_review",
     paymentVerified:false,kitchenReleased:false};
 });
});
exports.__test={parse,owned,rights,expectedPath};
