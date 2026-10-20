import { useCallback, useEffect, useMemo, useState } from "react";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { auth, storage } from "@/firebase/client";
import {
  HYBRID_FINANCE_UI_READY, createHybridFinanceClient,
  hybridFinanceSlipPath,
} from "@/data/hybridFinanceStaging.mjs";

const LOCALE = {
  th: {
    owner: "ใบแจ้งหนี้และหลักฐานชำระเงิน Hybrid",
    admin: "ตรวจสอบหลักฐาน Hybrid Billing",
    disabled: "ระบบชำระเงิน Hybrid ยังไม่เปิดใช้งาน โปรดใช้รายงานประมาณการด้านบนก่อน",
    adminDisabled: "ระบบตรวจหลักฐานและปลดระงับ Hybrid ยังไม่เปิดใช้งาน",
    load: "กำลังโหลดรายการ", empty: "ไม่มีรายการ", failed: "ดำเนินการไม่สำเร็จ",
    refresh: "รีเฟรช", invoice: "ใบแจ้งหนี้", amount: "ยอดเงิน",
    due: "ครบกำหนด", status: "สถานะ", paid: "ชำระแล้ว", unpaid: "ค้างชำระ",
    choose: "เลือกใบแจ้งหนี้", slip: "หลักฐานการโอน (PNG, JPG, WEBP หรือ PDF ไม่เกิน 10 MB)",
    send: "ส่งหลักฐานเพื่อตรวจสอบ", sent: "ส่งหลักฐานแล้ว กำลังรอ Super Admin ตรวจสอบ",
    verify: "เปิดหลักฐาน", reference: "เลขอ้างอิงรายการธนาคาร",
    bank: "ฉันตรวจยอดเงินและผู้รับเงินกับรายการธนาคารจริงแล้ว",
    approve: "อนุมัติหลังตรวจธนาคาร", reject: "ปฏิเสธ", recovery: "ตรวจหนี้และปลดระงับร้าน",
    recoveryConfirm: "ฉันได้ตรวจสอบการชำระหนี้ทั้งหมดและสถานะระงับร้านด้วยตนเองแล้ว",
    success: "บันทึกผลเรียบร้อยแล้ว", pending: "รอตรวจสอบ",
    auditTitle: "ตรวจข้อมูลชำระเก่า (อ่านอย่างเดียว)",
    auditReceipts: "ตรวจรายการรับชำระ", auditMore: "หน้าถัดไป",
    auditNone: "ไม่พบข้อมูลผิดปกติในรายการที่ตรวจ", auditCount: "รายการผิดปกติ",
    adjustTitle: "ตรวจยอดที่เปลี่ยนหลังปิดวัน (ยังไม่ออกใบลดหนี้)",
    adjustCycle: "วันเริ่มรอบบิล", auditAdjust: "ตรวจยอดหลังปิดวัน",
    adjustNone: "ไม่พบวันที่ยอดเปลี่ยน", adjustWarning: "ต้องให้ผู้ดูแลตรวจใบลดหนี้/เพิ่มหนี้ด้วยตนเอง",
  },
  en: {
    owner: "Hybrid invoices and payment evidence", admin: "Hybrid Billing review queue",
    disabled: "Hybrid payments have not been released. Use the estimate report above.",
    adminDisabled: "Hybrid payment reviews and recovery are not yet released.",
    load: "Loading", empty: "No records", failed: "Operation failed",
    refresh: "Refresh", invoice: "Invoice", amount: "Amount",
    due: "Due date", status: "Status", paid: "Paid", unpaid: "Unpaid",
    choose: "Select invoice", slip: "Payment proof (PNG, JPG, WEBP or PDF, max 10 MB)",
    send: "Submit evidence for review", sent: "Evidence submitted, awaiting Super Admin",
    verify: "View proof", reference: "Verified bank transaction reference",
    bank: "I independently matched the recipient and amount to actual bank records",
    approve: "Approve after bank verification", reject: "Reject",
    recovery: "Recheck all debt and restore store access",
    recoveryConfirm: "I personally verified all settlements and any manual suspension",
    success: "Changes recorded", pending: "Pending review",
    auditTitle: "Review historical paid receipts (read-only)",
    auditReceipts: "Inspect receipts", auditMore: "Next page",
    auditNone: "No anomalies found in the inspected page", auditCount: "Exceptions",
    adjustTitle: "Inspect changes after day close (no automatic credit note)",
    adjustCycle: "Billing cycle start", auditAdjust: "Inspect closed days",
    adjustNone: "No sealed-day differences", adjustWarning: "Manual debit/credit-note review is required",
  },
};
const money = (cents, language) =>
  new Intl.NumberFormat(language === "th" ? "th-TH" : "en-US", {
    style: "currency", currency: "THB",
  }).format(Number(cents || 0) / 100);

// Source-first component shown INSIDE the existing report / Super Admin page.
// It never invokes a backend unless the finance UI release switch is enabled
// AND a separately reviewed callable invoker is injected.
export function HybridBillingFinancePanel({
  tenantId, mode = "owner", language = "th", invoke = null,
}) {
  const labels = LOCALE[language === "th" ? "th" : "en"];
  const enabled = HYBRID_FINANCE_UI_READY && typeof invoke === "function";
  const [records, setRecords] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [bankRef, setBankRef] = useState("");
  const [bankChecked, setBankChecked] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const [proof, setProof] = useState("");
  const [selectedAttempt, setSelectedAttempt] = useState("");
  const [receiptAudit, setReceiptAudit] = useState(null);
  const [adjustmentAudit, setAdjustmentAudit] = useState(null);
  const [adjustmentCycle, setAdjustmentCycle] = useState("");
  const finance = useMemo(() => createHybridFinanceClient(invoke), [invoke]);

  useEffect(() => {
    if (!enabled || !tenantId) return;
    let disposed = false;
    setLoading(true);
    setError("");
    finance({ action: mode === "admin" ? "queue" : "list", tenantId })
      .then(response => {
        if (!disposed) setRecords(Array.isArray(response.rows) ? response.rows : []);
      })
      .catch(() => { if (!disposed) setError(labels.failed); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [enabled, tenantId, mode, finance, refresh, labels.failed]);

  const run = useCallback(async (action, successMessage = labels.success) => {
    if (!enabled || busy || !tenantId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(successMessage);
      setRefresh(n => n + 1);
    } catch (err) {
      console.error("HYBRID_FINANCE_STAGING_FAILED", err);
      setError(labels.failed);
    } finally {
      setBusy(false);
    }
  }, [enabled, busy, tenantId, labels.failed, labels.success]);

  const submit = event => {
    event.preventDefault();
    if (!selectedInvoice || !file || !auth.currentUser?.uid) return;
    run(async () => {
      // Storage Rules bind metadata.uid to the authenticated Firebase identity.
      const attemptId = "slip_" + crypto.randomUUID().replaceAll("-", "");
      const slipPath = hybridFinanceSlipPath({ tenantId, attemptId, file });
      await uploadBytes(storageRef(storage, slipPath), file, {
        contentType: file.type,
        customMetadata: { uploadedByUid: auth.currentUser.uid },
      });
      await finance({ action: "submit", tenantId, attemptId,
        invoiceId: selectedInvoice, slipPath });
      setFile(null);
      setSelectedInvoice("");
    }, labels.sent);
  };
  const review = (row, decision) => run(async () => {
    if (decision === "approve" && (!bankChecked || !bankRef.trim())) {
      throw Error("BANK_CONFIRMATION_REQUIRED");
    }
    await finance({ action: "review", tenantId, attemptId: row.attemptId,
      decision, bankTxnRef: decision === "approve" ? bankRef.trim() : "",
      confirmedAmountCents: decision === "approve" ? row.amountCents : 0,
      recipientConfirmed: decision === "approve" && bankChecked });
    setBankRef("");
    setBankChecked(false);
    setProof("");
    setSelectedAttempt("");
  });
  const viewProof = async row => {
    if (!enabled) return;
    setError("");
    setProof("");
    setSelectedAttempt(row.attemptId);
    try {
      const url = await getDownloadURL(storageRef(storage, row.slipPath));
      setProof(url);
    } catch {
      setError(labels.failed);
    }
  };
  const recover = () => run(async () => {
    if (!recoveryChecked) throw Error("MANUAL_RECOVERY_CHECK_REQUIRED");
    const reviewId = "recovery_" + crypto.randomUUID().replaceAll("-", "");
    await finance({ action: "recover", tenantId, reviewId });
    setRecoveryChecked(false);
  });

  const inspectReceipts = afterId => run(async () => {
    const result = await finance({ action: "audit", tenantId, afterId });
    setReceiptAudit(previous => ({
      tenantId, nextAfterId: result.nextAfterId,
      issues: afterId && previous?.tenantId === tenantId
        ? [...previous.issues, ...(result.issues || [])] : (result.issues || []),
    }));
  });
  const inspectAdjustments = () => run(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(adjustmentCycle)) {
      throw Error("HYBRID_ADJUSTMENTS_CYCLE_REQUIRED");
    }
    const result = await finance({
      action: "adjustments", tenantId, cycleId: adjustmentCycle,
    });
    setAdjustmentAudit({ tenantId, ...result });
  });

  return (
    <section className="card hybrid-report-details" data-hybrid-finance-mode={mode}
      aria-label={mode === "admin" ? labels.admin : labels.owner}>
      <h2>{mode === "admin" ? labels.admin : labels.owner}</h2>
      {!enabled ? (
        <p className="hybrid-report-notice" role="status">
          {mode === "admin" ? labels.adminDisabled : labels.disabled}
        </p>
      ) : (
        <>
          <button className="btn btn-sm" type="button" onClick={() => setRefresh(n => n + 1)}
            disabled={busy || loading}>{labels.refresh}</button>
          {loading ? <p role="status">{labels.load}</p> : null}
          {error ? <p role="alert" className="upload-error">{error}</p> : null}
          {message ? <p role="status" className="hybrid-report-notice">{message}</p> : null}
          <div className="hybrid-report-table-scroll">
            <table>
              <thead><tr><th>{labels.invoice}</th><th>{labels.amount}</th><th>{labels.status}</th></tr></thead>
              <tbody>
                {records.map(row => (
                  <tr key={mode === "admin" ? row.attemptId : row.invoiceId}>
                    <td>{row.invoiceId}</td>
                    <td>{money(row.amountCents, language)}</td>
                    <td>{mode === "admin" ? labels.pending
                      : row.status === "paid" ? labels.paid : labels.unpaid}</td>
                  </tr>
                ))}
                {!records.length ? <tr><td colSpan="3">{labels.empty}</td></tr> : null}
              </tbody>
            </table>
          </div>
          {mode === "owner" ? (
            <form onSubmit={submit}>
              <label htmlFor="hybrid-finance-invoice">{labels.choose}</label>
              <select id="hybrid-finance-invoice" className="input" value={selectedInvoice}
                onChange={event => setSelectedInvoice(event.target.value)} disabled={busy} required>
                <option value="">{labels.choose}</option>
                {records.filter(row => row.status === "unpaid").map(row => (
                  <option key={row.invoiceId} value={row.invoiceId}>{row.invoiceId} · {money(row.amountCents, language)}</option>
                ))}
              </select>
              <label htmlFor="hybrid-finance-slip">{labels.slip}</label>
              <input id="hybrid-finance-slip" className="input" type="file" accept=".png,.jpg,.jpeg,.webp,.pdf"
                onChange={event => setFile(event.target.files?.[0] || null)} disabled={busy} required />
              <button className="btn btn-primary" type="submit"
                disabled={busy || !file || !selectedInvoice}>{labels.send}</button>
            </form>
          ) : (
            <>
              {records.map(row => (
                <div key={row.attemptId} className="card" data-hybrid-review-attempt={row.attemptId}>
                  <strong>{row.invoiceId} · {money(row.amountCents, language)}</strong>
                  <button className="btn btn-sm" type="button" onClick={() => viewProof(row)}
                    disabled={busy}>{labels.verify}</button>
                  {selectedAttempt === row.attemptId ? (
                    <>
                      {proof ? <a href={proof} target="_blank" rel="noopener noreferrer">{labels.verify}</a> : null}
                      <label htmlFor={`hybrid-bank-reference-${row.attemptId}`}>{labels.reference}</label>
                      <input id={`hybrid-bank-reference-${row.attemptId}`} className="input" type="text"
                        value={bankRef} onChange={event => setBankRef(event.target.value)} />
                      <label><input type="checkbox" checked={bankChecked}
                        onChange={event => setBankChecked(event.target.checked)} /> {labels.bank}</label>
                      <button className="btn btn-primary" type="button" disabled={busy || !proof || !bankChecked || !bankRef.trim()}
                        onClick={() => review(row, "approve")}>{labels.approve}</button>
                      <button className="btn btn-danger" type="button" disabled={busy}
                        onClick={() => review(row, "reject")}>{labels.reject}</button>
                    </>
                  ) : null}
                </div>
              ))}
              <section className="card" aria-label={labels.auditTitle}>
                <h3>{labels.auditTitle}</h3>
                <button className="btn btn-sm" type="button" disabled={busy}
                  onClick={() => inspectReceipts(null)}>{labels.auditReceipts}</button>
                {receiptAudit?.tenantId === tenantId ? (
                  <>
                    <p role="status">{labels.auditCount}: {receiptAudit.issues.length}</p>
                    {receiptAudit.issues.length ? (
                      <ul>{receiptAudit.issues.map(row => (
                        <li key={row.orderId}>{row.orderId}: {row.reason}</li>
                      ))}</ul>
                    ) : <p>{labels.auditNone}</p>}
                    {receiptAudit.nextAfterId ? (
                      <button className="btn btn-sm" type="button" disabled={busy}
                        onClick={() => inspectReceipts(receiptAudit.nextAfterId)}>
                        {labels.auditMore}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </section>
              <section className="card" aria-label={labels.adjustTitle}>
                <h3>{labels.adjustTitle}</h3>
                <label htmlFor="hybrid-finance-audit-cycle">{labels.adjustCycle}</label>
                <input className="input" id="hybrid-finance-audit-cycle" type="date"
                  value={adjustmentCycle} onChange={event => setAdjustmentCycle(event.target.value)}
                  disabled={busy} />
                <button className="btn btn-sm" type="button" disabled={busy || !adjustmentCycle}
                  onClick={inspectAdjustments}>{labels.auditAdjust}</button>
                {adjustmentAudit?.tenantId === tenantId ? (
                  adjustmentAudit.changed?.length ? (
                    <>
                      <p role="alert">{labels.adjustWarning}</p>
                      <ul>{adjustmentAudit.changed.map(row => (
                        <li key={row.day}>{row.day}: {money(row.originalBaseCents, language)}
                          {" → "}{money(row.currentBaseCents, language)}
                          {" ("}{money(row.deltaCents, language)}{")"}
                        </li>
                      ))}</ul>
                    </>
                  ) : <p role="status">{labels.adjustNone}</p>
                ) : null}
              </section>
              <label><input type="checkbox" checked={recoveryChecked}
                onChange={event => setRecoveryChecked(event.target.checked)} /> {labels.recoveryConfirm}</label>
              <button className="btn btn-sm" type="button" disabled={busy || !recoveryChecked}
                onClick={recover}>{labels.recovery}</button>
            </>
          )}
        </>
      )}
    </section>
  );
}
