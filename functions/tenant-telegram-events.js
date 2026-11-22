"use strict";
// Tenant Telegram is presentation only. Source of truth: Firestore order and
// proof documents. No notification can mark Paid, debit wallet or admit kitchen.
const {onDocumentWritten,onDocumentCreated}=require("firebase-functions/v2/firestore");
const {defineSecret}=require("firebase-functions/params");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {createHash}=require("node:crypto");
const { _privateForTests: secrets }=require("./platform-telegram");
const { _privateForTests: channels }=require("./tenant-telegram");
const REGION="asia-southeast1";
const telegramKey=defineSecret("PENGUIN_TELEGRAM_ENCRYPTION_KEY");
const ID=/^[A-Za-z0-9_-]{4,128}$/;
const MAX_AMOUNT_SATANG=100000000;
const ALLOWED=new Set(channels.PURPOSES);
const SITE="https://penguin-food.web.app";
const kinds={
 cod_created:"ออร์เดอร์ Delivery COD ใหม่ • ยังไม่ยืนยันการรับเงิน ต้องประสานการเก็บเงินกับคนขับเอง",
 pending_slip:"Delivery แนบหลักฐานแล้ว • รอตรวจรับเงินจริง ห้ามถือว่าชำระสำเร็จ",
 original_slip:"Delivery รับสลิปต้นฉบับหลัง QR • รอตรวจรับเงินจริง",
 uat_kitchen:"BankAlert UAT • ส่งเข้าครัวเบื้องต้นแล้ว แต่ยังไม่ยืนยันเงินเข้า และยังห้ามเรียก Lalamove",
 paid:"Delivery ระบบบันทึกสถานะชำระแล้ว • ตรวจสอบรายการในระบบ",
 wallet_topup:"เติมเครดิต Lalamove",
 revenue_share:"ส่วนแบ่ง Delivery",
 hybrid_platform_fee:"ค่าสมาชิกและค่าบริการแพลตฟอร์ม",
};
function satang(value){
 if(typeof value!=="number"||!Number.isFinite(value))return null;
 const amount=Math.round(value*100);
 return Number.isSafeInteger(amount)&&amount>0&&amount<=MAX_AMOUNT_SATANG&&
   Math.abs(value*100-amount)<0.00001?amount:null;
}
function orderEvent(tenantId,orderId,before,after){
 if(!ID.test(tenantId||"")||!ID.test(orderId||"")||!after||
   after.tenantId!==tenantId||after.orderType!=="delivery"||!["cod","promptpay","stripe_connect"].includes(after.paymentMethod))return null;
 const fresh=!before;
 const paid=after.paymentStatus==="paid"&&before?.paymentStatus!=="paid";
 const uat=after.companionKitchenRelease?.status==="admitted_unverified"&&
   before?.companionKitchenRelease?.status!=="admitted_unverified"&&
   after.paymentStatus==="pending_verification"&&after.companionKitchenRelease.paymentVerified===false&&
   after.companionKitchenRelease.canDispatchRider===false;
 const originalSlip=after.paymentQrMode==="confirmed_order_5m"&&
   after.paymentQrSlipFallbackStatus==="submitted"&&before?.paymentQrSlipFallbackStatus!=="submitted"&&
   after.paymentStatus==="pending_verification"&&after.paymentReviewRequired===true&&
   typeof after.paymentSlipPath==="string"&&after.paymentSlipPath.startsWith("tenants/"+tenantId+"/payment-slips/"+orderId+"/");
 const manual=after.paymentMethod==="promptpay"&&
   after.paymentQrMode!=="confirmed_order_5m"&&
   after.paymentReviewRequired===true&&after.paymentStatus==="pending_verification"&&
   Boolean(after.paymentSlipPath)&&
   (fresh||before?.paymentReviewRequired!==true);
 const cod=fresh&&after.paymentMethod==="cod"&&after.paymentStatus==="unpaid";
 const kind=paid?"paid":uat?"uat_kitchen":originalSlip?"original_slip":manual?"pending_slip":cod?"cod_created":null;
 if(!kind)return null;
 const amountSatang=satang(after.totalAmount);
 if(!amountSatang)return null;
 const purposes=kind==="original_slip"||kind==="pending_slip"
   ?["admin_store","cashier_delivery"]:channels.PURPOSES;
 const bill=typeof after.billNo==="string"&&/^B[0-9]{6}-(?:[0-9]{5,10}|L[0-9A-F]{12})$/.test(after.billNo)?after.billNo:orderId;
 return {kind,tenantId,orderId,amountSatang,bill,purposes};
}
function financeEvent(tenantId,receiptId,kind,before,after){
 if(!ID.test(tenantId||"")||!ID.test(receiptId||"")||!after||
   !["wallet_topup","revenue_share","hybrid_platform_fee"].includes(kind))return null;
 if(kind==="hybrid_platform_fee"&&
    (after.tenantId!==tenantId||!ID.test(after.invoiceId||"")))return null;
 // Every intake and every later decision is an idempotent distinct event.
 const hybrid=kind==="hybrid_platform_fee",next=String(after.status||"");
 if(!(hybrid?["pending_review","paid","rejected"]:["pending","approved","rejected"]).includes(next)||
    before?.status===next||before&&(hybrid?before.status!=="pending_review":before.status!=="pending"))return null;
 const value=kind==="wallet_topup"||hybrid?after.amount:after.platformAmountDue;
 const amountSatang=satang(value);
 if(!amountSatang)return null;
 const result=next==="paid"?"ระบบบันทึกชำระค่าบริการแล้ว":
  next==="approved"?"ระบบบันทึกการอนุมัติแล้ว":
  next==="rejected"?"ระบบปฏิเสธรายการแล้ว":
  hybrid?"รับสลิปค่าบริการแล้ว รอ Superadmin ตรวจสอบ ยังไม่ถือว่าชำระสำเร็จ":
  "รับหลักฐานแล้ว โปรดตรวจเงื่อนไขในระบบ ยังไม่ใช่การอนุมัติ";
 return {kind,tenantId,orderId:receiptId,amountSatang,bill:receiptId,purposes:["admin_store"],result,phase:next};
}
function textFor(entry,purpose){
 if(!entry||!ALLOWED.has(purpose)||!entry.purposes.includes(purpose)||!kinds[entry.kind])return "";
 const amount=new Intl.NumberFormat("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}).format(entry.amountSatang/100);
 const path=purpose==="kitchen_delivery"?"kitchen":purpose==="cashier_delivery"?"cashier":"admin";
 const link=SITE+"/"+path+(purpose==="admin_store"?"":"?orderId="+encodeURIComponent(entry.orderId));
 return ["PENGUIN | "+kinds[entry.kind], "ร้าน: "+entry.tenantId,
   "เลขที่บิล/อ้างอิง: "+entry.bill,
   "ยอดรายการ: "+amount+" บาท",
   ...(entry.result?["สถานะ: "+entry.result]:[]),
   "Telegram เป็นเพียงข้อความแจ้งเตือน ไม่ใช่หลักฐานธนาคาร",
   link].join("\n");
}
function eventRef(db,entry,purpose){
 const key=createHash("sha256").update([entry.tenantId,entry.orderId,entry.kind,entry.phase||"",purpose].join("|")).digest("hex");
 return db.collection("tenants").doc(entry.tenantId).collection("telegramOutbox").doc(key);
}
async function queue(db,entry){
 if(!entry)return {queued:0,skipped:"INVALID_EVENT"};
 const tenant=await db.collection("tenants").doc(entry.tenantId).get();
 if(tenant.data()?.active!==true)return {queued:0,skipped:"TENANT_INACTIVE"};
 let queued=0;
 for(const purpose of entry.purposes){
  const config=(await channels.channel(db,entry.tenantId,purpose).get()).data()||{};
  if(!channels.visible(purpose,config).enabled)continue;
  const text=textFor(entry,purpose);if(!text)continue;
  const ref=eventRef(db,entry,purpose);
  try{
   await ref.create({tenantId:entry.tenantId,purpose,orderId:entry.orderId,
    kind:entry.kind,phase:entry.phase||"",text,status:"pending",
    createdAt:FieldValue.serverTimestamp()});
   queued++;
  }catch(error){
   if(error?.code===6||error?.code==="already-exists")continue;
   throw error;
  }
 }
 return {queued};
}
async function deliver(db,tenantId,eventId,fetcher=fetch){
 if(!ID.test(tenantId||"")||!/^[a-f0-9]{64}$/.test(eventId||""))
   return {sent:false,reason:"INVALID_EVENT"};
 const ref=db.collection("tenants").doc(tenantId).collection("telegramOutbox").doc(eventId);
 const row=await db.runTransaction(async tx=>{
  const snap=await tx.get(ref),current=snap.data();
  if(!current||current.status!=="pending"||current.tenantId!==tenantId||
    !ALLOWED.has(current.purpose)||!["cod_created","pending_slip","original_slip","uat_kitchen","paid","wallet_topup","revenue_share","hybrid_platform_fee"].includes(current.kind))
    return null;
  tx.update(ref,{status:"dispatching",attemptedAt:FieldValue.serverTimestamp()});
  return current;
 });
 if(!row)return {sent:false,reason:"NOT_PENDING"};
 try{
  const [tenant,config]=await Promise.all([
   db.collection("tenants").doc(tenantId).get(),
   channels.channel(db,tenantId,row.purpose).get(),
  ]);
  const settings=config.data()||{};
  if(tenant.data()?.active!==true||!channels.visible(row.purpose,settings).enabled)
   throw Error("CHANNEL_DISABLED");
  const token=secrets.decryptToken(settings.tokenEncrypted);
  await channels.sendTelegram(token,settings.chatId,row.text,fetcher);
  await ref.update({status:"sent",sentAt:FieldValue.serverTimestamp()});
  return {sent:true};
 }catch{
  // A request timeout is ambiguous: do not auto-retry or double-send.
  await ref.update({status:"unconfirmed",unconfirmedAt:FieldValue.serverTimestamp()});
  return {sent:false,reason:"UNCONFIRMED"};
 }
}
const snapshot=event=>({before:event.data?.before?.exists?event.data.before.data():null,
 after:event.data?.after?.exists?event.data.after.data():null});
exports.notifyTenantTelegramDelivery=onDocumentWritten({
 document:"tenants/{tenantId}/orders/{orderId}",region:REGION,
},async event=>{
 const {tenantId,orderId}=event.params||{},row=snapshot(event);
 return queue(getFirestore(),orderEvent(tenantId,orderId,row.before,row.after));
});
exports.notifyTenantTelegramWalletTopup=onDocumentWritten({
 document:"tenants/{tenantId}/lalamoveWalletTopups/{topupId}",region:REGION,
},async event=>{
 const row=snapshot(event),{tenantId,topupId}=event.params||{};
 return queue(getFirestore(),financeEvent(tenantId,topupId,"wallet_topup",row.before,row.after));
});
exports.notifyTenantTelegramRevenueShare=onDocumentWritten({
 document:"tenants/{tenantId}/revenueSharePayments/{paymentId}",region:REGION,
},async event=>{
 const row=snapshot(event),{tenantId,paymentId}=event.params||{};
 return queue(getFirestore(),financeEvent(tenantId,paymentId,"revenue_share",row.before,row.after));
});
exports.notifyTenantTelegramHybridPlatformFee=onDocumentWritten({
 document:"tenants/{tenantId}/hybridBillingPaymentAttempts/{attemptId}",region:REGION,
},async event=>{
 const row=snapshot(event),{tenantId,attemptId}=event.params||{};
 return queue(getFirestore(),financeEvent(tenantId,attemptId,"hybrid_platform_fee",row.before,row.after));
});
exports.deliverTenantTelegramEvent=onDocumentCreated({
 document:"tenants/{tenantId}/telegramOutbox/{eventId}",
 region:REGION,secrets:[telegramKey],timeoutSeconds:25,
},async event=>deliver(getFirestore(),event.params.tenantId,event.params.eventId));
exports._privateForTests={satang,orderEvent,financeEvent,textFor,eventRef,queue,deliver};
