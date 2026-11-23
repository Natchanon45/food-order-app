import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore,Timestamp}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
const sub=require("./subscription-admin");
const policy=require("./tenant-subscription-command-policy");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||"")||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||""))
 throw Error("P12D_REQUIRES_ISOLATED_AUTH_AND_FIRESTORE_DEMO_EMULATORS");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),native=getAuth();
const superadmin="p12d-admin-"+randomUUID(),other="p12d-other-"+randomUUID(),
 merchant="p12d-merchant-"+randomUUID(),disabled="p12d-disabled-"+randomUUID();
const tenantId="p12d-tenant-"+randomUUID(),slug="p12d-"+randomUUID().slice(0,8);
const tenantRef=db.collection("tenants").doc(tenantId);
const original=Timestamp.fromDate(new Date("2026-10-18T03:30:00Z"));
const trialEnd=Timestamp.fromDate(new Date("2026-11-17T16:59:59.999Z"));
const firstExpiry=Timestamp.fromDate(new Date("2027-11-17T16:59:59.999Z"));
const uid=who=>({auth:{uid:who}});
const ref=who=>({auth:{uid:who}});
const snapshot=async()=> (await tenantRef.get()).data();
const requestFor=(tenant,overrides={})=>({
 tenantId,operationId:randomUUID(),action:"extend",days:30,
 expiresAt:"2027-11-17",planCode:tenant.planCode,
 gracePeriodDays:tenant.gracePeriodDays??3,
 expectedExpiresAt:policy.iso(tenant.subscriptionExpiresAt),
 expectedStatus:tenant.subscriptionStatus||"active",
 expectedActive:tenant.active!==false,
 expectedRevision:tenant.subscriptionAdminRevision??0,
 expectedGracePeriodDays:tenant.gracePeriodDays??3,
 expectedPlanCode:tenant.planCode||"monthly",
 ...overrides,
});
const invoke=(actor,data)=>sub.updateTenantSubscription.run({auth:{uid:actor},data});
const inspect=(actor,operationId,targetTenantId=tenantId)=>
 sub.getPlatformTenantSubscriptionOperation.run({
  auth:{uid:actor},data:{tenantId:targetTenantId,operationId},
 });
test("initialize isolated historical Activation, matching slug and authorized actors",async()=>{
 await Promise.all([
  db.collection("users").doc(superadmin).set({role:"super_admin",active:true}),
  db.collection("users").doc(other).set({role:"super_admin",active:true}),
  db.collection("users").doc(merchant).set({role:"owner",active:true,tenantId}),
  db.collection("users").doc(disabled).set({role:"super_admin",active:false}),
  tenantRef.set({id:tenantId,name:"Source Membership Test",slug,active:true,
   ownerUid:merchant,planCode:"yearly",subscriptionStatus:"active",
   firstActivatedAt:original,trialStartsAt:original,trialEndsAt:trialEnd,
   subscriptionStartedAt:original,subscriptionExpiresAt:firstExpiry,
   gracePeriodDays:3,subscriptionAdminRevision:0,
   signupBilling:{planCode:"yearly",originalPriceVersion:"frozen-before-migration"},
   m7FinanceAccessStatus:"clear",
  }),
  db.collection("tenantSlugs").doc(slug).set({
   tenantId,slug,active:true,subscriptionStatus:"active",
   subscriptionExpiresAt:firstExpiry,gracePeriodDays:3,
  }),
 ]);
 const data=requestFor(await snapshot());
 for(const actor of [merchant,disabled]){
  await assert.rejects(invoke(actor,data),e=>e.code==="permission-denied");
  await assert.rejects(inspect(actor,randomUUID()),e=>e.code==="permission-denied");
 }
 await assert.rejects(sub.updateTenantSubscription.run({
  auth:null,data}),e=>e.code==="unauthenticated");
 assert.equal((await tenantRef.get()).data().subscriptionAdminRevision,0);
});
test("30-day extension persists ONE atomic tenant+slug+immutable audit receipt, replay idempotent",async()=>{
 const before=await snapshot(),data=requestFor(before);
 const result=await invoke(superadmin,data);
 assert.equal(result.ok,true);
 assert.equal(result.idempotent,false);
 assert.equal(result.revision,1);
 assert.equal(result.status,"active");
 assert.equal(result.planCode,"yearly");
 assert.equal(result.canIssueInvoice,false);
 assert.equal(result.canSettleMoney,false);
 assert.equal(result.canReleaseFinancialHold,false);
 const after=await snapshot();
 const slugDoc=(await db.collection("tenantSlugs").doc(slug).get()).data();
 const receipt=(await tenantRef.collection("subscriptionAdminActions")
  .doc(data.operationId).get()).data();
 assert.equal(after.subscriptionAdminRevision,1);
 assert.equal(after.subscriptionExpiresAt.toDate().toISOString(),
  "2027-12-17T16:59:59.999Z");
 assert.equal(slugDoc.subscriptionExpiresAt.toDate().toISOString(),
  after.subscriptionExpiresAt.toDate().toISOString());
 assert.equal(receipt.actor,superadmin);
 assert.equal(receipt.action,"extend");
 assert.equal(receipt.kind,"legacy_subscription_control_v1");
 assert.equal(receipt.financialAuthority,false);
 assert.equal(after.firstActivatedAt.toMillis(),original.toMillis());
 assert.equal(after.trialStartsAt.toMillis(),original.toMillis());
 assert.equal(after.trialEndsAt.toMillis(),trialEnd.toMillis());
 assert.equal(after.subscriptionStartedAt.toMillis(),original.toMillis());
 assert.deepEqual(after.signupBilling,before.signupBilling);
 const check=await inspect(superadmin,data.operationId);
 assert.equal(check.status,"complete_current");
 assert.equal(check.tenant.subscriptionAdminRevision,1);
 assert.equal(check.canReleaseFinancialHold,false);
 await assert.rejects(inspect(other,data.operationId),e=>e.code==="permission-denied");
 const replay=await invoke(superadmin,data);
 assert.equal(replay.idempotent,true);
 assert.equal(replay.revision,1);
 assert.equal((await snapshot()).subscriptionAdminRevision,1);
 await assert.rejects(invoke(superadmin,{...data,days:365}),
  e=>e.code==="already-exists");
});
test("five concurrent same-operation submissions can only increment once and never create multiple receipts",async()=>{
 const state=await snapshot(),data=requestFor(state);
 const outcomes=await Promise.allSettled(Array.from({length:5},
  ()=>invoke(superadmin,data)));
 const successes=outcomes.filter(row=>row.status==="fulfilled");
 assert.ok(successes.length>=1);
 for(const row of successes)assert.equal(row.value.revision,2);
 const after=await snapshot();
 assert.equal(after.subscriptionAdminRevision,2);
 assert.equal((await inspect(superadmin,data.operationId)).status,"complete_current");
 const audit=await tenantRef.collection("subscriptionAdminActions").get();
 assert.equal(audit.size,2);
});
test("different operation IDs from stale snapshot cannot extend twice and cannot change original membership",async()=>{
 const state=await snapshot(),a=requestFor(state),b=requestFor(state);
 const outcomes=await Promise.allSettled([invoke(superadmin,a),
  invoke(superadmin,b)]);
 assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(outcomes.filter(x=>x.status==="rejected").length,1);
 assert.equal(outcomes.find(x=>x.status==="rejected").reason.code,"failed-precondition");
 const latest=await snapshot();
 assert.equal(latest.subscriptionAdminRevision,3);
 assert.equal(latest.firstActivatedAt.toMillis(),original.toMillis());
 assert.equal(latest.trialEndsAt.toMillis(),trialEnd.toMillis());
});
test("strict CAS rejects stale dates and preflight rejects plan changes, invalid values, hybrid/revenue/onboarding",async()=>{
 const state=await snapshot();
 for(const update of [
  {expectedRevision:state.subscriptionAdminRevision-1},
  {expectedExpiresAt:"2027-01-01T00:00:00.000Z"},
  {expectedGracePeriodDays:5},
  {expectedStatus:"trialing"},
 ]){
  await assert.rejects(invoke(superadmin,requestFor(state,update)),
   e=>e.code==="failed-precondition");
 }
 for(const update of [
  {days:400},{gracePeriodDays:31},{gracePeriodDays:"3"},
  {planCode:"monthly"},{action:"delete"},
 ]){
  await assert.rejects(invoke(superadmin,requestFor(state,update)),
   e=>["invalid-argument","failed-precondition"].includes(e.code));
 }
 await tenantRef.update({billingPolicyVersion:"hybrid_v1"});
 await assert.rejects(invoke(superadmin,requestFor(await snapshot())),
  e=>e.code==="failed-precondition");
 await tenantRef.update({billingPolicyVersion:"legacy_v1",revenueShareEnabled:true});
 await assert.rejects(invoke(superadmin,requestFor(await snapshot())),
  e=>e.code==="failed-precondition");
 await tenantRef.update({revenueShareEnabled:false,onboardingRequired:true});
 await assert.rejects(invoke(superadmin,requestFor(await snapshot())),
  e=>e.code==="failed-precondition");
 await tenantRef.update({onboardingRequired:false});
 assert.equal((await snapshot()).subscriptionAdminRevision,3);
});
test("explicit Bangkok expiry set aligns with 16:59:59.999Z and rejects invalid date, no billing fake",async()=>{
 const state=await snapshot();
 await assert.rejects(invoke(superadmin,requestFor(state,{
  action:"set-expiry",days:0,expiresAt:"2026-02-30",
 })),e=>e.code==="invalid-argument");
 const data=requestFor(state,{
  action:"set-expiry",days:0,expiresAt:"2030-12-31",
 });
 const result=await invoke(superadmin,data);
 assert.equal(result.expiresAt,"2030-12-31T16:59:59.999Z");
 assert.equal((await snapshot()).subscriptionAdminRevision,4);
 assert.equal((await inspect(superadmin,data.operationId)).status,"complete_current");
});
test("manual suspend and manual activate are two separately audited commands, leave finance flags untouched",async()=>{
 const state=await snapshot();
 const suspend=requestFor(state,{action:"suspend",days:0});
 const first=await invoke(superadmin,suspend);
 assert.equal(first.active,false);
 assert.equal(first.status,"suspended");
 assert.equal((await snapshot()).suspensionReason,"manual_subscription_superadmin");
 const after=await snapshot();
 const extend=requestFor(after,{action:"extend",days:30});
 const extended=await invoke(superadmin,extend);
 assert.equal(extended.status,"suspended");
 assert.equal(extended.active,false);
 const toActivate=await snapshot();
 const activate=requestFor(toActivate,{action:"activate",days:0});
 const active=await invoke(superadmin,activate);
 assert.equal(active.status,"active");
 assert.equal(active.active,true);
 const latest=await snapshot();
 assert.equal(latest.m7FinanceAccessStatus,"clear");
 assert.equal(latest.revenueShareSuspended,undefined);
 assert.equal(latest.subscriptionAdminRevision,7);
 assert.equal((await inspect(superadmin,suspend.operationId)).status,"complete_superseded");
});
test("independent M7 invoice hold is never released by member control; blocked attempts write no receipt",async()=>{
 await tenantRef.update({active:false,subscriptionStatus:"suspended",
  suspensionReason:"manual_subscription_superadmin",
  m7FinanceAccessStatus:"suspended",
  m7FinanceAccessReason:"m7_overdue_invoice"});
 const state=await snapshot(),data=requestFor(state,{action:"activate",days:0});
 await assert.rejects(invoke(superadmin,data),e=>e.code==="failed-precondition");
 assert.equal((await tenantRef.collection("subscriptionAdminActions")
   .doc(data.operationId).get()).exists,false);
 assert.equal((await snapshot()).m7FinanceAccessReason,"m7_overdue_invoice");
 await tenantRef.update({m7FinanceAccessStatus:"clear",
  m7FinanceAccessReason:"none",active:true,subscriptionStatus:"active",
  suspensionReason:""});
});
test("invalid / stale / incomplete status snapshots never authorize financial source actions",async()=>{
 const op=randomUUID();
 assert.equal((await inspect(superadmin,op)).status,"not_found");
 await assert.rejects(sub.getPlatformTenantSubscriptionOperation.run({
  ...uid(superadmin),data:{tenantId,operationId:op,canRelease:true},
 }),e=>e.code==="invalid-argument");
 const current=await snapshot();
 const data=requestFor(current);
 const run=await invoke(superadmin,data);
 assert.equal(run.ok,true);
 await tenantRef.update({subscriptionAdminRevision:run.revision+1});
 assert.equal((await inspect(superadmin,data.operationId)).status,"complete_superseded");
 await tenantRef.update({subscriptionAdminRevision:run.revision});
});
test("historical no-expiry backfill is blocked, not a new one-month trial",async()=>{
 await assert.rejects(sub.backfillTenantSubscriptions.run({
  auth:{uid:superadmin},data:{},
 }),e=>e.code==="failed-precondition");
 const after=await snapshot();
 assert.equal(after.firstActivatedAt.toMillis(),original.toMillis());
});
test("Superadmin browser cannot read or fabricate immutable subscription receipts through Firestore rules",async()=>{
 const {initializeApp:clientApp,deleteApp}=await import("firebase/app");
 const {getAuth:clientAuth,connectAuthEmulator,signInWithEmailAndPassword}=await import("firebase/auth");
 const {getFirestore:clientDb,connectFirestoreEmulator,
  getDoc:clientGet,setDoc:clientSet,updateDoc:clientUpdate,
  doc:clientRef}=await import("firebase/firestore");
 const email="p12d-client-"+randomUUID()+"@example.test";
 const password="Only-in-demo-emulator-12345!";
 const uid=randomUUID();
 await native.createUser({uid,email,password});
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 const app=clientApp({projectId:"demo-penguin-hybrid",apiKey:"demo-key",
  appId:"1:123:web:"+randomUUID(),authDomain:"demo-penguin-hybrid.firebaseapp.com"},
  "p12d-client-"+randomUUID());
 try{
  const auth=clientAuth(app);
  connectAuthEmulator(auth,"http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST,
   {disableWarnings:true});
  await signInWithEmailAndPassword(auth,email,password);
  const fire=clientDb(app),[host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(fire,host,Number(port));
  const target=clientRef(fire,"tenants",tenantId,"subscriptionAdminActions",randomUUID());
  await assert.rejects(clientGet(target),e=>e.code==="permission-denied");
  await assert.rejects(clientSet(target,{action:"activate",approved:true}),
   e=>e.code==="permission-denied");
  const root=clientRef(fire,"tenants",tenantId);
  await assert.rejects(clientUpdate(root,{subscriptionStatus:"suspended"}),
   e=>e.code==="permission-denied");
  await assert.rejects(clientUpdate(root,{active:false}),
   e=>e.code==="permission-denied");
  await assert.rejects(clientUpdate(root,{firstActivatedAt:new Date()}),
   e=>e.code==="permission-denied");
  const route=clientRef(fire,"tenantSlugs",slug);
  await assert.rejects(clientUpdate(route,{active:false}),
   e=>e.code==="permission-denied");
 }finally{await deleteApp(app);}
});

test("00:15 scheduler atomically mirrors expiry only to matching slug, never creates a historical free trial or bypasses M7 hold",async()=>{
 const prefix="p12d-sync-"+randomUUID().slice(0,9);
 const yesterday=new Date(Date.now()-20*86400000);
 const stored=Timestamp.fromDate(yesterday);
 const fixedBase={active:true,subscriptionStatus:"active",planCode:"monthly",
  subscriptionExpiresAt:stored,gracePeriodDays:0,
  firstActivatedAt:original,trialStartsAt:original,trialEndsAt:trialEnd,
  ownerUid:merchant};
 const good=prefix+"-good",missing=prefix+"-missing",
  held=prefix+"-hold",empty=prefix+"-empty";
 await Promise.all([
  db.collection("tenants").doc(good).set({...fixedBase,slug:good}),
  db.collection("tenantSlugs").doc(good).set({tenantId:good,
   subscriptionStatus:"active",active:true,subscriptionExpiresAt:stored,
   gracePeriodDays:0}),
  db.collection("tenants").doc(missing).set({...fixedBase,slug:missing}),
  db.collection("tenants").doc(held).set({...fixedBase,slug:held,
   m7FinanceAccessStatus:"suspended",
   m7FinanceAccessReason:"m7_overdue_invoice"}),
  db.collection("tenantSlugs").doc(held).set({tenantId:held,
   subscriptionStatus:"active",active:true,subscriptionExpiresAt:stored,
   gracePeriodDays:0}),
  db.collection("tenants").doc(empty).set({
   id:empty,slug:empty,active:false,ownerUid:merchant,
   planCode:"monthly",firstActivatedAt:original,
   subscriptionStatus:"active",
  }),
 ]);
 await sub.syncExpiredTenants.run({});
 const freshGood=(await db.collection("tenants").doc(good).get()).data();
 const freshIndex=(await db.collection("tenantSlugs").doc(good).get()).data();
 assert.equal(freshGood.subscriptionStatus,"expired");
 assert.equal(freshGood.active,false);
 assert.equal(freshIndex.subscriptionStatus,"expired");
 assert.equal(freshIndex.active,false);
 assert.equal(freshIndex.subscriptionExpiresAt.toMillis(),stored.toMillis());
 const stale=(await db.collection("tenants").doc(missing).get()).data();
 assert.equal(stale.subscriptionStatus,"active");
 assert.equal(stale.active,true);
 const blocked=(await db.collection("tenants").doc(held).get()).data();
 assert.equal(blocked.active,false);
 assert.equal(blocked.m7FinanceAccessStatus,"suspended");
 assert.equal(blocked.m7FinanceAccessReason,"m7_overdue_invoice");
 const old=(await db.collection("tenants").doc(empty).get()).data();
 assert.equal(old.subscriptionExpiresAt,undefined);
 assert.equal(old.firstActivatedAt.toMillis(),original.toMillis());
});
