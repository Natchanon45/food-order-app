"use strict";
// Parallel, optional LK Shop role-specific inbox/FCM fanout. No changes to
// existing Telegram, finance, cash, order-paid or Lalamove decisions.
const {onDocumentWritten,onDocumentCreated}=require("firebase-functions/v2/firestore");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {getMessaging}=require("firebase-admin/messaging");
const { _privateForTests:eventPolicy }=require("./tenant-telegram-events");
const P=require("./lk-shop-policy");
const REGION="asia-southeast1";
const active=()=>process.env[P.PILOT_KEY]==="1";
const pushActive=()=>process.env[P.PUSH_KEY]==="1";
const eventKey=(entry,purpose)=>P.hash(["lkshop","tenant",entry.tenantId,
 entry.orderId,entry.kind,entry.phase||"",purpose].join("|"));
const kindLabels={
 cod_created:"มีออร์เดอร์ COD ใหม่ · ยังไม่ยืนยันรับเงิน",
 pending_slip:"มีสลิป Delivery รอแคชเชียร์ตรวจสอบ",
 original_slip:"มีสลิปต้นฉบับรอตรวจสอบ",
 uat_kitchen:"ออร์เดอร์ UAT เข้าครัวเบื้องต้น · ยังไม่ยืนยันชำระ",
 paid:"สถานะคำสั่งซื้อเปลี่ยนเป็นชำระแล้วในระบบ",
 wallet_topup:"มีคำขอเติมเครดิตจัดส่งให้ตรวจสอบ",
 revenue_share:"มีรายการส่วนแบ่ง Delivery ให้ตรวจสอบ",
 hybrid_platform_fee:"มีรายการค่าบริการแพลตฟอร์มให้ตรวจสอบ",
};
async function enqueue(db,entry,{pilot=active(),at=Date.now()}={}){
 if(!pilot||!entry||!P.ID.test(entry.tenantId||"")||
   !P.ID.test(entry.orderId||"")||!kindLabels[entry.kind]||
   !Array.isArray(entry.purposes))
  return {queued:0,skipped:"INVALID_OR_DISABLED"};
 const tenant=await db.collection("tenants").doc(entry.tenantId).get();
 if(tenant.data()?.active!==true)return {queued:0,skipped:"INACTIVE_TENANT"};
 let queued=0;
 for(const purpose of new Set(entry.purposes)){
  if(!P.purposeValid("tenant",purpose))continue;
  const key=P.roomKey("tenant",entry.tenantId,purpose);
  const devices=await db.collection("lkShopDevices")
   .where("roomKey","==",key).limit(12).get();
  for(const doc of devices.docs){
   const device=doc.data();
   if(device?.enabled!==true||device.scope!=="tenant"||
      device.tenantId!==entry.tenantId||device.purpose!==purpose)continue;
   const notice=doc.ref.collection("notices").doc(eventKey(entry,purpose));
   try{
    await notice.create({
     body:kindLabels[entry.kind],createdAtMs:at,purpose,
     eventKind:entry.kind,tenantId:entry.tenantId,
     createdAt:FieldValue.serverTimestamp(),
    });queued++;
   }catch(err){
    if(err?.code===6||err?.code==="already-exists")continue;
    throw err;
   }
  }
 }
 return {queued};
}
async function sendPush(db,deviceId,eventId,{pilot=active(),push=pushActive(),
 messaging=getMessaging()}={}){
 if(!pilot||!push)return {sent:false,reason:"PUSH_NOT_ENABLED"};
 if(!P.ID.test(deviceId||"")||!P.HEX.test(eventId||""))
  return {sent:false,reason:"INVALID_ID"};
 const ref=db.collection("lkShopDevices").doc(deviceId);
 const dev=(await ref.get()).data();
 if(!dev||dev.enabled!==true||!P.purposeValid(dev.scope,dev.purpose)||
    !P.FCM.test(dev.fcmToken||""))
  return {sent:false,reason:"DEVICE_NOT_READY"};
 if(dev.scope==="tenant"){
  const tenant=(await db.collection("tenants").doc(dev.tenantId).get()).data();
  if(tenant?.active!==true)return {sent:false,reason:"TENANT_INACTIVE"};
 }
 const notice=(await ref.collection("notices").doc(eventId).get()).data();
 if(!notice||notice.purpose!==dev.purpose||notice.tenantId!==dev.tenantId)
  return {sent:false,reason:"NOTICE_NOT_OWNED"};
 try{
  await messaging.send({
   token:dev.fcmToken,
   notification:{title:"LK Shop",
    body:"คุณมีการแจ้งเตือนใหม่ เปิดแอปเพื่อดูรายละเอียด"},
   data:{eventId:String(P.numericEventId(eventId))},
   android:{priority:"high",notification:{channelId:"lkshop_staff_alerts_v2"}},
   apns:{payload:{aps:{sound:"default"}}},
  });
  return {sent:true};
 }catch{
  // Neither token, response payload nor financial information is logged.
  return {sent:false,reason:"FCM_SEND_UNCONFIRMED"};
 }
}
const docs=event=>({
 before:event.data?.before?.exists?event.data.before.data():null,
 after:event.data?.after?.exists?event.data.after.data():null,
});
// Source Superadmin finance room is a distinct global scope. Classification
// reuses the existing server finance status policy without requiring Telegram
// to be enabled. Only generic text is stored; no bank figures or slip paths.
const { _privateForTests:platformPolicy }=require("./platform-telegram-finance-events");
async function enqueuePlatform(db,event,{pilot=active(),at=Date.now()}={}){
 if(!pilot||!event||!P.HEX.test(event.id||""))
  return {queued:0,skipped:"INVALID_OR_DISABLED"};
 const room=P.roomKey("platform","global","superadmin_slip_manual");
 const devices=await db.collection("lkShopDevices").where("roomKey","==",room)
  .limit(12).get();
 let queued=0;
 for(const doc of devices.docs){
  const device=doc.data();
  if(device.enabled!==true||device.scope!=="platform"||
    device.purpose!=="superadmin_slip_manual")continue;
  const ref=doc.ref.collection("notices").doc(
   P.hash("lkshop-platform|"+event.id));
  try{
   await ref.create({
    body:"มีรายการหลักฐานการชำระเงินที่ต้องตรวจสอบใน Superadmin",
    createdAtMs:at,tenantId:"global",purpose:"superadmin_slip_manual",
    eventKind:"financial_review",
    createdAt:FieldValue.serverTimestamp(),
   });queued++;
  }catch(err){
   if(err?.code===6||err?.code==="already-exists")continue;
   throw err;
  }
 }
 return {queued};
}
for(const [name,collection,idName,kind] of [
 ["notifyLKShopPlatformWalletTopup","lalamoveWalletTopups","topupId","wallet_topup"],
 ["notifyLKShopPlatformRevenueShare","revenueSharePayments","paymentId","delivery_share"],
]){
 exports[name]=onDocumentWritten({
  document:"tenants/{tenantId}/"+collection+"/{"+idName+"}",
  region:REGION,
 },async event=>{
  if(!active())return;
  const record=docs(event);
  const item=platformPolicy.classifyChange(kind,{
   tenantId:event.params.tenantId,receiptId:event.params[idName],
  },record.before,record.after);
  return enqueuePlatform(getFirestore(),item);
 });
}
exports.notifyLKShopTenantOrder=onDocumentWritten({
 document:"tenants/{tenantId}/orders/{orderId}",region:REGION,
},async event=>{
 if(!active())return;
 const row=docs(event);
 return enqueue(getFirestore(),eventPolicy.orderEvent(
  event.params.tenantId,event.params.orderId,row.before,row.after));
});
for(const [name,collection,idName,kind] of [
 ["notifyLKShopWalletTopup","lalamoveWalletTopups","topupId","wallet_topup"],
 ["notifyLKShopRevenueShare","revenueSharePayments","paymentId","revenue_share"],
 ["notifyLKShopHybridPlatformFee","hybridBillingPaymentAttempts","attemptId","hybrid_platform_fee"],
]){
 exports[name]=onDocumentWritten({
  document:"tenants/{tenantId}/"+collection+"/{"+idName+"}",
  region:REGION,
 },async event=>{
  if(!active())return;
  const row=docs(event);
  return enqueue(getFirestore(),eventPolicy.financeEvent(
   event.params.tenantId,event.params[idName],kind,row.before,row.after));
 });
}
exports.pushLKShopNotice=onDocumentCreated({
 document:"lkShopDevices/{deviceId}/notices/{eventId}",
 region:REGION,timeoutSeconds:20,
},event=>sendPush(getFirestore(),event.params.deviceId,event.params.eventId));
exports._privateForTests={enqueue,enqueuePlatform,sendPush,eventKey,kindLabels};
