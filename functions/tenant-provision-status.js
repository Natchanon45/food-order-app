"use strict";
// Superadmin-only reconciliation of a potentially ambiguous one-call
// shop+owner operation. Read only: never retries Auth, releases a slug,
// extends a subscription, adjusts money or activates a tenant.
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
const OP=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const UID=/^[A-Za-z0-9_-]{4,128}$/;
const STATES=Object.freeze(["not_found","pending_review","failed_released",
 "complete_verified","review_required"]);
const opts={region:"asia-southeast1",timeoutSeconds:40,memory:"256MiB"};
const err=(code,message)=>new HttpsError(code,message);
function selector(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||
    Object.keys(data).length!==1||typeof data.operationId!=="string"||
    !OP.test(data.operationId))
  throw err("invalid-argument","TENANT_PROVISION_OPERATION_ID_INVALID");
 return data.operationId;
}
async function authorized(db,auth){
 if(!auth?.uid||!UID.test(auth.uid))throw err("unauthenticated","Sign-in required");
 const user=await db.collection("users").doc(auth.uid).get();
 if(!user.exists||user.data()?.role!=="super_admin"||
   user.data()?.active===false)
  throw err("permission-denied","Active Superadmin required");
 return auth.uid;
}
const millis=value=>{
 if(value&&typeof value.toMillis==="function")return value.toMillis();
 if(value&&Number.isFinite(value._seconds))
  return value._seconds*1000+Math.trunc((value._nanoseconds||0)/1000000);
 return NaN;
};
function coherentActivation(tenant){
 const first=millis(tenant.firstActivatedAt),
  start=millis(tenant.trialStartsAt),
  trialEnd=millis(tenant.trialEndsAt),
  expiry=millis(tenant.subscriptionExpiresAt);
 // The original activation is immutable. Later manual subscription
 // extensions may increase the expiry, never move the original start.
 return [first,start,trialEnd,expiry].every(Number.isFinite)&&
  first===start&&trialEnd>start&&expiry>=trialEnd;
}
function readonly(status,{operationId,tenant=null,owner=null,reason=null}={}){
 if(!STATES.includes(status))throw Error("INVALID_PROVISION_STATUS");
 return {ok:true,operationId,status,readOnly:true,
  tenantActivated:status==="complete_verified",ownerConfigured:status==="complete_verified",
  canIssueInvoice:false,canSettleMoney:false,canReleaseTenant:false,
  mayRetryWithNewOperationId:status==="failed_released",
  tenant,owner,reason};
}
async function inspect({db,identity,auth,data}){
 const opId=selector(data);
 const caller=await authorized(db,identity);
 const ref=db.collection("platformTenantProvisions").doc(opId);
 const snap=await ref.get();
 if(!snap.exists)return readonly("not_found",{operationId:opId,
  reason:"OPERATION_NOT_RECORDED_DO_NOT_AUTORETRY"});
 const op=snap.data()||{};
 if(op.createdBy!==caller)throw err("permission-denied","Operation belongs to another Superadmin");
 if(op.status==="reserved")return readonly("pending_review",{operationId:opId,
  reason:"AUTH_OR_FIRESTORE_OUTCOME_UNCONFIRMED"});
 if(op.status==="failed_released"){
  const [tenant,slug]=await Promise.all([
   db.collection("tenants").doc(op.tenantId||"_missing").get(),
   db.collection("tenantSlugs").doc(op.slug||"_missing").get(),
  ]);
  if(tenant.exists||slug.data()?.provisioningId===opId||
    !["AUTH_DELETED_CONFIRMED","AUTH_CREATE_DEFINITIVE_REJECTION"].includes(op.releaseReason))
   return readonly("review_required",{operationId:opId,reason:"FAILED_RELEASE_INCONSISTENT"});
  return readonly("failed_released",{operationId:opId,
   reason:op.releaseReason});
 }
 if(op.status!=="complete")return readonly("review_required",{operationId:opId,
  reason:"UNRECOGNIZED_OPERATION_STATE"});
 const valid=(value)=>typeof value==="string"&&value.length>0;
 if(!UID.test(op.tenantId||"")||!UID.test(op.ownerUid||"")||
   !valid(op.name)||!valid(op.slug)||!["monthly","yearly"].includes(op.planCode))
  return readonly("review_required",{operationId:opId,reason:"OPERATION_INCOMPLETE"});
 const tenantRef=db.collection("tenants").doc(op.tenantId);
 const [tenant,slug,owner,membership,store]=await Promise.all([
  tenantRef.get(),
  db.collection("tenantSlugs").doc(op.slug).get(),
  db.collection("users").doc(op.ownerUid).get(),
  tenantRef.collection("memberships").doc(op.ownerUid).get(),
  tenantRef.collection("settings").doc("store").get(),
 ]);
 const t=tenant.data()||{},s=slug.data()||{},u=owner.data()||{},
  m=membership.data()||{},settings=store.data()||{};
 if(!tenant.exists||t.id!==op.tenantId||t.slug!==op.slug||t.name!==op.name||
   t.ownerUid!==op.ownerUid||t.planCode!==op.planCode||
   t.onboardingRequired!==false||t.active!==true||
   t.createdBy!==caller||!coherentActivation(t)||
   t.signupBilling?.planCode!==op.planCode||
   s.tenantId!==op.tenantId||s.provisioningId!==opId||s.active!==true||
   s.ownerUid!==op.ownerUid||
   !owner.exists||u.uid!==op.ownerUid||u.role!=="owner"||
   u.active!==true||u.tenantId!==op.tenantId||
   u.email!==t.ownerEmail||u.displayName!==t.ownerDisplayName||
   !membership.exists||m.uid!==op.ownerUid||m.role!=="owner"||
   m.tenantId!==op.tenantId||
   !store.exists||settings.tenantId!==op.tenantId||
   settings.shopName!==op.name)
  return readonly("review_required",{operationId:opId,reason:"FIRESTORE_PROOF_MISMATCH"});
 // Independently check Firebase Auth. A Firestore user doc alone cannot
 // certify that the Owner actually has a usable login identity.
 try{
  const native=await auth.getUser(op.ownerUid);
  if(native.uid!==op.ownerUid||native.disabled===true||
   String(native.email||"").toLowerCase()!==String(u.email).toLowerCase()||
   native.displayName!==u.displayName)
   return readonly("review_required",{operationId:opId,reason:"AUTH_PROOF_MISMATCH"});
 }catch{
  return readonly("review_required",{operationId:opId,reason:"AUTH_PROOF_UNAVAILABLE"});
 }
 return readonly("complete_verified",{operationId:opId,
  tenant:{id:op.tenantId,name:op.name,slug:op.slug,planCode:op.planCode},
  owner:{uid:op.ownerUid,role:"owner"},reason:null});
}
exports.getPlatformTenantProvisionStatus=onCall(opts,request=>inspect({
 db:getFirestore(),identity:request.auth,auth:getAuth(),data:request.data}));
exports._privateForTests={selector,authorized,readonly,inspect,coherentActivation,STATES};
