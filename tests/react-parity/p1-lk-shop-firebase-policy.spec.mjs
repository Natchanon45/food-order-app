import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const p=require("../../functions/lk-shop-policy.js");
test("LK Shop rooms exactly match Source and cannot be selected cross-scope",()=>{
 assert.deepEqual(p.ROOMS.platform,["superadmin_slip_manual"]);
 assert.deepEqual(p.ROOMS.tenant,["admin_store","cashier_delivery","kitchen_delivery"]);
 for(const room of p.ROOMS.platform){
  assert.equal(p.purposeValid("platform",room),true);
  assert.equal(p.purposeValid("tenant",room),false);
 }
 for(const room of p.ROOMS.tenant){
  assert.equal(p.purposeValid("tenant",room),true);
  assert.equal(p.purposeValid("platform",room),false);
 }
 for(const r of ["super_admin","cashier","admin","payment","stripe","server"]){
  assert.equal(p.purposeValid("tenant",r),false);
 }
});
test("QR carries one-use random 256-bit code and fixed PENGUIN Firebase origin, never user-selected",()=>{
 const code=p.secret();
 assert.match(code,p.HEX);
 assert.equal(code.length,64);
 const qr=p.qrPayload(code);
 const url=new URL(qr);
 assert.equal(url.protocol,"lkshop:");
 assert.equal(url.hostname,"pair");
 assert.equal(url.searchParams.get("v"),"1");
 assert.equal(url.searchParams.get("server"),"https://penguin-food.web.app");
 assert.equal(url.searchParams.get("code"),code);
 assert.notEqual(p.hash(code),code);
 assert.match(p.hash(code),p.HEX);
 assert.notEqual(p.hash(code),p.hash(p.secret()));
 assert.equal(p.TTL,300000);
 assert.equal(p.MAX_ROOM_DEVICES,10);
});
test("Reject invalid enrollment and metadata before attempting Firestore mutation",()=>{
 const code=p.secret(),good={code,name:"ร้านครัว 1",platform:"android",fcmToken:""};
 assert.equal(p.validEnrollment(good),true);
 assert.equal(p.validEnrollment({...good,fcmToken:"abc1234567:DEFGHIJKLMNOPQRSTUV"}),true);
 for(const invalid of [
  {...good,code:"x"}, {...good,platform:"web"},
  {...good,name:"<script>"},{...good,name:""},
  {...good,fcmToken:"unsafe space"}, {...good,fcmToken:"a".repeat(4097)},
  {...good,scope:"platform"}, {...good,role:"superadmin_slip_manual"},
  {...good,tenantId:"other"}, {...good,credential:"test"},
 ]){
  assert.equal(p.validEnrollment(invalid),false,JSON.stringify(invalid).slice(0,160));
 }
});
test("Safe URLs always point to PENGUIN role dashboard, never arbitrary URL or super-admin deep links",()=>{
 assert.equal(p.safeTarget("tenant","cashier_delivery"),p.SITE+"/cashier");
 assert.equal(p.safeTarget("tenant","kitchen_delivery"),p.SITE+"/kitchen");
 assert.equal(p.safeTarget("tenant","admin_store"),p.SITE+"/admin");
 assert.equal(p.safeTarget("platform","superadmin_slip_manual"),p.SITE+"/admin/tenants");
 const id=p.hash("event");
 assert.ok(Number.isSafeInteger(p.numericEventId(id)));
 assert.ok(p.numericEventId(id)>0);
});
test("Visible device projection never exposes bearer credential or FCM token",()=>{
 const raw={name:"Kitchen phone",platform:"android",purpose:"kitchen_delivery",
  scope:"tenant",fcmToken:"abc1234567:DEFGHIJKLMNOPQRSTUV",
  credentialHash:p.hash(p.secret()),email:"secret@example.test",lastSeen:"2026-11-23T02:10:00Z"};
 const value=p.visibleDevice(raw,"safe-device-1");
 assert.deepEqual(Object.keys(value).sort(),
  ["id","name","platform","role","scope","pushReady","lastSeen"].sort());
 assert.equal(JSON.stringify(value).includes(raw.fcmToken),false);
 assert.equal(JSON.stringify(value).includes(raw.credentialHash),false);
 assert.equal(JSON.stringify(value).includes(raw.email),false);
});
test("Source LK Shop old Flutter hostname allowlist is incompatible with PENGUIN origin (explicit mobile port blocker)",()=>{
 assert.notEqual(new URL(p.SITE).host,"www.lukkaja.com");
 assert.equal(p.PILOT_KEY,"PENGUIN_LK_SHOP_PILOT_ENABLED");
 assert.equal(p.PUSH_KEY,"PENGUIN_LK_SHOP_FCM_ENABLED");
});
