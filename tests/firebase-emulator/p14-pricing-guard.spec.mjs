import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("P14_PRICING_AUDIT_REQUIRES_DEMO_FIRESTORE_EMULATOR");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),pricing=require("./subscription-pricing"),
 core=require("./subscription-pricing-core"),
 schedule=require("./delivery-threshold-schedule");
const adminUid="p14-price-admin-"+randomUUID(),
 ownerUid="p14-price-owner-"+randomUUID(),
 managedUid="p14-price-managed-"+randomUUID();
const user=uid=>({auth:{uid,token:{email_verified:false}},data:{}});
const ref=db.collection("platformSettings").doc("subscriptionPricing");
const tenantId="p14-price-tenant-"+randomUUID();
const tenantRef=db.collection("tenants").doc(tenantId);
const config={
 monthlyPrice:590,deliveryThreshold:10000,deliveryShareRate:5,
 monthlySlipQuota:100,annualMonths:12,discountType:"amount",
 discountValue:1180,vatMode:"inclusive",vatRate:7,
};
const datePlus=days=>require("./billing-anniversary").bangkokDateKey(
 new Date(Date.now()+days*86400000));
test("P1.4 pricing seed and existing tenant invoice/grace/trial dates remain independent",async()=>{
 await Promise.all([
 db.collection("users").doc(adminUid).set({role:"super_admin",active:true}),
 db.collection("users").doc(ownerUid).set({role:"owner",tenantId,active:true}),
 db.collection("users").doc(managedUid).set({
  role:"super_admin",active:true,emailVerificationRequired:true}),
 ref.set(config),
 tenantRef.set({
  id:tenantId,active:true,firstActivatedAt:"2026-10-18",
  trialEndsAt:"2026-11-17",subscriptionExpiresAt:"2027-11-17",
  gracePeriodDays:3,invoiceUnpaidCents:54321,
 }),
 ]);
 const current=await pricing.getSubscriptionPricing.run(user(adminUid));
 assert.equal(current.ok,true);
 assert.equal(current.config.monthlyPrice,590);
 assert.equal(current.pricing.annual.discountConfigured,1180);
 assert.equal(current.pricing.annual.payable,5900);
 assert.equal(current.config.monthlySlipQuota,100);
 const publicView=await pricing.getPublicSubscriptionPricing.run({data:{}});
 assert.equal(publicView.ok,true);
 assert.equal(publicView.config.deliveryThreshold,10000);
});
test("only active Superadmin can edit Premium; no managed unverified Callable bypass",async()=>{
 const original=(await ref.get()).data();
 for(const actor of [user(ownerUid),user(managedUid),{data:{}},
  {auth:{uid:"not-an-account"},data:{}}]){
  for(const handler of [pricing.getSubscriptionPricing,pricing.updateSubscriptionPricing,
    pricing.getDeliveryThresholdVersions,pricing.appendDeliveryThresholdVersion]){
   await assert.rejects(handler.run({...actor,data:config}),
    error=>["unauthenticated","permission-denied"].includes(error.code),
    "Protected Pricing handler unexpectedly accepted non-Superadmin or marked unverified");
  }
 }
 assert.deepEqual((await ref.get()).data(),original);
});
test("Premium amount/quota/percent/discount/VAT validation rejects malformed economic configuration",async()=>{
 const invalid=[
  {monthlyPrice:0},
  {monthlyPrice:1000001},
  {monthlyPrice:590.001},
  {deliveryThreshold:10000.001},
  {deliveryThreshold:-1},
  {deliveryShareRate:100.01},
  {deliveryShareRate:-1},
  {monthlySlipQuota:-1},
  {monthlySlipQuota:0.1},
  {monthlySlipQuota:1000001},
  {annualMonths:0,discountType:"none",discountValue:0},
  {annualMonths:1.4,discountType:"none",discountValue:0},
  {annualMonths:61},
  {discountType:"unknown"},
  {discountType:"percent",discountValue:100.1},
  {discountType:"amount",discountValue:999999},
  {discountValue:1180.001},
  {vatMode:"inferred"},
  {vatRate:31},
  {vatMode:"none",vatRate:31},
  {vatMode:"none",vatRate:7},
 ];
 const original=(await ref.get()).data();
 for(const invalidFields of invalid){
  await assert.rejects(pricing.updateSubscriptionPricing.run({
   ...user(adminUid),data:{...config,...invalidFields},
  }),{code:"invalid-argument"},
   "Invalid pricing payload was unexpectedly written "+JSON.stringify(invalidFields));
 }
 assert.deepEqual((await ref.get()).data(),original);
});
test("a valid Premium edit persists with immutable baseline, no Tenant/issued invoice modification",async()=>{
 const before=(await tenantRef.get()).data();
 const updated=await pricing.updateSubscriptionPricing.run({
  ...user(adminUid),data:{...config,monthlyPrice:650,monthlySlipQuota:120,
   deliveryShareRate:4.75,vatMode:"exclusive",vatRate:7},
 });
 assert.equal(updated.ok,true);
 assert.equal(updated.config.monthlyPrice,650);
 assert.equal(updated.config.monthlySlipQuota,120);
 assert.equal(updated.pricing.monthly.payable,695.5);
 const canonical=(await ref.get()).data();
 assert.equal(canonical.deliveryThreshold,10000);
 assert.equal(canonical.monthlyPrice,650);
 assert.equal(canonical.monthlySlipQuota,120);
 assert.deepEqual((await tenantRef.get()).data(),before);
 assert.equal((await pricing.getSubscriptionPricing.run(user(adminUid))).config.monthlyPrice,650);
});
test("future Delivery threshold versions append only once and never alter baseline or current cycle",async()=>{
 const announced=datePlus(10);
 const newThresholdCents=1500000,baselineThresholdCents=1000000;
 const beforeTenant=(await tenantRef.get()).data();
 const receipt=await pricing.appendDeliveryThresholdVersion.run({
  ...user(adminUid),data:{effectiveOn:announced,
   thresholdCents:newThresholdCents,baselineThresholdCents},
 });
 assert.equal(receipt.ok,true);
 const scheduleResult=await pricing.getDeliveryThresholdVersions.run(user(adminUid));
 assert.equal(scheduleResult.baselineThresholdCents,1000000);
 assert.equal(scheduleResult.versions.length,1);
 assert.equal(scheduleResult.versions[0].effectiveOn,announced);
 assert.equal(scheduleResult.versions[0].thresholdCents,newThresholdCents);
 assert.equal(schedule.thresholdForCycle(10000,datePlus(1),scheduleResult.versions),10000);
 assert.equal(schedule.thresholdForCycle(10000,datePlus(11),scheduleResult.versions),15000);
 assert.equal((await ref.get()).data().deliveryThreshold,10000);
 await assert.rejects(pricing.appendDeliveryThresholdVersion.run({
  ...user(adminUid),data:{effectiveOn:announced,
   thresholdCents:1700000,baselineThresholdCents},
 }),{code:"invalid-argument"});
 await assert.rejects(pricing.updateSubscriptionPricing.run({
  ...user(adminUid),data:{...config,deliveryThreshold:15000},
 }),{code:"failed-precondition"});
 assert.equal((await ref.get()).data().deliveryThresholdVersions.length,1);
 assert.deepEqual((await tenantRef.get()).data(),beforeTenant);
});
test("read-only preview remains consistent with Firebase price calculation and no invoice write",()=>{
 const scenario={...config,monthlyPrice:650,vatMode:"inclusive",vatRate:7};
 const a=core.calculatePricing(scenario);
 assert.equal(a.annual.regularConfigured,7800);
 assert.equal(a.annual.discountConfigured,1180);
 assert.equal(a.annual.payable,6620);
 assert.equal(a.annual.net+a.annual.vat,a.annual.payable);
 const noVat=core.calculatePricing({...scenario,vatMode:"none"});
 assert.equal(noVat.monthly.vat,0);
 assert.equal(noVat.annual.payable,6620);
});
