import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
import {initializeApp as initializeClient,deleteApp} from "firebase/app";
import {getFirestore as getClientFirestore,connectFirestoreEmulator,
 doc as clientDoc,getDoc as clientGet,setDoc as clientSet} from "firebase/firestore";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const fromTest=createRequire(import.meta.url);
const pairing=fromTest("../../functions/lk-shop-firebase.js")._privateForTests;
const gateway=fromTest("../../functions/lk-shop-device-gateway.js")._privateForTests;
const notify=fromTest("../../functions/lk-shop-notifications.js")._privateForTests;
const P=fromTest("../../functions/lk-shop-policy.js");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
  !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("LK_SHOP_REQUIRES_LOCAL_DEMO_FIRESTORE_EMULATOR");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore();
const tenantId="lk-pair-tenant-"+randomUUID().replace(/-/g,"").slice(0,12);
const otherTenant="lk-other-tenant-"+randomUUID().replace(/-/g,"").slice(0,12);
const owner="owner-"+randomUUID(),admin="admin-"+randomUUID(),
 cashier="cashier-"+randomUUID(),inactive="inactive-"+randomUUID(),
 platform="platform-"+randomUUID(),foreign="foreign-"+randomUUID();
const auth=uid=>({uid});
const list=(uid,scope="tenant")=>pairing.listDevices({db,auth:auth(uid),data:{scope},pilot:true});
const issue=(uid,scope,purpose,now=Date.now())=>pairing.issuePair({
 db,auth:auth(uid),data:{scope,purpose},pilot:true,now});
const unpair=(credential)=>gateway.unpair({db,credential,pilot:true});
const enroll=(qr,options={})=>gateway.enroll({db,input:{
 code:new URL(qr.qrPayload).searchParams.get("code"),
 name:options.name||"Kitchen iPhone",platform:options.platform||"ios",
 fcmToken:options.fcmToken??"",
 },pilot:true,now:options.now??Date.now()});
const errorCode=(expected)=>err=>String(err.code||"")===expected||
 String(err.status||"")===String(expected);
test("setup two independent tenants, owner/admin and platform; disabled pilot never leaks QR",async()=>{
 await Promise.all([
  db.collection("tenants").doc(tenantId).set({active:true,name:"LK Shop Tenant A"}),
  db.collection("tenants").doc(otherTenant).set({active:true,name:"LK Shop Tenant B"}),
  db.collection("users").doc(owner).set({active:true,role:"owner",tenantId}),
  db.collection("users").doc(admin).set({active:true,role:"admin",tenantId}),
  db.collection("users").doc(cashier).set({active:true,role:"cashier",tenantId}),
  db.collection("users").doc(inactive).set({active:false,role:"admin",tenantId}),
  db.collection("users").doc(platform).set({active:true,role:"super_admin"}),
  db.collection("users").doc(foreign).set({active:true,role:"owner",tenantId:otherTenant}),
 ]);
 await assert.rejects(pairing.issuePair({db,auth:auth(owner),
  data:{scope:"tenant",purpose:"cashier_delivery"},pilot:false}),{
   code:"failed-precondition"});
 await assert.rejects(gateway.enroll({db,input:{},pilot:false}),
  err=>err.status===503);
});
test("issuer role/tenant gate: only owner/admin can issue their own scoped room; platform requires Superadmin",async()=>{
 for(const uid of [cashier,inactive,platform]){
  await assert.rejects(issue(uid,"tenant","cashier_delivery"),
   err=>err.code==="permission-denied",uid);
 }
 await assert.rejects(issue(owner,"tenant","superadmin_slip_manual"),
  err=>err.code==="invalid-argument");
 await assert.rejects(issue(platform,"platform","cashier_delivery"),
  err=>err.code==="invalid-argument");
 await assert.rejects(issue(owner,"platform","superadmin_slip_manual"),
  err=>err.code==="permission-denied");
 const otherQr=await issue(foreign,"tenant","kitchen_delivery");
 const otherPaired=await enroll(otherQr,{name:"Other shop kitchen"});
 assert.equal((await db.collection("lkShopDevices").doc(otherPaired.deviceId).get()).data().tenantId,otherTenant);
 assert.equal((await list(owner)).devices.some(x=>x.id===otherPaired.deviceId),false);
 const platformQr=await issue(platform,"platform","superadmin_slip_manual");
 const created=await enroll(platformQr,{name:"Superadmin Phone"});
 assert.equal(created.scope,"platform");
 assert.equal(created.role,"superadmin_slip_manual");
 assert.equal(created.pushReady,false);
 const platformList=await list(platform,"platform");
 assert.deepEqual(platformList.devices.map(x=>x.role),["superadmin_slip_manual"]);
 await assert.rejects(list(owner,"platform"),err=>err.code==="permission-denied");
 await assert.rejects(pairing.revoke({db,auth:auth(owner),data:{
  scope:"tenant",deviceId:created.deviceId},pilot:true}),
  err=>err.code==="not-found");
 const revoke=await pairing.revoke({db,auth:auth(platform),data:{
  scope:"platform",deviceId:created.deviceId},pilot:true});
 assert.equal(revoke.revoked,true);
 assert.equal((await list(platform,"platform")).devices.length,0);
});
test("one-time 5-minute pairing: token hash only, QR reuse rejected, replacement/expiry/issuer-revocation rejected",async()=>{
 const at=Date.now();
 const qr=await issue(owner,"tenant","cashier_delivery",at);
 const code=new URL(qr.qrPayload).searchParams.get("code");
 const challenge=(await db.collection("lkShopPairChallenges").doc(P.hash(code)).get()).data();
 assert.equal(challenge.codeHash,P.hash(code));
 assert.equal(challenge.expiresAtMs-at,300000);
 assert.equal(JSON.stringify(challenge).includes(code),false);
 const user=await enroll(qr,{name:"Shop Cashier",now:at+1000});
 assert.match(user.credential,P.HEX);
 assert.equal(user.role,"cashier_delivery");
 assert.equal(user.scope,"tenant");
 const key=(await db.collection("lkShopDeviceKeys").doc(P.hash(user.credential)).get()).data();
 assert.equal(key.deviceId,user.deviceId);
 const data=(await db.collection("lkShopDevices").doc(user.deviceId).get()).data();
 assert.equal(data.credentialHash,P.hash(user.credential));
 assert.equal(JSON.stringify(data).includes(user.credential),false);
 await assert.rejects(enroll(qr,{now:at+2000}),err=>err.status===410);
 const old=await issue(owner,"tenant","kitchen_delivery",at+10000);
 const newest=await issue(owner,"tenant","kitchen_delivery",at+20000);
 await assert.rejects(enroll(old,{now:at+21000}),err=>err.status===410);
 await assert.rejects(enroll(newest,{now:at+321000}),err=>err.status===410);
 const issuerRevoke=await issue(admin,"tenant","admin_store",at+25000);
 await db.collection("users").doc(admin).update({active:false});
 await assert.rejects(enroll(issuerRevoke,{now:at+30000}),err=>err.status===403);
 await db.collection("users").doc(admin).update({active:true});
 await unpair(user.credential);
 await assert.rejects(gateway.status({db,credential:user.credential,pilot:true}),
  err=>err.status===401);
});
test("concurrent redemption, room cap and revoked slot recovery",async()=>{
 const qr=await issue(owner,"tenant","kitchen_delivery");
 const successes=await Promise.allSettled(
   Array.from({length:8},(_,index)=>enroll(qr,{name:"Concurrent "+index})));
 assert.equal(successes.filter(x=>x.status==="fulfilled").length,1);
 const initial=successes.find(x=>x.status==="fulfilled").value;
 const users=[initial];
 for(let i=1;i<10;i++){
  const code=await issue(owner,"tenant","kitchen_delivery");
  users.push(await enroll(code,{name:"Kitchen "+i}));
 }
 const result=await list(admin);
 assert.equal(result.devices.filter(x=>x.role==="kitchen_delivery").length,10);
 await assert.rejects(enroll(await issue(owner,"tenant","kitchen_delivery")),
  err=>err.status===409);
 const first=users[0];
 const revoke=await pairing.revoke({db,auth:auth(admin),data:{
  scope:"tenant",deviceId:first.deviceId},pilot:true});
 assert.equal(revoke.revoked,true);
 const repeat=await pairing.revoke({db,auth:auth(admin),data:{
  scope:"tenant",deviceId:first.deviceId},pilot:true});
 assert.equal(repeat.alreadyRevoked,true);
 await assert.rejects(gateway.status({db,credential:first.credential,pilot:true}),
  err=>err.status===401);
 const nextQr=await issue(owner,"tenant","kitchen_delivery");
 const replacement=await enroll(nextQr,{name:"Replaced slot"});
 assert.equal(replacement.role,"kitchen_delivery");
 const slots=(await db.collection("lkShopRoomCounters").doc(
  P.roomKey("tenant",tenantId,"kitchen_delivery")).get()).data();
 assert.equal(slots.activeCount,10);
 const roomList=await list(owner);
 assert.equal(roomList.devices.filter(x=>x.role==="kitchen_delivery").length,10);
 assert.equal(JSON.stringify(roomList).includes(first.credential),false);
});
test("bearer device status, FCM claims/global uniqueness, inbox role, notification dedupe and revocation",async()=>{
 const qr=await issue(owner,"tenant","admin_store");
 const fcm="fcm-ABC123456789012345678901234567890:abc";
 const one=await enroll(qr,{name:"Admin Android",platform:"android",fcmToken:fcm});
 const status=await gateway.status({db,credential:one.credential,pilot:true});
 assert.equal(status.device.role,"admin_store");
 assert.equal(status.device.pushReady,true);
 assert.equal(status.pushServerConfigured,false);
 assert.equal(JSON.stringify(status).includes(fcm),false);
 await assert.rejects(enroll(await issue(owner,"tenant","admin_store"),
  {fcmToken:fcm}),err=>err.status===409);
 const second=await enroll(await issue(owner,"tenant","admin_store"),{name:"Admin spare"});
 await assert.rejects(gateway.updateToken({db,credential:second.credential,
  input:{fcmToken:fcm},pilot:true}),err=>err.status===409);
 const replacement="replace-ABC12345678901234567890:xyz";
 const changed=await gateway.updateToken({db,credential:one.credential,
  input:{fcmToken:replacement},pilot:true});
 assert.equal(changed.pushReady,true);
 const notification={kind:"pending_slip",tenantId,orderId:"order-ABC123456789",
  purposes:["admin_store","cashier_delivery"]};
 const queued=await notify.enqueue(db,notification,{pilot:true});
 assert.ok(queued.queued>=1);
 const repeat=await notify.enqueue(db,notification,{pilot:true});
 assert.equal(repeat.queued,0);
 const inbox=await gateway.inbox({db,credential:one.credential,pilot:true});
 assert.equal(inbox.role,"admin_store");
 assert.ok(inbox.notifications.some(m=>m.body.includes("สลิป")));
 assert.equal(inbox.notifications[0].target,P.SITE+"/admin");
 assert.equal(Number.isSafeInteger(inbox.notifications[0].id),true);
 assert.ok(inbox.notifications[0].id>0);
 // A new SHA-256 event key is unrelated to chronological ordering.
 // The server must allocate increasing per-device sequence in one tx,
 // so the Flutter persisted notification cursor never skips new events.
 const secondEvent={kind:"paid",tenantId,orderId:"order-second-"+randomUUID(),
  purposes:["admin_store"]};
 const secondQueue=await notify.enqueue(db,secondEvent,{pilot:true});
 assert.ok(secondQueue.queued>=1);
 const ordered=await gateway.inbox({db,credential:one.credential,pilot:true});
 assert.equal(ordered.notifications.length,2);
 assert.equal(ordered.notifications[0].id,inbox.notifications[0].id+1);
 assert.equal(ordered.notifications[1].id,inbox.notifications[0].id);
 assert.ok(ordered.notifications[0].body.includes("ชำระแล้ว"));

 assert.ok(!JSON.stringify(inbox).includes(replacement));
 assert.ok(!JSON.stringify(inbox).includes(one.credential));
 await assert.rejects(gateway.inbox({db,credential:"x",pilot:true}),
  err=>err.status===401);
 const own=await gateway.unpair({db,credential:one.credential,pilot:true});
 assert.equal(own.revoked,true);
 await assert.rejects(gateway.inbox({db,credential:one.credential,pilot:true}),
  err=>err.status===401);
 const freed=await gateway.updateToken({db,credential:second.credential,
  input:{fcmToken:replacement},pilot:true});
 assert.equal(freed.pushReady,true);
});
test("inbox routes and FCM dispatch are generic, opt-in and recheck revoked device",async()=>{
 const qr=await issue(platform,"platform","superadmin_slip_manual");
 const {credential,deviceId}=await enroll(qr,{name:"Platform Alerts",fcmToken:"mockFCM:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456"});
 const credentialAccess=await gateway.deviceWithCredential({db,credential});
 const eventId=P.hash("notice:platform:1");
 await credentialAccess.ref.collection("notices").doc(eventId).create({
  body:"แพลตฟอร์มมีรายการต้องตรวจ",purpose:"superadmin_slip_manual",
  tenantId:"global",createdAtMs:Date.now(),sequence:1});
 const platformInbox=await gateway.inbox({db,credential,pilot:true});
 assert.equal(platformInbox.notifications[0].target,P.SITE+"/admin/tenants");
 let messages=[];
 const mock={send:async message=>{messages.push(message);return "mock";}};
 const off=await notify.sendPush(db,deviceId,eventId,{pilot:true,push:false,messaging:mock});
 assert.equal(off.sent,false);
 const push=await notify.sendPush(db,deviceId,eventId,{pilot:true,push:true,messaging:mock});
 assert.equal(push.sent,true);
 assert.equal(messages.length,1);
 assert.equal(messages[0].notification.title,"PG Notify");
 assert.equal(messages[0].data.eventId,"1");
 assert.equal(JSON.stringify(messages).includes("แพลตฟอร์มมีรายการ"),false);
 await pairing.revoke({db,auth:auth(platform),data:{scope:"platform",deviceId},pilot:true});
 assert.equal((await notify.sendPush(db,deviceId,eventId,{pilot:true,push:true,messaging:mock})).sent,false);
 assert.equal(messages.length,1);
});
test("Platform financial notices route only to global Superadmin room, remain idempotent and generic",async()=>{
 const qr=await issue(platform,"platform","superadmin_slip_manual");
 const platformDev=await enroll(qr,{name:"Superadmin platform finance"});
 const event={id:P.hash("platform-revenue-"+randomUUID()),
  tenantId,channel:"delivery_share",receiptId:"payment-"+randomUUID(),
  outcome:"manual_review",amountSatang:123456};
 const first=await notify.enqueuePlatform(db,event,{pilot:true});
 assert.ok(first.queued>=1);
 const again=await notify.enqueuePlatform(db,event,{pilot:true});
 assert.equal(again.queued,0);
 const platformInbox=await gateway.inbox({
  db,credential:platformDev.credential,pilot:true});
 assert.equal(platformInbox.role,"superadmin_slip_manual");
 assert.equal(platformInbox.notifications.length,1);
 assert.match(platformInbox.notifications[0].body,/Superadmin/);
 assert.equal(platformInbox.notifications[0].target,P.SITE+"/admin/tenants");
 assert.ok(!JSON.stringify(platformInbox).includes(event.receiptId));
 assert.ok(!JSON.stringify(platformInbox).includes("123456"));
 const kitchenDevices=await db.collection("lkShopDevices")
  .where("roomKey","==",P.roomKey("tenant",tenantId,"kitchen_delivery"))
  .limit(12).get();
 for(const doc of kitchenDevices.docs){
  const notices=await doc.ref.collection("notices").get();
  assert.equal(notices.size,0,"platform finance leaked to tenant kitchen");
 }
 await assert.rejects(gateway.gateway({db,method:"POST",
  path:"/api/lk-shop/enroll",body:{role:"admin_store"},pilot:false}),
  err=>err.status===503);
 assert.deepEqual(await notify.enqueuePlatform(db,event,{pilot:false}),
  {queued:0,skipped:"INVALID_OR_DISABLED"});
});
test("authorized test push queues a generic notice only for selected paired device",async()=>{
 const qr=await issue(owner,"tenant","admin_store");
 const device=await enroll(qr,{name:"Test push Android",platform:"android",fcmToken:"mockFCM:PGNOTIFYABCDEFGHIJKLMNOPQRST"});
 const data={scope:"tenant",deviceId:device.deviceId};
 await assert.rejects(pairing.queueTestPush({db,auth:auth(foreign),data,pilot:true,push:true}),{code:"not-found"});
 await assert.rejects(pairing.queueTestPush({db,auth:auth(cashier),data,pilot:true,push:true}),{code:"permission-denied"});
 await assert.rejects(pairing.queueTestPush({db,auth:auth(owner),data,pilot:true,push:false}),{code:"failed-precondition"});
 const result=await pairing.queueTestPush({db,auth:auth(owner),data,pilot:true,push:true});
 assert.equal(result.queued,true);assert.equal(result.deliveryConfirmed,false);
 await assert.rejects(pairing.queueTestPush({db,auth:auth(owner),data,pilot:true,push:true}),{code:"resource-exhausted"});
 const inbox=await gateway.inbox({db,credential:device.credential,pilot:true});
 assert.match(inbox.notifications[0].body,/ข้อความทดสอบ PG Notify/);
 await unpair(device.credential);
});
test("Firestore browser rules disallow reading or writing all LK Shop secret/account collections",async()=>{
 const app=initializeClient({apiKey:"demo-not-secret",
  appId:"1:123:web:"+randomUUID(),projectId:"demo-penguin-hybrid"},
 "lk-shop-rule-"+randomUUID());
 try{
  const browser=getClientFirestore(app);
  const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(browser,host,Number(port));
  const paths=[
   "lkShopPairChallenges/"+P.hash("challenge"),
   "lkShopActivePairings/"+P.hash("active"),
   "lkShopDevices/"+randomUUID(),
   "lkShopDeviceKeys/"+P.hash("key"),
   "lkShopRoomCounters/"+P.roomKey("tenant",tenantId,"admin_store"),
   "lkShopFcmTokenClaims/"+P.hash("token"),
  ];
  for(const path of paths){
   const ref=clientDoc(browser,path);
   await assert.rejects(clientGet(ref),err=>
    /permission-denied/i.test(String(err?.code||"")+" "+String(err?.message||"")));
   await assert.rejects(clientSet(ref,{fcmToken:"stolen",role:"admin_store"}),
    err=>/permission-denied/i.test(String(err?.code||"")+" "+String(err?.message||"")));
  }
 }finally{await deleteApp(app);}
});
