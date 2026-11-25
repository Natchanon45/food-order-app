import {useCallback,useEffect,useRef,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import {DynamicField} from "./DynamicField";
import {sweetConfirm} from "./sweetDialog";
import "@/ui/payment-companion.css";
const money=cents=>new Intl.NumberFormat("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
const date=value=>{const d=new Date(value||"");return Number.isNaN(d.getTime())?"ยังไม่มีข้อมูล":new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",dateStyle:"medium",timeStyle:"short"}).format(d);};
const states={candidate:"พบยอดและเวลาที่อาจตรง",ambiguous:"พบหลายรายการ ต้องตรวจสอบ",no_match:"ยังไม่พบรายการตรง",unavailable:"ข้อมูลไม่ครบ ยังยืนยันไม่ได้"};
export function PaymentCompanionPairingCard({isOwner=false,SettingsGroup,notify=()=>{}}){
 const [data,setData]=useState(null),[error,setError]=useState(""),[label,setLabel]=useState("Android ร้านค้า"),[token,setToken]=useState(""),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false);
 const lock=useRef(false),revision=useRef(0);
 const reload=useCallback(async()=>{
  const id=++revision.current;
  try{
   const {data:result}=await httpsCallable(functions,"getPaymentCompanionDashboard")({});
   if(result?.paymentVerified!==false||result?.bankConfirmed!==false||result?.canReleaseKitchen!==false||!Array.isArray(result.devices)||!Array.isArray(result.items)||!Array.isArray(result.matches)||typeof result.enabled!=="boolean")throw Error("COMPANION_UNCONFIRMED");
   if(id===revision.current){setData(result);setError("");}
  }catch{if(id===revision.current){setData(null);setError("ไม่สามารถอ่านข้อมูลการเชื่อมต่อได้ กรุณารีเฟรช");}}
 },[]);
 useEffect(()=>{if(isOwner)void reload();return()=>{revision.current++;};},[isOwner,reload]);
 const run=async operation=>{
  if(lock.current)return;lock.current=true;setBusy(true);setError("");setToken("");setVisible(false);
  try{await operation();await reload();}
  catch{setError("ยังไม่ยืนยันผลการดำเนินการ กรุณาตรวจสอบสถานะล่าสุดก่อนลองใหม่");notify("ยังไม่ยืนยันผลการเชื่อมต่อ Android","error");await reload();}
  finally{lock.current=false;setBusy(false);}
 };
 const pair=async()=>{
  if(!data?.enabled||busy||!label.trim())return;
  if(!await sweetConfirm("รหัสนี้อนุญาตให้อุปกรณ์ส่งข้อมูลแจ้งเงินเข้าในนามร้าน จะแสดงเพียงครั้งเดียว",{title:"สร้างรหัสจับคู่อุปกรณ์ Android",confirmText:"สร้างรหัสจับคู่",cancelText:"กลับ",type:"warning"}))return;
  await run(async()=>{
   const {data:r}=await httpsCallable(functions,"pairPaymentCompanionDevice")({label:label.trim()});
   if(r?.showOnce!==true||!/^[a-f0-9]{64}$/.test(r.pairingToken||""))throw Error("PAIRING_UNCONFIRMED");
   setToken(r.pairingToken);notify("สร้างรหัสจับคู่แล้ว");
  });
 };
 const change=async(device,action)=>{
  if(busy)return;
  if(!await sweetConfirm(action==="revoke"?"ยกเลิกสิทธิ์อุปกรณ์นี้หรือไม่? รหัสเดิมจะไม่สามารถส่งข้อมูลได้":"ลบรหัสที่ยกเลิกแล้วออกจากรายการ โดยเก็บประวัติแจ้งเงินเข้าไว้",{title:action==="revoke"?"ยกเลิกการเชื่อมต่อ":"ลบคีย์ที่ยกเลิก",confirmText:"ยืนยัน",cancelText:"กลับ",danger:true,type:"warning"}))return;
  await run(async()=>{
   const {data:r}=await httpsCallable(functions,"changePaymentCompanionDevice")({deviceId:device.id,action});
   if(action==="revoke"?r?.revoked!==true:r?.archived!==true||r?.keyDeleted!==true)throw Error("CHANGE_UNCONFIRMED");
   notify(action==="revoke"?"ยกเลิกสิทธิ์แล้ว":"ลบคีย์แล้ว");
  });
 };
 const confirmReceiver=async enabled=>{
  if(busy||enabled&&(!data?.enabled||!data.receiver?.storePaymentReady))return;
  if(!await sweetConfirm(enabled?"ยืนยันว่าบัญชีธนาคารที่บันทึกไว้เป็นบัญชีรับเงินจริงของ PromptPay ร้านนี้หรือไม่? ใช้เพื่อประกอบการตรวจสอบเท่านั้น ไม่อนุมัติชำระหรือปล่อยครัว":"ปิดการจับคู่กับบัญชีรับเงินนี้หรือไม่?",{title:enabled?"ยืนยันบัญชีรับเงิน":"ปิดการผูกบัญชี",confirmText:enabled?"ยืนยันบัญชี":"ปิดใช้งาน",cancelText:"กลับ",type:"warning"}))return;
  await run(async()=>{
   const {bankCode,accountLast4,settingsRevision}=data.receiver;
   const {data:r}=await httpsCallable(functions,"setPaymentCompanionReceiver")({enabled,bankCode,accountLast4,settingsRevision});
   if(r?.saved!==true||r.receiver?.enabled!==enabled||r.paymentVerified!==false)throw Error("RECEIVER_UNCONFIRMED");
   notify(enabled?"ยืนยันบัญชีรับเงินแล้ว":"ปิดการผูกบัญชีแล้ว");
  });
 };
 const toggleAutoKitchen=async enabled=>{
  if(busy||!data?.autoKitchenAvailable||!recipient.enabled)return;
  const message=enabled?
    "คุณยืนยันว่าจะรับความเสี่ยงของร้านในการส่งคำสั่งซื้อเข้าครัวจากข้อมูลแจ้งเตือน Android/LINE ที่ยังไม่ได้รับรองจากธนาคารหรือไม่? ระบบจะจับคู่ยอด บัญชี และเวลาอย่างเข้มงวด คำสั่งซื้อยังไม่เป็น Paid และไม่เรียก Lalamove ก่อนตรวจรับเงินจริง การใช้งานนี้จำกัดเฉพาะ UAT":
    "ปิดการส่งคำสั่งซื้อเข้าครัวจาก BankAlert UAT หรือไม่?";
  if(!await sweetConfirm(message,{title:enabled?"ยินยอม BankAlert เข้าครัวเฉพาะ UAT":"ปิด BankAlert UAT",confirmText:enabled?"ยืนยันความเสี่ยงและเปิดทดสอบ":"ปิดใช้งาน",cancelText:"กลับ",type:"warning"}))return;
  await run(async()=>{
   const {data:r}=await httpsCallable(functions,"setCompanionAutoKitchenConsent")({enabled});
   if(r?.saved!==true||r?.enabled!==enabled||r.paymentVerified!==false||r.canSettleInvoice!==false)throw Error("AUTO_KITCHEN_UNCONFIRMED");
   notify(enabled?"เปิด BankAlert เข้าครัวเฉพาะ UAT แล้ว":"ปิด BankAlert เข้าครัวแล้ว");
  });
 };
 if(!isOwner||!SettingsGroup)return null;
 const active=data?.devices.filter(d=>d.enabled).length??0,recipient=data?.receiver||{};
 return <div id="paymentCompanionPilot" className="payment-companion-pilot" data-payment-companion-pilot>
 <SettingsGroup id="paymentCompanionSettingsGroup" icon="phone" title="รับแจ้งเงินเข้า Android" description="รับแจ้งเตือนจาก LINE หรือแอปธนาคาร เพื่อประกอบการตรวจสอบยอดเงิน" status={!data?"ยังไม่ยืนยัน":data.enabled?active+" อุปกรณ์":"ยังไม่เปิดใช้"} statusTone={data?.enabled?"ready":"neutral"}>
  <div className="payment-companion-body">
   <div className="payment-companion-intro"><span className="payment-companion-intro-icon"><i className="bi bi-shield-check" aria-hidden="true"/></span><div><strong>เชื่อมอุปกรณ์รับแจ้งเงินเข้า</strong><p>ใช้ข้อมูลแจ้งเตือนยอดและเวลาเพื่อเสนอรายการที่อาจตรงกันเท่านั้น ไม่ใช่หลักฐานที่ธนาคารรับรอง ไม่เปลี่ยนสถานะ Paid และไม่ปล่อยครัวอัตโนมัติ</p></div><span className="payment-companion-pilot-tag">ทดสอบ</span></div>
   {error&&<div role="alert" className="payment-companion-error">{error}</div>}
   <button className="btn btn-sm payment-companion-refresh" type="button" disabled={busy} onClick={reload}><i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรชข้อมูล</button>
   {!data?<div className="payment-companion-empty" role="status">ยังไม่ยืนยันข้อมูลจากระบบ</div>:<>
   {!data.enabled&&<div className="payment-companion-empty" role="status">ยังไม่เปิดรับข้อมูล BankAlert สำหรับร้านนี้</div>}
   {/* Source now displays activity/metrics separately in the owner-only
        PaymentCompanionObserverCard. Setup retains device/receiver actions. */}
   <section className="payment-companion-panel"><div className="payment-companion-section-heading"><div className="payment-companion-section-title"><i className="bi bi-phone" aria-hidden="true"/><div><strong>อุปกรณ์ที่เชื่อมต่อ</strong><small>สูงสุด 3 อุปกรณ์ที่เปิดใช้งาน</small></div></div></div>
    <div className="payment-companion-form"><div className="payment-companion-form-controls"><DynamicField id="paymentCompanionLabel" label="ชื่ออุปกรณ์" value={label}><input id="paymentCompanionLabel" className="input" value={label} maxLength={100} onChange={e=>setLabel(e.target.value)} disabled={busy||!data.enabled}/></DynamicField><button className="btn btn-primary payment-companion-primary-button" type="button" disabled={busy||!data.enabled||active>=3||!label.trim()} onClick={pair}><i className="bi bi-key" aria-hidden="true"/> สร้างรหัสจับคู่</button></div></div>
    {token&&<div className="payment-companion-token"><strong>รหัสจับคู่ (แสดงครั้งเดียว)</strong><small>Server: https://penguin-food.web.app</small><div className="payment-companion-token-controls"><input className="input" aria-label="รหัสจับคู่" readOnly type={visible?"text":"password"} value={token}/><button className="btn btn-sm" type="button" onClick={()=>setVisible(v=>!v)}>{visible?"ซ่อน":"แสดง"}</button><button className="btn btn-sm" type="button" onClick={async()=>{try{await navigator.clipboard.writeText(token);notify("คัดลอกรหัสแล้ว");}catch{notify("คัดลอกไม่สำเร็จ","error");}}}>คัดลอก</button><button className="btn btn-sm" type="button" onClick={()=>{setToken("");setVisible(false);}}>ปิด</button></div></div>}
    <p className="payment-companion-footnote">ยังไม่มี APK เฉพาะ PENGUIN ที่ผ่าน UAT และยังไม่เปิดรับข้อความดิบที่อาจมีข้อมูลส่วนตัว</p>
    {data.devices.length?<ul className="payment-companion-device-list">{data.devices.map(d=><li key={d.id} className="payment-companion-device"><span className="payment-companion-device-icon"><i className="bi bi-phone" aria-hidden="true"/></span><div className="payment-companion-device-info"><strong>{d.label}</strong><small>รับข้อมูลล่าสุด: {date(d.lastSeenUTC)}</small></div><span className={"payment-companion-device-state "+(d.enabled?"is-active":"")}>{d.enabled?"เปิดสิทธิ์":"ยกเลิกแล้ว"}</span><button className="btn btn-sm payment-companion-revoke" disabled={busy} type="button" onClick={()=>change(d,d.enabled?"revoke":"archive")}>{d.enabled?"ยกเลิกสิทธิ์":"ลบคีย์"}</button></li>)}</ul>:<div className="payment-companion-empty">ยังไม่มีอุปกรณ์</div>}
   </section>
   <section className="payment-companion-panel"><div className="payment-companion-section-title"><i className="bi bi-intersect" aria-hidden="true"/><div><strong>รายการที่อาจตรงกับคำสั่งซื้อ</strong><small>ยอดตรง บัญชีเลขท้ายตรง และโอนก่อนสร้างออเดอร์ภายใน 15 นาที</small></div></div><p className="payment-companion-footnote">บัญชีที่ร้านบันทึกไว้: {recipient.bankName||"ยังไม่ตั้งค่า"} {recipient.accountLast4?"•••• "+recipient.accountLast4:""} · PromptPay {recipient.promptPayLast4?"•••• "+recipient.promptPayLast4:"ยังไม่ตั้งค่า"} · เลขท้ายสองบัญชีไม่จำเป็นต้องตรงกัน</p>
    <div className="payment-companion-receiver-confirmation">
     <strong>{recipient.requiresReconfirmation?"ข้อมูลการตั้งค่าร้านเปลี่ยนแล้ว ต้องยืนยันใหม่":recipient.enabled?"ยืนยันบัญชีรับเงินแล้ว":"ยังไม่ยืนยันบัญชีรับเงิน"}</strong>
     <small>ใช้ข้อมูลจากการตั้งค่าร้าน ไม่ต้องกรอกบัญชีซ้ำ เมื่อมีการบันทึกข้อมูลร้านใหม่ ต้องยืนยันอีกครั้งเพื่อไม่ให้ใช้ข้อมูลเก่า</small>
     <div className="payment-companion-receiver-buttons">
      {!recipient.enabled&&<button type="button" className="btn btn-primary btn-sm" disabled={busy||!data.enabled||!recipient.storePaymentReady} onClick={()=>confirmReceiver(true)}><i className="bi bi-shield-check" aria-hidden="true"/> ยืนยันบัญชีรับเงิน</button>}
      {recipient.linked&&<button type="button" className="btn btn-sm" disabled={busy} onClick={()=>confirmReceiver(false)}><i className="bi bi-pause-circle" aria-hidden="true"/> ปิดการผูกบัญชี</button>}
     </div>
    </div>
    {data.autoKitchenAvailable&&recipient.enabled&&<div className="payment-companion-receiver-confirmation">
      <strong>การส่งเข้าครัวจาก BankAlert · UAT เท่านั้น</strong>
      <small>ข้อมูลแจ้งเงินเข้าไม่ได้รับรองโดยธนาคาร อาจมีความผิดพลาด ร้านต้องยอมรับความเสี่ยงอย่างชัดเจน ออเดอร์ยังไม่ใช่ Paid และไม่เรียก Lalamove จนกว่าจะตรวจรับเงินจริง</small>
      <div className="payment-companion-receiver-buttons">
        <button type="button" className={"btn btn-sm "+(data.autoKitchenEnabled?"btn-warning":"btn-primary")} disabled={busy} onClick={()=>toggleAutoKitchen(!data.autoKitchenEnabled)}>
          <i className={"bi bi-"+(data.autoKitchenEnabled?"pause-circle":"shield-exclamation")} aria-hidden="true"/>
          {data.autoKitchenEnabled?"ปิดการส่งเข้าครัว UAT":"ยอมรับความเสี่ยงและเปิดเฉพาะ UAT"}
        </button>
      </div>
    </div>}
    {data.matchStatus!=="advisory"||!recipient.storePaymentReady?<div className="payment-companion-empty">ยังยืนยันข้อมูลสำหรับเสนอการจับคู่ไม่ได้</div>:data.matches.length?<ul className="payment-companion-notice-list">{data.matches.map(m=><li key={m.orderId} className="payment-companion-notice"><div className="payment-companion-notice-info"><strong>{money(m.amountSatang)} บาท</strong><small>ออเดอร์ {m.orderId}</small><small>{date(m.orderTimeUTC)} · {m.hasSlip?"มีสลิป":"ยังไม่มีสลิป"}</small></div><span className="payment-companion-unverified">{states[m.status]||"ยังไม่ยืนยัน"}</span></li>)}</ul>:<div className="payment-companion-empty">ไม่พบออเดอร์ PromptPay ที่รอตรวจสอบในช่วงล่าสุด</div>}
    <p className="payment-companion-footnote">แคชเชียร์บันทึกการตรวจเบื้องต้นได้ แต่การอนุมัติชำระยังใช้ขั้นตอน Superadmin เดิม ระบบยังไม่อนุมัติการชำระหรือปล่อยครัวจากข้อมูลนี้</p>
   </section>
   </>}
  </div>
 </SettingsGroup></div>;
}
