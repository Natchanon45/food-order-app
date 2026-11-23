import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {getApps,initializeApp}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
const api=require("./tenant-access-evidence");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||"")||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||""))
 throw Error("P12E_REQUIRES_DEMO_FIRESTORE_AND_AUTH_EMULATORS");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),native=getAuth();
const superadmin="p12e-super-"+randomUUID();
const other="p12e-other-"+randomUUID();
const viewer="p12e-viewer-"+randomUUID();
const disabled="p12e-disabled-"+randomUUID();
const tenantId="p12e-tenant-"+randomUUID();
const tenantIdOther="p12e-other-tenant-"+randomUUID();
const slug="p12e-"+randomUUID().slice(0,10);
const slugOther="p12e-"+randomUUID().slice(0,10);
const ref=db.collection("tenants").doc(tenantId);
const mirror=db.collection("tenantSlugs").doc(slug);
const prior="2026-10-18T03:30:00.000Z",ends="2027-11-17T16:59:59.999Z";
const seed={
 id:tenantId,slug,name:"Merchant access",ownerUid:viewer,
 active:true,subscriptionStatus:"active",planCode:"yearly",
 firstActivatedAt:prior,trialStartsAt:prior,
 subscriptionExpiresAt:ends,gracePeriodDays:3,
 m7FinanceAccessStatus:"not_suspended",
 m7AdminTestOverrideMode:"auto",
 bankAccountNumber:"999988887777",bankSecret:"private-merchant-token",
 m7MaturedInvoiceHolds:2,m7InvoiceUnpaidCents:78999900,
};
const bankFree={
 tenantId,active:true,subscriptionStatus:"active",
 subscriptionExpiresAt:ends,gracePeriodDays:3,
};
const ask=(uid,tenant=tenantId)=>
 api.getPlatformTenantAccessEvidence.run({
  auth:uid?{uid}:null,data:{tenantId:tenant},
 });
test("setup authenticated Superadmin + two tenant profiles and slug mirrors",async()=>{
 await Promise.all([
  db.collection("users").doc(superadmin).set({role:"super_admin",active:true}),
  db.collection("users").doc(other).set({role:"super_admin",active:true}),
  db.collection("users").doc(viewer).set({role:"owner",active:true}),
  db.collection("users").doc(disabled).set({role:"super_admin",active:false}),
  ref.set(seed),mirror.set(bankFree),
  db.collection("tenants").doc(tenantIdOther).set({
   ...seed,id:tenantIdOther,slug:slugOther,name:"Other shop",m7InvoiceUnpaidCents:0,
  }),
  db.collection("tenantSlugs").doc(slugOther).set({
   ...bankFree,tenantId:tenantIdOther,
  }),
 ]);
 assert.equal((await ref.get()).exists,true);
});
test("Superadmin-only, inactive/owner/anonymous denied even though report has no writes",async()=>{
 const first=await ask(superadmin);
 assert.equal(first.ok,true);
 assert.equal(first.superadminOnly,true);
 assert.equal(first.authenticated,true);
 assert.equal(first.readOnly,true);
 for(const actor of [viewer,disabled]){
  await assert.rejects(ask(actor),e=>e.code==="permission-denied");
 }
 await assert.rejects(ask(null),e=>e.code==="unauthenticated");
 await assert.rejects(api.getPlatformTenantAccessEvidence.run({
  auth:{uid:superadmin},data:{tenantId:"../invalid"},
 }),e=>e.code==="invalid-argument");
 await assert.rejects(api.getPlatformTenantAccessEvidence.run({
  auth:{uid:superadmin},data:{tenantId,canReleaseTenant:true},
 }),e=>e.code==="invalid-argument");
});
test("snapshot is metadata-only and never leaks bank account, payment, Owner data, or certified balances",async()=>{
 const result=await ask(superadmin);
 assert.equal(result.state,"no_recorded_restriction_unverified");
 assert.equal(result.tenantSlugCoherent,true);
 assert.deepEqual(result.reasonCodes,[]);
 assert.match(result.snapshotDigest,/^[a-f0-9]{64}$/);
 assert.equal(result.certifiedOpenInvoiceCount,null);
 assert.equal(result.certifiedOutstandingCents,null);
 assert.equal(result.canSell,null);
 assert.equal(result.canReleaseTenant,false);
 assert.equal(result.canIssueInvoice,false);
 assert.equal(result.canSettleMoney,false);
 assert.equal(result.canApplyCredit,false);
 assert.equal(result.writesPerformed,false);
 for(const secret of ["999988887777","private-merchant-token","78999900",
  viewer,"Other shop"])assert.ok(!JSON.stringify(result).includes(secret));
});
test("manual security hold recorded independently from TEST override allow; no Finance release",async()=>{
 await ref.update({active:false,suspensionReason:"security_manual",
  m7AdminTestOverrideMode:"allow",m7FinanceAccessStatus:"suspended",
  m7FinanceAccessReason:"m7_overdue_invoice"});
 await mirror.update({active:false});
 const result=await ask(superadmin);
 assert.equal(result.state,"recorded_restriction");
 for(const code of ["TENANT_INACTIVE","MANUAL_SECURITY_SUSPENSION",
  "M7_RECORDED_HOLD_UNVERIFIED","TEST_OVERRIDE_METADATA_ONLY"])
   assert.ok(result.reasonCodes.includes(code));
 assert.equal(result.testOverrideRecorded,"allow");
 assert.equal(result.canSell,null);
 assert.equal(result.canReleaseTenant,false);
 await ref.update({active:true,suspensionReason:"",
  m7AdminTestOverrideMode:"auto",m7FinanceAccessStatus:"not_suspended",
  m7FinanceAccessReason:"none"});
 await mirror.update({active:true});
});
test("subscription past grace is recorded independently from financial claims; no fake Paid",async()=>{
 const old="2025-11-17T16:59:59.999Z";
 await Promise.all([
  ref.update({subscriptionExpiresAt:old,subscriptionStatus:"active",gracePeriodDays:3}),
  mirror.update({subscriptionExpiresAt:old}),
 ]);
 const result=await ask(superadmin);
 assert.ok(result.reasonCodes.includes("LEGACY_MEMBERSHIP_EXPIRED"));
 assert.equal(result.state,"recorded_restriction");
 assert.equal(result.canSettleMoney,false);
 await Promise.all([ref.update({subscriptionExpiresAt:ends}),
  mirror.update({subscriptionExpiresAt:ends})]);
});
test("independent Revenue Share and Hybrid states cannot be unlocked by unrelated status fields",async()=>{
 await ref.update({revenueShareSuspended:true,hybridBillingSuspended:true,
  m7FinanceAccessStatus:"not_suspended"});
 const result=await ask(superadmin);
 assert.equal(result.state,"recorded_restriction");
 assert.ok(result.reasonCodes.includes("LEGACY_DELIVERY_SHARE_HOLD"));
 assert.ok(result.reasonCodes.includes("HYBRID_BILLING_HOLD"));
 assert.equal(result.sourceOriginalHoldSignatureVerified,false);
 await ref.update({revenueShareSuspended:false,hybridBillingSuspended:false});
});
test("no Slug or foreign ownership -> review_required, never guess access",async()=>{
 const before=(await mirror.get()).data();
 await mirror.delete();
 const missing=await ask(superadmin);
 assert.equal(missing.state,"review_required");
 assert.equal(missing.tenantSlugCoherent,false);
 assert.ok(missing.reasonCodes.includes("TENANT_SLUG_INDEX_MISSING"));
 await mirror.set({...before,tenantId:tenantIdOther});
 const foreign=await ask(superadmin);
 assert.equal(foreign.state,"review_required");
 assert.ok(foreign.reasonCodes.includes("TENANT_SLUG_INDEX_CONFLICT"));
 await mirror.set(before);
});
test("stale mirror fields or malformed M7 status require review with no financial authority",async()=>{
 await mirror.update({gracePeriodDays:5});
 const stale=await ask(superadmin);
 assert.equal(stale.state,"review_required");
 assert.equal(stale.canSell,null);
 assert.ok(stale.reasonCodes.includes("TENANT_SLUG_INDEX_CONFLICT"));
 await mirror.update({gracePeriodDays:3});
 await ref.update({m7FinanceAccessStatus:"paid_and_unlocked"});
 const strange=await ask(superadmin);
 assert.equal(strange.state,"review_required");
 assert.ok(strange.reasonCodes.includes("FINANCIAL_STATE_UNKNOWN"));
 await ref.update({m7FinanceAccessStatus:"not_suspended"});
});
test("read-only projection has stable digest after parallel reads; no mutation or receipt collection created",async()=>{
 const before=(await ref.get()).data();
 const results=await Promise.all(Array.from({length:8},()=>ask(superadmin)));
 assert.equal(new Set(results.map(x=>x.snapshotDigest)).size,1);
 assert.ok(results.every(x=>x.writesPerformed===false));
 assert.deepEqual((await ref.get()).data(),before);
 assert.equal((await ref.collection("tenantAccessEvidences").get()).empty,true);
 assert.equal((await ref.collection("subscriptionAdminActions").get()).empty,true);
});
test("Superadmin may read a different tenant but never see its bank, owner or financial amount",async()=>{
 const a=await ask(superadmin,tenantId);
 const b=await ask(superadmin,tenantIdOther);
 assert.equal(a.tenantId,tenantId);
 assert.equal(b.tenantId,tenantIdOther);
 assert.notEqual(a.snapshotDigest,b.snapshotDigest);
 assert.equal(JSON.stringify(b).includes(viewer),false);
 assert.equal(JSON.stringify(b).includes("Merchant access"),false);
 assert.equal(b.certifiedOutstandingCents,null);
 await assert.rejects(ask(superadmin,"p12e-nonexistent-"+randomUUID()),
  e=>e.code==="not-found");
});
test("logged-in Superadmin cannot spoof signed financial access or TEST override in Firestore browser",async()=>{
 const {initializeApp:clientApp,deleteApp}=await import("firebase/app");
 const {getAuth:clientAuth,connectAuthEmulator,signInWithEmailAndPassword}=
  await import("firebase/auth");
 const {getFirestore:clientDb,connectFirestoreEmulator,
  updateDoc,doc:clientRef}=await import("firebase/firestore");
 const uid="p12e-client-"+randomUUID();
 const email="p12e-client-"+randomUUID()+"@example.test";
 const password="Only-demo-emulator-12345!";
 await native.createUser({uid,email,password});
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 const app=clientApp({apiKey:"demo-api-key",projectId:"demo-penguin-hybrid",
  appId:"1:123:web:"+randomUUID(),authDomain:"demo-penguin-hybrid.firebaseapp.com"},
  "p12e-app-"+randomUUID());
 try{
  const auth=clientAuth(app);
  connectAuthEmulator(auth,"http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST,
   {disableWarnings:true});
  await signInWithEmailAndPassword(auth,email,password);
  const fire=clientDb(app),[host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(fire,host,Number(port));
  const target=clientRef(fire,"tenants",tenantId);
  for(const patch of [
   {m7FinanceAccessStatus:"suspended"},
   {m7FinanceAccessReason:"m7_overdue_invoice"},
   {m7AdminTestOverrideMode:"allow"},
   {m7InvoiceUnpaidCents:100},
   {revenueShareSuspended:true},
  ]){
   await assert.rejects(updateDoc(target,patch),
    e=>e.code==="permission-denied");
  }
  await assert.rejects(updateDoc(clientRef(fire,"tenantSlugs",slug),
   {active:false}),e=>e.code==="permission-denied");
 }finally{await deleteApp(app);}
});
