import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import {projectMerchantObserver} from "@/data/merchantCompanionObserver.mjs";
import "@/ui/payment-companion.css";
import "@/ui/merchant-companion-observer.css";

const money=cents=>new Intl.NumberFormat("th-TH",{
 minimumFractionDigits:2,maximumFractionDigits:2,
}).format(cents/100);
const bangkokDate=value=>{
 const timestamp=new Date(value||"");
 return Number.isFinite(timestamp.getTime())
  ?new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",dateStyle:"medium",timeStyle:"short"}).format(timestamp)
  :"ไม่มีข้อมูลเวลาที่ตรวจสอบได้";
};
const observedState=status=>({
 candidate:"ข้อมูลตรงเบื้องต้น · รอตรวจสอบ",
 ambiguous:"พบหลายรายการ · ต้องตรวจสอบ",
 no_match:"ยังไม่พบรายการที่ตรงกัน",
 unavailable:"ยังยืนยันข้อมูลไม่ได้",
})[status]||"ยังไม่ยืนยัน";

export function PaymentCompanionObserverCard({isOwner=false}){
 const [state,setState]=useState(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const current=useRef(0),pending=useRef(false);
 const reload=useCallback(async()=>{
  if(!isOwner||pending.current)return;
  pending.current=true;setLoading(true);
  const requestId=++current.current;
  try{
   const {data}=await httpsCallable(functions,"getPaymentCompanionDashboard")({});
   const result=projectMerchantObserver(data);
   if(requestId===current.current){setState(result);setError("");}
  }catch{
   if(requestId===current.current){
    setState(null);
    setError("ไม่สามารถยืนยันประวัติแจ้งเงินเข้าจาก Firebase ได้ กรุณารีเฟรช");
   }
  }finally{
   pending.current=false;
   if(requestId===current.current)setLoading(false);
  }
 },[isOwner]);
 useEffect(()=>{
  if(isOwner)void reload();
  return()=>{current.current++;};
 },[isOwner,reload]);
 useEffect(()=>{
  if(!isOwner)return;
  const interval=window.setInterval(()=>{
   const card=document.querySelector('[data-admin-card-key="companion-observer"]');
   const expanded=card&&!card.classList.contains("admin-card-collapsed");
   if(expanded&&document.visibilityState==="visible"&&!pending.current)
    void reload();
  },15000);
  return()=>window.clearInterval(interval);
 },[isOwner,reload]);
 const metrics=useMemo(()=>[
  {label:"แจ้งเตือนที่บันทึก",value:state?.notices.length??"—",icon:"bell",tone:"green",
   hint:"สูงสุด 50 ข้อความล่าสุด"},
  {label:"กลุ่มสำหรับตรวจสอบ",value:state?.groupedNotices.length??"—",icon:"collection",tone:"blue",
   hint:"จัดกลุ่มสำหรับแสดงผลเท่านั้น"},
  {label:"กลุ่มที่อาจซ้ำ",value:state?.duplicateGroups??"—",icon:"exclamation-triangle",tone:"amber",
   hint:"อาจเป็นคนละรายการเงินจริง"},
  {label:"อุปกรณ์ที่เปิดใช้งาน",value:state?state.activeCount+"/3":"—",icon:"phone",tone:"violet",
   hint:"สถานะสิทธิ์ ไม่ใช่ออนไลน์สด"},
 ],[state]);
 if(!isOwner)return null;
 const notices=state?.groupedNotices||[];
 return <div className="payment-companion-observer" data-companion-observer-readonly data-source-ui="7bf9d159">
  {error?<p role="alert" className="payment-companion-error">{error}</p>:null}
  <div className="payment-companion-dashboard" data-companion-dashboard>
   <section className="payment-companion-overview" aria-label="ภาพรวมการแจ้งเงินเข้า">
    <div className="payment-companion-overview-hero">
     <div className="payment-companion-overview-heading">
      <span className="payment-companion-overview-hero-icon" aria-hidden="true"><i className="bi bi-activity"/></span>
      <div><span className="payment-companion-overline">PAYMENT OBSERVER · ANDROID</span>
       <h3>ภาพรวมการแจ้งเงินเข้า</h3>
       <p>ติดตามข้อความจากอุปกรณ์เพื่อประกอบการตรวจสอบของร้านค้า</p>
      </div>
     </div>
     <span className="payment-companion-overview-status"><i className="bi bi-shield-lock" aria-hidden="true"/> ข้อมูลรอตรวจสอบ</span>
    </div>
    <div className="payment-companion-metrics" role="list" aria-label="สรุปข้อมูลแจ้งเตือน">
     {metrics.map(metric=><div key={metric.label} className={"payment-companion-metric is-"+metric.tone} role="listitem">
      <span className="payment-companion-metric-icon" aria-hidden="true"><i className={"bi bi-"+metric.icon}/></span>
      <span className="payment-companion-metric-label">{metric.label}</span>
      <strong className="payment-companion-metric-number">{metric.value}</strong>
      <small className="payment-companion-metric-hint">{metric.hint}</small>
     </div>)}
    </div>
    <div className="payment-companion-overview-bottom">
     <span><i className="bi bi-clock-history" aria-hidden="true"/> รับแจ้งล่าสุด: <strong>{bangkokDate(state?.notices[0]?.receivedUTC)}</strong></span>
     <span><i className="bi bi-info-circle" aria-hidden="true"/> ไม่ใช่ยอดเงินที่ธนาคารยืนยัน</span>
    </div>
   </section>
   <section className="payment-companion-panel payment-companion-activity" aria-label="ประวัติแจ้งเงินเข้า">
    <div className="payment-companion-section-heading">
     <div className="payment-companion-section-title"><i className="bi bi-clock-history" aria-hidden="true"/>
      <div><strong>ประวัติแจ้งเงินเข้า</strong><small>รายการล่าสุดจาก Android · รีเฟรชอัตโนมัติเมื่อเปิดการ์ด</small></div>
     </div>
     <div className="payment-companion-activity-actions"><span className="payment-companion-activity-count">{notices.length} กลุ่ม</span>
      <button type="button" className="btn btn-sm payment-companion-refresh" onClick={()=>void reload()} disabled={loading} aria-label="รีเฟรชประวัติแจ้งเงินเข้า">
       <i className="bi bi-arrow-clockwise" aria-hidden="true"/> {loading?"กำลังโหลด…":"รีเฟรช"}
      </button>
     </div>
    </div>
    {!state?<p className="payment-companion-empty" role="status">{loading?"กำลังโหลดข้อมูลจาก Firebase…":"ยังไม่สามารถยืนยันข้อมูลแจ้งเงินเข้าได้"}</p>:
    !state.enabled?<p className="payment-companion-empty" role="status">ยังไม่เปิดรับข้อมูล Android BankAlert สำหรับร้านนี้ · ไม่ใช่การยืนยันธนาคาร</p>:
    notices.length===0?<p className="payment-companion-empty" role="status">ยังไม่มีรายการแจ้งเงินเข้าที่ตรวจสอบได้</p>:
    <div className="payment-companion-history-scroll" role="region" aria-label="เลื่อนดูประวัติแจ้งเงินเข้า" tabIndex={0}>
     <div className="payment-companion-history-head" aria-hidden="true"><span>ข้อมูลแจ้งเตือน</span><span>เวลาแจ้งเงินเข้า</span><span>อุปกรณ์ / บัญชี</span><span>สถานะ</span></div>
     <ul className="payment-companion-notice-list">
      {notices.map(item=><li key={item.id} className={"payment-companion-notice"+(item.possibleDuplicate?" is-duplicate":"")}>
       <div className="payment-companion-history-amount">
        <span className="payment-companion-notice-icon" aria-hidden="true"><i className="bi bi-arrow-down-left"/></span>
        <div className="payment-companion-notice-info"><strong>+{money(item.amountSatang)} บาท</strong><small>รับเมื่อ {bangkokDate(item.receivedUTC)}</small></div>
       </div>
       <div className="payment-companion-history-data"><small className="payment-companion-mobile-label">เวลาแจ้งเงินเข้า</small><strong>{bangkokDate(item.bankTimeUTC)}</strong></div>
       <div className="payment-companion-history-data payment-companion-history-device">
        <small className="payment-companion-mobile-label">อุปกรณ์ / บัญชี</small><strong>{item.deviceLabel||"อุปกรณ์ไม่ระบุชื่อ"}</strong><small>{item.receiverSuffix||"ไม่ทราบเลขท้าย"}</small>
       </div>
       <div className="payment-companion-history-state">
        <span className={"payment-companion-unverified"+(item.possibleDuplicate?" is-possible-duplicate":"")}>{item.possibleDuplicate?"อาจเป็นรายการซ้ำ":"รอตรวจสอบ"}</span>
        {item.possibleDuplicate?<small>{item.notificationCount} ข้อความที่มีข้อมูลตรงกัน</small>:null}
       </div>
       {item.possibleDuplicate?<p className="payment-companion-duplicate-note">อาจเป็นรายการซ้ำหรือเงินเข้าคนละครั้ง ต้องตรวจสอบกับธนาคาร</p>:null}
      </li>)}
     </ul>
    </div>}
    <p className="payment-companion-footnote" role="note"><i className="bi bi-info-circle" aria-hidden="true"/>
     การจัดกลุ่มเพื่อให้อ่านง่าย ไม่ได้รวมการโอนเงินจริงหรือเปลี่ยนสถานะ Paid
    </p>
   </section>
  </div>
  <section className="payment-companion-panel payment-companion-lkshop-compare" aria-label="เปรียบเทียบรายการแจ้งเตือนกับ PG Notify">
   <div className="payment-companion-section-title"><i className="bi bi-chat-left-text" aria-hidden="true"/>
    <div><strong>รายการแจ้งเตือนที่ส่งเข้า PG Notify</strong><small>ข้อมูลจาก Outbox จริงเท่านั้น ไม่ใช้ยอดแจ้งเงินเข้าแทนการส่งข้อความ</small></div>
   </div>
   <p className="payment-companion-empty" role="status">Firebase รุ่นนี้ยังไม่มี API อ่าน PG Notify Outbox ของร้าน จึงยังไม่แสดงรายการเปรียบเทียบ ไม่ได้หมายความว่าไม่ได้ส่งข้อความ</p>
  </section>
  <section className="payment-companion-panel payment-companion-match-panel payment-companion-observer-matches" data-companion-matches aria-label="รายการรอจับคู่ยอดเงินเข้า">
   <div className="payment-companion-section-title"><i className="bi bi-intersect" aria-hidden="true"/>
    <div><strong>รายการจับคู่เพื่อประกอบการตรวจสอบ</strong><small>แสดงเพื่อประกอบการตรวจสอบ ไม่ยืนยันรับเงิน ไม่ปล่อยครัวอัตโนมัติ</small></div>
   </div>
   {!state||state.matchStatus!=="advisory"?<p className="payment-companion-empty" role="status">ยังไม่มีผลจับคู่ที่ได้รับการยืนยันสำหรับการแสดงผล</p>:
   state.matches.length===0?<p className="payment-companion-empty" role="status">ไม่พบออเดอร์พร้อมหลักฐานที่รอจับคู่</p>:
   <ul className="payment-companion-notice-list">{state.matches.map(item=><li className="payment-companion-notice payment-companion-match-row" key={item.orderId}>
    <div className="payment-companion-history-amount"><span className="payment-companion-notice-icon"><i className="bi bi-receipt" aria-hidden="true"/></span>
     <div className="payment-companion-notice-info"><strong>{money(item.amountSatang)} บาท</strong><small>บิล {item.orderId}</small><small>{bangkokDate(item.orderTimeUTC)}</small></div>
    </div>
    <span className="payment-companion-unverified">{observedState(item.status)}</span>
    <p className="payment-companion-footnote" role="note">ยังไม่ยืนยันเงินเข้าจากธนาคาร · {item.hasSlip?"มีสลิปให้ตรวจ":"ยังไม่มีสลิปต้นฉบับ"}</p>
   </li>)}</ul>}
  </section>
 </div>;
}
