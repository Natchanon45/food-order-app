"use strict";
// Central Android connection UAT. These capabilities authorize only a
// connection check and self-revocation. No notification payloads or money.
const {onCall,onRequest,HttpsError}=require("./managed-email-callable");
const {getFirestore}=require("firebase-admin/firestore");
const {randomBytes,randomUUID,createHash}=require("node:crypto");
const receiverPolicy=require("./platform-connect-receiver-policy");
const options={region:"asia-southeast1",timeoutSeconds:20};
const flags=Object.freeze({mode:"pairing_only",notificationEnabled:false,paymentRoutingEnabled:false,paymentVerified:false});
const validId=/^[a-f0-9-]{36}$/;
const validKey=/^[a-f0-9]{64}$/;
const digest=s=>createHash("sha256").update(s).digest("hex");
const root=db=>db.collection("platformPrivateSettings").doc("connectPairingUatV1");
const err=(code,message)=>new HttpsError(code,message);
const snapshot=(tx,ref)=>tx?tx.get(ref):ref.get();
// The caller chooses a scope, never a tenant ID. The active owner/admin
// profile determines the store. Pairing-only keys cannot authorize bank data.
const scopeFlags=scope=>({scope,...flags});
async function admin(db,request,tx){
 if(!request.auth?.uid)throw err("unauthenticated","Authentication required");
 const scope=request.data?.scope??"platform";
 if(!["platform","tenant"].includes(scope)||Object.hasOwn(request.data||{},"tenantId"))throw err("invalid-argument","Invalid scope");
 const user=(await snapshot(tx,db.collection("users").doc(request.auth.uid))).data();
 if(user?.active!==true||(user.emailVerificationRequired===true&&request.auth.token?.email_verified!==true))throw err("permission-denied","Active verified user required");
 if(scope==="platform"){
  if(user.role!=="super_admin")throw err("permission-denied","Superadmin required");
  return {scope,ref:root(db),tenantId:null};
 }
 if(!["owner","admin"].includes(user.role)||typeof user.tenantId!=="string"||!/^[a-zA-Z0-9_-]{1,128}$/.test(user.tenantId))throw err("permission-denied","Merchant administrator required");
 const tenant=(await snapshot(tx,db.collection("tenants").doc(user.tenantId))).data();
 if(tenant?.active!==true)throw err("permission-denied","Active tenant required");
 return {scope,ref:root(db).collection("tenantPairings").doc(user.tenantId),tenantId:user.tenantId};
}
function state(row,now){return row?.enabled===true&&Number.isSafeInteger(row.expiresMs)&&row.expiresMs>now;}
function view(row,now){return {id:row.id,label:row.label,enabled:state(row,now),connected:state(row,now)&&Number.isSafeInteger(row.connectedMs),expiresAt:new Date(row.expiresMs).toISOString(),keyDeleted:row.keyDeleted===true,lastTestAt:Number.isSafeInteger(row.lastTestMs)?new Date(row.lastTestMs).toISOString():null};}
function activeRows(rows,now){return (Array.isArray(rows)?rows:[]).filter(r=>state(r,now));}
function receiverRef(db,scope,tenantId){
 return scope==="platform"?db.collection("platformPrivateSettings").doc("receiptReceiver"):db.collection("tenants").doc(tenantId).collection("settings").doc("store");
}
async function receiverState(db,context,meta,tx){
 const current=receiverPolicy.receiver(await snapshot(tx,receiverRef(db,context.scope,context.tenantId)),context.scope);
 return {current,public:receiverPolicy.view(current,meta.receiverBinding)};
}

exports.getPlatformConnectPairing=onCall(options,async request=>{
 const db=getFirestore();const context=await admin(db,request),{scope,ref}=context;
 const meta=(await ref.get()).data()||{},now=Date.now();
 const receiver=await receiverState(db,context,meta);
 return {ok:true,...scopeFlags(scope),devices:activeRows(meta.devices,now).map(r=>view(r,now)),maxDevices:3,receiver:receiver.public};
});
exports.createPlatformConnectPairing=onCall(options,async request=>{
 const db=getFirestore(),label=typeof request.data?.label==="string"?request.data.label.trim():"";
 if(!/^[\p{L}\p{M}\p{N} ._-]{1,100}$/u.test(label))throw err("invalid-argument","Invalid device name");
 const token=randomBytes(32).toString("hex"),hash=digest(token),id=randomUUID(),now=Date.now(),expiresMs=now+24*60*60*1000;
 const scope=await db.runTransaction(async tx=>{
  const {scope,ref,tenantId}=await admin(db,request,tx);
  const prior=(await tx.get(ref)).data()?.devices||[];
  const rows=activeRows(prior,now);
  if(rows.length>=3)throw err("resource-exhausted","Maximum three UAT devices");
  const row={id,label,enabled:true,expiresMs,issuedMs:now,keyHash:hash,connectedMs:null};
  for(const expired of prior.filter(r=>!state(r,now)))if(validKey.test(expired.keyHash||""))tx.delete(root(db).collection("keys").doc(expired.keyHash));
  tx.create(root(db).collection("keys").doc(hash),{deviceId:id,expiresMs,scope,tenantId});
  tx.set(ref,{devices:[...rows,row]},{merge:true});
  return scope;
 });
 return {ok:true,...scopeFlags(scope),deviceId:id,pairingToken:token,showOnce:true,expiresAt:new Date(expiresMs).toISOString()};
});
exports.revokePlatformConnectPairing=onCall(options,async request=>{
 const db=getFirestore(),id=request.data?.deviceId;
 if(typeof id!=="string"||!validId.test(id))throw err("invalid-argument","Invalid device");
 const scope=await db.runTransaction(async tx=>{
  const {scope,ref}=await admin(db,request,tx);
  const rows=(await tx.get(ref)).data()?.devices||[],row=rows.find(r=>r.id===id);
  if(!row)throw err("not-found","Device not found");
  if(validKey.test(row.keyHash||""))tx.delete(root(db).collection("keys").doc(row.keyHash));
  tx.set(ref,{devices:rows.filter(r=>r.id!==id)},{merge:true});
  return scope;
 });
 return {ok:true,...scopeFlags(scope),revoked:true,keyDeleted:true,deviceId:id};
});
async function deviceOperation(req,res,revoke,test=false){
 res.set("Cache-Control","no-store");
 if(req.method!==((revoke||test)?"POST":"GET"))return res.status(405).json({error:"METHOD_NOT_ALLOWED"});
 // Test events contain no notification content or financial information.
 const testId=test?req.body?.testId:null;
 if(test&&(!req.body||Object.keys(req.body).length!==1||typeof testId!=="string"||!validId.test(testId)))
  return res.status(422).json({error:"INVALID_TEST_EVENT"});
 const token=String(req.get("authorization")||"").match(/^Bearer ([a-f0-9]{64})$/)?.[1];
 if(!token)return res.status(401).json({error:"NOT_PAIRED"});
 try{
  const db=getFirestore(),hash=digest(token),keyRef=root(db).collection("keys").doc(hash),now=Date.now();
  const result=await db.runTransaction(async tx=>{
   const key=await tx.get(keyRef),binding=key.data();
   if(!binding)return null;
   const scope=binding.scope??"platform";
   if(!["platform","tenant"].includes(scope))return null;
   let ref=root(db);
   if(scope==="tenant"){
    if(typeof binding.tenantId!=="string"||!/^[a-zA-Z0-9_-]{1,128}$/.test(binding.tenantId))return null;
    const tenant=await tx.get(db.collection("tenants").doc(binding.tenantId));
    if(tenant.data()?.active!==true&&!revoke)return null;
    ref=ref.collection("tenantPairings").doc(binding.tenantId);
   }
   const meta=await tx.get(ref);
   const rows=meta.data()?.devices||[],row=rows.find(r=>r.id===key.data()?.deviceId);
   if(!key.exists||!state(row,now)||row.keyHash!==hash||key.data()?.expiresMs!==row.expiresMs)return null;
   if(test){
    if(!row.connectedMs)return {notConnected:true};
    if(row.lastTestId===testId)return {testReceived:true,duplicate:true,scope,deviceId:row.id};
    if(Number(row.lastTestMs||0)>now-10000)return {rateLimited:true};
    tx.set(ref,{devices:rows.map(r=>r.id===row.id?{...r,lastTestId:testId,lastTestMs:now}:r)},{merge:true});
    return {testReceived:true,duplicate:false,scope,deviceId:row.id};
   }
   if(revoke){tx.delete(keyRef);tx.set(ref,{devices:rows.filter(r=>r.id!==row.id)},{merge:true});return {revoked:true,scope};}
   if(!row.connectedMs)tx.set(ref,{devices:rows.map(r=>r.id===row.id?{...r,connectedMs:now}:r)},{merge:true});
   return {connected:true,scope,deviceId:row.id,expiresAt:new Date(row.expiresMs).toISOString()};
  });
  if(!result)return res.status(401).json({error:"NOT_PAIRED"});
  if(result.notConnected)return res.status(409).json({error:"NOT_CONNECTED"});
  if(result.rateLimited)return res.status(429).json({error:"TEST_RATE_LIMIT"});
  return res.status(200).json({ok:true,...flags,...result});
 }catch{return res.status(503).json({error:"CONNECTION_UNAVAILABLE"});}
}
exports.platformConnectDeviceStatus=onRequest(options,(req,res)=>deviceOperation(req,res,false));
exports.platformConnectDeviceUnpair=onRequest(options,(req,res)=>deviceOperation(req,res,true));

exports.platformConnectDeviceTest=onRequest(options,(req,res)=>deviceOperation(req,res,false,true));

exports.confirmPlatformConnectReceiver=onCall(options,async request=>{
 const data=request.data||{};
 if(Object.keys(data).some(k=>!["scope","confirmed","version"].includes(k))||typeof data.confirmed!=="boolean"||
    (data.confirmed&&(typeof data.version!=="string"||!/^\d+\.\d+$/.test(data.version))))throw err("invalid-argument","Invalid receiver confirmation");
 const db=getFirestore();
 return db.runTransaction(async tx=>{
  const context=await admin(db,request,tx),{ref,scope}=context;
  const meta=(await tx.get(ref)).data()||{};
  const {current}=await receiverState(db,context,meta,tx);
  if(data.confirmed&&(!current.ready||data.version!==current.version))throw err("failed-precondition","Receiver changed; refresh and confirm again");
  const link=data.confirmed?{confirmed:true,revision:current.revision,confirmedMs:Date.now(),confirmedBy:request.auth.uid}:{confirmed:false};
  tx.set(ref,{receiverBinding:link},{mergeFields:["receiverBinding"]});
  return {ok:true,...scopeFlags(scope),receiver:receiverPolicy.view(current,link)};
 });
});
