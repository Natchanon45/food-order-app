"use strict";
const {onCall,onRequest,HttpsError}=require("firebase-functions/v2/https");
const {getFirestore}=require("firebase-admin/firestore");
const {randomBytes,randomUUID}=require("node:crypto");
const policy=require("./payment-companion-policy");
const options={region:"asia-southeast1",timeoutSeconds:30};
const flags={bankConfirmed:false,paymentVerified:false,canSettleInvoice:false,canReleaseKitchen:false};
function pilotTenant(){
 if(process.env.FUNCTIONS_EMULATOR==="true"||process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST||String(process.env.GCLOUD_PROJECT||process.env.GCP_PROJECT||"").startsWith("demo-")||process.env.PENGUIN_PAYMENT_COMPANION_PILOT_ENABLED!=="1")return "";
 const id=process.env.PENGUIN_PAYMENT_COMPANION_PILOT_TENANT_ID||"";
 return policy.ID.test(id)?id:"";
}
const scope=(db,id)=>db.collection("paymentCompanionTenants").doc(id);
const keyRef=(db,hash)=>db.collection("paymentCompanionDeviceKeys").doc(hash);
function error(code,message){return new HttpsError(code,message);}
async function owner(db,auth,tx){
 if(!auth?.uid)throw error("unauthenticated","Sign-in required");
 const read=ref=>tx?tx.get(ref):ref.get();
 const u=(await read(db.collection("users").doc(auth.uid))).data();
 if(u?.active!==true||u.role!=="owner"||typeof u.tenantId!=="string"||!policy.ID.test(u.tenantId))throw error("permission-denied","Owner only");
 const tenant=(await read(db.collection("tenants").doc(u.tenantId))).data();
 if(tenant?.active!==true)throw error("permission-denied","Active tenant only");
 return u.tenantId;
}
function requirePilot(id){if(!pilotTenant()||id!==pilotTenant())throw error("failed-precondition","COMPANION_PILOT_DISABLED");}
function devicePublic(row){return {id:row.id,label:row.label,enabled:row.enabled===true,createdUTC:new Date(row.createdMs).toISOString(),lastSeenUTC:row.lastSeenMs?new Date(row.lastSeenMs).toISOString():null};}
exports.pairPaymentCompanionDevice=onCall(options,async request=>{
 const db=getFirestore(),label=typeof request.data?.label==="string"?request.data.label.trim():"";
 if(!policy.LABEL.test(label))throw error("invalid-argument","COMPANION_LABEL_INVALID");
 const token=randomBytes(32).toString("hex"),hash=policy.digest(token),id=randomUUID(),createdMs=Date.now();
 await db.runTransaction(async tx=>{
  const tenantId=await owner(db,request.auth,tx);requirePilot(tenantId);
  const root=scope(db,tenantId),meta=(await tx.get(root)).data()||{};
  const active=meta.activeDeviceIds??[];
  if(!Array.isArray(active)||active.length>=3)throw error("resource-exhausted","COMPANION_ACTIVE_DEVICE_LIMIT");
  tx.create(root.collection("devices").doc(id),{id,label,enabled:true,keyHash:hash,createdMs});
  tx.create(keyRef(db,hash),{tenantId,deviceId:id});
  tx.set(root,{activeDeviceIds:[...active,id]},{merge:true});
 });
 return {deviceId:id,pairingToken:token,showOnce:true,notificationVerified:false,...flags};
});
exports.changePaymentCompanionDevice=onCall(options,async request=>{
 const db=getFirestore(),{deviceId,action}=request.data||{};
 if(typeof deviceId!=="string"||!policy.ID.test(deviceId)||!["revoke","archive"].includes(action))throw error("invalid-argument","COMPANION_DEVICE_INVALID");
 return db.runTransaction(async tx=>{
  const tenantId=await owner(db,request.auth,tx),root=scope(db,tenantId);
  // Revocation stays possible even after pilot is disabled.
  const ref=root.collection("devices").doc(deviceId),[device,meta]=await Promise.all([tx.get(ref),tx.get(root)]);
  const row=device.data();if(!row)throw error("not-found","COMPANION_NOT_FOUND");
  if(action==="archive"){
   if(row.enabled||row.keyHash||!row.revokedMs)throw error("failed-precondition","COMPANION_ARCHIVE_REVOKED_ONLY");
   tx.update(ref,{archivedMs:Date.now()});return {archived:true,keyDeleted:true,notificationsPreserved:true};
  }
  if(!row.enabled){if(row.keyHash)throw error("failed-precondition","COMPANION_KEY_ERASURE_UNCONFIRMED");return {revoked:true};}
  if(!policy.HEX.test(row.keyHash||""))throw error("failed-precondition","COMPANION_KEY_INVALID");
  const ids=meta.data()?.activeDeviceIds;
  if(!Array.isArray(ids)||!ids.includes(deviceId))throw error("failed-precondition","COMPANION_DEVICE_STATE_INVALID");
  tx.delete(keyRef(db,row.keyHash));tx.update(ref,{enabled:false,keyHash:null,revokedMs:Date.now()});
  tx.set(root,{activeDeviceIds:ids.filter(id=>id!==deviceId)},{merge:true});
  return {revoked:true};
 });
});
exports.getPaymentCompanionDashboard=onCall(options,async request=>{
 const db=getFirestore(),tenantId=await owner(db,request.auth);
 const root=scope(db,tenantId),tenant=db.collection("tenants").doc(tenantId);
 const [devices,notices,store]=await Promise.all([root.collection("devices").orderBy("createdMs","desc").limit(100).get(),root.collection("notices").orderBy("receivedMs","desc").limit(201).get(),tenant.collection("settings").doc("store").get()]);
 const recipient=policy.receiver(store.data()),enabled=pilotTenant()===tenantId;
 const rows=notices.docs.map(d=>d.data());
 const items=rows.slice(0,50).map(row=>({id:row.id,deviceId:row.deviceId,deviceLabel:row.deviceLabel,amountSatang:row.amountSatang,source:row.source,receiverSuffix:row.receiverSuffix,bankTimeUTC:new Date(row.bankMs).toISOString(),receivedUTC:new Date(row.receivedMs).toISOString(),cashierPaymentConfirmed:false,...flags}));
 let matches=[],matchStatus="disabled";
 if(enabled){
  // Read bounded recent orders; only advisory. In a busy store, refuse to
  // claim a unique match if the bounded data cannot prove uniqueness.
  const now=Date.now(),snapshot=await tenant.collection("orders").where("createdAt",">=",new Date(now-2*86400000)).orderBy("createdAt","desc").limit(201).get();
  const eligible=snapshot.docs.flatMap(d=>{
   const o=d.data(),createdMs=o.createdAt?.toMillis?.(),amountSatang=Math.round(o.totalAmount*100);
   if(o.orderType!=="delivery"||o.paymentMethod!=="promptpay"||o.paymentStatus!=="pending_verification"||["cancelled","canceled","completed"].includes(o.status)||!Number.isFinite(createdMs)||!Number.isFinite(o.totalAmount)||!Number.isSafeInteger(amountSatang)||amountSatang<=0||Math.abs(o.totalAmount*100-amountSatang)>0.00001)return [];
   return [{id:d.id,amountSatang,createdMs,hasSlip:typeof o.paymentSlipPath==="string"&&o.paymentSlipPath.startsWith("tenants/"+tenantId+"/payment-slips/"+d.id+"/")}];
  });
  const truncated=snapshot.size>200||notices.size>200;
  matches=policy.rank(eligible.slice(0,100),rows.filter(n=>n.receivedMs>=now-2*86400000),recipient,{truncated:truncated||eligible.length>100});
  matchStatus=truncated||eligible.length>100?"bounded_unavailable":"advisory";
 }
 return {enabled,devices:devices.docs.map(d=>d.data()).filter(d=>!d.archivedMs).map(devicePublic),items,matches,matchStatus,receiver:recipient,apkDownloadAvailable:false,...flags};
});
function bearer(req){
 const value=req.get("authorization")||"";
 const match=/^Bearer ([a-f0-9]{64})$/.exec(value);
 return match?policy.digest(match[1]):"";
}
async function authorized(db,tx,hash){
 if(!hash)throw Error("COMPANION_DEVICE_NOT_PAIRED");
 const key=(await tx.get(keyRef(db,hash))).data();
 if(!key||key.tenantId!==pilotTenant()||!policy.ID.test(key.deviceId||""))throw Error("COMPANION_DEVICE_NOT_PAIRED");
 const root=scope(db,key.tenantId),ref=root.collection("devices").doc(key.deviceId);
 const [device,tenant]=await Promise.all([tx.get(ref),tx.get(db.collection("tenants").doc(key.tenantId))]);
 const row=device.data();
 if(!row?.enabled||row.archivedMs||row.keyHash!==hash||tenant.data()?.active!==true)throw Error("COMPANION_DEVICE_NOT_PAIRED");
 return {key,root,ref,row};
}
exports.paymentCompanionDeviceStatus=onRequest(options,async(req,res)=>{
 res.set("Cache-Control","no-store");
 if(req.method!=="GET")return res.status(405).json({error:"METHOD_NOT_ALLOWED"});
 if(!pilotTenant())return res.status(404).json({error:"COMPANION_PILOT_DISABLED"});
 try{
  const db=getFirestore(),result=await db.runTransaction(async tx=>{
   const {key}=await authorized(db,tx,bearer(req));return {connected:true,deviceId:key.deviceId,tenantId:key.tenantId,...flags};
  });return res.status(200).json(result);
 }catch(e){return res.status(e.message==="COMPANION_DEVICE_NOT_PAIRED"?401:503).json({error:"COMPANION_DEVICE_UNAVAILABLE"});}
});
exports.paymentCompanionNoticeIngest=onRequest(options,async(req,res)=>{
 res.set("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({error:"METHOD_NOT_ALLOWED"});
 if(!pilotTenant())return res.status(404).json({error:"COMPANION_PILOT_DISABLED"});
 if(!/^application\/json(?:;|$)/i.test(req.get("content-type")||"")||!Buffer.isBuffer(req.rawBody)||req.rawBody.length>18000)return res.status(415).json({error:"COMPANION_JSON_REQUIRED"});
 try{
  const parsed=JSON.parse(req.rawBody.toString("utf8")),now=Date.now(),item=policy.notice(parsed,now),db=getFirestore();
  const result=await db.runTransaction(async tx=>{
   const {key,root,ref,row}=await authorized(db,tx,bearer(req));
   // Idempotency is per device + event. Do not merge independent equal-value
   // transfers or different devices just because account/time/amount agree.
   const id=policy.digest(key.deviceId+":"+item.eventId),noticeRef=root.collection("notices").doc(id);
   const prior=await tx.get(noticeRef);
   if(prior.exists){
    const old=prior.data();
    if(["eventId","amountSatang","source","receiverSuffix","bankMs","observedMs"].some(k=>old[k]!==item[k]))throw Error("COMPANION_EVENT_CONFLICT");
    return {stored:false,duplicate:true,notificationVerified:false,...flags};
   }
   tx.create(noticeRef,{...item,id,deviceId:key.deviceId,deviceLabel:row.label,receivedMs:now,verificationStatus:"unverified"});
   tx.update(ref,{lastSeenMs:now});
   return {stored:true,duplicate:false,notificationVerified:false,...flags};
  });return res.status(200).json(result);
 }catch(e){
  const code=e.message;
  const status=code==="COMPANION_DEVICE_NOT_PAIRED"?401:code==="COMPANION_EVENT_CONFLICT"?409:code==="COMPANION_RAW_NOT_SUPPORTED"?422:code==="COMPANION_NOTICE_INVALID"||e instanceof SyntaxError?422:503;
  return res.status(status).json({error:status===503?"COMPANION_NOTICE_STORE_UNCONFIRMED":status===422&&code!=="COMPANION_RAW_NOT_SUPPORTED"?"COMPANION_NOTICE_INVALID":code});
 }
});
