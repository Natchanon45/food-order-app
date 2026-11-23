"use strict";
// Source-style Superadmin master edit with an ATOMIC public slug rename.
// A lost response is reconciled by operation UUID and canonical reread;
// neither replay nor simultaneous editors can hijack another shop's slug.
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore,Timestamp}=require("firebase-admin/firestore");
const {businessUnitsFor}=require("./revenue-share-policy");
const policy=require("./tenant-master-edit-policy");
const opts={region:"asia-southeast1",timeoutSeconds:60,memory:"512MiB"};
const MAX_USERS=80;
const fail=(code,message)=>new HttpsError(code,message);
function selector(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||
  Object.keys(data).length!==2||!policy.ID.test(data.tenantId||"")||
  !policy.UUID.test(data.operationId||""))
  throw fail("invalid-argument","MASTER_OPERATION_SELECTOR_INVALID");
 return data;
}
async function transaction({db,auth,data}){
 let input;
 try{input=policy.request(data);}
 catch(error){throw fail("invalid-argument",error.code||"MASTER_INPUT_INVALID");}
 const uid=auth?.uid;
 if(!policy.ID.test(uid||""))throw fail("unauthenticated","Sign-in required");
 const tenantRef=db.collection("tenants").doc(input.tenantId);
 const actorRef=db.collection("users").doc(uid);
 const opRef=tenantRef.collection("masterEditOperations").doc(input.operationId);
 return db.runTransaction(async tx=>{
  const [actorSnap,receiptSnap,tenantSnap]=await Promise.all([
   tx.get(actorRef),tx.get(opRef),tx.get(tenantRef),
  ]);
  if(actorSnap.data()?.role!=="super_admin"||actorSnap.data()?.active!==true)
   throw fail("permission-denied","Active Superadmin required");
  if(receiptSnap.exists){
   const saved=receiptSnap.data()||{};
   if(saved.kind!=="tenant_master_edit_v1"||saved.actor!==uid||
      saved.tenantId!==input.tenantId||
      saved.requestDigest!==policy.digest(input))
    throw fail("already-exists","MASTER_OPERATION_REUSED_WITH_NEW_REQUEST");
   return policy.response(saved,true);
  }
  if(!tenantSnap.exists)throw fail("not-found","Tenant not found");
  const tenant=tenantSnap.data()||{};
  const oldSlug=String(tenant.slug||"").trim();
  if(!policy.SLUG.test(oldSlug))
   throw fail("failed-precondition","MASTER_ORIGINAL_SLUG_INVALID");
  const storeRef=tenantRef.collection("settings").doc("store");
  const oldRef=db.collection("tenantSlugs").doc(oldSlug);
  const newRef=db.collection("tenantSlugs").doc(input.slug);
  const [storeSnap,oldSnap,newSnap]=await Promise.all([
   tx.get(storeRef),tx.get(oldRef),
   oldSlug===input.slug?Promise.resolve(null):tx.get(newRef),
  ]);
  if(!storeSnap.exists)
   throw fail("failed-precondition","MASTER_STORE_SETTINGS_MISSING");
  if(!oldSnap.exists||oldSnap.data()?.tenantId!==input.tenantId)
   throw fail("failed-precondition","MASTER_SOURCE_SLUG_INCONSISTENT");
  if(newSnap?.exists)
   throw fail("already-exists","MASTER_NEW_SLUG_ALREADY_RESERVED");
  const prior=policy.oldView(tenant,storeSnap.data());
  try{policy.compare(prior,input);}
  catch(e){throw fail("failed-precondition",e.code);}
  const usersRef=db.collection("users");
  const users=await tx.get(usersRef.where("tenantId","==",input.tenantId)
    .limit(MAX_USERS+1));
  if(users.size>MAX_USERS)
   throw fail("failed-precondition","MASTER_USER_FANOUT_REVIEW_REQUIRED");
  for(const userSnap of users.docs){
   if(!policy.ID.test(userSnap.id))
    throw fail("failed-precondition","MASTER_MEMBER_ID_INVALID");
  }
  const membershipSnaps=await Promise.all(users.docs.map(doc=>
   tx.get(tenantRef.collection("memberships").doc(doc.id))));
  if(membershipSnaps.some((snap,i)=>!snap.exists||
    snap.data()?.tenantId!==input.tenantId||
    users.docs[i].data()?.tenantId!==input.tenantId))
   throw fail("failed-precondition","MASTER_MEMBERSHIP_MISMATCH");
  const ownerUid=String(tenant.ownerUid||"");
  if(ownerUid && !users.docs.some(doc=>doc.id===ownerUid))
   throw fail("failed-precondition","MASTER_OWNER_REQUIRES_REVIEW");
  const now=Timestamp.now();
  const after=policy.outcome(input,prior.revision+1);
  const changedBusiness=input.businessType!==prior.businessType;
  const business=changedBusiness?{
   businessType:input.businessType,
   businessUnits:businessUnitsFor(input.businessType),
  }:{};
  tx.update(tenantRef,{
   name:input.name,slug:input.slug,...business,
   masterEditRevision:after.revision,masterEditedBy:uid,updatedAt:now,
  });
  tx.update(storeRef,{
   shopName:input.name,shopPhone:input.phone,
   shopAddress:input.address,updatedAt:now,
  });
  if(oldSlug!==input.slug){
   tx.create(newRef,{...oldSnap.data(),tenantId:input.tenantId,
    slug:input.slug,name:input.name,active:tenant.active!==false,
    updatedAt:now});
   tx.delete(oldRef);
  }else{
   tx.update(oldRef,{name:input.name,updatedAt:now});
  }
  for(let i=0;i<users.docs.length;i++){
   tx.update(users.docs[i].ref,{
    ...business,tenantName:input.name,tenantSlug:input.slug,
    updatedAt:now,
   });
   tx.update(membershipSnaps[i].ref,{
    tenantName:input.name,tenantSlug:input.slug,updatedAt:now,
   });
  }
  const saved=policy.receipt({input,actor:uid,before:prior,after,
   userCount:users.size,stamp:now});
  tx.create(opRef,saved);
  return policy.response(saved);
 },{maxAttempts:5});
}
async function inspect({db,auth,data}){
 const {tenantId,operationId}=selector(data);
 const uid=auth?.uid;
 if(!policy.ID.test(uid||""))throw fail("unauthenticated","Sign-in required");
 return db.runTransaction(async tx=>{
  const actorRef=db.collection("users").doc(uid);
  const tenantRef=db.collection("tenants").doc(tenantId);
  const opRef=tenantRef.collection("masterEditOperations").doc(operationId);
  const [actor,receiptSnap,tenantSnap]=await Promise.all([
   tx.get(actorRef),tx.get(opRef),tx.get(tenantRef),
  ]);
  if(actor.data()?.role!=="super_admin"||actor.data()?.active!==true)
   throw fail("permission-denied","Active Superadmin required");
  if(!receiptSnap.exists)return policy.readonly(null,"not_found",tenantId,operationId);
  const row=receiptSnap.data()||{};
  if(row.actor!==uid)
   throw fail("permission-denied","Edit belongs to another Superadmin");
  if(row.kind!=="tenant_master_edit_v1"||
     !tenantSnap.exists||!row.after||!Number.isSafeInteger(row.after.revision))
   return policy.readonly(row,"review_required",tenantId,operationId);
  const tenant=tenantSnap.data()||{};
  const revision=tenant.masterEditRevision??0;
  if(revision>row.after.revision)
   return policy.readonly(row,"complete_superseded",tenantId,operationId);
  if(revision!==row.after.revision)
   return policy.readonly(row,"review_required",tenantId,operationId);
  const slugRef=db.collection("tenantSlugs").doc(row.after.slug);
  const storeRef=tenantRef.collection("settings").doc("store");
  const [slug,store,users]=await Promise.all([
   tx.get(slugRef),tx.get(storeRef),
   tx.get(db.collection("users").where("tenantId","==",tenantId)
    .limit(MAX_USERS+1)),
  ]);
  if(users.size>MAX_USERS||users.size!==row.userCount||
    !slug.exists||slug.data()?.tenantId!==tenantId||
    slug.data()?.name!==row.after.name||
    slug.data()?.active!==(tenant.active!==false)||
    !store.exists||store.data()?.shopName!==row.after.name||
    store.data()?.shopPhone!==row.after.phone||
    store.data()?.shopAddress!==row.after.address||
    tenant.name!==row.after.name||tenant.slug!==row.after.slug||
    policy.normalizedBusiness(tenant)!==row.after.businessType)
   return policy.readonly(row,"review_required",tenantId,operationId);
  const memberSnaps=await Promise.all(users.docs.map(d=>
   tx.get(tenantRef.collection("memberships").doc(d.id))));
  if(users.docs.some((doc,i)=>
   doc.data()?.tenantName!==row.after.name||
   doc.data()?.tenantSlug!==row.after.slug||
   !memberSnaps[i].exists||
   memberSnaps[i].data()?.tenantName!==row.after.name||
   memberSnaps[i].data()?.tenantSlug!==row.after.slug))
   return policy.readonly(row,"review_required",tenantId,operationId);
  return policy.readonly(row,"complete_current",tenantId,operationId);
 },{maxAttempts:3});
}
exports.updateTenantMasterAtomic=onCall(opts,async req=>
 transaction({db:getFirestore(),auth:req.auth,data:req.data}));
exports.getPlatformTenantMasterEditOperation=onCall(opts,async req=>
 inspect({db:getFirestore(),auth:req.auth,data:req.data}));
exports._privateForTests={transaction,inspect,selector,MAX_USERS};
