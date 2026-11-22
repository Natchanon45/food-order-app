import {useEffect,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import {sweetConfirm} from "@/components/sweetDialog";
import "@/ui/m7-stripe-test-reservation.css";

const MODE="m7_uat_untrusted_financial_shadow_v1";
const SATANG_LIMIT=Number.MAX_SAFE_INTEGER;
const money=value=>Number.isSafeInteger(value)&&value>=0&&value<=SATANG_LIMIT?
  (value/100).toLocaleString("th-TH",{
   minimumFractionDigits:2,maximumFractionDigits:2})+" บาท":"ยังไม่ยืนยัน";
const valid=(r,tenantId,digest)=>r?.ok===true&&r.mode===MODE&&
 r.tenantId===tenantId&&r.sourceManifestDigest===digest&&
 r.financialShadowOnly===true&&r.sourceIdentityNotAttested===true&&
 r.bankStatementSourceAuthenticated===false&&
 r.bankCashOperationallyVerified===false&&
 r.serviceCreditOperationallyAvailable===false&&
 r.billingInvoicesMutated===false&&r.tenantAccessMutated===false&&
 r.testStripeShadowCountedAsBankCash===false&&
 r.payoutOrRefundPerformed===false&&r.financialPostingAuthorized===false&&
 r.operationalReleaseAuthorized===false&&r.preflightRequired===true&&
 r.bankAndSourceEvidenceStillUnverified===true&&
 Number.isSafeInteger(r.invoiceCount)&&r.invoiceCount>=0&&r.invoiceCount<=60&&
 Number.isSafeInteger(r.sourceGrossCents)&&
 Number.isSafeInteger(r.sourceBankReportedCents)&&
 Number.isSafeInteger(r.sourceCreditAppliedCents)&&
 Number.isSafeInteger(r.sourceCreditAccountReportedCents)&&
 Number.isSafeInteger(r.sourceUnpaidForReviewCents)&&
 r.holdCandidateSummary?.tenantAccessReleaseAllowed===false&&
 r.holdCandidateSummary?.tenantOrderGateModified===false&&
 r.holdCandidateSummary?.originalSourceHmacVerified===false&&
 r.unverifiedDoubleEntryJournal?.balancedProjectionOnly===true&&
 r.unverifiedDoubleEntryJournal?.operationalPostingAllowed===false&&
 r.unverifiedDoubleEntryJournal?.sourceBankAuthenticated===false&&
 r.unverifiedDoubleEntryJournal?.totalDebitCents===r.sourceGrossCents&&
 r.unverifiedDoubleEntryJournal?.totalCreditCents===r.sourceGrossCents&&
 Array.isArray(r.financialItems)&&r.financialItems.length===r.invoiceCount&&
 r.financialItems.every(i=>
  /^[a-f0-9]{64}$/.test(i.id||"")&&i.operationalInvoicePaid===false&&
  i.bankMoneyAuthenticated===false&&i.releaseAuthorized===false);
export function M7UatFinancialShadow({
 tenantId="",manifest=null,sourceManifestDigest="",preflightStaged=false,
}){
 const [report,setReport]=useState(null);
 const [history,setHistory]=useState([]);
 const [phase,setPhase]=useState("idle");
 const [message,setMessage]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  setReport(null);setPhase("idle");setMessage("");
 },[tenantId,sourceManifestDigest,preflightStaged]);
 useEffect(()=>{
  let alive=true;
  if(!preflightStaged||!tenantId)return()=>{alive=false;};
  httpsCallable(functions,"getPlatformM7UatFinancialShadowHistory")({tenantId})
   .then(({data})=>{
    if(!alive)return;
    if(data?.ok!==true||data.mode!=="m7_uat_financial_shadow_history"||
       data.tenantId!==tenantId||data.financialPostingAuthorized!==false||
       data.tenantAccessReleaseAllowed!==false||
       !Array.isArray(data.items)||data.items.length>20||
       data.items.some(i=>!(/^[a-f0-9]{64}$/.test(i.sourceManifestDigest||""))||
        !["untrusted_shadow_only","needs_review"].includes(i.status)))
     throw Error("M7_UAT_HISTORY_NOT_TRUSTED");
    setHistory(data.items);
   }).catch(()=>{if(alive)setHistory([]);});
  return()=>{alive=false;};
 },[preflightStaged,tenantId,refresh]);
 const preview=async()=>{
  if(!preflightStaged||!manifest||phase==="loading")return;
  setMessage("");setReport(null);setPhase("loading");
  try{
   const {data}=await httpsCallable(functions,
    "previewPlatformM7UatFinancialShadow")({manifest});
   if(!valid(data,tenantId,sourceManifestDigest)||
      data.preflightStagedAndConsistent!==true||data.recordAllowed!==true||
      data.recorded!==false)
    throw Error("UAT_SHADOW_UNTRUSTED_RESPONSE");
   setReport(data);setPhase("ready");
   setMessage("คำนวณบัญชีจำลองเสร็จแล้ว ผลนี้ยังไม่ใช่หลักฐานการรับเงินหรือเครดิตจริง");
  }catch{
   setPhase("unavailable");
   setMessage("ไม่สามารถจำลองบัญชีได้ ต้องมี Preflight Audit ที่ตรงกับ Source และสิทธิ์ UAT Superadmin");
  }
 };
 const record=async()=>{
  if(phase!=="ready"||!report||!manifest||
     !preflightStaged||report.financialPostingAuthorized!==false)return;
  const confirm=await sweetConfirm(
   "ขั้นตอนนี้บันทึกเฉพาะบัญชีจำลองที่ไม่ผ่านการรับรองแหล่งเงินใน UAT และ Global Claim จำลอง ไม่เปลี่ยน Invoice Paid ไม่หัก Service Credit จริง ไม่จ่ายคืนเงิน และไม่ปลดระงับร้านค้า",
   {title:"M7 Finance · ยืนยันบันทึก UAT Shadow Ledger",
    confirmText:"บันทึกบัญชีจำลอง UAT",cancelText:"ยกเลิก",type:"warning"});
  if(!confirm)return;
  setPhase("loading");setMessage("");
  try{
   const {data}=await httpsCallable(functions,
    "stagePlatformM7UatFinancialShadow")({manifest});
   if(data?.ok!==true||data.mode!==MODE||data.tenantId!==tenantId||
    data.sourceManifestDigest!==sourceManifestDigest||
    data.financialShadowOnly!==true||data.recorded!==true||
    data.financialPostingAuthorized!==false||
    data.operationalReleaseAuthorized!==false||
    data.billingInvoicesMutated!==false||
    data.tenantAccessMutated!==false)
    throw Error("UAT_SHADOW_STAGE_NOT_TRUSTED");
   setMessage(data.reused?"บัญชีจำลองชุดนี้บันทึกไว้แล้ว ระบบไม่ลงยอดซ้ำ":
    "บันทึก UAT Financial Shadow Ledger แล้ว · ไม่ได้ลงบัญชีเงินจริงหรือเปลี่ยนสิทธิ์ร้านค้า");
   setPhase("ready");setRefresh(n=>n+1);
  }catch{
   setMessage("ไม่สามารถบันทึกบัญชีจำลอง UAT ได้ อาจมี Invoice/Bank Reference ซ้ำข้ามร้าน หรือหลักฐาน Preflight เปลี่ยนแปลง");
   setPhase("ready");
  }
 };
 if(!tenantId||!manifest||!sourceManifestDigest)return null;
 return <section className="m7-source-migration-report m7-uat-financial-shadow"
  data-m7-uat-financial-shadow>
  <h4>M7 Financial Ledger · จำลองทั้งบัญชีใน UAT</h4>
  <div className="m7-stripe-test-quote-warning" role="status">
   <i className="bi bi-exclamation-triangle" aria-hidden="true"/>
   ยอดจาก Source เป็นข้อมูลที่ส่งออกมาและยังไม่ยืนยันกับธนาคาร/ลายเซ็นต้นฉบับ
   ไม่ใช่ยอดชำระจริงหรือเครดิตที่นำไปใช้ได้
  </div>
  {!preflightStaged&&<small>กรุณาบันทึก Source Preflight Audit ก่อนจำลองบัญชี</small>}
  <div className="m7-source-migration-actions">
   <button type="button" className="btn btn-sm" onClick={preview}
    disabled={!preflightStaged||phase==="loading"}>
    <i className="bi bi-calculator" aria-hidden="true"/>
    ตรวจบัญชีจำลองทั้งหมด (Read-only)
   </button>
   <button type="button" className="btn btn-sm" onClick={record}
    disabled={!preflightStaged||phase!=="ready"||!report}>
    <i className="bi bi-journal-check" aria-hidden="true"/>
    บันทึก UAT Financial Shadow Ledger
   </button>
  </div>
  {message&&<p role="status" className="m7-stripe-test-inspection">
   <i className="bi bi-info-circle" aria-hidden="true"/> {message}
  </p>}
  {report&&<section className="m7-uat-financial-summary">
   <div className="m7-operational-gap-summary">
    <div><small>ยอดตั้งหนี้จาก Export (ไม่รับรอง)</small>
     <strong>{money(report.sourceGrossCents)}</strong></div>
    <div><small>เครดิตที่ใช้จาก Export (ไม่รับรอง)</small>
     <strong>{money(report.sourceCreditAppliedCents)}</strong></div>
    <div><small>เงินธนาคารตาม Export (ยังไม่ยืนยัน)</small>
     <strong>{money(report.sourceBankReportedCents)}</strong></div>
    <div><small>หนี้คงเหลือตาม Export (รอตรวจ)</small>
     <strong>{money(report.sourceUnpaidForReviewCents)}</strong></div>
    <div><small>Service Credit ยกยอดจาก Export</small>
     <strong>{money(report.sourceCreditAccountReportedCents)}</strong></div>
    <div><small>Hold อาจถึงกำหนดตามข้อมูลส่งออก</small>
     <strong>{report.holdCandidateSummary.overdueCandidateCount} รายการ</strong></div>
   </div>
   <p role="status" className="m7-stripe-test-inspection">
    <i className="bi bi-shield-exclamation" aria-hidden="true"/>
    ไม่ได้ตรวจลายเซ็น Hold จาก Source และไม่ปลดระงับร้าน แม้ Source ระบุว่าชำระครบ
   </p>
   <small>รายการในบัญชีจำลอง {report.invoiceCount} Invoice ·
    Bank Reference Claims {report.sourceBankReferenceCount} รายการ
    · Journal แยกบัญชีจำลอง {report.unverifiedDoubleEntryJournal.legCount} ขา
    · Debit = Credit {money(report.unverifiedDoubleEntryJournal.totalDebitCents)}
    (ยังไม่รับรองแหล่งเงิน)</small>
  </section>}
  {history.length>0&&<section className="m7-source-migration-history">
   <h4>ประวัติบัญชีจำลองใน UAT</h4>
   {history.map(item=><div key={item.sourceManifestDigest}>
    <code>{item.sourceManifestDigest.slice(0,16)}…</code>
    <small>{item.status==="needs_review"?
     "Audit ไม่ถูกต้อง ต้องตรวจสอบ":
     "ยังไม่รับรองเงินธนาคารหรือ Service Credit"}</small>
   </div>)}
  </section>}
 </section>;
}
