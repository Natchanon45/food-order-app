import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||"")||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("P13E_CALLABLE_AUDIT_REQUIRES_LOCAL_FIREBASE_AUTH_FIRESTORE_EMULATORS");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid",storageBucket:"demo-penguin-hybrid.appspot.com"});
const db=getFirestore(),nativeAuth=getAuth();
const uid="p13e-owner-"+randomUUID(),legacyUid="p13e-legacy-"+randomUUID();
const tenantId="p13e-tenant-"+randomUUID();
const actor={auth:{uid,token:{email_verified:false}},data:{tenantId,
 expectedTenantId:tenantId,operationId:randomUUID()}};
const protectedActions=[
 ["staff-admin","listTenantStaff"],
 ["retail-pos-staff","upsertRetailPosStaff"],
 ["operational-orders","settleTableSession"],
 ["revenue-share","getTenantRevenueShareAccess"],
 ["revenue-share","submitTenantRevenueSharePayment"],
 ["tenant-lalamove-wallet","getOwnTenantLalamoveWallet"],
 ["tenant-lalamove-wallet","submitTenantLalamoveWalletTopup"],
 ["tenant-telegram","saveTenantTelegramSettings"],
 ["platform-settings","updatePlatformBranding"],
 ["subscription-pricing","updateSubscriptionPricing"],
 ["hybrid-billing-payment-callables","submitTenantHybridPaymentProof"],
 ["stripe-wallet-sandbox-checkout","createStripeWalletSandboxCheckout"],
 ["public-signup","activateTrialTenantSignup"],
 ["tenant-admin","listTenants"],
 ["tenant-provision","createActiveTenantWithOwner"],
 ["payment-companion","getPaymentCompanionDashboard"],
];
test("seed locally only: managed Owner, native Auth unverified and immutable financial snapshot",async()=>{
 await db.collection("users").doc(uid).set({
  uid,active:true,role:"owner",tenantId,emailVerificationRequired:true});
 await db.collection("users").doc(legacyUid).set({
  uid:legacyUid,active:true,role:"owner",tenantId});
 await nativeAuth.createUser({uid,email:"p13e-"+randomUUID()+"@example.test",
  password:"EmulatorOnlyPassword1234!",emailVerified:false});
 await db.collection("tenants").doc(tenantId).set({
  id:tenantId,ownerUid:uid,slug:"p13e-test-shop",active:true,
  firstActivatedAt:"2026-10-18",planCode:"yearly",
  trialEndsAt:"2026-11-17",subscriptionExpiresAt:"2027-11-17",
  m7InvoiceUnpaidCents:54321});
});
test("all representative privileged Callable families fail before handler or financial mutation",async()=>{
 const tenantBefore=(await db.collection("tenants").doc(tenantId).get()).data();
 let probed=0;
 for(const [file,exportName] of protectedActions){
  const mod=require("./"+file+".js");
  const handler=mod[exportName];
  if(!handler?.run)throw Error("MISSING_CALLABLE:"+file+"."+exportName);
  await assert.rejects(
   handler.run(actor),error=>{
    assert.equal(error.code,"permission-denied",file+"."+exportName);
    assert.equal(error.message,"MANAGED_EMAIL_VERIFICATION_REQUIRED",
      file+"."+exportName+" blocked by own handler instead of global preflight");
    return true;
   },file+"."+exportName);
  probed++;
 }
 assert.equal(probed,protectedActions.length);
 const tenantAfter=(await db.collection("tenants").doc(tenantId).get()).data();
 assert.deepEqual(tenantAfter,tenantBefore,"Blocked calls must not change any financial state");
 assert.equal((await nativeAuth.getUser(uid)).emailVerified,false);
});
test("legacy/public callers keep downstream API behavior; verified native token passes shared gate",async()=>{
 const pricing=require("./subscription-pricing.js");
 const publicly=await pricing.getPublicSubscriptionPricing.run({data:{}});
 assert.ok(publicly&&typeof publicly==="object",
  "public pricing must remain accessible without managed login");
 const old=await pricing.getPublicSubscriptionPricing.run({
  auth:{uid:legacyUid,token:{email_verified:false}},data:{}});
 assert.ok(old&&typeof old==="object");
 await assert.rejects(pricing.getPublicSubscriptionPricing.run(actor),
  error=>error.code==="permission-denied"&&
    error.message==="MANAGED_EMAIL_VERIFICATION_REQUIRED");
 await nativeAuth.updateUser(uid,{emailVerified:true});
 const verified=await nativeAuth.getUser(uid);
 assert.equal(verified.emailVerified,true);
 const result=await pricing.getPublicSubscriptionPricing.run({
  auth:{uid,token:{email_verified:true}},data:{}});
 assert.ok(result&&typeof result==="object",
  "A genuine verified Auth token should reach the original public handler");
});
