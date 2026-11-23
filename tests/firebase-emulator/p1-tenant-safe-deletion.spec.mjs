import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {getApps,initializeApp}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
const api=require("./tenant-safe-deletion");
const legacy=require("./tenant-admin");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||"")||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||""))
 throw Error("P12G_DEMO_FIRESTORE_AUTH_EMULATORS_REQUIRED");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),authAdmin=getAuth();
const superUid="p12g-admin-"+randomUUID(),otherUid="p12g-other-"+randomUUID(),
 ownerUid="p12g-owner-"+randomUUID(),disabledUid="p12g-inactive-"+randomUUID();
const ref=id=>db.collection("tenants").doc(id);
const slugRef=slug=>db.collection("tenantSlugs").doc(slug);
const operations=db.collection("platformTenantDeletions");
const tombstones=db.collection("platformTenantDeletionTombstones");
const newId=()=> "p12g-test-"+randomUUID();
const newSlug=()=> "p12g-"+randomUUID().slice(0,10);
const buildTenant=({id=newId(),slug=newSlug(),name="Unused Test Shop"}={})=>({
 id,slug,name,active:false,onboardingRequired:true,createdBy:superUid,
 createdAt:"2026-11-23T06:00:00.000Z",
});
const makePayload=(tenant,overrides={})=>({
 tenantId:tenant.id,operationId:randomUUID(),
 expectedName:tenant.name,expectedSlug:tenant.slug,
 expectedRevision:tenant.masterEditRevision??0,
 intent:"delete_unowned_placeholder",...overrides,
});
const create=async(options={})=>{
 const tenant=buildTenant(options),store={tenantId:tenant.id,
  shopName:tenant.name,shopPhone:"",shopAddress:"",
  deliveryFeeNearby:0,deliveryFeeGeneral:30,deliveryFeeFar:50};
 const publicIndex={tenantId:tenant.id,slug:tenant.slug,name:tenant.name,
  active:false,createdAt:"2026-11-23T06:00:00.000Z"};
 await Promise.all([
  ref(tenant.id).set(tenant),
  ref(tenant.id).collection("settings").doc("store").set(store),
  slugRef(tenant.slug).set(publicIndex),
 ]);
 return {tenant,store,publicIndex};
};
const preview=(uid,id)=>api.getPlatformTenantDeletionSafety.run({
 auth:uid?{uid}:null,data:{tenantId:id},
});
const remove=(uid,payload)=>api.deleteTenant.run({auth:uid?{uid}:null,data:payload});
const status=(uid,payload)=>api.getPlatformTenantDeletionStatus.run({
 auth:uid?{uid}:null,data:{
  tenantId:payload.tenantId,operationId:payload.operationId,
 },
});
const reason=(s,code)=>s.reasonCodes.includes(code);
test("setup active Superadmin, another admin, inactive admin and non-admin Owner",async()=>{
 await Promise.all([
  db.collection("users").doc(superUid).set({role:"super_admin",active:true}),
  db.collection("users").doc(otherUid).set({role:"super_admin",active:true}),
  db.collection("users").doc(disabledUid).set({role:"super_admin",active:false}),
  db.collection("users").doc(ownerUid).set({role:"owner",active:true}),
 ]);
});
test("pristine never-activated placeholder is eligible, but no Owner/financial authority is granted",async()=>{
 const {tenant}=await create();
 const result=await preview(superUid,tenant.id);
 assert.equal(result.ok,true);
 assert.equal(result.ready,true);
 assert.equal(result.readOnly,true);
 assert.deepEqual(result.reasonCodes,[]);
 assert.equal(result.canDeleteOnlyUnownedPlaceholder,true);
 for(const field of ["canDeleteBusinessData","canDeleteFinanceHistory",
  "canDeleteOwner","canReleaseTenant","canSettleMoney","canIssueInvoice"])
  assert.equal(result[field],false);
 assert.equal((await ref(tenant.id).get()).exists,true);
 assert.equal((await slugRef(tenant.slug).get()).exists,true);
});
test("strict Superadmin role / extra fields / missing Auth refuse safety and deletion",async()=>{
 const {tenant}=await create();
 for(const who of [ownerUid,disabledUid]){
  await assert.rejects(preview(who,tenant.id),e=>e.code==="permission-denied");
  await assert.rejects(remove(who,makePayload(tenant)),e=>e.code==="permission-denied");
 }
 await assert.rejects(preview(null,tenant.id),e=>e.code==="unauthenticated");
 await assert.rejects(remove(null,makePayload(tenant)),e=>e.code==="unauthenticated");
 await assert.rejects(api.getPlatformTenantDeletionSafety.run({
  auth:{uid:superUid},data:{tenantId:tenant.id,force:true},
 }),e=>e.code==="invalid-argument");
 await assert.rejects(legacy.deleteTenant.run({auth:{uid:superUid},
  data:{tenantId:tenant.id}}),e=>e.code==="invalid-argument");
 assert.equal((await ref(tenant.id).get()).exists,true);
});
test("one actual delete removes only empty placeholder, Settings/store and matching Slug atomically, creates immutable proof",async()=>{
 const {tenant}=await create();
 const req=makePayload(tenant);
 const result=await remove(superUid,req);
 assert.equal(result.ok,true);
 assert.equal(result.deleted,true);
 assert.equal(result.replayed,false);
 assert.equal(result.canDeleteFinanceHistory,false);
 assert.equal((await ref(tenant.id).get()).exists,false);
 assert.equal((await ref(tenant.id).collection("settings").doc("store").get()).exists,false);
 assert.equal((await slugRef(tenant.slug).get()).exists,false);
 const saved=(await operations.doc(req.operationId).get()).data();
 const tomb=(await tombstones.doc(tenant.id).get()).data();
 assert.equal(saved.actor,superUid);
 assert.equal(saved.kind,"tenant_empty_placeholder_delete_v1");
 assert.equal(saved.deletedSlug,tenant.slug);
 assert.equal(tomb.operationId,req.operationId);
 assert.equal(tomb.deletedSlug,tenant.slug);
 const checked=await status(superUid,req);
 assert.equal(checked.status,"deleted_verified");
 assert.equal(checked.canDeleteBusinessData,false);
 await assert.rejects(status(otherUid,req),e=>e.code==="permission-denied");
 const again=await remove(superUid,req);
 assert.equal(again.replayed,true);
 assert.equal((await operations.where("tenantId","==",tenant.id).get()).size,1);
 await assert.rejects(remove(superUid,{...req,operationId:randomUUID()}),
  e=>e.code==="already-exists");
 await assert.rejects(remove(superUid,{...req,expectedName:"Different"}),
  e=>e.code==="already-exists");
});
test("eight concurrent repeated requests commit only one receipt and one tombstone",async()=>{
 const {tenant}=await create();
 const req=makePayload(tenant);
 const calls=await Promise.allSettled(Array.from({length:8},()=>remove(superUid,req)));
 assert.equal(calls.filter(x=>x.status==="fulfilled").length,8);
 assert.equal(calls.filter(x=>x.status==="rejected").length,0);
 assert.equal(calls.filter(x=>x.status==="fulfilled"&&x.value.replayed!==true).length,1);
 assert.equal((await operations.where("tenantId","==",tenant.id).get()).size,1);
 assert.equal((await tombstones.doc(tenant.id).get()).exists,true);
 assert.equal((await ref(tenant.id).get()).exists,false);
});
test("two different operation IDs racing to delete the same empty shop have only one winner",async()=>{
 const {tenant}=await create();
 const a=makePayload(tenant),b=makePayload(tenant);
 const results=await Promise.allSettled([remove(superUid,a),remove(superUid,b)]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected").length,1);
 assert.equal(results.find(x=>x.status==="rejected").reason.code,"already-exists");
 assert.equal((await operations.where("tenantId","==",tenant.id).get()).size,1);
});
test("stale original name, Slug or master revision rejects without removing either record",async()=>{
 const {tenant}=await create();
 for(const patch of [
  {expectedName:"Stale Name"},{expectedSlug:"other-slug"},
  {expectedRevision:1},
 ]){
  const req=makePayload(tenant,patch);
  await assert.rejects(remove(superUid,req),e=>e.code==="failed-precondition");
  assert.equal((await operations.doc(req.operationId).get()).exists,false);
 }
 assert.equal((await ref(tenant.id).get()).exists,true);
 assert.equal((await slugRef(tenant.slug).get()).exists,true);
});
test("activated or owner-linked store never deletes Owner, original trial or financial record",async()=>{
 const {tenant}=await create();
 const data={active:true,onboardingRequired:false,ownerUid:ownerUid,
  firstActivatedAt:"2026-10-18",planCode:"yearly",
  subscriptionExpiresAt:"2027-11-17",
  m7FinanceAccessStatus:"suspended",
  m7InvoiceUnpaidCents:770000};
 await ref(tenant.id).update(data);
 const p=await preview(superUid,tenant.id);
 assert.equal(p.ready,false);
 assert.ok(reason(p,"TENANT_NOT_PRISTINE"));
 assert.ok(reason(p,"TENANT_OWNER_OR_ACTIVATION"));
 await assert.rejects(remove(superUid,makePayload(tenant)),
  e=>e.code==="failed-precondition");
 const after=(await ref(tenant.id).get()).data();
 assert.equal(after.ownerUid,ownerUid);
 assert.equal(after.m7InvoiceUnpaidCents,770000);
 assert.equal((await slugRef(tenant.slug).get()).exists,true);
});
test("any new/unknown tenant subcollection blocks hard deletion and remains untouched",async()=>{
 const {tenant}=await create();
 const child=ref(tenant.id).collection("nextGenerationFinance").doc("receipt");
 await child.set({amountCents:777000,bankVerified:true});
 const result=await preview(superUid,tenant.id);
 assert.equal(result.ready,false);
 assert.ok(reason(result,"TENANT_HAS_SUBCOLLECTIONS"));
 await assert.rejects(remove(superUid,makePayload(tenant)),
  e=>e.code==="failed-precondition");
 assert.equal((await child.get()).data().amountCents,777000);
 assert.equal((await ref(tenant.id).get()).exists,true);
});
test("unknown settings fields including bank/payment references block hard deletion",async()=>{
 const {tenant}=await create();
 const store=ref(tenant.id).collection("settings").doc("store");
 await store.update({bankAccountNumber:"999988887777"});
 const result=await preview(superUid,tenant.id);
 assert.ok(reason(result,"TENANT_SETTINGS_UNEXPECTED"));
 await assert.rejects(remove(superUid,makePayload(tenant)),
  e=>e.code==="failed-precondition");
 assert.equal((await store.get()).data().bankAccountNumber,"999988887777");
});
test("external Auth/Owner index or pending provision with tenantId blocks even if Tenant has no Owner field",async()=>{
 const {tenant}=await create();
 const user=db.collection("users").doc("p12g-linked-"+randomUUID());
 await user.set({role:"cashier",active:true,tenantId:tenant.id});
 let result=await preview(superUid,tenant.id);
 assert.ok(reason(result,"TENANT_EXTERNAL_REFERENCES"));
 await assert.rejects(remove(superUid,makePayload(tenant)),
  e=>e.code==="failed-precondition");
 await user.delete();
 const op=db.collection("platformTenantProvisions").doc(randomUUID());
 await op.set({tenantId:tenant.id,createdBy:superUid,status:"reserved"});
 result=await preview(superUid,tenant.id);
 assert.ok(reason(result,"TENANT_EXTERNAL_REFERENCES"));
 await op.delete();
});
test("foreign original slug index cannot be deleted under same tenant; no delete receipt",async()=>{
 const {tenant}=await create();
 const old=(await slugRef(tenant.slug).get()).data();
 await slugRef(tenant.slug).set({...old,tenantId:"other-tenant"});
 const p=await preview(superUid,tenant.id);
 assert.ok(reason(p,"TENANT_SLUG_MISMATCH"));
 const req=makePayload(tenant);
 await assert.rejects(remove(superUid,req),
  e=>e.code==="failed-precondition");
 assert.equal((await slugRef(tenant.slug).get()).data().tenantId,"other-tenant");
 assert.equal((await ref(tenant.id).get()).exists,true);
 assert.equal((await operations.doc(req.operationId).get()).exists,false);
});
test("read-only inspection of deleted receipt survives slug being reallocated to another tenant",async()=>{
 const {tenant}=await create();
 const req=makePayload(tenant);
 await remove(superUid,req);
 await slugRef(tenant.slug).set({tenantId:"new-other-tenant",slug:tenant.slug,
  name:"New Shop",active:true});
 const checked=await status(superUid,req);
 assert.equal(checked.status,"deleted_verified");
 assert.equal((await slugRef(tenant.slug).get()).data().tenantId,
  "new-other-tenant");
 assert.equal((await ref(tenant.id).get()).exists,false);
});
test("browser Superadmin cannot bypass deletion policy, forge receipts, tombstones or public Slug",async()=>{
 const {tenant}=await create();
 const {initializeApp:clientApp,deleteApp}=await import("firebase/app");
 const {getAuth:clientAuth,connectAuthEmulator,signInWithEmailAndPassword}=
  await import("firebase/auth");
 const {getFirestore:clientDb,connectFirestoreEmulator,
  deleteDoc,setDoc,getDoc,doc:clientRef}=await import("firebase/firestore");
 const uid="p12g-client-"+randomUUID();
 const email="p12g-"+randomUUID()+"@example.test";
 const password="Demo-emulator-password-only-1234";
 await authAdmin.createUser({uid,email,password});
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 const app=clientApp({apiKey:"demo-api-key",projectId:"demo-penguin-hybrid",
  appId:"1:123:web:"+randomUUID(),authDomain:"demo-penguin-hybrid.firebaseapp.com"},
  "p12g-client-"+randomUUID());
 try{
  const auth=clientAuth(app);
  connectAuthEmulator(auth,"http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST,
   {disableWarnings:true});
  await signInWithEmailAndPassword(auth,email,password);
  const fire=clientDb(app),[host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(fire,host,Number(port));
  await assert.rejects(deleteDoc(clientRef(fire,"tenants",tenant.id)),
   e=>e.code==="permission-denied");
  // Browser cannot strip a real Owner / onboarding record to
  // manufacture a deletion-eligible placeholder.
  const {updateDoc}=await import("firebase/firestore");
  for(const forged of [
   {ownerUid:null},{ownerEmail:null},{ownerDisplayName:null},
   {onboardingRequired:false},{createdBy:uid},{signupBilling:null},
   {futureFinancialProof:"remove"}, {futureFinancialProof:null},
   {bankAccountNumber:null},{firstActivatedAt:null},
  ]){
   await assert.rejects(updateDoc(clientRef(fire,"tenants",tenant.id),forged),
    e=>e.code==="permission-denied");
  }
  await assert.rejects(deleteDoc(clientRef(fire,"tenantSlugs",tenant.slug)),
   e=>e.code==="permission-denied");
  const op=clientRef(fire,"platformTenantDeletions",randomUUID());
  await assert.rejects(setDoc(op,{kind:"forged",actor:uid}),
   e=>e.code==="permission-denied");
  await assert.rejects(getDoc(op),e=>e.code==="permission-denied");
  await assert.rejects(setDoc(clientRef(fire,"platformTenantDeletionTombstones",tenant.id),
   {actor:uid}),e=>e.code==="permission-denied");
 }finally{await deleteApp(app);}
});
