"use strict";
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {demoEnabled}=require("./delivery-notification-intake");
const {HEX,ID}=require("./payment-companion-policy");
const {evaluate,flags,WINDOW,GRACE}=require("./delivery-notification-match-policy");
const opts={region:"asia-southeast1",timeoutSeconds:30};
const fail=(code,msg)=>{throw new HttpsError(code,msg);};
async function context(db,tx,request){
 if(!request.auth?.uid)fail("unauthenticated","DELIVERY_NOTICE_AUTH_REQUIRED");
 const uid=request.auth.uid;
 const u=(await tx.get(db.collection("users").doc(uid))).data();
 if(u?.active!==true||!["owner","admin","cashier"].includes(u.role)||!ID.test(u.tenantId||""))
  fail("permission-denied","DELIVERY_NOTICE_STAFF_REQUIRED");
 if(u.emailVerificationRequired===true&&request.auth.token?.email_verified!==true)
  fail("permission-denied","MANAGED_EMAIL_VERIFICATION_REQUIRED");
 const tenantId=u.tenantId;
 if(!demoEnabled(tenantId))fail("failed-precondition","DELIVERY_NOTIFICATION_DISABLED");
 const tenant=db.collection("tenants").doc(tenantId),root=db.collection("paymentCompanionTenants").doc(tenantId);
 const shop=(await tx.get(tenant)).data();
 if(shop?.active!==true||!["both","restaurant_cafe"].includes(shop.businessType||"both")||
    shop.operationalSuspended===true||shop.revenueShareSuspended===true||
    ["expired","suspended"].includes(shop.subscriptionStatus)||shop.status==="suspended")
  fail("permission-denied","DELIVERY_NOTICE_TENANT_UNAVAILABLE");
 return {tenantId,tenant,root,uid,role:u.role};
}
function input(request,record){
 const d=request.data||{};
 const keys=record?["orderId","notificationId","acknowledged"]:["orderId"];
 if(Object.keys(d).some(k=>!keys.includes(k))||typeof d.orderId!=="string"||!ID.test(d.orderId)||
    (record&&(typeof d.notificationId!=="string"||!HEX.test(d.notificationId)||d.acknowledged!==true)))
  fail("invalid-argument","DELIVERY_NOTICE_INPUT_INVALID");
 return d;
}
async function snapshot(tx,c,orderId){
 const now=Date.now(),since=now-2*(WINDOW+GRACE);
 const [store,meta,devices,notices,orders]=await Promise.all([
  tx.get(c.tenant.collection("settings").doc("store")),tx.get(c.root),
  tx.get(c.root.collection("devices").where("enabled","==",true).limit(4)),
  tx.get(c.root.collection("notices").where("receivedMs",">=",since).limit(201)),
  tx.get(c.tenant.collection("orders").where("createdAt",">=",new Date(since)).limit(201))
 ]);
 const result=evaluate({tenantId:c.tenantId,orderId,store,link:meta.data()?.receiver,now,
  truncated:devices.size>3||notices.size>200||orders.size>200,
  devices:devices.docs.map(d=>({...d.data(),id:d.id})),
  notices:notices.docs.map(d=>({...d.data(),id:d.id})),
  orders:orders.docs.map(d=>({...d.data(),id:d.id}))});
 return result;
}
const auditRef=(c,id)=>c.root.collection("notificationFirstReviews").doc(id);
const claimRef=(c,id)=>c.root.collection("reviewClaims").doc(id);
const fingerprintRef=(c,id)=>c.root.collection("notificationFirstObservationClaims").doc(id);
function publicResult(r){
 const {observationFingerprint,receiverRevision,...visible}=r;
 return visible;
}
exports.getDeliveryNotificationMatch=onCall(opts,async request=>{
 const {orderId}=input(request,false),db=getFirestore();
 return db.runTransaction(async tx=>{
  const c=await context(db,tx,request);
  const prior=(await tx.get(auditRef(c,orderId))).data();
  if(prior)return {orderId,status:"recorded_unverified",notificationId:prior.notificationId,amountSatang:prior.amountSatang,...flags};
  const r=await snapshot(tx,c,orderId);
  if(r.status==="candidate"){
   const [claim,fingerprint]=await Promise.all([tx.get(claimRef(c,r.notificationId)),tx.get(fingerprintRef(c,r.observationFingerprint))]);
   if(claim.exists||fingerprint.exists)return {orderId,status:"already_claimed",...flags};
  }
  return publicResult(r);
 });
});
exports.recordDeliveryNotificationObservation=onCall(opts,async request=>{
 const {orderId,notificationId}=input(request,true),db=getFirestore();
 return db.runTransaction(async tx=>{
  const c=await context(db,tx,request),audit=auditRef(c,orderId),claim=claimRef(c,notificationId);
  const [previous,existing]=await Promise.all([tx.get(audit),tx.get(claim)]);
  if(previous.exists){
   const row=previous.data();
   if(row.notificationId!==notificationId||existing.data()?.orderId!==orderId||
      existing.data()?.flow!=="notification_first")
    fail("failed-precondition","DELIVERY_NOTICE_REVIEW_CONFLICT");
   return {recorded:true,alreadyRecorded:true,...flags};
  }
  const r=await snapshot(tx,c,orderId);
  if(r.status!=="candidate"||r.notificationId!==notificationId||existing.exists)
   fail("failed-precondition","DELIVERY_NOTICE_MATCH_UNCONFIRMED");
  const fingerprint=fingerprintRef(c,r.observationFingerprint);
  if((await tx.get(fingerprint)).exists)fail("failed-precondition","DELIVERY_NOTICE_MATCH_UNCONFIRMED");
  const record={tenantId:c.tenantId,orderId,notificationId,amountSatang:r.amountSatang,
   receiverRevision:r.receiverRevision,observationFingerprint:r.observationFingerprint,
   status:"recorded_unverified",recordedByUid:c.uid,recordedByRole:c.role,recordedAt:FieldValue.serverTimestamp(),...flags};
  tx.create(audit,record);
  tx.create(claim,{orderId,notificationId,flow:"notification_first",recordedAt:FieldValue.serverTimestamp(),...flags});
  tx.create(fingerprint,{orderId,notificationId,recordedAt:FieldValue.serverTimestamp()});
  return {recorded:true,alreadyRecorded:false,...flags};
 });
});
