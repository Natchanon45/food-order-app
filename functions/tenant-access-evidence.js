"use strict";
// Superadmin-only Firestore evidence read. NO access/financial mutations.
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {getFirestore}=require("firebase-admin/firestore");
const policy=require("./tenant-access-evidence-policy");
const options={region:"asia-southeast1",timeoutSeconds:30};
const reject=(code,msg)=>new HttpsError(code,msg);
function selector(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||
   Object.keys(data).length!==1||
   typeof data.tenantId!=="string"||!policy.TENANT.test(data.tenantId))
  throw reject("invalid-argument","TENANT_ACCESS_EVIDENCE_SELECTOR_INVALID");
 return data.tenantId;
}
async function inspect({db,auth,data,now=new Date()}){
 const tenantId=selector(data);
 const uid=auth?.uid;
 if(typeof uid!=="string"||!policy.TENANT.test(uid))
  throw reject("unauthenticated","Sign-in required");
 const actorRef=db.collection("users").doc(uid);
 const ref=db.collection("tenants").doc(tenantId);
 // One consistent Firestore read transaction: Superadmin authority,
 // tenant and canonical public slug must belong to the same snapshot.
 return db.runTransaction(async tx=>{
  const [actor,tenant]=await Promise.all([tx.get(actorRef),tx.get(ref)]);
  if(actor.data()?.role!=="super_admin"||actor.data()?.active!==true)
   throw reject("permission-denied","Active Superadmin required");
  if(!tenant.exists)throw reject("not-found","Tenant not found");
  const value=tenant.data()||{};
  const slug=String(value.slug||"");
  let slugIndex=null;
  if(slug && policy.TENANT.test(slug)){
   const index=await tx.get(db.collection("tenantSlugs").doc(slug));
   if(index.exists)slugIndex=index.data()||{};
  }
  return {...policy.inspect({tenantId,tenant:value,slugIndex,now}),
   authenticated:true,superadminOnly:true};
 },{maxAttempts:3});
}
exports.getPlatformTenantAccessEvidence=onCall(options,async req=>
 inspect({db:getFirestore(),auth:req.auth,data:req.data}));
exports._privateForTests={selector,inspect};
