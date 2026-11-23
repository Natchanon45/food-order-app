import "@/ui/tenant-deletion-recovery.css";

export function TenantDeletionRecoveryNotice({pending,checking,onCheck}){
 if(!pending)return null;
 return <section className="tenant-deletion-recovery"
  role="alert" data-tenant-delete-pending={pending.tenantId}>
  <i className="bi bi-shield-lock" aria-hidden="true"></i>
  <div className="tenant-deletion-recovery-body">
   <strong>ยังยืนยันผลการลบร้านทดสอบไม่ได้</strong>
   <p>คำสั่งเดิมอาจลบร้านและคืน Slug แล้ว ห้ามลบซ้ำ
     หรือส่งคำสั่งลบร้านอื่นจนกว่าจะตรวจผลจาก Firebase</p>
   <small>หมายเลขร้าน: {pending.tenantId}</small>
  </div>
  <button className="btn btn-sm" type="button"
   data-tenant-delete-reconcile disabled={checking} onClick={onCheck}>
   <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
   {checking?"กำลังตรวจคำสั่งเดิม…":"ตรวจสถานะคำสั่งเดิม"}
  </button>
 </section>;
}
