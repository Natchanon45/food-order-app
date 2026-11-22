import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID,createHash} from "node:crypto";
import {readFileSync} from "node:fs";
const project="demo-penguin-hybrid";
if(process.env.GCLOUD_PROJECT!==project||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp}=require("firebase-admin/app"),{getFirestore,FieldValue}=require("firebase-admin/firestore");
initializeApp({projectId:project});const db=getFirestore();
const qr=require("./payment-companion-qr-policy"),receiver=require("./payment-companion-receiver");
const tenantId="qrtenant-"+randomUUID(),otherTenantId="other-"+randomUUID(),tenant=db.collection("tenants").doc(tenantId),root=db.collection("paymentCompanionTenants").doc(tenantId);
const itemId="menu-abc123",baseQuoteId="quote-abcdef123456",orderId="order-abcdef12345678",capabilities=[];
const storedFiles=new Map();
const mockStorage={bucket:()=>({file:path=>({getMetadata:async()=>{const f=storedFiles.get(path);if(!f)throw Error("MISSING");return[{size:String(f.bytes.length),contentType:f.mime,metadata:{tenantId:f.tenantId,orderId:f.orderId}}]},download:async()=>[storedFiles.get(path).bytes]})})};
const enabledPolicy={...qr,configuredTenant:()=>tenantId};
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const mockedFunctions={"firebase-functions/v2/https":{onCall:(_,fn)=>fn,HttpsError},"firebase-admin/firestore":{getFirestore:()=>db,FieldValue},"node:crypto":require("node:crypto"),"./payment-companion-qr-policy":enabledPolicy,"./delivery-opening-hours":{getDeliveryOpeningStatus:()=>({open:true})},"firebase-admin/storage":{getStorage:()=>mockStorage}};
function load(file){
 const exports={},code=readFileSync(file,"utf8");
 new Function("exports","require",code)(exports,name=>mockedFunctions[name]??require(name));
 return exports;
}
const intake=load("functions/public-delivery-submit.js"),status=load("functions/payment-companion-qr.js");
const call=(name,data)=>status[name]({data});
const orderData=(id=orderId,override={})=>({
 id,recipientName:"Test Recipient",recipientPhone:"0800000123",deliveryAddress:"Synthetic address",
 deliveryLatitude:13.7,deliveryLongitude:100.5,deliveryProvider:"lalamove",
 subtotalAmount:120,totalAmount:150,deliveryFee:30,deliveryBaseFee:30,deliveryFeeDiscount:0,
 freeGiftMenuIds:[],freeShippingApplied:false,paymentMethod:"promptpay",
 paymentQrMode:"confirmed_order_5m",paymentSlipPath:"",paymentReviewRequired:false,slipCheckStatus:"",
 lalamoveQuotationId:baseQuoteId,
 items:[{menuId:itemId,name:"Synthetic Food",price:120,qty:1}],
 ...override,
});
async function create(id=orderId,override={}){
 const order=orderData(id,override);
 const {tenantId:validated,id:oid,order:o}=intake.__test.validateSubmission({tenantId,order});
 return intake.__test.createDeliveryOrderWithGuard(db,validated,oid,o);
}
test("Firestore + trusted synthetic Lalamove quote: canonical server QR, amount guard, immutable window, unique fallback image",async()=>{
 await tenant.set({active:true,businessType:"both"});
 await tenant.collection("settings").doc("store").set({
  bankName:"SCB",bankAccountNumber:"1234567890",bankAccountName:"Synthetic Test",
  promptPayId:"0991112223",promptPayName:"Synthetic Test Shop",deliveryPromptPayEnabled:true,
 });
 const storeSnap=await tenant.collection("settings").doc("store").get();
 await root.set({receiver:{enabled:true,bankCode:"scb",accountLast4:"7890",revision:receiver.receiverRevision(storeSnap),confirmedAtMs:Date.now()-60000}});
 await tenant.collection("menus").doc(itemId).set({active:true,price:120});
 const makeQuote=async()=>tenant.collection("deliveryCheckoutQuotes").doc(baseQuoteId).set({tenantId,quotationId:baseQuoteId,
  fee:30,latitude:13.7,longitude:100.5,paymentMethod:"promptpay",expiresAt:new Date(Date.now()+200000).toISOString()});
 await makeQuote();
 const expiredQuoteId="quote-expired123456";
 await tenant.collection("deliveryCheckoutQuotes").doc(expiredQuoteId).set({
   tenantId,quotationId:expiredQuoteId,fee:30,latitude:13.7,longitude:100.5,
   paymentMethod:"promptpay",expiresAt:new Date(Date.now()-1000).toISOString(),
 });
 assert.equal((await call("getPublicCompanionQrAvailability",{tenantId})).enabled,true);
 for(const [reason,patch] of [
  ["wrong menu", {items:[{menuId:itemId,name:"Synthetic Food",price:1,qty:1}]}],
  ["wrong quantity", {items:[{menuId:itemId,name:"Synthetic Food",price:120,qty:2}]}],
  ["wrong amount",{totalAmount:151}],["forged fee",{deliveryFee:1}],
  ["wrong coordinates",{deliveryLatitude:13.71}],
  ["promotion unverified",{freeGiftMenuIds:["other"]}],
  ["free shipping unverified",{freeShippingApplied:true}],
  ["missing quote",{lalamoveQuotationId:"quote-other12345"}],
  ["expired quote",{lalamoveQuotationId:expiredQuoteId}],
 ]){
  await assert.rejects(create("order-invalid-"+reason.replaceAll(" ","-"),patch),{code:"failed-precondition"},reason);
 }
 const result=await create();
 assert.equal(result.id,orderId);assert.equal(result.paymentQrMode,"confirmed_order_5m");
 assert.match(result.paymentCorrectionCapability,/^[a-f0-9]{64}$/);
 capabilities.push(result.paymentCorrectionCapability);
 const row=(await tenant.collection("orders").doc(orderId).get()).data();
 assert.equal(row.status,"pending");assert.equal(row.paymentStatus,"pending_verification");
 assert.equal(row.paymentSlipPath,"");assert.equal(row.paymentReviewRequired,false);assert.equal(row.kitchenReleasedAt,undefined);
 assert.equal(row.promptPayQRRecipientId,"0991112223");
 assert.equal(Date.parse(row.paymentQrExpiresAtUTC)-Date.parse(row.paymentQrStartedAtUTC),300000);
 assert.equal(row.paymentQrCapabilityDigest,createHash("sha256").update(result.paymentCorrectionCapability).digest("hex"));
 assert.equal((await call("getPublicCompanionQrState",{tenantId,orderId})).active,true);
 assert.equal((await call("getPublicCompanionQrState",{tenantId,orderId})).recipientId,"0991112223");
 await assert.rejects(create(),{code:"already-exists"});
 const saved=await tenant.collection("orders").doc(orderId).get();
 const snap=qr.qrSnapshot(saved.data(),storeSnap,(await root.get()).data().receiver,tenantId,Date.now()+300001);
 assert.equal(snap.active,false);assert.equal(snap.canUploadSlip,true);
 // Simulate elapsed wall clock strictly in the harness; real production uses Date.now().
 const futurePolicy={...enabledPolicy,qrSnapshot:(...args)=>qr.qrSnapshot(...args,Date.now()+360000)};
 const laterExports={};
 new Function("exports","require",readFileSync("functions/payment-companion-qr.js","utf8"))(laterExports,n=>n==="./payment-companion-qr-policy"?futurePolicy:mockedFunctions[n]??require(n));
 const fallback=(data)=>laterExports.submitPublicCompanionLateSlip({data});
 const path="tenants/"+tenantId+"/payment-slips/"+orderId+"/synthetic.png";
 const bytes=Buffer.from("89 50 4E 47 synthetic receipt, not a bank-confirmed proof");
 storedFiles.set(path,{bytes,mime:"image/png",tenantId,orderId});
 await assert.rejects(fallback({tenantId,orderId,capability:"b".repeat(64),slipPath:path}),{code:"permission-denied"});
 const settled=await Promise.all([fallback({tenantId,orderId,capability:capabilities[0],slipPath:path}),fallback({tenantId,orderId,capability:capabilities[0],slipPath:path})]);
 assert.equal(settled.filter(r=>r.alreadySubmitted===false).length,1);
 assert.equal(settled.filter(r=>r.alreadySubmitted===true).length,1);
 const latest=(await tenant.collection("orders").doc(orderId).get()).data();
 assert.equal(latest.paymentStatus,"pending_verification");assert.equal(latest.status,"pending");assert.equal(latest.kitchenReleasedAt,undefined);
 assert.equal(latest.slipCheckStatus,"manual_review");assert.equal(latest.paymentReviewRequired,true);
 assert.equal((await tenant.collection("paymentCompanionLateSlipAudit").get()).size,1);
 assert.equal((await db.collection("paymentCompanionSlipHashes").get()).size,1);
 await assert.rejects(fallback({tenantId,orderId,capability:capabilities[0],slipPath:"tenants/"+tenantId+"/payment-slips/"+orderId+"/other.png"}));
 // An exact duplicate image cannot be accepted under a different order.
 const secondId="order-second1234567";
 await makeQuote();
 const second=await create(secondId);
 const path2="tenants/"+tenantId+"/payment-slips/"+secondId+"/synthetic.png";
 storedFiles.set(path2,{bytes,mime:"image/png",tenantId,orderId:secondId});
 await assert.rejects(laterExports.submitPublicCompanionLateSlip({data:{tenantId,orderId:secondId,capability:second.paymentCorrectionCapability,slipPath:path2}}),{code:"failed-precondition"});
 assert.equal((await tenant.collection("orders").doc(secondId).get()).data().paymentStatus,"pending_verification");
 await tenant.collection("settings").doc("store").update({bankAccountNumber:"9999997890"});
 const changed=await call("getPublicCompanionQrState",{tenantId,orderId:secondId});
 assert.equal(changed.active,false);assert.equal(changed.canUploadSlip,true);
 await tenant.collection("settings").doc("store").update({bankAccountNumber:"1234567890"});
 assert.equal((await call("getPublicCompanionQrState",{tenantId,orderId:secondId})).active,false);
 assert.equal((await call("getPublicCompanionQrAvailability",{tenantId})).enabled,false);
});
test("real function exports default closed in emulator without actual payment provider",async()=>{
 const actual=load("functions/payment-companion-qr.js");
 // The wrapper is injected for test only; the actual Node export must deny demo.
 const prod=require("./payment-companion-qr");
 assert.equal((await prod.getPublicCompanionQrAvailability.run({data:{tenantId}})).enabled,false);
});

test("isolated UAT kitchen: explicit consent, unique bank notice, exactly-once admission; remains unpaid and cannot dispatch",async()=>{
 const kPolicy=require("./payment-companion-kitchen-policy");
 const companionPolicy=require("./payment-companion-policy");
 const rootStore=tenant.collection("settings").doc("store");
 await rootStore.update({bankName:"SCB",bankAccountNumber:"1234567890",bankAccountName:"Synthetic Test",promptPayId:"0991112223"});
 await tenant.collection("menus").doc(itemId).update({price:170});
 await tenant.collection("deliveryCheckoutQuotes").doc(baseQuoteId).update({expiresAt:new Date(Date.now()+200000).toISOString()});
 const store=await rootStore.get(),rev=receiver.receiverRevision(store),link={enabled:true,bankCode:"scb",accountLast4:"7890",revision:rev,confirmedAtMs:Date.now()-5000};
 const consent={enabled:true,revision:rev,confirmedAtMs:Date.now()-4000,confirmedByUid:"owner-uat-12345"};
 await root.set({receiver:link,autoKitchenConsent:consent},{merge:true});
 const deviceId="device-uat123456",device=root.collection("devices").doc(deviceId);
 await device.set({id:deviceId,label:"Synthetic source",enabled:true,createdMs:Date.now()-10000});
 assert.equal(kPolicy.configuredUatTenant(), "");
 assert.equal(kPolicy.configuredUatTenant({GCLOUD_PROJECT:"penguin-food",PENGUIN_PAYMENT_COMPANION_UAT_PROJECT_ID:"penguin-food",PENGUIN_PAYMENT_COMPANION_AUTO_KITCHEN_ENABLED:"1",PENGUIN_PAYMENT_COMPANION_QR_ENABLED:"1",PENGUIN_PAYMENT_COMPANION_PILOT_ENABLED:"1",PENGUIN_PAYMENT_COMPANION_PILOT_TENANT_ID:tenantId}), "");
 assert.equal(kPolicy.configuredUatTenant({GCLOUD_PROJECT:"demo-penguin-hybrid",PENGUIN_PAYMENT_COMPANION_UAT_PROJECT_ID:"demo-penguin-hybrid",PENGUIN_PAYMENT_COMPANION_AUTO_KITCHEN_ENABLED:"1",PENGUIN_PAYMENT_COMPANION_QR_ENABLED:"1",PENGUIN_PAYMENT_COMPANION_PILOT_ENABLED:"1",PENGUIN_PAYMENT_COMPANION_PILOT_TENANT_ID:tenantId}), "");
 const uatOrderId="order-uat-kitchen-001",result=await create(uatOrderId,{totalAmount:200,subtotalAmount:170,
   items:[{menuId:itemId,name:"Synthetic Food",qty:1,price:170}]});
 assert.equal(result.paymentQrMode,"confirmed_order_5m");
 const orderRef=tenant.collection("orders").doc(uatOrderId),o=(await orderRef.get()).data();
 assert.equal(o.paymentStatus,"pending_verification");
 const noticeId="f".repeat(64),created=o.createdAt.toMillis(),bankMs=Math.max(created,Date.now()-1),receivedMs=Date.now();
 const notice={id:noticeId,eventId:"a".repeat(64),source:"line_scb_connect",
  amountSatang:20000,receiverSuffix:"X-7890",bankMs,observedMs:receivedMs,
  receivedMs:Math.max(receivedMs,bankMs),deviceId,deviceLabel:"Synthetic source",
  receiverRevision:rev,verificationStatus:"unverified"};
 await root.collection("notices").doc(noticeId).set(notice);
 const uatKitchen={...kPolicy,configuredUatTenant:()=>tenantId};
 const fakeCompanion={__kitchenInternal:{}};
 const fakeCompanionExports={};
 const fakeCompanionEnv={PENGUIN_PAYMENT_COMPANION_PILOT_ENABLED:"1",PENGUIN_PAYMENT_COMPANION_PILOT_TENANT_ID:tenantId};
 new Function("exports","require","process","Buffer",readFileSync("functions/payment-companion.js","utf8"))(
  fakeCompanionExports,n=>({
    "firebase-functions/v2/https":{onCall:(_,fn)=>fn,onRequest:(_,fn)=>fn,HttpsError},
    "firebase-admin/firestore":{getFirestore:()=>db},
    "node:crypto":require("node:crypto"),
    "./payment-companion-policy":companionPolicy,
    "./payment-companion-receiver":receiver,
    "./payment-companion-kitchen-policy":uatKitchen,
  }[n]??require(n)),{env:fakeCompanionEnv},Buffer);
 const kitchen={};
 new Function("exports","require",readFileSync("functions/payment-companion-kitchen.js","utf8"))(kitchen,n=>({
  "firebase-functions/v2/firestore":{onDocumentCreated:(_,fn)=>fn},
  "firebase-admin/firestore":{getFirestore:()=>db,FieldValue},
  "./payment-companion-kitchen-policy":uatKitchen,
  "./payment-companion":fakeCompanionExports,
 }[n]??require(n)));
 const admission=await kitchen.__test.admit(db,tenantId,noticeId);
 assert.equal(admission.admitted,true);
 const final=(await orderRef.get()).data();
 assert.equal(final.paymentStatus,"pending_verification");
 assert.equal(final.status,"pending");
 assert.equal(final.paidAt,undefined);
 assert.equal(final.kitchenReleasedAt,undefined);
 assert.equal(final.lalamoveOrderId,undefined);
 assert.equal(final.companionKitchenRelease.status,"admitted_unverified");
 assert.equal(final.companionKitchenRelease.paymentVerified,false);
 assert.equal(final.companionKitchenRelease.canDispatchRider,false);
 const {deliveryKitchenAdmitted}=await import("../../react-app/src/data/deliveryKitchenGate.js");
 const {kitchenAdmitted}=require("./delivery-slip-policy");
 assert.equal(deliveryKitchenAdmitted(final),true);
 assert.equal(kitchenAdmitted(final),true);
 assert.equal((await root.collection("kitchenClaims").get()).size,1);
 assert.equal((await root.collection("kitchenAdmissions").get()).size,1);
 const again=await kitchen.__test.admit(db,tenantId,noticeId);
 assert.equal(again.admitted,false);
 assert.equal((await root.collection("kitchenAdmissions").get()).size,1);
 assert.equal(qr.qrSnapshot(final,store,link,tenantId).active,false);
 assert.equal(qr.qrSnapshot(final,store,link,tenantId).canUploadSlip,false);
 // Already used notification/processed order is NOT a new payment.
 assert.equal((await orderRef.get()).data().paymentStatus,"pending_verification");
 const secondNoticeId="e".repeat(64);
 await root.collection("notices").doc(secondNoticeId).set({...notice,id:secondNoticeId,eventId:"b".repeat(64)});
 const secondResult=await kitchen.__test.admit(db,tenantId,secondNoticeId);
 assert.equal(secondResult.admitted,false);
 assert.equal((await root.collection("kitchenAdmissions").get()).size,1);
});
