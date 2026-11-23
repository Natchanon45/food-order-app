"use strict";
const {createHash}=require("node:crypto");
const OP=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const ID=/^[A-Za-z0-9_-]{4,128}$/;
const SLUG=/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
function invalid(code){const error=Error(code);error.code=code;throw error;}
function strict(data,keys){
 if(!data||typeof data!=="object"||Array.isArray(data)||
    Object.keys(data).length!==keys.length||
    !keys.every(key=>Object.hasOwn(data,key)))invalid("OWNER_INPUT_SHAPE_INVALID");
}
function common(data,kind){
 if(!ID.test(data.tenantId||"")||!OP.test(data.operationId||""))
   invalid("OWNER_SELECTOR_INVALID");
 if(typeof data.displayName!=="string"||
    data.displayName.trim()!==data.displayName||
    data.displayName.length<2||data.displayName.length>120)
   invalid("OWNER_NAME_INVALID");
 return {...data,kind};
}
function createInput(data){
 strict(data,["tenantId","operationId","expectedSlug","expectedName",
   "expectedRevision","expectedOnboardingRequired","planCode",
   "displayName","email","password"]);
 const v=common(data,"create");
 if(!SLUG.test(v.expectedSlug||"")||typeof v.expectedName!=="string"||
    v.expectedName.length<2||v.expectedName.length>120||
    !Number.isSafeInteger(v.expectedRevision)||v.expectedRevision<0||
    typeof v.expectedOnboardingRequired!=="boolean"||
    typeof v.email!=="string"||v.email!==v.email.trim().toLowerCase()||
    v.email.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)||
    typeof v.password!=="string"||
    Buffer.byteLength(v.password,"utf8")<8||
    Buffer.byteLength(v.password,"utf8")>72||
    !(v.expectedOnboardingRequired?["monthly","yearly"].includes(v.planCode):
      v.planCode===""))
   invalid("OWNER_CREATE_FIELDS_INVALID");
 return v;
}
function updateInput(data){
 strict(data,["tenantId","operationId","ownerUid","expectedRevision",
   "expectedDisplayName","displayName"]);
 const v=common(data,"update");
 if(!ID.test(v.ownerUid||"")||!Number.isSafeInteger(v.expectedRevision)||
    v.expectedRevision<0||typeof v.expectedDisplayName!=="string"||
    v.expectedDisplayName.length<2||v.expectedDisplayName.length>120)
   invalid("OWNER_UPDATE_FIELDS_INVALID");
 return v;
}
function statusSelector(data){
 strict(data,["tenantId","operationId"]);
 if(!ID.test(data.tenantId||"")||!OP.test(data.operationId||""))
   invalid("OWNER_SELECTOR_INVALID");
 return data;
}
const uidFor=id=>"own-"+id.replaceAll("-","");
const emailHash=email=>createHash("sha256").update(email).digest("hex");
const revision=row=>Number.isSafeInteger(row?.ownerRevision)&&row.ownerRevision>=0?row.ownerRevision:0;
const normalizeTime=x=>{
 if(x&&typeof x.toMillis==="function")return x.toMillis();
 if(x&&typeof x.seconds==="number")return x.seconds*1000+
  Math.trunc((x.nanoseconds||0)/1e6);
 if(x instanceof Date)return x.getTime();
 return x===undefined?null:x;
};
const billingKeys=["firstActivatedAt","trialStartsAt","trialEndsAt",
 "subscriptionStartedAt","subscriptionExpiresAt","planCode",
 "subscriptionStatus","signupBilling","subscriptionPricingSnapshot",
 "m7InvoiceUnpaidCents","m7FinanceAccessStatus","revenueShareSuspended",
 "subscriptionPaidUntil","gracePeriodDays"];
function billingDigest(tenant){
 const obj={};
 for(const key of billingKeys)if(Object.hasOwn(tenant,key))
   obj[key]=JSON.parse(JSON.stringify(tenant[key],(_,v)=>
    v&&typeof v.toMillis==="function"?v.toMillis():v));
 return createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}
function profileMatches(a,b,tenantId){
 return !!a&&!!b&&a.uid===b.uid&&a.role==="owner"&&b.role==="owner"&&
   a.tenantId===tenantId&&b.tenantId===tenantId&&
   a.email===b.email&&a.displayName===b.displayName&&
   a.active===true&&b.active===true;
}
function response(op,status,reason=null){
 return {ok:true,readOnly:true,operationId:op.operationId,
   tenantId:op.tenantId||null,kind:op.kind||null,
   status,ownerUid:op.ownerUid||null,
   displayName:status==="complete_verified"?op.afterName||null:null,
   ownerRevision:Number.isSafeInteger(op.ownerRevision)?op.ownerRevision:null,
   mayRetryWithNewOperationId:status==="failed_released",
   canIssueInvoice:false,canSettleMoney:false,canChangeSubscription:false,
   emailSent:false,reason};
}
module.exports={OP,ID,SLUG,createInput,updateInput,statusSelector,uidFor,
 emailHash,revision,normalizeTime,billingDigest,profileMatches,response};
