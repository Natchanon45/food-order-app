import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8189"||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099")
 throw Error("P23_DEMO_FIREBASE_AUTH_FIRESTORE_EMULATORS_REQUIRED");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),adminAuth=getAuth();
const signup=require("./public-signup");
const uniq=randomUUID().replace(/-/g,"").slice(0,9);
const request=signup.requestTrialTenantSignup;
const activate=signup.activateTrialTenantSignup;
const payload=(email,slug,other={})=>({
 packageId:"premium",billingMode:"subscription",businessType:"restaurant_cafe",
 planCode:"yearly",ownerName:"P23 Owner",phone:"0812345678",
 orderDeliveryShopName:"P23 ร้านอาหาร",retailPosShopName:"",
 slug,email,...other,
});
async function identity(key){
 const uid="p23-"+key+"-"+uniq,email=key+"-"+uniq+"@example.test";
 await adminAuth.createUser({uid,email,password:"OnlyLocalDemoPassword123!",emailVerified:false});
 return {uid,email,auth:{uid,token:{email,email_verified:false}}};
}
async function run(id,value){return request.run({auth:id?.auth,data:value});}
async function turnOn(id){
 await adminAuth.updateUser(id.uid,{emailVerified:true});
}
test("P2.3 public Signup requires auth, verified token email equality, and supported billing policy",async()=>{
 const id=await identity("invalid");
 const key="p23-unsafe-"+uniq;
 await assert.rejects(request.run({data:payload(id.email,key)}),{code:"unauthenticated"});
 await assert.rejects(run(id,payload("attacker@example.test",key)),{code:"permission-denied"});
 for(const billingMode of ["hybrid","revenue_share"]){
  await assert.rejects(run(id,payload(id.email,key,{billingMode})),
   {code:"invalid-argument"});
 }
 assert.equal((await db.collection("publicTenantSignupSlugs").doc(key).get()).exists,false);
});
test("P2.3 same Owner can correct pending slug atomically while competitor cannot steal current reservation",async()=>{
 const owner=await identity("correct"),other=await identity("competitor");
 const oldSlug="p23-old-"+uniq,updatedSlug="p23-current-"+uniq;
 await run(owner,payload(owner.email,oldSlug));
 await assert.rejects(run(other,payload(other.email,oldSlug)),{code:"already-exists"});
 await run(owner,payload(owner.email,updatedSlug));
 assert.equal((await db.collection("publicTenantSignupSlugs").doc(oldSlug).get()).exists,false,
  "old same-owner unactivated slug must be released");
 const current=(await db.collection("publicTenantSignupSlugs").doc(updatedSlug).get()).data();
 assert.equal(current.uid,owner.uid);
 assert.equal(current.status,"pending");
 await run(other,payload(other.email,oldSlug));
 assert.equal((await db.collection("publicTenantSignupSlugs").doc(oldSlug).get()).data().uid,other.uid);
 await assert.rejects(run(other,payload(other.email,updatedSlug)),{code:"already-exists"});
 const pending=(await db.collection("publicTenantSignups").doc(owner.uid).get()).data();
 assert.equal(pending.slug,updatedSlug);
 assert.equal(pending.status,"email_verification_required");
});
test("P2.3 verification creates exactly one Tenant, Owner and 30-day trial, repeated activation returns same tenant",async()=>{
 const owner=await identity("activate"),slug="p23-activated-"+uniq;
 await run(owner,payload(owner.email,slug));
 await assert.rejects(activate.run({auth:owner.auth,data:{}}),{code:"failed-precondition"});
 assert.equal((await db.collection("tenantSlugs").doc(slug).get()).exists,false);
 await turnOn(owner);
 const first=await activate.run({auth:{uid:owner.uid,token:{
  email:owner.email,email_verified:true}},data:{}});
 assert.equal(first.ok,true);assert.equal(first.slug,slug);
 assert.equal(first.planCode,"yearly");assert.equal(first.billingMode,"subscription");
 const tenantId=first.tenantId,tenantRef=db.collection("tenants").doc(tenantId);
 const record=(await tenantRef.get()).data();
 assert.equal(record.ownerUid,owner.uid);assert.equal(record.active,true);
 assert.equal(record.businessType,"restaurant_cafe");
 assert.deepEqual(record.businessUnits,["order_delivery"]);
 assert.equal(record.subscriptionStatus,"trialing");
 assert.ok(record.trialEndsAt.toMillis()>Date.now());
 const durationDays=(record.trialEndsAt.toMillis()-record.trialStartsAt.toMillis())/86400000;
 assert.ok(durationDays>=29.999&&durationDays<=30.01,"trial 30 days starting from activation");
 const membership=(await tenantRef.collection("memberships").doc(owner.uid).get()).data();
 const profile=(await db.collection("users").doc(owner.uid).get()).data();
 assert.equal(membership.role,"owner");assert.equal(profile.tenantId,tenantId);
 assert.equal((await tenantRef.collection("settings").doc("store").get()).data().shopName,"P23 ร้านอาหาร");
 const again=await activate.run({auth:{uid:owner.uid,token:{
  email:owner.email,email_verified:true}},data:{}});
 assert.equal(again.tenantId,tenantId);
 assert.equal(again.trialEndsAt,first.trialEndsAt);
 await assert.rejects(run(owner,payload(owner.email,"p23-second-"+uniq)),
  {code:"failed-precondition"});
 assert.equal((await db.collection("publicTenantSignupSlugs").doc("p23-second-"+uniq).get()).exists,false);
 assert.equal((await db.collection("tenantSlugs").doc(slug).get()).data().tenantId,tenantId);
});
test("P2.3 existing active staff cannot create public pending Tenant even without an existing pending signup",async()=>{
 const staff=await identity("staff");
 await db.collection("users").doc(staff.uid).set({
  uid:staff.uid,role:"admin",tenantId:"another",active:true,
 });
 const slug="p23-staff-"+uniq;
 await assert.rejects(run(staff,payload(staff.email,slug)),
  {code:"failed-precondition"});
 assert.equal((await db.collection("publicTenantSignups").doc(staff.uid).get()).exists,false);
 assert.equal((await db.collection("publicTenantSignupSlugs").doc(slug).get()).exists,false);
 // Suspended/revoked staff remains owned by a Tenant; public signup must
 // not provide a backdoor around billing or role suspension.
 await db.collection("users").doc(staff.uid).update({active:false});
 await assert.rejects(run(staff,payload(staff.email,slug)),
  {code:"failed-precondition"});
 assert.equal((await db.collection("publicTenantSignups").doc(staff.uid).get()).exists,false);
});
test("P2.3 changed Firebase Auth email cannot activate a signup reserved under an old identity",async()=>{
 const id=await identity("changed"),slug="p23-email-"+uniq;
 await run(id,payload(id.email,slug));
 await adminAuth.updateUser(id.uid,{email:"replacement-"+uniq+"@example.test",emailVerified:true});
 await assert.rejects(activate.run({auth:{uid:id.uid,token:{
  email:"replacement-"+uniq+"@example.test",email_verified:true}},data:{}}),
  {code:"permission-denied"});
 assert.equal((await db.collection("tenantSlugs").doc(slug).get()).exists,false);
 assert.equal((await db.collection("publicTenantSignups").doc(id.uid).get()).data().status,
  "email_verification_required");
});
test("P2.3 removed/fraudulent reservation or stale pending slug is not promoted to active Tenant",async()=>{
 const id=await identity("stale"),slug="p23-stale-"+uniq;
 await run(id,payload(id.email,slug));
 await turnOn(id);
 await db.collection("publicTenantSignupSlugs").doc(slug).delete();
 await assert.rejects(activate.run({auth:{uid:id.uid,token:{
  email:id.email,email_verified:true}},data:{}}),{code:"permission-denied"});
 assert.equal((await db.collection("tenantSlugs").doc(slug).get()).exists,false);
 assert.equal((await db.collection("users").doc(id.uid).get()).exists,false);
});
