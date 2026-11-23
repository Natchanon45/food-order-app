import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
const fromHere=createRequire(import.meta.url);
const api=fromHere("../../functions/tenant-provision-status.js")._privateForTests;
const backend=fromHere("../../functions/tenant-provision.js");
const policy=backend._privateForTests;
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||"")||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||""))
 throw Error("TENANT_PROVISION_STATUS_REQUIRES_DEMO_FIRESTORE_AND_AUTH_EMULATORS");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),nativeAuth=getAuth();
const superadmin="p12-super-"+randomUUID(),otherAdmin="p12-other-"+randomUUID(),
 merchant="p12-merchant-"+randomUUID(),inactive="p12-inactive-"+randomUUID();
const prefix="p12-recover-"+randomUUID().slice(0,6);
const createId=()=>randomUUID();
const profile=uid=>({uid});
const read=(uid,operationId)=>api.inspect({
 db,auth:nativeAuth,identity:profile(uid),data:{operationId},
});
const input=(slugSuffix="a",ownerSuffix="a")=>({
 operationId:createId(),name:"P1.2 Canonical New Store "+slugSuffix,
 slug:prefix+"-"+slugSuffix,phone:"021234567",address:"Bangkok, Thailand",
 businessType:"both",ownerName:"Merchant Owner "+ownerSuffix,
 ownerEmail:prefix+"-"+ownerSuffix+"@example.test",
 ownerPassword:"UAT-only-Password-"+ownerSuffix+"!",
 planCode:"yearly",
});
test("setup isolated demo Auth + Firestore, canonical pricing; block any access before superadmin",async()=>{
 await Promise.all([
  db.collection("users").doc(superadmin).set({role:"super_admin",active:true}),
  db.collection("users").doc(otherAdmin).set({role:"super_admin",active:true}),
  db.collection("users").doc(merchant).set({role:"owner",active:true}),
  db.collection("users").doc(inactive).set({role:"super_admin",active:false}),
  db.collection("platformSettings").doc("subscriptionPricing").set({
   planId:"premium",monthlyPrice:590,deliveryThreshold:10000,
   deliveryShareRate:5,annualMonths:12,monthlySlipQuota:100,
  }),
 ]);
 const missing=createId();
 await assert.rejects(read(merchant,missing),e=>e.code==="permission-denied");
 await assert.rejects(read(inactive,missing),e=>e.code==="permission-denied");
 await assert.rejects(api.inspect({db,auth:nativeAuth,
  identity:null,data:{operationId:missing}}),e=>e.code==="unauthenticated");
 await assert.rejects(api.inspect({db,auth:nativeAuth,
  identity:profile(superadmin),data:{operationId:missing,tenantId:"another"}}),
  e=>e.code==="invalid-argument");
 const absent=await read(superadmin,missing);
 assert.equal(absent.status,"not_found");
 assert.equal(absent.tenantActivated,false);
 assert.equal(absent.mayRetryWithNewOperationId,false);
 assert.equal(absent.canIssueInvoice,false);
});
test("atomic create → Auth + tenant + slug + membership + store account → independent verified reconciliation",async()=>{
 const payload=input("success","success");
 const request={auth:profile(superadmin),data:payload};
 const created=await backend.createActiveTenantWithOwner.run(request);
 assert.equal(created.ok,true);
 assert.equal(created.tenantActivated,true);
 assert.equal(created.idempotent,false);
 const status=await read(superadmin,payload.operationId);
 assert.deepEqual(status.tenant,{
  id:created.tenant.id,name:payload.name,slug:payload.slug,planCode:"yearly",
 });
 assert.deepEqual(status.owner,{uid:created.owner.uid,role:"owner"});
 assert.equal(status.status,"complete_verified");
 assert.equal(status.tenantActivated,true);
 assert.equal(status.canSettleMoney,false);
 assert.equal(status.canReleaseTenant,false);
 assert.equal(status.canIssueInvoice,false);
 assert.equal(status.readOnly,true);
 assert.equal(status.mayRetryWithNewOperationId,false);
 assert.equal(JSON.stringify(status).includes(payload.ownerPassword),false);
 assert.equal(JSON.stringify(status).includes(payload.ownerEmail),false);
 const replay=await backend.createActiveTenantWithOwner.run(request);
 assert.equal(replay.idempotent,true);
 assert.equal(replay.owner.uid,created.owner.uid);
 assert.equal((await read(superadmin,payload.operationId)).status,"complete_verified");
 await assert.rejects(read(otherAdmin,payload.operationId),
  e=>e.code==="permission-denied");
 const user=await nativeAuth.getUser(created.owner.uid);
 assert.equal(user.email,payload.ownerEmail);
 assert.equal(user.emailVerified,false);
});
test("canonical verification fails closed on missing membership, missing Auth, tampered Owner, invalid tenant",async()=>{
 const data=input("tamper","tamper");
 const created=await backend.createActiveTenantWithOwner.run({
  auth:profile(superadmin),data,
 });
 const ref=db.collection("tenants").doc(created.tenant.id);
 const m=ref.collection("memberships").doc(created.owner.uid);
 const member=(await m.get()).data();
 assert.equal((await read(superadmin,data.operationId)).status,"complete_verified");
 await m.delete();
 assert.equal((await read(superadmin,data.operationId)).status,"review_required");
 await m.set(member);
 assert.equal((await read(superadmin,data.operationId)).status,"complete_verified");
 const profileRef=db.collection("users").doc(created.owner.uid);
 await profileRef.update({tenantId:"wrong-tenant"});
 assert.equal((await read(superadmin,data.operationId)).status,"review_required");
 await profileRef.update({tenantId:created.tenant.id});
 const tenantBefore=(await ref.get()).data();
 await ref.update({active:false});
 assert.equal((await read(superadmin,data.operationId)).status,"review_required");
 await ref.update({active:true});
 assert.equal((await read(superadmin,data.operationId)).status,"complete_verified");
 await ref.update({signupBilling:{planCode:"yearly-tampered"}});
 assert.equal((await read(superadmin,data.operationId)).status,"review_required");
 await ref.update({signupBilling:tenantBefore.signupBilling});
 assert.equal((await read(superadmin,data.operationId)).status,"complete_verified");
 await ref.update({trialStartsAt:tenantBefore.trialEndsAt});
 assert.equal((await read(superadmin,data.operationId)).status,"review_required");
 await ref.update({trialStartsAt:tenantBefore.trialStartsAt});
 assert.equal((await read(superadmin,data.operationId)).status,"complete_verified");
 await nativeAuth.updateUser(created.owner.uid,{disabled:true});
 assert.equal((await read(superadmin,data.operationId)).status,"review_required");
 await nativeAuth.updateUser(created.owner.uid,{disabled:false});
 assert.equal((await read(superadmin,data.operationId)).status,"complete_verified");
 assert.equal(tenantBefore.firstActivatedAt.toMillis(),
  (await ref.get()).data().firstActivatedAt.toMillis());
});
test("definitive duplicate email rejection rolls Auth back without releasing an existing owner or changing its tenant",async()=>{
 const existing=await nativeAuth.createUser({
  email:prefix+"-existing@example.test",password:"Example-pass-12345!",
 });
 const data=input("dupemail","dupemail");
 data.ownerEmail=existing.email;
 await assert.rejects(backend.createActiveTenantWithOwner.run({
  auth:profile(superadmin),data,
 }),e=>e.code==="already-exists");
 const status=await read(superadmin,data.operationId);
 assert.equal(status.status,"failed_released");
 assert.equal(status.mayRetryWithNewOperationId,true);
 assert.equal(status.tenantActivated,false);
 assert.equal(status.reason,"AUTH_CREATE_DEFINITIVE_REJECTION");
 assert.equal((await db.collection("tenantSlugs").doc(data.slug).get()).exists,false);
 assert.equal((await nativeAuth.getUser(existing.uid)).email,existing.email);
 assert.equal(policy.definitiveAuthCreateRejection({code:"auth/email-already-exists"}),true);
 for(const failure of ["auth/internal-error","auth/network-request-failed",
  "auth/unknown-error","ECONNRESET","deadline-exceeded"]){
  assert.equal(policy.definitiveAuthCreateRejection({code:failure}),false,
   "must leave ambiguous Auth operation reserved: "+failure);
 }
});
test("reserved unknown Auth outcome stays in review, not the safe-to-retry state",async()=>{
 const operationId=createId(),tenantId=createId(),slug=prefix+"-unknown";
 const opRef=db.collection("platformTenantProvisions").doc(operationId);
 const slugRef=db.collection("tenantSlugs").doc(slug);
 await Promise.all([
  opRef.set({status:"reserved",createdBy:superadmin,
   fingerprint:"a".repeat(64),tenantId,slug,planCode:"monthly"}),
  slugRef.set({tenantId,slug,active:false,provisioningId:operationId}),
 ]);
 const status=await read(superadmin,operationId);
 assert.equal(status.status,"pending_review");
 assert.equal(status.mayRetryWithNewOperationId,false);
 assert.equal((await slugRef.get()).exists,true);
 assert.equal((await opRef.get()).data().status,"reserved");
 await opRef.update({status:"unknown_internal_state"});
 assert.equal((await read(superadmin,operationId)).status,"review_required");
});
test("failed_released is only retryable when it is genuinely terminal and no slug/tenant remains",async()=>{
 const operationId=createId(),tenantId=createId(),slug=prefix+"-release-inconsistent";
 const opRef=db.collection("platformTenantProvisions").doc(operationId);
 await opRef.set({status:"failed_released",createdBy:superadmin,
   releaseReason:"AUTH_DELETED_CONFIRMED",slug,tenantId});
 assert.equal((await read(superadmin,operationId)).status,"failed_released");
 const slugRef=db.collection("tenantSlugs").doc(slug);
 await slugRef.set({tenantId,slug,provisioningId:operationId});
 assert.equal((await read(superadmin,operationId)).status,"review_required");
 await slugRef.delete();
 await db.collection("tenants").doc(tenantId).set({slug,name:"Incomplete"});
 assert.equal((await read(superadmin,operationId)).status,"review_required");
});
test("five concurrent requests with the SAME operation UUID activate exactly one Owner and tenant",async()=>{
 const data=input("concurrent","concurrent");
 const runs=await Promise.allSettled(Array.from({length:5},()=>backend.createActiveTenantWithOwner.run({
  auth:profile(superadmin),data,
 })));
 const success=runs.filter(x=>x.status==="fulfilled").map(x=>x.value);
 assert.ok(success.length>=1&&success.length<=5);
 const tenants=await db.collection("tenants").where("slug","==",data.slug).get();
 assert.equal(tenants.size,1);
 const slugs=await db.collection("tenantSlugs").doc(data.slug).get();
 assert.equal(slugs.data().tenantId,tenants.docs[0].id);
 const status=await read(superadmin,data.operationId);
 assert.equal(status.status,"complete_verified");
 for(const row of success){
  assert.equal(row.tenant.id,status.tenant.id);
  assert.equal(row.owner.uid,status.owner.uid);
 }
 const owner=await nativeAuth.getUser(status.owner.uid);
 assert.equal(owner.email,data.ownerEmail);
 assert.equal((await db.collection("tenants").doc(status.tenant.id)
  .collection("memberships").get()).size,1);
});

test("simultaneous different operation UUIDs for the SAME slug cannot create duplicate tenants or owners",async()=>{
 const data=input("raceslug","raceslug");
 const attempts=Array.from({length:4},(_,n)=>({
  ...data,operationId:createId(),
  ownerEmail:prefix+"-race-owner-"+n+"@example.test",
  ownerName:"Owner Race "+n,
 }));
 const runs=await Promise.allSettled(attempts.map(data=>
  backend.createActiveTenantWithOwner.run({auth:profile(superadmin),data})));
 const successes=runs.filter(r=>r.status==="fulfilled").map(r=>r.value);
 assert.equal(successes.length,1);
 const canonical=await db.collection("tenants").where("slug","==",data.slug).get();
 assert.equal(canonical.size,1);
 assert.equal(canonical.docs[0].data().ownerUid,successes[0].owner.uid);
 const index=await db.collection("tenantSlugs").doc(data.slug).get();
 assert.equal(index.data().tenantId,successes[0].tenant.id);
 assert.equal(runs.filter(r=>r.status==="rejected").length,3);
 for(let n=0;n<4;n++){
  const recorded=await read(superadmin,attempts[n].operationId);
  assert.ok(["not_found","complete_verified","pending_review",
    "failed_released"].includes(recorded.status));
  if(recorded.status==="complete_verified")
   assert.equal(recorded.tenant.id,successes[0].tenant.id);
 }
});
test("legacy store without tenantSlugs index blocks a colliding new owner and leaves original untouched",async()=>{
 const data=input("legacy","legacy");
 const legacyRef=db.collection("tenants").doc(randomUUID());
 await legacyRef.set({name:"Historical Merchant",slug:data.slug,active:true});
 await assert.rejects(backend.createActiveTenantWithOwner.run({
  auth:profile(superadmin),data,
 }),e=>e.code==="already-exists");
 assert.equal((await db.collection("platformTenantProvisions").doc(data.operationId).get()).exists,false);
 assert.equal((await db.collection("tenantSlugs").doc(data.slug).get()).exists,false);
 assert.equal((await legacyRef.get()).data().name,"Historical Merchant");
});


test("even a logged-in Superadmin browser cannot read or mutate the server-only provision receipts",async()=>{
 const {initializeApp:clientApp,deleteApp}=await import("firebase/app");
 const {getAuth:clientAuth,connectAuthEmulator,signInWithEmailAndPassword}=await import("firebase/auth");
 const {getFirestore:clientDb,connectFirestoreEmulator,
  getDoc:setGet,setDoc:write,doc:clientRef}=await import("firebase/firestore");
 const uid="p12-client-"+randomUUID(),email=prefix+"-client@example.test";
 const password="Only-in-emulator-Client-123!";
 await nativeAuth.createUser({uid,email,password});
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 const app=clientApp({apiKey:"demo-api",appId:"1:123:web:"+randomUUID(),
  projectId:"demo-penguin-hybrid",authDomain:"demo-penguin-hybrid.firebaseapp.com"},
  "p12-client-"+randomUUID());
 try{
  const auth=clientAuth(app);
  connectAuthEmulator(auth,"http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST,
   {disableWarnings:true});
  await signInWithEmailAndPassword(auth,email,password);
  const firestore=clientDb(app);
  const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(firestore,host,Number(port));
  const target=clientRef(firestore,"platformTenantProvisions",createId());
  await assert.rejects(setGet(target),error=>
   /permission-denied/i.test(String(error.code||"")));
  await assert.rejects(write(target,{status:"complete",ownerUid:"forged"}),
   error=>/permission-denied/i.test(String(error.code||"")));
 }finally{await deleteApp(app);}
});
