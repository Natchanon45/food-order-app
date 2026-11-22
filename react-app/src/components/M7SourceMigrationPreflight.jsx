import {useEffect,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import {sweetConfirm} from "@/components/sweetDialog";
import "@/ui/m7-stripe-test-reservation.css";

const MAX_BYTES=512000;
const VERSION="m7-source-migration-preflight-v1";
const REQUIRED_FALSE=[
 "snapshotConsistencyIndependentlyVerified","independentBankSourceAuthenticated",
 "globalBankReferenceCoverageVerified","sourceSignatureIndependentlyVerified",
 "operationalInvoicePaid","operationalCreditPostingAllowed",
 "tenantAccessReleaseAllowed","operationalPromotionAllowed","writesPerformed",
];
const ISSUES={
 SCHEMA_SOURCE_NOT_AUTHENTICATED:"ต้นฉบับ SQL/ผู้ส่งออกยังไม่ได้รับรองจากแหล่งข้อมูลอิสระ",
 SOURCE_SNAPSHOT_COUNTS_MISMATCH:"จำนวนแถว Source ไม่ตรงกับ Inventory ที่แนบมา",
 INVOICE_SCOPE_OR_STRUCTURE_INVALID:"คีย์หรือลายเซ็น Invoice ไม่ตรงโครงสร้าง Source",
 INVOICE_DUPLICATE_KEY:"พบ Invoice Key ซ้ำ",
 INVOICE_MONEY_INCONSISTENT:"ยอด Gross, Credit, Bank หรือสถานะ Invoice ไม่สมดุล",
 INVOICE_DATE_OR_POLICY_INVALID:"วันที่รอบบัญชี/เวอร์ชันนโยบายไม่ถูกต้อง",
 ADJUSTMENT_ORIGINAL_INVOICE_MISSING:"Adjustment ไม่มี Invoice ต้นฉบับ",
 ADJUSTMENT_AUDIT_INVALID:"หลักฐานลงลายเซ็น Adjustment ไม่ครบ",
 CREDIT_ACCOUNT_INVALID:"บัญชี Service Credit มีข้อมูลผิดรูปแบบ",
 CREDIT_EVENT_SEQUENCE_OR_BALANCE_MISMATCH:"ลำดับ Credit Events ไม่ตรงยอดคงเหลือ",
 CREDIT_EVENT_ORIGINAL_INVOICE_MISSING:"Credit Event ไม่พบ Invoice ต้นทาง",
 CREDIT_EVENT_OVERDRAW:"เครดิตถูกหักเกินยอดคงเหลือ",
 CREDIT_CONVERSION_INCONSISTENT:"หลักฐานแปลงค่ารายเดือนเป็นเครดิตไม่ตรงกัน",
 CREDIT_EVENT_CONVERSION_MISSING:"Credit Event ไม่พบ Conversion ที่ยืนยัน",
 CREDIT_INVOICE_OFFSET_MISMATCH:"เครดิตที่ใช้ไม่ตรงยอดหักใน Invoice",
 CREDIT_YEARLY_OFFSET_FORBIDDEN:"ห้ามใช้เครดิตหักค่าสมาชิกรายปี",
 PAYMENT_ORIGINAL_INVOICE_MISSING:"Payment ไม่พบ Invoice ต้นฉบับ",
 PAYMENT_AMOUNT_OR_STATE_MISMATCH:"ยอด Payment/Invoice หรือสถานะไม่ตรงกัน",
 PAYMENT_DUPLICATE_SLIP_HASH:"พบหลักฐานสลิปซ้ำ",
 PAYMENT_PROOF_NOT_INDEPENDENT:"Payment ยังไม่มีหลักฐานตรวจที่เป็นอิสระ",
 SOURCE_BANK_PAID_PAYMENT_PROOF_NOT_EXPORTED:"ยอดธนาคารของ Source ยังไม่มี Payment ที่อนุมัติและส่งออกครบ",
 BANK_REFERENCE_CLAIM_ORPHAN:"Bank Reference Claim ไม่มี Payment อ้างอิง",
 BANK_REFERENCE_CLAIM_DUPLICATE:"พบ Bank Reference Claim ซ้ำ",
 BANK_REFERENCE_CLAIMS_GLOBAL_COVERAGE_UNKNOWN:"ยังไม่ได้ยืนยันคีย์อ้างอิงธนาคารครบทุก Tenant",
 HOLD_ORIGINAL_INVOICE_MISSING:"Hold ไม่พบ Invoice ต้นฉบับ",
 HOLD_MONEY_OR_STATE_INCONSISTENT:"ยอด/สถานะระงับร้านไม่ตรง Invoice",
 HOLD_EVENT_ORPHAN:"Hold Event ไม่พบ Hold ต้นฉบับ",
 HOLD_APPROVAL_ORIGINAL_INVOICE_MISSING:"Hold Approval ไม่พบ Invoice ต้นฉบับ",
 HOLD_APPROVAL_POLICY_INVALID:"เอกสารอนุมัติ Hold ไม่ตรงกำหนดชำระ/คีย์",
 HOLD_RELEASE_CANNOT_BE_CERTIFIED:"ยังไม่สามารถรับรองการคืนสิทธิ์ร้านค้าจาก Source",
 FIREBASE_CROSS_LEDGER_CONFLICT_NOT_EVALUATED:"ยังไม่ได้กระทบยอดกับ Firebase รายการจริงทุกช่องทาง",
};
const validReport=(r,tenantId)=>r?.ok===true&&r.mode===VERSION&&
 r.tenantId===tenantId&&r.sourceInventorySelfReported===true&&
 r.missingOperationalProof===true&&
 REQUIRED_FALSE.every(k=>r[k]===false)&&
 r.verifiedBankPaidCents===null&&
 r.verifiedServiceCreditBalanceCents===null&&r.outstandingDebtCents===null&&
 r.candidateComparison?.mode==="m7_source_firebase_candidate_mapping_read_only"&&
 r.candidateComparison.financialMutationAllowed===false&&
 r.candidateComparison.tenantReleaseAllowed===false&&
 r.candidateComparison.mappingOnlyAdvisory===true&&
 Number.isSafeInteger(r.candidateComparison.missingFirebaseInvoiceCandidates)&&
 Number.isSafeInteger(r.candidateComparison.conflictingInvoiceCandidates)&&
 /^[a-f0-9]{64}$/.test(r.manifestDigest||"")&&
 Number.isSafeInteger(r.structuralIssuesDetected)&&r.structuralIssuesDetected>=0&&
 Number.isSafeInteger(r.totalRows)&&r.totalRows>=0&&r.totalRows<=1000&&
 Array.isArray(r.issueCodes)&&r.issueCodes.every(k=>Object.hasOwn(ISSUES,k));

export function M7SourceMigrationPreflight({tenantId="",refreshVersion=0}){
 const [open,setOpen]=useState(false);
 const [file,setFile]=useState(null);
 const [manifest,setManifest]=useState(null);
 const [report,setReport]=useState(null);
 const [history,setHistory]=useState([]);
 const [phase,setPhase]=useState("idle");
 const [message,setMessage]=useState("");
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  setFile(null);setManifest(null);setReport(null);setHistory([]);
  setMessage("");setPhase("idle");
 },[tenantId]);
 useEffect(()=>{
  let alive=true;
  if(!open||!tenantId)return()=>{alive=false;};
  httpsCallable(functions,"getPlatformM7SourceMigrationPreflightHistory")({tenantId})
   .then(({data})=>{
    if(!alive)return;
    if(data?.ok!==true||data.mode!=="m7_source_migration_preflight_history"||
       data.tenantId!==tenantId||data.bankCashApproved!==false||
       data.serviceCreditPostApproved!==false||
       data.tenantAccessReleaseAllowed!==false||
       !Array.isArray(data.items)||data.items.length>20||
       data.items.some(item=>!(/^[a-f0-9]{64}$/.test(item.manifestDigest||""))||
        !["unauthenticated_source_preview","needs_review"].includes(item.status)))
     throw Error("M7_SOURCE_HISTORY_INVALID");
    setHistory(data.items);
   }).catch(()=>{if(alive)setHistory([]);});
  return()=>{alive=false;};
 },[open,tenantId,refreshVersion,revision]);
 const choose=async chosen=>{
  setFile(null);setManifest(null);setReport(null);setMessage("");
  if(!chosen)return;
  if(!chosen.name.toLowerCase().endsWith(".json")||
      chosen.size<=0||chosen.size>MAX_BYTES){
   setMessage("รองรับเฉพาะไฟล์ JSON ที่กรองข้อมูลส่วนตัวแล้ว ขนาดไม่เกิน 512 KB");
   return;
  }
  try{
   const parsed=JSON.parse(await chosen.text());
   if(parsed?.version!==VERSION||parsed.tenantId!==tenantId||
      !parsed.tables||typeof parsed.tables!=="object"){
    setMessage("Manifest ไม่ตรงกับ Tenant/Version ที่เลือก หรือไม่ใช่ข้อมูลที่กรองแล้ว");
    return;
   }
   setManifest(parsed);setFile(chosen.name);
  }catch{setMessage("อ่านไฟล์ JSON ไม่สำเร็จ กรุณาตรวจรูปแบบไฟล์ก่อน");}
 };
 const preview=async()=>{
  if(!manifest||phase==="loading")return;
  setReport(null);setMessage("");setPhase("loading");
  try{
   const {data}=await httpsCallable(functions,"previewPlatformM7SourceMigrationPreflight")({manifest});
   if(!validReport(data,tenantId)||data.authenticated!==true||
      data.superadminOnly!==true||data.staged!==false)
    throw Error("M7_SOURCE_PREFLIGHT_REJECTED");
   setReport(data);
   setMessage("ตรวจโครงสร้าง Manifest แล้ว · ยังไม่ได้ยืนยันบัญชี Source หรือรับชำระเงิน");
   setPhase("previewed");
  }catch{
   setMessage("ไม่สามารถตรวจ Manifest ได้ ต้องใช้ไฟล์ที่กรองข้อมูลส่วนตัวและโครงการ UAT ที่ได้รับอนุญาตเท่านั้น");
   setPhase("unavailable");
  }
 };
 const stage=async()=>{
  if(!report||!manifest||phase==="loading")return;
  const accepted=await sweetConfirm(
   "บันทึกเฉพาะ Digest, จำนวนแถว และรหัสข้อผิดพลาดของ Manifest ใน UAT Audit เท่านั้น ไม่บันทึกข้อมูลต้นฉบับ ไม่ย้าย Invoice ไม่สร้างหรือหัก Service Credit และไม่ปลดระงับร้านค้า",
   {title:"M7 Source Migration · บันทึกผล Preflight",confirmText:"บันทึก Audit (UAT)",cancelText:"ยกเลิก",type:"warning"});
  if(!accepted)return;
  setPhase("loading");setMessage("");
  try{
   const {data}=await httpsCallable(functions,"stagePlatformM7SourceMigrationPreflight")({manifest});
   if(data?.ok!==true||data.mode!=="m7_untrusted_source_preflight_audit"||
      data.manifestDigest!==report.manifestDigest||
      data.operationalPromotionAllowed!==false||
      data.serviceCreditPostApproved!==false||
      data.operationalInvoicePaid!==false||
      data.tenantAccessReleaseAllowed!==false||data.staged!==true)
    throw Error("M7_SOURCE_STAGE_UNCONFIRMED");
   setMessage(data.reused?"พบ Audit Digest นี้แล้ว ไม่มีการบันทึกซ้ำ":
    "บันทึก Audit ตรวจโครงสร้างแล้ว (UAT) ยังไม่มีการย้ายหรือรับรองยอดเงินจริง");
   setPhase("previewed");setRevision(n=>n+1);
  }catch{
   setMessage("ไม่สามารถบันทึก UAT Preflight Audit ได้ กรุณาตรวจสอบสิทธิ์และ Manifest อีกครั้ง");
   setPhase("previewed");
  }
 };
 if(!tenantId)return null;
 return <details className="m7-stripe-test-reservation m7-source-migration"
  onToggle={e=>setOpen(e.currentTarget.open)}
  data-m7-source-migration>
  <summary><i className="bi bi-database-check" aria-hidden="true"/>
   <span>M7 Source Migration · ตรวจและบันทึก Preflight (UAT เท่านั้น)</span>
   <i className="bi bi-chevron-down" aria-hidden="true"/></summary>
  <section className="card m7-stripe-test-quote-card">
   <header><div><h3>ตรวจความครบถ้วน Source MariaDB → Firebase</h3>
    <p>ตรวจ 10 ตาราง Invoice, Bank Reference, Service Credit, Payment และ Hold โดยไม่เขียนบัญชีจริง</p></div></header>
   <div className="m7-stripe-test-quote-warning" role="status">
    <i className="bi bi-shield-exclamation" aria-hidden="true"/>
    เลือกได้เฉพาะ Sanitized Manifest สำหรับโครงการ UAT ห้ามอัปโหลดสลิปต้นฉบับ,
    เลขบัญชี, Token, Password หรือ Private File Path
   </div>
   <label className="m7-source-migration-file">
    <span>ไฟล์ Manifest JSON ที่กรองข้อมูลส่วนตัวแล้ว</span>
    <input type="file" accept=".json,application/json"
     aria-label="ไฟล์ Source M7 Migration JSON" onChange={e=>choose(e.target.files?.[0])}
     disabled={phase==="loading"}/>
   </label>
   {file&&<small>ไฟล์ที่เลือก: {file}</small>}
   <div className="m7-source-migration-actions">
    <button type="button" className="btn btn-sm" disabled={!manifest||phase==="loading"}
      onClick={preview}>
     <i className="bi bi-shield-check" aria-hidden="true"/>
     {phase==="loading"?"กำลังตรวจ…":"ตรวจโครงสร้าง Source (Read-only)"}
    </button>
    <button type="button" className="btn btn-sm" disabled={!report||phase==="loading"}
     onClick={stage}><i className="bi bi-journal-check" aria-hidden="true"/>
     บันทึก Preflight Audit (UAT)
    </button>
   </div>
   {message&&<p className="m7-stripe-test-inspection" role="status">
    <i className="bi bi-info-circle" aria-hidden="true"/> {message}</p>}
   {report&&<section className="m7-source-migration-report" aria-label="ผลตรวจ Manifest">
    <div className="m7-operational-gap-summary">
     <div><small>แถว Source ที่ตรวจ</small><strong>{report.totalRows}</strong></div>
     <div><small>ข้อผิดพลาดเชิงโครงสร้าง</small><strong>{report.structuralIssuesDetected}</strong></div>
     <div><small>รับรองยอดธนาคาร</small><strong>ยังไม่ได้</strong></div>
     <div><small>อนุมัติย้ายบัญชีจริง</small><strong>ไม่ได้</strong></div>
    </div>
    <small>รหัส Snapshot: <code>{report.manifestDigest.slice(0,16)}…</code></small>
    <p className="m7-stripe-test-inspection" role="status">
     <i className="bi bi-info-circle" aria-hidden="true"/>
     ตรวจเทียบ Candidate Firebase แบบ Read-only:
     พบยอด/ประเภทที่ตรงกัน {report.candidateComparison.matchingAmountAndKindCandidates} รายการ,
     ไม่พบ Invoice ปลายทาง {report.candidateComparison.missingFirebaseInvoiceCandidates} รายการ,
     ยอดหรือโครงสร้างต่างกัน {report.candidateComparison.conflictingInvoiceCandidates} รายการ
     · ยังไม่ใช่หลักฐานย้ายบัญชีหรือรับชำระเงินจริง
    </p>
    <strong>หลักฐานที่ยังต้องตรวจ</strong>
    <ul>{report.issueCodes.map(code=><li key={code}>{ISSUES[code]}</li>)}</ul>
   </section>}
   {history.length>0&&<section className="m7-source-migration-history"
      aria-label="ประวัติ UAT Preflight">
    <h4>Preflight Audit ที่บันทึกไว้</h4>
    {history.map(item=><div key={item.manifestDigest}>
     <code>{item.manifestDigest.slice(0,16)}…</code>
     <small>{item.status==="needs_review"?"Audit มีข้อมูลไม่ตรงกัน ต้องตรวจสอบ":
      "ยังไม่รับรอง Source"} · {Number.isSafeInteger(item.totalRows)?item.totalRows+" แถว":"ต้องตรวจ"}</small>
    </div>)}
   </section>}
  </section>
 </details>;
}
