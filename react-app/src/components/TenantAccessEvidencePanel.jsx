import {useCallback,useEffect,useState} from "react";
import {getPlatformTenantAccessEvidence} from "@/data/platformTenantService";
import {ACCESS_REASONS,SOURCE_GAPS,validateTenantAccessEvidence,
 summaryText} from "@/data/tenantAccessEvidenceContract.mjs";
import "@/ui/tenant-access-evidence.css";

// Per-store, lazy Superadmin read. No action control to suspend/unlock.
// It cannot infer Go HMAC, bank cash, Service Credit or authorized M7 invoice
// from metadata, a SHA256 digest, a Stripe TEST shadow or a tenant flag.
export function TenantAccessEvidencePanel({
 tenantId="",enabled=false,refreshVersion=0,
}){
 const [phase,setPhase]=useState("idle");
 const [result,setResult]=useState(null);
 const [revision,setRevision]=useState(0);
 const load=useCallback(()=>setRevision(value=>value+1),[]);
 useEffect(()=>{
  let alive=true;
  setResult(null);
  if(!enabled||!tenantId){
   setPhase("idle");
   return()=>{alive=false;};
  }
  setPhase("loading");
  getPlatformTenantAccessEvidence({tenantId})
   .then(data=>{
    if(!alive)return;
    const verified=validateTenantAccessEvidence(data,tenantId);
    setResult(verified);
    setPhase("ready");
   }).catch(()=>{
    if(alive){setResult(null);setPhase("unavailable");}
   });
  return()=>{alive=false;};
 },[enabled,tenantId,refreshVersion,revision]);
 if(!enabled||!tenantId)return null;
 // Keep the previous tenant's evidence hidden immediately when a parent
 // changes tenantId, even before React runs the next asynchronous effect.
 const current=phase==="ready"&&result?.tenantId===tenantId;
 const visiblePhase=phase==="ready"&&!current?"loading":phase;
 const label=current?summaryText(result.state):
  visiblePhase==="loading"?"กำลังอ่านสถานะจาก Firebase…":
  visiblePhase==="unavailable"?"อ่านสถานะหลักฐานไม่ได้ ยังไม่สามารถสรุปสิทธิ์ขาย":
   "ยังไม่ได้ตรวจสอบสถานะสิทธิ์";
 return <section className="tenant-access-evidence" data-tenant-access-evidence={tenantId}>
  <div className="tenant-access-evidence-head">
   <div>
    <strong><i className="bi bi-shield-exclamation" aria-hidden="true"></i>
      ตรวจหลักฐานการระงับแยกประเภท</strong>
    <small>Superadmin · อ่านอย่างเดียว · ไม่สร้าง หัก หรือชำระ Invoice</small>
   </div>
   <button type="button" className="btn btn-sm" data-tenant-access-evidence-refresh
    onClick={load} disabled={phase==="loading"}>
    <i className="bi bi-arrow-clockwise" aria-hidden="true"></i> ตรวจอีกครั้ง
   </button>
  </div>
  <div role="status" className={"tenant-access-evidence-status "+visiblePhase}
   data-tenant-access-evidence-status={visiblePhase}>
   <i className="bi bi-info-circle" aria-hidden="true"></i>{label}
  </div>
  {current?<div className="tenant-access-evidence-body">
   <div className="tenant-access-evidence-metrics">
    <div><small>สถานะธุรกรรมและสิทธิ์ขายจริง</small>
      <strong>ยังไม่ยืนยัน</strong></div>
    <div><small>อนุมัติปลด Hold ทางการเงิน</small>
      <strong>ไม่ได้</strong></div>
    <div><small>รับเงินจริง / Service Credit</small>
      <strong>ยังไม่มีหลักฐาน Source</strong></div>
   </div>
   {result.reasonCodes.length?
    <div className="tenant-access-evidence-reasons">
      <h5>เงื่อนไขที่พบในทะเบียนร้าน</h5>
      <ul>{result.reasonCodes.map(code=>
        <li key={code}><i className="bi bi-exclamation-circle" aria-hidden="true"></i>
          {ACCESS_REASONS[code]}</li>)}</ul>
    </div>:
    <p className="tenant-access-evidence-empty">
      ไม่พบเหตุระงับที่บันทึกในชุดข้อมูลที่ตรวจ แต่ยังไม่ใช่การรับรองให้ขายได้
    </p>}
   <div className="tenant-access-evidence-gaps">
    <h5>หลักฐานที่ยังขาดก่อนจะรับรองสิทธิ์ทางการเงิน</h5>
    <ul>{result.sourceProofGaps.map(code=>
      <li key={code}><i className="bi bi-lock" aria-hidden="true"></i>
        {SOURCE_GAPS[code]}</li>)}</ul>
   </div>
   <p className="tenant-access-evidence-provenance">
    ผลอ่านเป็น Snapshot ของ Tenant + Slug จาก Firebase เท่านั้น
    ไม่ใช่ลายเซ็น Go, สลิปธนาคาร หรือคำสั่งปลดระงับ
   </p>
   <small className="tenant-access-evidence-digest">
    รหัสตรวจ Snapshot (ไม่ใช่ลายเซ็นรับรอง):
    <code>{result.snapshotDigest.slice(0,16)}…</code>
   </small>
  </div>:null}
  {phase==="unavailable"?<p className="tenant-access-evidence-retry" role="alert">
    ไม่มีหลักฐานยืนยันสิทธิ์ ร้านต้องคงสถานะเดิม และติดต่อผู้ดูแลเพื่อตรวจสอบ
  </p>:null}
 </section>;
}
