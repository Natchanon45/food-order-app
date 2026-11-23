const ID=/^[A-Za-z0-9_-]{4,128}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function ownerOperationKey(uid,tenantId){
 if(!ID.test(uid||"")||!ID.test(tenantId||""))
   throw Error("OWNER_RECOVERY_SCOPE_INVALID");
 return `penguin:p13c:owner:${uid}:${tenantId}`;
}
export function readOwnerOperation(storage,uid,tenantId){
 const saved=storage.getItem(ownerOperationKey(uid,tenantId));
 if(saved!==null&&!UUID.test(saved))throw Error("OWNER_OPERATION_STORAGE_CORRUPT");
 return saved||"";
}
export function holdOwnerOperation(storage,uid,tenantId,operationId){
 if(!UUID.test(operationId||""))throw Error("OWNER_OPERATION_ID_INVALID");
 const key=ownerOperationKey(uid,tenantId);
 if(storage.getItem(key)!==null)throw Error("OWNER_OPERATION_ALREADY_PENDING");
 storage.setItem(key,operationId);
 if(storage.getItem(key)!==operationId)
   throw Error("OWNER_OPERATION_STORAGE_NOT_CONFIRMED");
 return operationId;
}
export function releaseOwnerOperation(storage,uid,tenantId,operationId){
 if(!UUID.test(operationId||""))throw Error("OWNER_OPERATION_ID_INVALID");
 const key=ownerOperationKey(uid,tenantId);
 if(storage.getItem(key)!==operationId)throw Error("OWNER_OPERATION_CHANGED");
 storage.removeItem(key);
 if(storage.getItem(key)!==null)throw Error("OWNER_OPERATION_RELEASE_NOT_CONFIRMED");
}
export function verifyOwnerOperation(status,tenantId,operationId){
 if(!status||status.ok!==true||status.readOnly!==true||
    status.operationId!==operationId||status.tenantId!==tenantId||
    !UUID.test(operationId)||!ID.test(tenantId)||
    status.canIssueInvoice!==false||status.canSettleMoney!==false||
    status.canChangeSubscription!==false||status.emailSent!==false)
   throw Error("OWNER_OPERATION_STATUS_INVALID");
 if(!["create","update"].includes(status.kind)&&status.status!=="not_found")
   throw Error("OWNER_OPERATION_KIND_INVALID");
 if(status.status==="complete_verified"){
   if(!["create","update"].includes(status.kind)||
      !ID.test(status.ownerUid||"")||
      !Number.isSafeInteger(status.ownerRevision)||status.ownerRevision<1||
      typeof status.displayName!=="string"||status.displayName.length<2||
      status.mayRetryWithNewOperationId!==false)
     throw Error("OWNER_OPERATION_PROOF_INVALID");
 }else if(status.status==="failed_released"){
   if(status.kind!=="create"||status.mayRetryWithNewOperationId!==true)
     throw Error("OWNER_OPERATION_RELEASE_INVALID");
 }else if(!["pending_review","review_required","not_found"].includes(status.status)||
      status.mayRetryWithNewOperationId!==false)
   throw Error("OWNER_OPERATION_UNRECOGNIZED");
 return status;
}
export function canonicalOwnerMatches(tenants,status){
 if(status?.status!=="complete_verified"||!Array.isArray(tenants))return false;
 const row=tenants.find(t=>t.id===status.tenantId);
 if(!row||row.ownerUid!==status.ownerUid||
    row.ownerDisplayName!==status.displayName||
    row.ownerRevision!==status.ownerRevision)return false;
 if(status.kind==="create"&&row.onboardingRequired===true)return false;
 return true;
}
