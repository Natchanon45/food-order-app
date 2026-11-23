// P1.2f exact-once master edit recovery. Only an opaque UUID is persisted
// per signed-in Superadmin/tenant. Never credentials, phone or address.
const UID=/^[A-Za-z0-9_-]{4,128}$/;
const OP=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const PREFIX="penguin_p12f_master_edit_";
export const masterEditKey=(uid,tenantId)=>
 UID.test(uid||"")&&UID.test(tenantId||"")?
 PREFIX+uid+"_"+tenantId:null;
export const readPendingMasterEdit=(uid,tenantId,store=globalThis?.sessionStorage)=>{
 const key=masterEditKey(uid,tenantId);
 if(!key||!store)return null;
 try{const value=store.getItem(key);return OP.test(value||"")?value:null;}
 catch{return null;}
};
export const holdPendingMasterEdit=(uid,tenantId,op,store=globalThis?.sessionStorage)=>{
 const key=masterEditKey(uid,tenantId);
 if(!key||!OP.test(op||"")||!store)return false;
 try{
  const prior=store.getItem(key);
  if(prior&&prior!==op)return false;
  store.setItem(key,op);
  return true;
 }catch{return false;}
};
export const releasePendingMasterEdit=(uid,tenantId,op,store=globalThis?.sessionStorage)=>{
 const key=masterEditKey(uid,tenantId);
 if(!key||!OP.test(op||"")||!store)return false;
 try{
  if(store.getItem(key)!==op)return false;
  store.removeItem(key);
  return true;
 }catch{return false;}
};
export const masterBusinessType=tenant=>{
 if(["both","restaurant_cafe","retail"].includes(tenant.businessType))
  return tenant.businessType;
 const units=Array.isArray(tenant.businessUnits)?tenant.businessUnits:[];
 if(units.length===1)return units[0]==="retail_pos"?"retail":
  units[0]==="order_delivery"?"restaurant_cafe":"both";
 return "both";
};
export const masterSnapshot=tenant=>({
 expectedName:String(tenant.name||"").trim(),
 expectedSlug:String(tenant.slug||"").trim(),
 expectedPhone:String(tenant.shopPhone||"").trim(),
 expectedAddress:String(tenant.shopAddress||"").trim(),
 expectedBusinessType:masterBusinessType(tenant),
 expectedRevision:tenant.masterEditRevision??0,
});
const safeMaster=(value,tenantId)=>{
 if(!value||typeof value!=="object"||Array.isArray(value)||
   value.tenantId!==tenantId||
   typeof value.name!=="string"||value.name.trim()!==value.name||
   value.name.length<2||value.name.length>120||
   !/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(value.slug||"")||
   !["both","restaurant_cafe","retail"].includes(value.businessType)||
   typeof value.phone!=="string"||value.phone.length>30||
   typeof value.address!=="string"||value.address.length>300||
   !Number.isSafeInteger(value.revision)||value.revision<1)
  throw Error("MASTER_EDIT_RESULT_UNVERIFIED");
 return value;
};
const noFinancialWrite=value=>value.canSettleMoney===false&&
 value.canReleaseTenant===false&&value.canIssueInvoice===false&&
 value.canChangeOwnerIdentity===false&&value.changedSubscriptionTerms===false;
export const validateMasterEditWrite=(value,input)=>{
 if(!value||value.ok!==true||value.readOnly!==false||
   value.tenantId!==input.tenantId||value.operationId!==input.operationId||
   !noFinancialWrite(value)||typeof value.replayed!=="boolean")
  throw Error("MASTER_EDIT_WRITE_UNCONFIRMED");
 const r=safeMaster(value.master,input.tenantId);
 if(r.revision!==input.expectedRevision+1||
  r.slug!==input.slug||r.name!==input.name||r.phone!==input.phone||
  r.address!==input.address||r.businessType!==input.businessType)
  throw Error("MASTER_EDIT_WRITE_UNCONFIRMED");
 return value;
};
const STATUSES=new Set(["not_found","review_required",
 "complete_current","complete_superseded"]);
export const validateMasterEditOperation=(value,tenantId,op)=>{
 if(!value||value.ok!==true||value.readOnly!==true||
  value.tenantId!==tenantId||value.operationId!==op||
  !STATUSES.has(value.status)||!noFinancialWrite(value))
  throw Error("MASTER_EDIT_OPERATION_UNVERIFIED");
 if(value.status==="complete_current")safeMaster(value.master,tenantId);
 else if(value.master!==null)
  throw Error("MASTER_EDIT_OPERATION_UNVERIFIED");
 return value;
};
export const canonicalMasterMatches=(rows,result)=>{
 if(!Array.isArray(rows)||!result?.tenantId)return false;
 const row=rows.find(x=>x.id===result.tenantId);
 return Boolean(row&&row.name===result.name&&row.slug===result.slug&&
  String(row.shopPhone||"").trim()===result.phone&&
  String(row.shopAddress||"").trim()===result.address&&
  masterBusinessType(row)===result.businessType&&
  row.masterEditRevision===result.revision);
};
export const masterUnknownError=error=>
 ["functions/deadline-exceeded","functions/unavailable",
 "functions/internal","functions/unknown"].includes(error?.code)||
 ["MASTER_EDIT_WRITE_UNCONFIRMED","MASTER_EDIT_OPERATION_UNVERIFIED",
  "MASTER_EDIT_RESULT_UNVERIFIED"].includes(error?.message);
