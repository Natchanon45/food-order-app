"use strict";
// P1.3b: Firebase Auth + Firestore are NOT one transaction. Never retry an
// ambiguous Auth mutation; a durable server reservation owns the pending work.
const {onCall,HttpsError}=require("./managed-email-callable");
const {getAuth}=require("firebase-admin/auth");
const {getFirestore,Timestamp}=require("firebase-admin/firestore");
const policy=require("./staff-operation-policy");
const opts={region:"asia-southeast1",timeoutSeconds:60,memory:"512MiB"};
const fail=(code,message)=>new HttpsError(code,message);
const errorInput=(fn,data)=>{
 try{return fn(data);}catch(e){throw fail("invalid-argument",e.code||"STAFF_INPUT_INVALID");}
};
function refs(db,tenantId,uid){
 const tenant=db.collection("tenants").doc(tenantId);
 return {tenant,account:db.collection("users").doc(uid),
  member:tenant.collection("memberships").doc(uid),
  lock:tenant.collection("staffAccountLocks").doc(uid)};
}
async function authorized(db,auth,expectedTenantId,nativeAuth){
 const uid=String(auth?.uid||"");
 if(!policy.ID.test(uid))throw fail("unauthenticated","Sign in required");
 const profileSnap=await db.collection("users").doc(uid).get();
 const profile=profileSnap.data()||{};
 if(profile.role!=="owner"||profile.active!==true||
    profile.tenantId!==expectedTenantId)
   throw fail("permission-denied","Active tenant Owner required");
 const tenantSnap=await db.collection("tenants").doc(expectedTenantId).get();
 const tenant=tenantSnap.data()||{};
 if(!tenantSnap.exists||tenant.ownerUid!==uid||tenant.active!==true)
   throw fail("permission-denied","Canonical active tenant Owner required");
 let native;
 try{native=await nativeAuth.getUser(uid);}catch{
   throw fail("permission-denied","Owner Auth identity unavailable");
 }
 if(native.uid!==uid||native.disabled===true)
   throw fail("permission-denied","Owner Auth identity disabled");
 if(profile.emailVerificationRequired===true&&native.emailVerified!==true)
   throw fail("permission-denied","Owner email verification required");
 return {uid,tenant:{id:expectedTenantId,slug:String(tenant.slug||""),
  name:String(tenant.name||"")}};
}
async function reservationActor(tx,db,uid,tenantId){
 const actor=await tx.get(db.collection("users").doc(uid));
 const tenant=await tx.get(db.collection("tenants").doc(tenantId));
 if(!actor.exists||actor.data()?.role!=="owner"||
    actor.data()?.active!==true||actor.data()?.tenantId!==tenantId||
    !tenant.exists||tenant.data()?.active!==true||
    tenant.data()?.ownerUid!==uid)
   throw fail("permission-denied","Owner/tenant changed while saving");
}
function recordBase({input,actor,staffUid,after,now}){
 return {operationId:input.operationId,kind:input.kind,
   tenantId:input.expectedTenantId,actor,staffUid,after,
   status:"reserved",createdAt:now,updatedAt:now,
   ...(input.kind==="create"?{emailLockId:policy.emailLockKey(input.email)}:{})};
}
async function create({db,nativeAuth,identity,data}){
 // Check signed-in tenant authority before returning validation details.
 const caller=await authorized(db,identity,String(data?.expectedTenantId||""),nativeAuth);
 const input=errorInput(policy.createInput,data);
 const tenantId=input.expectedTenantId,staffUid=policy.uidFor(input.operationId);
 const {tenant,account,member}=refs(db,tenantId,staffUid);
 const operation=tenant.collection("staffOperations").doc(input.operationId);
 const emailLock=db.collection("staffEmailReservations").doc(policy.emailLockKey(input.email));
 const after={uid:staffUid,email:input.email,displayName:input.displayName,
  role:input.role,businessScope:input.businessScope,active:input.active,
  staffRevision:1};
 await db.runTransaction(async tx=>{
  const [op,claim,user,membership]=await Promise.all([
   tx.get(operation),tx.get(emailLock),tx.get(account),tx.get(member)]);
  await reservationActor(tx,db,caller.uid,tenantId);
  if(op.exists)throw fail("already-exists","STAFF_OPERATION_ALREADY_EXISTS_CHECK_STATUS");
  if(claim.exists)throw fail("already-exists","STAFF_EMAIL_ALREADY_RESERVED");
  if(user.exists||membership.exists)
    throw fail("already-exists","STAFF_DETERMINISTIC_UID_ALREADY_USED");
  const now=Timestamp.now();
  tx.create(operation,recordBase({input,actor:caller.uid,staffUid,after,now}));
  tx.create(emailLock,{operationId:input.operationId,tenantId,staffUid,
    actor:caller.uid,status:"reserved",createdAt:now});
 });
 let authUser;
 try{
  authUser=await nativeAuth.createUser({uid:staffUid,email:input.email,
    password:input.password,displayName:input.displayName,disabled:!input.active,
    emailVerified:false});
 }catch(error){
  // Only a definite Auth rejection AND a confirmed absent deterministic UID
  // permits release. A timeout/unknown exception leaves the claim reserved.
  const definite=["auth/email-already-exists","auth/invalid-email",
    "auth/invalid-password"].includes(error?.code);
  if(definite){
   let absent=false;
   try{await nativeAuth.getUser(staffUid);}
   catch(e){absent=e?.code==="auth/user-not-found";}
   if(absent){
    await db.runTransaction(async tx=>{
     const [op,claim,user,membership]=await Promise.all([
      tx.get(operation),tx.get(emailLock),tx.get(account),tx.get(member)]);
     await reservationActor(tx,db,caller.uid,tenantId);
     if(op.data()?.status!=="reserved"||op.data()?.actor!==caller.uid||
        claim.data()?.operationId!==input.operationId||
        user.exists||membership.exists)
       throw fail("failed-precondition","STAFF_RELEASE_REQUIRES_REVIEW");
     tx.update(operation,{status:"failed_released",
       releaseReason:"AUTH_CREATE_DEFINITIVE_REJECTION",updatedAt:Timestamp.now()});
     tx.delete(emailLock);
    });
    throw fail(error.code==="auth/email-already-exists"?"already-exists":
      "invalid-argument","STAFF_AUTH_DEFINITIVE_REJECTED");
   }
  }
  throw fail("failed-precondition","STAFF_AUTH_CREATE_REVIEW_REQUIRED");
 }
 if(authUser.uid!==staffUid)
   throw fail("failed-precondition","STAFF_AUTH_UID_REVIEW_REQUIRED");
 const now=Timestamp.now();
 const payload={...after,tenantId,tenantSlug:caller.tenant.slug,
  tenantName:caller.tenant.name,staffScope:"restaurant",
  businessUnit:policy.unit(after.businessScope),source:after.businessScope,
  createdBy:caller.uid,createdAt:now,updatedAt:now,
  emailVerificationRequired:true};
 try{
  await db.runTransaction(async tx=>{
   const [op,claim,user,membership]=await Promise.all([
    tx.get(operation),tx.get(emailLock),tx.get(account),tx.get(member)]);
   await reservationActor(tx,db,caller.uid,tenantId);
   if(op.data()?.status!=="reserved"||op.data()?.actor!==caller.uid||
      claim.data()?.operationId!==input.operationId||
      user.exists||membership.exists)
     throw fail("failed-precondition","STAFF_FINALIZATION_REQUIRES_REVIEW");
   tx.create(account,payload);
   tx.create(member,payload);
   tx.update(operation,{status:"complete",completedAt:Timestamp.now(),
     updatedAt:Timestamp.now()});
   tx.update(emailLock,{status:"complete",completedAt:Timestamp.now()});
  });
 }catch{
  // No automatic Auth deletion on a lost Firestore response. An Auth account
  // may be real; status inspection must verify it against both mirror docs.
  throw fail("failed-precondition","STAFF_CREATE_OUTCOME_REVIEW_REQUIRED");
 }
 return {ok:true,operationId:input.operationId,uid:staffUid,
   pendingIndependentVerification:true,emailSent:false};
}
async function update({db,nativeAuth,identity,data}){
 // Check signed-in tenant authority before returning validation details.
 const caller=await authorized(db,identity,String(data?.expectedTenantId||""),nativeAuth);
 const input=errorInput(policy.updateInput,data);
 if(input.uid===caller.uid)throw fail("invalid-argument","STAFF_OWNER_SELF_EDIT_FORBIDDEN");
 // An already-missing/disabled/mismatched Auth account must be reconciled
 // before creating any irreversible per-staff operation lock.
 let originalAuth;
 try{originalAuth=await nativeAuth.getUser(input.uid);}
 catch{throw fail("failed-precondition","STAFF_NATIVE_AUTH_NOT_VERIFIED");}
 const {tenant,account,member,lock}=refs(db,input.expectedTenantId,input.uid);
 const operation=tenant.collection("staffOperations").doc(input.operationId);
 const after={uid:input.uid,displayName:input.displayName,
  role:input.role,businessScope:input.businessScope,active:input.active,
  staffRevision:input.expectedRevision+1};
 await db.runTransaction(async tx=>{
  const [op,user,membership,currentLock]=await Promise.all([
   tx.get(operation),tx.get(account),tx.get(member),tx.get(lock)]);
  await reservationActor(tx,db,caller.uid,input.expectedTenantId);
  if(op.exists)throw fail("already-exists","STAFF_OPERATION_ALREADY_EXISTS_CHECK_STATUS");
  if(currentLock.exists)throw fail("failed-precondition","STAFF_ACCOUNT_PENDING_REVIEW");
  if(!user.exists||!membership.exists||
     user.data()?.tenantId!==input.expectedTenantId||
     membership.data()?.tenantId!==input.expectedTenantId||
     !policy.ROLES.includes(user.data()?.role)||
     !policy.matches(membership.data(),policy.view(user.data()),input.expectedTenantId)||
     originalAuth.uid!==input.uid||
     String(originalAuth.email||"").toLowerCase()!==policy.view(user.data()).email||
     originalAuth.displayName!==user.data()?.displayName||
     originalAuth.disabled===(user.data()?.active!==false)||
     policy.revision(user.data())!==input.expectedRevision)
    throw fail("failed-precondition","STAFF_ORIGINAL_RECORD_CHANGED");
  after.email=policy.view(user.data()).email;
  const now=Timestamp.now();
  tx.create(operation,recordBase({input,actor:caller.uid,staffUid:input.uid,
    after,now}));
  tx.create(lock,{operationId:input.operationId,tenantId:input.expectedTenantId,
    actor:caller.uid,createdAt:now});
 });
 try{
  await nativeAuth.updateUser(input.uid,{displayName:after.displayName,
    disabled:!after.active});
 }catch{
  throw fail("failed-precondition","STAFF_AUTH_UPDATE_REVIEW_REQUIRED");
 }
 const patch={displayName:after.displayName,role:after.role,
  businessScope:after.businessScope,businessUnit:policy.unit(after.businessScope),
  source:after.businessScope,active:after.active,staffRevision:after.staffRevision,
  staffScope:"restaurant",updatedBy:caller.uid,updatedAt:Timestamp.now()};
 try{
  await db.runTransaction(async tx=>{
   const [op,user,membership,currentLock]=await Promise.all([
    tx.get(operation),tx.get(account),tx.get(member),tx.get(lock)]);
   await reservationActor(tx,db,caller.uid,input.expectedTenantId);
   if(op.data()?.status!=="reserved"||op.data()?.actor!==caller.uid||
      currentLock.data()?.operationId!==input.operationId||
      !user.exists||!membership.exists||
      user.data()?.tenantId!==input.expectedTenantId||
      !policy.matches(membership.data(),policy.view(user.data()),input.expectedTenantId)||
      policy.revision(user.data())!==input.expectedRevision)
     throw fail("failed-precondition","STAFF_EDIT_FINALIZATION_REVIEW_REQUIRED");
   tx.update(account,patch);
   tx.update(member,patch);
   tx.update(operation,{status:"complete",completedAt:Timestamp.now(),
     updatedAt:Timestamp.now()});
   tx.delete(lock);
  });
 }catch{
  throw fail("failed-precondition","STAFF_EDIT_OUTCOME_REVIEW_REQUIRED");
 }
 return {ok:true,operationId:input.operationId,uid:input.uid,
   pendingIndependentVerification:true};
}
async function inspect({db,nativeAuth,identity,data}){
 const selector=errorInput(policy.statusSelector,data);
 const {uid:actor}=await authorized(db,identity,selector.expectedTenantId,nativeAuth);
 const {tenant}=refs(db,selector.expectedTenantId,actor);
 const operation=tenant.collection("staffOperations").doc(selector.operationId);
 const snap=await operation.get();
 if(!snap.exists)return policy.response({operationId:selector.operationId},"not_found",
   {reason:"UNKNOWN_OPERATION_NEVER_AUTORETRY"});
 const op=snap.data()||{};
 if(op.actor!==actor||op.tenantId!==selector.expectedTenantId)
   throw fail("permission-denied","Staff operation belongs to another actor");
 const invalid=()=>policy.response(op,"review_required",{reason:"RECORD_PROOF_INCOMPLETE"});
 if(!["create","update"].includes(op.kind)||!policy.ID.test(op.staffUid||"")||
    !op.after||op.after.uid!==op.staffUid||
    (op.kind==="create"&&(!op.emailLockId||!/^[a-f0-9]{64}$/.test(op.emailLockId))))return invalid();
 const {account,member,lock}=refs(db,selector.expectedTenantId,op.staffUid);
 const [user,membership,currentLock]=await Promise.all([
  account.get(),member.get(),lock.get()]);
 const after=op.after;
 const firestoreMatches=user.exists&&membership.exists&&
  policy.matches(user.data(),after,selector.expectedTenantId)&&
  policy.matches(membership.data(),after,selector.expectedTenantId);
 let native=null,nativeMissing=false;
 try{native=await nativeAuth.getUser(op.staffUid);}
 catch(e){nativeMissing=e?.code==="auth/user-not-found";if(!nativeMissing)return invalid();}
 const nativeMatches=!!native&&native.uid===op.staffUid&&
  native.displayName===after.displayName&&native.disabled===!after.active&&
  String(native.email||"").toLowerCase()===String(after.email||"");
 if(op.status==="failed_released"&&op.kind==="create"){
  const claim=await db.collection("staffEmailReservations").doc(op.emailLockId).get();
  return op.releaseReason==="AUTH_CREATE_DEFINITIVE_REJECTION"&&
    nativeMissing&&!user.exists&&!membership.exists&&!claim.exists?
    policy.response(op,"failed_released",{reason:op.releaseReason}):invalid();
 }
 if(op.status==="reserved"){
  if(op.kind==="create"){
   const claim=await db.collection("staffEmailReservations").doc(op.emailLockId).get();
   if(claim.data()?.operationId!==op.operationId||
      claim.data()?.tenantId!==selector.expectedTenantId||
      claim.data()?.status!=="reserved")return invalid();
  }else if(currentLock.data()?.operationId!==op.operationId||
      currentLock.data()?.tenantId!==selector.expectedTenantId)return invalid();
  if(!user.exists&&!membership.exists&&nativeMissing)
    return policy.response(op,"pending_review",{reason:"ORIGINAL_COMMAND_MAY_STILL_ARRIVE"});
  if(op.kind==="update"&&user.exists&&membership.exists&&native&&
      policy.matches(membership,policy.view(user.data()),selector.expectedTenantId)&&
      policy.revision(user.data())===after.staffRevision-1 &&
      native.displayName===user.data()?.displayName&&
      native.disabled===(user.data()?.active===false))
    return policy.response(op,"pending_review",{reason:"OPERATION_NOT_COMMITTED_DO_NOT_RETRY"});
  return invalid();
 }
 if(op.status!=="complete"||!firestoreMatches||!nativeMatches)return invalid();
 if(op.kind==="create"){
  const claim=await db.collection("staffEmailReservations").doc(op.emailLockId).get();
  if(claim.data()?.operationId!==op.operationId||
     claim.data()?.tenantId!==selector.expectedTenantId||
     claim.data()?.status!=="complete"||currentLock.exists)return invalid();
 }else if(currentLock.exists)return invalid();
 return policy.response(op,"complete_verified");
}
async function list({db,nativeAuth,identity,data}){
 if(!data||typeof data.expectedTenantId!=="string"||
    !policy.ID.test(data.expectedTenantId)||
    Object.keys(data).length!==1)
   throw fail("invalid-argument","STAFF_LIST_SELECTOR_INVALID");
 const caller=await authorized(db,identity,data.expectedTenantId,nativeAuth);
 const snapshot=await db.collection("tenants").doc(caller.tenant.id)
  .collection("memberships").get();
 return {users:snapshot.docs.map(doc=>({uid:doc.id,...policy.view(doc.data()),
   tenantId:caller.tenant.id})).filter(user=>policy.ROLES.includes(user.role))
   .sort((a,b)=>(a.displayName||a.email).localeCompare(b.displayName||b.email,"th"))};
}
exports.listTenantStaff=onCall(opts,request=>list({db:getFirestore(),
 nativeAuth:getAuth(),identity:request.auth,data:request.data}));
exports.createTenantStaff=onCall(opts,request=>create({db:getFirestore(),
 nativeAuth:getAuth(),identity:request.auth,data:request.data}));
exports.updateTenantStaff=onCall(opts,request=>update({db:getFirestore(),
 nativeAuth:getAuth(),identity:request.auth,data:request.data}));
exports.getTenantStaffOperationStatus=onCall(opts,request=>inspect({db:getFirestore(),
 nativeAuth:getAuth(),identity:request.auth,data:request.data}));
exports._privateForTests={authorized,list,create,update,inspect};
