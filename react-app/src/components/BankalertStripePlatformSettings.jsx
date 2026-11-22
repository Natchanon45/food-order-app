import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";
import { PlatformCardAccordionHeader } from "./PlatformCardAccordionHeader";
import "@/ui/bankalert-stripe-settings.css";

export function BankalertStripePlatformSettings(){
  const [expanded,setExpanded]=useState(false);
  const [info,setInfo]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const requestId=useRef(0);
  const refresh=async(verify=false)=>{
    const id=++requestId.current;
    setBusy(true);setError("");setInfo(null);
    try{
      const {data}=await httpsCallable(functions,"getPlatformStripeWalletSandboxStatus")({verify});
      if(data?.ok!==true || data.mode!=="test" || data.checkoutEnabled!==false)throw Error("STRIPE_STATUS_INVALID");
      if(id===requestId.current)setInfo(data);
    }catch{if(id===requestId.current)setError("ไม่สามารถอ่านสถานะ Stripe Sandbox จาก Firebase ได้");}
    finally{if(id===requestId.current)setBusy(false);}
  };
  useEffect(()=>()=>{requestId.current++;},[]);
  const toggle=()=>{if(!expanded&&!busy&&!info)void refresh(false);setExpanded(v=>!v);};
  const status=busy?"กำลังตรวจสอบ":error?"อ่านสถานะไม่สำเร็จ":!info?"ยังไม่ได้ตรวจสอบ":!info.enabled?"ยังไม่เปิด Sandbox":info.verified&&info.promptPayEnabled?"ตรวจสอบบัญชีผ่าน":info.configured?"รอตรวจสอบบัญชี":"ยังไม่ตั้งค่า";
  const rows=[
    ["Stripe Test Key / บัญชีทดสอบ",info?.configured===true?"ตั้งค่าที่ Server แล้ว":"ยังไม่ยืนยัน",info?.configured],
    ["บัญชี Stripe Sandbox ประเทศไทย",info?.verified?"ตรวจสอบผ่าน":info?.providerChecked?"ไม่ผ่าน":"ยังไม่ตรวจสอบ",info?.verified],
    ["PromptPay ในบัญชี Stripe Sandbox",info?.promptPayEnabled?"เปิดใช้งานแล้ว":info?.providerChecked?"ยังไม่พร้อม":"ยังไม่ตรวจสอบ",info?.promptPayEnabled],
    ["Webhook Signing Secret",info?.webhookSecretConfigured?"ตั้งค่าแล้ว":"ยังไม่ยืนยัน",info?.webhookSecretConfigured],
    ["Webhook และการสร้าง Checkout","ยังไม่เปิดใช้งาน",false],
  ];
  return <section className="card platform-google-api-card platform-card-collapsible bankalert-stripe-settings" data-bankalert-stripe-superadmin-settings data-expanded={expanded} aria-labelledby="walletStripeTitle">
    <PlatformCardAccordionHeader titleId="walletStripeTitle" panelId="walletStripePanel" icon="bi bi-qr-code" title="Stripe PromptPay — Lalamove Wallet Test Mode" description="Firebase Sandbox · จัดการ Secret Key ที่ Server" badge={status} badgeClass="is-error" expanded={expanded} onToggle={toggle}/>
    <div id="walletStripePanel" className="platform-card-accordion-panel" hidden={!expanded}>
      <div className="bankalert-stripe-notice"><i className="bi bi-info-circle" aria-hidden="true"/><span>ทดสอบการเติมเครดิต Lalamove แยกจาก Stripe Connect สำหรับค่าอาหาร Delivery ไม่เพิ่มเครดิตจริงของร้านค้า</span></div>
      <div className="bankalert-stripe-alert bankalert-stripe-alert-warning" role="status"><i className="bi bi-shield-lock" aria-hidden="true"/><span>ยังไม่เปิดสร้าง QR หรือรับชำระเงิน จนกว่าระบบตรวจสอบ Webhook และบัญชีเครดิต Sandbox จะผ่านการทดสอบ</span></div>
      {info&&<div className="bankalert-stripe-checklist" data-stripe-checklist>{rows.map(([label,value,ok])=><div key={label}><i className={ok?"bi bi-check-circle":"bi bi-exclamation-circle"} aria-hidden="true"/><span>{label}</span><strong>{value}</strong></div>)}</div>}
      {error&&<div role="alert" className="bankalert-stripe-alert bankalert-stripe-alert-error">{error}</div>}
      {info?.providerReadFailed&&<div role="alert" className="bankalert-stripe-alert bankalert-stripe-alert-error">ไม่สามารถตรวจสอบกับ Stripe ได้ กรุณาลองใหม่</div>}
      <div className="bankalert-stripe-actions">
        <button type="button" className="btn btn-sm" disabled={busy} onClick={()=>refresh(false)}><i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรชสถานะ</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy||!info?.configured} onClick={()=>refresh(true)}><i className="bi bi-shield-check" aria-hidden="true"/> ตรวจสอบบัญชี Stripe</button>
      </div>
    </div>
  </section>;
}
