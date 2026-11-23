// Non-financial Superadmin membership command recovery.
// Store only a per-tenant opaque UUID, never an account number, amount,
// owner identity, activation date or privileged command payload.
const ID=/^[A-Za-z0-9_-]{4,128}$/;
const OP=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const KEY="penguin_p12d_subscription_command_v1_";
export const subscriptionKey=(uid,tenantId)=>
 ID.test(uid||"")&&ID.test(tenantId||"")?KEY+uid+"_"+tenantId:null;
export function readPendingSubscription(uid,tenantId,storage=globalThis?.sessionStorage){
 const key=subscriptionKey(uid,tenantId);
 if(!key||!storage)return null;
 try{const op=storage.getItem(key);return OP.test(op||"")?op:null;}
 catch{return null;}
}
export function holdPendingSubscription(uid,tenantId,op,storage=globalThis?.sessionStorage){
 const key=subscriptionKey(uid,tenantId);
 if(!key||!OP.test(op||"")||!storage)return false;
 try{
  const prior=storage.getItem(key);
  if(prior&&prior!==op)return false;
  storage.setItem(key,op);return true;
 }catch{return false;}
}
export function releasePendingSubscription(uid,tenantId,op,storage=globalThis?.sessionStorage){
 const key=subscriptionKey(uid,tenantId);
 if(!key||!OP.test(op||"")||!storage)return false;
 try{
  if(storage.getItem(key)!==op)return false;
  storage.removeItem(key);return true;
 }catch{return false;}
}
export const expiryIso=value=>{
 if(!value)return null;
 const parsed=typeof value?.toDate==="function"?value.toDate():new Date(value);
 return Number.isFinite(parsed?.getTime?.())?parsed.toISOString():null;
};
export function sourceSnapshot(tenant){
 return {
  expectedExpiresAt:expiryIso(tenant.subscriptionExpiresAt),
  expectedStatus:String(tenant.subscriptionStatus||"active"),
  expectedActive:tenant.active!==false,
  expectedRevision:tenant.subscriptionAdminRevision??0,
  expectedGracePeriodDays:tenant.gracePeriodDays??3,
  expectedPlanCode:String(tenant.planCode||"monthly"),
 };
}
const statuses=new Set(["not_found","review_required","complete_current","complete_superseded"]);
export function validateSubscriptionOperation(data,tenantId,op){
 if(!data||data.ok!==true||data.readOnly!==true||
  data.tenantId!==tenantId||data.operationId!==op||
  data.canIssueInvoice!==false||data.canSettleMoney!==false||
  data.canReleaseFinancialHold!==false||!statuses.has(data.status))
  throw Error("SUBSCRIPTION_OPERATION_UNVERIFIED");
 if(data.status==="complete_current"){
  const row=data.tenant;
  if(!row||row.id!==tenantId||!["monthly","yearly"].includes(row.planCode)||
   !["active","trialing","grace","expired","suspended"].includes(row.subscriptionStatus)||
   !Number.isSafeInteger(row.subscriptionAdminRevision)||
   row.subscriptionAdminRevision<1||
   !Number.isInteger(row.gracePeriodDays)||row.gracePeriodDays<0||
   row.gracePeriodDays>30||typeof row.active!=="boolean"||
   !(row.subscriptionExpiresAt===null||
    expiryIso(row.subscriptionExpiresAt)===row.subscriptionExpiresAt))
   throw Error("SUBSCRIPTION_OPERATION_UNVERIFIED");
 }else if(data.tenant!=null)throw Error("SUBSCRIPTION_OPERATION_UNVERIFIED");
 return data;
}
export function validateSubscriptionWrite(data,payload){
 if(!data||data.ok!==true||data.readOnly!==false||
    data.tenantId!==payload.tenantId||
    data.operationId!==payload.operationId||
    data.action!==payload.action||
    data.canIssueInvoice!==false||data.canSettleMoney!==false||
    data.canReleaseFinancialHold!==false||
    !["monthly","yearly"].includes(data.planCode)||
    data.planCode!==payload.planCode||
    !["active","trialing","grace","expired","suspended"].includes(data.status)||
    typeof data.active!=="boolean"||
    !Number.isSafeInteger(data.revision)||
    data.revision!==payload.expectedRevision+1||
    data.gracePeriodDays!==payload.gracePeriodDays||
    !(data.expiresAt===null||expiryIso(data.expiresAt)===data.expiresAt))
  throw Error("SUBSCRIPTION_WRITE_UNCONFIRMED");
 return data;
}
export function canonicalSubscriptionMatches(rows,receipt){
 if(!Array.isArray(rows)||!receipt)return false;
 const r=rows.find(v=>v.id===receipt.tenantId);
 return !!r&&r.planCode===receipt.planCode&&
  (r.subscriptionStatus||"active")===receipt.status&&
  r.active===(receipt.active===true)&&
  expiryIso(r.subscriptionExpiresAt)===receipt.expiresAt&&
  Number(r.gracePeriodDays??3)===receipt.gracePeriodDays&&
  Number(r.subscriptionAdminRevision??0)===receipt.revision;
}
export const subscriptionUnknownError=err=>
 err?.message==="SUBSCRIPTION_WRITE_UNCONFIRMED"||
 err?.details?.code==="SUBSCRIPTION_WRITE_OUTCOME_UNKNOWN"||
 ["functions/deadline-exceeded","functions/unavailable","functions/internal",
  "functions/unknown"].includes(err?.code);
