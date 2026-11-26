"use strict";
// Internal read model for official provider receipts. Not a deployed callable.
// Canonical profile and tenant are read in the same transaction as history.
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const HEX=/^[a-f0-9]{64}$/;
const PROVIDER=/^[a-z][a-z0-9_-]{0,31}$/;
function fail(code){throw Object.assign(new Error(code),{code});}
function validDate(s){
 if(typeof s!=="string")return false;
 const t=Date.parse(s);
 return Number.isFinite(t)&&new Date(t).toISOString()===s;
}
function projectReceipt(doc,scope,tenantId){
 const r=doc.data();
 if(!r||!HEX.test(doc.id)||r.schemaVersion!==1||r.scope!==scope||r.tenantId!==tenantId||
    r.source!=="provider"||r.paymentVerified!==false||r.currency!=="THB"||
    typeof r.provider!=="string"||!PROVIDER.test(r.provider)||
    !Number.isSafeInteger(r.amountMinor)||r.amountMinor<=0||r.amountMinor>10_000_000_000||
    !validDate(r.occurredAt)||!validDate(r.recordedAt))fail("PROVIDER_RECEIPT_RECORD_INVALID");
 return {id:doc.id,provider:r.provider,amountMinor:r.amountMinor,currency:"THB",
  occurredAt:r.occurredAt,recordedAt:r.recordedAt,source:"provider",paymentVerified:false};
}
async function readProviderReceiptHistory(db,auth,input){
 if(!auth||typeof auth.uid!=="string"||!auth.uid||auth.uid.includes("/"))fail("unauthenticated");
 if(!input||typeof input!=="object"||Array.isArray(input)||
    Object.keys(input).some(k=>!["scope","limit"].includes(k))||
    !["platform","tenant"].includes(input.scope))fail("invalid-argument");
 const scope=input.scope,limit=input.limit??50;
 if(!Number.isSafeInteger(limit)||limit<1||limit>50)fail("invalid-argument");
 return db.runTransaction(async tx=>{
  const user=(await tx.get(db.collection("users").doc(auth.uid))).data();
  if(user?.active!==true||(user.emailVerificationRequired===true&&auth.token?.email_verified!==true))fail("permission-denied");
  let tenantId="";
  if(scope==="platform"){
   if(user.role!=="super_admin")fail("permission-denied");
  }else{
   if(!["owner","admin"].includes(user.role)||typeof user.tenantId!=="string"||!ID.test(user.tenantId))fail("permission-denied");
   tenantId=user.tenantId;
   const tenant=(await tx.get(db.collection("tenants").doc(tenantId))).data();
   if(tenant?.active!==true)fail("permission-denied");
  }
  const query=db.collection("providerReceiptRecordsV1").where("scope","==",scope)
    .where("tenantId","==",tenantId).orderBy("occurredAt","desc").limit(limit+1);
  const snapshot=await tx.get(query);
  const items=snapshot.docs.slice(0,limit).map(d=>projectReceipt(d,scope,tenantId));
  return {scope,items,hasMore:snapshot.docs.length>limit,paymentVerified:false};
 });
}
module.exports={readProviderReceiptHistory};
