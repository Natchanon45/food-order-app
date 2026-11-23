import "@/ui/staff-operation-recovery.css";

export function StaffOperationRecoveryNotice({
  pendingOperationId, checking, onCheck, storageError, statusText,
}) {
  if (!pendingOperationId && !storageError) return null;
  return (
    <section className="staff-op-recovery" role="alert" data-staff-operation-recovery>
      <span className="staff-op-recovery-icon" aria-hidden="true">
        <i className="bi bi-shield-exclamation" />
      </span>
      <div className="staff-op-recovery-copy">
        <strong>มีคำสั่งจัดการบัญชีพนักงานที่ยังไม่ได้ยืนยันผล</strong>
        <p>{storageError ||
          "ระบบเก็บหมายเลขคำสั่งเดิมไว้แล้ว จะไม่ส่งคำสั่งสร้าง/แก้ไขซ้ำจนกว่าจะตรวจสถานะจาก Firebase"}</p>
        {statusText ? <small data-staff-operation-status>{statusText}</small> : null}
      </div>
      {!storageError && pendingOperationId ? (
        <button type="button" className="btn btn-primary staff-op-recovery-button"
          onClick={onCheck} disabled={checking} data-staff-check-original>
          <i className={"bi " + (checking ? "bi-hourglass-split" : "bi-arrow-clockwise")}
            aria-hidden="true" />
          <span>{checking ? "กำลังตรวจสถานะ" : "ตรวจสถานะคำสั่งเดิม"}</span>
        </button>
      ) : null}
    </section>
  );
}
