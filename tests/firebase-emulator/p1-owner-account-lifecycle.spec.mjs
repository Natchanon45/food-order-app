import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {getApps,initializeApp}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
const api=require("./tenant-owner-operation");
const legacy=require("./tenant-admin");
const policy=require("./tenant-owner-operation-policy");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||"")||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||""))
 throw Error("P13C_OWNER_REQUIRES_ISOLATED_DEMO_FIREBASE_EMULATORS");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),nativeAuth=getAuth(),suffix=randomUUID().slice(0,8);
const admin="p13c-admin-"+randomUUID(),other="p13c-other-"+randomUUID(),
 actor={uid:admin};
const id=()=>randomUUID();
const ref=tenantId=>db.collection("tenants").doc(tenantId);
const slug=slug=>db.collection("tenantSlugs").doc(slug);
const user=uid=>db.collection("users").doc(uid);
const createInput=(t,patch={})=>({
 tenantId:t.id,operationId:id(),expectedSlug:t.slug,expectedName:t.name,
 expectedRevision:t.ownerRevision??0,expectedOnboardingRequired:t.onboardingRequired===true,
 planCode:t.onboardingRequired===true?"yearly":"",
 displayName:"Owner Name",email:"owner-"+id()+"@example.test",
 password:"DemoOnlyOwnerPassword123!",...patch,
});
const editInput=(t,patch={})=>({
 tenantId:t.id,operationId:id(),ownerUid:t.ownerUid,
 expectedRevision:t.ownerRevision??0,
 expectedDisplayName:t.ownerDisplayName,displayName:"New Owner Name",
 ...patch,
});
const create=data=>legacy.createTenantOwner.run({auth:actor,data});
const update=data=>legacy.updateTenantOwner.run({auth:actor,data});
const inspect=(data,uid=admin)=>api.getPlatformTenantOwnerOperation.run({
 auth:{uid},data:{tenantId:data.tenantId,operationId:data.operationId}});
const originalFinance={m7InvoiceUnpaidCents:900099,bankAccountNumber:"1212121212",
 revenueShareSuspended:true,subscriptionPaidUntil:"2027-08-31T16:59:59Z"};
const makeShop=async(pristine=true)=>{
 const tenantId="p13c-tenant-"+id(),publicSlug="p13c-"+id().slice(0,8);
 const storeName="Test Restaurant";
 const base={id:tenantId,name:storeName,slug:publicSlug,ownerRevision:0,
  active:!pristine,...(pristine?{onboardingRequired:true}:{}),createdBy:admin,
  ...(pristine?{}:{
   planCode:"yearly",subscriptionStatus:"active",
   firstActivatedAt:"2026-10-18T03:30:00Z",
   trialStartsAt:"2026-10-18T03:30:00Z",
   trialEndsAt:"2026-11-17T16:59:59Z",
   subscriptionStartedAt:"2026-10-18T03:30:00Z",
   subscriptionExpiresAt:"2027-11-17T16:59:59Z",
   signupBilling:{planCode:"yearly",businessType:"both",billingMode:"subscription"},
   ...originalFinance,
  })};
 await Promise.all([
  ref(tenantId).set(base),
  slug(publicSlug).set({tenantId,slug:publicSlug,name:storeName,active:!pristine}),
  ref(tenantId).collection("settings").doc("store").set({
   tenantId,shopName:storeName,shopPhone:"021234567",
   shopAddress:"Bangkok",bankAccountNumber:"1111111111"}),
 ]);
 return base;
};
let placeholder,attached,ownerUid;
test("seed pricing, source-equivalent placeholder, active historical tenant and authorized/foreign accounts",async()=>{
 await Promise.all([
  user(admin).set({uid:admin,role:"super_admin",active:true}),
  user(other).set({uid:other,role:"super_admin",active:true}),
  db.collection("platformSettings").doc("subscriptionPricing").set({
   planId:"premium",monthlyPrice:590,deliveryThreshold:10000,
   deliveryShareRate:5,annualMonths:12,monthlySlipQuota:100}),
 ]);
 [placeholder,attached]=await Promise.all([makeShop(true),makeShop(false)]);
});
test("deny unauthenticated, unknown, non-Superadmin and invalid command before reservation",async()=>{
 const input=createInput(placeholder);
 await assert.rejects(api.createTenantOwner.run({data:input}),e=>e.code==="unauthenticated");
 await assert.rejects(api.createTenantOwner.run({auth:{uid:"not-authorized"},data:input}),
  e=>e.code==="permission-denied");
 await assert.rejects(create({...input,expectedSlug:"different-slug"}),
  e=>e.code==="failed-precondition");
 await assert.rejects(create({...input,planCode:"forever"}),
  e=>e.code==="invalid-argument");
 await assert.rejects(create({...input,ownerUid:"hijack"}),
  e=>e.code==="invalid-argument");
 assert.equal((await ref(placeholder.id).collection("ownerAccountOperations")
   .doc(input.operationId).get()).exists,false);
});
test("attach Owner on pristine placeholder and begin first trial exactly once at commit",async()=>{
 const input=createInput(placeholder);
 const result=await create(input);
 assert.equal(result.ok,true);
 assert.equal(result.emailSent,false);
 assert.equal(result.pendingIndependentVerification,true);
 assert.equal(result.ownerUid,policy.uidFor(input.operationId));
 ownerUid=result.ownerUid;
 const tenant=(await ref(placeholder.id).get()).data();
 assert.equal(tenant.ownerUid,ownerUid);
 assert.equal(tenant.onboardingRequired,false);
 assert.equal(tenant.active,true);
 assert.equal(tenant.planCode,"yearly");
 assert.equal(tenant.subscriptionStatus,"trialing");
 assert.equal(tenant.ownerRevision,1);
 assert.equal(tenant.signupBilling.planCode,"yearly");
 assert.equal(tenant.firstActivatedAt.toMillis(),tenant.trialStartsAt.toMillis());
 assert.ok(tenant.trialEndsAt.toMillis()>tenant.trialStartsAt.toMillis());
 assert.ok(tenant.subscriptionExpiresAt.toMillis()>tenant.trialEndsAt.toMillis());
 const native=(await nativeAuth.getUser(ownerUid));
 assert.equal(native.email,input.email);
 assert.equal(native.displayName,input.displayName);
 assert.equal(native.emailVerified,false);
 const account=(await user(ownerUid).get()).data();
 const member=(await ref(placeholder.id).collection("memberships").doc(ownerUid).get()).data();
 assert.equal(account.role,"owner");
 assert.equal(member.tenantId,placeholder.id);
 assert.equal((await slug(placeholder.slug).get()).data().ownerUid,ownerUid);
 const saved=(await ref(placeholder.id).collection("ownerAccountOperations").doc(input.operationId).get()).data();
 assert.equal(saved.status,"complete");
 assert.equal(JSON.stringify(saved).includes(input.password),false);
 const status=await inspect(input);
 assert.equal(status.status,"complete_verified");
 assert.equal(status.ownerRevision,1);
 assert.equal(status.emailSent,false);
 assert.equal(status.canChangeSubscription,false);
 assert.equal(JSON.stringify(status).includes(input.email),false);
 await assert.rejects(create(input),e=>e.code==="already-exists");
 await assert.rejects(create(createInput(placeholder)),e=>e.code==="already-exists"||e.code==="failed-precondition");
 assert.equal((await ref(placeholder.id).get()).data().firstActivatedAt.toMillis(),
    tenant.firstActivatedAt.toMillis());
});
test("Owner rename updates Auth and both profiles, CAS revision, tenant and no trial/billing",async()=>{
 const before=(await ref(placeholder.id).get()).data();
 const input=editInput(before);
 const result=await update(input);
 assert.equal(result.ok,true);
 assert.equal(result.pendingIndependentVerification,true);
 assert.equal((await inspect(input)).status,"complete_verified");
 const after=(await ref(placeholder.id).get()).data();
 assert.equal(after.ownerRevision,2);
 assert.equal(after.ownerDisplayName,"New Owner Name");
 assert.equal(policy.billingDigest(after),policy.billingDigest(before));
 assert.equal((await nativeAuth.getUser(ownerUid)).displayName,"New Owner Name");
 assert.equal((await user(ownerUid).get()).data().displayName,"New Owner Name");
 assert.equal((await ref(placeholder.id).collection("memberships")
  .doc(ownerUid).get()).data().displayName,"New Owner Name");
 await assert.rejects(update(input),e=>e.code==="already-exists");
 await assert.rejects(update({...editInput(after),expectedRevision:1}),
   e=>e.code==="failed-precondition");
 const next=editInput(after,{displayName:"Owner Renamed Again"});
 await update(next);
 assert.equal((await inspect(next)).status,"complete_verified");
 assert.equal((await ref(placeholder.id).get()).data().ownerRevision,3);
});
test("attach Owner on already activated ownerless Tenant without starting a new trial or charging history",async()=>{
 const before=(await ref(attached.id).get()).data();
 const input=createInput(attached,{displayName:"Legacy Owner"});
 const digest=policy.billingDigest(before);
 const result=await create(input);
 assert.equal(result.ok,true);
 const after=(await ref(attached.id).get()).data();
 assert.equal(after.ownerUid,result.ownerUid);
 assert.equal(after.ownerRevision,1);
 assert.equal(after.firstActivatedAt,before.firstActivatedAt);
 assert.equal(after.subscriptionExpiresAt,before.subscriptionExpiresAt);
 assert.equal(after.signupBilling.planCode,"yearly");
 assert.equal(after.m7InvoiceUnpaidCents,900099);
 assert.equal(after.revenueShareSuspended,true);
 assert.equal(policy.billingDigest(after),digest);
 assert.equal((await inspect(input)).status,"complete_verified");
});
test("two concurrent requests for the same placeholder create only one Owner",async()=>{
 const t=await makeShop(true),a=createInput(t),b=createInput(t);
 const outcomes=await Promise.allSettled([create(a),create(b)]);
 assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(outcomes.filter(x=>x.status==="rejected").length,1);
 const winner=outcomes.find(x=>x.status==="fulfilled").value;
 assert.equal((await ref(t.id).get()).data().ownerUid,winner.ownerUid);
 assert.equal((await ref(t.id).collection("memberships").get()).size,1);
});
test("definitive existing Auth email rejection releases receipt and lock, without deleting someone else's Auth",async()=>{
 const t=await makeShop(true);
 const email="preexisting-"+suffix+"@example.test";
 await nativeAuth.createUser({uid:"existing-"+id(),email,password:"DemoOnlyOwnerPassword123!"});
 const data=createInput(t,{email});
 await assert.rejects(create(data),e=>e.code==="already-exists");
 const status=await inspect(data);
 assert.equal(status.status,"failed_released");
 assert.equal(status.mayRetryWithNewOperationId,true);
 assert.equal((await ref(t.id).get()).data().ownerUid,undefined);
 assert.equal((await ref(t.id).collection("ownerAccountLocks").doc("current").get()).exists,false);
 assert.equal((await db.collection("ownerEmailReservations").doc(policy.emailHash(email)).get()).exists,false);
});
test("unknown/reserved/partial operation always stays locked and cannot falsely confirm",async()=>{
 const t=await makeShop(true),data=createInput(t);
 assert.equal((await inspect(data)).status,"not_found");
 const op=ref(t.id).collection("ownerAccountOperations").doc(data.operationId);
 await op.set({operationId:data.operationId,tenantId:t.id,kind:"create",
  actor:admin,status:"reserved",ownerUid:policy.uidFor(data.operationId),
  afterName:data.displayName,email:data.email,slug:t.slug,ownerRevision:1});
 await ref(t.id).collection("ownerAccountLocks").doc("current").set({
  operationId:data.operationId,actor:admin});
 await db.collection("ownerEmailReservations").doc(policy.emailHash(data.email)).set({
  operationId:data.operationId,tenantId:t.id,status:"reserved"});
 assert.equal((await inspect(data)).status,"pending_review");
 await nativeAuth.createUser({uid:policy.uidFor(data.operationId),
  email:data.email,password:data.password,displayName:data.displayName});
 assert.equal((await inspect(data)).status,"review_required");
 await assert.rejects(create(createInput(t)),e=>e.code==="already-exists");
 await assert.rejects(inspect(data,other),e=>e.code==="permission-denied");
});
test("browser Superadmin cannot forge or read private Owner operations, locks or global email claims",async()=>{
 const {initializeApp:clientApp,deleteApp}=await import("firebase/app");
 const {getAuth:clientAuth,connectAuthEmulator,signInWithEmailAndPassword}=
  await import("firebase/auth");
 const {getFirestore:clientDb,connectFirestoreEmulator,getDoc,setDoc,doc:clientRef}=
  await import("firebase/firestore");
 const uid="p13c-client-"+id(),email="p13c-client-"+suffix+"@example.test";
 await nativeAuth.createUser({uid,email,password:"DemoOnlyOwnerPassword123!"});
 await user(uid).set({uid,role:"super_admin",active:true});
 const app=clientApp({apiKey:"demo-api-key",projectId:"demo-penguin-hybrid",
   appId:"1:123:web:"+id(),authDomain:"demo-penguin-hybrid.firebaseapp.com"},
   "p13c-"+id());
 try{
  const localAuth=clientAuth(app);
  connectAuthEmulator(localAuth,"http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST,
   {disableWarnings:true});
  await signInWithEmailAndPassword(localAuth,email,"DemoOnlyOwnerPassword123!");
  const fs=clientDb(app),[host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(fs,host,Number(port));
  for(const location of [
   ["ownerEmailReservations",policy.emailHash("not-allowed@example.test")],
   ["tenants",placeholder.id,"ownerAccountOperations",id()],
   ["tenants",placeholder.id,"ownerAccountLocks","current"],
  ]){
   const doc=clientRef(fs,...location);
   await assert.rejects(getDoc(doc),e=>e.code==="permission-denied");
   await assert.rejects(setDoc(doc,{status:"complete",actor:uid}),e=>e.code==="permission-denied");
  }
 }finally{await deleteApp(app);}
});
