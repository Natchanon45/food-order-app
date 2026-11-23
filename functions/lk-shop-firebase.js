"use strict";
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const P=require("./lk-shop-policy");
const REGION="asia-southeast1";
const opts={region:REGION,timeoutSeconds:35,memory:"256MiB"};
const denied=(code,msg)=>{throw new HttpsError(code,msg);};
const allowed=()=>process.env[P.PILOT_KEY]==="1";
function checkEnabled(pilot=allowed()){
 if(!pilot)denied("failed-precondition","LK_SHOP_PILOT_NOT_ENABLED");
}
function checkSelector(data,field){
 if(!data||typeof data!=="object"||Array.isArray(data)||
   Object.keys(data).some(k=>!["scope",...field].includes(k))||
   !["tenant","platform"].includes(data.scope))
  denied("invalid-argument","LK_SHOP_INVALID_REQUEST");
}
async function authorized(db,auth,scope){
 if(!auth?.uid||!P.ID.test(auth.uid))denied("unauthenticated","LK_SHOP_LOGIN_REQUIRED");
 const user=await db.collection("users").doc(auth.uid).get(),profile=user.data()||{};
 if(!user.exists||profile.active!==true)
  denied("permission-denied","LK_SHOP_ACTIVE_STAFF_REQUIRED");
 if(scope==="platform"){
  if(profile.role!=="super_admin")denied("permission-denied","LK_SHOP_PLATFORM_ROLE_DENIED");
  return {scope,tenantId:"global",uid:auth.uid};
 }
 if(!["owner","admin"].includes(profile.role)||!P.ID.test(profile.tenantId||""))
  denied("permission-denied","LK_SHOP_TENANT_OWNER_REQUIRED");
 const tenant=await db.collection("tenants").doc(profile.tenantId).get();
 if(tenant.data()?.active!==true)
  denied("permission-denied","LK_SHOP_TENANT_NOT_ACTIVE");
 return {scope,tenantId:profile.tenantId,uid:auth.uid};
}
async function authorizeInTransaction(tx,db,who){
 const user=await tx.get(db.collection("users").doc(who.uid)),profile=user.data()||{};
 if(!user.exists||profile.active!==true||
  (who.scope==="platform"&&profile.role!=="super_admin")||
  (who.scope==="tenant"&&(!["owner","admin"].includes(profile.role)||
     profile.tenantId!==who.tenantId)))
  denied("permission-denied","LK_SHOP_SESSION_CHANGED");
 if(who.scope==="tenant"){
  const tenant=await tx.get(db.collection("tenants").doc(who.tenantId));
  if(tenant.data()?.active!==true)
   denied("permission-denied","LK_SHOP_TENANT_NOT_ACTIVE");
 }
}
function deviceRoot(db){return db.collection("lkShopDevices");}
async function listDevices({db,auth,data,pilot}){
 checkEnabled(pilot);checkSelector(data,[]);
 const who=await authorized(db,auth,data.scope);
 const list=await deviceRoot(db).where("scopeKey","==",P.scopeKey(who.scope,who.tenantId))
  .limit(70).get();
 const items=list.docs.filter(s=>s.data().enabled===true)
  .map(s=>P.visibleDevice(s.data(),s.id))
  .filter(s=>P.purposeValid(who.scope,s.role)).slice(0,70);
 return {ok:true,scope:who.scope,devices:items,pushServerConfigured:false,
  appBuildVerified:false,mobileGoApiCompatible:false};
}
async function issuePair({db,auth,data,pilot,now=Date.now()}){
 checkEnabled(pilot);checkSelector(data,["purpose"]);
 if(!P.purposeValid(data.scope,data.purpose))
  denied("invalid-argument","LK_SHOP_ROOM_INVALID");
 const who=await authorized(db,auth,data.scope);
 const code=P.secret(),codeHash=P.hash(code),challengeRef=
  db.collection("lkShopPairChallenges").doc(codeHash),activeRef=
  db.collection("lkShopActivePairings")
   .doc(P.activeKey(who.scope,who.tenantId,data.purpose,who.uid));
 // Challenges are minted exclusively by a rechecked authorized issuer.
 await db.runTransaction(async tx=>{
  await authorizeInTransaction(tx,db,who);
  tx.create(challengeRef,{
   codeHash,scope:who.scope,tenantId:who.tenantId,
   scopeKey:P.scopeKey(who.scope,who.tenantId),
   purpose:data.purpose,issuerUid:who.uid,
   activeKey:activeRef.id,createdAtMs:now,expiresAtMs:now+P.TTL,
   consumedAtMs:null,claimedBy:null,
   createdAt:FieldValue.serverTimestamp(),
  });
  tx.set(activeRef,{codeHash,createdAtMs:now,expiresAtMs:now+P.TTL});
 });
 return {ok:true,purpose:data.purpose,scope:who.scope,expiresInSeconds:300,
  qrPayload:P.qrPayload(code),pairingId:codeHash.slice(0,16),
  appBuildVerified:false,mobileGoApiCompatible:false};
}
async function revoke({db,auth,data,pilot}){
 checkEnabled(pilot);checkSelector(data,["deviceId"]);
 if(!P.ID.test(data.deviceId||""))
  denied("invalid-argument","LK_SHOP_DEVICE_INVALID");
 const who=await authorized(db,auth,data.scope);
 const deviceRef=deviceRoot(db).doc(data.deviceId);
 const result=await db.runTransaction(async tx=>{
  await authorizeInTransaction(tx,db,who);
  const snap=await tx.get(deviceRef),dev=snap.data();
  if(!dev||dev.scopeKey!==P.scopeKey(who.scope,who.tenantId)||
    !P.purposeValid(who.scope,dev.purpose))
   denied("not-found","LK_SHOP_DEVICE_NOT_FOUND");
  if(dev.enabled!==true)return {revoked:true,alreadyRevoked:true};
  const key=dev.credentialHash?db.collection("lkShopDeviceKeys").doc(dev.credentialHash):null;
  const claim=dev.fcmToken?db.collection("lkShopFcmTokenClaims").doc(P.hash(dev.fcmToken)):null;
  const roomRef=db.collection("lkShopRoomCounters").doc(dev.roomKey);
  const [snapClaim,roomCounter]=await Promise.all([
    claim?tx.get(claim):Promise.resolve(null),tx.get(roomRef)]);
  const count=roomCounter.data()?.activeCount;
  if(!Number.isSafeInteger(count)||count<1)
   denied("failed-precondition","LK_SHOP_ROOM_COUNTER_INVALID");
  tx.update(deviceRef,{enabled:false,credentialHash:null,fcmToken:"",
   revokedAt:FieldValue.serverTimestamp(),revokedBy:who.uid});
  if(key)tx.delete(key);
  if(snapClaim?.data()?.deviceId===snap.id)tx.delete(claim);
  tx.update(roomRef,{activeCount:count-1});
  return {revoked:true,alreadyRevoked:false};
 });
 return {ok:true,...result};
}
exports.getLKShopPairingDevices=onCall(opts,request=>listDevices({
 db:getFirestore(),auth:request.auth,data:request.data}));
exports.issueLKShopPairingChallenge=onCall(opts,request=>issuePair({
 db:getFirestore(),auth:request.auth,data:request.data}));
exports.revokeLKShopPairingDevice=onCall(opts,request=>revoke({
 db:getFirestore(),auth:request.auth,data:request.data}));
exports._privateForTests={authorized,listDevices,issuePair,revoke,checkSelector,authorizeInTransaction};
