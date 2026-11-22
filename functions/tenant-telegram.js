"use strict";
// Merchant-owned Telegram settings are server-only and encrypted at rest.
// Read/write always resolves tenant from authenticated staff profile, never
// from a caller-controlled tenant ID or the current browser route.
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {defineSecret}=require("firebase-functions/params");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {randomUUID}=require("node:crypto");
const { _privateForTests: crypt }=require("./platform-telegram");
const encryptionKey=defineSecret("PENGUIN_TELEGRAM_ENCRYPTION_KEY");
const REGION="asia-southeast1";
const PURPOSES=["admin_store","cashier_delivery","kitchen_delivery"];
const FORMAT=/^[0-9]{7,20}:[a-zA-Z0-9_-]{30,120}$/;
const CHAT=/^-?[0-9]{5,20}$/;
const ID=/^[A-Za-z0-9_-]{4,128}$/;
const options={region:REGION,secrets:[encryptionKey],timeoutSeconds:30};
const fail=(code,message,detail)=>new HttpsError(code,message,detail?{code:detail}:undefined);
function purpose(value){
 if(!PURPOSES.includes(value))throw fail("invalid-argument","TELEGRAM_CHANNEL_INVALID","TELEGRAM_CREDENTIALS_INVALID");
 return value;
}
async function merchant(auth,db=getFirestore()){
 if(!auth?.uid)return Promise.reject(fail("unauthenticated","Sign-in required"));
 const snap=await db.collection("users").doc(auth.uid).get(),user=snap.data()||{};
 if(user.active!==true||!["owner","admin"].includes(user.role)||!ID.test(user.tenantId||""))
  throw fail("permission-denied","Tenant admin only");
 const tenant=await db.collection("tenants").doc(user.tenantId).get();
 if(tenant.data()?.active!==true)throw fail("permission-denied","Active tenant required");
 return {tenantId:user.tenantId,uid:auth.uid};
}
const channel=(db,id,p)=>db.collection("tenants").doc(id).collection("telegramChannels").doc(p);
function visible(p,doc={}){
 const tokenConfigured=typeof doc.tokenEncrypted==="string"&&doc.tokenEncrypted.startsWith("v1:");
 return {purpose:p,enabled:doc.enabled===true&&tokenConfigured&&CHAT.test(doc.chatId||""),
  chatId:CHAT.test(doc.chatId||"")?doc.chatId:"",
  tokenConfigured,tokenMasked:tokenConfigured?"••••"+String(doc.tokenSuffix||"****"):"",
  revision:typeof doc.revision==="string"?doc.revision:"0"};
}
exports.getTenantTelegramSettings=onCall(options,async request=>{
 const db=getFirestore(),{tenantId}=await merchant(request.auth,db);
 const docs=await Promise.all(PURPOSES.map(p=>channel(db,tenantId,p).get()));
 return {ok:true,storageReady:true,channels:PURPOSES.map((p,i)=>visible(p,docs[i].data()))};
});
exports.saveTenantTelegramSettings=onCall(options,async request=>{
 const db=getFirestore(),{tenantId,uid}=await merchant(request.auth,db),data=request.data||{},p=purpose(data.purpose);
 if(typeof data.enabled!=="boolean"||typeof data.clearToken!=="boolean"||
   typeof data.expectedRevision!=="string"||!(data.expectedRevision==="0"||/^[a-f0-9-]{36}$/.test(data.expectedRevision)))
   throw fail("invalid-argument","TELEGRAM_SETTINGS_INVALID","TELEGRAM_CREDENTIALS_INVALID");
 const chatId=String(data.chatId||"").trim(),token=String(data.botToken||"").trim();
 if((chatId&&!CHAT.test(chatId))||(token&&!FORMAT.test(token))||
   (data.clearToken&&(token||data.enabled)))
   throw fail("invalid-argument","TELEGRAM_CREDENTIALS_INVALID","TELEGRAM_CREDENTIALS_INVALID");
 const encrypted=token?crypt.encryptToken(token):"";
 const ref=channel(db,tenantId,p);
 const next=await db.runTransaction(async tx=>{
  const snap=await tx.get(ref),old=snap.data()||{};
  if((old.revision||"0")!==data.expectedRevision)
   throw fail("aborted","TELEGRAM_SETTINGS_CHANGED","TELEGRAM_SETTINGS_SAVE_UNCONFIRMED");
  const tokenEncrypted=data.clearToken?"":encrypted||old.tokenEncrypted||"";
  const suffix=data.clearToken?"":token?token.slice(-4):old.tokenSuffix||"";
  if(data.enabled&&(!CHAT.test(chatId)||!tokenEncrypted))
   throw fail("failed-precondition","TELEGRAM_CREDENTIALS_REQUIRED","TELEGRAM_CREDENTIALS_REQUIRED");
  const row={purpose:p,enabled:data.enabled,chatId,tokenEncrypted,tokenSuffix:suffix,
   revision:randomUUID(),updatedAt:FieldValue.serverTimestamp(),updatedBy:uid};
  tx.set(ref,row);
  return row;
 });
 const confirmed=(await ref.get()).data()||{};
 if(confirmed.revision!==next.revision||confirmed.chatId!==next.chatId||confirmed.tokenEncrypted!==next.tokenEncrypted)
  throw fail("aborted","TELEGRAM_SETTINGS_SAVE_UNCONFIRMED","TELEGRAM_SETTINGS_SAVE_UNCONFIRMED");
 return {ok:true,item:visible(p,confirmed)};
});
async function sendTelegram(token,chatId,message,fetcher=fetch){
 const response=await fetcher("https://api.telegram.org/bot"+token+"/sendMessage",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({chat_id:chatId,text:message,disable_web_page_preview:true}),
  signal:AbortSignal.timeout(12000),
 });
 if(!response.ok||(await response.json().catch(()=>null))?.ok!==true)throw Error("TELEGRAM_SEND_UNCONFIRMED");
 return true;
}
exports.testTenantTelegramSettings=onCall(options,async request=>{
 const db=getFirestore(),{tenantId}=await merchant(request.auth,db),p=purpose(request.data?.purpose);
 const doc=(await channel(db,tenantId,p).get()).data()||{};
 if(!visible(p,doc).enabled)throw fail("failed-precondition","TELEGRAM_CHANNEL_NOT_READY","TELEGRAM_CHANNEL_NOT_READY");
 try{
  const message="PENGUIN · ทดสอบช่องทาง "+p+"\nเป็นข้อความทดสอบ ไม่ใช่หลักฐานการรับเงิน\nhttps://penguin-food.web.app/"+(p==="kitchen_delivery"?"kitchen":p==="cashier_delivery"?"cashier":"admin");
  await sendTelegram(crypt.decryptToken(doc.tokenEncrypted),doc.chatId,message);
  return {ok:true,sent:true};
 }catch{
  // Never print Bot tokens, HTTP URLs, response bodies or bank notifications.
  throw fail("failed-precondition","TELEGRAM_TEST_SEND_FAILED","TELEGRAM_TEST_SEND_FAILED");
 }
});
exports._privateForTests={merchant,visible,purpose,channel,sendTelegram,PURPOSES,options};
