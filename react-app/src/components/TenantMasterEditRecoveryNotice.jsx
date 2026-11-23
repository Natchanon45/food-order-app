import "@/ui/tenant-master-edit-recovery.css";

// The only control after an uncertain master write is a READ-ONLY recovery.
// Editing the same Tenant/Slug again is disabled while this is visible.
export function TenantMasterEditRecoveryNotice({tenantId,checking=false,onCheck}){
 if(!tenantId)return null;
 return <div className="tenant-master-edit-recovery" role="alert"
  data-tenant-master-edit-pending={tenantId}>
  <i className="bi bi-shield-exclamation" aria-hidden="true"></i>
  <div>
   <strong>ยังไม่ได้รับรองผลการแก้ไขร้านจากเซิร์ฟเวอร์</strong>
   <p>คำสั่งเดิมอาจบันทึกข้อมูลร้านและเปลี่ยน Slug แล้ว
     ห้ามบันทึกซ้ำจนกว่าจะตรวจสถานะจาก Firebase และอ่านข้อมูลร้านซ้ำ</p>
   <p>กรณีไม่พบคำสั่งหรือข้อมูลไม่ตรงกัน ต้องตรวจสอบก่อนทำซ้ำ</p>
  </div>
  <button className="btn btn-sm" type="button" disabled={checking}
   data-tenant-master-edit-reconcile={tenantId} onClick={onCheck}>
   <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
   {checking?"กำลังตรวจคำสั่งเดิม…":"ตรวจสถานะคำสั่งเดิม"}
  </button>
 </div>;
}
