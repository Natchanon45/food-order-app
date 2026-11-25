import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {PlatformCompanionPairing} from "./PlatformCompanionPairing";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
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
 const [choice,setChoice]=useState("bank_transfer");
 const [error,setError]=useState("");
 const reload=async()=>{
  setLoading(true);setError("");setReadiness(null);
  try{
   const [receiver,stripe]=await Promise.allSettled([
    loadPlatformReceiptReceiver(),
    httpsCallable(functions,"getPlatformStripeWalletSetup")({})
   ]);
   const item=receiver.status==="fulfilled"?receiver.value:null;
   const stripeStatus=stripe.status==="fulfilled"?stripe.value?.data:null;
   const stripeKnown=stripeStatus?.ok===true&&stripeStatus.storageReady===true&&stripeStatus.checkoutEnabled===false&&
     typeof stripeStatus.keyPresent==="boolean"&&typeof stripeStatus.webhookPresent==="boolean";
   setReadiness({
    receiverConfigured:item?.configured===true,
    receiverKnown:receiver.status==="fulfilled",
    stripeKnown,
    stripeKeysConfigured:stripeKnown&&stripeStatus.configured===true,
    stripeKeyPresent:stripeKnown&&stripeStatus.keyPresent,
    stripeWebhookPresent:stripeKnown&&stripeStatus.webhookPresent,
    revision:item?.revision,
    paymentRoutingEnabled:false,
   });
   if(!item||!stripeKnown)setError("ยังอ่านสถานะการตั้งค่าบางส่วนไม่ได้ กรุณาตรวจสอบอีกครั้ง");
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
   <i className="bi bi-shield-lock" aria-hidden="true"/> เลือกช่องทางเพื่อดูขั้นตอนตั้งค่าได้ แต่ยังไม่เปลี่ยนช่องทางรับเงินจริงจนกว่าการเชื่อมต่อและการตรวจสอบยอดจะพร้อม
  </p>
  {error&&<p role="alert" className="platform-collection-warning">{error}</p>}
  <div className="platform-collection-choices" role="radiogroup" aria-label="ดูการตั้งค่าช่องทางรับเงิน (ยังไม่บันทึก)">
   {methods.map(method=><label className={"platform-collection-choice"+(choice===method.value?" is-selected":"")} key={method.value}>
    <input type="radio" name="platformCollectionMethod" value={method.value}
      checked={choice===method.value} onChange={()=>setChoice(method.value)} disabled={loading}/>
    <span className="platform-collection-choice-icon"><i className={"bi "+method.icon} aria-hidden="true"/></span>
    <span className="platform-collection-choice-text"><strong>{method.title}</strong><small>{method.detail}</small></span>
   </label>)}
  </div>
  <div className="platform-collection-status" role="status">
   <i className="bi bi-info-circle" aria-hidden="true"/>
   {" "}ยังไม่ได้เปิดช่องทางรับชำระหลักของระบบกลาง · ไม่มีการเปลี่ยนสถานะชำระเงิน
  </div>
  {choice==="bank_transfer"?<div className="platform-collection-setup" data-collection-bank-setup>
    <strong><i className="bi bi-bank" aria-hidden="true"/> ตั้งค่ารับโอนเงินส่วนกลาง</strong>
    <p>ใช้บัญชีรับเงินส่วนกลางที่ตั้งไว้สำหรับตรวจสอบยอด โดยยังไม่อนุมัติ Invoice หรือเติมเครดิตจากข้อความแจ้งเตือน</p>
    <Link className="btn btn-sm" to="/platform#platformReceiverSettings"><i className="bi bi-bank" aria-hidden="true"/> ตั้งค่าบัญชีผู้รับ</Link>
    <PlatformCompanionPairing />
  </div>:<div className="platform-collection-setup" data-collection-stripe-setup>
    <strong><i className="bi bi-credit-card" aria-hidden="true"/> Stripe สำหรับระบบกลาง</strong>
    <p>{!readiness?.stripeKnown?"ยังอ่านสถานะคีย์ไม่ได้":readiness.stripeKeysConfigured?"บันทึกคีย์ครบแล้ว · ยังต้องตรวจสอบการเชื่อมต่อและ Webhook":"ยังบันทึกคีย์ไม่ครบ · กรุณาตั้งค่าที่ระบบกลาง"}</p>
    <Link className="btn btn-sm" to="/platform#platformStripeSettings"><i className="bi bi-gear" aria-hidden="true"/> ตั้งค่า Stripe</Link>
  </div>}
  <div className="platform-collection-progress" data-platform-collection-progress>
   <strong><i className="bi bi-list-check" aria-hidden="true"/> ขั้นตอนก่อนเปิดใช้งาน</strong>
   <div className="platform-collection-progress-step">
    <i className={readiness?.receiverConfigured?"bi bi-check-circle-fill":"bi bi-circle"} aria-hidden="true"/>
    <span>ตั้งค่าบัญชีรับเงินกลาง {readiness?.receiverConfigured?"พร้อมสำหรับตรวจสอบ":"ยังไม่ยืนยัน"}</span>
    <Link to="/platform#platformReceiverSettings">ไปตั้งค่าบัญชี</Link>
   </div>
   <div className="platform-collection-progress-step">
    <i className="bi bi-circle" aria-hidden="true"/><span>{readiness?.stripeKeysConfigured?"ตั้งค่าคีย์ Stripe ครบ · รอตรวจสอบ Webhook":"ตั้งค่าคีย์และตรวจสอบ Stripe/Webhook"}</span>
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
