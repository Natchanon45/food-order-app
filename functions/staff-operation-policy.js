"use strict";
const {createHash}=require("node:crypto");
const OP=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const ID=/^[A-Za-z0-9_-]{4,128}$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES=Object.freeze(["admin","cashier","kitchen","manager","stock"]);
const SCOPES=Object.freeze(["order_delivery","retail_pos","both"]);
const allowed=(object,keys)=>object&&typeof object==="object"&&!Array.isArray(object)&&
  Object.keys(object).length===keys.length&&keys.every(key=>Object.hasOwn(object,key));
function problem(code){const error=new Error(code);error.code=code;throw error;}
function base(data,kind){
 const shared=["expectedTenantId","operationId"];
 const keys=kind==="create"?[...shared,"displayName","email","password","role","businessScope","active"]:
   [...shared,"uid","expectedRevision","displayName","role","businessScope","active"];
 if(!allowed(data,keys))problem("STAFF_COMMAND_SHAPE_INVALID");
 if(!ID.test(data.expectedTenantId)||!OP.test(data.operationId))
   problem("STAFF_COMMAND_SELECTOR_INVALID");
 const displayName=data.displayName;
 if(typeof displayName!=="string"||displayName.trim()!==displayName||
    displayName.length<2||displayName.length>100)problem("STAFF_NAME_INVALID");
 if(!ROLES.includes(data.role)||!SCOPES.includes(data.businessScope)||
    typeof data.active!=="boolean")problem("STAFF_ROLE_SCOPE_INVALID");
 return {...data,kind};
}
function createInput(data){
 const input=base(data,"create");
 if(typeof input.email!=="string"||input.email.length>160||
    input.email.trim().toLowerCase()!==input.email||!EMAIL.test(input.email))
   problem("STAFF_EMAIL_INVALID");
 if(typeof input.password!=="string"||input.password.length<8||
    input.password.length>128)problem("STAFF_PASSWORD_INVALID");
 return input;
}
function updateInput(data){
 const input=base(data,"update");
 if(!ID.test(input.uid)||!Number.isSafeInteger(input.expectedRevision)||
    input.expectedRevision<0)problem("STAFF_STALE_SELECTOR_INVALID");
 return input;
}
function statusSelector(data){
 if(!allowed(data,["expectedTenantId","operationId"])||
    !ID.test(data.expectedTenantId)||!OP.test(data.operationId))
    problem("STAFF_STATUS_SELECTOR_INVALID");
 return data;
}
const uidFor=operationId=>"stf-"+operationId.replaceAll("-","");
const emailLockKey=email=>createHash("sha256").update(email).digest("hex");
const revision=user=>Number.isSafeInteger(user?.staffRevision)&&user.staffRevision>=0?
 user.staffRevision:0;
const unit=scope=>scope==="retail_pos"?"retail_pos":scope==="both"?"all":"order_delivery";
function view(user={}){
 return {
  uid:String(user.uid||""),
  email:String(user.email||"").toLowerCase(),
  displayName:String(user.displayName||""),
  role:String(user.role||""),
  businessScope:String(user.businessScope||"order_delivery"),
  active:user.active!==false,
  staffRevision:revision(user),
 };
}
function matches(doc,expected,tenantId){
 if(!doc||doc.tenantId!==tenantId)return false;
 const actual=view(doc);
 return Object.entries(expected).every(([k,v])=>actual[k]===v);
}
function response(op,status,{reason=null}={}){
 return {ok:true,readOnly:true,status,operationId:op.operationId,
  kind:op.kind||null,uid:op.staffUid||null,tenantId:op.tenantId||null,
  staffRevision:op.after?.staffRevision??null,
  reason,mayRetryWithNewOperationId:status==="failed_released",
  canSendEmail:false,canSettleMoney:false};
}
module.exports={OP,ID,ROLES,SCOPES,createInput,updateInput,statusSelector,
 uidFor,emailLockKey,view,matches,revision,unit,response};
