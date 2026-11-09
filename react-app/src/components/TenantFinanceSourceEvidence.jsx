import { useCallback, useEffect, useState } from "react";
import { getPlatformTenantHybridInvoiceEvidence } from "@/data/platformTenantService";

const formatBaht = amountCents =>
  Number.isSafeInteger(amountCents) && amountCents >= 0
    ? new Intl.NumberFormat("th-TH", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(amountCents / 100)
    : "—";
const dateLabel = value => {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "—";
  const [year, month, day] = text.split("-");
  return day + "/" + month + "/" + (Number(year) + 543);
};
const labels = {
  monthly: "สมาชิกรายเดือน",
  yearly: "สมาชิกรายปี",
  delivery_daily: "ส่วนแบ่ง Delivery",
};
const statusLabels = {
  issued: "ทะเบียนบันทึก: ออกแล้ว (ยังไม่ยืนยันธนาคาร)",
  pending_review: "ทะเบียนบันทึก: รอตรวจ",
  rejected: "ทะเบียนบันทึก: สลิปถูกปฏิเสธ",
  paid: "ทะเบียนบันทึก: ชำระแล้ว (ไม่มีหลักฐานธนาคารอิสระ)",
};
function validEvidence(value, tenantId) {
  const info = value?.invoiceEvidence;
  if (value?.ok !== true || value.tenantId !== tenantId
    || value.source !== "hybrid_billing_period_firestore"
    || value.coverage !== "single_cycle_only"
    || value.canIssueRealInvoice !== false || value.canSettleMoney !== false
    || value.canReleaseTenant !== false || value.bankSourceVerified !== false
    || value.originalSignupVerified !== false) return false;
  if (value.available === false && value.status === "unverified"
    && info == null) return true;
  if (value.available !== true || value.status !== "source_records_only"
    || !info || typeof info !== "object") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(info.cycleStartDate)
    || !/^\d{4}-\d{2}-\d{2}$/.test(info.cycleEndExclusiveDate)
    || !Array.isArray(info.invoices) || info.invoices.length > 40
    || info.invoiceCount !== info.invoices.length
    || !Number.isSafeInteger(info.recordedAmountCents)
    || info.recordedAmountCents < 0
    || !Number.isSafeInteger(info.recordedOpenAmountCents)
    || info.recordedOpenAmountCents < 0) return false;
  let sum = 0;
  for (const item of info.invoices) {
    if (!item || typeof item.id !== "string" || item.id.length > 128
      || !labels[item.kind] || !statusLabels[item.status]
      || item.bankVerified !== false || item.settlementAuthority !== false
      || !Number.isSafeInteger(item.amountCents) || item.amountCents < 0
      || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return false;
    sum += item.amountCents;
  }
  return sum === info.recordedAmountCents;
}
export function TenantFinanceSourceEvidence({ tenantId }) {
  const [state, setState] = useState({ id: "", status: "loading", data: null });
  const reload = useCallback(() => {
    const id = String(tenantId || "");
    if (!id) return () => {};
    let active = true;
    setState({ id, status: "loading", data: null });
    getPlatformTenantHybridInvoiceEvidence({ tenantId: id }).then(response => {
      if (!active) return;
      if (!validEvidence(response, id)) throw new Error("TENANT_FINANCE_SOURCE_UNVERIFIED");
      setState({ id, status: response.available ? "ready" : "unverified",
        data: response.available ? response.invoiceEvidence : null });
    }).catch(() => {
      if (active) setState({ id, status: "error", data: null });
    });
    return () => { active = false; };
  }, [tenantId]);
  useEffect(() => reload(), [reload]);
  const current = state.id === tenantId ? state :
    { status: "loading", data: null };
  const data = current.data;
  return <div className="tenant-control-hybrid-evidence"
    data-tenant-hybrid-finance-evidence={tenantId}
    data-tenant-hybrid-evidence-state={current.status}>
    <div className="tenant-control-hybrid-evidence-head">
      <strong>ทะเบียน Invoice ของ Firebase (อ่านอย่างเดียว)</strong>
      <small>ดูได้เฉพาะรายการที่มีรอบบิลและลายเซ็นเอกสารตรงกัน</small>
    </div>
    {current.status === "loading" ? <p role="status">กำลังตรวจดัชนีเอกสาร Firebase…</p>
      : current.status === "unverified" ?
        <p role="status">ยังไม่มีทะเบียน Hybrid Invoice ที่ตรวจดัชนีได้
          ไม่อาจสรุปว่าร้านไม่มีหนี้หรือชำระครบแล้ว</p>
      : current.status === "error" ?
        <p role="alert">ดัชนีหรือรายการ Invoice ไม่ครบหรือไม่สามารถตรวจสอบได้
          ห้ามใช้ยอดนี้อนุมัติการเงิน</p>
      : <>
        <p data-tenant-hybrid-evidence-cycle>
          รอบเอกสารที่พบ: {dateLabel(data.cycleStartDate)} – {dateLabel(data.cycleEndExclusiveDate)}
          {" · "}จำนวน {data.invoiceCount} เอกสาร
        </p>
        <p data-tenant-hybrid-recorded-amount>
          ผลรวมยอดตามเอกสารในรอบนี้: {formatBaht(data.recordedAmountCents)} บาท
          {" · "}รายการสถานะยังไม่ชำระตามทะเบียน: {formatBaht(data.recordedOpenAmountCents)} บาท
        </p>
        <div className="tenant-control-hybrid-evidence-rows">
          {data.invoices.map(item => <div key={item.id} className="tenant-control-hybrid-evidence-row">
            <strong>{labels[item.kind]}</strong>
            <small>{item.id} · {dateLabel(item.date)}</small>
            <span>{formatBaht(item.amountCents)} บาท</span>
            <small>{statusLabels[item.status]}</small>
          </div>)}
        </div>
        <p className="tenant-control-account-note" role="status">
          เฉพาะรอบที่พบใน Firebase ไม่ใช่ยอดหนี้ทุกงวด
          สถานะชำระของเอกสารไม่ใช่หลักฐานธนาคารหรือทะเบียน M7 ที่รับรองแล้ว
          ห้ามออกบิล รับเงิน ปลดระงับ หรือคืนเครดิตจากรายงานนี้
        </p>
      </>}
    {current.status === "error" || current.status === "unverified" ?
      <button type="button" className="btn btn-sm"
        onClick={() => { reload(); }} data-tenant-hybrid-evidence-refresh={tenantId}>
        <i className="bi bi-arrow-clockwise" aria-hidden="true"></i> ตรวจสอบใหม่
      </button> : null}
  </div>;
}
