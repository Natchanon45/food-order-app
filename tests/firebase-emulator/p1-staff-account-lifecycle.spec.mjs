import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {getApps,initializeApp}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const {getFirestore}=require("firebase-admin/firestore");
const service=require("./staff-admin");
const policy=require("./staff-operation-policy");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
  !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||"")||
  !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||""))
 throw Error("P13B_STAFF_REQUIRES_ISOLATED_DEMO_AUTH_FIRESTORE_EMULATORS");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),auth=getAuth();
const suffix=randomUUID().slice(0,8);
const owner="p13b-owner-"+randomUUID(),outsider="p13b-other-"+randomUUID(),
  suspended="p13b-suspended-"+randomUUID(),staffActor="p13b-nonowner-"+randomUUID(),
  tenantId="p13b-tenant-"+randomUUID(),foreignId="p13b-other-tenant-"+randomUUID();
const tenantRef=db.collection("tenants").doc(tenantId);
const actor=uid=>({auth:{uid}});
const create=(emailSuffix="new",params={})=>({
  expectedTenantId:tenantId,operationId:randomUUID(),displayName:"New Staff Member",
  email:"p13b-"+suffix+"-"+emailSuffix+"@example.test",password:"EmulatorOnlyPassword1234!",
  role:"cashier",businessScope:"order_delivery",active:true,...params,
});
const update=(uid,expectedRevision=1,params={})=>({
  expectedTenantId:tenantId,operationId:randomUUID(),uid,expectedRevision,
  displayName:"Renamed Team Member",role:"kitchen",businessScope:"retail_pos",
  active:false,...params,
});
const runCreate=(uid,input)=>service.createTenantStaff.run({...actor(uid),data:input});
const runUpdate=(uid,input)=>service.updateTenantStaff.run({...actor(uid),data:input});
const status=(uid,input,expectedTenantId=tenantId)=>
  service.getTenantStaffOperationStatus.run({...actor(uid),data:{
    expectedTenantId,operationId:input.operationId,
  }});
const operation=id=>tenantRef.collection("staffOperations").doc(id);
const membership=uid=>tenantRef.collection("memberships").doc(uid);
const account=uid=>db.collection("users").doc(uid);
let firstStaffUid="";
test("seed two tenants, active Owner, disabled Owner, outsider and non-owner using demo Auth",async()=>{
 await Promise.all([
  auth.createUser({uid:owner,email:"p13b-owner-"+suffix+"@example.test",
   password:"EmulatorOnlyPassword1234!",displayName:"Owner",disabled:false}),
  auth.createUser({uid:outsider,email:"p13b-outsider-"+suffix+"@example.test",
   password:"EmulatorOnlyPassword1234!",displayName:"Other Owner",disabled:false}),
  auth.createUser({uid:suspended,email:"p13b-suspended-"+suffix+"@example.test",
   password:"EmulatorOnlyPassword1234!",displayName:"Suspended Owner",disabled:true}),
  auth.createUser({uid:staffActor,email:"p13b-staff-"+suffix+"@example.test",
   password:"EmulatorOnlyPassword1234!",displayName:"Staff Actor",disabled:false}),
 ]);
 await Promise.all([
  account(owner).set({uid:owner,tenantId,role:"owner",active:true}),
  account(outsider).set({uid:outsider,tenantId:foreignId,role:"owner",active:true}),
  account(suspended).set({uid:suspended,tenantId,role:"owner",active:true}),
  account(staffActor).set({uid:staffActor,tenantId,role:"cashier",active:true}),
  tenantRef.set({id:tenantId,slug:"p13b-"+suffix,name:"Test Restaurant",
   ownerUid:owner,active:true,onboardingRequired:false,planCode:"yearly",
   m7InvoiceUnpaidCents:430075,bankAccountNumber:"never-change"}),
  db.collection("tenants").doc(foreignId).set({id:foreignId,slug:"foreign-"+suffix,
   name:"Other Tenant",ownerUid:outsider,active:true}),
  membership(owner).set({uid:owner,tenantId,role:"owner",active:true}),
 ]);
});
test("unauthorized, inactive, disabled and foreign actors cannot reserve staff operations",async()=>{
 const candidate=create("invalid");
 for(const uid of [outsider,suspended,staffActor]){
  await assert.rejects(runCreate(uid,candidate),
    e=>e.code==="permission-denied");
 }
 await assert.rejects(runCreate(owner,{...candidate,expectedTenantId:foreignId}),
   e=>e.code==="permission-denied");
 await assert.rejects(status(outsider,candidate),
   e=>e.code==="permission-denied");
 assert.equal((await operation(candidate.operationId).get()).exists,false);
});
test("create one real native Auth staff account plus both Firestore mirrors with immutable reservation",async()=>{
 const input=create("first");
 const result=await runCreate(owner,input);
 assert.equal(result.ok,true);
 assert.equal(result.operationId,input.operationId);
 assert.equal(result.pendingIndependentVerification,true);
 assert.equal(result.emailSent,false);
 firstStaffUid=result.uid;
 assert.equal(firstStaffUid,policy.uidFor(input.operationId));
 const native=await auth.getUser(firstStaffUid);
 assert.equal(native.email,input.email);
 assert.equal(native.emailVerified,false);
 assert.equal(native.disabled,false);
 const user=(await account(firstStaffUid).get()).data();
 const member=(await membership(firstStaffUid).get()).data();
 assert.equal(user.staffRevision,1);
 assert.equal(user.role,"cashier");
 assert.equal(member.tenantId,tenantId);
 assert.deepEqual(policy.view(member),policy.view(user));
 const op=(await operation(input.operationId).get()).data();
 assert.equal(op.status,"complete");
 assert.equal(op.actor,owner);
 assert.equal(JSON.stringify(op).includes(input.password),false);
 const checked=await status(owner,input);
 assert.equal(checked.status,"complete_verified");
 assert.equal(checked.staffRevision,1);
 assert.equal(checked.canSendEmail,false);
 assert.equal(JSON.stringify(checked).includes(input.email),false);
 assert.equal((await tenantRef.get()).data().m7InvoiceUnpaidCents,430075);
 assert.equal((await tenantRef.get()).data().bankAccountNumber,"never-change");
 const rows=await service.listTenantStaff.run({...actor(owner),data:{expectedTenantId:tenantId}});
 assert.equal(rows.users.find(row=>row.uid===firstStaffUid).staffRevision,1);
});
test("duplicate operation never creates a second Auth user; email lock rejects fresh UUID",async()=>{
 const uid=firstStaffUid;
 const first=(await tenantRef.collection("staffOperations")
  .where("staffUid","==",uid).limit(1).get()).docs[0].data();
 const original={...create("first"),operationId:first.operationId};
 await assert.rejects(runCreate(owner,original),e=>e.code==="already-exists");
 await assert.rejects(runCreate(owner,create("first")),e=>e.code==="already-exists");
 assert.equal((await account(uid).get()).exists,true);
});
test("two distinct UUIDs racing the same email create exactly one account",async()=>{
 const a=create("race"),b=create("race");
 const results=await Promise.allSettled([runCreate(owner,a),runCreate(owner,b)]);
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
 assert.equal(results.filter(r=>r.status==="rejected").length,1);
 assert.equal(results.find(r=>r.status==="rejected").reason.code,"already-exists");
 const success=results.find(r=>r.status==="fulfilled").value;
 const op=(await operation(success.operationId).get()).data();
 assert.equal(op.status,"complete");
 assert.equal((await account(success.uid).get()).exists,true);
 const hash=policy.emailLockKey(a.email);
 assert.equal((await db.collection("staffEmailReservations").doc(hash).get()).data().staffUid,
   success.uid);
});
test("five concurrent same UUID requests have only one Auth create and never reapply",async()=>{
 const input=create("same-uuid");
 const runs=await Promise.allSettled(Array.from({length:5},()=>runCreate(owner,input)));
 assert.equal(runs.filter(r=>r.status==="fulfilled").length,1);
 assert.equal(runs.filter(r=>r.status==="rejected").length,4);
 assert.ok(runs.filter(r=>r.status==="rejected").every(r=>r.reason.code==="already-exists"));
 const uid=policy.uidFor(input.operationId);
 assert.equal((await account(uid).get()).exists,true);
 assert.equal((await status(owner,input)).status,"complete_verified");
});
test("update role/scope/suspended status with native Auth and Firestore consistency proof",async()=>{
 const cmd=update(firstStaffUid);
 const done=await runUpdate(owner,cmd);
 assert.equal(done.ok,true);
 assert.equal(done.pendingIndependentVerification,true);
 let verified=await status(owner,cmd);
 assert.equal(verified.status,"complete_verified");
 assert.equal(verified.staffRevision,2);
 let native=await auth.getUser(firstStaffUid);
 assert.equal(native.disabled,true);
 assert.equal(native.displayName,"Renamed Team Member");
 let user=(await account(firstStaffUid).get()).data();
 let member=(await membership(firstStaffUid).get()).data();
 assert.equal(user.staffRevision,2);
 assert.equal(user.businessScope,"retail_pos");
 assert.equal(user.role,"kitchen");
 assert.deepEqual(policy.view(user),policy.view(member));
 assert.equal((await tenantRef.collection("staffAccountLocks").doc(firstStaffUid).get()).exists,false);
 const resume=update(firstStaffUid,2,{displayName:"Back Online",
   role:"cashier",businessScope:"both",active:true});
 await runUpdate(owner,resume);
 verified=await status(owner,resume);
 assert.equal(verified.status,"complete_verified");
 assert.equal(verified.staffRevision,3);
 native=await auth.getUser(firstStaffUid);
 assert.equal(native.disabled,false);
 assert.equal(native.displayName,"Back Online");
});
test("stale revisions, owner edits and cross-tenant staff edits never mutate user",async()=>{
 const before=policy.view((await account(firstStaffUid).get()).data());
 const stale=update(firstStaffUid,1);
 await assert.rejects(runUpdate(owner,stale),e=>e.code==="failed-precondition");
 await assert.rejects(runUpdate(owner,update(owner,0)),e=>e.code==="invalid-argument");
 await assert.rejects(runUpdate(outsider,update(firstStaffUid,3)),
   e=>e.code==="permission-denied");
 assert.deepEqual(policy.view((await account(firstStaffUid).get()).data()),before);
 assert.equal((await operation(stale.operationId).get()).exists,false);
});
test("missing native Auth identity rejects edit before creating a permanent staff lock",async()=>{
 const uid="p13b-missing-auth-"+randomUUID();
 const data={uid,tenantId,displayName:"Legacy Staff",email:"legacy-"+suffix+"@example.test",
   role:"cashier",active:true,businessScope:"order_delivery",staffRevision:0};
 await Promise.all([account(uid).set(data),membership(uid).set(data)]);
 const cmd=update(uid,0);
 await assert.rejects(runUpdate(owner,cmd),e=>e.code==="failed-precondition");
 assert.equal((await operation(cmd.operationId).get()).exists,false);
 assert.equal((await tenantRef.collection("staffAccountLocks").doc(uid).get()).exists,false);
});

test("definitive pre-existing Auth email rejection releases exact claim without deleting unrelated Auth",async()=>{
 const input=create("duplicate-auth",{email:"p13b-owner-"+suffix+"@example.test"});
 await assert.rejects(runCreate(owner,input),e=>e.code==="already-exists");
 const checked=await status(owner,input);
 assert.equal(checked.status,"failed_released");
 assert.equal(checked.mayRetryWithNewOperationId,true);
 assert.equal((await account(policy.uidFor(input.operationId)).get()).exists,false);
 assert.equal((await db.collection("staffEmailReservations")
  .doc(policy.emailLockKey(input.email)).get()).exists,false);
 assert.equal((await auth.getUser(owner)).disabled,false);
});
test("unknown operation is never considered safe to replay",async()=>{
 const missing=create("missing");
 const result=await status(owner,missing);
 assert.equal(result.status,"not_found");
 assert.equal(result.mayRetryWithNewOperationId,false);
});
test("reserved create without Auth is pending; reserved create with Auth-only is review_required",async()=>{
 const pending=create("pending"),uid=policy.uidFor(pending.operationId);
 await operation(pending.operationId).set({operationId:pending.operationId,
  kind:"create",tenantId,actor:owner,staffUid:uid,
  status:"reserved",emailLockId:policy.emailLockKey(pending.email),
  after:{uid,email:pending.email,displayName:pending.displayName,role:"cashier",
    businessScope:"order_delivery",staffRevision:1,active:true}});
 await db.collection("staffEmailReservations").doc(policy.emailLockKey(pending.email)).set({
  operationId:pending.operationId,tenantId,status:"reserved",staffUid:uid});
 assert.equal((await status(owner,pending)).status,"pending_review");
 await auth.createUser({uid,email:pending.email,password:"EmulatorOnlyPassword1234!",
  displayName:pending.displayName});
 assert.equal((await status(owner,pending)).status,"review_required");
 await assert.rejects(runCreate(owner,create("pending")),e=>e.code==="already-exists");
});
test("reserved update after Auth-only change remains blocked, never falsely claims paid or complete",async()=>{
 const before=(await account(firstStaffUid).get()).data();
 const input=update(firstStaffUid,before.staffRevision,
  {displayName:"Partial Auth Only"});
 const after={...policy.view(before),displayName:"Partial Auth Only",
  staffRevision:before.staffRevision+1};
 await operation(input.operationId).set({operationId:input.operationId,
  kind:"update",tenantId,actor:owner,staffUid:firstStaffUid,
  status:"reserved",after});
 await tenantRef.collection("staffAccountLocks").doc(firstStaffUid).set({
  operationId:input.operationId,tenantId,actor:owner});
 await auth.updateUser(firstStaffUid,{displayName:"Partial Auth Only",disabled:true});
 const looked=await status(owner,input);
 assert.equal(looked.status,"review_required");
 assert.equal(looked.canSettleMoney,false);
 await assert.rejects(runUpdate(owner,update(firstStaffUid,before.staffRevision)),
  e=>e.code==="failed-precondition");
 assert.equal((await account(firstStaffUid).get()).data().staffRevision,
  before.staffRevision);
});
test("browser Superadmin cannot read or forge any staff receipts, locks or email reservation",async()=>{
 const {initializeApp:appInit,deleteApp}=await import("firebase/app");
 const {getAuth:clientAuth,connectAuthEmulator,signInWithEmailAndPassword}=
  await import("firebase/auth");
 const {getFirestore:clientDb,connectFirestoreEmulator,
  getDoc,setDoc,doc:ref}=await import("firebase/firestore");
 const uid="p13b-browser-"+randomUUID(),email="p13b-browser-"+suffix+"@example.test";
 await auth.createUser({uid,email,password:"EmulatorOnlyPassword1234!",disabled:false});
 await account(uid).set({uid,role:"super_admin",active:true});
 const app=appInit({apiKey:"demo-api-key",projectId:"demo-penguin-hybrid",
  appId:"1:123:web:"+randomUUID(),authDomain:"demo-penguin-hybrid.firebaseapp.com"},
  "p13b-browser-"+randomUUID());
 try{
  const localAuth=clientAuth(app);
  connectAuthEmulator(localAuth,"http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST,
   {disableWarnings:true});
  await signInWithEmailAndPassword(localAuth,email,"EmulatorOnlyPassword1234!");
  const localDb=clientDb(app),[host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(localDb,host,Number(port));
  for(const location of [
    ["staffEmailReservations",policy.emailLockKey("blocked@example.test")],
    ["tenants",tenantId,"staffOperations",randomUUID()],
    ["tenants",tenantId,"staffAccountLocks","any-staff"],
  ]){
    const doc=ref(localDb,...location);
    await assert.rejects(getDoc(doc),e=>e.code==="permission-denied");
    await assert.rejects(setDoc(doc,{status:"complete",actor:uid}),
      e=>e.code==="permission-denied");
  }
 }finally{await deleteApp(app);}
});
