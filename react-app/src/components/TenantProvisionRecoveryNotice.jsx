import "@/ui/tenant-provision-recovery.css";

/** Reusable, purely presentational status for a server-side ambiguous write.
 * Never retries provision or changes operation ID. All actions delegate to
 * the Superadmin-only read/reconcile path in AdminTenantsPage. */
export function TenantProvisionRecoveryNotice({
  operationId, checking=false, busy=false, mode="banner", onCheck,
}){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(operationId||""))
  return null;
 const modal=mode==="modal";
 const content=<>
  <i className="bi bi-shield-exclamation" aria-hidden="true"/>
  <div>
   <strong>{modal
    ? "คำขอเดิมยังไม่ยืนยัน ห้ามส่งสร้างร้านซ้ำ"
    : "มีคำขอสร้างร้านและ Owner ที่ยังรอการยืนยัน"}</strong>
   <small>เลขอ้างอิง {operationId} · ตรวจสอบจากเซิร์ฟเวอร์ก่อนสร้างคำขอใหม่</small>
  </div>
  <button type="button" className="btn btn-sm"
   data-check-tenant-provision onClick={onCheck} disabled={checking||busy}>
   <i className="bi bi-arrow-clockwise" aria-hidden="true"/>
   {checking?"กำลังตรวจสอบ…":"ตรวจสถานะคำขอเดิม"}
  </button>
 </>;
 return modal
  ? <div className="tenant-provision-inline" role="status" data-pending-create-modal>{content}</div>
  : <section className="card tenant-provision-banner" role="status"
     data-pending-tenant-provision>{content}</section>;
}
