import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";
import "@/ui/bankalert-stripe-wallet.css";

export const stripeWalletStatus = {
  approved: { label: "สำเร็จ", tone: "success" },
  pending: { label: "รอการชำระเงิน", tone: "waiting" },
  under_review: { label: "อยู่ระหว่างตรวจสอบ", tone: "waiting" },
  rejected: { label: "ไม่อนุมัติหลักฐาน", tone: "error" },
  created: { label: "กำลังสร้างรายการ", tone: "waiting" },
  checkout_ready: { label: "รอการชำระเงิน", tone: "waiting" },
  verified: { label: "สำเร็จ", tone: "success" },
  failed: { label: "ล้มเหลว", tone: "error" },
  canceled: { label: "ยกเลิก", tone: "error" },
  expired: { label: "หมดอายุ", tone: "expired" },
};
export const stripeWalletDate = value => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok",
  }).format(new Date(value));
};

export function BankalertStripeHistory({ items = [], title = "ประวัติการเติมเครดิตผ่าน Stripe", compact = false, focusReference = "", unified = false, renderActions }) {
  const [showAll, setShowAll] = useState(Boolean(focusReference));
  useEffect(()=>{if(focusReference)setShowAll(true);},[focusReference]);
  useEffect(()=>{
    if(!focusReference||!records.some(item=>item.referenceId===focusReference))return;
    const frame=window.requestAnimationFrame(()=>{
      const row=Array.from(document.querySelectorAll("[data-stripe-wallet-reference],[data-wallet-topup-row]"))
        .find(node=>(node.getAttribute("data-stripe-wallet-reference")||node.getAttribute("data-wallet-topup-row"))===focusReference);
      if(row){row.scrollIntoView({block:"center",behavior:"auto"});row.focus({preventScroll:true});}
    });
    return()=>window.cancelAnimationFrame(frame);
  },[focusReference,showAll,items]);
  const records = Array.isArray(items) ? items : [];
  const visible = showAll ? records : records.slice(0, compact ? 3 : 5);
  return <section className={`bankalert-stripe-history ${compact ? "is-compact" : ""}`} data-stripe-wallet-history>
    <div className="bankalert-stripe-history-heading">
      <div><strong><i className="bi bi-clock-history" aria-hidden="true" /> {title}</strong>
        <small>{unified ? "รายการเติมเครดิตทุกช่องทาง เรียงตามเวลาสร้างคำขอล่าสุด" : "รายการชำระเงิน Stripe PromptPay ตามสถานะจริงจากระบบ"}</small></div>
      <span className="bankalert-stripe-history-count">{records.length} รายการ</span>
    </div>
    {records.length ? <div className="bankalert-stripe-history-list">
      {visible.map(item => {
        const meta = stripeWalletStatus[item.status] || {label:"ไม่ทราบสถานะ",tone:"waiting"};
        const amount = Number(item.amountSatang || 0) / 100;
        return <article key={(unified?item.provider+":":"")+item.referenceId} className={`bankalert-stripe-history-item is-${meta.tone}${item.referenceId === focusReference ? " is-notification-focus" : ""}`} data-stripe-wallet-reference={item.provider==="stripe_promptpay"||!unified?item.referenceId:undefined} data-wallet-topup-row={unified&&item.provider!=="stripe_promptpay"?item.referenceId:undefined} data-topup-channel={unified?item.provider:undefined} tabIndex={item.referenceId===focusReference?-1:undefined}>
          <div className="bankalert-stripe-history-item-main">
            <strong>฿{amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            {unified&&<span className="wallet-history-channel"><i className={`bi bi-${item.provider==="stripe_promptpay"?"credit-card":item.provider==="bank_transfer"?"qr-code":"file-earmark-image"}`} aria-hidden="true"/> {item.provider==="stripe_promptpay"?"Stripe PromptPay":item.provider==="bank_transfer"?"QR พร้อมเพย์ / โอนเงิน":item.provider==="slip_transfer"?"โอนเงิน / แนบสลิป":"ไม่ระบุช่องทาง"}</span>}
            <span className={`bankalert-wallet-status-pill is-${meta.tone}`}>{meta.label}</span>
          </div>
          <div className="bankalert-stripe-history-item-meta">
            <span><i className="bi bi-calendar3" aria-hidden="true" /> {stripeWalletDate(item.createdAt)}</span>
            <code>{item.referenceId}</code>
          </div>
          {unified&&item.appealStatus&&<small className="wallet-history-detail">ส่งหลักฐานเพื่อตรวจสอบแล้ว</small>}
          {unified&&item.status==="rejected"&&item.reviewNote&&<small className="wallet-history-detail">เหตุผล: {item.reviewNote}</small>}
          {unified&&renderActions?.(item)}
        </article>;
      })}
    </div> : <p className="bankalert-stripe-history-empty">{unified?"ยังไม่มีประวัติการเติมเครดิต":"ยังไม่มีประวัติการเติมเครดิตผ่าน Stripe"}</p>}
    {records.length > (compact ? 3 : 5) ? <button className="btn btn-sm bankalert-stripe-history-more" type="button" onClick={() => setShowAll(v => !v)}>
      <i className={`bi bi-chevron-${showAll ? "up" : "down"}`} aria-hidden="true" />
      {showAll ? "ย่อรายการ" : `ดูทั้งหมด (${records.length})`}
    </button> : null}
  </section>;
}

// PENGUIN Stripe TEST has an independent, nonredeemable ledger. Do not
// combine its rows or sandbox balance into canonical Lalamove Wallet history.
export function PlatformStripeWalletSandboxHistory({tenantId}){
 const [state,setState]=useState(null),[revision,setRevision]=useState(0),[error,setError]=useState(false);
 useEffect(()=>{
  let current=true;
  setError(false);setState(null);
  httpsCallable(functions,"getPlatformStripeWalletSandboxHistory")({tenantId}).then(({data})=>{
   if(!current)return;
   if(data?.ok!==true||data.mode!=="test"||!Array.isArray(data.items)||typeof data.available!=="boolean")throw Error("SANDBOX_HISTORY_UNCONFIRMED");
   setState(data);
  }).catch(()=>{if(current)setError(true);});
  return()=>{current=false;};
 },[tenantId,revision]);
 if(state?.available===false)return null;
 return <div>
  <div className="bankalert-wallet-amount-summary"><span>เครดิต Sandbox (ไม่ใช่เครดิตจัดส่งจริง)</span><strong>{Number.isSafeInteger(state?.balanceSatang)?(state.balanceSatang/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"} บาท</strong></div>
  {state?<BankalertStripeHistory items={state.items} compact/>:<p role={error?"alert":"status"}>{error?"ไม่สามารถอ่านประวัติ Stripe Sandbox ได้":"กำลังอ่านประวัติ Stripe Sandbox…"}</p>}
  <button type="button" className="btn btn-sm" disabled={!state&&!error} onClick={()=>setRevision(v=>v+1)}><i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรชเครดิต Sandbox</button>
 </div>;
}
