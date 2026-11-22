import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import {DynamicField} from "./DynamicField";
import {sweetConfirm} from "./sweetDialog";
import {groupCompanionObservations} from "@/utils/companionObservationGrouping.mjs";
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
 const groups=useMemo(()=>groupCompanionObservations(data?.items),[data]);
 if(!isOwner||!SettingsGroup)return null;
 const active=data?.devices.filter(d=>d.enabled).length??0,recipient=data?.receiver||{};
 const metrics=[["แจ้งเตือนที่บันทึก",data?.items.length,"bell","green"],["กลุ่มสำหรับตรวจสอบ",groups.length,"collection","blue"],["กลุ่มที่อาจซ้ำ",groups.filter(g=>g.possibleDuplicate).length,"exclamation-triangle","amber"],["อุปกรณ์ที่เปิดใช้งาน",active+"/3","phone","violet"]];
 return <div id="paymentCompanionPilot" className="payment-companion-pilot" data-payment-companion-pilot>
 <SettingsGroup id="paymentCompanionSettingsGroup" icon="phone" title="รับแจ้งเงินเข้า Android" description="รับแจ้งเตือนจาก LINE หรือแอปธนาคาร เพื่อประกอบการตรวจสอบยอดเงิน" status={!data?"ยังไม่ยืนยัน":data.enabled?active+" อุปกรณ์":"ยังไม่เปิดใช้"} statusTone={data?.enabled?"ready":"neutral"}>
  <div className="payment-companion-body">
   <div className="payment-companion-intro"><span className="payment-companion-intro-icon"><i className="bi bi-shield-check" aria-hidden="true"/></span><div><strong>เชื่อมอุปกรณ์รับแจ้งเงินเข้า</strong><p>ใช้ข้อมูลแจ้งเตือนยอดและเวลาเพื่อเสนอรายการที่อาจตรงกันเท่านั้น ไม่ใช่หลักฐานที่ธนาคารรับรอง ไม่เปลี่ยนสถานะ Paid และไม่ปล่อยครัวอัตโนมัติ</p></div><span className="payment-companion-pilot-tag">ทดสอบ</span></div>
   {error&&<div role="alert" className="payment-companion-error">{error}</div>}
   <button className="btn btn-sm payment-companion-refresh" type="button" disabled={busy} onClick={reload}><i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรชข้อมูล</button>
   {!data?<div className="payment-companion-empty" role="status">ยังไม่ยืนยันข้อมูลจากระบบ</div>:<>
   {!data.enabled&&<div className="payment-companion-empty" role="status">ยังไม่เปิดรับข้อมูล BankAlert สำหรับร้านนี้</div>}
   <div className="payment-companion-overview"><div className="payment-companion-overview-hero"><div className="payment-companion-overview-heading"><span className="payment-companion-overview-hero-icon"><i className="bi bi-activity" aria-hidden="true"/></span><div><span className="payment-companion-overline">PAYMENT OBSERVER · ANDROID</span><h3>ภาพรวมการแจ้งเงินเข้า</h3><p>ข้อมูลล่าสุดสำหรับประกอบการตรวจสอบของร้านค้า</p></div></div></div><div className="payment-companion-metrics">{metrics.map(([name,value,icon,tone])=><div key={name} className={"payment-companion-metric is-"+tone}><span className="payment-companion-metric-icon"><i className={"bi bi-"+icon} aria-hidden="true"/></span><span className="payment-companion-metric-label">{name}</span><strong className="payment-companion-metric-number">{value}</strong><small className="payment-companion-metric-hint">ข้อมูลแจ้งเตือน ไม่ใช่ยอดรับเงินจริง</small></div>)}</div></div>
   <section className="payment-companion-panel"><div className="payment-companion-section-heading"><div className="payment-companion-section-title"><i className="bi bi-phone" aria-hidden="true"/><div><strong>อุปกรณ์ที่เชื่อมต่อ</strong><small>สูงสุด 3 อุปกรณ์ที่เปิดใช้งาน</small></div></div></div>
    <div className="payment-companion-form"><div className="payment-companion-form-controls"><DynamicField id="paymentCompanionLabel" label="ชื่ออุปกรณ์" value={label}><input id="paymentCompanionLabel" className="input" value={label} maxLength={100} onChange={e=>setLabel(e.target.value)} disabled={busy||!data.enabled}/></DynamicField><button className="btn btn-primary payment-companion-primary-button" type="button" disabled={busy||!data.enabled||active>=3||!label.trim()} onClick={pair}><i className="bi bi-key" aria-hidden="true"/> สร้างรหัสจับคู่</button></div></div>
    {token&&<div className="payment-companion-token"><strong>รหัสจับคู่ (แสดงครั้งเดียว)</strong><small>Server: https://penguin-food.web.app</small><div className="payment-companion-token-controls"><input className="input" aria-label="รหัสจับคู่" readOnly type={visible?"text":"password"} value={token}/><button className="btn btn-sm" type="button" onClick={()=>setVisible(v=>!v)}>{visible?"ซ่อน":"แสดง"}</button><button className="btn btn-sm" type="button" onClick={async()=>{try{await navigator.clipboard.writeText(token);notify("คัดลอกรหัสแล้ว");}catch{notify("คัดลอกไม่สำเร็จ","error");}}}>คัดลอก</button><button className="btn btn-sm" type="button" onClick={()=>{setToken("");setVisible(false);}}>ปิด</button></div></div>}
    <p className="payment-companion-footnote">ยังไม่มี APK เฉพาะ PENGUIN ที่ผ่าน UAT และยังไม่เปิดรับข้อความดิบที่อาจมีข้อมูลส่วนตัว</p>
    {data.devices.length?<ul className="payment-companion-device-list">{data.devices.map(d=><li key={d.id} className="payment-companion-device"><span className="payment-companion-device-icon"><i className="bi bi-phone" aria-hidden="true"/></span><div className="payment-companion-device-info"><strong>{d.label}</strong><small>รับข้อมูลล่าสุด: {date(d.lastSeenUTC)}</small></div><span className={"payment-companion-device-state "+(d.enabled?"is-active":"")}>{d.enabled?"เปิดสิทธิ์":"ยกเลิกแล้ว"}</span><button className="btn btn-sm payment-companion-revoke" disabled={busy} type="button" onClick={()=>change(d,d.enabled?"revoke":"archive")}>{d.enabled?"ยกเลิกสิทธิ์":"ลบคีย์"}</button></li>)}</ul>:<div className="payment-companion-empty">ยังไม่มีอุปกรณ์</div>}
   </section>
   <section className="payment-companion-panel payment-companion-activity"><div className="payment-companion-section-heading"><div className="payment-companion-section-title"><i className="bi bi-clock-history" aria-hidden="true"/><div><strong>ประวัติแจ้งเงินเข้า</strong><small>แสดงข้อมูลล่าสุด 50 รายการ</small></div></div></div>
    {groups.length?<ul className="payment-companion-notice-list">{groups.map(g=><li key={g.id} className={"payment-companion-notice"+(g.possibleDuplicate?" is-duplicate":"")}><div className="payment-companion-history-amount"><span className="payment-companion-notice-icon"><i className="bi bi-arrow-down-left" aria-hidden="true"/></span><div className="payment-companion-notice-info"><strong>+{money(g.amountSatang)} บาท</strong><small>{date(g.receivedUTC)}</small></div></div><div className="payment-companion-history-data"><small>เวลาแจ้งเงินเข้า</small><strong>{date(g.bankTimeUTC)}</strong></div><div className="payment-companion-history-data"><strong>{g.deviceLabel}</strong><small>{g.receiverSuffix}</small></div><div className="payment-companion-history-state"><span className="payment-companion-unverified">{g.possibleDuplicate?"อาจเป็นรายการซ้ำ":"รอตรวจสอบ"}</span>{g.possibleDuplicate&&<small>{g.notificationCount} ข้อความ</small>}</div></li>)}</ul>:<div className="payment-companion-empty">ยังไม่มีรายการแจ้งเงินเข้า</div>}
   </section>
   <section className="payment-companion-panel"><div className="payment-companion-section-title"><i className="bi bi-intersect" aria-hidden="true"/><div><strong>รายการที่อาจตรงกับคำสั่งซื้อ</strong><small>ยอดตรง บัญชีเลขท้ายตรง และโอนก่อนสร้างออเดอร์ภายใน 15 นาที</small></div></div><p className="payment-companion-footnote">บัญชีที่ร้านบันทึกไว้: {recipient.bankName||"ยังไม่ตั้งค่า"} {recipient.accountLast4?"•••• "+recipient.accountLast4:""} · PromptPay {recipient.promptPayLast4?"•••• "+recipient.promptPayLast4:"ยังไม่ตั้งค่า"} · เลขท้ายสองบัญชีไม่จำเป็นต้องตรงกัน</p>
    {data.matchStatus!=="advisory"||!recipient.storePaymentReady?<div className="payment-companion-empty">ยังยืนยันข้อมูลสำหรับเสนอการจับคู่ไม่ได้</div>:data.matches.length?<ul className="payment-companion-notice-list">{data.matches.map(m=><li key={m.orderId} className="payment-companion-notice"><div className="payment-companion-notice-info"><strong>{money(m.amountSatang)} บาท</strong><small>ออเดอร์ {m.orderId}</small><small>{date(m.orderTimeUTC)} · {m.hasSlip?"มีสลิป":"ยังไม่มีสลิป"}</small></div><span className="payment-companion-unverified">{states[m.status]||"ยังไม่ยืนยัน"}</span></li>)}</ul>:<div className="payment-companion-empty">ไม่พบออเดอร์ PromptPay ที่รอตรวจสอบในช่วงล่าสุด</div>}
    <p className="payment-companion-footnote">ตรวจหลักฐานและใช้ขั้นตอนยืนยันของแคชเชียร์เดิมทุกกรณี ระบบยังไม่อนุมัติการชำระหรือปล่อยครัวจากข้อมูลนี้</p>
   </section>
   </>}
  </div>
 </SettingsGroup></div>;
}
