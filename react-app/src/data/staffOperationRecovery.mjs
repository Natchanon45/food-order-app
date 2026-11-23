// Only an opaque operation UUID is retained on the signed-in owner's
// session. No passwords, staff email, tenant bank details or request bodies.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const ID=/^[A-Za-z0-9_-]{4,128}$/;
export function staffPendingKey(ownerUid,tenantId){
 if(!ID.test(ownerUid||"")||!ID.test(tenantId||""))throw Error("STAFF_OPERATION_SCOPE_INVALID");
 return `penguin:staff-op:${ownerUid}:${tenantId}`;
}
export function readStaffPending(storage,ownerUid,tenantId){
 const value=storage.getItem(staffPendingKey(ownerUid,tenantId));
 if(value!==null&&!UUID.test(value))throw Error("STAFF_PENDING_STORAGE_CORRUPT");
 return value||"";
}
export function persistStaffPending(storage,ownerUid,tenantId,operationId){
 if(!UUID.test(operationId||""))throw Error("STAFF_OPERATION_ID_INVALID");
 const key=staffPendingKey(ownerUid,tenantId);
 const previous=storage.getItem(key);
 if(previous!==null)throw Error("STAFF_PREVIOUS_OPERATION_UNRESOLVED");
 storage.setItem(key,operationId);
 if(storage.getItem(key)!==operationId)throw Error("STAFF_OPERATION_STORAGE_UNCONFIRMED");
 return operationId;
}
export function clearStaffPending(storage,ownerUid,tenantId,operationId){
 if(!UUID.test(operationId||""))throw Error("STAFF_OPERATION_ID_INVALID");
 const key=staffPendingKey(ownerUid,tenantId);
 if(storage.getItem(key)!==operationId)throw Error("STAFF_OPERATION_ID_CHANGED");
 storage.removeItem(key);
 if(storage.getItem(key)!==null)throw Error("STAFF_OPERATION_CLEAR_FAILED");
}
export function verifiedStaffRow(status,rows){
 if(status?.status!=="complete_verified"||status.readOnly!==true||
    !UUID.test(status.operationId||"")||!ID.test(status.uid||"")||
    !Number.isSafeInteger(status.staffRevision)||status.staffRevision<1||
    !["create","update"].includes(status.kind))return false;
 return Array.isArray(rows)&&rows.some(user=>user.uid===status.uid&&
   user.staffRevision===status.staffRevision);
}
