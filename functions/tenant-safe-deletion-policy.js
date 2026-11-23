"use strict";
// P1.2g: hard delete ONLY an unactivated, unowned, empty legacy placeholder.
// All provisioned/active/financial/migrated stores MUST be retained.
const {createHash}=require("node:crypto");
const ID=/^[A-Za-z0-9_-]{4,128}$/;
const OP=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SLUG=/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
const TENANT_FIELDS=new Set([
 "id","name","slug","active","onboardingRequired",
 "createdBy","createdAt","updatedAt","masterEditRevision","masterEditedBy",
]);
const STORE_FIELDS=new Set([
 "tenantId","shopName","shopPhone","shopAddress",
 "deliveryFeeNearby","deliveryFeeGeneral","deliveryFeeFar",
 "createdAt","updatedAt",
]);
const EXTERNAL_TENANT_REFERENCES=Object.freeze([
 "users","platformTenantProvisions","publicTenantSignups",
 "financeSlipClaims","hybridBillingSlipReferences",
 "stripeWalletSandboxTenants","paymentCompanionTenants",
 "m7StripeTestIntentClaims","m7StripeTestEventClaims",
 "lalamoveWalletTopupDedupe","merchantSlipImageClaims",
 "lkShopDevices","lkShopActivePairings",
]);
const REASONS=Object.freeze({
 TENANT_NOT_FOUND:"TENANT_NOT_FOUND",
 TENANT_NOT_PRISTINE:"TENANT_NOT_PRISTINE",
 TENANT_OWNER_OR_ACTIVATION:"TENANT_OWNER_OR_ACTIVATION",
 TENANT_MASTER_FIELDS_UNEXPECTED:"TENANT_MASTER_FIELDS_UNEXPECTED",
 TENANT_SLUG_MISMATCH:"TENANT_SLUG_MISMATCH",
 TENANT_SETTINGS_MISSING:"TENANT_SETTINGS_MISSING",
 TENANT_SETTINGS_UNEXPECTED:"TENANT_SETTINGS_UNEXPECTED",
 TENANT_HAS_SUBCOLLECTIONS:"TENANT_HAS_SUBCOLLECTIONS",
 TENANT_EXTERNAL_REFERENCES:"TENANT_EXTERNAL_REFERENCES",
 TENANT_PROVENANCE_UNKNOWN:"TENANT_PROVENANCE_UNKNOWN",
});
const issue=code=>{const err=new Error(code);err.code=code;throw err;};
function selector(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||
  Object.keys(data).length!==1||!ID.test(data.tenantId||""))
  issue("TENANT_DELETE_SELECTOR_INVALID");
 return data.tenantId;
}
function request(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||
  Object.keys(data).length!==6||!ID.test(data.tenantId||"")||
  !OP.test(data.operationId||"")||
  typeof data.expectedName!=="string"||
  data.expectedName.trim()!==data.expectedName||
  data.expectedName.length<2||data.expectedName.length>120||
  !SLUG.test(data.expectedSlug||"")||
  !Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<0||
  data.intent!=="delete_unowned_placeholder")
  issue("TENANT_DELETE_REQUEST_INVALID");
 return Object.freeze({...data});
}
function inspect(tenant,store,slug,subcollections=[],externalHits=[]){
 const reasons=new Set();
 if(!tenant){reasons.add(REASONS.TENANT_NOT_FOUND);}
 else{
  if(tenant.active!==false||tenant.onboardingRequired!==true)
   reasons.add(REASONS.TENANT_NOT_PRISTINE);
  if(tenant.ownerUid||tenant.ownerEmail||tenant.ownerDisplayName||
     tenant.firstActivatedAt||tenant.trialStartsAt||tenant.trialEndsAt||
     tenant.subscriptionExpiresAt||tenant.planCode||tenant.signupBilling||
     tenant.subscriptionStatus||tenant.revenueShareSuspended||
     tenant.m7FinanceAccessStatus||tenant.m7InvoiceUnpaidCents||
     tenant.hybridBillingSuspended||tenant.suspensionReason)
   reasons.add(REASONS.TENANT_OWNER_OR_ACTIVATION);
  if(Object.keys(tenant).some(key=>!TENANT_FIELDS.has(key))||
     !ID.test(tenant.id||"")||typeof tenant.createdBy!=="string"||
     !ID.test(tenant.createdBy)||!SLUG.test(tenant.slug||"")||
     typeof tenant.name!=="string"||tenant.name.trim()!==tenant.name||
     !Number.isSafeInteger(tenant.masterEditRevision??0)||
     (tenant.masterEditRevision??0)!==0)
   reasons.add(REASONS.TENANT_MASTER_FIELDS_UNEXPECTED);
  if(!slug||slug.tenantId!==tenant.id||slug.slug!==tenant.slug||
    slug.active!==false||slug.name!==tenant.name||
    slug.provisioningId||slug.ownerUid)
   reasons.add(REASONS.TENANT_SLUG_MISMATCH);
 }
 if(!store){
  reasons.add(REASONS.TENANT_SETTINGS_MISSING);
 }else if(!tenant||store.tenantId!==tenant.id||
  store.shopName!==tenant.name||
  Object.keys(store).some(k=>!STORE_FIELDS.has(k)))
  reasons.add(REASONS.TENANT_SETTINGS_UNEXPECTED);
 if(!Array.isArray(subcollections)||
   subcollections.some(name=>name!=="settings"))
  reasons.add(REASONS.TENANT_HAS_SUBCOLLECTIONS);
 if(!Array.isArray(externalHits)||externalHits.length)
  reasons.add(REASONS.TENANT_EXTERNAL_REFERENCES);
 const sorted=[...reasons].sort();
 return Object.freeze({ready:sorted.length===0,reasonCodes:sorted,
  isHardDeleteRestricted:true,tenantId:tenant?.id||null,
  canDeleteOnlyUnownedPlaceholder:true,canDeleteBusinessData:false,
  canDeleteFinanceHistory:false,canDeleteOwner:false});
}
function compare(tenant,input){
 if(!tenant||tenant.name!==input.expectedName||
    tenant.slug!==input.expectedSlug||
    (tenant.masterEditRevision??0)!==input.expectedRevision)
  issue("TENANT_DELETE_STALE_STATE");
}
function digest(data){
 return createHash("sha256").update(JSON.stringify(
  Object.fromEntries(Object.keys(data).sort().map(k=>[k,data[k]])))
 ).digest("hex");
}
function receipt({input,actor,now}){
 return {kind:"tenant_empty_placeholder_delete_v1",
  tenantId:input.tenantId,operationId:input.operationId,
  actor,requestDigest:digest(input),
  deletedSlug:input.expectedSlug,deletedName:input.expectedName,
  deletedAt:now,
  canDeleteBusinessData:false,canDeleteFinanceHistory:false,
  canDeleteOwner:false,canReleaseTenant:false,
  canSettleMoney:false,canIssueInvoice:false};
}
function response(value,replayed=false){
 return {ok:true,tenantId:value.tenantId,operationId:value.operationId,
  deleted:true,replayed,readOnly:false,
  canDeleteBusinessData:false,canDeleteFinanceHistory:false,
  canDeleteOwner:false,canReleaseTenant:false,
  canSettleMoney:false,canIssueInvoice:false};
}
function status({tenantId,operationId,state}){
 return {ok:true,readOnly:true,tenantId,operationId,status:state,
  canDeleteBusinessData:false,canDeleteFinanceHistory:false,
  canDeleteOwner:false,canReleaseTenant:false,
  canSettleMoney:false,canIssueInvoice:false};
}
module.exports={ID,OP,SLUG,REASONS,TENANT_FIELDS,STORE_FIELDS,
 EXTERNAL_TENANT_REFERENCES,selector,request,inspect,compare,digest,
 receipt,response,status};
