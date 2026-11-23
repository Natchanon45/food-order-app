import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
  !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("P14_SAAS_INSPECTION_REQUIRES_DEMO_FIRESTORE_EMULATOR");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore();
const {inspectLegacySaasMigration,migrateLegacySaasStore}=require("./saas-migration");
const target="ff897699-de82-4370-a360-35b22cc74c85";
const suffix=randomUUID().slice(0,8),superId="p14-super-"+suffix;
const ownerId="p14-owner-"+suffix;
const TARGET_COLLECTIONS=["menus","tables","orders"];
test("SaaS read-only inspection denies anonymous, Tenant Owner and inactive Superadmin",async()=>{
 await db.collection("users").doc(ownerId).set({role:"owner",tenantId:target,active:true});
 await db.collection("users").doc(superId).set({role:"super_admin",active:false});
 for(const fn of [inspectLegacySaasMigration,migrateLegacySaasStore]){
  await assert.rejects(fn.run({data:{action:"prepare"}}),{code:"unauthenticated"});
  for(const uid of [ownerId,superId])
   await assert.rejects(fn.run({auth:{uid},data:{action:"prepare",overwrite:true}}),
    {code:"permission-denied"});
 }
 assert.equal((await db.collection("tenants").doc(target).get()).exists,false);
});
test("SaaS inspection with missing target returns nullable counts, no fabricated source proof or Tenant writes",async()=>{
 await db.collection("users").doc(superId).set({role:"super_admin",active:true});
 await db.collection("shops").doc("default-shop").collection("menus")
  .doc("p14-hidden-"+suffix).set({name:"Source is not remotely inspectable"});
 const result=await inspectLegacySaasMigration.run({
  auth:{uid:superId},data:{sourceShopId:"unauthorized",tenantId:"cross-tenant",overwrite:true}
 });
 assert.equal(result.ok,true);
 assert.equal(result.summary.scope,"firebase_target_only");
 assert.equal(result.summary.sourceInspectable,false);
 assert.equal(result.summary.migrationEnabled,false);
 assert.equal(result.summary.tenantId,target);
 assert.equal(result.summary.tenantSlug,"tuahere-somtam");
 assert.equal(result.summary.target.id,target);
 assert.equal(result.summary.tenantExists,false);
 for(const key of [...TARGET_COLLECTIONS,"settings"])
  assert.equal(result.summary[key],null,"Absent target cannot fabricate "+key);
 assert.equal((await db.collection("tenants").doc(target).get()).exists,false);
});
test("SaaS inspection only counts canonical TARGET records and keeps target finance immutable",async()=>{
 const ref=db.collection("tenants").doc(target);
 await ref.set({id:target,name:"Test Target Only",firstActivatedAt:"2026-10-18",
  subscriptionExpiresAt:"2027-11-17",invoiceUnpaidCents:55555,
  ownerUid:"existing-owner",active:false});
 for(const name of TARGET_COLLECTIONS)
  await ref.collection(name).doc("p14-target-"+name+"-"+suffix).set({name:"QA target"});
 await ref.collection("settings").doc("store").set({businessType:"both"});
 const source=await db.collection("shops").doc("default-shop").collection("menus").get();
 const before=(await ref.get()).data();
 const result=await inspectLegacySaasMigration.run({auth:{uid:superId},data:{}});
 assert.equal(result.summary.tenantExists,true);
 for(const key of TARGET_COLLECTIONS)
  assert.equal(result.summary[key],1,"Only target "+key+" is countable");
 assert.equal(result.summary.settings,true);
 assert.equal(result.summary.sourceInspectable,false);
 assert.equal(source.size,1);
 assert.deepEqual((await ref.get()).data(),before);
});
test("ALL old SaaS migration actions fail closed for authorized Superadmin, never overwrite source or target",async()=>{
 const ref=db.collection("tenants").doc(target);
 const original=(await ref.get()).data();
 const sourceRef=db.collection("shops").doc("default-shop").collection("menus")
  .doc("p14-hidden-"+suffix),originalSource=(await sourceRef.get()).data();
 for(const data of [{action:"prepare"},{action:"collection",collectionName:"menus",overwrite:true},
   {action:"settings",overwrite:true},{action:"finalize",overwrite:true},
   {action:"unknown",overwrite:true},{},null]){
  await assert.rejects(migrateLegacySaasStore.run({
   auth:{uid:superId},data,
  }),error=>error.code==="failed-precondition"&&
   error.message==="SAAS_SOURCE_MIGRATION_DISABLED_INSPECTION_ONLY");
 }
 assert.deepEqual((await ref.get()).data(),original);
 assert.deepEqual((await sourceRef.get()).data(),originalSource);
 assert.equal((await db.collection("tenantSlugs").doc("tuahere-somtam").get()).exists,false,
  "Legacy migration cannot mint slug reservations or create memberships");
});
