"use strict";
// First-party LK Shop Firebase REST adapter. Unlike Source Go this endpoint is
// served by Firebase Hosting and the QR's Firebase server origin.
// No browser-supplied tenant, role or destination ever grants access.
const {onRequest}=require("firebase-functions/v2/https");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const P=require("./lk-shop-policy");
const fail=(status,error)=>({status,error});
const json=(res,status,payload)=>res.status(status).json(payload);
const enabled=()=>process.env[P.PILOT_KEY]==="1";
const nowIso=()=>new Date().toISOString();
const root=db=>db.collection("lkShopDevices");
async function enroll({db,input,now=Date.now(),pilot=enabled()}){
 if(!pilot)throw fail(503,"LK_SHOP_PILOT_DISABLED");
 if(!P.validEnrollment(input))throw fail(422,"LK_SHOP_PAIRING_INVALID");
 const challengeRef=db.collection("lkShopPairChallenges").doc(P.hash(input.code));
 const credential=P.secret(),keyHash=P.hash(credential),id=P.randomUUID();
 const devRef=root(db).doc(id);
 const keyRef=db.collection("lkShopDeviceKeys").doc(keyHash);
 const fcmClaim=input.fcmToken?
  db.collection("lkShopFcmTokenClaims").doc(P.hash(input.fcmToken)):null;
 const paired=await db.runTransaction(async tx=>{
  const challengeSnap=await tx.get(challengeRef),c=challengeSnap.data();
  if(!c||!P.purposeValid(c.scope,c.purpose)||
    c.expiresAtMs<=now||c.createdAtMs>now+30000||
    c.consumedAtMs!==null||c.claimedBy!==null)
   throw fail(410,"LK_SHOP_QR_EXPIRED_OR_USED");
  const active=await tx.get(db.collection("lkShopActivePairings").doc(c.activeKey));
  if(active.data()?.codeHash!==challengeRef.id)
   throw fail(410,"LK_SHOP_QR_REPLACED");
  const issuer=await tx.get(db.collection("users").doc(c.issuerUid)),i=issuer.data();
  if(!issuer.exists||i?.active!==true||
    (c.scope==="platform"&&i.role!=="super_admin")||
    (c.scope==="tenant"&&(!["owner","admin"].includes(i.role)||i.tenantId!==c.tenantId)))
   throw fail(403,"LK_SHOP_ISSUER_REVOKED");
  if(c.scope==="tenant"){
   const tenant=await tx.get(db.collection("tenants").doc(c.tenantId));
   if(tenant.data()?.active!==true)throw fail(403,"LK_SHOP_TENANT_INACTIVE");
  }
  const roomId=P.roomKey(c.scope,c.tenantId,c.purpose);
  const roomRef=db.collection("lkShopRoomCounters").doc(roomId);
  const [roomSnap,claimSnap]=await Promise.all([
    tx.get(roomRef),fcmClaim?tx.get(fcmClaim):Promise.resolve(null)]);
  const used=roomSnap.data()?.activeCount||0;
  if(!Number.isSafeInteger(used)||used<0||used>=P.MAX_ROOM_DEVICES)
   throw fail(409,"LK_SHOP_DEVICE_LIMIT");
  if(claimSnap?.exists)throw fail(409,"LK_SHOP_FCM_TOKEN_IN_USE");
  const doc={scope:c.scope,tenantId:c.tenantId,scopeKey:c.scopeKey,
   roomKey:roomId,purpose:c.purpose,issuerUid:c.issuerUid,
   name:input.name.trim(),platform:input.platform,
   credentialHash:keyHash,fcmToken:input.fcmToken,enabled:true,
   pairedAtMs:now,pairedAt:FieldValue.serverTimestamp(),lastSeen:null};
  tx.create(devRef,doc);
  tx.create(keyRef,{deviceId:id,createdAtMs:now});
  if(fcmClaim)tx.create(fcmClaim,{deviceId:id});
  tx.set(roomRef,{activeCount:used+1,scope:c.scope,tenantId:c.tenantId,
   purpose:c.purpose,updatedAtMs:now});
  tx.update(challengeRef,{consumedAtMs:now,claimedBy:id});
  return doc;
 });
 return {deviceId:id,credential,role:paired.purpose,
  scope:paired.scope,pushReady:!!input.fcmToken,
  deviceName:paired.name};
}
async function deviceWithCredential({db,credential}){
 if(!P.HEX.test(credential||""))throw fail(401,"LK_SHOP_UNPAIRED");
 const digest=P.hash(credential);
 const key=await db.collection("lkShopDeviceKeys").doc(digest).get();
 const id=key.data()?.deviceId;
 if(!P.ID.test(id||""))throw fail(401,"LK_SHOP_UNPAIRED");
 const ref=root(db).doc(id),doc=await ref.get(),v=doc.data();
 if(!doc.exists||v?.enabled!==true||v.credentialHash!==digest||
   !P.purposeValid(v.scope,v.purpose)||
   v.scopeKey!==P.scopeKey(v.scope,v.tenantId))
  throw fail(401,"LK_SHOP_UNPAIRED");
 if(v.scope==="tenant"){
  const tenant=await db.collection("tenants").doc(v.tenantId).get();
  if(tenant.data()?.active!==true)throw fail(401,"LK_SHOP_TENANT_INACTIVE");
 }
 return {id,ref,dev:v};
}
async function updateToken({db,credential,input,now=Date.now(),pilot=enabled()}){
 if(!pilot)throw fail(503,"LK_SHOP_PILOT_DISABLED");
 if(!input||typeof input!=="object"||Array.isArray(input)||
    Object.keys(input).join(",")!=="fcmToken"||!P.validFCM(input.fcmToken))
  throw fail(422,"FCM_TOKEN_INVALID");
 const auth=await deviceWithCredential({db,credential});
 const ref=auth.ref;
 const newToken=input.fcmToken;
 const result=await db.runTransaction(async tx=>{
  const device=await tx.get(ref),v=device.data();
  if(v?.enabled!==true||v.credentialHash!==P.hash(credential))
   throw fail(401,"LK_SHOP_UNPAIRED");
  const oldToken=v.fcmToken||"";
  const oldClaim=oldToken?db.collection("lkShopFcmTokenClaims").doc(P.hash(oldToken)):null;
  const newClaim=newToken?db.collection("lkShopFcmTokenClaims").doc(P.hash(newToken)):null;
  const oldSnap=oldClaim?await tx.get(oldClaim):null;
  const newSnap=newClaim?await tx.get(newClaim):null;
  if(newSnap?.exists&&newSnap.data()?.deviceId!==auth.id)
   throw fail(409,"LK_SHOP_FCM_TOKEN_IN_USE");
  if(oldClaim&&oldSnap?.data()?.deviceId===auth.id&&oldToken!==newToken)
   tx.delete(oldClaim);
  if(newClaim&&!newSnap?.exists)tx.create(newClaim,{deviceId:auth.id});
  tx.update(ref,{fcmToken:newToken,lastSeen:nowIso(),lastSeenAtMs:now});
  return {pushReady:!!newToken};
 });
 return result;
}
async function unpair({db,credential,now=Date.now(),pilot=enabled()}){
 if(!pilot)throw fail(503,"LK_SHOP_PILOT_DISABLED");
 const {id,ref}=await deviceWithCredential({db,credential});
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref),v=snap.data();
  if(!v||v.enabled!==true||v.credentialHash!==P.hash(credential))
   throw fail(401,"LK_SHOP_UNPAIRED");
  const roomRef=db.collection("lkShopRoomCounters").doc(v.roomKey);
  const keyRef=db.collection("lkShopDeviceKeys").doc(P.hash(credential));
  const fcmRef=v.fcmToken?db.collection("lkShopFcmTokenClaims").doc(P.hash(v.fcmToken)):null;
  const [counter,claim]=await Promise.all([
    tx.get(roomRef),fcmRef?tx.get(fcmRef):Promise.resolve(null)]);
  tx.update(ref,{enabled:false,credentialHash:null,fcmToken:"",
   revokedAtMs:now,revokedAt:FieldValue.serverTimestamp()});
  tx.delete(keyRef);
  if(claim?.data()?.deviceId===id)tx.delete(fcmRef);
  const count=counter.data()?.activeCount;
  if(!Number.isSafeInteger(count)||count<1)throw fail(503,"LK_SHOP_ROOM_COUNTER_INVALID");
  tx.update(roomRef,{activeCount:count-1});
 });
 return {revoked:true};
}
async function status({db,credential,pilot=enabled()}){
 if(!pilot)throw fail(503,"LK_SHOP_PILOT_DISABLED");
 const auth=await deviceWithCredential({db,credential});
 return {connected:true,device:{
  ...P.visibleDevice(auth.dev,auth.id),
  scopeId:auth.dev.scope==="platform"?"global":auth.dev.tenantId,
 },pushServerConfigured:process.env[P.PUSH_KEY]==="1"};
}
async function inbox({db,credential,pilot=enabled()}){
 if(!pilot)throw fail(503,"LK_SHOP_PILOT_DISABLED");
 const auth=await deviceWithCredential({db,credential});
 const items=await auth.ref.collection("notices")
  .orderBy("createdAtMs","desc").limit(60).get();
 // All messages were generated server-side; never expose device token,
 // bank/slip payloads or client-provided URLs.
 return {role:auth.dev.purpose,notifications:items.docs.map(doc=>{
  const n=doc.data();
  return {id:P.numericEventId(doc.id),
   body:typeof n.body==="string"?n.body.slice(0,1700):"",
   target:P.safeTarget(auth.dev.scope,auth.dev.purpose),
   createdUTC:new Date(n.createdAtMs).toISOString()};
 })};
}
async function gateway({db,method,path,body,authorization,pilot}){
 const credential=typeof authorization==="string"&&
  authorization.startsWith("Bearer ")?authorization.slice(7):"";
 if(method==="POST"&&path==="/api/lk-shop/enroll")
  return {status:201,payload:await enroll({db,input:body,pilot})};
 if(method==="GET"&&path==="/api/lk-shop/device")
  return {status:200,payload:await status({db,credential,pilot})};
 if(method==="GET"&&path==="/api/lk-shop/inbox")
  return {status:200,payload:await inbox({db,credential,pilot})};
 if(method==="PUT"&&path==="/api/lk-shop/device/push-token")
  return {status:200,payload:await updateToken({db,credential,input:body,pilot})};
 if(method==="POST"&&path==="/api/lk-shop/device/unpair")
  return {status:200,payload:await unpair({db,credential,pilot})};
 throw fail(404,"LK_SHOP_UNKNOWN_ENDPOINT");
}
exports.lkShopDeviceGateway=onRequest({region:"asia-southeast1",
 timeoutSeconds:35,memory:"256MiB",cors:false},async(req,res)=>{
 res.set("Cache-Control","no-store");
 res.set("X-Content-Type-Options","nosniff");
 if(!req.secure&&req.get("x-forwarded-proto")!=="https"&&
    !process.env.FIRESTORE_EMULATOR_HOST)
  return json(res,403,{error:"LK_SHOP_HTTPS_REQUIRED"});
 if(req.get("origin"))return json(res,403,{error:"LK_SHOP_BROWSER_ORIGIN_DENIED"});
 if(Number(req.get("content-length")||0)>6000)
  return json(res,413,{error:"LK_SHOP_PAYLOAD_TOO_LARGE"});
 const path=(req.path||"").replace(/\/$/,"");
 if(!["GET","POST","PUT"].includes(req.method))
  return json(res,405,{error:"LK_SHOP_METHOD_NOT_ALLOWED"});
 try{
  const outcome=await gateway({db:getFirestore(),method:req.method,path,
   body:req.body||{},authorization:req.get("authorization"),pilot:enabled()});
  return json(res,outcome.status,outcome.payload);
 }catch(err){
  return json(res,Number.isSafeInteger(err.status)?err.status:503,
    {error:typeof err.error==="string"?err.error:"LK_SHOP_UNAVAILABLE"});
 }
});
exports._privateForTests={enroll,deviceWithCredential,updateToken,unpair,status,inbox,gateway};
