import "@/ui/owner-account-recovery.css";

export function OwnerOperationRecoveryNotice({tenantName,pendingOperationId,
 checking,onCheck,statusText,storageError}) {
 if(!pendingOperationId&&!storageError)return null;
 return <section className="owner-op-recovery" role="alert" data-owner-operation-recovery>
   <span className="owner-op-recovery-icon" aria-hidden="true"><i className="bi bi-shield-exclamation"/></span>
   <div className="owner-op-recovery-copy">
     <strong>ยังยืนยันผลการจัดการ Owner {tenantName?"— "+tenantName:""} ไม่ได้</strong>
     <p>{storageError||"ระบบเก็บหมายเลขคำสั่งเดิมไว้แล้ว และจะไม่ส่งคำสั่งสร้างหรือแก้ไข Owner ซ้ำจนกว่า Firebase จะยืนยันผล"}</p>
     {statusText?<small data-owner-operation-status>{statusText}</small>:null}
   </div>
   {pendingOperationId&&!storageError?
     <button type="button" className="btn btn-primary owner-op-recovery-action"
       onClick={onCheck} disabled={checking} data-owner-check-original>
       <i className={"bi "+(checking?"bi-hourglass-split":"bi-arrow-clockwise")} aria-hidden="true"/>
       <span>{checking?"กำลังตรวจสถานะ":"ตรวจสถานะคำสั่งเดิม"}</span>
     </button>:null}
 </section>;
}
