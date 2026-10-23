import { useEffect, useState } from "react";
import {
  HYBRID_TENANT_PROOF_SUBMISSION_READY, HYBRID_PROOF_ACCEPT,
  MAX_HYBRID_PROOF_BYTES, describeLocalHybridProof,
  isEligibleHybridInvoice,
} from "@/data/hybridTenantPaymentDraft";

const tr = (thai, en, isThai) => isThai ? thai : en;

export function HybridTenantProofPanel({ tenantId, invoice, thai, money, onClose }) {
  const [file, setFile] = useState(null);
  const [localError, setLocalError] = useState("");

  // Never retain a slip selected for a previous invoice, tenant or session.
  useEffect(() => {
    setFile(null);
    setLocalError("");
  }, [tenantId, invoice?.id, invoice?.status, invoice?.amount]);

  if (!isEligibleHybridInvoice(invoice)) return null;

  function selectLocalFile(event) {
    const selected = event.target.files?.[0] || null;
    // The input is not persisted; never create a Storage file or bank claim.
    event.target.value = "";
    setFile(null);
    setLocalError("");
    if (!selected) return;
    const preview = describeLocalHybridProof({ tenantId, invoice, file: selected });
    if (!preview.ok) {
      setLocalError(preview.code);
      return;
    }
    setFile(selected);
  }

  const draft = file
    ? describeLocalHybridProof({ tenantId, invoice, file })
    : null;
  const validDraft = draft?.ok === true;

  return (
    <section className="hybrid-tenant-proof card" aria-label={tr(
      "แบบฟอร์มเตรียมหลักฐานการชำระบิล", "Prepare invoice payment evidence", thai
    )}>
      <div className="hybrid-tenant-proof-heading">
        <div>
          <h3>{tr("เตรียมหลักฐานการชำระ", "Prepare payment evidence", thai)}</h3>
          <p className="hybrid-review-id">{invoice.id}</p>
        </div>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          <i className="bi bi-x-lg app-icon" aria-hidden="true"></i>
          <span>{tr("ปิด", "Close", thai)}</span>
        </button>
      </div>
      <div className="hybrid-tenant-proof-amount">
        <small>{tr("ยอดตาม Invoice จริง", "Actual invoice amount", thai)}</small>
        <strong>{money(invoice.amount)}</strong>
      </div>
      <p role="status" className="hybrid-tenant-proof-warning">
        <i className="bi bi-exclamation-circle app-icon" aria-hidden="true"></i>
        <span>{tr(
          "ยังไม่เปิดระบบรับชำระ โปรดอย่าโอนเงินตามหน้านี้ และยังไม่ใช่ใบแจ้งหนี้เพื่อเรียกเก็บเงินจริง",
          "Payments are not enabled. Do not transfer money based on this screen; this is not an active payment request.",
          thai
        )}</span>
      </p>
      <p className="hybrid-tenant-proof-explain">{tr(
        "เลือกไฟล์สลิปเพื่อทดลองตรวจรูปแบบในเครื่องเท่านั้น ระบบจะไม่อัปโหลดหรือเก็บไฟล์นี้",
        "Select an evidence file to preview local validation only. It will not be uploaded or stored.",
        thai
      )}</p>
      <label htmlFor="hybridTenantProofFile">
        {tr("เลือกไฟล์หลักฐาน", "Choose evidence file", thai)}
      </label>
      <input id="hybridTenantProofFile" type="file"
        accept={HYBRID_PROOF_ACCEPT}
        onChange={selectLocalFile}
        aria-describedby="hybridTenantProofHelp" />
      <small id="hybridTenantProofHelp">
        {tr("รองรับ JPG, PNG, WebP หรือ PDF ไม่เกิน 10 MB",
          "JPG, PNG, WebP or PDF; maximum 10 MB", thai)}
      </small>
      {localError ? <p role="alert" className="hybrid-tenant-proof-error">
        {localError === "INVALID_PROOF_SIZE"
          ? tr("ไฟล์ว่างเปล่าหรือมีขนาดเกิน 10 MB", "File is empty or exceeds 10 MB", thai)
          : tr("ชนิดไฟล์หรือชื่อไฟล์ไม่ถูกต้อง", "Invalid file type or filename", thai)}
      </p> : null}
      {validDraft ? <div className="hybrid-tenant-proof-summary" role="status">
        <i className="bi bi-file-earmark-check app-icon" aria-hidden="true"></i>
        <div>
          <strong>{draft.fileName}</strong>
          <small>{(draft.fileSize / 1024 / 1024).toFixed(2)} MB — {tr(
            "ตรวจรูปแบบไฟล์ผ่าน (ยังไม่ได้ส่ง)", "Local file check passed (not submitted)", thai
          )}</small>
        </div>
      </div> : null}
      <div className="hybrid-tenant-proof-actions">
        <button type="button" className="btn btn-sm" disabled={
          !HYBRID_TENANT_PROOF_SUBMISSION_READY || !validDraft
        }>
          <i className="bi bi-cloud-arrow-up app-icon" aria-hidden="true"></i>
          <span>{tr("ส่งหลักฐานชำระ", "Submit evidence", thai)}</span>
        </button>
      </div>
      <small className="hybrid-review-closed">
        {tr(
          "ปุ่มส่งหลักฐานถูกล็อกไว้จนกว่าจะผ่านการอนุมัติเปิดระบบการเงินจริง",
          "Evidence submission is locked until financial payment workflows are approved for release.",
          thai
        )}
      </small>
      <small className="hybrid-tenant-proof-private">
        {tr(
          "ไม่มีการบันทึกไฟล์ การตรวจธนาคาร หรือการเปลี่ยนสถานะบิลจากหน้าทดลองนี้",
          "This preview does not store files, verify bank transfers or change invoice status.",
          thai
        )}
      </small>
    </section>
  );
}
