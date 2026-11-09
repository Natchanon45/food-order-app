import { useCallback, useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { functions, storage } from "@/firebase/client";
import { sweetConfirm } from "@/components/sweetDialog";

const loadTechnicalReviews = httpsCallable(functions, "listPlatformDeliveryManualReviews");
const approveTechnicalReview = httpsCallable(functions, "approveDeliveryPaymentReview");
const baht = cents => Number.isSafeInteger(cents) && cents >= 0
  ? new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2,
    maximumFractionDigits: 2 }).format(cents / 100) + " บาท" : "ไม่ยืนยันยอด";

export function TenantDeliveryManualReview({ tenantId, onReload }) {
  const [state, setState] = useState({
    tenantId: "", status: "idle", items: [], truncated: false,
  });
  const [working, setWorking] = useState("");
  const [locked, setLocked] = useState({});
  const [proofImage, setProofImage] = useState({});
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    if (!tenantId) return;
    const current = ++sequence.current;
    setState({ tenantId, status: "loading", items: [], truncated: false });
    try {
      const result = (await loadTechnicalReviews({ tenantId })).data;
      if (current !== sequence.current) return;
      if (result?.ok !== true || result.tenantId !== tenantId
        || result.source !== "server_delivery_slip_proof_and_order"
        || result.requiresSuperAdmin !== true || result.paymentAuthority !== false
        || !Array.isArray(result.items) || result.items.length > 50) {
        throw Error("SUPERADMIN_DELIVERY_REVIEW_UNVERIFIED");
      }
      setState({ tenantId, status: "ready", items: result.items,
        truncated: result.truncated === true });
    } catch {
      if (current === sequence.current) setState({
        tenantId, status: "error", items: [], truncated: false,
      });
    }
  }, [tenantId]);
  useEffect(() => {
    void reload();
    setLocked({});
    setProofImage({});
    return () => { sequence.current += 1; };
  }, [reload]);

  const openProof = async item => {
    if (!item.eligible || !item.slipPath || proofImage[item.id]?.status === "loading") return;
    setProofImage(current => ({ ...current, [item.id]: { status: "loading" } }));
    try {
      const url = await getDownloadURL(storageRef(storage, item.slipPath));
      setProofImage(current => ({ ...current, [item.id]: { status: "ready", url } }));
    } catch {
      setProofImage(current => ({ ...current, [item.id]: { status: "error" } }));
    }
  };
  const approve = async item => {
    if (!item.eligible || !item.slipPath || working || locked[item.id]
      || proofImage[item.id]?.status !== "ready") return;
    const ok = await sweetConfirm(
      "ยืนยันว่าตรวจสลิปธนาคารด้วยตนเองแล้ว และอนุมัติยอด " + baht(item.amountCents)
      + " สำหรับคำสั่งซื้อ " + item.id + " ใช่หรือไม่?",
      { title: "Super Admin ตรวจสลิปเมื่อ Slip2Go ขัดข้อง",
        confirmText: "ยืนยันหลักฐานและอนุมัติ", cancelText: "ยกเลิก",
        type: "warning" });
    if (!ok) return;
    setWorking(item.id);
    setLocked(current => ({ ...current, [item.id]: true }));
    try {
      const result = (await approveTechnicalReview({ tenantId, orderId: item.id })).data;
      if (result?.ok !== true || result.tenantId !== tenantId || result.orderId !== item.id) {
        throw Error("DELIVERY_REVIEW_RESULT_UNCONFIRMED");
      }
      await reload();
      onReload?.();
      setLocked(current => {
        const next = { ...current }; delete next[item.id]; return next;
      });
    } catch {
      // The backend transaction might have committed after the network
      // timed out. Lock this item until the operator explicitly refreshes.
      setState(current => ({ ...current, status: "uncertain" }));
    } finally {
      setWorking("");
    }
  };
  const data = state.tenantId === tenantId ? state :
    { status: "loading", items: [], truncated: false };
  return <section className="tenant-control-hybrid-evidence"
    data-superadmin-delivery-review={tenantId}>
    <div className="tenant-control-hybrid-evidence-head">
      <strong>สลิป Delivery ที่ต้องให้ Super Admin ตรวจ</strong>
      <small>เฉพาะกรณี Slip2Go ขัดข้องทางเทคนิคหลังเรียกตรวจจริง
        ไม่อนุมัติสลิปยอดไม่ตรง สลิปซ้ำ หรือหลักฐานที่ยังไม่ได้ตรวจ</small>
    </div>
    {data.status === "loading" ? <p role="status">กำลังตรวจรายการรออนุมัติ…</p> : null}
    {data.status === "error" ? <p role="alert">ยังอ่านรายการตรวจสลิปไม่ได้
      ห้ามรับรองการชำระจากข้อมูลที่ไม่ครบ</p> : null}
    {data.status === "uncertain" ? <p role="alert">
      ผลการอนุมัติยังไม่ยืนยัน กรุณารีเฟรชตรวจสถานะจริงก่อนดำเนินการอีกครั้ง
    </p> : null}
    {data.status === "ready" && data.items.length === 0
      ? <p role="status">ไม่มีรายการ Delivery ที่รอการตรวจด้วยคนในทะเบียนนี้</p> : null}
    {data.status === "ready" ? <div className="tenant-control-hybrid-evidence-rows">
      {data.items.map(item => <div key={item.id}
        className="tenant-control-hybrid-evidence-row"
        data-delivery-review-order={item.id}>
        <strong>บิล {item.id}</strong>
        <span>{baht(item.amountCents)}</span>
        <small>ผลตรวจ: {item.reason || "ยังไม่ยืนยัน"} · {item.providerCode || "ไม่มีรหัส"}</small>
        {item.eligible ? <>
          <small>ตรวจด้วยคนได้เฉพาะเหตุขัดข้องทางเทคนิค
            ไม่ใช่การยืนยันเงินเข้าบัญชีโดยระบบ</small>
          {proofImage[item.id]?.status === "ready"
            ? <a href={proofImage[item.id].url} rel="noopener noreferrer"
                target="_blank" className="btn btn-sm" data-delivery-review-slip={item.id}>
                เปิดหลักฐานสลิปเพื่อตรวจสอบ
              </a>
            : <button type="button" className="btn btn-sm"
                onClick={() => void openProof(item)}
                disabled={proofImage[item.id]?.status === "loading"}>
                {proofImage[item.id]?.status === "loading" ? "กำลังโหลดสลิป…" : "โหลดหลักฐานสลิป"}
              </button>}
          {proofImage[item.id]?.status === "error"
            ? <small role="alert">อ่านรูปสลิปไม่ได้ กรุณาตรวจสอบสิทธิ์ Storage</small> : null}
          <button type="button" className="btn btn-sm btn-primary"
            data-superadmin-delivery-approve={item.id}
            disabled={Boolean(working || locked[item.id] || proofImage[item.id]?.status !== "ready")}
            onClick={() => void approve(item)}>
            <i className="bi bi-shield-check" aria-hidden="true"></i>
            {working === item.id ? "กำลังตรวจผล…" : "ตรวจหลักฐานแล้ว อนุมัติ"}
          </button>
        </> : <small role="alert">รายการนี้ไม่มีสิทธิ์อนุมัติด้วยคน</small>}
      </div>)}
    </div> : null}
    {data.truncated ? <p role="alert">มีรายการเพิ่มเติมเกินขอบเขต 50 บิล
      กรุณาตรวจสอบข้อมูลจาก Backend</p> : null}
    <button type="button" className="btn btn-sm" data-superadmin-delivery-refresh
      disabled={Boolean(working)} onClick={() => {
        setLocked({}); setProofImage({}); void reload();
      }}><i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
      รีเฟรชรายการจาก Backend
    </button>
  </section>;
}
