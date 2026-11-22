import {useEffect,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import {sweetConfirm} from "@/components/sweetDialog";
import "@/ui/m7-stripe-test-reservation.css";
const state={
 reserved:"จองยอด TEST เท่านั้น",
 provider_requesting:"Stripe TEST ไม่ตอบแน่ชัด · ต้องตรวจ",
 checkout_ready:"เปิด Checkout TEST · รอหลักฐาน",
 expired_test:"Stripe TEST หมดอายุ (ตรวจด้วย Webhook แล้ว) · ไม่ชำระเงิน",
 payment_failed_test:"Stripe TEST ชำระไม่สำเร็จ (ตรวจด้วย Webhook แล้ว)",
 closed_expired_test:"Superadmin ปิด TEST Session หมดอายุแล้ว · อนุญาตจองยอดทดสอบใหม่",
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
 const [reviews,setReviews]=useState({});
 const [closures,setClosures]=useState({});
 const [busy,setBusy]=useState("");
 const [message,setMessage]=useState("");
 const [localRevision,setLocalRevision]=useState(0);
 useEffect(()=>{
  let alive=true;setPhase("loading");setData({items:[],hasMore:false});
  setReviews({});setClosures({});
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
 },[tenantId,open,refreshVersion,localRevision]);
 const messages={
  single_open:"พบ Stripe TEST Session เดิม 1 รายการ เปิดอยู่และยังไม่ชำระ · สามารถยืนยันผูก Session เดิมได้",
  already_paid_wait_webhook:"พบ Session ที่ Stripe TEST รายงาน Paid · ต้องรอ Signed Webhook ห้ามสร้างใหม่",
  already_expired:"พบ Session หมดอายุ · ยังไม่เปิดให้จองยอดใหม่",
  already_failed:"พบ Session ไม่สำเร็จ · ยังไม่เปิดให้จองยอดใหม่",
  not_found_uncertain:"ค้นไม่พบในช่วงที่ตรวจ · ยังยืนยันไม่ได้ว่า Stripe ไม่ได้สร้าง Session",
  ambiguous:"พบ Session ที่ผูก Attempt เดียวกันมากกว่าหนึ่งรายการ · ต้องตรวจสอบกับ Stripe",
  mismatch:"ข้อมูล Session ไม่ตรงกับ Invoice หรือ Amount · ให้ตรวจสอบ",
  scan_incomplete:"ยังตรวจ Stripe ได้ไม่ครบทุกหน้า / หมดระยะค้นหา · ห้ามสร้างใหม่",
  requires_review:"ไม่สามารถยืนยันหลักฐาน TEST ได้ · ให้ตรวจสอบ",
 };
 const closureMessages={
  can_review_closure:"Stripe TEST ยืนยันว่าหมดอายุ ไม่มี PaymentIntent และพ้นช่วงรอตรวจ · อนุมัติปิดได้โดยไม่สร้าง Checkout",
  cooldown:"ยังไม่พ้นช่วงรอตรวจ · ต้องรอการยืนยันจากผู้ให้บริการ",
  no_single_match:"พบข้อมูล Session ไม่ตรงหรือไม่ครบ · ยังอนุมัติปิดไม่ได้",
  provider_changed:"Stripe TEST เปลี่ยนสถานะหรือข้อมูลไม่ตรง · ต้องตรวจสอบ",
  scan_incomplete:"ค้น Session ยังไม่ครบ · ยังอนุมัติปิดไม่ได้",
  requires_review:"หลักฐานปิด Session ไม่ครบ · ต้องตรวจสอบ",
 };
 const inspectClosure=async row=>{
  if(busy||row.status!=="expired_test")return;
  setBusy(row.attemptId);setMessage("");
  const params={tenantId,invoiceId:row.invoiceId,attemptId:row.attemptId};
  try{
   const {data:result}=await httpsCallable(functions,"reviewPlatformM7StripeTestClosure")(params);
   if(result?.ok!==true||result.mode!=="test"||
     result.tenantId!==tenantId||result.invoiceId!==row.invoiceId||
     result.attemptId!==row.attemptId||result.amountSatang!==row.amountSatang||
     result.readOnly!==true||result.operationalInvoicePaid!==false||
     result.canCreateNewCheckout!==false||result.serviceCreditChanged!==false||
     result.providerClosureVerified!==false||
     !Object.hasOwn(closureMessages,result.status)||
     result.eligibleForOperatorApproval!==(result.status==="can_review_closure"))
     throw Error("M7_TEST_CLOSURE_REVIEW_UNCONFIRMED");
   setClosures(prev=>({...prev,[row.attemptId]:result.status}));
   setMessage(closureMessages[result.status]);
  }catch{
   setClosures(prev=>({...prev,[row.attemptId]:"requires_review"}));
   setMessage("ไม่สามารถยืนยันการปิด Stripe TEST Session ได้ · ห้ามเปิดรายการใหม่");
  }finally{setBusy("");}
 };
 const approveClosure=async row=>{
  if(busy||row.status!=="expired_test"||
    closures[row.attemptId]!=="can_review_closure")return;
  const confirmed=await sweetConfirm(
   "ยืนยันปิดเฉพาะ Stripe TEST Session ที่ Stripe ยืนยันว่าหมดอายุ ไม่มี PaymentIntent และพ้นช่วงรอตรวจเท่านั้น ระบบจะตรวจทุกหลักฐานอีกครั้ง และอนุญาตให้เจ้าของร้านกดจองยอด TEST ใหม่เอง ไม่สร้าง Checkout อัตโนมัติ ไม่เปลี่ยน Invoice เป็น Paid หรือ Service Credit",
   {title:"M7 Stripe TEST · อนุมัติปิด Session หมดอายุ",confirmText:"อนุมัติปิด TEST Session",cancelText:"ยกเลิก",type:"warning"});
  if(!confirmed)return;
  setBusy(row.attemptId);setMessage("");
  try{
   const {data:result}=await httpsCallable(functions,"approvePlatformM7StripeTestClosure")({
    tenantId,invoiceId:row.invoiceId,attemptId:row.attemptId});
   if(result?.ok!==true||result.mode!=="test"||
     result.tenantId!==tenantId||result.invoiceId!==row.invoiceId||
     result.attemptId!==row.attemptId||
     result.status!=="reviewed_expired_no_intent"||
     result.newQuotePermitted!==true||
     result.newCheckoutCreated!==false||
     result.operationalInvoicePaid!==false||
     result.serviceCreditChanged!==false)
     throw Error("M7_TEST_CLOSURE_APPROVAL_UNCONFIRMED");
   setMessage("บันทึก Closure Audit แล้ว · เจ้าของร้านสามารถจองยอด TEST ใหม่เองได้ Invoice จริงยังไม่เป็น Paid");
   setLocalRevision(n=>n+1);
  }catch{
   setMessage("ไม่สามารถอนุมัติปิด Session ได้ กรุณาตรวจสอบกับ Stripe ใหม่ก่อนดำเนินการ");
  }finally{setBusy("");}
 };
 const inspectRecovery=async row=>{
  if(busy||row.status!=="provider_requesting")return;
  setBusy(row.attemptId);setMessage("");
  const data={tenantId,invoiceId:row.invoiceId,attemptId:row.attemptId};
  try{
   const {data:result}=await httpsCallable(functions,"reviewPlatformM7StripeTestRecovery")(data);
   if(result?.ok!==true||result.mode!=="test"||result.readOnly!==true||
      result.tenantId!==tenantId||result.invoiceId!==row.invoiceId||
      result.attemptId!==row.attemptId||result.amountSatang!==row.amountSatang||
      result.canCreateNewCheckout!==false||result.canSettleInvoice!==false||
      result.checkoutCreatedByThisReview!==false||
      !Object.hasOwn(messages,result.status)||
      typeof result.sessionId!=="string"||
      (result.status==="single_open"&&
       (!/^cs_test_[A-Za-z0-9_]{8,240}$/.test(result.sessionId)||
        result.matchedSingleOpen!==true)))
    throw Error("M7_TEST_RECOVERY_REVIEW_UNCONFIRMED");
   setReviews(prev=>({...prev,[row.attemptId]:{
    status:result.status,sessionId:result.sessionId}}));
   setMessage(messages[result.status]);
  }catch{
   setReviews(prev=>({...prev,[row.attemptId]:{status:"requires_review",sessionId:""}}));
   setMessage("ไม่สามารถตรวจสอบ Stripe TEST Session เดิมได้ ห้ามจองยอดใหม่");
  }finally{setBusy("");}
 };
 const bindRecovery=async row=>{
  const proof=reviews[row.attemptId];
  if(busy||row.status!=="provider_requesting"||proof?.status!=="single_open"||
    !/^cs_test_[A-Za-z0-9_]{8,240}$/.test(proof.sessionId||""))return;
  const agreed=await sweetConfirm(
   "ยืนยันผูก Stripe TEST Session เดิมกับรายการจองที่เลือกเท่านั้น ระบบจะอ่านและตรวจ Stripe อีกครั้งก่อนบันทึก Audit โดยจะไม่สร้าง Session ใหม่ ไม่เปลี่ยน Invoice เป็น Paid และไม่เพิ่ม Service Credit",
   {title:"M7 Stripe TEST · ยืนยันการกู้คืน",confirmText:"ผูก Session เดิม (TEST)",cancelText:"ยกเลิก",type:"warning"});
  if(!agreed)return;
  setBusy(row.attemptId);setMessage("");
  try{
   const {data:result}=await httpsCallable(functions,"bindPlatformM7StripeTestRecovery")({
    tenantId,invoiceId:row.invoiceId,attemptId:row.attemptId,sessionId:proof.sessionId});
   if(result?.ok!==true||result.status!=="checkout_ready"||
      result.invoiceId!==row.invoiceId||result.attemptId!==row.attemptId||
      result.existingSessionReattached!==true||result.createdStripeSession!==false||
      result.canCreateNewCheckout!==false||
      result.operationalInvoicePaid!==false||result.serviceCreditChanged!==false)
    throw Error("M7_TEST_RECOVERY_BIND_UNCONFIRMED");
   setMessage("ผูก Session เดิมของ Stripe TEST สำเร็จแล้ว · Audit บันทึกแล้ว · Invoice จริงยังไม่ Paid");
   setLocalRevision(n=>n+1);
  }catch{setMessage("ไม่สามารถยืนยันการผูก Session ได้ กรุณาตรวจข้อมูลใหม่ ห้ามสร้าง Checkout เพิ่ม");}
  finally{setBusy("");}
 };
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
   {message&&<p className="m7-stripe-test-inspection" role="status"><i className="bi bi-info-circle" aria-hidden="true"/> {message}</p>}
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
       <td>{state[row.status]}
        {row.status==="expired_test"&&<div className="m7-stripe-test-recovery-actions">
         <button type="button" className="btn btn-sm" disabled={!!busy}
          onClick={()=>inspectClosure(row)}><i className="bi bi-shield-check" aria-hidden="true"/>
          {busy===row.attemptId?"กำลังตรวจ Stripe TEST…":"ตรวจปิด Session หมดอายุ"}
         </button>
         {closures[row.attemptId]&&<small role="status" className="m7-stripe-test-recovery-note">
          {closureMessages[closures[row.attemptId]]}
         </small>}
         {closures[row.attemptId]==="can_review_closure"&&
          <button type="button" className="btn btn-sm" disabled={!!busy}
           onClick={()=>approveClosure(row)}>
           <i className="bi bi-check-circle" aria-hidden="true"/> อนุมัติปิด TEST Session
          </button>}
        </div>}
        {row.status==="provider_requesting"&&<div className="m7-stripe-test-recovery-actions">
         <button type="button" className="btn btn-sm" disabled={!!busy}
          onClick={()=>inspectRecovery(row)}><i className="bi bi-search" aria-hidden="true"/>
          {busy===row.attemptId?"กำลังตรวจ Stripe TEST…":"ตรวจ Session เดิม"}
         </button>
         {reviews[row.attemptId]&&<small role="status" className="m7-stripe-test-recovery-note">
          {messages[reviews[row.attemptId].status]}
         </small>}
         {reviews[row.attemptId]?.status==="single_open"&&
          <button type="button" className="btn btn-sm" disabled={!!busy}
           onClick={()=>bindRecovery(row)}><i className="bi bi-link-45deg" aria-hidden="true"/>
           ผูก Session เดิม (TEST)
          </button>}
        </div>}
       </td><td>ไม่ได้บันทึก Paid จากส่วนนี้</td>
      </tr>)}</tbody>
     </table>
    </div>:<p role="status">ยังไม่มีรายการ Stripe TEST ของร้านนี้</p>}
   {phase==="ready"&&data.hasMore&&<p className="m7-stripe-test-quote-warning">มีมากกว่า 50 รายการล่าสุด โปรดตรวจสอบเพิ่มเติมในระบบ Audit</p>}
  </section>
 </details>;
}
