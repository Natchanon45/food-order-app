import {useCallback,useEffect,useRef,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import "@/ui/platform-payment-history.css";
const statuses=[["all","ทั้งหมด"],["approved","อนุมัติแล้ว"],["pending","รอตรวจสอบ"],["rejected","ไม่อนุมัติ"]];
const stateLabel={approved:"อนุมัติแล้ว",pending:"รอตรวจสอบ",rejected:"ไม่อนุมัติ",unknown:"ไม่ทราบสถานะ"};
const providerLabel={slip2go:"ระบบตรวจสลิป",manual:"ตรวจด้วยคน",google_vision:"Google Vision",slip2go_fallback_vision:"ระบบตรวจสลิป / Vision"};
const money=cents=>Number.isSafeInteger(cents)?new Intl.NumberFormat("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100)+" ฿":"—";
const when=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",dateStyle:"medium",timeStyle:"short"}).format(date);};
export function PlatformPaymentHistory({tenantId,refreshVersion=0}){
 const [filter,setFilter]=useState("all");
 const [revision,setRevision]=useState(0);
 const tableScrollRef=useRef(null);
 const dragRef=useRef(null);
 // The table is a native continuous horizontal scroller on touch devices.
 // Desktop/device emulation can drag the content with a mouse pointer too.
 const beginDrag=useCallback(event=>{
  if(event.pointerType!=="mouse"||event.button!==0)return;
  const el=tableScrollRef.current;
  if(!el||el.scrollWidth<=el.clientWidth)return;
  dragRef.current={x:event.clientX,left:el.scrollLeft,pointerId:event.pointerId,moved:false};
  event.currentTarget.setPointerCapture?.(event.pointerId);
 },[]);
 const dragTable=useCallback(event=>{
  const el=tableScrollRef.current,d=dragRef.current;
  if(!el||!d||event.pointerId!==d.pointerId)return;
  const dx=event.clientX-d.x;
  if(Math.abs(dx)>3){
   d.moved=true;
   el.scrollLeft=d.left-dx;
   event.preventDefault();
  }
 },[]);
 const stopDrag=useCallback(event=>{
  if(!dragRef.current||dragRef.current.pointerId!==event.pointerId)return;
  dragRef.current=null;
  if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 },[]);
 const queryKey=JSON.stringify([tenantId||"",filter,revision,refreshVersion]);
 const [loaded,setData]=useState({status:"loading",items:[],hasMore:false,key:""});
 const data=loaded.key===queryKey?loaded:{status:"loading",items:[],hasMore:false};
 // Chrome Android sometimes routes a swipe to the vertical parent scroller.
 // Explicitly lock a horizontal one-finger gesture to this exact table viewport;
 // never block vertical page scrolling or multi-touch/zoom gestures.
 useEffect(()=>{
  const el=tableScrollRef.current;
  if(!el)return undefined;
  let gesture=null;
  const start=e=>{
   gesture=e.touches.length===1 && el.scrollWidth>el.clientWidth
    ? {x:e.touches[0].clientX,y:e.touches[0].clientY,left:el.scrollLeft,axis:null}:null;
  };
  const move=e=>{
   if(!gesture||e.touches.length!==1)return;
   const dx=e.touches[0].clientX-gesture.x;
   const dy=e.touches[0].clientY-gesture.y;
   if(!gesture.axis && Math.max(Math.abs(dx),Math.abs(dy))>6){
    gesture.axis=Math.abs(dx)>Math.abs(dy)*1.15?"horizontal":"vertical";
   }
   if(gesture.axis!=="horizontal")return;
   if(e.cancelable)e.preventDefault();
   el.scrollLeft=gesture.left-dx;
  };
  const stop=()=>{gesture=null;};
  el.addEventListener("touchstart",start,{passive:true});
  el.addEventListener("touchmove",move,{passive:false});
  el.addEventListener("touchend",stop,{passive:true});
  el.addEventListener("touchcancel",stop,{passive:true});
  return()=>{
   el.removeEventListener("touchstart",start);
   el.removeEventListener("touchmove",move);
   el.removeEventListener("touchend",stop);
   el.removeEventListener("touchcancel",stop);
  };
 },[data.status,data.items.length]);

 useEffect(()=>{
  let current=true;
  setData({status:"loading",items:[],hasMore:false,key:queryKey});
  httpsCallable(functions,"getPlatformRevenueSharePaymentHistory")({tenantId:tenantId||"",status:filter}).then(({data:result})=>{
   if(!current)return;
   if(result?.source!=="firebase_revenue_share_payment_records"||result.currency!=="THB"||!Array.isArray(result.items)||typeof result.hasMore!=="boolean")throw Error("PAYMENT_HISTORY_UNVERIFIED");
   setData({status:"ready",items:result.items,hasMore:result.hasMore,key:queryKey});
  }).catch(()=>{if(current)setData({status:"error",items:[],hasMore:false,key:queryKey});});
  return()=>{current=false;};
 },[queryKey]);
 return <section className="card m7-platform-payment-history" id="platformPaymentHistory" data-firebase-payment-history>
  <div className="m7-platform-payment-history-head"><div><h2><i className="bi bi-clock-history" aria-hidden="true"/> ประวัติการชำระค่าบริการของร้านค้า</h2><p>ข้อมูลการส่งชำระส่วนแบ่ง Delivery จาก Firebase ทุกช่วงเวลา ไม่อิงตัวกรองยอดขาย · ไม่ใช่รายการ Stripe หรือใบแจ้งหนี้ M7 ที่ยืนยันแล้ว</p></div>
  <button type="button" className="btn btn-sm" onClick={()=>setRevision(v=>v+1)} disabled={data.status==="loading"}><i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรชรายการ</button></div>
  <div className="m7-platform-payment-history-toolbar"><div className="m7-platform-payment-history-filter-shell"><div className="m7-platform-payment-history-filters" role="group" aria-label="กรองสถานะการชำระ" tabIndex={0}>{statuses.map(([value,label])=><button key={value} type="button" className={filter===value?"active":""} onClick={()=>setFilter(value)} aria-pressed={filter===value}>{label}</button>)}</div></div></div>
  {data.status==="loading"?<p className="m7-platform-payment-history-empty" role="status">กำลังโหลดประวัติการชำระ…</p>:data.status==="error"?<p className="m7-platform-payment-history-empty" role="alert">ไม่สามารถอ่านประวัติการชำระจาก Firebase ได้ กรุณารีเฟรชอีกครั้ง</p>:<>
   {data.hasMore&&<p className="m7-platform-payment-history-note">แสดง 200 รายการล่าสุดตามตัวกรอง</p>}
   {data.items.length?<div className="m7-platform-payment-history-table-shell"><div className="m7-platform-payment-history-table-wrap" ref={tableScrollRef} onPointerDown={beginDrag} onPointerMove={dragTable} onPointerUp={stopDrag} onPointerCancel={stopDrag} role="region" aria-label="ตารางประวัติการชำระส่วนแบ่ง" tabIndex={0}><table>
    <thead><tr><th>ร้านค้า / ประเภท</th><th>วันที่ส่งชำระ</th><th>รอบชำระ</th><th>ยอดที่บันทึก</th><th>ช่องทางตรวจสอบ</th><th>สถานะรายการ</th></tr></thead>
    <tbody>{data.items.map(item=><tr key={item.tenantId+"/"+item.paymentId}><td><strong>{item.tenantName}</strong><small>ส่วนแบ่ง Delivery</small></td><td>{when(item.submittedAt)}</td><td>{item.periodStart||"—"}{item.periodEnd&&item.periodEnd!==item.periodStart?" – "+item.periodEnd:""}</td><td>{money(item.amountCents)}</td><td>{providerLabel[item.provider]||"ไม่ระบุ"}</td><td><span className={"m7-history-status is-"+({approved:"verified",pending:"checkout_ready",rejected:"failed"}[item.status]||"needs_review")}>{stateLabel[item.status]||"ไม่ทราบสถานะ"}</span></td></tr>)}</tbody></table></div><div className="m7-platform-payment-history-swipe-hint"><i className="bi bi-arrow-left-right" aria-hidden="true"/> ปัดหรือลากซ้าย–ขวาเพื่อดูข้อมูลทั้งหมด</div></div>:<p className="m7-platform-payment-history-empty"><i className="bi bi-inbox" aria-hidden="true"/> ไม่พบประวัติการชำระตามตัวกรอง</p>}
  </>}
 </section>;
}
