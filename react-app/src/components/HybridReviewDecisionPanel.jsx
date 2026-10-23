import { useState } from "react";
import { HYBRID_PAYMENT_UI_READY, reviewHybridPayment } from "@/data/hybridPaymentActions";

function tr(th, en, thai) { return thai ? th : en; }

export function HybridReviewDecisionPanel({ tenantId, payment, thai, onReviewed }) {
  const [note, setNote] = useState("");
  const [verifiedExternally, setVerifiedExternally] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (payment.status !== "pending_review") return null;

  async function decide(action) {
    // Hard stop in UI AND on Firebase Callable. Never unlock via a client flag.
    if (!HYBRID_PAYMENT_UI_READY || busy) return;
    setBusy(true);
    setError("");
    try {
      await reviewHybridPayment({
        tenantId, invoiceId: payment.invoiceId, attemptId: payment.id,
        action, note: note.trim(), verifiedExternally,
      });
      setNote("");
      setVerifiedExternally(false);
      onReviewed?.();
    } catch (e) {
      setError(String(e?.message || "HYBRID_PAYMENT_REVIEW_FAILED"));
    } finally {
      setBusy(false);
    }
  }
  const canApprove = payment.bankVerified ||
    (verifiedExternally && note.trim().length >= 20);
  const canReject = note.trim().length >= 6;
  return (
    <div className="hybrid-review-decision">
      <label htmlFor={"hybridNote-" + payment.id}>
        {tr("หมายเหตุการตรวจสอบ", "Finance review note", thai)}
      </label>
      <textarea id={"hybridNote-" + payment.id} value={note} maxLength={2000}
        disabled={busy || !HYBRID_PAYMENT_UI_READY}
        onChange={event => setNote(event.target.value)}
        placeholder={tr("ระบุรายละเอียดที่ตรวจยืนยันจากธนาคาร หรือเหตุผลที่ปฏิเสธ",
          "Document independent bank confirmation or rejection reason", thai)}
        rows={2} />
      {!payment.bankVerified ? (
        <label className="hybrid-review-confirm">
          <input type="checkbox" checked={verifiedExternally}
            disabled={busy || !HYBRID_PAYMENT_UI_READY}
            onChange={event => setVerifiedExternally(event.target.checked)} />
          <span>{tr("ตรวจหลักฐานกับธนาคารโดยอิสระแล้ว",
            "Independently confirmed with the receiving bank", thai)}</span>
        </label>
      ) : null}
      <div className="hybrid-review-actions">
        <button className="btn btn-sm" type="button"
          disabled={!HYBRID_PAYMENT_UI_READY || busy || !canApprove}
          onClick={() => decide("approve")}>
          {tr("อนุมัติ", "Approve", thai)}
        </button>
        <button className="btn btn-sm" type="button"
          disabled={!HYBRID_PAYMENT_UI_READY || busy || !canReject}
          onClick={() => decide("reject")}>
          {tr("ปฏิเสธ", "Reject", thai)}
        </button>
      </div>
      {!HYBRID_PAYMENT_UI_READY ? (
        <small className="hybrid-review-closed">
          {tr("ยังไม่เปิดอนุมัติ: รอการทดสอบ Callable และเปิดใช้งานโดยผู้ดูแลระบบ",
            "Review is disabled pending callable UAT and an authorized release", thai)}
        </small>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
