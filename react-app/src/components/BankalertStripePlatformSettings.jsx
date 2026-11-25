import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";
import { DynamicField } from "./DynamicField";
import { PlatformCardAccordionHeader } from "./PlatformCardAccordionHeader";
import "@/ui/bankalert-stripe-settings.css";

export function BankalertStripePlatformSettings(){
  const [expanded,setExpanded]=useState(false);
  const [info,setInfo]=useState(null);
  const [setup,setSetup]=useState(null);
  const [setupError,setSetupError]=useState("");
  const [secret,setSecret]=useState("");
  const [webhook,setWebhook]=useState("");
  const [notice,setNotice]=useState("");
  const savingRef=useRef(false);
  const setupRequestId=useRef(0);
  const reloadSetup=async()=>{
    const id=++setupRequestId.current;
    setSetupError("");setSetup(null);
    try{
      const {data}=await httpsCallable(functions,"getPlatformStripeWalletSetup")({});
      if(data?.ok!==true||data.storageReady!==true||data.firstSetupOnly!==true||
         typeof data.keyPresent!=="boolean"||typeof data.webhookPresent!=="boolean"||
         data.checkoutEnabled!==false)throw Error("SETUP_READ_INVALID");
      if(id===setupRequestId.current)setSetup(data);
      return data;
    }catch{
      if(id===setupRequestId.current)setSetupError("ระบบบันทึกคีย์บน Firebase ยังไม่พร้อม กรุณาตั้งค่าผ่าน Secret Manager หรือให้ผู้ดูแลเปิดสิทธิ์การบันทึก");
      return null;
    }
  };
  const save=async()=>{
    if(savingRef.current||busy||!setup?.storageReady||setup.checkoutEnabled!==false||
       (setup.keyPresent&&setup.webhookPresent))return;
    if((!setup.keyPresent&&!/^sk_test_[A-Za-z0-9_]{8,240}$/.test(secret))||
       (!setup.webhookPresent&&!/^whsec_[A-Za-z0-9_]{8,240}$/.test(webhook))){
      setSetupError("กรุณากรอก Stripe Test Secret Key และ Webhook Signing Secret ให้ถูกต้อง");return;
    }
    savingRef.current=true;setBusy(true);setSetupError("");setNotice("");
    try{
      const {data}=await httpsCallable(functions,"savePlatformStripeWalletSetup")({
        ...(!setup.keyPresent?{secretKey:secret}:{}),...(!setup.webhookPresent?{webhookSecret:webhook}:{})});
      setSecret("");setWebhook("");
      const confirmed=await reloadSetup();
      if(data?.ok!==true||!confirmed?.keyPresent||!confirmed?.webhookPresent)
        throw Error("STRIPE_SETUP_UNCONFIRMED");
      setNotice("บันทึกคีย์ทั้งสองใน Secret Manager แล้ว ยังต้องตรวจสอบการเชื่อมต่อและ Webhook ก่อนรับชำระ");
    }catch(e){
      setSecret("");setWebhook("");
      await reloadSetup();
      setSetupError(e?.message==="STRIPE_SETUP_RECENT_LOGIN_REQUIRED"?"กรุณาออกจากระบบและเข้าสู่ระบบใหม่ก่อนบันทึกคีย์":"ยังยืนยันการบันทึกไม่สำเร็จ กรุณาตรวจสถานะก่อนกรอกใหม่");
    }finally{savingRef.current=false;setBusy(false);}
  };
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const requestId=useRef(0);
  const refresh=async(verify=false)=>{
    const id=++requestId.current;
    setBusy(true);setError("");setInfo(null);
    try{
      const [{data},{data:gate}]=await Promise.all([httpsCallable(functions,"getPlatformStripeWalletSandboxStatus")({verify}),httpsCallable(functions,"getPlatformStripeWalletSandboxGate")({})]);
      if(data?.ok!==true || data.mode!=="test" || data.checkoutEnabled!==false)throw Error("STRIPE_STATUS_INVALID");
      if(gate?.ok!==true||gate.mode!=="test"||typeof gate.checkoutEnabled!=="boolean"||typeof gate.webhookReady!=="boolean")throw Error("STRIPE_GATE_INVALID");
      if(id===requestId.current)setInfo({...data,...gate});
    }catch{if(id===requestId.current)setError("ยังอ่านสถานะ Stripe จาก Firebase ไม่ได้ กรุณาตรวจสอบ Cloud Functions และ Secret Key ที่ Server ก่อนใช้งาน");}
    finally{if(id===requestId.current)setBusy(false);}
  };
  useEffect(()=>()=>{requestId.current++;setupRequestId.current++;},[]);
  const toggle=()=>{if(!expanded&&!busy){void reloadSetup();if(!info)void refresh(false);}else if(expanded){setSecret("");setWebhook("");}setExpanded(v=>!v);};
  const status=busy?"กำลังตรวจสอบ":setup?.storageReady&&(!setup.keyPresent||!setup.webhookPresent)?"ยังไม่ตั้งค่า":error?"อ่านสถานะไม่สำเร็จ":!info?"ยังไม่ได้ตรวจสอบ":!info.enabled?"ยังไม่เปิด Sandbox":info.verified&&info.promptPayEnabled?"ตรวจสอบบัญชีผ่าน":info.configured?"รอตรวจสอบบัญชี":"ยังไม่ตั้งค่า";
  const rows=[
    ["Stripe Test Key / บัญชีทดสอบ",info?.configured===true?"ตั้งค่าที่ Server แล้ว":"ยังไม่ยืนยัน",info?.configured],
    ["บัญชี Stripe Sandbox ประเทศไทย",info?.verified?"ตรวจสอบผ่าน":info?.providerChecked?"ไม่ผ่าน":"ยังไม่ตรวจสอบ",info?.verified],
    ["PromptPay ในบัญชี Stripe Sandbox",info?.promptPayEnabled?"เปิดใช้งานแล้ว":info?.providerChecked?"ยังไม่พร้อม":"ยังไม่ตรวจสอบ",info?.promptPayEnabled],
    ["Webhook Signing Secret",info?.webhookSecretConfigured?"ตั้งค่าแล้ว":"ยังไม่ยืนยัน",info?.webhookSecretConfigured],
    ["Webhook",info?.webhookReady?"ยืนยันแล้ว":"ยังไม่ยืนยัน",info?.webhookReady],
    ["Checkout Sandbox",info?.checkoutEnabled?"เปิดเฉพาะร้านทดสอบ":"ยังไม่เปิดใช้งาน",info?.checkoutEnabled],
  ];
  return <section className="card platform-google-api-card platform-card-collapsible bankalert-stripe-settings" data-bankalert-stripe-superadmin-settings data-expanded={expanded} aria-labelledby="walletStripeTitle">
    <PlatformCardAccordionHeader titleId="walletStripeTitle" panelId="walletStripePanel" icon="bi bi-qr-code" title="Stripe · การรับชำระเงินของระบบกลาง" description="รับค่าบริการ Platform ส่วนแบ่งรายวัน และเติมเครดิต Lalamove" badge={status} badgeClass="is-error" expanded={expanded} onToggle={toggle}/>
    <div id="walletStripePanel" className="platform-card-accordion-panel" hidden={!expanded}>
      <div className="bankalert-stripe-notice"><i className="bi bi-info-circle" aria-hidden="true"/><span>ระบบนี้แยกจากการรับชำระค่าอาหารของร้านค้า ขณะนี้ Firebase รองรับเฉพาะการทดสอบเติมเครดิต Lalamove ยังไม่เปิดรับค่าบริการหรือส่วนแบ่งเงินจริง</span></div>
      <div className="bankalert-stripe-alert bankalert-stripe-alert-warning" role="status"><i className="bi bi-shield-lock" aria-hidden="true"/><span>อนุญาต Checkout เฉพาะร้านทดสอบที่กำหนดไว้ หลังยืนยัน Webhook และเปิดสิทธิ์ที่ Server เท่านั้น</span></div>
      {info&&<div className="bankalert-stripe-checklist" data-stripe-checklist>{rows.map(([label,value,ok])=><div key={label}><i className={ok?"bi bi-check-circle":"bi bi-exclamation-circle"} aria-hidden="true"/><span>{label}</span><strong>{value}</strong></div>)}</div>}
      <div className="bankalert-stripe-form-grid">
        <div className="field platform-google-api-field">
          <DynamicField id="walletStripeSecret" label="Stripe Test Secret Key" value={secret}>
            <input id="walletStripeSecret" className="input" type="password" autoComplete="new-password" spellCheck={false}
              value={secret} onChange={event=>setSecret(event.target.value)} disabled={busy||!setup?.storageReady||setup.keyPresent} />
          </DynamicField>
          <small>{setup?.keyPresent?"มีคีย์ใน Secret Manager แล้ว · ไม่แสดงค่าจริง":"เฉพาะ Test Secret Key (sk_test_…)"}</small>
        </div>
        <div className="field platform-google-api-field">
          <DynamicField id="walletStripeHook" label="Stripe Webhook Signing Secret" value={webhook}>
            <input id="walletStripeHook" className="input" type="password" autoComplete="new-password" spellCheck={false}
              value={webhook} onChange={event=>setWebhook(event.target.value)} disabled={busy||!setup?.storageReady||setup.webhookPresent} />
          </DynamicField>
          <small>{setup?.webhookPresent?"มีคีย์ใน Secret Manager แล้ว · ไม่แสดงค่าจริง":"Webhook Signing Secret (whsec_…)"}</small>
        </div>
      </div>
      {setupError&&<div role="alert" className="bankalert-stripe-alert bankalert-stripe-alert-error">
        <span>{setupError} <a href="https://console.cloud.google.com/security/secret-manager?project=chat-45754" target="_blank" rel="noopener noreferrer">เปิด Secret Manager</a></span>
      </div>}
      {notice&&<div role="status" className="bankalert-stripe-alert bankalert-stripe-alert-success">{notice}</div>}
      {error&&<div role="alert" className="bankalert-stripe-alert bankalert-stripe-alert-error">{error}</div>}
      {info?.providerReadFailed&&<div role="alert" className="bankalert-stripe-alert bankalert-stripe-alert-error">ไม่สามารถตรวจสอบกับ Stripe ได้ กรุณาลองใหม่</div>}
      <div className="bankalert-stripe-actions">
        <button type="button" className="btn btn-sm" disabled={busy} onClick={()=>{void reloadSetup();void refresh(false);}}><i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรชสถานะ</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy||!setup?.storageReady||(setup.keyPresent&&setup.webhookPresent)||(!setup.keyPresent&&!secret)||(!setup.webhookPresent&&!webhook)} onClick={save}><i className="bi bi-floppy" aria-hidden="true"/> บันทึก Key</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy||!info?.configured} onClick={()=>refresh(true)}><i className="bi bi-shield-check" aria-hidden="true"/> ตรวจสอบบัญชี Stripe</button>
      </div>
    </div>
  </section>;
}
