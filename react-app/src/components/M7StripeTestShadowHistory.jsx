import {useEffect,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import "@/ui/m7-stripe-test-reservation.css";
const state={
 reserved:"จองยอด TEST เท่านั้น",
 provider_requesting:"Stripe TEST ไม่ตอบแน่ชัด · ต้องตรวจ",
 checkout_ready:"เปิด Checkout TEST · รอหลักฐาน",
 expired_test:"Stripe TEST หมดอายุ (ตรวจด้วย Webhook แล้ว) · ไม่ชำระเงิน",
 payment_failed_test:"Stripe TEST ชำระไม่สำเร็จ (ตรวจด้วย Webhook แล้ว)",
 provider_test_verified:"Stripe TEST ยืนยันใน Shadow Ledger",
 provider_test_refund_review:"พบ Refund ของ Stripe TEST · ต้องตรวจสอบ",
 provider_test_dispute_review:"พบข้อพิพาท Stripe TEST · ต้องตรวจสอบ",
 needs_review:"ข้อมูล TEST ไม่สอดคล้อง · ต้องตรวจ",
};
function amount(value){return Number.isSafeInteger(value)&&value>0?
 (value/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2})+" บาท":"ไม่สามารถยืนยันยอด";}
export function M7StripeTestShadowHistory({tenantId="",refreshVersion=0}){
 const [open,setOpen]=useState(false);
 const [phase,setPhase]=useState("loading");
 const [data,setData]=useState({items:[],hasMore:false});
 useEffect(()=>{
  let alive=true;setPhase("loading");setData({items:[],hasMore:false});
  if(!open||!tenantId)return()=>{alive=false;};
  httpsCallable(functions,"getPlatformM7StripeTestShadowHistory")({tenantId})
   .then(({data:response})=>{
    if(!alive)return;
    if(response?.ok!==true||response.mode!=="test_shadow"||
      response.operationalSettlementEnabled!==false||
      typeof response.available!=="boolean"||!Array.isArray(response.items)||
      response.items.some(row=>!state[row.status]||row.operationalSettlementEnabled!==false||
        typeof row.attemptId!=="string"||row.currency!=="THB"||
        row.providerTestAccountOnly!==true||row.status==="provider_test_verified"&&row.providerVerified!==true))
     throw Error("M7_TEST_SHADOW_HISTORY_UNCONFIRMED");
    setData({items:response.items,hasMore:response.hasMore===true});
    setPhase(response.available?"ready":"unavailable");
   }).catch(()=>{if(alive)setPhase("error");});
  return()=>{alive=false;};
 },[tenantId,open,refreshVersion]);
 if(!tenantId)return null;
 return <details className="m7-stripe-test-reservation" onToggle={e=>setOpen(e.currentTarget.open)}
  data-m7-stripe-shadow-history>
  <summary><i className="bi bi-shield-lock" aria-hidden="true"/>
   <span>Stripe M7 TEST · ประวัติ Shadow Ledger (ไม่ใช่ยอดรับเงินจริง)</span>
   <i className="bi bi-chevron-down" aria-hidden="true"/></summary>
  <section className="card m7-stripe-test-quote-card">
   <h3>ประวัติการยืนยัน Stripe TEST ของร้านที่เลือก</h3>
   <p className="m7-stripe-test-quote-warning"><i className="bi bi-shield-exclamation" aria-hidden="true"/>
    ตารางนี้ไม่ใช่การรับชำระ Invoice จริง ไม่ใช่ยอดเข้าธนาคาร และไม่เพิ่ม Service Credit หรือ Wallet
   </p>
   {phase==="loading"?<p role="status">กำลังอ่านหลักฐานจากเซิร์ฟเวอร์…</p>:
    phase==="unavailable"?<p role="status">Stripe TEST Shadow Ledger ไม่ได้เปิดในโครงการนี้</p>:
    phase==="error"?<p role="alert">ไม่สามารถตรวจสอบ Shadow Ledger ได้ กรุณารีเฟรช</p>:
    data.items.length?<div className="m7-stripe-test-shadow-scroll" role="region" tabIndex={0}
      aria-label="ทะเบียนหลักฐาน Stripe TEST เลื่อนซ้ายขวาเพื่อดูรายการ">
     <table>
      <thead><tr><th>Invoice</th><th>ยอดทดสอบ</th><th>ครั้งที่</th><th>สถานะ Stripe TEST</th><th>การชำระ Invoice จริง</th></tr></thead>
      <tbody>{data.items.map(row=><tr key={row.attemptId}>
       <td><code>{row.invoiceId}</code></td>
       <td>{amount(row.amountSatang)}</td><td>{row.attemptNo}</td>
       <td>{state[row.status]}</td><td>ไม่ได้บันทึก Paid จากส่วนนี้</td>
      </tr>)}</tbody>
     </table>
    </div>:<p role="status">ยังไม่มีรายการ Stripe TEST ของร้านนี้</p>}
   {phase==="ready"&&data.hasMore&&<p className="m7-stripe-test-quote-warning">มีมากกว่า 50 รายการล่าสุด โปรดตรวจสอบเพิ่มเติมในระบบ Audit</p>}
  </section>
 </details>;
}
