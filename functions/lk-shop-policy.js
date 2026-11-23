"use strict";
// Source LUKKAJA LK Shop rooms, adapted to Firebase. This is NOT a money,
// bank, auto-payment or cashier-release authority.
const {createHash,randomBytes,randomUUID}=require("node:crypto");
const ROOMS=Object.freeze({
 platform:["superadmin_slip_manual"],
 tenant:["admin_store","cashier_delivery","kitchen_delivery"],
});
const NAME=/^[\p{L}\p{M}\p{N} ._()-]{1,100}$/u;
const ID=/^[A-Za-z0-9_-]{4,128}$/;
const HEX=/^[a-f0-9]{64}$/;
const FCM=/^[a-zA-Z0-9_:\-.]{20,4096}$/;
const SITE="https://penguin-food.web.app";
const TTL=300000,MAX_ROOM_DEVICES=10;
const PILOT_KEY="PENGUIN_LK_SHOP_PILOT_ENABLED";
const PUSH_KEY="PENGUIN_LK_SHOP_FCM_ENABLED";
const hash=value=>createHash("sha256").update(value).digest("hex");
const secret=()=>randomBytes(32).toString("hex");
const purposeValid=(scope,purpose)=>ROOMS[scope]?.includes(purpose)===true;
const scopeKey=(scope,tenantId)=>scope==="platform"?"platform_global":"tenant_"+tenantId;
const roomKey=(scope,tenantId,purpose)=>scopeKey(scope,tenantId)+"_"+purpose;
const activeKey=(scope,tenantId,purpose,uid)=>hash([scope,tenantId,purpose,uid].join("|"));
const validFCM=token=>token===""||typeof token==="string"&&FCM.test(token);
const safeName=value=>typeof value==="string"&&NAME.test(value.trim());
function validEnrollment(input){
 return input&&typeof input==="object"&&!Array.isArray(input)&&
 Object.keys(input).sort().join(",")==="code,fcmToken,name,platform"&&
 HEX.test(input.code||"")&&safeName(input.name)&&
 ["android","ios"].includes(input.platform)&&validFCM(input.fcmToken);
}
function qrPayload(code){
 if(!HEX.test(code))throw Error("LK_SHOP_INVALID_CODE");
 return "lkshop://pair?v=1&server="+encodeURIComponent(SITE)+"&code="+code;
}
function safeTarget(scope,purpose){
 const page=scope==="platform"?"admin/tenants":
   purpose==="kitchen_delivery"?"kitchen":
   purpose==="cashier_delivery"?"cashier":"admin";
 return SITE+"/"+page;
}
function visibleDevice(doc,id){
 return {id,name:doc.name,platform:doc.platform,role:doc.purpose,
  scope:doc.scope,pushReady:!!doc.fcmToken,
  lastSeen:typeof doc.lastSeen==="string"?doc.lastSeen:null};
}
const numericEventId=key=>parseInt(key.slice(0,12),16); // <2^48, safe Dart JSON int
module.exports={ROOMS,NAME,ID,HEX,FCM,SITE,TTL,MAX_ROOM_DEVICES,
 PILOT_KEY,PUSH_KEY,hash,secret,randomUUID,purposeValid,scopeKey,roomKey,
 activeKey,validFCM,safeName,validEnrollment,qrPayload,safeTarget,
 visibleDevice,numericEventId};
