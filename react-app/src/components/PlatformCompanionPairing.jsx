import {DynamicField} from "./DynamicField";
import "@/ui/platform-collection.css";
import {useCallback,useEffect,useState} from "react";
import {qrDataUrl} from "@/utils/localQr";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
const call=(name,data={})=>httpsCallable(functions,name)(data).then(r=>r.data);
const valid=(r,scope)=>r?.ok===true&&r.scope===scope&&r.mode==="pairing_only"&&r.notificationEnabled===false&&r.paymentRoutingEnabled===false&&r.paymentVerified===false;
import {sweetConfirm} from "./sweetDialog";

export function PlatformCompanionPairing({onDevicesChange,scope="platform",promptPayLast4=""}){
 const merchant=scope==="tenant",scopeLabel=merchant?"ร้านค้า":"ส่วนกลาง";
 const scopedCall=(name,data={})=>call(name,{...data,scope});
 const [devices,setDevices]=useState([]);
 const [receiver,setReceiver]=useState(null);

 const [apk,setApk]=useState(null);
 const [expiresAt,setExpiresAt]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [label,setLabel]=useState("PG Connect "+scopeLabel);
 const [token,setToken]=useState("");
 const [issuedDeviceId,setIssuedDeviceId]=useState("");
 const [revokeStatus,setRevokeStatus]=useState("");
 const [showToken,setShowToken]=useState(false);
 const [error,setError]=useState("");
 const [copyStatus,setCopyStatus]=useState("");
 const [ready,setReady]=useState(false);
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{
   const data=await scopedCall("getPlatformConnectPairing");
   if(!valid(data,scope)||!Array.isArray(data.devices)||data.devices.length>3||
      data.devices.some(d=>typeof d.id!=="string"||typeof d.label!=="string"||typeof d.connected!=="boolean"))throw Error("INVALID_PAIRING_RESPONSE");
   setDevices(data.devices);
   setReceiver(data.receiver||null);
   onDevicesChange?.(data.devices.filter(d=>d.connected).length);
   setReady(true);setError("");
   return data.devices;
  }catch{
   setReady(false);
   setError("ยังไม่สามารถอ่านสถานะ PG Connect ได้ กรุณาตรวจสอบการตั้งค่า Backend");
  }finally{setLoading(false);}
 },[onDevicesChange,scope]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{async function loadApk(){
   // A published APK requires an actual versioned release manifest, never a guessed URL.
   try{
    const response=await fetch("/downloads/pg-connect.json",{cache:"no-store"});
    const manifest=await response.json();
    setApk(response.ok&&manifest?.mode==="pairing_only"&&/^\/downloads\/PG_Connect_V\d+\.\d+\.\d+_\d{4}\.apk$/.test(manifest.path)&&/^[a-f0-9]{64}$/.test(manifest.sha256)?manifest:null);
   }catch{setApk(null);}
 }void loadApk();},[]);
 useEffect(()=>{
  if(!token||!expiresAt)return undefined;
  const remaining=Date.parse(expiresAt)-Date.now();
  if(remaining<=0){setToken("");setIssuedDeviceId("");return undefined;}
  const timer=setTimeout(()=>{setToken("");setIssuedDeviceId("");},remaining);
  return()=>clearTimeout(timer);
 },[token,expiresAt]);
 useEffect(()=>{
  if(issuedDeviceId&&ready&&!devices.some(d=>d.id===issuedDeviceId&&d.enabled)){setToken("");setIssuedDeviceId("");setShowToken(false);setCopyStatus("");}
 },[devices,issuedDeviceId,ready]);
 const pair=async()=>{
  if(!ready||busy||loading||!label.trim()||devices.filter(d=>d.enabled).length>=3)return;
  const ok=await sweetConfirm("คีย์นี้ใช้ตรวจสอบการเชื่อมต่อตามขอบเขตที่เลือกเท่านั้น มีอายุ 24 ชั่วโมง แสดงเพียงครั้งเดียวและไม่อนุญาตรับส่งแจ้งเงินเข้า",{
   title:"สร้างคีย์ PG Connect",confirmText:"สร้างคีย์",confirmIcon:"key",cancelText:"กลับ",type:"warning"});
  if(!ok)return;
  setBusy(true);setError("");setRevokeStatus("");setToken("");setIssuedDeviceId("");
  try{
   const data=await scopedCall("createPlatformConnectPairing",{label:label.trim()});
   if(!/^[a-f0-9]{64}$/.test(data?.pairingToken||"")||!valid(data,scope)||data.showOnce!==true||!Number.isFinite(Date.parse(data.expiresAt)))throw Error("PLATFORM_COMPANION_PAIR_RESPONSE_INVALID");
   await refresh();setExpiresAt(data.expiresAt);setToken(data.pairingToken);setIssuedDeviceId(data.deviceId||"");setShowToken(false);setCopyStatus("");
  }catch{setError("สร้างคีย์ไม่สำเร็จหรือยังยืนยันผลไม่ได้ กรุณารีเฟรชตรวจรายชื่ออุปกรณ์ก่อนสร้างใหม่");}
  finally{setBusy(false);}
 };
 const revoke=async device=>{
  if(busy||loading)return;
  const ok=await sweetConfirm("ยกเลิกการจับคู่ "+device.label+"? คีย์นี้จะตรวจสอบการเชื่อมต่อไม่ได้อีก",{
   title:"ยกเลิก PG Connect",type:"warning",confirmText:"ยกเลิกคีย์",confirmIcon:"link-45deg",cancelText:"กลับ"});
  if(!ok)return;
  setBusy(true);setError("");setRevokeStatus("");
  try{
   const data=await scopedCall("revokePlatformConnectPairing",{deviceId:device.id});
   if(data?.revoked!==true||data?.keyDeleted!==true||data?.deviceId!==device.id)throw Error("REVOCATION_UNCONFIRMED");
   if(issuedDeviceId===device.id){setToken("");setIssuedDeviceId("");setShowToken(false);setCopyStatus("");}
   setDevices(current=>current.map(d=>d.id===device.id?{...d,enabled:false,keyDeleted:true}:d));
   const latest=await refresh();
   if(latest&&!latest.some(d=>d.id===device.id)){
    setRevokeStatus("ยกเลิกการจับคู่และลบคีย์ "+device.label+" สำเร็จแล้ว");
   }else{setRevokeStatus("เซิร์ฟเวอร์ยืนยันว่าลบคีย์แล้ว กรุณารีเฟรชเพื่ออัปเดตรายชื่ออุปกรณ์");}
  }catch{
   const latest=await refresh();
   if(latest&&!latest.some(d=>d.id===device.id)){
    setRevokeStatus("อุปกรณ์ไม่อยู่ในรายการที่ใช้งานแล้ว");
   }else{setError("ยังยืนยันการยกเลิกคีย์ไม่ได้ กรุณาลองใหม่หรือตรวจสอบสถานะ");}
  }
  finally{setBusy(false);}
 };

 const confirmReceiver=async confirmed=>{
  if(busy||loading||!ready||confirmed&&!receiver?.ready)return;
  const accept=await sweetConfirm(confirmed?"ยืนยันบัญชีรับเงินนี้สำหรับเตรียมเชื่อมต่อ PG Connect? ยังไม่เปิดอ่านแจ้งเตือนหรืออนุมัติการชำระ":"ยกเลิกการยืนยันบัญชีรับเงินสำหรับ PG Connect?",{title:"ยืนยันบัญชีรับเงิน",confirmText:confirmed?"ยืนยัน":"ยกเลิกการยืนยัน",cancelText:"กลับ",type:"warning"});
  if(!accept)return;
  setBusy(true);setError("");
  try{
   const data=await scopedCall("confirmPlatformConnectReceiver",{confirmed,version:receiver?.version||""});
   if(!valid(data,scope)||data.receiver?.confirmed!==confirmed)throw Error("RECEIVER_NOT_CONFIRMED");
   await refresh();
  }catch{setError("ยืนยันบัญชีไม่สำเร็จ กรุณารีเฟรชตรวจสอบบัญชีอีกครั้ง");}
  finally{setBusy(false);}
 };
 const bankNames={scb:"ไทยพาณิชย์",kbank:"กสิกรไทย",ktb:"กรุงไทย",bbl:"กรุงเทพ",krungsri:"กรุงศรีอยุธยา",gsb:"ออมสิน",cimb:"ซีไอเอ็มบีไทย",baac:"ธ.ก.ส.",linebk:"LINE BK"};
 const copy=async()=>{
  if(!token)return;
  try{
   await navigator.clipboard.writeText(token);
   setCopyStatus("คัดลอกรหัสแล้ว กรุณานำไปกรอกใน PG Connect เท่านั้น");
  }catch{setCopyStatus("คัดลอกไม่ได้ กรุณาอนุญาต Clipboard หรือแสดงรหัสและคัดลอกด้วยตนเอง");}
 };
 const visibleDevices=devices.filter(d=>d.enabled||d.keyDeleted!==true);
 const activeCount=devices.filter(d=>d.enabled).length;
 const receiverControls=(
<div className={merchant?"payment-companion-panel payment-companion-receiver-actions":"platform-companion-members"}>
   <strong><i className="bi bi-bank" aria-hidden="true"/> บัญชีรับเงินสำหรับ PG Connect</strong>
   {receiver?.ready?<small>{bankNames[receiver.bankCode]||receiver.bankCode} · บัญชีลงท้าย {receiver.accountLast4}</small>:<small>ยังไม่พบบัญชีรับเงินที่บันทึกและรองรับ กรุณาตรวจสอบการตั้งค่าบัญชี{scopeLabel}</small>}
   <small role="status">{receiver?.confirmed?"ยืนยันบัญชีแล้ว (ยังไม่เปิดรับแจ้งเงินเข้า)":receiver?.requiresReconfirmation?"บัญชีมีการเปลี่ยนแปลง กรุณายืนยันใหม่":"ยังไม่ได้ยืนยันบัญชี"}</small>
   <div>
    <button type="button" className="btn btn-sm" disabled={busy||loading||!ready||!receiver?.ready||receiver.confirmed} onClick={()=>void confirmReceiver(true)}><i className="bi bi-shield-check" aria-hidden="true"/> ยืนยันบัญชีรับเงิน</button>
    {receiver?.confirmed||receiver?.requiresReconfirmation?<button type="button" className="btn btn-sm" disabled={busy||loading||!ready} onClick={()=>void confirmReceiver(false)}>ยกเลิกการยืนยัน</button>:null}
   </div>
  </div>
 );
 const merchantReceiver={enabled:receiver?.confirmed===true,requiresReconfirmation:receiver?.requiresReconfirmation===true,storePaymentReady:receiver?.ready===true,bankName:bankNames[receiver?.bankCode]||receiver?.bankCode,accountLast4:receiver?.accountLast4,promptPayLast4:/^\d{4}$/.test(promptPayLast4)?promptPayLast4:""};
 if(merchant)return <section id="merchantConnectPairingSection" className="payment-companion-body" aria-label="การจับคู่ PG Connect ร้านค้า">
  {error?<p role="alert" className="payment-companion-error">{error}</p>:null}
  {revokeStatus?<p role="status">{revokeStatus}</p>:null}
     <section className="payment-companion-panel payment-companion-match-panel" data-companion-bank-settings aria-label="ตั้งค่าบัญชีรับเงินสำหรับปล่อยครัว">
      <div className="payment-companion-section-heading">
       <div className="payment-companion-section-title">
        <i className="bi bi-bank" aria-hidden="true"/>
        <div><strong>บัญชีรับเงินและการปล่อยครัวอัตโนมัติ</strong>
         <small>ข้อมูลบัญชีรับเงินจากการตั้งค่าร้าน · ยังไม่เปิดรับแจ้งเงินเข้า</small></div>
       </div>
       <span className="payment-companion-count">{merchantReceiver.enabled?"ยืนยันบัญชีแล้ว":"ยังไม่ยืนยันบัญชี"}</span>
      </div>
      <p className="payment-companion-footnote" role="status">
       <i className="bi bi-shield-exclamation" aria-hidden="true"/>
       การยืนยันบัญชีนี้ยังไม่เปิดรับแจ้งเงินเข้า ไม่ยืนยันการชำระ และไม่ปล่อยครัวอัตโนมัติ
      </p>
      <section className="payment-companion-bank-receiver-card" data-companion-bank-receiver
       aria-labelledby="paymentCompanionReceiverTitle">
       <div className="payment-companion-receiver-heading">
        <div className="payment-companion-receiver-heading-main">
         <span className="payment-companion-receiver-heading-icon" aria-hidden="true"><i className="bi bi-bank"/></span>
         <div className="payment-companion-receiver-heading-copy">
          <h4 id="paymentCompanionReceiverTitle">ผูกบัญชีรับเงินสำหรับปล่อยครัวอัตโนมัติ</h4>
          <p>ใช้ข้อมูลรับชำระเงินที่ร้านบันทึกไว้ ไม่ต้องกรอกหมายเลขบัญชีซ้ำ</p>
         </div>
        </div>
        <span className={"payment-companion-receiver-state"+
         (merchantReceiver.requiresReconfirmation?" is-warning":merchantReceiver.enabled?" is-active":" is-inactive")}>
         <i className={"bi "+(merchantReceiver.requiresReconfirmation?"bi-exclamation-circle":
          merchantReceiver.enabled?"bi-check-circle":"bi-clock-history")} aria-hidden="true"/>
         {merchantReceiver.requiresReconfirmation?"รอยืนยันใหม่":merchantReceiver.enabled?"ยืนยันบัญชีแล้ว":"ยังไม่ยืนยันบัญชี"}
        </span>
       </div>

       <div className="payment-companion-receiver-accounts" role="group" aria-label="ข้อมูลบัญชีรับเงินจากการตั้งค่าร้าน">
        <div className="payment-companion-receiver-account">
         <span className="payment-companion-receiver-account-icon" aria-hidden="true"><i className="bi bi-bank2"/></span>
         <div className="payment-companion-receiver-account-info">
          <span className="payment-companion-receiver-account-label">บัญชีธนาคารที่รับเงิน</span>
          <strong>{merchantReceiver.bankName||"ยังไม่กำหนดธนาคาร"}</strong>
          <span className="payment-companion-receiver-account-number">
           <i className="bi bi-credit-card-2-front" aria-hidden="true"/>
           {merchantReceiver.accountLast4?"•••• "+merchantReceiver.accountLast4:"ยังไม่มีเลขบัญชีรับเงิน"}
          </span>
         </div>
        </div>
        <div className="payment-companion-receiver-account is-promptpay">
         <span className="payment-companion-receiver-account-icon" aria-hidden="true"><i className="bi bi-qr-code"/></span>
         <div className="payment-companion-receiver-account-info">
          <span className="payment-companion-receiver-account-label">พร้อมเพย์ของร้าน</span>
          <strong>{merchantReceiver.promptPayLast4?"•••• "+merchantReceiver.promptPayLast4:"ยังไม่มีข้อมูลพร้อมเพย์"}</strong>
          <span className="payment-companion-receiver-account-number">
           <i className="bi bi-link-45deg" aria-hidden="true"/>
           ข้อมูลจากการชำระเงินของร้าน
          </span>
         </div>
        </div>
       </div>

       <div className="payment-companion-receiver-explanation">
        <i className="bi bi-info-circle" aria-hidden="true"/>
        <span>หมายเลขพร้อมเพย์และบัญชีธนาคารเป็นคนละข้อมูล เลขท้ายจึงไม่จำเป็นต้องเหมือนกัน
         หากร้านยืนยันว่าเชื่อมกับบัญชีรับเงินเดียวกัน</span>
       </div>

       <div className="payment-companion-receiver-actions">
        {!merchantReceiver.enabled||merchantReceiver.requiresReconfirmation?
         <button type="button" className="btn btn-primary payment-companion-receiver-action is-primary"
          disabled={busy||loading||!ready||!merchantReceiver.storePaymentReady}
          onClick={()=>confirmReceiver(true)}>
          <i className={"bi "+(busy?"bi-arrow-repeat":"bi-shield-check")} aria-hidden="true"/>
          {busy?"กำลังบันทึก…":"ยืนยันบัญชีรับเงิน"}
         </button>:null}
        {merchantReceiver.enabled||merchantReceiver.requiresReconfirmation?
         <button type="button" className="btn payment-companion-receiver-action is-secondary"
          disabled={busy||loading||!ready} onClick={()=>confirmReceiver(false)}>
          <i className="bi bi-pause-circle" aria-hidden="true"/> ยกเลิกการยืนยัน
         </button>:null}
       </div>

       <div className={"payment-companion-receiver-feedback"+(error?" is-error":merchantReceiver.requiresReconfirmation?" is-warning":merchantReceiver.enabled?" is-success":" is-neutral")} role="status" aria-live="polite">
        <i className="bi bi-info-circle" aria-hidden="true"/>
        <span>{error||(!ready?"ยังไม่สามารถอ่านบัญชีจากระบบ":merchantReceiver.requiresReconfirmation?"มีการแก้ไขบัญชีรับเงิน กรุณายืนยันใหม่":merchantReceiver.enabled?"ยืนยันบัญชีแล้ว (ยังไม่เปิดรับแจ้งเงินเข้า)":merchantReceiver.storePaymentReady?"กรุณายืนยันบัญชีรับเงิน":"ยังไม่พบบัญชีรับเงินที่บันทึกและรองรับ")}</span>
       </div>
      </section>
     </section>

     <div className="payment-companion-panel">
      <div className="payment-companion-section-heading">
       <div className="payment-companion-section-title"><i className="bi bi-phone" aria-hidden="true"/><div><strong>อุปกรณ์ที่เชื่อมต่อ</strong><small>จัดการอุปกรณ์และรหัสสำหรับรับแจ้งเงินเข้า</small></div></div>
       <span className="payment-companion-count">{activeCount}/3 อุปกรณ์</span>
      </div>
      <div className="payment-companion-download">
       <span className="payment-companion-download-icon" aria-hidden="true"><i className="bi bi-android2"/></span>
       <div className="payment-companion-download-copy">
        <strong>ติดตั้งแอป PG Connect</strong>
        <small>ดาวน์โหลดแอป แล้วนำเฉพาะรหัสที่สร้างจากเว็บไปกรอก แอปกำหนดเซิร์ฟเวอร์ไว้แล้ว</small>
        {apk?.mode==="pairing_only"?<small className="payment-companion-download-warning">
         รุ่นทดสอบการจับคู่และส่งเหตุการณ์ทดสอบ · ยังไม่เปิดรับแจ้งเงินเข้า
        </small>:null}
       </div>
       {apk?<a className="btn btn-primary payment-companion-download-btn"
        href={apk.path} download={apk.path.split("/").pop()}>
        <i className="bi bi-download" aria-hidden="true"/> ดาวน์โหลด Android APK
       </a>:<span className="payment-companion-download-unavailable"><i className="bi bi-info-circle" aria-hidden="true"/> เซิร์ฟเวอร์ยังไม่ได้ตั้งค่าไฟล์ APK</span>}
      </div>
      <div className="payment-companion-form">
       <div className="payment-companion-form-controls">
        <DynamicField id="companionDeviceLabel" label="ชื่ออุปกรณ์" value={label}
         className="payment-companion-dynamic-field"
         description="ตั้งชื่อเพื่อแยกอุปกรณ์ เช่น Android ร้านค้า (รหัสจับคู่จะแสดงเพียงครั้งเดียว)">
         <input id="companionDeviceLabel" className="input" maxLength={100} value={label} disabled={busy||loading||!ready}
          onChange={e=>setLabel(e.target.value)}/>
        </DynamicField>
        <button type="button" className="btn btn-primary payment-companion-primary-button" disabled={!ready||loading||busy||activeCount>=3||!label.trim()} onClick={pair}>
         <i className="bi bi-plus-circle" aria-hidden="true"/>{busy?"กำลังดำเนินการ…":"สร้างรหัสจับคู่"}
        </button>
       </div>
      </div>
      {token?<div className="payment-companion-token" role="status">
       <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:12,background:"#ffffff",border:"1px solid #daede0",borderRadius:14,marginBottom:12}}>
        <strong style={{color:"#0b5735"}}><i className="bi bi-qr-code-scan" aria-hidden="true"/> สแกน QR ด้วย PG Connect</strong>
        <img src={qrDataUrl("lkconnect://pair?v=1&server="+encodeURIComponent("https://penguin-food.web.app")+"&token="+token,{size:210})} width="210" height="210" alt="QR สำหรับจับคู่ PG Connect" style={{maxWidth:"100%",height:"auto"}}/>
        <small style={{textAlign:"center",maxWidth:300}}>QR มีรหัสอุปกรณ์อยู่ภายใน ไม่ควรถ่ายหรือส่งให้บุคคลอื่น เมื่อจับคู่แล้วกดปิดรหัส</small>
       </div>
       <div className="payment-companion-token-title"><i className="bi bi-key" aria-hidden="true"/><strong>รหัสสำหรับจับคู่อุปกรณ์</strong><span>แสดงครั้งเดียว</span></div>
       <p>เก็บรหัสนี้เป็นความลับ รหัสใช้ทดสอบการเชื่อมต่อของร้าน มีอายุ 24 ชั่วโมง</p>
       <div className="payment-companion-token-controls">
        <input className="input" type={showToken?"text":"password"} aria-label="รหัสจับคู่อุปกรณ์" value={token} readOnly spellCheck={false}/>
        <button type="button" className="btn" onClick={copy}><i className="bi bi-copy" aria-hidden="true"/> คัดลอก</button>
        <button type="button" className="btn" onClick={()=>setShowToken(value=>!value)} aria-pressed={showToken}>
         <i className={"bi "+(showToken?"bi-eye-slash":"bi-eye")} aria-hidden="true"/> {showToken?"ซ่อนรหัส":"แสดงรหัส"}
        </button>
        <button type="button" className="btn" onClick={()=>{setToken("");setIssuedDeviceId("");setShowToken(false);setCopyStatus("");}}>
         <i className="bi bi-x-circle" aria-hidden="true"/> ปิดรหัส</button>
       </div>
       {copyStatus?<p role="status" className="payment-companion-copy-status">{copyStatus}</p>:null}
      </div>:null}
      {loading&&!ready?<div className="payment-companion-empty" role="status">กำลังโหลดอุปกรณ์…</div>:
       devices.length===0?<div className="payment-companion-empty" role="status"><i className="bi bi-phone" aria-hidden="true"/><div><strong>ยังไม่มีอุปกรณ์ที่เชื่อมต่อ</strong><small>สร้างรหัสจับคู่เพื่อเริ่มใช้งานกับ Android</small></div></div>:
       <ul className="payment-companion-device-list">{devices.map(device=><li key={device.id} className="payment-companion-device">
        <span className="payment-companion-device-icon"><i className="bi bi-phone" aria-hidden="true"/></span>
        <div className="payment-companion-device-info"><strong>{device.label}</strong><small>{device.lastTestAt?"ได้รับเหตุการณ์ทดสอบ (ไม่ใช่ยอดเงินเข้า) · "+new Date(device.lastTestAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}):"ยังไม่ได้รับเหตุการณ์ทดสอบจากอุปกรณ์"}</small></div>
        <span className={"payment-companion-device-state"+(device.enabled?" is-active":"")}>{device.enabled?(device.connected?"เชื่อมต่อแล้ว":"รอเชื่อมต่อ"):"ยกเลิกแล้ว"}</span>
        {device.enabled?<button type="button" className="btn btn-sm payment-companion-revoke" disabled={busy||loading} onClick={()=>revoke(device)}><i className="bi bi-x-circle" aria-hidden="true"/> ยกเลิกการจับคู่</button>:null}
       </li>)}</ul>}
     </div>
  <button type="button" className="btn btn-sm payment-companion-refresh" onClick={()=>void refresh()} disabled={busy||loading}><i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรช</button>
 </section>;
 return <section id={merchant?"merchantConnectPairingSection":"platformCompanionPairingSection"} className="platform-companion" aria-label={"การจับคู่ PG Connect "+scopeLabel} data-platform-companion>
  <div className="platform-companion-heading">
   <div><strong><i className="bi bi-phone" aria-hidden="true"/> PG Connect สำหรับบัญชี{merchant?"ร้านค้า":" Platform"}</strong>
    <small>ทดสอบดาวน์โหลดแอปและจับคู่ด้วยคีย์หรือ QR ตามขอบเขตบัญชี · รุ่นนี้ยังไม่รับแจ้งเงินเข้า</small></div>
   <span>{devices.filter(d=>d.enabled).length}/3 เครื่อง</span>
  </div>
  {revokeStatus?<p role="status"><i className="bi bi-check-circle" aria-hidden="true"/> {revokeStatus}</p>:null}
  {error?<p role="alert" className="platform-collection-warning">{error}</p>:null}
  {receiverControls}
  <div className="platform-companion-install">
   {apk?<a className="btn btn-sm" href={apk.path} download={apk.path.split("/").pop()}>
    <i className="bi bi-download" aria-hidden="true"/> ดาวน์โหลด PG Connect (UAT)</a>:
    <span className="platform-companion-muted">ยังไม่มี APK รุ่นทดสอบที่เผยแพร่</span>}
   <label htmlFor="platformCompanionDeviceLabel">ชื่ออุปกรณ์
    <input className="input" id="platformCompanionDeviceLabel" maxLength={100} value={label}
     onChange={e=>setLabel(e.target.value)} disabled={busy||loading||!ready}/></label>
   <button type="button" className="btn btn-primary" onClick={()=>void pair()}
     disabled={busy||loading||!ready||!label.trim()||devices.filter(d=>d.enabled).length>=3}>
    <i className="bi bi-key" aria-hidden="true"/>{busy?"กำลังดำเนินการ…":"สร้างคีย์ / QR จับคู่"}</button>
   <button type="button" className="btn" onClick={()=>void refresh()} disabled={loading||busy}>
    <i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรช</button>
  </div>
  {token?<div className="platform-companion-issued" role="status" data-platform-pairing-token>
   <strong>QR สำหรับจับคู่ PG Connect {scopeLabel}</strong>
   <img src={qrDataUrl("lkconnect://pair?v=1&server="+encodeURIComponent("https://penguin-food.web.app")+"&token="+token,{size:210})} width="210" height="210" alt={"QR สำหรับจับคู่ PG Connect "+scopeLabel}/>
   <small>รหัสนี้เป็นความลับ แสดงเพียงครั้งเดียว มีอายุ 24 ชั่วโมง · หมดอายุ {expiresAt?new Date(expiresAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}):"—"}</small>
   <div className="platform-companion-key-actions">
    <input className="input" type={showToken?"text":"password"} readOnly value={token} aria-label={"คีย์ PG Connect "+scopeLabel}/>
    <button type="button" className="btn btn-sm" onClick={()=>void copy()}>
     <i className="bi bi-copy" aria-hidden="true"/> คัดลอก</button>
    <button type="button" className="btn btn-sm" onClick={()=>setShowToken(!showToken)}>
     <i className={showToken?"bi bi-eye-slash":"bi bi-eye"} aria-hidden="true"/>{showToken?"ซ่อน":"แสดง"}</button>
    <button type="button" className="btn btn-sm" onClick={()=>{setToken("");setIssuedDeviceId("");setCopyStatus("");setShowToken(false);}}>
     <i className="bi bi-x" aria-hidden="true"/> ปิด</button>
   </div>
   {copyStatus?<small>{copyStatus}</small>:null}
  </div>:null}
  <div className="platform-companion-members">
   <strong>อุปกรณ์ที่เชื่อมต่อ</strong>
   {visibleDevices.length===0?<small>ยังไม่มีอุปกรณ์ที่เชื่อมต่อ</small>:
    visibleDevices.map(d=><div className="platform-companion-member" key={d.id}>
     <span><i className="bi bi-phone" aria-hidden="true"/> {d.label} <small>{d.enabled?(d.connected?"เชื่อมต่อแล้ว":"รอเชื่อมต่อ"):d.keyDeleted===true?"ยกเลิกและลบคีย์แล้ว":"ยกเลิกแล้ว (ยังไม่ยืนยันการลบคีย์)"}</small></span>
     {d.enabled?<button type="button" className="btn btn-sm" onClick={()=>void revoke(d)} disabled={busy||loading}>
      <i className="bi bi-x-circle" aria-hidden="true"/> ยกเลิกการจับคู่</button>:null}
    </div>)}
  </div>
  <div className="platform-companion-members">
   <strong>รายการแจ้งเงินเข้าที่ได้รับล่าสุด</strong>
   <small>ยังไม่เปิดรับแจ้งเงินเข้าจริง · สามารถส่งเหตุการณ์ทดสอบจากแอปเพื่อยืนยันการเชื่อมต่อ</small>
   {visibleDevices.filter(d=>d.lastTestAt).map(d=><div className="platform-companion-member" key={"test-"+d.id}>
    <span><i className="bi bi-check-circle" aria-hidden="true"/> {d.label} <small>ได้รับเหตุการณ์ทดสอบ (ไม่ใช่ยอดเงินเข้า) · {new Date(d.lastTestAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</small></span>
   </div>)}
  </div>
 </section>;
}
