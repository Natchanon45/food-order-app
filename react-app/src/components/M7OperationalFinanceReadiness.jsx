import {useEffect,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import "@/ui/m7-stripe-test-reservation.css";

const GAP_LABELS={
 SOURCE_M7_IMMUTABLE_INVOICE_JOURNAL_NOT_MIGRATED:"ยังไม่ได้ย้ายทะเบียน Invoice ที่มีหลักฐานต้นฉบับและลายเซ็นครบ",
 SOURCE_M7_BANK_JOURNAL_NOT_MIGRATED:"ยังไม่ได้ยืนยันทะเบียนรับเงินจริงจากธนาคารและใบเสร็จ",
 SOURCE_M7_CREDIT_ACCOUNT_EVENTS_NOT_MIGRATED:"ยังไม่ได้ย้ายบัญชี Service Credit และเหตุการณ์หักเครดิตครบชุด",
 SOURCE_M7_SIGNED_HOLD_APPROVAL_NOT_MIGRATED:"ยังไม่มีหลักฐานอนุมัติระงับ/คืนสิทธิ์ร้านค้าตามกติกา Source",
 SOURCE_M7_CLOSED_SALES_THRESHOLD_NOT_CERTIFIED:"ยังไม่ยืนยันยอด Delivery รอบปิดบัญชีและเพดานตามหลักฐาน Source",
 FIREBASE_INVOICE_IMMUTABLE_FIELDS_INVALID:"Invoice Firebase ข้อมูลต้นฉบับหรือยอดไม่ตรงรูปแบบ",
 FIREBASE_PAYMENT_REVIEW_NOT_BANK_STATEMENT:"มีหลักฐานตรวจสลิปใน Firebase แต่ยังไม่ใช่หลักฐานธนาคารอิสระ",
 FIREBASE_PAID_WITHOUT_REVIEW_EVIDENCE:"พบสถานะ Paid แต่หลักฐานผู้ตรวจหรือ Invoice ไม่ครบ",
 FIREBASE_PAYMENT_ATTEMPT_HISTORY_REQUIRES_REVIEW:"มีประวัติคำขอชำระหลายรายการ ต้องตรวจธุรกรรมซ้ำ",
 FIREBASE_PENDING_PAYMENT_UNSETTLED:"มีสลิปรอตรวจ ไม่ใช่ยอดที่รับชำระแล้ว",
 FIREBASE_ADJUSTMENT_CROSSCHECK_REQUIRED:"มีการปรับปรุงยอดที่ต้องกระทบยอดกับ Invoice",
 STRIPE_TEST_SHADOW_NOT_OPERATIONAL_BANK_CASH:"มี Stripe TEST Shadow Ledger ซึ่งไม่ใช่เงินรับจริง",
 FIRESTORE_FINANCE_READ_INCOMPLETE:"ยังอ่านประวัติไม่ครบทุกเอกสาร ต้องตรวจเพิ่มเติม",
 SEPARATE_TENANT_HOLD_BLOCKS_AUTOMATIC_RELEASE:"มีเงื่อนไขระงับร้านค้าประเภทอื่น ต้องตรวจแยก",
 LEGACY_SUSPENSION_REQUIRES_INDEPENDENT_REVIEW:"ร้านค้าถูกระงับอยู่ ไม่ปลดระงับจากรายงานนี้",
 FIREBASE_CREDIT_FIELDS_WITHOUT_SOURCE_JOURNAL:"พบยอดเครดิตใน Firebase ที่ไม่มีทะเบียน Source ยืนยัน",
};
const amount=cents=>Number.isSafeInteger(cents)&&cents>=0
  ?(cents/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2})+" บาท"
  :"ยังไม่ยืนยัน";

export function M7OperationalFinanceReadiness({tenantId="",refreshVersion=0}){
 const [open,setOpen]=useState(false);
 const [phase,setPhase]=useState("idle");
 const [data,setData]=useState(null);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let alive=true;
  setData(null);
  if(!open||!tenantId)return()=>{alive=false;};
  setPhase("loading");
  httpsCallable(functions,"getPlatformM7OperationalFinanceReadiness")({tenantId})
   .then(({data:result})=>{
    if(!alive)return;
    if(result?.ok!==true||result.mode!=="m7_source_finance_gap_read_only"||
     result.tenantId!==tenantId||result.authenticated!==true||
     result.superadminOnly!==true||result.writesPerformed!==false||
     result.canPostOperationalInvoicePaid!==false||
     result.canApplyServiceCredit!==false||result.canReleaseTenant!==false||
     result.bankStatementSourceAuthenticated!==false||
     result.sourceCreditLedgerMigrated!==false||
     result.sourceSignedHoldApprovalsMigrated!==false||
     result.stripeTestShadowIsBankCash!==false||
     !Array.isArray(result.invoices)||result.invoices.length>30||
     result.invoices.some(item=>typeof item.invoiceId!=="string"||
      item.sourceOperationalPaid!==false||
      item.sourceBankVerifiedCents!==null||
      item.sourceCreditBalanceCents!==null||
      item.remainingBankCashDueCents!==null||
      item.tenantAccessReleaseAllowed!==false||
      item.creditPostingAllowed!==false||
      !Array.isArray(item.blockerCodes)||item.blockerCodes.some(x=>!Object.hasOwn(GAP_LABELS,x))))
     throw Error("M7_OPERATIONAL_READINESS_UNCONFIRMED");
    setData(result);setPhase("ready");
   }).catch(()=>{if(alive){setData(null);setPhase("unavailable");}});
  return()=>{alive=false;};
 },[open,tenantId,refreshVersion,revision]);
 if(!tenantId)return null;
 return <details className="m7-stripe-test-reservation m7-operational-gap"
  onToggle={event=>setOpen(event.currentTarget.open)}
  data-m7-operational-finance-gap>
  <summary><i className="bi bi-journal-check" aria-hidden="true"/>
   <span>M7 Finance · ตรวจความพร้อมบัญชี Source/Firebase</span>
   <i className="bi bi-chevron-down" aria-hidden="true"/></summary>
  <section className="card m7-stripe-test-quote-card">
   <header><div><h3>ตรวจความพร้อมการกระทบยอด M7</h3>
    <p>รายงานสำหรับ Superadmin เท่านั้น · ข้อมูลยังไม่ใช่การบันทึก Paid หรือ Service Credit จากธนาคาร</p></div>
    <button type="button" className="btn btn-sm" disabled={phase==="loading"}
     onClick={()=>setRevision(n=>n+1)}><i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรช</button>
   </header>
   <div className="m7-stripe-test-quote-warning" role="status">
    <i className="bi bi-shield-exclamation" aria-hidden="true"/>
    รายงานนี้ใช้ตรวจช่องว่างของบัญชีเท่านั้น ไม่อนุญาตรับเงินจริง หัก Service Credit หรือปลดระงับร้านค้า
   </div>
   {phase==="loading"&&<p role="status">กำลังตรวจเอกสารใน Firebase…</p>}
   {phase==="unavailable"&&<p role="status">รายงานนี้เปิดได้เฉพาะโครงการทดสอบ M7 ที่ได้รับสิทธิ์เท่านั้น</p>}
   {phase==="ready"&&data&&<>
    {data.partialHistory&&<p role="alert" className="m7-stripe-test-inspection">
     <i className="bi bi-exclamation-triangle" aria-hidden="true"/>
     ประวัติมีจำนวนมากกว่าขอบเขตการอ่านครั้งนี้ ยังสรุปความครบถ้วนไม่ได้
    </p>}
    <div className="m7-operational-gap-summary">
     <div><small>Invoice ที่ตรวจ</small><strong>{data.invoiceCount} รายการ</strong></div>
     <div><small>ยืนยันเงินธนาคารจาก Source</small><strong>ยังไม่ได้</strong></div>
     <div><small>Service Credit ที่พร้อมบันทึก</small><strong>ยังไม่ได้</strong></div>
     <div><small>ปลดระงับร้านค้าจากรายงานนี้</small><strong>ไม่ได้</strong></div>
    </div>
    {data.invoices.length?<div className="m7-operational-gap-list">
     {data.invoices.map(item=><article key={item.invoiceId} className="m7-operational-gap-item">
      <strong>{item.kind==="monthly"?"ค่าบริการรายเดือน":
       item.kind==="delivery_daily"?"ส่วนแบ่ง Delivery":"ต้องตรวจประเภท Invoice"}</strong>
      <small>Invoice: <code>{item.invoiceId}</code></small>
      <small>ยอด Invoice Firebase: {amount(item.grossCentsFromFirebase)}</small>
      <small>ยอดเอกสารที่ Superadmin ตรวจใน Firebase: {amount(item.firebaseRecordedOnlyCents)} (ยังไม่ใช่ยอดธนาคาร)</small>
      <small>เงินธนาคารตามบัญชี Source: ยังไม่ยืนยัน · เครดิตพร้อมใช้: ยังไม่ยืนยัน</small>
      <ul>{item.blockerCodes.map(code=><li key={code}>{GAP_LABELS[code]}</li>)}</ul>
     </article>)}
    </div>:<p role="status">ยังไม่มี Invoice ให้ตรวจในร้านที่เลือก</p>}
   </>}
  </section>
 </details>;
}
