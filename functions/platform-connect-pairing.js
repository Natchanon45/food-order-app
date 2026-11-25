"use strict";
// Central Android connection UAT. These capabilities authorize only a
// connection check and self-revocation. No notification payloads or money.
const {onCall,onRequest,HttpsError}=require("./managed-email-callable");
const {getFirestore}=require("firebase-admin/firestore");
const {randomBytes,randomUUID,createHash}=require("node:crypto");
const options={region:"asia-southeast1",timeoutSeconds:20};
const flags=Object.freeze({scope:"platform",mode:"pairing_only",notificationEnabled:false,paymentRoutingEnabled:false,paymentVerified:false});
const validId=/^[a-f0-9-]{36}$/;
const validKey=/^[a-f0-9]{64}$/;
const digest=s=>createHash("sha256").update(s).digest("hex");
const root=db=>db.collection("platformPrivateSettings").doc("connectPairingUatV1");
const err=(code,message)=>new HttpsError(code,message);
const snapshot=(tx,ref)=>tx?tx.get(ref):ref.get();
async function admin(db,request,tx){
 if(!request.auth?.uid)throw err("unauthenticated","Authentication required");
 const user=(await snapshot(tx,db.collection("users").doc(request.auth.uid))).data();
 if(user?.active!==true||user.role!=="super_admin"||(user.emailVerificationRequired===true&&request.auth.token?.email_verified!==true))throw err("permission-denied","Superadmin required");
}
function state(row,now){return row?.enabled===true&&Number.isSafeInteger(row.expiresMs)&&row.expiresMs>now;}
function view(row,now){return {id:row.id,label:row.label,enabled:state(row,now),connected:state(row,now)&&Number.isSafeInteger(row.connectedMs),expiresAt:new Date(row.expiresMs).toISOString(),keyDeleted:row.keyDeleted===true};}
function activeRows(rows,now){return (Array.isArray(rows)?rows:[]).filter(r=>state(r,now));}
exports.getPlatformConnectPairing=onCall(options,async request=>{
 const db=getFirestore();await admin(db,request);
 const meta=(await root(db).get()).data()||{},now=Date.now();
 return {ok:true,...flags,devices:activeRows(meta.devices,now).map(r=>view(r,now)),maxDevices:3};
});
exports.createPlatformConnectPairing=onCall(options,async request=>{
 const db=getFirestore(),label=typeof request.data?.label==="string"?request.data.label.trim():"";
 if(!/^[\p{L}\p{M}\p{N} ._-]{1,100}$/u.test(label))throw err("invalid-argument","Invalid device name");
 const token=randomBytes(32).toString("hex"),hash=digest(token),id=randomUUID(),now=Date.now(),expiresMs=now+24*60*60*1000,ref=root(db);
 await db.runTransaction(async tx=>{
  await admin(db,request,tx);
  const prior=(await tx.get(ref)).data()?.devices||[];
  const rows=activeRows(prior,now);
  if(rows.length>=3)throw err("resource-exhausted","Maximum three UAT devices");
  const row={id,label,enabled:true,expiresMs,issuedMs:now,keyHash:hash,connectedMs:null};
  for(const expired of prior.filter(r=>!state(r,now)))if(validKey.test(expired.keyHash||""))tx.delete(ref.collection("keys").doc(expired.keyHash));
  tx.create(ref.collection("keys").doc(hash),{deviceId:id,expiresMs});
  tx.set(ref,{devices:[...rows,row]},{merge:true});
 });
 return {ok:true,...flags,deviceId:id,pairingToken:token,showOnce:true,expiresAt:new Date(expiresMs).toISOString()};
});
exports.revokePlatformConnectPairing=onCall(options,async request=>{
 const db=getFirestore(),id=request.data?.deviceId,ref=root(db);
 if(typeof id!=="string"||!validId.test(id))throw err("invalid-argument","Invalid device");
 await db.runTransaction(async tx=>{
  await admin(db,request,tx);
  const rows=(await tx.get(ref)).data()?.devices||[],row=rows.find(r=>r.id===id);
  if(!row)throw err("not-found","Device not found");
  if(validKey.test(row.keyHash||""))tx.delete(ref.collection("keys").doc(row.keyHash));
  tx.set(ref,{devices:rows.filter(r=>r.id!==id)},{merge:true});
 });
 return {ok:true,...flags,revoked:true,keyDeleted:true,deviceId:id};
});
async function deviceOperation(req,res,revoke){
 res.set("Cache-Control","no-store");
 if(req.method!==(revoke?"POST":"GET"))return res.status(405).json({error:"METHOD_NOT_ALLOWED"});
 const token=String(req.get("authorization")||"").match(/^Bearer ([a-f0-9]{64})$/)?.[1];
 if(!token)return res.status(401).json({error:"NOT_PAIRED"});
 try{
  const db=getFirestore(),ref=root(db),hash=digest(token),keyRef=ref.collection("keys").doc(hash),now=Date.now();
  const result=await db.runTransaction(async tx=>{
   const [key,meta]=await Promise.all([tx.get(keyRef),tx.get(ref)]);
   const rows=meta.data()?.devices||[],row=rows.find(r=>r.id===key.data()?.deviceId);
   if(!key.exists||!state(row,now)||row.keyHash!==hash||key.data()?.expiresMs!==row.expiresMs)return null;
   if(revoke){tx.delete(keyRef);tx.set(ref,{devices:rows.filter(r=>r.id!==row.id)},{merge:true});return {revoked:true};}
   if(!row.connectedMs)tx.set(ref,{devices:rows.map(r=>r.id===row.id?{...r,connectedMs:now}:r)},{merge:true});
   return {connected:true,deviceId:row.id,expiresAt:new Date(row.expiresMs).toISOString()};
  });
  if(!result)return res.status(401).json({error:"NOT_PAIRED"});
  return res.status(200).json({ok:true,...flags,...result});
 }catch{return res.status(503).json({error:"CONNECTION_UNAVAILABLE"});}
}
exports.platformConnectDeviceStatus=onRequest(options,(req,res)=>deviceOperation(req,res,false));
exports.platformConnectDeviceUnpair=onRequest(options,(req,res)=>deviceOperation(req,res,true));
