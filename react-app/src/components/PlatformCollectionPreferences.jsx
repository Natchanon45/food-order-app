import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {loadPlatformReceiptReceiver} from "@/data/platformReceiptReceiver";
import "@/ui/platform-collection.css";

// The latest LUKKAJA JSX offers live routing between LINE/LK Connect and Stripe.
// PENGUIN has NOT ported the corresponding payment-reconciliation and webhook
// gate yet. Preserve the visual information architecture but do not offer a
// fake switch which would mislabel unpaid invoices as accepted.
const methods=[
 {value:"bank_transfer",title:"QR พร้อมเพย์ / โอนเงิน",icon:"bi-qr-code",
  detail:"ใช้บัญชีผู้รับส่วนกลางและตรวจยอดกับธุรกรรมจากธนาคาร โดยยังไม่เปิดอนุมัติ LINE อัตโนมัติใน Firebase"},
 {value:"stripe",title:"Stripe",icon:"bi-credit-card",
  detail:"รับชำระค่าบริการ ส่วนแบ่งรายวัน และเติมเครดิตผ่าน Stripe เมื่อ Webhook และระบบการเงินพร้อมใช้งาน"},
];
export function PlatformCollectionPreferences(){
 const [readiness,setReadiness]=useState(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const reload=async()=>{
  setLoading(true);setError("");setReadiness(null);
  try{
   const item=await loadPlatformReceiptReceiver();
   setReadiness({
    receiverConfigured:item.configured===true,
    revision:item.revision,
    paymentRoutingEnabled:false,
   });
  }catch{
   setError("ไม่สามารถตรวจสอบบัญชีผู้รับเงินจาก Firebase ได้");
  }finally{setLoading(false);}
 };
 useEffect(()=>{void reload();},[]);
 return <section className="card platform-collection-settings" id="platformCollectionSettings"
  aria-label="ช่องทางรับชำระของ Platform" data-collection-readonly="true">
  <div className="platform-collection-heading">
   <span className="platform-collection-heading-icon"><i className="bi bi-cash-stack" aria-hidden="true"/></span>
   <div><h2>ช่องทางรับชำระค่าบริการ Platform</h2>
    <p>ค่าบริการ Platform ส่วนแบ่งรายวัน และการเติมเครดิต Lalamove ของร้านค้า</p></div>
  </div>
  <p role="alert" className="platform-collection-warning">
   <i className="bi bi-shield-lock" aria-hidden="true"/> การเลือกช่องทางรับเงินอัตโนมัติยังไม่เปิดใน PENGUIN Firebase
   จนกว่าระบบจับคู่ธุรกรรม LINE และ Stripe Webhook จะผ่านการทดสอบด้านการเงิน
  </p>
  {error&&<p role="alert" className="platform-collection-warning">{error}</p>}
  <div className="platform-collection-choices" role="group" aria-label="ช่องทางรับเงินที่อยู่ระหว่างเตรียมใช้งาน">
   {methods.map(method=><label className="platform-collection-choice" key={method.value}>
    <input type="radio" name="platformCollectionMethod" value={method.value}
      checked={false} disabled aria-disabled="true" readOnly/>
    <span className="platform-collection-choice-icon"><i className={"bi "+method.icon} aria-hidden="true"/></span>
    <span className="platform-collection-choice-text"><strong>{method.title}</strong><small>{method.detail}</small></span>
   </label>)}
  </div>
  <div className="platform-collection-status" role="status">
   <i className="bi bi-info-circle" aria-hidden="true"/>
   {" "}ยังไม่ได้เปิดช่องทางรับชำระหลักของระบบกลาง · ไม่มีการเปลี่ยนสถานะชำระเงิน
  </div>
  <div className="platform-collection-progress" data-platform-collection-progress>
   <strong><i className="bi bi-list-check" aria-hidden="true"/> ขั้นตอนก่อนเปิดใช้งาน</strong>
   <div className="platform-collection-progress-step">
    <i className={readiness?.receiverConfigured?"bi bi-check-circle-fill":"bi bi-circle"} aria-hidden="true"/>
    <span>ตั้งค่าบัญชีรับเงินกลาง {readiness?.receiverConfigured?"พร้อมสำหรับตรวจสอบ":"ยังไม่ยืนยัน"}</span>
    <Link to="/platform#platformReceiverSettings">ไปตั้งค่าบัญชี</Link>
   </div>
   <div className="platform-collection-progress-step">
    <i className="bi bi-circle" aria-hidden="true"/><span>ตรวจสอบการเชื่อมต่อ Stripe Sandbox/Webhook</span>
    <Link to="/platform#platformStripeSettings">ตรวจ Stripe</Link>
   </div>
   <div className="platform-collection-progress-step">
    <i className="bi bi-circle" aria-hidden="true"/><span>ทดสอบ LINE/LK Connect และความถูกต้องของยอดเงินจริง</span>
   </div>
   <div className="platform-collection-progress-step">
    <i className="bi bi-circle" aria-hidden="true"/><span>เปิดใช้งานหลังอนุมัติ Staging Provider UAT เท่านั้น</span>
   </div>
  </div>
  <div className="platform-collection-actions">
   <button className="btn" type="button" onClick={()=>void reload()} disabled={loading}>
    <i className="bi bi-arrow-clockwise" aria-hidden="true"/>{loading?"กำลังตรวจสอบ…":"ตรวจสอบอีกครั้ง"}
   </button>
   <button className="btn btn-primary" type="button" disabled aria-disabled="true">
    <i className="bi bi-shield-lock" aria-hidden="true"/> บันทึกช่องทางรับเงิน
   </button>
  </div>
 </section>;
}
