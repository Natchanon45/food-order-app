"use strict";
// P1.2g actual hard deletion of an EMPTY, never-activated, unowned
// placeholder only. No recursiveDelete, no finance/Owner/active removal.
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore,Timestamp}=require("firebase-admin/firestore");
const p=require("./tenant-safe-deletion-policy");
const opts={region:"asia-southeast1",timeoutSeconds:60,memory:"512MiB"};
const err=(code,msg)=>new HttpsError(code,msg);
async function authorized(tx,db,uid){
 if(!p.ID.test(uid||""))throw err("unauthenticated","Sign-in required");
 const actor=await tx.get(db.collection("users").doc(uid));
 if(actor.data()?.role!=="super_admin"||actor.data()?.active!==true)
  throw err("permission-denied","Active Superadmin required");
 return uid;
}
// Enumerating subcollections prevents a new, unrecognized record
// category from being silently destroyed. A single canonical settings/store
// document is the only tolerated child of the legacy placeholder.
async function structure(db,tenantId){
 const ref=db.collection("tenants").doc(tenantId);
 const children=await ref.listCollections();
 const names=children.map(x=>x.id);
 const settings=await ref.collection("settings").limit(2).get();
 const storeOnly=settings.size===1&&settings.docs[0].id==="store";
 return {names,storeOnly};
}
// Avoid even enumerating a draft or its child collections for anonymous,
// disabled or non-Superadmin callers. Transaction repeats this check against
// the same consistent snapshot as all deleted records.
async function preAuthorize(db,uid){
 if(!p.ID.test(uid||""))throw err("unauthenticated","Sign-in required");
 const actor=await db.collection("users").doc(uid).get();
 if(actor.data()?.role!=="super_admin"||actor.data()?.active!==true)
  throw err("permission-denied","Active Superadmin required");
}
async function inspectSnapshot(tx,db,tenantId,structureInfo){
 const tenantRef=db.collection("tenants").doc(tenantId);
 const tenantDoc=await tx.get(tenantRef);
 const data=tenantDoc.data()||null;
 let slugDoc=null;
 if(p.SLUG.test(data?.slug||""))
  slugDoc=await tx.get(db.collection("tenantSlugs").doc(data.slug));
 const storeDoc=await tx.get(tenantRef.collection("settings").doc("store"));
 const queries=p.EXTERNAL_TENANT_REFERENCES.map(name=>
   db.collection(name).where("tenantId","==",tenantId).limit(1));
 const externals=await Promise.all(queries.map(query=>tx.get(query)));
 const found=externals.flatMap((snap,i)=>snap.empty?[]:
  [p.EXTERNAL_TENANT_REFERENCES[i]]);
 // Query-by-field does not detect globally keyed Tenant documents.
 // Cross-check both known integrations and a possibly reserved signup Slug.
 const directRefs=p.EXTERNAL_TENANT_DOCUMENT_ROOTS.map(root=>
  db.collection(root).doc(tenantId));
 if(p.SLUG.test(data?.slug||""))
  directRefs.push(db.collection("publicTenantSignupSlugs").doc(data.slug));
 const directSnaps=await Promise.all(directRefs.map(doc=>tx.get(doc)));
 for(let i=0;i<directSnaps.length;i++){
  if(directSnaps[i].exists)found.push(
   i<p.EXTERNAL_TENANT_DOCUMENT_ROOTS.length
    ?p.EXTERNAL_TENANT_DOCUMENT_ROOTS[i]
    :"publicTenantSignupSlugs");
 }
 const subcollections=structureInfo.storeOnly
  ?structureInfo.names:[...structureInfo.names,"invalid_settings_shape"];
 const safety=p.inspect(data,storeDoc.data()||null,
  slugDoc?.data()||null,subcollections,found);
 return {tenantDoc,tenantRef,data,slugDoc,storeDoc,safety};
}
function publicSafety(result,tenantId){
 return {
  ok:true,readOnly:true,tenantId,ready:result.ready,
  reasonCodes:result.reasonCodes,
  isHardDeleteRestricted:true,
  canDeleteOnlyUnownedPlaceholder:true,
  canDeleteBusinessData:false,canDeleteFinanceHistory:false,
  canDeleteOwner:false,canReleaseTenant:false,canSettleMoney:false,
  canIssueInvoice:false,
 };
}
async function preview({db,auth,data}){
 let tenantId;
 try{tenantId=p.selector(data);}
 catch(e){throw err("invalid-argument",e.code);}
 const uid=auth?.uid;
 await preAuthorize(db,uid);
 const structureInfo=await structure(db,tenantId);
 return db.runTransaction(async tx=>{
  await authorized(tx,db,uid);
  const {safety}=await inspectSnapshot(tx,db,tenantId,structureInfo);
  return publicSafety(safety,tenantId);
 },{maxAttempts:3});
}
async function remove({db,auth,data}){
 let input;
 try{input=p.request(data);}
 catch(e){throw err("invalid-argument",e.code);}
 const uid=auth?.uid;
 await preAuthorize(db,uid);
 const structureInfo=await structure(db,input.tenantId);
 const opRef=db.collection("platformTenantDeletions").doc(input.operationId);
 const tombRef=db.collection("platformTenantDeletionTombstones").doc(input.tenantId);
 return db.runTransaction(async tx=>{
  await authorized(tx,db,uid);
  const [op,tomb]=await Promise.all([tx.get(opRef),tx.get(tombRef)]);
  if(op.exists){
   const saved=op.data()||{};
   if(saved.kind!=="tenant_empty_placeholder_delete_v1"||
     saved.actor!==uid||saved.tenantId!==input.tenantId||
     saved.requestDigest!==p.digest(input))
    throw err("already-exists","TENANT_DELETE_OPERATION_REUSE_CONFLICT");
   return p.response(saved,true);
  }
  if(tomb.exists)
   throw err("already-exists","TENANT_ALREADY_DELETED_BY_OTHER_OPERATION");
  const {tenantDoc,tenantRef,data,storeDoc,safety}=await inspectSnapshot(
   tx,db,input.tenantId,structureInfo);
  if(!tenantDoc.exists)throw err("not-found","Tenant not found");
  if(!safety.ready)
   throw err("failed-precondition","TENANT_DELETE_NOT_PRISTINE:"+safety.reasonCodes.join(","));
  try{p.compare(data,input);}
  catch(e){throw err("failed-precondition",e.code);}
  if(!storeDoc.exists)throw err("failed-precondition","TENANT_DELETE_SETTINGS_MISSING");
  const now=Timestamp.now(),saved=p.receipt({input,actor:uid,now});
  tx.delete(storeDoc.ref);
  tx.delete(db.collection("tenantSlugs").doc(data.slug));
  tx.delete(tenantRef);
  tx.create(opRef,saved);
  tx.create(tombRef,{operationId:input.operationId,actor:uid,
   kind:saved.kind,deletedSlug:data.slug,createdAt:now});
  return p.response(saved);
 },{maxAttempts:5});
}
function statusSelector(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||
  Object.keys(data).length!==2||!p.ID.test(data.tenantId||"")||
  !p.OP.test(data.operationId||""))
  throw err("invalid-argument","TENANT_DELETE_STATUS_SELECTOR_INVALID");
 return data;
}
async function status({db,auth,data}){
 const {tenantId,operationId}=statusSelector(data);
 const uid=auth?.uid;
 if(!p.ID.test(uid||""))throw err("unauthenticated","Sign-in required");
 return db.runTransaction(async tx=>{
  await authorized(tx,db,uid);
  const [op,tomb,tenant]=await Promise.all([
   tx.get(db.collection("platformTenantDeletions").doc(operationId)),
   tx.get(db.collection("platformTenantDeletionTombstones").doc(tenantId)),
   tx.get(db.collection("tenants").doc(tenantId)),
  ]);
  if(!op.exists)return p.status({tenantId,operationId,state:"not_found"});
  const value=op.data()||{};
  if(value.actor!==uid)throw err("permission-denied","Operation belongs to another Superadmin");
  if(value.kind!=="tenant_empty_placeholder_delete_v1"||
   value.tenantId!==tenantId||
   !tomb.exists||tomb.data()?.operationId!==operationId||
   tenant.exists)return p.status({tenantId,operationId,state:"review_required"});
  const slug=await tx.get(db.collection("tenantSlugs").doc(value.deletedSlug));
  if(slug.exists&&slug.data()?.tenantId===tenantId)
   return p.status({tenantId,operationId,state:"review_required"});
  return p.status({tenantId,operationId,state:"deleted_verified"});
 },{maxAttempts:3});
}
exports.getPlatformTenantDeletionSafety=onCall(opts,req=>
 preview({db:getFirestore(),auth:req.auth,data:req.data}));
exports.deleteTenant=onCall(opts,req=>
 remove({db:getFirestore(),auth:req.auth,data:req.data}));
exports.getPlatformTenantDeletionStatus=onCall(opts,req=>
 status({db:getFirestore(),auth:req.auth,data:req.data}));
exports._privateForTests={authorized,preAuthorize,structure,inspectSnapshot,
 preview,remove,status,statusSelector};
