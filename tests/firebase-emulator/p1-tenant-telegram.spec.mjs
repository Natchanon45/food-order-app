import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID,randomBytes,createCipheriv,createDecipheriv} from "node:crypto";
import {readFileSync} from "node:fs";
const project="demo-penguin-hybrid";
if(process.env.GCLOUD_PROJECT!==project||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp}=require("firebase-admin/app"),{getFirestore,FieldValue}=require("firebase-admin/firestore");
initializeApp({projectId:project});const db=getFirestore();
const key=Buffer.alloc(32,0x13),PREFIX="v1:";
const crypt={
 encryptToken:token=>{
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv);
  const ciphertext=Buffer.concat([cipher.update(token,"utf8"),cipher.final()]);
  return ["v1",iv.toString("base64"),cipher.getAuthTag().toString("base64"),ciphertext.toString("base64")].join(":");
 },
 decryptToken:encoded=>{
  const [prefix,iv,auth,data]=String(encoded).split(":");
  if(prefix!=="v1")throw Error("TOKEN_NOT_ENCRYPTED");
  const dec=createDecipheriv("aes-256-gcm",key,Buffer.from(iv,"base64"));
  dec.setAuthTag(Buffer.from(auth,"base64"));
  return Buffer.concat([dec.update(Buffer.from(data,"base64")),dec.final()]).toString("utf8");
 },
};
class HttpsError extends Error{constructor(code,message,details){super(message);this.code=code;this.details=details;}}
const fakeFns={"firebase-functions/v2/https":{onCall:(_,fn)=>fn,HttpsError},
 "firebase-functions/v2/firestore":{onDocumentWritten:(_,fn)=>fn,onDocumentCreated:(_,fn)=>fn},
 "firebase-functions/params":{defineSecret:()=>({value:()=>key.toString("base64")})},
 "firebase-admin/firestore":{getFirestore:()=>db,FieldValue},
 "./platform-telegram":{_privateForTests:crypt},
};
function load(file,additional={}){
 const exports={};
 new Function("exports","require",readFileSync(file,"utf8"))(exports,name=>additional[name]||fakeFns[name]||require(name));
 return exports;
}
const settings=load("functions/tenant-telegram.js");
const events=load("functions/tenant-telegram-events.js",{"./tenant-telegram":{_privateForTests:settings._privateForTests}});
const save=(data,actor=auth)=>settings.saveTenantTelegramSettings({data,auth:actor});
const get=(actor=auth)=>settings.getTenantTelegramSettings({data:{},auth:actor});
const tenantId="telegram-tenant-"+randomUUID(),otherId="telegram-other-"+randomUUID();
const owner="owner-"+randomUUID(),admin="admin-"+randomUUID(),cashier="cashier-"+randomUUID(),other="other-"+randomUUID();
const auth={uid:owner},tRef=db.collection("tenants").doc(tenantId);
const dummyToken="123456789:"+("a".repeat(35));
const payload=(purpose,rev="0",extra={})=>({purpose,expectedRevision:rev,chatId:"-1001234567890",
 botToken:dummyToken,enabled:true,clearToken:false,...extra});
test("tenant scoping, roles, AES-GCM at rest, optimistic save and revocation",async()=>{
 await Promise.all([
  tRef.set({active:true}),db.collection("tenants").doc(otherId).set({active:true}),
  db.collection("users").doc(owner).set({active:true,tenantId,role:"owner"}),
  db.collection("users").doc(admin).set({active:true,tenantId,role:"admin"}),
  db.collection("users").doc(cashier).set({active:true,tenantId,role:"cashier"}),
  db.collection("users").doc(other).set({active:true,tenantId:otherId,role:"owner"}),
 ]);
 await assert.rejects(get(null),{code:"unauthenticated"});
 await assert.rejects(get({uid:cashier}),{code:"permission-denied"});
 const initial=await get();
 assert.deepEqual(initial.channels.map(c=>c.purpose),settings._privateForTests.PURPOSES);
 assert.equal(initial.channels[0].enabled,false);
 await assert.rejects(save(payload("admin_store","0",{botToken:"invalid"})),{code:"invalid-argument"});
 await assert.rejects(save(payload("admin_store","0",{chatId:"evil-chat"})),{code:"invalid-argument"});
 await assert.rejects(save(payload("admin_store","0",{enabled:true,botToken:""})),{code:"failed-precondition"});
 await assert.rejects(save(payload("admin_store"),{uid:cashier}),{code:"permission-denied"});
 await assert.rejects(save(payload("wrong_channel")),{code:"invalid-argument"});
 const saved=await save(payload("admin_store"));
 assert.equal(saved.ok,true);assert.equal(saved.item.enabled,true);
 assert.equal(saved.item.tokenConfigured,true);assert.equal(saved.item.tokenMasked.endsWith("aaaa"),true);
 assert.ok(!JSON.stringify(saved).includes(dummyToken));
 const ref=tRef.collection("telegramChannels").doc("admin_store"),row=(await ref.get()).data();
 assert.equal(row.tokenEncrypted.startsWith(PREFIX),true);
 assert.ok(!JSON.stringify(row).includes(dummyToken));
 assert.equal(crypt.decryptToken(row.tokenEncrypted),dummyToken);
 assert.equal(row.revision,saved.item.revision);
 const readable=(await get({uid:admin})).channels.find(c=>c.purpose==="admin_store");
 assert.equal(readable.revision,saved.item.revision);
 assert.equal(readable.tokenConfigured,true);
 assert.equal(readable.botToken,undefined);
 await assert.rejects(save(payload("admin_store","0",{botToken:""})),{code:"aborted"});
 const modified=await save(payload("admin_store",saved.item.revision,{chatId:"-1001234567999",botToken:""}),{uid:admin});
 assert.equal(modified.item.enabled,true);
 assert.equal((await ref.get()).data().tokenEncrypted,row.tokenEncrypted);
 const concurrent=await Promise.allSettled([
  save(payload("admin_store",modified.item.revision,{enabled:false,botToken:""})),
  save(payload("admin_store",modified.item.revision,{enabled:false,botToken:""}),{uid:admin}),
 ]);
 assert.equal(concurrent.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(concurrent.filter(x=>x.status==="rejected"&&x.reason.code==="aborted").length,1);
 let r=(await get()).channels[0];
 const clear=await save(payload("admin_store",r.revision,{botToken:"",clearToken:true,enabled:false,chatId:""}));
 assert.equal(clear.item.tokenConfigured,false);
 assert.equal((await ref.get()).data().tokenEncrypted,"");
 assert.equal((await get({uid:other})).channels[0].enabled,false);
 await assert.rejects(settings.testTenantTelegramSettings({data:{purpose:"admin_store"},auth}),{code:"failed-precondition"});
});
test("outbox exact transitions, tenant-only channels, safe references, idempotent Telegram transport",async()=>{
 const snapshot=await get(),revisionOf=p=>snapshot.channels.find(c=>c.purpose===p).revision;
 await Promise.all(settings._privateForTests.PURPOSES.map(p=>save(payload(p,revisionOf(p)))));
 const orderId="delivery-order-123456",base={id:orderId,tenantId,orderType:"delivery",status:"pending",
  paymentStatus:"pending_verification",paymentMethod:"promptpay",deliveryProvider:"lalamove",totalAmount:200};
 const e=events._privateForTests;
 assert.equal(e.orderEvent(tenantId,orderId,null,{...base,paymentQrMode:"confirmed_order_5m"}),null);
 const manual=e.orderEvent(tenantId,orderId,null,{...base,paymentSlipPath:"tenants/"+tenantId+"/payment-slips/"+orderId+"/synthetic.png",paymentReviewRequired:true,slipCheckStatus:"manual_review"});
 assert.equal(manual.kind,"pending_slip");
 assert.deepEqual(manual.purposes,["admin_store","cashier_delivery"]);
 assert.equal(e.textFor(manual,"kitchen_delivery"),"");
 assert.doesNotMatch(e.textFor(manual,"cashier_delivery"),/123456789:|Synthetic Recipient|TOKEN_TEST/);
 const a=await Promise.all([e.queue(db,manual),e.queue(db,manual)]);
 assert.equal(a.reduce((n,r)=>n+r.queued,0),2);
 assert.equal((await tRef.collection("telegramOutbox").get()).size,2);
 const cod=e.orderEvent(tenantId,orderId+"-cod",null,{...base,tenantId,paymentMethod:"cod",paymentStatus:"unpaid",totalAmount:250});
 assert.equal(cod.kind,"cod_created");
 assert.equal((await e.queue(db,cod)).queued,3);
 const qrAfter={...base,paymentQrMode:"confirmed_order_5m",paymentQrSlipFallbackStatus:"submitted",
 paymentSlipPath:"tenants/"+tenantId+"/payment-slips/"+orderId+"/original.png",paymentReviewRequired:true};
 assert.equal(e.orderEvent(tenantId,orderId,base,qrAfter).kind,"original_slip");
 assert.equal((await e.queue(db,e.orderEvent(tenantId,orderId,base,qrAfter))).queued,2);
 const admitted={...base,paymentQrMode:"confirmed_order_5m",companionKitchenRelease:{status:"admitted_unverified",paymentVerified:false,canDispatchRider:false}};
 const admit=e.orderEvent(tenantId,orderId,{...base,paymentQrMode:"confirmed_order_5m"},admitted);
 assert.equal(admit.kind,"uat_kitchen");
 assert.equal((await e.queue(db,admit)).queued,3);
 assert.match(e.textFor(admit,"kitchen_delivery"),/ยังไม่ยืนยันเงินเข้า/);
 const paid=e.orderEvent(tenantId,orderId,base,{...base,paymentStatus:"paid"});
 assert.equal(paid.kind,"paid");assert.equal((await e.queue(db,paid)).queued,3);
 const finance=e.financeEvent(tenantId,"topup-order-1234","wallet_topup",null,{amount:100,status:"pending"});
 assert.equal((await e.queue(db,finance)).queued,1);
 assert.equal(e.financeEvent(tenantId,"topup-order-1234","wallet_topup",{status:"pending"},{status:"pending",amount:100}),null);
 assert.equal((await e.queue(db,e.financeEvent(tenantId,"topup-order-1234","wallet_topup",{status:"pending"},{status:"approved",amount:100}))).queued,1);
 const fee=e.financeEvent(tenantId,"platform-attempt-001","hybrid_platform_fee",null,{
  tenantId,invoiceId:"hybrid-invoice-1234",amount:380,status:"pending_review"});
 assert.equal(fee.kind,"hybrid_platform_fee");
 assert.equal((await e.queue(db,fee)).queued,1);
 assert.match(e.textFor(fee,"admin_store"),/รอ Superadmin ตรวจสอบ/);
 assert.equal(e.financeEvent(tenantId,"platform-attempt-001","hybrid_platform_fee",null,{
  tenantId:otherId,invoiceId:"hybrid-invoice-1234",amount:380,status:"pending_review"}),null);
 const feePaid=e.financeEvent(tenantId,"platform-attempt-001","hybrid_platform_fee",
  {status:"pending_review"},{tenantId,invoiceId:"hybrid-invoice-1234",amount:380,status:"paid"});
 assert.equal(feePaid.phase,"paid");
 assert.equal((await e.queue(db,feePaid)).queued,1);
 assert.equal((await tRef.collection("telegramOutbox").get()).size,17);
 // One delivery only per record despite two simultaneous workers.
 let calls=0;
 const ref=e.eventRef(db,manual,"cashier_delivery");
 const fakeFetch=async(url,options)=>{
  calls++;
  assert.match(url,/^https:\/\/api.telegram.org\/bot123456789:/);
  const body=JSON.parse(options.body);
  assert.equal(body.chat_id,"-1001234567890");
  assert.ok(body.text.includes("รอตรวจรับเงินจริง"));
  return {ok:true,json:async()=>({ok:true})};
 };
 const sent=await Promise.all([e.deliver(db,tenantId,ref.id,fakeFetch),e.deliver(db,tenantId,ref.id,fakeFetch)]);
 assert.equal(sent.filter(x=>x.sent===true).length,1);
 assert.equal(calls,1);
 assert.equal((await ref.get()).data().status,"sent");
 assert.equal((await e.deliver(db,tenantId,ref.id,fakeFetch)).sent,false);
 // Failed network request is ambiguous: persist unconfirmed, do not auto-retry.
 const second=e.eventRef(db,manual,"admin_store");
 let uncertainCalls=0;
 assert.equal((await e.deliver(db,tenantId,second.id,async()=>{uncertainCalls++;throw Error("synthetic timeout");})).sent,false);
 assert.equal((await second.get()).data().status,"unconfirmed");
 assert.equal((await e.deliver(db,tenantId,second.id,fakeFetch)).sent,false);
 assert.equal(uncertainCalls,1);
 const otherRef=db.collection("tenants").doc(otherId).collection("telegramOutbox").doc(ref.id);
 assert.equal((await otherRef.get()).exists,false);
});
test("test-send is isolated to saved token and active channel, not unsaved client text",async()=>{
 const saved=(await get()).channels.find(c=>c.purpose==="kitchen_delivery");
 assert.equal(saved.enabled,true);
 const oldFetch=globalThis.fetch;
 let sends=0;
 globalThis.fetch=async(url,options)=>{
  sends++;
  assert.match(url,/^https:\/\/api.telegram.org\/bot123456789:/);
  assert.equal(JSON.parse(options.body).chat_id,"-1001234567890");
  return {ok:true,json:async()=>({ok:true})};
 };
 try{
  const result=await settings.testTenantTelegramSettings({data:{purpose:"kitchen_delivery",botToken:"forged",chatId:"forged"},auth});
  assert.equal(result.sent,true);assert.equal(sends,1);
 }finally{globalThis.fetch=oldFetch;}
 await db.collection("users").doc(owner).update({active:false});
 await assert.rejects(get(),{code:"permission-denied"});
});
