"use strict";
// Public QR-mode is an opt-in shadow of the source confirmed-order flow.
// It cannot approve money, admit kitchen, allocate a rider or settle invoices.
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {getStorage}=require("firebase-admin/storage");
const {createHash}=require("node:crypto");
const qr=require("./payment-companion-qr-policy");
const err=(code,msg)=>new HttpsError(code,msg);
const region="asia-southeast1";
const options={region,timeoutSeconds:45,invoker:"public"};
const cleanId=id=>typeof id==="string"&&qr.ID.test(id);
exports.getPublicCompanionQrAvailability=onCall(options,async request=>{
 const tenantId=request.data?.tenantId;
 if(!cleanId(tenantId)||qr.configuredTenant()!==tenantId)return {mode:"legacy",enabled:false};
 const db=getFirestore(),tenant=db.collection("tenants").doc(tenantId);
 const [t,store,link]=await Promise.all([tenant.get(),tenant.collection("settings").doc("store").get(),db.collection("paymentCompanionTenants").doc(tenantId).get()]);
 try{
  if(!t.exists||t.data()?.active!==true||!["both","restaurant_cafe"].includes(t.data()?.businessType||"both"))return {mode:"legacy",enabled:false};
  qr.receiverReady(store,link.data()?.receiver,tenantId);
  return {mode:"confirmed_order_5m",enabled:true,provider:"lalamove",paymentMethod:"promptpay"};
 }catch{return {mode:"legacy",enabled:false};}
});
exports.getPublicCompanionQrState=onCall(options,async request=>{
 const {tenantId,orderId}=request.data||{};
 if(!cleanId(tenantId)||!cleanId(orderId))throw err("invalid-argument","QR_REFERENCE_INVALID");
 const db=getFirestore(),tenant=db.collection("tenants").doc(tenantId);
 const [order,store,link]=await Promise.all([tenant.collection("orders").doc(orderId).get(),tenant.collection("settings").doc("store").get(),db.collection("paymentCompanionTenants").doc(tenantId).get()]);
 if(!order.exists||order.data()?.tenantId!==tenantId||order.data()?.paymentQrMode!=="confirmed_order_5m")return {mode:"none",active:false,canUploadSlip:false};
 const status=qr.qrSnapshot(order.data(),store,link.data()?.receiver,tenantId);
 if(qr.configuredTenant()!==tenantId&&status.active)return {...status,active:false,canUploadSlip:false,recipientId:"",recipientName:"",reason:"pilot_disabled"};
 return status;
});
exports.submitPublicCompanionLateSlip=onCall(options,async request=>{
 const {tenantId,orderId,capability,slipPath}=request.data||{};
 if(!cleanId(tenantId)||!cleanId(orderId)||typeof slipPath!=="string"||!new RegExp("^tenants/"+tenantId+"/payment-slips/"+orderId+"/[A-Za-z0-9._-]{1,140}$").test(slipPath)||
    !/\.(?:jpe?g|png|webp)$/i.test(slipPath))throw err("invalid-argument","COMPANION_LATE_SLIP_INVALID");
 if(qr.configuredTenant()!==tenantId)throw err("failed-precondition","COMPANION_QR_PILOT_DISABLED");
 const db=getFirestore(),tenant=db.collection("tenants").doc(tenantId),orderRef=tenant.collection("orders").doc(orderId);
 // Unauthenticated buyer must present the 256-bit order-specific capability.
 const existing=await orderRef.get();
 if(!existing.exists||!qr.verifyCapability(capability,existing.data()?.paymentQrCapabilityDigest)||existing.data()?.tenantId!==tenantId||existing.data()?.paymentQrMode!=="confirmed_order_5m")
   throw err("permission-denied","COMPANION_ORDER_CAPABILITY_REQUIRED");
 const path=slipPath;
 let bytes,metadata;
 try{
  const file=getStorage().bucket().file(path);
  [metadata]=await file.getMetadata();
  if(!Number.isInteger(Number(metadata.size))||Number(metadata.size)<=0||Number(metadata.size)>8*1024*1024||
    !/^image\/(?:jpeg|png|webp)$/.test(metadata.contentType||"")||metadata.metadata?.tenantId!==tenantId||metadata.metadata?.orderId!==orderId)
    throw Error("SLIP_INVALID");
  [bytes]=await file.download();
  if(bytes.length!==Number(metadata.size))throw Error("SLIP_SIZE_MISMATCH");
 }catch{throw err("failed-precondition","COMPANION_SLIP_NOT_CONFIRMED");}
 const hash=createHash("sha256").update(bytes).digest("hex"),claim=db.collection("paymentCompanionSlipHashes").doc(hash);
 return db.runTransaction(async tx=>{
  const [orderSnap,store,link,prior]=await Promise.all([
   tx.get(orderRef),tx.get(tenant.collection("settings").doc("store")),
   tx.get(db.collection("paymentCompanionTenants").doc(tenantId)),tx.get(claim),
  ]);
  const order=orderSnap.data();
  if(!order||!qr.verifyCapability(capability,order.paymentQrCapabilityDigest))
    throw err("permission-denied","COMPANION_ORDER_CAPABILITY_REQUIRED");
  const snapshot=qr.qrSnapshot(order,store,link.data()?.receiver,tenantId);
  if(order.paymentQrSlipFallbackStatus==="submitted"){
   if(order.paymentSlipPath===path&&prior.data()?.tenantId===tenantId&&prior.data()?.orderId===orderId)
      return {ok:true,alreadySubmitted:true,status:"pending_manual_review",paymentVerified:false,kitchenReleased:false};
   throw err("failed-precondition","COMPANION_SLIP_ALREADY_SUBMITTED");
  }
  if(!snapshot.canUploadSlip||order.status!=="pending"||order.paymentStatus!=="pending_verification"||prior.exists)
    throw err("failed-precondition","COMPANION_SLIP_REVIEW_NOT_ELIGIBLE");
  const audit=tenant.collection("paymentCompanionLateSlipAudit").doc(orderId);
  const priorAudit=await tx.get(audit);
  if(priorAudit.exists)throw err("failed-precondition","COMPANION_SLIP_ALREADY_SUBMITTED");
  const record={tenantId,orderId,slipPath:path,slipSha256:hash,reason:snapshot.reason,submittedAt:FieldValue.serverTimestamp(),
    verification:"unverified",paymentVerified:false,kitchenReleased:false};
  tx.create(claim,{tenantId,orderId,createdAt:FieldValue.serverTimestamp()});
  tx.create(audit,record);
  tx.update(orderRef,{paymentSlipPath:path,paymentQrSlipFallbackStatus:"submitted",
    slipCheckStatus:"manual_review",paymentReviewRequired:true,
    // Source requires an independent technical/bank proof to approve Paid:
    // never mark any manual bank notification as verified.
    updatedAt:FieldValue.serverTimestamp()});
  return {ok:true,alreadySubmitted:false,status:"pending_manual_review",paymentVerified:false,kitchenReleased:false};
 });
});
