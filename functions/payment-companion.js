"use strict";
const {onCall,onRequest,HttpsError}=require("firebase-functions/v2/https");
const {getFirestore}=require("firebase-admin/firestore");
const {randomBytes,randomUUID}=require("node:crypto");
const policy=require("./payment-companion-policy");
const binding=require("./payment-companion-receiver");
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
async function staff(db,auth,tx,roles=["owner"]){
 if(!auth?.uid)throw error("unauthenticated","Sign-in required");
 const read=ref=>tx?tx.get(ref):ref.get();
 const u=(await read(db.collection("users").doc(auth.uid))).data();
 if(u?.active!==true||!roles.includes(u.role)||typeof u.tenantId!=="string"||!policy.ID.test(u.tenantId))throw error("permission-denied","Authorized merchant staff only");
 const tenant=(await read(db.collection("tenants").doc(u.tenantId))).data();
 if(tenant?.active!==true)throw error("permission-denied","Active tenant only");
 return u.tenantId;
}
const owner=(db,auth,tx)=>staff(db,auth,tx);
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
exports.setPaymentCompanionReceiver=onCall(options,async request=>{
 const db=getFirestore(),{enabled,bankCode,accountLast4}=request.data||{};
 if(typeof enabled!=="boolean"||enabled&&(typeof bankCode!=="string"||!/^\d{4}$/.test(accountLast4||"")))throw error("invalid-argument","COMPANION_RECEIVER_INVALID");
 return db.runTransaction(async tx=>{
  const tenantId=await owner(db,request.auth,tx),root=scope(db,tenantId),storeRef=db.collection("tenants").doc(tenantId).collection("settings").doc("store");
  const [store,meta]=await Promise.all([tx.get(storeRef),tx.get(root)]);
  if(enabled)requirePilot(tenantId);
  const recipient=policy.receiver(store.data()),revision=binding.receiverRevision(store);
  if(enabled&&(!revision||recipient.bankCode!==bankCode||recipient.accountLast4!==accountLast4))throw error("failed-precondition","COMPANION_RECEIVER_MUST_MATCH_STORE_SETTINGS");
  const prior=meta.data()?.receiver;
  const linked=enabled?{enabled:true,revision,bankCode,accountLast4,confirmedAtMs:prior?.enabled===true&&prior.revision===revision?prior.confirmedAtMs:Date.now(),confirmedByUid:request.auth.uid}:{enabled:false,disabledAtMs:Date.now(),confirmedByUid:request.auth.uid};
  tx.set(root,{receiver:linked},{mergeFields:["receiver"]});
  return {saved:true,receiver:binding.receiverState(store,linked,pilotTenant()===tenantId),...flags};
 });
});
async function candidateSnapshot(db,tenantId,tx){
 const root=scope(db,tenantId),tenant=db.collection("tenants").doc(tenantId),read=ref=>tx?tx.get(ref):ref.get();
 const now=Date.now();
 const [meta,store,devices,notices,orders]=await Promise.all([
  read(root),read(tenant.collection("settings").doc("store")),
  read(root.collection("devices").where("enabled","==",true).limit(4)),
  read(root.collection("notices").where("receivedMs",">=",now-2*86400000).orderBy("receivedMs","desc").limit(201)),
  read(tenant.collection("orders").where("createdAt",">=",new Date(now-2*86400000)).orderBy("createdAt","desc").limit(201))
 ]);
 const link=meta.data()?.receiver,recipient=binding.receiverState(store,link,pilotTenant()===tenantId);
 const active=new Map(devices.docs.map(d=>[d.id,d.data()]));
 const rows=notices.docs.map(d=>d.data());
 const eligible=orders.docs.flatMap(d=>{
  const o=d.data(),createdMs=o.createdAt?.toMillis?.(),amountSatang=Math.round(o.totalAmount*100);
  if(o.orderType!=="delivery"||o.paymentMethod!=="promptpay"||o.paymentStatus!=="pending_verification"||o.status!=="pending"||!Number.isFinite(createdMs)||createdMs>now+120000||!Number.isFinite(o.totalAmount)||!Number.isSafeInteger(amountSatang)||amountSatang<=0||Math.abs(o.totalAmount*100-amountSatang)>0.00001)return [];
  return [{id:d.id,amountSatang,createdMs,hasSlip:typeof o.paymentSlipPath==="string"&&o.paymentSlipPath.startsWith("tenants/"+tenantId+"/payment-slips/"+d.id+"/")}];
 });
 const truncated=orders.size>200||notices.size>200||devices.size>3||eligible.length>100;
 // A notice cannot be considered after revocation, reconfiguration, or
 // receiver opt-in. Already consumed review claims remain visible as history.
 const validRows=rows.filter(n=>recipient.enabled&&binding.allowedNotice(n,link,active.get(n.deviceId)));
 const matches=policy.rank(eligible.slice(0,100),validRows,recipient,{truncated:truncated||!recipient.enabled});
 const claimed=await Promise.all(matches.filter(m=>m.notificationId).map(async m=>({m,claim:(await read(root.collection("reviewClaims").doc(m.notificationId))).data()})));
 for(const {m,claim} of claimed)if(claim&&claim.orderId!==m.orderId){
  m.status="ambiguous";delete m.notificationId;delete m.source;delete m.timeDifferenceSeconds;
 }
 return {root,tenant,recipient,link,rows,validRows,eligible,matches,matchStatus:!recipient.enabled?"receiver_unconfirmed":truncated?"bounded_unavailable":"advisory"};
}
exports.getPaymentCompanionCashierReview=onCall(options,async request=>{
 const db=getFirestore(),tenantId=await staff(db,request.auth,null,["owner","admin","cashier"]);
 const orderId=request.data?.orderId;
 if(typeof orderId!=="string"||!policy.ID.test(orderId))throw error("invalid-argument","COMPANION_ORDER_INVALID");
 if(pilotTenant()!==tenantId)return {enabled:false,item:null,...flags};
 const context=await candidateSnapshot(db,tenantId),match=context.matches.find(m=>m.orderId===orderId),audit=(await context.root.collection("reviews").doc(orderId).get()).data();
 const notice=context.validRows.find(n=>n.id===match?.notificationId),eligible=context.eligible.find(o=>o.id===orderId);
 const canRecord=context.matchStatus==="advisory"&&match?.status==="candidate"&&match.hasSlip===true&&!!notice&&!!eligible&&notice.receivedMs<eligible.createdMs&&!audit;
 return {enabled:true,item:match||null,canRecord,matchStatus:context.matchStatus,review:audit?{status:audit.status,recordedAtMs:audit.recordedAtMs,amountSatang:audit.amountSatang,notificationId:audit.notificationId}:null,...flags};
});
exports.recordPaymentCompanionCashierReview=onCall(options,async request=>{
 const db=getFirestore(),{orderId,notificationId,acknowledged}=request.data||{};
 if(typeof orderId!=="string"||!policy.ID.test(orderId)||typeof notificationId!=="string"||!policy.HEX.test(notificationId)||acknowledged!==true)throw error("invalid-argument","COMPANION_REVIEW_INVALID");
 return db.runTransaction(async tx=>{
  const tenantId=await staff(db,request.auth,tx,["owner","admin","cashier"]);requirePilot(tenantId);
  const context=await candidateSnapshot(db,tenantId,tx);
  const reviewRef=context.root.collection("reviews").doc(orderId),claimRef=context.root.collection("reviewClaims").doc(notificationId);
  const [audit,claim,order]=await Promise.all([tx.get(reviewRef),tx.get(claimRef),tx.get(context.tenant.collection("orders").doc(orderId))]);
  const previous=audit.data();
  if(previous){
   if(previous.notificationId!==notificationId||claim.data()?.orderId!==orderId)throw error("failed-precondition","COMPANION_REVIEW_CONFLICT");
   return {recorded:true,alreadyRecorded:true,...flags};
  }
  const matched=context.matches.find(m=>m.orderId===orderId),notice=context.validRows.find(n=>n.id===notificationId),o=order.data();
  if(context.matchStatus!=="advisory"||matched?.status!=="candidate"||matched.notificationId!==notificationId||!notice||notice.receivedMs>=o?.createdAt?.toMillis?.()||claim.exists||!matched.hasSlip||o?.paymentStatus!=="pending_verification"||o.status!=="pending"||matched.amountSatang!==Math.round(o.totalAmount*100)||o.createdAt?.toMillis?.()<context.link.confirmedAtMs)throw error("failed-precondition","COMPANION_REVIEW_UNCONFIRMED");
  const record={status:"cashier_observation_reviewed_unverified",tenantId,orderId,notificationId,amountSatang:matched.amountSatang,receiverRevision:context.link.revision,recordedByUid:request.auth.uid,recordedAtMs:Date.now(),...flags};
  tx.create(reviewRef,record);tx.create(claimRef,{orderId,notificationId,recordedAtMs:record.recordedAtMs});
  return {recorded:true,alreadyRecorded:false,...flags};
 });
});
exports.getPaymentCompanionDashboard=onCall(options,async request=>{
 const db=getFirestore(),tenantId=await owner(db,request.auth);
 const root=scope(db,tenantId),tenant=db.collection("tenants").doc(tenantId);
 const [devices,notices,store,meta]=await Promise.all([root.collection("devices").orderBy("createdMs","desc").limit(100).get(),root.collection("notices").orderBy("receivedMs","desc").limit(201).get(),tenant.collection("settings").doc("store").get(),root.get()]);
 const enabled=pilotTenant()===tenantId;
 let recipient=binding.receiverState(store,meta.data()?.receiver,enabled);
 const rows=notices.docs.map(d=>d.data());
 const items=rows.slice(0,50).map(row=>({id:row.id,deviceId:row.deviceId,deviceLabel:row.deviceLabel,amountSatang:row.amountSatang,source:row.source,receiverSuffix:row.receiverSuffix,bankTimeUTC:new Date(row.bankMs).toISOString(),receivedUTC:new Date(row.receivedMs).toISOString(),cashierPaymentConfirmed:false,...flags}));
 let matches=[],matchStatus="disabled";
 if(enabled){
  const context=await candidateSnapshot(db,tenantId);
  matches=context.matches;matchStatus=context.matchStatus;recipient=context.recipient;
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
   const [prior,meta,store]=await Promise.all([tx.get(noticeRef),tx.get(root),tx.get(db.collection("tenants").doc(key.tenantId).collection("settings").doc("store"))]);
   const link=meta.data()?.receiver,recipient=binding.receiverState(store,link,true);
   if(prior.exists){
    const old=prior.data();
    if(["eventId","amountSatang","source","receiverSuffix","bankMs","observedMs"].some(k=>old[k]!==item[k]))throw Error("COMPANION_EVENT_CONFLICT");
    return {stored:false,duplicate:true,notificationVerified:false,...flags};
   }
   tx.create(noticeRef,{...item,id,deviceId:key.deviceId,deviceLabel:row.label,receivedMs:now,receiverRevision:recipient.enabled?link.revision:null,verificationStatus:"unverified"});
   tx.update(ref,{lastSeenMs:now});
   return {stored:true,duplicate:false,notificationVerified:false,...flags};
  });return res.status(200).json(result);
 }catch(e){
  const code=e.message;
  const status=code==="COMPANION_DEVICE_NOT_PAIRED"?401:code==="COMPANION_EVENT_CONFLICT"?409:code==="COMPANION_RAW_NOT_SUPPORTED"?422:code==="COMPANION_NOTICE_INVALID"||e instanceof SyntaxError?422:503;
  return res.status(status).json({error:status===503?"COMPANION_NOTICE_STORE_UNCONFIRMED":status===422&&code!=="COMPANION_RAW_NOT_SUPPORTED"?"COMPANION_NOTICE_INVALID":code});
 }
});
