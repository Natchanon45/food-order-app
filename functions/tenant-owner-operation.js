"use strict";
// P1.3c — Existing Tenant Owner attach and rename. All cross-provider
// uncertainty keeps the reservation; never delete/recreate an unknown Auth UID.
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore,Timestamp}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
const {onboardingDates}=require("./tenant-onboarding-policy");
const {loadPricing}=require("./subscription-pricing-core");
const policy=require("./tenant-owner-operation-policy");
const opts={region:"asia-southeast1",timeoutSeconds:60,memory:"512MiB"};
const err=(code,message)=>new HttpsError(code,message);
function parse(fn,data){
 try{return fn(data);}catch(e){throw err("invalid-argument",e.code||"OWNER_INPUT_INVALID");}
}
async function authorized(db,auth){
 if(!policy.ID.test(auth?.uid||""))throw err("unauthenticated","Login required");
 const profile=(await db.collection("users").doc(auth.uid).get()).data();
 if(profile?.role!=="super_admin"||profile.active!==true)
   throw err("permission-denied","Active Superadmin required");
 return auth.uid;
}
async function transactionActor(tx,db,actor){
 const snap=await tx.get(db.collection("users").doc(actor));
 if(snap.data()?.role!=="super_admin"||snap.data()?.active!==true)
   throw err("permission-denied","Superadmin authorization changed");
}
const refs=(db,tenantId,opId)=>{
 const tenant=db.collection("tenants").doc(tenantId);
 return {tenant,operation:tenant.collection("ownerAccountOperations").doc(opId),
  lock:tenant.collection("ownerAccountLocks").doc("current")};
};
const revision=policy.revision;
function ownerIdentityEmpty(t){
 return !t.ownerUid&&!t.ownerEmail&&!t.ownerDisplayName;
}
function pristinePlaceholder(t){
 return t.active===false&&t.onboardingRequired===true&&
  !["firstActivatedAt","trialStartsAt","trialEndsAt",
    "subscriptionStartedAt","subscriptionExpiresAt","signupBilling",
    "planCode"].some(k=>t[k]!==undefined&&t[k]!==null)&&
  !t.revenueShareSuspended&&!t.m7InvoiceUnpaidCents;
}
function existingActive(t){
 return t.active===true&&t.onboardingRequired!==true&&
  !!t.firstActivatedAt&&!!t.trialStartsAt&&!!t.trialEndsAt&&
  !!t.subscriptionExpiresAt&&["monthly","yearly"].includes(t.planCode);
}
const nativeAbsent=async(nativeAuth,uid)=>{
 try{await nativeAuth.getUser(uid);return false;}
 catch(e){return e?.code==="auth/user-not-found";}
};
async function create({db,nativeAuth,identity,data}){
 const actor=await authorized(db,identity);
 const input=parse(policy.createInput,data);
 const {tenant,operation,lock}=refs(db,input.tenantId,input.operationId);
 const ownerUid=policy.uidFor(input.operationId);
 const slug=db.collection("tenantSlugs").doc(input.expectedSlug);
 const emailLock=db.collection("ownerEmailReservations").doc(policy.emailHash(input.email));
 const account=db.collection("users").doc(ownerUid);
 const member=tenant.collection("memberships").doc(ownerUid);
 if(input.expectedOnboardingRequired){
  // A newly activated tenant must not start a free period before the central
  // subscription pricing has been configured, just like P1.2c.
  const central=await db.collection("platformSettings").doc("subscriptionPricing").get();
  if(!central.exists)throw err("failed-precondition","OWNER_PRICING_REQUIRED");
  const price=await loadPricing(db);
  if(!(price.monthlyPrice>0&&price.deliveryThreshold>0&&
       price.deliveryShareRate>=0&&price.deliveryShareRate<=100))
     throw err("failed-precondition","OWNER_PRICING_INVALID");
 }
 await db.runTransaction(async tx=>{
  const [op,ownerLock,shop,alias,store,claim,user,membership,owners]=await Promise.all([
   tx.get(operation),tx.get(lock),tx.get(tenant),tx.get(slug),
   tx.get(tenant.collection("settings").doc("store")),tx.get(emailLock),
   tx.get(account),tx.get(member),
   tx.get(tenant.collection("memberships").where("role","==","owner").limit(1)),
  ]);
  await transactionActor(tx,db,actor);
  if(op.exists||ownerLock.exists||claim.exists||user.exists||membership.exists)
    throw err("already-exists","OWNER_OPERATION_OR_EMAIL_RESERVED");
  if(!shop.exists||!alias.exists||!store.exists)
    throw err("failed-precondition","OWNER_TENANT_CANONICAL_MISSING");
  const t=shop.data(),aliasData=alias.data();
  if(t.slug!==input.expectedSlug||t.name!==input.expectedName||
     revision(t)!==input.expectedRevision||
     (t.onboardingRequired===true)!==input.expectedOnboardingRequired||
     aliasData.tenantId!==input.tenantId||
     aliasData.slug!==input.expectedSlug||
     aliasData.active!==(t.active===true)||
     (store.data()?.tenantId&&store.data()?.tenantId!==input.tenantId)||
     !ownerIdentityEmpty(t)||!owners.empty)
    throw err("failed-precondition","OWNER_TENANT_STALE_OR_ALREADY_LINKED");
  if(input.expectedOnboardingRequired?!pristinePlaceholder(t):!existingActive(t))
    throw err("failed-precondition","OWNER_BILLING_OR_ACTIVATION_REVIEW_REQUIRED");
  const now=Timestamp.now();
  const beforeDigest=policy.billingDigest(t);
  tx.create(operation,{operationId:input.operationId,tenantId:input.tenantId,
    actor,kind:"create",status:"reserved",ownerUid,afterName:input.displayName,
    email:input.email,ownerRevision:input.expectedRevision+1,
    slug:t.slug,onboardingRequired:input.expectedOnboardingRequired,
    planCode:input.planCode,beforeDigest,
    createdAt:now});
  tx.create(lock,{operationId:input.operationId,actor,kind:"create",createdAt:now});
  tx.create(emailLock,{operationId:input.operationId,tenantId:input.tenantId,
    ownerUid,actor,status:"reserved",createdAt:now});
 });
 let created;
 try{
  created=await nativeAuth.createUser({uid:ownerUid,email:input.email,
   password:input.password,displayName:input.displayName,disabled:false,
   emailVerified:false});
 }catch(error){
  const definitive=["auth/email-already-exists","auth/invalid-email",
   "auth/invalid-password","auth/weak-password"].includes(error?.code);
  if(definitive&&await nativeAbsent(nativeAuth,ownerUid)){
   try{
    await db.runTransaction(async tx=>{
     const [op,lk,claim,shop,user,membership]=await Promise.all([
      tx.get(operation),tx.get(lock),tx.get(emailLock),tx.get(tenant),
      tx.get(account),tx.get(member)]);
     await transactionActor(tx,db,actor);
     if(op.data()?.status!=="reserved"||op.data()?.actor!==actor||
        lk.data()?.operationId!==input.operationId||
        claim.data()?.operationId!==input.operationId||
        !shop.exists||!ownerIdentityEmpty(shop.data())||
        user.exists||membership.exists)
       throw err("failed-precondition","OWNER_RELEASE_UNCERTAIN");
     tx.update(operation,{status:"failed_released",
       releaseReason:"AUTH_CREATE_DEFINITIVE_REJECTION",
       updatedAt:Timestamp.now()});
     tx.delete(lock);
     tx.delete(emailLock);
    });
   }catch{
    throw err("failed-precondition","OWNER_CREATE_REVIEW_REQUIRED");
   }
   throw err(error.code==="auth/email-already-exists"?"already-exists":
     "invalid-argument","OWNER_NATIVE_AUTH_REJECTED");
  }
  throw err("failed-precondition","OWNER_AUTH_CREATE_REVIEW_REQUIRED");
 }
 if(created.uid!==ownerUid)
   throw err("failed-precondition","OWNER_AUTH_UID_REVIEW_REQUIRED");
 try{
  await db.runTransaction(async tx=>{
   const [op,ownerLock,claim,shop,alias,owner,user,membership]=await Promise.all([
    tx.get(operation),tx.get(lock),tx.get(emailLock),
    tx.get(tenant),tx.get(slug),
    tx.get(tenant.collection("memberships").where("role","==","owner").limit(1)),
    tx.get(account),tx.get(member),
   ]);
   await transactionActor(tx,db,actor);
   if(op.data()?.status!=="reserved"||op.data()?.actor!==actor||
      ownerLock.data()?.operationId!==input.operationId||
      claim.data()?.operationId!==input.operationId||
      !shop.exists||!alias.exists||!owner.empty||user.exists||membership.exists)
     throw err("failed-precondition","OWNER_FINALIZE_RECEIPT_CHANGED");
   const t=shop.data(),a=alias.data();
   if(t.slug!==input.expectedSlug||t.name!==input.expectedName||
      revision(t)!==input.expectedRevision||
      (t.onboardingRequired===true)!==input.expectedOnboardingRequired||
      !ownerIdentityEmpty(t)||a.tenantId!==input.tenantId||
      a.active!==(t.active===true)||
      policy.billingDigest(t)!==op.data()?.beforeDigest||
      (input.expectedOnboardingRequired?!pristinePlaceholder(t):!existingActive(t)))
     throw err("failed-precondition","OWNER_TENANT_CHANGED_BEFORE_FINALIZE");
   const now=Timestamp.now();
   const activation=input.expectedOnboardingRequired?
     onboardingDates(now.toDate(),input.planCode):null;
   const start=input.expectedOnboardingRequired?{
    onboardingRequired:false,active:true,
    firstActivatedAt:now,trialStartsAt:now,
    trialEndsAt:Timestamp.fromDate(activation.trialEndsAt),
    subscriptionStartedAt:now,
    subscriptionExpiresAt:Timestamp.fromDate(activation.subscriptionExpiresAt),
    subscriptionStatus:"trialing",planCode:input.planCode,
    gracePeriodDays:3,
    signupBilling:{planCode:input.planCode,
      businessType:t.businessType||"both",billingMode:"subscription"},
   }:{};
   const finalTenant={...t,...start,ownerUid,ownerEmail:input.email,
      ownerDisplayName:input.displayName,ownerRevision:input.expectedRevision+1};
   const profile={uid:ownerUid,email:input.email,
    displayName:input.displayName,role:"owner",active:true,
    tenantId:input.tenantId,tenantSlug:t.slug,tenantName:t.name,
    createdAt:now,updatedAt:now,emailVerificationRequired:true};
   tx.create(account,profile);
   tx.create(member,profile);
   tx.update(tenant,{...start,ownerUid,ownerEmail:input.email,
     ownerDisplayName:input.displayName,ownerRevision:input.expectedRevision+1,
     updatedAt:now});
   tx.update(slug,{ownerUid,
     ...(start.active?{active:true,onboardingRequired:false,
       firstActivatedAt:now,subscriptionExpiresAt:start.subscriptionExpiresAt,
       subscriptionStatus:"trialing",planCode:input.planCode}:{}),
     updatedAt:now});
   tx.update(emailLock,{status:"complete",completedAt:now});
   tx.update(operation,{status:"complete",completedAt:now,
     afterDigest:policy.billingDigest(finalTenant),updatedAt:now});
   tx.delete(lock);
  });
 }catch{
  throw err("failed-precondition","OWNER_FIRESTORE_OUTCOME_REVIEW_REQUIRED");
 }
 return {ok:true,operationId:input.operationId,ownerUid,
   pendingIndependentVerification:true,emailSent:false};
}
async function update({db,nativeAuth,identity,data}){
 const actor=await authorized(db,identity);
 const input=parse(policy.updateInput,data);
 const {tenant,operation,lock}=refs(db,input.tenantId,input.operationId);
 const account=db.collection("users").doc(input.ownerUid);
 const member=tenant.collection("memberships").doc(input.ownerUid);
 let native;
 try{native=await nativeAuth.getUser(input.ownerUid);}
 catch{throw err("failed-precondition","OWNER_AUTH_UNAVAILABLE");}
 await db.runTransaction(async tx=>{
  const [op,ownerLock,shop,user,membership]=await Promise.all([
   tx.get(operation),tx.get(lock),tx.get(tenant),
   tx.get(account),tx.get(member),
  ]);
  const t=shop.data()||{},u=user.data()||{},m=membership.data()||{};
  const slug=await tx.get(db.collection("tenantSlugs").doc(
    policy.SLUG.test(t.slug||"")?t.slug:"_missing"));
  await transactionActor(tx,db,actor);
  if(op.exists||ownerLock.exists)
   throw err("already-exists","OWNER_OPERATION_PENDING");
  if(!shop.exists||!user.exists||!membership.exists||
     t.ownerUid!==input.ownerUid||u.uid!==input.ownerUid||
     !policy.profileMatches(u,m,input.tenantId)||
     revision(t)!==input.expectedRevision||
     t.ownerDisplayName!==input.expectedDisplayName||
     u.displayName!==input.expectedDisplayName||
     native.uid!==input.ownerUid||native.disabled===true||
     native.displayName!==input.expectedDisplayName||
     String(native.email||"").toLowerCase()!==u.email||
     t.ownerEmail!==u.email||!slug.exists||
     slug.data()?.tenantId!==input.tenantId||
     slug.data()?.ownerUid!==input.ownerUid)
    throw err("failed-precondition","OWNER_ORIGINAL_PROOF_MISMATCH");
  const now=Timestamp.now();
  tx.create(operation,{operationId:input.operationId,tenantId:input.tenantId,
    actor,kind:"update",status:"reserved",ownerUid:input.ownerUid,
    beforeName:input.expectedDisplayName,afterName:input.displayName,
    ownerRevision:input.expectedRevision+1,slug:t.slug,email:u.email,
    beforeDigest:policy.billingDigest(t),createdAt:now});
  tx.create(lock,{operationId:input.operationId,actor,kind:"update",createdAt:now});
 });
 try{await nativeAuth.updateUser(input.ownerUid,{displayName:input.displayName});}
 catch{throw err("failed-precondition","OWNER_AUTH_EDIT_REVIEW_REQUIRED");}
 try{
  await db.runTransaction(async tx=>{
   const [op,lk,shop,user,membership]=await Promise.all([
    tx.get(operation),tx.get(lock),tx.get(tenant),tx.get(account),tx.get(member)]);
   await transactionActor(tx,db,actor);
   const t=shop.data(),u=user.data(),m=membership.data();
   if(op.data()?.status!=="reserved"||op.data()?.actor!==actor||
      lk.data()?.operationId!==input.operationId||!shop.exists||
      !user.exists||!membership.exists||
      t.ownerUid!==input.ownerUid||revision(t)!==input.expectedRevision||
      t.ownerDisplayName!==input.expectedDisplayName||
      !policy.profileMatches(u,m,input.tenantId)||
      u.displayName!==input.expectedDisplayName||
      policy.billingDigest(t)!==op.data()?.beforeDigest)
     throw err("failed-precondition","OWNER_EDIT_FINALIZE_REVIEW_REQUIRED");
   const now=Timestamp.now();
   tx.update(account,{displayName:input.displayName,updatedAt:now});
   tx.update(member,{displayName:input.displayName,updatedAt:now});
   tx.update(tenant,{ownerDisplayName:input.displayName,
      ownerRevision:input.expectedRevision+1,updatedAt:now});
   tx.update(operation,{status:"complete",completedAt:now,
      afterDigest:policy.billingDigest(t),updatedAt:now});
   tx.delete(lock);
  });
 }catch{
  throw err("failed-precondition","OWNER_EDIT_OUTCOME_REVIEW_REQUIRED");
 }
 return {ok:true,operationId:input.operationId,
   ownerUid:input.ownerUid,pendingIndependentVerification:true};
}
async function inspect({db,nativeAuth,identity,data}){
 const actor=await authorized(db,identity);
 const input=parse(policy.statusSelector,data);
 const {tenant,operation,lock}=refs(db,input.tenantId,input.operationId);
 const snapshot=await operation.get();
 if(!snapshot.exists)return policy.response({operationId:input.operationId,
   tenantId:input.tenantId},"not_found","UNKNOWN_OPERATION_NEVER_RETRY");
 const op=snapshot.data()||{};
 if(op.actor!==actor||op.tenantId!==input.tenantId)
   throw err("permission-denied","Operation belongs to another Superadmin/tenant");
 const invalid=reason=>policy.response(op,"review_required",reason);
 if(!["create","update"].includes(op.kind)||!policy.ID.test(op.ownerUid||"")||
    !policy.ID.test(op.tenantId||"")||!policy.SLUG.test(op.slug||"")||
    !Number.isSafeInteger(op.ownerRevision)||op.ownerRevision<1)
   return invalid("OPERATION_METADATA_INCOMPLETE");
 const account=db.collection("users").doc(op.ownerUid);
 const member=tenant.collection("memberships").doc(op.ownerUid);
 const [shop,user,membership,lk,slug]=await Promise.all([
  tenant.get(),account.get(),member.get(),lock.get(),
  db.collection("tenantSlugs").doc(op.slug).get(),
 ]);
 const t=shop.data()||{},u=user.data()||{},m=membership.data()||{};
 const native=(await nativeAuth.getUser(op.ownerUid).catch(()=>null));
 const nativeMatches=!!native&&native.uid===op.ownerUid&&
   native.disabled===false&&native.displayName===op.afterName&&
   String(native.email||"").toLowerCase()===op.email;
 const profileMatches=policy.profileMatches(u,m,op.tenantId)&&
   u.uid===op.ownerUid&&u.displayName===op.afterName&&u.email===op.email;
 if(op.status==="failed_released"&&op.kind==="create"){
  const claim=await db.collection("ownerEmailReservations").doc(
    policy.emailHash(op.email||"")).get();
  return op.releaseReason==="AUTH_CREATE_DEFINITIVE_REJECTION"&&
   !native&&!shop.data()?.ownerUid&&!user.exists&&!membership.exists&&
   !claim.exists&&!lk.exists?
   policy.response(op,"failed_released",op.releaseReason):
   invalid("OWNER_RELEASE_PROOF_MISMATCH");
 }
 if(op.status==="reserved"){
  if(lk.data()?.operationId!==op.operationId)return invalid("OWNER_LOCK_CHANGED");
  if(op.kind==="create"){
   const claim=await db.collection("ownerEmailReservations").doc(
     policy.emailHash(op.email||"")).get();
   if(claim.data()?.operationId!==op.operationId||
      claim.data()?.tenantId!==op.tenantId)return invalid("OWNER_EMAIL_LOCK_CHANGED");
   return !native&&!u.uid&&!m.uid&&!t.ownerUid?
     policy.response(op,"pending_review","AUTH_CREATE_MAY_STILL_COMPLETE"):
     invalid("OWNER_CREATE_PARTIAL_PROVIDER_STATE");
  }
  if(!shop.exists||!user.exists||!membership.exists)return invalid("OWNER_EDIT_PARTIAL");
  return !native||native.displayName!==op.beforeName||
     u.displayName!==op.beforeName||t.ownerDisplayName!==op.beforeName?
     invalid("OWNER_EDIT_PARTIAL_PROVIDER_STATE"):
     policy.response(op,"pending_review","ORIGINAL_UPDATE_MAY_STILL_COMPLETE");
 }
 if(op.status!=="complete"||!shop.exists||!user.exists||!membership.exists||
    !slug.exists||t.ownerUid!==op.ownerUid||
    t.ownerDisplayName!==op.afterName||t.ownerEmail!==op.email||
    revision(t)!==op.ownerRevision||
    slug.data()?.tenantId!==op.tenantId||
    slug.data()?.ownerUid!==op.ownerUid||
    !nativeMatches||!profileMatches||
    policy.billingDigest(t)!==op.afterDigest||
    lk.exists)return invalid("OWNER_CANONICAL_OR_AUTH_PROOF_MISMATCH");
 if(op.kind==="create"){
  const claim=await db.collection("ownerEmailReservations").doc(
    policy.emailHash(op.email||"")).get();
  if(claim.data()?.operationId!==op.operationId||
     claim.data()?.status!=="complete")return invalid("OWNER_EMAIL_CLAIM_MISMATCH");
  if(op.onboardingRequired&&(!t.firstActivatedAt||
     policy.normalizeTime(t.firstActivatedAt)!==policy.normalizeTime(t.trialStartsAt)||
     t.onboardingRequired!==false||t.active!==true||
     t.planCode!==op.planCode||t.subscriptionStatus!=="trialing"||
     !(policy.normalizeTime(t.trialEndsAt)>policy.normalizeTime(t.trialStartsAt))||
     !(policy.normalizeTime(t.subscriptionExpiresAt)>=policy.normalizeTime(t.trialEndsAt))))
    return invalid("OWNER_FIRST_ACTIVATION_INCONSISTENT");
 }
 return policy.response(op,"complete_verified");
}
exports.createTenantOwner=onCall(opts,r=>create({db:getFirestore(),nativeAuth:getAuth(),
 identity:r.auth,data:r.data}));
exports.updateTenantOwner=onCall(opts,r=>update({db:getFirestore(),nativeAuth:getAuth(),
 identity:r.auth,data:r.data}));
exports.getPlatformTenantOwnerOperation=onCall(opts,r=>inspect({
 db:getFirestore(),nativeAuth:getAuth(),identity:r.auth,data:r.data}));
exports._privateForTests={create,update,inspect,authorized,pristinePlaceholder,
 existingActive,ownerIdentityEmpty};
