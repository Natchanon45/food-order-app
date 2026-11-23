import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {getApps,initializeApp}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
const service=require("./tenant-master-edit");
const legacy=require("./tenant-admin");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||"")||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||""))
 throw Error("P12F_REQUIRES_DEMO_EMULATOR");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),native=getAuth();
const su="p12f-admin-"+randomUUID(),other="p12f-other-"+randomUUID(),
 disabled="p12f-disabled-"+randomUUID(),outsider="p12f-owner-outside-"+randomUUID();
const tenantId="p12f-tenant-"+randomUUID();
const secondId="p12f-second-"+randomUUID();
const owner="p12f-owner-"+randomUUID(),cashier="p12f-cashier-"+randomUUID();
const oldSlug="old-"+randomUUID().slice(0,8);
const secondSlug="old-"+randomUUID().slice(0,8);
const tenantRef=db.collection("tenants").doc(tenantId);
const storeRef=tenantRef.collection("settings").doc("store");
const suRef=db.collection("users").doc(su);
const indexRef=slug=>db.collection("tenantSlugs").doc(slug);
const stamp="2026-10-18T03:30:00.000Z";
const first={
 id:tenantId,slug:oldSlug,name:"Original Shop",
 ownerUid:owner,ownerEmail:"owner@example.test",
 active:true,onboardingRequired:false,
 planCode:"yearly",subscriptionStatus:"active",
 subscriptionExpiresAt:"2027-11-17T16:59:59.999Z",
 firstActivatedAt:stamp,trialStartsAt:stamp,
 trialEndsAt:"2026-11-17T16:59:59.999Z",
 signupBilling:{planCode:"yearly",priceSource:"original_terms"},
 revenueShareSuspended:false,
 m7FinanceAccessStatus:"suspended",
 m7FinanceAccessReason:"m7_overdue_invoice",
 m7InvoiceUnpaidCents:770001,
 businessType:"restaurant_cafe",businessUnits:["order_delivery"],
 masterEditRevision:0,
};
const basicStore={
 tenantId,shopName:"Original Shop",shopPhone:"021122334",
 shopAddress:"Soi A",bankAccountNumber:"9999988888",
 promptPayId:"0811111111",deliveryPromptPayEnabled:true,
};
const snapshot=async(t=tenantRef)=> (await t.get()).data();
const fields=(tenant,store,params={})=>({
 tenantId:tenant.id,operationId:randomUUID(),
 name:"Edited Shop",slug:tenant.slug,phone:"0861112222",
 address:"Soi B",businessType:"retail",
 expectedName:tenant.name,expectedSlug:tenant.slug,
 expectedPhone:store.shopPhone,expectedAddress:store.shopAddress,
 expectedBusinessType:tenant.businessType||"restaurant_cafe",
 expectedRevision:tenant.masterEditRevision??0,
 ...params,
});
const edit=(uid,data)=>service.updateTenantMasterAtomic.run({auth:{uid},data});
const lookup=(uid,op,id=tenantId)=>
 service.getPlatformTenantMasterEditOperation.run({auth:{uid},data:{
  tenantId:id,operationId:op,
 }});
const readStore=async(t=storeRef)=>(await t.get()).data();
test("seed original qualified Tenant, public slug, store with bank details and active Owner/Cashier",async()=>{
 await Promise.all([
  suRef.set({role:"super_admin",active:true}),
  db.collection("users").doc(other).set({role:"super_admin",active:true}),
  db.collection("users").doc(disabled).set({role:"super_admin",active:false}),
  db.collection("users").doc(outsider).set({role:"owner",active:true}),
  db.collection("users").doc(owner).set({
   uid:owner,role:"owner",tenantId,tenantSlug:oldSlug,
   tenantName:"Original Shop",active:true,
  }),
  db.collection("users").doc(cashier).set({
   uid:cashier,role:"cashier",tenantId,tenantSlug:oldSlug,
   tenantName:"Original Shop",active:true,
  }),
  tenantRef.set(first),
  storeRef.set(basicStore),
  indexRef(oldSlug).set({tenantId,slug:oldSlug,name:"Original Shop",
   active:true,ownerUid:owner,
   provisioningId:"original-provision",
   subscriptionStatus:"active",
   subscriptionExpiresAt:"2027-11-17T16:59:59.999Z",
   gracePeriodDays:3,
  }),
  tenantRef.collection("memberships").doc(owner).set({
   tenantId,uid:owner,role:"owner",tenantSlug:oldSlug,tenantName:"Original Shop",
  }),
  tenantRef.collection("memberships").doc(cashier).set({
   tenantId,uid:cashier,role:"cashier",tenantSlug:oldSlug,tenantName:"Original Shop",
  }),
 ]);
 assert.equal((await snapshot()).masterEditRevision,0);
});
test("unauthenticated/owner/inactive role and legacy payload fail before any slug mutation",async()=>{
 const payload=fields(await snapshot(),await readStore());
 for(const uid of [outsider,disabled]){
  await assert.rejects(edit(uid,payload),e=>e.code==="permission-denied");
  await assert.rejects(lookup(uid,payload.operationId),e=>e.code==="permission-denied");
 }
 await assert.rejects(service.updateTenantMasterAtomic.run({
  auth:null,data:payload,
 }),e=>e.code==="unauthenticated");
 await assert.rejects(legacy.updateTenant.run({
  auth:{uid:su},data:{tenantId,name:"Legacy",slug:"legacy-slug",
   phone:"",address:"",businessType:"retail"},
 }),e=>e.code==="invalid-argument");
 assert.equal((await snapshot()).name,"Original Shop");
 assert.equal((await indexRef(oldSlug).get()).exists,true);
});
test("atomic rename updates Tenant + settings + public Slug + Owner/Cashier users and memberships + immutable receipt",async()=>{
 const old=await snapshot(),st=await readStore();
 const newSlug="new-"+randomUUID().slice(0,8);
 const data=fields(old,st,{slug:newSlug});
 const result=await edit(su,data);
 assert.equal(result.ok,true);
 assert.equal(result.readOnly,false);
 assert.equal(result.replayed,false);
 assert.equal(result.master.revision,1);
 assert.equal(result.master.slug,newSlug);
 assert.equal(result.canSettleMoney,false);
 assert.equal(result.canChangeOwnerIdentity,false);
 assert.equal((await indexRef(oldSlug).get()).exists,false);
 const tenant=await snapshot(),store=await readStore(),
  index=(await indexRef(newSlug).get()).data();
 assert.equal(tenant.name,"Edited Shop");
 assert.equal(tenant.slug,newSlug);
 assert.equal(tenant.masterEditRevision,1);
 assert.deepEqual(tenant.businessUnits,["retail_pos"]);
 assert.equal(store.shopName,"Edited Shop");
 assert.equal(store.shopPhone,"0861112222");
 assert.equal(store.shopAddress,"Soi B");
 assert.equal(store.bankAccountNumber,"9999988888");
 assert.equal(store.promptPayId,"0811111111");
 assert.equal(index.tenantId,tenantId);
 assert.equal(index.name,"Edited Shop");
 assert.equal(index.ownerUid,owner);
 assert.equal(index.provisioningId,"original-provision");
 assert.equal(index.subscriptionStatus,"active");
 assert.equal(index.active,true);
 for(const uid of [owner,cashier]){
  const u=(await db.collection("users").doc(uid).get()).data();
  const m=(await tenantRef.collection("memberships").doc(uid).get()).data();
  assert.equal(u.tenantSlug,newSlug);
  assert.equal(u.tenantName,"Edited Shop");
  assert.equal(m.tenantSlug,newSlug);
  assert.equal(m.tenantName,"Edited Shop");
  assert.equal(u.role,uid===owner?"owner":"cashier");
 }
 for(const key of ["active","firstActivatedAt","trialEndsAt",
  "subscriptionExpiresAt","planCode","signupBilling","revenueShareSuspended",
  "m7FinanceAccessStatus","m7FinanceAccessReason","m7InvoiceUnpaidCents",
  "ownerUid","ownerEmail"]){
  assert.deepEqual(tenant[key],old[key],key);
 }
 const row=(await tenantRef.collection("masterEditOperations")
  .doc(data.operationId).get()).data();
 assert.equal(row.actor,su);
 assert.equal(row.kind,"tenant_master_edit_v1");
 assert.equal(row.userCount,2);
 assert.equal(row.canSettleMoney,false);
 assert.equal(JSON.stringify(row).includes("9999988888"),false);
 assert.equal((await lookup(su,data.operationId)).status,"complete_current");
 await assert.rejects(lookup(other,data.operationId),
  e=>e.code==="permission-denied");
 const replay=await edit(su,data);
 assert.equal(replay.replayed,true);
 assert.equal(replay.master.revision,1);
 assert.equal((await snapshot()).masterEditRevision,1);
 await assert.rejects(edit(su,{...data,name:"Hijack"}),
  e=>e.code==="already-exists");
});
test("duplicate operation UUID across eight concurrent requests increments revision only ONCE",async()=>{
 const previous=await snapshot(),st=await readStore();
 const data=fields(previous,st,{name:"Concurrent Shop",
  slug:previous.slug,phone:"0833334444",address:"Concurrent Street",
  businessType:"retail"});
 const results=await Promise.allSettled(Array.from({length:8},()=>edit(su,data)));
 const passed=results.filter(result=>result.status==="fulfilled");
 assert.ok(passed.length>=1);
 assert.ok(passed.every(result=>result.value.master.revision===2));
 assert.equal((await snapshot()).masterEditRevision,2);
 assert.equal((await lookup(su,data.operationId)).status,"complete_current");
 assert.equal((await tenantRef.collection("masterEditOperations").get()).size,2);
});
test("different operation IDs with same original CAS can only save one winner",async()=>{
 const old=await snapshot(),st=await readStore();
 const a=fields(old,st,{name:"Winner A",phone:"0111111111"});
 const b=fields(old,st,{name:"Winner B",phone:"0222222222"});
 const results=await Promise.allSettled([edit(su,a),edit(su,b)]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected").length,1);
 assert.equal(results.find(x=>x.status==="rejected").reason.code,"failed-precondition");
 const t=await snapshot(),store=await readStore();
 assert.equal(t.masterEditRevision,3);
 assert.equal(t.name,store.shopName);
 assert.equal((await indexRef(t.slug).get()).data().name,t.name);
 assert.equal((await tenantRef.collection("masterEditOperations").get()).size,3);
});
test("cross-tenant slug collision does not move/delete original index nor update any user",async()=>{
 const foreignSlug="reserved-"+randomUUID().slice(0,8);
 await indexRef(foreignSlug).set({tenantId:secondId,slug:foreignSlug,
  name:"Foreign Tenant",active:true});
 const old=await snapshot(),st=await readStore(),
  usersBefore=await db.collection("users").doc(owner).get();
 const data=fields(old,st,{slug:foreignSlug});
 await assert.rejects(edit(su,data),e=>e.code==="already-exists");
 assert.equal((await snapshot()).slug,old.slug);
 assert.equal((await indexRef(old.slug).get()).data().tenantId,tenantId);
 assert.equal((await indexRef(foreignSlug).get()).data().tenantId,secondId);
 assert.equal((await db.collection("users").doc(owner).get()).data().tenantSlug,
  usersBefore.data().tenantSlug);
 assert.equal((await tenantRef.collection("masterEditOperations")
  .doc(data.operationId).get()).exists,false);
});
test("stale store phone, stale business and stale revision each reject without a receipt",async()=>{
 const before=await snapshot(),st=await readStore();
 for(const patch of [
  {expectedRevision:before.masterEditRevision-1},
  {expectedName:"Never existed"},{expectedSlug:"phantom-old"},
  {expectedPhone:"0000000000"},{expectedAddress:"Other old street"},
  {expectedBusinessType:"both"},
 ]){
  const data=fields(before,st,patch);
  await assert.rejects(edit(su,data),e=>e.code==="failed-precondition");
  assert.equal((await tenantRef.collection("masterEditOperations")
   .doc(data.operationId).get()).exists,false);
 }
});
test("preserves explicit cleared phone/address instead of stale Tenant fallback",async()=>{
 const before=await snapshot(),st=await readStore();
 const clear=fields(before,st,{phone:"",address:"",name:"No Contact"});
 const result=await edit(su,clear);
 assert.equal(result.master.phone,"");
 assert.equal(result.master.address,"");
 const stored=await readStore();
 assert.equal(stored.shopPhone,"");
 assert.equal(stored.shopAddress,"");
 const list=await legacy.listTenants.run({auth:{uid:su},data:{}});
 const merchant=list.tenants.find(v=>v.id===tenantId);
 assert.equal(merchant.shopPhone,"");
 assert.equal(merchant.shopAddress,"");
 assert.equal(merchant.masterEditRevision,result.master.revision);
 const change=fields(await snapshot(),stored,{
  name:"After Clear",phone:"",address:"",
  expectedPhone:"",expectedAddress:"",
 });
 const final=await edit(su,change);
 assert.equal(final.master.revision,result.master.revision+1);
});
test("missing membership or missing canonical old slug fails closed; unrelated receipt not created",async()=>{
 const before=await snapshot(),st=await readStore();
 const member=tenantRef.collection("memberships").doc(cashier);
 const backup=(await member.get()).data();
 await member.delete();
 const data=fields(before,st);
 await assert.rejects(edit(su,data),e=>e.code==="failed-precondition");
 assert.equal((await tenantRef.collection("masterEditOperations")
  .doc(data.operationId).get()).exists,false);
 await member.set(backup);
 const currentIndex=indexRef(before.slug);
 const oldIndex=(await currentIndex.get()).data();
 await currentIndex.delete();
 const another=fields(before,st);
 await assert.rejects(edit(su,another),e=>e.code==="failed-precondition");
 assert.equal((await snapshot()).name,before.name);
 await currentIndex.set(oldIndex);
});
test("concurrent cross-tenant request for the SAME fresh slug creates exactly one owner of that slug",async()=>{
 const secondRef=db.collection("tenants").doc(secondId);
 const secondOwner="p12f-second-owner-"+randomUUID();
 await Promise.all([
  secondRef.set({...first,id:secondId,slug:secondSlug,
   name:"Second Shop",ownerUid:secondOwner,masterEditRevision:0}),
  secondRef.collection("settings").doc("store").set({
   tenantId:secondId,shopName:"Second Shop",shopPhone:"",shopAddress:"",
  }),
  indexRef(secondSlug).set({tenantId:secondId,slug:secondSlug,
   name:"Second Shop",active:true}),
  db.collection("users").doc(secondOwner).set({
   uid:secondOwner,tenantId:secondId,role:"owner",
   active:true,tenantSlug:secondSlug,tenantName:"Second Shop",
  }),
  secondRef.collection("memberships").doc(secondOwner).set({
   uid:secondOwner,tenantId:secondId,role:"owner",
   tenantSlug:secondSlug,tenantName:"Second Shop",
  }),
 ]);
 const t1=await snapshot(),s1=await readStore(),
  t2=await snapshot(secondRef),s2=await readStore(
   secondRef.collection("settings").doc("store"));
 const shared="shared-"+randomUUID().slice(0,8);
 const a=fields(t1,s1,{slug:shared});
 const b=fields(t2,s2,{slug:shared,tenantId:secondId,
  name:"Second Tenant Edited",expectedName:"Second Shop",
  expectedSlug:secondSlug,expectedPhone:"",expectedAddress:"",
  expectedBusinessType:"restaurant_cafe",expectedRevision:0});
 const out=await Promise.allSettled([edit(su,a),edit(su,b)]);
 assert.equal(out.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(out.filter(x=>x.status==="rejected").length,1);
 assert.ok(["already-exists","failed-precondition"].includes(
  out.find(x=>x.status==="rejected").reason.code));
 const winner=(await indexRef(shared).get()).data();
 assert.ok([tenantId,secondId].includes(winner.tenantId));
 const loser=winner.tenantId===tenantId?secondId:tenantId;
 const loserDoc=(await db.collection("tenants").doc(loser).get()).data();
 assert.equal(loserDoc.slug,winner.tenantId===tenantId?secondSlug:t1.slug);
 assert.equal((await indexRef(loserDoc.slug).get()).data().tenantId,loser);
});
test("a later completed master edit is visible as superseded, never replayed over newer canonical data",async()=>{
 const state=await snapshot(),settings=await readStore();
 const a=fields(state,settings,{name:"Version A"});
 const one=await edit(su,a);
 const newer=fields(await snapshot(),await readStore(),{name:"Version B"});
 await edit(su,newer);
 assert.equal((await lookup(su,a.operationId)).status,"complete_superseded");
 assert.equal((await lookup(su,newer.operationId)).status,"complete_current");
 assert.equal((await lookup(su,randomUUID())).status,"not_found");
 assert.equal((await snapshot()).name,"Version B");
 assert.equal(one.canIssueInvoice,false);
});
test("browser Superadmin cannot forge master name, slug, revision or immutable edit receipt",async()=>{
 const {initializeApp:clientApp,deleteApp}=await import("firebase/app");
 const {getAuth:clientAuth,connectAuthEmulator,signInWithEmailAndPassword}=
  await import("firebase/auth");
 const {getFirestore:clientDb,connectFirestoreEmulator,
  updateDoc,setDoc,getDoc,doc:clientRef}=await import("firebase/firestore");
 const uid="p12f-client-"+randomUUID();
 const email="p12f-"+randomUUID()+"@example.test";
 const password="Only-demo-emulator-123456";
 await native.createUser({uid,email,password});
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 const app=clientApp({apiKey:"demo-api-key",projectId:"demo-penguin-hybrid",
  appId:"1:123:web:"+randomUUID(),authDomain:"demo-penguin-hybrid.firebaseapp.com"},
  "p12f-browser-"+randomUUID());
 try{
  const auth=clientAuth(app);
  connectAuthEmulator(auth,"http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST,
   {disableWarnings:true});
  await signInWithEmailAndPassword(auth,email,password);
  const fire=clientDb(app),[host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(fire,host,Number(port));
  const target=clientRef(fire,"tenants",tenantId);
  const old=await snapshot();
  for(const field of [
   {name:"Browser-Edited Name"},{slug:"hijack-name"},
   {businessType:"both"},{masterEditRevision:old.masterEditRevision+1},
   {masterEditedBy:uid},{businessUnits:["order_delivery"]},
  ])await assert.rejects(updateDoc(target,field),e=>e.code==="permission-denied");
  const receipt=clientRef(fire,"tenants",tenantId,"masterEditOperations",randomUUID());
  await assert.rejects(getDoc(receipt),e=>e.code==="permission-denied");
  await assert.rejects(setDoc(receipt,{actor:uid,changed:true}),
   e=>e.code==="permission-denied");
 }finally{await deleteApp(app);}
});
