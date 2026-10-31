import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const projectId = "demo-penguin-lukkaja-parallel";
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "")
 || (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== projectId)) {
 throw new Error("LOCAL_FIRESTORE_EMULATOR_ONLY");
}
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const {initializeApp,deleteApp} = require("firebase-admin/app");
const {getFirestore,FieldValue} = require("firebase-admin/firestore");
const app=initializeApp({projectId},"parallel-"+randomUUID());
const db=getFirestore(app);
const {HttpsError}=require("firebase-functions/v2/https");
const source=readFileSync(new URL("../../functions/operational-orders.js",import.meta.url),"utf8");
const mod={exports:{}};
new Function("module","exports","require",source)(mod,mod.exports,name=>{
 if(name==="firebase-functions/v2/https") return {HttpsError,onCall:(_opts,fn)=>fn};
 if(name==="firebase-admin/firestore") return {FieldValue,getFirestore:()=>db};
 if(name==="crypto") return require("crypto");
 if(name==="./walkin-finance-policy")return require("./walkin-finance-policy.js");
 throw new Error("UNRECOGNIZED_DEPENDENCY "+name);
});
const funcs=mod.exports;
const suffix=randomUUID().slice(0,9).replaceAll("-","");
const tenantId="parallel-"+suffix;
const menuId="menu-1234567";
const tableId="table-1234567";
const roles={cashier:"cashier-1234567",kitchen:"kitchen-1234567",outsider:"outside-1234567"};
const root=db.collection("tenants").doc(tenantId);
function invoke(actor,callable,data){
 return funcs[callable]({auth:{uid:roles[actor]},data:{tenantId,...data}});
}
function code(error){return error?.details?.code || error?.code || error?.message}
async function rejected(action,expected){
 await assert.rejects(action,e=>code(e)===expected,expected);
}
test("LUKKAJA parallel / Firebase real Firestore transaction lifecycle (demo only)",async t=>{
 t.after(async()=>{await deleteApp(app)});
 for(const [role,uid] of Object.entries(roles)){
  await db.collection("users").doc(uid).set({active:true,tenantId:role==="outsider"?"foreign-"+tenantId:tenantId,role:role==="outsider"?"cashier":role});
 }
 await root.collection("menus").doc(menuId).set({name:"Khao",price:125.5,active:true});
 await root.collection("tables").doc(tableId).set({code:"A1",status:"available",active:true});
 const mainId="walkin-"+suffix+"a";
 const data={id:mainId,serviceType:"dine_in",tableCode:"A1",paymentMethod:"cash",
  paymentTiming:"after",cashReceived:null,items:[{menuId,qty:2,note:""}]};
 await rejected(()=>invoke("outsider","createWalkInOrder",data),"permission-denied");
 await rejected(()=>invoke("cashier","createWalkInOrder",{...data,id:"walkin-"+suffix+"z",paymentMethod:"promptpay"}),"DEFERRED_CASH_ONLY");
 const first=await invoke("cashier","createWalkInOrder",data);
 assert.equal(first.item.paymentStatus,"unpaid");
 assert.equal(first.item.totalAmount,251);
 assert.equal(first.item.paidAt,undefined);
 assert.equal((await root.collection("tables").doc(tableId).get()).data().walkInOrderId,mainId);
 const repeat=await invoke("cashier","createWalkInOrder",data);
 assert.equal(repeat.idempotent,true);
 await rejected(()=>invoke("kitchen","settleDeferredWalkIn",{orderId:mainId,operationId:"settle-1234567",cashReceived:300,expectedTotal:251}),"permission-denied");
 await rejected(()=>invoke("cashier","settleDeferredWalkIn",{orderId:mainId,operationId:"settle-1234567",cashReceived:300,expectedTotal:251}),"WAIT_FOR_KITCHEN");
 await invoke("kitchen","updateDeferredKitchen",{orderId:mainId,action:"status",status:"served"});
 const add={orderId:mainId,operationId:"append-1234567",items:[{menuId,qty:1,note:""}]};
 const appended=await invoke("cashier","appendUnpaidWalkInItems",add);
 assert.equal(appended.item.totalAmount,376.5);
 assert.equal(appended.item.items[0].kitchenPreviouslyServed,true);
 const dupe=await invoke("cashier","appendUnpaidWalkInItems",add);
 assert.equal(dupe.duplicate,true);
 await rejected(()=>invoke("cashier","appendUnpaidWalkInItems",{...add,operationId:"append-1111111",items:[{menuId,qty:3,price:0}]}),"CLIENT_PRICE_FORBIDDEN");
 await rejected(()=>invoke("cashier","settleDeferredWalkIn",{orderId:mainId,operationId:"settle-1234567",cashReceived:500,expectedTotal:376.5}),"WAIT_FOR_KITCHEN");
 await invoke("kitchen","updateDeferredKitchen",{orderId:mainId,action:"serve_item",index:1});
 const paid=await invoke("cashier","settleDeferredWalkIn",{orderId:mainId,operationId:"settle-1234567",cashReceived:500,expectedTotal:376.5});
 assert.equal(paid.item.paymentStatus,"paid");
 assert.equal(paid.item.changeAmount,123.5);
 assert.equal((await root.collection("tables").doc(tableId).get()).data().status,"available");
 assert.equal((await invoke("cashier","settleDeferredWalkIn",{orderId:mainId,operationId:"settle-1234567",cashReceived:500,expectedTotal:376.5})).duplicate,true);
 await rejected(()=>invoke("cashier","cancelDeferredWalkIn",{orderId:mainId,source:"cashier"}),"DEFERRED_BILL_NOT_ELIGIBLE");
 const kitchenPaidId="walkin-"+suffix+"c";
 const kitchenPaid=await invoke("cashier","createWalkInOrder",{...data,id:kitchenPaidId,paymentTiming:undefined,cashReceived:500});
 assert.equal(kitchenPaid.item.paymentStatus,"paid");
 assert.equal((await root.collection("tables").doc(tableId).get()).data().walkInOrderId,kitchenPaidId);
 const reviewed=await invoke("cashier","cancelReviewedPaidWalkIn",{orderId:mainId});
 assert.equal(reviewed.item.status,"cancelled");
 assert.equal(reviewed.item.paymentStatus,"paid");
 assert.equal(reviewed.item.originalPaidTotal,376.5);
 assert.equal(reviewed.item.refundStatus,undefined);
 const audit=(await root.collection("auditLogs").doc("reviewed_walkin_cancel_"+mainId).get()).data();
 assert.equal(audit.manualRefundNotRecorded,true);
 assert.equal((await root.collection("tables").doc(tableId).get()).data().walkInOrderId,kitchenPaidId);
 await rejected(()=>invoke("cashier","cancelReviewedPaidWalkIn",{orderId:kitchenPaidId,source:"kitchen"}),"permission-denied");
 const kitchenVoid=await invoke("kitchen","cancelReviewedPaidWalkIn",{orderId:kitchenPaidId,source:"kitchen"});
 assert.equal(kitchenVoid.item.cancellationSource,"kitchen");
 assert.equal(kitchenVoid.item.paymentStatus,"paid");
 assert.equal(kitchenVoid.item.originalPaidTotal,251);
 assert.equal((await root.collection("tables").doc(tableId).get()).data().status,"available");
 const kitchenAudit=(await root.collection("auditLogs").doc("reviewed_walkin_cancel_"+kitchenPaidId).get()).data();
 assert.equal(kitchenAudit.action,"kitchen_order_cancelled_paid");
 assert.equal(kitchenAudit.manualRefundNotRecorded,true);
 assert.equal((await invoke("cashier","cancelReviewedPaidWalkIn",{orderId:mainId})).duplicate,true);
 // Existing paid order whose operational status was wrongly marked closed
 // must remain cookable only when Kitchen never served it.
 const legacyId="walkin-"+suffix+"d";
 const legacyCreate=await invoke("cashier","createWalkInOrder",{
  ...data,id:legacyId,serviceType:"takeaway",tableCode:"",paymentTiming:undefined,cashReceived:500
 });
 assert.equal(legacyCreate.item.status,"pending");
 await root.collection("orders").doc(legacyId).update({status:"paid"});
 const legacyAccept=await invoke("kitchen","updateDeferredKitchen",{orderId:legacyId,action:"status",status:"accepted"});
 assert.equal(legacyAccept.item.status,"accepted");
 await invoke("kitchen","updateDeferredKitchen",{orderId:legacyId,action:"status",status:"cooking"});
 await invoke("kitchen","updateDeferredKitchen",{orderId:legacyId,action:"status",status:"ready"});
 const legacyServed=await invoke("kitchen","updateDeferredKitchen",{orderId:legacyId,action:"status",status:"served"});
 assert.equal(legacyServed.item.status,"paid");
 assert.equal(legacyServed.item.paymentStatus,"paid");
 assert.ok(legacyServed.item.completedAt);
 await rejected(()=>invoke("kitchen","updateDeferredKitchen",{orderId:legacyId,action:"status",status:"accepted"}),"DEFERRED_BILL_NOT_ELIGIBLE");
 const unpaidId="walkin-"+suffix+"b";
 await invoke("cashier","createWalkInOrder",{...data,id:unpaidId,serviceType:"takeaway",tableCode:""});
 const cancel=await invoke("kitchen","cancelDeferredWalkIn",{orderId:unpaidId,source:"kitchen"});
 assert.equal(cancel.item.status,"cancelled");
 assert.equal(cancel.item.paymentStatus,"unpaid");
 assert.equal(cancel.item.cancellationSource,"kitchen");
 assert.equal((await invoke("kitchen","cancelDeferredWalkIn",{orderId:unpaidId,source:"kitchen"})).duplicate,true);
});
