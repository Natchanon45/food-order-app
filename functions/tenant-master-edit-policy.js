"use strict";
// P1.2f: Store master only. Never changes original signup, owner identity,
// subscription dates, payments, credit, Revenue Share or selling permissions.
const {createHash}=require("node:crypto");
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const ID=/^[a-zA-Z0-9_-]{4,128}$/;
const SLUG=/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
const KINDS=new Set(["both","retail","restaurant_cafe"]);
const FIELDS=new Set(["tenantId","operationId","name","slug","phone",
 "address","businessType","expectedName","expectedSlug","expectedPhone",
 "expectedAddress","expectedBusinessType","expectedRevision"]);
function fail(code){const e=new Error(code);e.code=code;throw e;}
function normalizedBusiness(tenant){
 if(KINDS.has(tenant?.businessType))return tenant.businessType;
 const units=Array.isArray(tenant?.businessUnits)?tenant.businessUnits:[];
 if(units.length===1)return units[0]==="retail_pos"?"retail":
  units[0]==="order_delivery"?"restaurant_cafe":"both";
 return "both";
}
const text=v=>typeof v==="string"?v.trim():null;
function request(input){
 if(!input||typeof input!=="object"||Array.isArray(input)||
    Object.keys(input).length!==FIELDS.size||
    Object.keys(input).some(k=>!FIELDS.has(k)))
  fail("MASTER_INPUT_SHAPE_INVALID");
 if(!ID.test(input.tenantId||"")||!UUID.test(input.operationId||""))
  fail("MASTER_ID_INVALID");
 if(typeof input.name!=="string"||text(input.name)!==input.name||
    input.name.length<2||input.name.length>120||
    typeof input.expectedName!=="string"||
    text(input.expectedName)!==input.expectedName||
    input.expectedName.length<2||input.expectedName.length>120)
  fail("MASTER_NAME_INVALID");
 if(!SLUG.test(input.slug||"")||!SLUG.test(input.expectedSlug||""))
  fail("MASTER_SLUG_INVALID");
 for(const key of ["phone","address","expectedPhone","expectedAddress"]){
  if(typeof input[key]!=="string"||text(input[key])!==input[key]||
     input[key].length>(key.toLowerCase().includes("phone")?30:300))
   fail("MASTER_CONTACT_INVALID");
 }
 if(!KINDS.has(input.businessType)||!KINDS.has(input.expectedBusinessType))
  fail("MASTER_BUSINESS_INVALID");
 if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)
  fail("MASTER_REVISION_INVALID");
 return Object.freeze({...input});
}
function oldView(tenant,store={}){
 return Object.freeze({
  name:String(tenant?.name||"").trim(),
  slug:String(tenant?.slug||"").trim(),
  phone:String((Object.hasOwn(store,"shopPhone")
   ?store.shopPhone:tenant?.shopPhone)||"").trim(),
  address:String((Object.hasOwn(store,"shopAddress")
   ?store.shopAddress:tenant?.shopAddress)||"").trim(),
  businessType:normalizedBusiness(tenant),
  revision:tenant?.masterEditRevision??0,
 });
}
function compare(actual,request){
 const unchanged=actual.name===request.expectedName&&
  actual.slug===request.expectedSlug&&
  actual.phone===request.expectedPhone&&
  actual.address===request.expectedAddress&&
  actual.businessType===request.expectedBusinessType&&
  actual.revision===request.expectedRevision;
 if(!unchanged)fail("MASTER_STALE_ORIGINAL");
 if(!Number.isSafeInteger(actual.revision)||actual.revision<0)
  fail("MASTER_REVISION_INVALID");
}
function outcome(input,revision){
 return Object.freeze({tenantId:input.tenantId,name:input.name,
  slug:input.slug,phone:input.phone,address:input.address,
  businessType:input.businessType,revision});
}
function digest(input){
 const sorted=Object.fromEntries(Object.keys(input).sort().map(k=>[k,input[k]]));
 return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}
function receipt({input,actor,before,after,userCount,stamp}){
 return Object.freeze({
  kind:"tenant_master_edit_v1",tenantId:input.tenantId,
  operationId:input.operationId,actor,requestDigest:digest(input),
  before,after,userCount,createdAt:stamp,
  canSettleMoney:false,canReleaseTenant:false,canIssueInvoice:false,
  canChangeOwnerIdentity:false,changedSubscriptionTerms:false,
 });
}
function response(value,replayed=false){
 return {ok:true,readOnly:false,operationId:value.operationId,
  tenantId:value.tenantId,replayed,
  master:value.after,canSettleMoney:false,
  canReleaseTenant:false,canIssueInvoice:false,
  canChangeOwnerIdentity:false,changedSubscriptionTerms:false};
}
function readonly(row,status,tenantId,operationId){
 return {ok:true,readOnly:true,status,tenantId,operationId,
  master:status==="complete_current"?row?.after||null:null,
  canSettleMoney:false,canReleaseTenant:false,
  canIssueInvoice:false,canChangeOwnerIdentity:false,
  changedSubscriptionTerms:false};
}
module.exports={UUID,ID,SLUG,KINDS,request,oldView,compare,outcome,
 digest,receipt,response,readonly,normalizedBusiness};
