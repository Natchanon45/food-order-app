import {useEffect,useMemo,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import "@/ui/m7-finance-evidence-history.css";

const SOURCE="firebase_m7_finance_evidence_not_stripe_settlements";
const statuses=[["all","ทั้งหมด"],["pending","รอตรวจ"],["recorded","บันทึกชำระ"],["rejected","ปฏิเสธ"],["needs_review","ต้องตรวจสอบ"]];
const kinds=[["all","ทุกประเภท"],["platform","ค่าบริการ Platform"],["delivery_daily","ส่วนแบ่ง Delivery"]];
const labelStatus={pending:"รอตรวจสอบ",recorded:"บันทึกชำระตามระบบ",rejected:"ปฏิเสธ",needs_review:"ต้องตรวจสอบข้อมูล"};
const kindLabel={platform:"ค่าบริการ Platform",delivery_daily:"ส่วนแบ่ง Delivery รายวัน"};
const cents=value=>Number.isSafeInteger(value)&&value>=0?
 (value/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2})+" บาท":"ตรวจสอบยอดไม่ได้";
const timestamp=value=>{
 const d=new Date(value||"");
 return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",
  day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",
  hour12:false}).format(d);
};
function Record({row,platform=false}){
 return <article className={"m7-evidence-record is-"+row.status} data-m7-evidence-row data-m7-evidence-status={row.status}>
  <div className="m7-evidence-record-head">
   <div className="m7-evidence-record-main">
    <strong><i className={"bi bi-"+(row.invoiceKind==="platform"?"receipt":"calendar-check")} aria-hidden="true"/> {kindLabel[row.invoiceKind]||"หลักฐานการชำระ"}</strong>
    {platform&&<small>{row.tenantName}</small>}
    <small>{timestamp(row.createdAt)}</small>
   </div>
   <span className={"m7-evidence-state is-"+row.status}>{labelStatus[row.status]||"ต้องตรวจสอบ"}</span>
  </div>
  <div className="m7-evidence-record-values">
   <span>ยอดหลักฐาน <strong>{cents(row.amountCents)}</strong></span>
   <span>ยอดบันทึกชำระ <strong>{cents(row.recordedCents)}</strong></span>
  </div>
  <div className="m7-evidence-record-meta">
   <small>อ้างอิง: <code>{row.paymentId}</code></small>
   {row.invoiceKey&&<small>Invoice/รอบ: <code>{row.invoiceKey}</code></small>}
   <small>{row.sourceKind==="hybrid_invoice_proof"?"หลักฐาน Hybrid Billing":"หลักฐานส่วนแบ่ง Delivery เดิม"} · ไม่ใช่ Stripe Settlement</small>
  </div>
 </article>;
}
function EvidenceTable({rows}){
 return <div className="m7-evidence-scroll" role="region" tabIndex={0}
   aria-label="ตารางหลักฐานการชำระ M7 เลื่อนซ้ายขวาเพื่อดูข้อมูลทั้งหมด">
  <table>
   <thead><tr><th>ร้านค้า / ประเภท</th><th>วันที่บันทึก</th><th>Invoice/รอบ</th><th>ยอดหลักฐาน</th><th>ยอดบันทึกชำระ</th><th>สถานะ</th></tr></thead>
   <tbody>{rows.map(row=><tr key={row.tenantId+":"+row.sourceKind+":"+row.paymentId}>
    <td><strong>{row.tenantName}</strong><small>{kindLabel[row.invoiceKind]||row.invoiceKind}</small></td>
    <td>{timestamp(row.createdAt)}</td><td><code>{row.invoiceKey||row.paymentId}</code></td>
    <td>{cents(row.amountCents)}</td><td>{cents(row.recordedCents)}</td>
    <td><span className={"m7-evidence-state is-"+row.status}>{labelStatus[row.status]||"ต้องตรวจสอบ"}</span></td>
   </tr>)}</tbody>
  </table>
 </div>;
}
export function M7FinanceEvidenceHistory({scope="merchant",tenantId="",refreshVersion=0}){
 const platform=scope==="platform";
 const [open,setOpen]=useState(false);
 const [status,setStatus]=useState("all"),[kind,setKind]=useState("all");
 const [start,setStart]=useState(""),[end,setEnd]=useState("");
 const [revision,setRevision]=useState(0);
 const key=useMemo(()=>JSON.stringify([scope,platform?tenantId:"own",status,kind,start,end,refreshVersion,revision]),
  [scope,platform,tenantId,status,kind,start,end,refreshVersion,revision]);
 const [loaded,setLoaded]=useState({key:"",phase:"idle",items:[],hasMore:false});
 const current=loaded.key===key?loaded:{key,phase:open?"loading":"idle",items:[],hasMore:false};
 useEffect(()=>{
  if(!open)return;
  if(platform&&!tenantId){setLoaded({key,phase:"choose_tenant",items:[],hasMore:false});return;}
  let active=true;
  setLoaded({key,phase:"loading",items:[],hasMore:false});
  const params={status,kind,start,end,...(platform?{tenantId}:{})};
  httpsCallable(functions,platform?"getPlatformM7FinanceEvidenceHistory":"getOwnM7FinanceEvidenceHistory")(params)
   .then(({data})=>{
    if(!active)return;
    if(data?.source!==SOURCE||data.currency!=="THB"||data.settlementSourceAvailable!==false||
       data.readOnly!==true||data.authenticated!==true||!Array.isArray(data.items)||
       (tenantId&&data.tenantId!==tenantId)||
       typeof data.hasMore!=="boolean"||data.items.some(row=>
        row.tenantId!==(tenantId||data.tenantId)||
        row.stripeSettled!==false||row.verifiedStripeCents!==0||row.bankSettlementVerified!==false||
        !["pending","recorded","rejected","needs_review"].includes(row.status)))
      throw Error("M7_EVIDENCE_NOT_CONFIRMED");
    setLoaded({key,phase:"ready",items:data.items,hasMore:data.hasMore});
   }).catch(()=>{
    if(active)setLoaded({key,phase:"error",items:[],hasMore:false});
   });
  return()=>{active=false;};
 },[key,open,platform,tenantId,status,kind,start,end]);
 const count=current.phase==="ready"?current.items.length:null;
 return <details className={"m7-evidence-history "+(platform?"is-platform":"is-merchant")}
  id={platform?"m7PlatformEvidenceHistory":"m7MerchantEvidenceHistory"} data-m7-evidence-history
  onToggle={e=>setOpen(e.currentTarget.open)}>
  <summary><i className="bi bi-clock-history" aria-hidden="true"/> <span>{platform?"ทะเบียนหลักฐาน M7 ของร้านค้า":"ทะเบียนหลักฐานการชำระ M7"}{count!==null?" ("+count+")":""}</span><i className="bi bi-chevron-down" aria-hidden="true"/></summary>
  <section className="card m7-evidence-card">
   <header className="m7-evidence-heading">
    <div><h3>ประวัติหลักฐานการชำระและผลการตรวจสอบ</h3>
     <p>แสดงรายการที่บันทึกไว้ใน Firestore เพื่อการตรวจสอบย้อนหลัง ไม่ใช่ประวัติ Stripe Settlement หรือการยืนยันเงินจากธนาคาร</p></div>
    <button type="button" className="btn btn-sm" disabled={current.phase==="loading"} onClick={()=>setRevision(n=>n+1)}>
     <i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรช</button>
   </header>
   <p className="m7-evidence-warning"><i className="bi bi-shield-exclamation" aria-hidden="true"/> ยอดที่บันทึกชำระ คือสถานะที่ระบบบัญชีบันทึกตามหลักฐาน ไม่ใช่ยอด Stripe ที่ยืนยันโดย Checkout/Settlement</p>
   <div className="m7-evidence-filters">
    <div className="m7-evidence-tabs" role="group" aria-label="กรองสถานะการตรวจหลักฐาน">
     {statuses.map(([value,label])=><button type="button" key={value} aria-pressed={status===value}
      className={status===value?"is-selected":""} onClick={()=>setStatus(value)}>{label}</button>)}
    </div>
    <label className="m7-evidence-field">ประเภทค่าบริการ
     <select value={kind} onChange={e=>setKind(e.target.value)}>
      {kinds.map(([value,label])=><option key={value} value={value}>{label}</option>)}
     </select></label>
    <label className="m7-evidence-field">ตั้งแต่วันที่ <input type="date" value={start} max={end||undefined} onChange={e=>setStart(e.target.value)}/></label>
    <label className="m7-evidence-field">ถึงวันที่ <input type="date" value={end} min={start||undefined} onChange={e=>setEnd(e.target.value)}/></label>
   </div>
   {current.phase==="choose_tenant"?<p className="m7-evidence-empty" role="status">กรุณาเลือกหนึ่งร้านจากตัวกรองด้านบนก่อนดูทะเบียนหลักฐาน M7</p>:
    current.phase==="loading"||current.phase==="idle"?<p className="m7-evidence-empty" role="status">กำลังตรวจสอบข้อมูลจาก Firestore…</p>:
    current.phase==="error"?<p className="m7-evidence-empty is-error" role="alert">ไม่สามารถยืนยันประวัติหลักฐานได้ กรุณากดรีเฟรชอีกครั้ง</p>:<>
     {current.hasMore&&<p className="m7-evidence-note">รายการอาจมีมากกว่าที่แสดง: ระบบอ่านย้อนหลังไม่เกิน 200 รายการล่าสุดต่อแหล่งข้อมูล กรุณากรองให้แคบลง</p>}
     {current.items.length?(platform?<EvidenceTable rows={current.items}/>:<div className="m7-evidence-list">
      {current.items.map(row=><Record key={row.tenantId+":"+row.sourceKind+":"+row.paymentId} row={row}/>)}
     </div>):<p className="m7-evidence-empty"><i className="bi bi-inbox" aria-hidden="true"/> ไม่พบหลักฐานการชำระตามตัวกรองที่เลือก</p>}
     {platform&&current.items.length>0&&<small className="m7-evidence-swipe-hint"><i className="bi bi-arrow-left-right" aria-hidden="true"/> ปัดซ้าย–ขวาเพื่อดูตารางทั้งหมด</small>}
    </>}
  </section>
 </details>;
}
