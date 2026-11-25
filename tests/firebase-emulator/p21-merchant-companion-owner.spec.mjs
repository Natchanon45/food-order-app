import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("P21_FIRESTORE_EMULATOR_ONLY");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),companion=require("./payment-companion");
const id=randomUUID().slice(0,8),tenantId="p21-tenant-"+id,
 otherId="p21-foreign-"+id,ownerUid="p21-owner-"+id,
 otherUid="p21-other-owner-"+id,cashierUid="p21-cashier-"+id;
test("P2.1 Firebase Observer is Owner-only, Tenant-scoped, read-only and never bank confirmed",async()=>{
 const now=Date.now();
 await Promise.all([
  db.collection("tenants").doc(tenantId).set({id:tenantId,active:true,name:"Owner Merchant"}),
  db.collection("tenants").doc(otherId).set({id:otherId,active:true,name:"Foreign Merchant"}),
  db.collection("users").doc(ownerUid).set({uid:ownerUid,role:"owner",tenantId,active:true}),
  db.collection("users").doc(otherUid).set({uid:otherUid,role:"owner",tenantId:otherId,active:true}),
  db.collection("users").doc(cashierUid).set({uid:cashierUid,role:"cashier",tenantId,active:true}),
  db.collection("paymentCompanionTenants").doc(tenantId).collection("devices").doc("deviceA")
   .set({id:"deviceA",label:"Android Owner",enabled:true,createdMs:now-50000}),
  db.collection("paymentCompanionTenants").doc(tenantId).collection("notices").doc("n1")
   .set({id:"n1",deviceId:"deviceA",deviceLabel:"Android Owner",amountSatang:33000,
    source:"line_scb_connect",receiverSuffix:"X-1234",bankMs:now-30000,receivedMs:now-20000}),
 ]);
 await assert.rejects(companion.getPaymentCompanionDashboard.run({data:{}}),{code:"unauthenticated"});
 await assert.rejects(companion.getPaymentCompanionDashboard.run({auth:{uid:cashierUid},data:{}}),{code:"permission-denied"});
 const own=await companion.getPaymentCompanionDashboard.run({auth:{uid:ownerUid},data:{}});
 for(const key of ["paymentVerified","bankConfirmed","canSettleInvoice","canReleaseKitchen"])
  assert.equal(own[key],false);
 assert.equal(own.items.length,1);
 assert.equal(own.items[0].amountSatang,33000);
 assert.equal(own.items[0].cashierPaymentConfirmed,false);
 assert.ok(!("keyHash" in own.devices[0]));
 assert.ok(!("rawText" in own.items[0]));
 const foreign=await companion.getPaymentCompanionDashboard.run({auth:{uid:otherUid},data:{}});
 assert.equal(foreign.items.length,0);
 assert.equal(foreign.devices.length,0);
 await db.collection("users").doc(ownerUid).update({active:false});
 await assert.rejects(companion.getPaymentCompanionDashboard.run({auth:{uid:ownerUid},data:{}}),{code:"permission-denied"});
 await db.collection("users").doc(ownerUid).update({active:true});
 await db.collection("tenants").doc(tenantId).update({active:false});
 await assert.rejects(companion.getPaymentCompanionDashboard.run({auth:{uid:ownerUid},data:{}}),{code:"permission-denied"});
});
