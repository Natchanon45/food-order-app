"use strict";
// Non-financial, legacy subscription administration ONLY.
// Every decision is recomputed from an authenticated Firestore tenant
// inside the transaction; client-supplied dates are optimistic locks,
// never proof of payment or permission to remove a separate hold.
const {createHash}=require("node:crypto");
const ID=/^[A-Za-z0-9_-]{4,128}$/;
const OP=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const KEYS=new Set(["tenantId","operationId","action","days","expiresAt",
 "planCode","gracePeriodDays","expectedExpiresAt","expectedStatus",
 "expectedActive","expectedRevision","expectedGracePeriodDays","expectedPlanCode"]);
const BLOCKED=new Set(["suspended","review_required"]);
function error(code){const e=new Error(code);e.code=code;return e}
function date(value){
 if(!value)return null;
 const d=typeof value.toDate==="function"?value.toDate():new Date(value);
 return Number.isFinite(d?.getTime?.())?d:null;
}
const iso=value=>date(value)?.toISOString()||null;
function bangkokEnd(day){
 if(typeof day!=="string"||!DAY.test(day))throw error("SUBSCRIPTION_DATE_INVALID");
 const [y,m,d]=day.split("-").map(Number);
 if(y<2000||y>2100||m<1||m>12||d<1||d>31||
   new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)!==day)
  throw error("SUBSCRIPTION_DATE_INVALID");
 // End of the requested calendar day in Bangkok (UTC+07, no DST).
 return new Date(Date.UTC(y,m-1,d+1)-7*3600000-1);
}
function validate(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||
   Object.keys(data).some(key=>!KEYS.has(key))||Object.keys(data).length<11)
  throw error("SUBSCRIPTION_INPUT_INVALID");
 if(!ID.test(data.tenantId||"")||!OP.test(data.operationId||"")||
  !["extend","set-expiry","suspend","activate"].includes(data.action)||
  !["monthly","yearly"].includes(data.planCode)||
  !["monthly","yearly"].includes(data.expectedPlanCode)||
  !Number.isInteger(data.gracePeriodDays)||data.gracePeriodDays<0||data.gracePeriodDays>30||
  !Number.isInteger(data.expectedGracePeriodDays)||
  data.expectedGracePeriodDays<0||data.expectedGracePeriodDays>30||
  !Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<0||
  typeof data.expectedStatus!=="string"||data.expectedStatus.length>30||
  typeof data.expectedActive!=="boolean"||
  !(data.expectedExpiresAt===null||typeof data.expectedExpiresAt==="string"))
   throw error("SUBSCRIPTION_INPUT_INVALID");
 if(data.expectedExpiresAt!==null&&iso(data.expectedExpiresAt)!==data.expectedExpiresAt)
  throw error("SUBSCRIPTION_EXPECTED_EXPIRY_INVALID");
 if(data.action==="extend" && ![30,365].includes(data.days))
  throw error("SUBSCRIPTION_EXTENSION_INVALID");
 if(data.action!=="extend" && (data.days??0)!==0)
  throw error("SUBSCRIPTION_EXTENSION_INVALID");
 if(data.action==="set-expiry")bangkokEnd(data.expiresAt);
 return Object.freeze({...data,days:data.days||0});
}
function view(tenant={}){
 return Object.freeze({
  expiry:iso(tenant.subscriptionExpiresAt),
  status:String(tenant.subscriptionStatus||"active"),
  active:tenant.active!==false,
  planCode:String(tenant.planCode||"monthly"),
  grace:Number(tenant.gracePeriodDays??3),
  revision:Number(tenant.subscriptionAdminRevision??0),
 });
}
function assertFresh(tenant,input){
 const cur=view(tenant);
 if(cur.expiry!==input.expectedExpiresAt||
  cur.status!==input.expectedStatus||
  cur.active!==input.expectedActive||
  cur.planCode!==input.expectedPlanCode||
  cur.grace!==input.expectedGracePeriodDays||
  cur.revision!==input.expectedRevision)
  throw error("SUBSCRIPTION_STALE_STATE");
 if(tenant.billingPolicyVersion==="hybrid_v1"||
  tenant.revenueShareEnabled===true||tenant.billingMode==="revenue_share"||
  tenant.revenueShareSuspended===true)
  throw error("SUBSCRIPTION_FINANCIAL_MODE_UNSUPPORTED");
 if(tenant.onboardingRequired===true||!tenant.ownerUid||
   !date(tenant.firstActivatedAt)||!date(tenant.trialStartsAt))
  throw error("SUBSCRIPTION_ORIGINAL_ACTIVATION_REQUIRED");
 if(input.planCode!==cur.planCode)
  throw error("SUBSCRIPTION_PLAN_MIGRATION_REQUIRES_REVIEW");
 if(!Number.isSafeInteger(cur.revision)||cur.revision<0)
  throw error("SUBSCRIPTION_REVISION_INVALID");
 return cur;
}
function independentHold(tenant={}){
 const reason=String(tenant.suspensionReason||"").trim();
 const manual=reason==="manual_subscription_superadmin"||
  reason==="ระงับโดย Super Admin";
 return tenant.revenueShareSuspended===true||
  tenant.hybridBillingSuspended===true||
  BLOCKED.has(String(tenant.m7FinanceAccessStatus||""))||
  (tenant.active===false && !!reason && !manual)||
  (tenant.active===false &&
    !["expired","suspended"].includes(String(tenant.subscriptionStatus||"")));
}
function next(tenant,input,now=new Date()){
 const cur=assertFresh(tenant,input);
 if(!Number.isFinite(now.getTime()))throw error("SUBSCRIPTION_CLOCK_INVALID");
 const before=date(tenant.subscriptionExpiresAt);
 const trialEnd=date(tenant.trialEndsAt);
 let expiry=before, status=cur.status, active=cur.active,
  reason=String(tenant.suspensionReason||"");
 if(input.action==="extend"){
  // Missing historical expiry is not evidence that the tenant should
  // start a paid membership today. The Admin must first reconcile an
  // original supported date through a separate explicit action.
  if(!before)throw error("SUBSCRIPTION_EXISTING_EXPIRY_REQUIRED");
  const base=before&&before>now?before:now;
  expiry=new Date(base.getTime()+input.days*86400000);
  if(status!=="suspended"){
   status=trialEnd&&trialEnd>=now&&cur.status==="trialing"?
    "trialing":"active";
   active=!independentHold(tenant);
  }
 }else if(input.action==="set-expiry"){
  expiry=bangkokEnd(input.expiresAt);
  if(status!=="suspended"){
   status=expiry<now?"expired":trialEnd&&trialEnd>=now&&
    cur.status==="trialing"?"trialing":"active";
   active=status!=="expired"&&!independentHold(tenant);
  }
 }else if(input.action==="suspend"){
  // Never overwrite a distinct security/finance suspension reason with
  // our manual subscription reason; doing so would let a later activate
  // accidentally erase another source of access restrictions.
  if(independentHold(tenant))throw error("SUBSCRIPTION_INDEPENDENT_HOLD");
  status="suspended";active=false;
  reason="manual_subscription_superadmin";
 }else if(input.action==="activate"){
  if(status!=="suspended")throw error("SUBSCRIPTION_NOT_MANUALLY_SUSPENDED");
  if(independentHold(tenant)||![
    "manual_subscription_superadmin","ระงับโดย Super Admin",
  ].includes(reason))throw error("SUBSCRIPTION_INDEPENDENT_HOLD");
  if(!before)throw error("SUBSCRIPTION_EXPIRY_UNVERIFIED");
  const grace=before.getTime()+input.gracePeriodDays*86400000;
  status=before>=now?"active":grace>=now?"grace":"expired";
  active=status!=="expired";
  reason="";
 }
 if(tenant.revenueShareSuspended===true)active=false;
 // The privileged update touches only subscription fields. In particular,
 // it NEVER changes frozen signup dates, invoice documents, payment state,
 // Hybrid/M7 access hold, Revenue Share balances or Service Credit.
 return Object.freeze({subscriptionStatus:status,
  subscriptionExpiresAt:expiry,
  gracePeriodDays:input.gracePeriodDays,planCode:cur.planCode,
  active,suspensionReason:reason,
  suspendedAt:status==="suspended"?(tenant.suspendedAt||now):null,
  subscriptionAdminRevision:cur.revision+1});
}
function fingerprint(input){
 const ordered=Object.fromEntries(Object.keys(input).sort().map(k=>[k,input[k]]));
 return createHash("sha256").update(JSON.stringify(ordered)).digest("hex");
}
function receipt({tenantId,operationId,actor,action,input,patch,previous,at}){
 return Object.freeze({
  tenantId,operationId,actor,action,
  requestDigest:fingerprint(input),
  before:previous,
  after:{expiry:iso(patch.subscriptionExpiresAt),
   status:patch.subscriptionStatus,active:patch.active,
   planCode:patch.planCode,grace:patch.gracePeriodDays,
   revision:patch.subscriptionAdminRevision},
  recordedAt:at,
  kind:"legacy_subscription_control_v1",
  financialAuthority:false,
 });
}
function response(doc,replay=false){
 const a=doc.after||{};
 return {ok:true,readOnly:false,idempotent:replay,
  tenantId:doc.tenantId,operationId:doc.operationId,
  action:doc.action,status:a.status,active:a.active,
  expiresAt:a.expiry,gracePeriodDays:a.grace,
  planCode:a.planCode,revision:a.revision,
  canIssueInvoice:false,canSettleMoney:false,
  canReleaseFinancialHold:false};
}
module.exports={validate,view,assertFresh,independentHold,next,bangkokEnd,
 fingerprint,receipt,response,iso,error};
