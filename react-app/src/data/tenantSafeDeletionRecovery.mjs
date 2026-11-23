// P1.2g: Only opaque tenant ID + operation UUID survive a lost HTTP response.
// The recovery record is global to the Superadmin, so it remains available
// even when the deleted shop no longer appears in the directory.
const ID=/^[A-Za-z0-9_-]{4,128}$/;
const OP=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const PREFIX="penguin_p12g_tenant_delete_v1_";
export const pendingDeletionKey=uid=>ID.test(uid||"")?PREFIX+uid:null;
export function readPendingDeletion(uid,storage=globalThis?.sessionStorage){
 const key=pendingDeletionKey(uid);
 if(!key||!storage)return null;
 try{
  const item=JSON.parse(storage.getItem(key)||"null");
  if(item&&ID.test(item.tenantId||"")&&OP.test(item.operationId||"")&&
     Object.keys(item).length===2)return item;
 }catch{ /* blocked or malformed storage */ }
 return null;
}
export function holdPendingDeletion(uid,item,storage=globalThis?.sessionStorage){
 const key=pendingDeletionKey(uid);
 if(!key||!ID.test(item?.tenantId||"")||!OP.test(item?.operationId||"")||
    !storage||readPendingDeletion(uid,storage))return false;
 try{
  storage.setItem(key,JSON.stringify({
   tenantId:item.tenantId,operationId:item.operationId,
  }));
  return true;
 }catch{return false;}
}
export function releasePendingDeletion(uid,item,storage=globalThis?.sessionStorage){
 const key=pendingDeletionKey(uid);
 if(!key||!storage||!item)return false;
 try{
  const stored=readPendingDeletion(uid,storage);
  if(!stored||stored.tenantId!==item.tenantId||
    stored.operationId!==item.operationId)return false;
  storage.removeItem(key);
  return true;
 }catch{return false;}
}
const FALSE=["canDeleteBusinessData","canDeleteFinanceHistory",
 "canDeleteOwner","canReleaseTenant","canSettleMoney","canIssueInvoice"];
const REASONS=new Set([
 "TENANT_NOT_FOUND","TENANT_NOT_PRISTINE","TENANT_OWNER_OR_ACTIVATION",
 "TENANT_MASTER_FIELDS_UNEXPECTED","TENANT_SLUG_MISMATCH",
 "TENANT_SETTINGS_MISSING","TENANT_SETTINGS_UNEXPECTED",
 "TENANT_HAS_SUBCOLLECTIONS","TENANT_EXTERNAL_REFERENCES",
 "TENANT_PROVENANCE_UNKNOWN",
]);
const financialSafe=value=>FALSE.every(field=>value?.[field]===false);
export function validateDeletionSafety(value,tenantId){
 if(value?.ok!==true||value?.readOnly!==true||
  value.tenantId!==tenantId||typeof value.ready!=="boolean"||
  value.isHardDeleteRestricted!==true||
  value.canDeleteOnlyUnownedPlaceholder!==true||
  !financialSafe(value)||
  !Array.isArray(value.reasonCodes)||
  value.reasonCodes.length>Object.keys(REASONS).length||
  value.reasonCodes.some((code,i)=>!REASONS.has(code)||
   (i>0&&code<=value.reasonCodes[i-1]))||
  (value.ready!== (value.reasonCodes.length===0)))
   throw Error("TENANT_DELETE_PREVIEW_UNVERIFIED");
 return value;
}
export function validateDeletionWrite(value,pending){
 if(value?.ok!==true||value.readOnly!==false||
  value.deleted!==true||typeof value.replayed!=="boolean"||
  value.tenantId!==pending?.tenantId||
  value.operationId!==pending?.operationId||!financialSafe(value))
  throw Error("TENANT_DELETE_WRITE_UNCONFIRMED");
 return value;
}
const STATES=new Set(["not_found","review_required","deleted_verified"]);
export function validateDeletionStatus(value,pending){
 if(value?.ok!==true||value.readOnly!==true||
  !STATES.has(value.status)||
  value.tenantId!==pending?.tenantId||
  value.operationId!==pending?.operationId||!financialSafe(value))
  throw Error("TENANT_DELETE_STATUS_UNVERIFIED");
 return value;
}
export const canonicalTenantAbsent=(tenants,tenantId)=>
 Array.isArray(tenants)&&ID.test(tenantId||"")&&
 tenants.every(tenant=>tenant.id!==tenantId);
export const deletionUnknownError=error=>
 ["functions/deadline-exceeded","functions/unavailable",
  "functions/internal","functions/unknown"].includes(error?.code)||
 ["TENANT_DELETE_WRITE_UNCONFIRMED",
  "TENANT_DELETE_STATUS_UNVERIFIED"].includes(error?.message);
export const deletionReasonLabel=reason=>({
 TENANT_NOT_FOUND:"ไม่พบร้านค้า",
 TENANT_NOT_PRISTINE:"ร้านนี้เปิดใช้งานแล้ว หรือไม่ได้อยู่ระหว่างรอ Owner",
 TENANT_OWNER_OR_ACTIVATION:"มี Owner / รอบสมาชิก / ข้อมูลการเงินที่ต้องเก็บรักษา",
 TENANT_MASTER_FIELDS_UNEXPECTED:"ทะเบียนร้านมีข้อมูลเพิ่มเติม ต้องตรวจสอบ",
 TENANT_SLUG_MISMATCH:"ทะเบียน Slug ไม่ตรงกับร้าน",
 TENANT_SETTINGS_MISSING:"ไม่พบข้อมูลตั้งต้นของร้าน",
 TENANT_SETTINGS_UNEXPECTED:"การตั้งค่าร้านมีข้อมูลเพิ่มเติมที่ไม่อนุญาตให้ลบ",
 TENANT_HAS_SUBCOLLECTIONS:"ร้านมีรายการหรือคอลเลกชันที่ต้องเก็บรักษา",
 TENANT_EXTERNAL_REFERENCES:"มีข้อมูลอ้างอิงร้านจากระบบอื่น",
 TENANT_PROVENANCE_UNKNOWN:"แหล่งที่มาของข้อมูลร้านยังไม่ชัดเจน",
}[reason]||"มีข้อมูลที่ต้องตรวจสอบก่อนลบ");
