import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
   !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("LATEST_SOURCE_RECEIVER_REQUIRES_DEMO_FIRESTORE");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),suffix=randomUUID().slice(0,8);
const adminUid="p15-super-"+suffix,ownerUid="p15-owner-"+suffix;
const ref=db.collection("platformPrivateSettings").doc("receiptReceiver");
const legacyRef=db.collection("platformPrivateSettings").doc("slipVerification");
const tenantRef=db.collection("tenants").doc("p15-untouched-"+suffix);
const {getPlatformReceiptReceiver,updatePlatformReceiptReceiver}=require("./platform-receiver");
const admin={auth:{uid:adminUid},data:{}};
const sample={
 accountType:"01004",accountNumber:"1234567890",
 accountNameTH:"บริษัททดสอบ",accountNameEN:"Test Platform",
 promptPayType:"phone",promptPayId:"0812345678",
};
test("new central receiver Callables reject anonymous, Owner and inactive Superadmin",async()=>{
 await db.collection("users").doc(ownerUid).set({role:"owner",active:true});
 await db.collection("users").doc(adminUid).set({role:"super_admin",active:false});
 for(const handler of [getPlatformReceiptReceiver,updatePlatformReceiptReceiver]){
  await assert.rejects(handler.run({data:{receiver:sample,expectedRevision:0}}),
   {code:"unauthenticated"});
  for(const uid of [ownerUid,adminUid])
   await assert.rejects(handler.run({auth:{uid},
    data:{receiver:sample,expectedRevision:0}}),{code:"permission-denied"});
 }
 assert.equal((await ref.get()).exists,false);
});
test("legacy Slip2Go receiver can be inspected as an unconfirmed draft without migration/write",async()=>{
 await db.collection("users").doc(adminUid).set({role:"super_admin",active:true});
 await legacyRef.set({
  provider:"google_vision",
  receiverAccountType:"01004",receiverAccountNumber:"1234567890",
  receiverNameTh:"บริษัททดสอบ",receiverNameEn:"Test Platform",
  slip2GoSecret:"leave-legacy-secret-untouched",
 });
 const legacyBefore=(await legacyRef.get()).data();
 const read=await getPlatformReceiptReceiver.run(admin);
 assert.equal(read.item.receiver.accountType,"01004");
 assert.equal(read.item.legacyUnconfirmed,true);
 assert.equal(read.item.configured,false);
 assert.equal(read.item.revision,0);
 assert.equal(read.item.paymentRoutingEnabled,false);
 assert.equal(read.item.promptPayStorageReady,true);
 assert.equal((await ref.get()).exists,false);
 assert.deepEqual((await legacyRef.get()).data(),legacyBefore);
});
test("malformed account/PromptPay, missing names, corrupt revisions never produce payment receiver writes",async()=>{
 const cases=[
  {...sample,accountType:"SCB"},
  {...sample,accountNumber:"xx-123"},
  {...sample,accountNumber:"123"},
  {...sample,accountNameTH:"",accountNameEN:""},
  {...sample,promptPayType:"phone",promptPayId:"1234567890"},
  {...sample,promptPayType:"citizen",promptPayId:"0812345678"},
  {...sample,promptPayType:"none",promptPayId:"1234567890"},
  {...sample,accountNameEN:"<script>"},
 ];
 for(const receiver of cases)
  await assert.rejects(updatePlatformReceiptReceiver.run({
   auth:admin.auth,data:{receiver,expectedRevision:0},
  }),{code:"invalid-argument"});
 for(const expectedRevision of [-1,1.2,"garbage"])
  await assert.rejects(updatePlatformReceiptReceiver.run({
   auth:admin.auth,data:{receiver:sample,expectedRevision},
  }),{code:"invalid-argument"});
 assert.equal((await ref.get()).exists,false);
});
test("confirmed central receiver saves atomically, rereads canonical document and never activates routing",async()=>{
 const legacyBefore=(await legacyRef.get()).data();
 await tenantRef.set({firstActivatedAt:"2026-10-18",subscriptionExpiresAt:"2027-11-17",
  invoiceUnpaidCents:50000});
 const tenantBefore=(await tenantRef.get()).data();
 const receipt=await updatePlatformReceiptReceiver.run({
  auth:admin.auth,data:{receiver:sample,expectedRevision:0},
 });
 assert.equal(receipt.ok,true);
 assert.equal(receipt.item.revision,1);
 assert.equal(receipt.item.configured,true);
 assert.equal(receipt.item.paymentRoutingEnabled,false);
 const canonical=await getPlatformReceiptReceiver.run(admin);
 assert.deepEqual(canonical.item.receiver,sample);
 assert.equal(canonical.item.revision,1);
 assert.equal(canonical.item.legacyUnconfirmed,false);
 const raw=(await ref.get()).data();
 assert.equal(raw.updatedBy,adminUid);
 assert.equal(raw.revision,1);
 assert.equal(raw.receiver.accountType,"01004");
 assert.deepEqual((await legacyRef.get()).data(),legacyBefore);
 assert.deepEqual((await tenantRef.get()).data(),tenantBefore);
});
test("stale/concurrent receiver writes serialize with no silent recipient substitution",async()=>{
 const payloads=[
  {...sample,accountNumber:"8888888888"},
  {...sample,accountNumber:"9999999999"},
 ];
 const attempts=await Promise.allSettled(payloads.map(receiver=>
  updatePlatformReceiptReceiver.run({
   auth:admin.auth,data:{receiver,expectedRevision:1},
  })));
 assert.equal(attempts.filter(r=>r.status==="fulfilled").length,1);
 assert.equal(attempts.filter(r=>r.status==="rejected"&&
  r.reason.code==="failed-precondition").length,1);
 const canonical=await getPlatformReceiptReceiver.run(admin);
 assert.equal(canonical.item.revision,2);
 assert.ok(payloads.some(r=>r.accountNumber===canonical.item.receiver.accountNumber));
 assert.equal(canonical.item.paymentRoutingEnabled,false);
 await assert.rejects(updatePlatformReceiptReceiver.run({
  auth:admin.auth,data:{receiver:sample,expectedRevision:1},
 }),{code:"failed-precondition"});
});
test("active Superadmin permission revocation blocks all future reads/writes, even with valid revision",async()=>{
 await db.collection("users").doc(adminUid).set({role:"super_admin",active:false});
 await assert.rejects(getPlatformReceiptReceiver.run(admin),{code:"permission-denied"});
 await assert.rejects(updatePlatformReceiptReceiver.run({
  auth:admin.auth,data:{receiver:sample,expectedRevision:2},
 }),{code:"permission-denied"});
 assert.equal((await ref.get()).data().revision,2);
});
