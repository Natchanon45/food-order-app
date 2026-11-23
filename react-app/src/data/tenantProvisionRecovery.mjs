// A lost HTTPS Callable response can follow a committed Auth/Firestore
// write. Store only the opaque operation UUID (never name, email/password),
// scoped to the signed-in Superadmin, until canonical reconciliation.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const UID=/^[A-Za-z0-9_-]{4,128}$/;
const PREFIX="penguin_p12_owner_provision_v1_";
export const operationKey=uid=>UID.test(uid||"")?PREFIX+uid:null;
export function readPendingProvision(uid,storage=globalThis?.sessionStorage){
 const key=operationKey(uid);
 if(!key||!storage)return null;
 try{const value=storage.getItem(key);return UUID.test(value||"")?value:null;}
 catch{return null;}
}
export function holdPendingProvision(uid,operationId,storage=globalThis?.sessionStorage){
 const key=operationKey(uid);
 if(!key||!UUID.test(operationId||"")||!storage)return false;
 try{storage.setItem(key,operationId);return true;}
 catch{return false;}
}
export function releasePendingProvision(uid,operationId,storage=globalThis?.sessionStorage){
 const key=operationKey(uid);
 if(!key||!UUID.test(operationId||"")||!storage)return false;
 try{
  if(storage.getItem(key)!==operationId)return false;
  storage.removeItem(key);return true;
 }catch{return false;}
}
const STATES=new Set(["not_found","pending_review","failed_released",
 "complete_verified","review_required"]);
export function validateProvisionStatus(value,operationId){
 if(!UUID.test(operationId||"")||value?.ok!==true||
    value?.operationId!==operationId||value?.readOnly!==true||
    !STATES.has(value?.status)||value.canIssueInvoice!==false||
    value.canSettleMoney!==false||value.canReleaseTenant!==false||
    value.tenantActivated!==(value.status==="complete_verified")||
    value.ownerConfigured!==(value.status==="complete_verified")||
    value.mayRetryWithNewOperationId!==(value.status==="failed_released"))
  throw Error("TENANT_PROVISION_RECONCILIATION_UNVERIFIED");
 if(value.status==="complete_verified"){
  const t=value.tenant,o=value.owner;
  if(!t||!UID.test(t.id||"")||!t.name||!t.slug||
    !["monthly","yearly"].includes(t.planCode)||
    !o||!UID.test(o.uid||"")||o.role!=="owner")
   throw Error("TENANT_PROVISION_RECONCILIATION_INCOMPLETE");
 }else if(value.tenant!=null||value.owner!=null)
  throw Error("TENANT_PROVISION_RECONCILIATION_LEAKED_DATA");
 return value;
}
export function canonicalOwnerMatches(rows,status){
 if(status?.status!=="complete_verified"||!Array.isArray(rows))return false;
 const t=status.tenant,o=status.owner;
 return rows.some(row=>row.id===t.id&&row.name===t.name&&
  row.slug===t.slug&&row.planCode===t.planCode&&
  row.ownerUid===o.uid&&row.active===true&&row.onboardingRequired!==true);
}
export const isProvisionUnknownError=error=>
 ["functions/deadline-exceeded","functions/unavailable",
  "functions/internal","functions/unknown"].includes(error?.code)||
 error?.message==="TENANT_WRITE_UNCONFIRMED"||
 error?.details?.code==="TENANT_PROVISION_REVIEW_REQUIRED";
