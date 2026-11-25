import {useCallback,useEffect,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import {qrDataUrl} from "@/utils/localQr";
import {usePGNotifyDownload} from "./PublicAppDownloads";
import {sweetConfirm} from "@/components/sweetDialog";
import "@/ui/lk-shop-pairing.css";

const ROOMS={
 platform:[
  ["superadmin_slip_manual","ห้องแจ้งเตือนส่วนกลาง",
    "คำขอเติมเครดิต ค่าบริการ ค่าส่วนแบ่ง และรายการที่รอตรวจสอบ"],
 ],
 tenant:[
  ["admin_store","ห้องแอดมินร้าน",
    "ความเคลื่อนไหวของร้าน การชำระเงินและรายการที่ต้องติดตาม"],
  ["cashier_delivery","ห้องแคชเชียร์",
    "คำสั่งซื้อ Delivery และสลิปที่รอแคชเชียร์ตรวจสอบ"],
  ["kitchen_delivery","ห้องครัว",
    "คำสั่งซื้อที่พร้อมให้ครัวดำเนินการ"],
 ],
};
const HASH=/^[a-f0-9]{64}$/;
const TOKEN_URL=/^lkshop:\/\/pair\?v=1&server=[^\s]+&code=[a-f0-9]{64}$/;
const DEVICE_ID=/^[A-Za-z0-9_-]{4,128}$/;
const fn=(name,data)=>httpsCallable(functions,name)(data).then(r=>r?.data);
const errorText=error=>{
 const text=String(error?.message||"");
 if(/LK_SHOP_PILOT_NOT_ENABLED/.test(text))
  return "ฟีเจอร์ PG Notify บน Firebase ยังไม่เปิดใช้งาน — ต้องผ่านการทดสอบแอปใหม่ก่อน";
 if(/permission-denied|LK_SHOP_(?:TENANT|PLATFORM|ACTIVE|SESSION)/i.test(text))
  return "สิทธิ์จัดการอุปกรณ์หมดอายุหรือไม่ตรงกับห้อง กรุณาเข้าสู่ระบบใหม่";
 if(/unavailable|deadline-exceeded/i.test(text))
  return "ยังตรวจสอบข้อมูลจากเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่";
 return "การเชื่อมต่อ PG Notify ยังไม่ยืนยัน กรุณารีเฟรชและตรวจสอบสิทธิ์";
};
const validDevice=d=>Boolean(d&&DEVICE_ID.test(d.id||"")&&
 typeof d.name==="string"&&d.name.length<=100&&
 ["ios","android"].includes(d.platform)&&typeof d.pushReady==="boolean");
function checkList(data,scope){
 if(data?.ok!==true||data.scope!==scope||!Array.isArray(data.devices)||
   data.devices.length>70||data.appBuildVerified!==false||
   data.mobileGoApiCompatible!==false||
   data.devices.some(d=>!validDevice(d)||
     !ROOMS[scope].some(([key])=>key===d.role)))
  throw Error("LK_SHOP_UNCONFIRMED_LIST");
 return data.devices;
}
function checkPair(value,purpose){
 if(value?.ok!==true||value.purpose!==purpose||value.expiresInSeconds!==300||
  value.mobileGoApiCompatible!==false||value.appBuildVerified!==false||
  !TOKEN_URL.test(value.qrPayload||""))
  throw Error("LK_SHOP_UNCONFIRMED_PAIR");
 const url=new URL(value.qrPayload);
 if(url.protocol!=="lkshop:"||url.hostname!=="pair"||
  url.searchParams.get("server")!=="https://penguin-food.web.app"||
  !HASH.test(url.searchParams.get("code")||""))
  throw Error("LK_SHOP_UNTRUSTED_QR");
 return value;
}
export function LKShopPairingPanel({scope="tenant",embedded=false,notify=()=>{}}){
 const roomOptions=ROOMS[scope]||ROOMS.tenant;
 const apk=usePGNotifyDownload();
 const [purpose,setPurpose]=useState(scope==="platform"?"superadmin_slip_manual":"");
 const [devices,setDevices]=useState([]);
 const [pushServerConfigured,setPushServerConfigured]=useState(false);
 const [qr,setQr]=useState(null);
 const [remaining,setRemaining]=useState(0);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [disabled,setDisabled]=useState(false);
 const [error,setError]=useState("");
 const report=(text,type="success")=>{
  if(typeof notify==="function")notify(text,type);
 };
 const reload=useCallback(async({silent=false}={})=>{
  try{
   const data=await fn("getLKShopPairingDevices",{scope});
   const next=checkList(data,scope);
   setDevices(next);setPushServerConfigured(data.pushServerConfigured===true);setDisabled(false);setError("");
   return next;
  }catch(caught){
   if(String(caught?.message||"").includes("LK_SHOP_PILOT_NOT_ENABLED")){
    setDisabled(true);setDevices([]);setQr(null);
   }
   setPushServerConfigured(false);setError(errorText(caught));
   if(!silent)report("อ่านรายการ PG Notify ไม่สำเร็จ","error");
   return null;
  }finally{setLoading(false);}
 },[scope]);
 useEffect(()=>{void reload({silent:true});},[reload]);
 useEffect(()=>{
  if(!qr)return undefined;
  const tick=()=>{
   const s=Math.max(0,Math.ceil((qr.expiresAt-Date.now())/1000));
   setRemaining(s);
   if(!s)setQr(null);
  };
  tick();
  const id=window.setInterval(tick,500);
  return()=>window.clearInterval(id);
 },[qr]);
 const issue=async()=>{
  if(busy||disabled)return;
  if(!roomOptions.some(([key])=>key===purpose)){
   report("กรุณาเลือกห้องก่อนสร้าง QR","error");return;
  }
  setBusy(true);setQr(null);setError("");
  try{
   const data=checkPair(await fn("issueLKShopPairingChallenge",{scope,purpose}),purpose);
   // This one-use capability is deliberately held only in page memory.
   const image=qrDataUrl(data.qrPayload,{size:240,margin:4});
   setQr({value:data.qrPayload,image,expiresAt:Date.now()+300000,purpose});
   report("สร้าง QR ใช้ครั้งเดียวแล้ว • หมดอายุภายใน 5 นาที");
   await reload({silent:true});
  }catch(caught){setError(errorText(caught));report("สร้าง QR ไม่สำเร็จ","error");}
  finally{setBusy(false);}
 };
 const copyCode=async()=>{
  if(!qr||remaining<=0)return;
  try{
   const code=new URL(qr.value).searchParams.get("code");
   if(!HASH.test(code||""))throw Error("INVALID");
   await navigator.clipboard.writeText(code);
   report("คัดลอกรหัสจับคู่สำหรับทดสอบแล้ว");
  }catch{report("คัดลอกรหัสไม่ได้ กรุณาอนุญาต Clipboard","error");}
 };
 const testPush=async(device)=>{
  if(busy||!pushServerConfigured||!device.pushReady)return;
  setBusy(true);setError("");
  try{
   const r=await fn("queuePGNotifyTestPush",{scope,deviceId:device.id});
   if(r?.ok!==true||r.queued!==true||r.deviceId!==device.id||r.deliveryConfirmed!==false)throw Error("PG_NOTIFY_TEST_UNCONFIRMED");
   report("ส่งเข้าคิวแล้ว กรุณาตรวจการแจ้งเตือนบนโทรศัพท์");
  }catch(e){
   setError(/resource-exhausted|PG_NOTIFY_TEST_RATE_LIMIT/.test(String(e?.code)+" "+String(e?.message))?"รอ 1 นาที ก่อนส่งทดสอบอีกครั้ง":"ส่งแจ้งเตือนทดสอบไม่สำเร็จ กรุณาตรวจสอบการจับคู่");
  }finally{setBusy(false);}
 };
 const revoke=async(device)=>{
  if(busy||!DEVICE_ID.test(device?.id||""))return;
  const confirmed=await sweetConfirm(
   "ยกเลิกสิทธิ์เครื่อง "+device.name+" หรือไม่? เครื่องนี้จะไม่สามารถรับแจ้งเตือนใหม่ได้",
   {title:"ยกเลิกการจับคู่ PG Notify",type:"warning",confirmText:"ยกเลิกอุปกรณ์",cancelText:"กลับ",danger:true});
  if(!confirmed)return;
  setBusy(true);setQr(null);
  try{
   const result=await fn("revokeLKShopPairingDevice",{scope,deviceId:device.id});
   const latest=await reload({silent:true});
   if(Array.isArray(latest)&&!latest.some(d=>d.id===device.id)&&result?.revoked===true){
    report("ยกเลิกการจับคู่ PG Notify แล้ว");
   }else{setError("ยังไม่ยืนยันผลการยกเลิกอุปกรณ์ กรุณารีเฟรช");}
  }catch(caught){
   // A stale tab might send an already-revoked ID. Read the authoritative
   // scoped list before claiming success.
   const latest=await reload({silent:true});
   if(Array.isArray(latest)&&!latest.some(d=>d.id===device.id))
    report("อุปกรณ์นี้ถูกยกเลิกการจับคู่แล้ว");
   else setError(errorText(caught));
  }finally{setBusy(false);}
 };
 return <section className={"lk-shop-panel"+(embedded?" is-embedded":" card")}
  id={scope==="platform"?"platformLKShopPairing":"adminLKShopPairing"}
  data-lk-shop-scope={scope}>
  {!embedded&&<header className="lk-shop-panel-heading">
   <i className="bi bi-bell-fill" aria-hidden="true"/>
   <div><h3>PG Notify • ห้องแจ้งเตือน</h3>
    <p>แยกอุปกรณ์ตามห้องและบทบาทเพื่อไม่ส่งการแจ้งเตือนข้ามทีม</p>
   </div>
  </header>}
  <p className="lk-shop-pilot-note" role="note">
   PG Notify สำหรับ Firebase อยู่ระหว่าง UAT เปิดคู่ขนานกับ Telegram
   และแอปจาก Source รุ่นเดิมยังจับคู่กับโดเมน PENGUIN ไม่ได้
   กรุณาอย่านำ QR นี้ไปใช้กับ APK ของ LUKKAJA
  </p>
  {apk&&<p><a className="btn btn-sm" href={apk.path} download={apk.path.split("/").pop()}><i className="bi bi-download" aria-hidden="true"/> ดาวน์โหลด PG Notify (UAT)</a></p>}
  <p role="status">{pushServerConfigured?"เซิร์ฟเวอร์ Push เปิดใช้งานแล้ว · ทดสอบที่อุปกรณ์หลังจับคู่":"เซิร์ฟเวอร์ Push ยังไม่พร้อมหรือยังตรวจสอบไม่ได้"}</p>
  {error&&<p role="alert" className="lk-shop-error">{error}</p>}
  {loading?<p role="status">กำลังอ่านสถานะ PG Notify จากเซิร์ฟเวอร์…</p>:
   disabled?<p role="status">ระบบจับคู่ PG Notify ของ Firebase ยังไม่ได้เปิดทดสอบ</p>:<>
    <fieldset className="lk-shop-rooms" disabled={busy}>
     <legend>{scope==="platform"?"ห้องแจ้งเตือนส่วนกลาง":"เลือกห้องสำหรับ QR นี้ *"}</legend>
     <div className="lk-shop-room-grid">
      {roomOptions.map(([key,label,description])=>
       <label className={"lk-shop-room"+(purpose===key?" is-selected":"")} key={key}>
        <input type="radio" name={"lk-shop-room-"+scope}
         checked={purpose===key} value={key}
         onChange={()=>{setPurpose(key);setQr(null);}}/>
        <span><strong>{label}</strong><small>{description}</small></span>
       </label>)}
     </div>
    </fieldset>
    <div className="lk-shop-controls">
     <button type="button" className="btn btn-primary" onClick={issue}
      disabled={busy||!purpose}><i className="bi bi-qr-code" aria-hidden="true"/>
       {busy?"กำลังสร้าง…":"สร้าง QR สำหรับห้องที่เลือก"}</button>
     <button type="button" className="btn" onClick={()=>void reload()}
      disabled={busy}><i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรช</button>
    </div>
    {qr&&<div className="lk-shop-qr" role="status">
     <strong>สแกนด้วยแอป PG Notify สำหรับ PENGUIN • {roomOptions.find(x=>x[0]===qr.purpose)?.[1]}</strong>
     <img src={qr.image} width={240} height={240} alt={"QR จับคู่อุปกรณ์ห้อง "+qr.purpose}/>
     <span>รหัสใช้ได้ครั้งเดียว • เหลือ {String(Math.floor(remaining/60)).padStart(2,"0")}:
      {String(remaining%60).padStart(2,"0")} นาที</span>
     <div className="lk-shop-qr-buttons">
      <button className="btn" type="button" onClick={copyCode} disabled={!remaining}>
       <i className="bi bi-clipboard" aria-hidden="true"/> คัดลอกรหัสสำหรับ Emulator</button>
      <button className="btn" type="button" onClick={()=>setQr(null)}>
       <i className="bi bi-x-circle" aria-hidden="true"/> ปิด QR</button>
     </div>
     <small>ห้ามส่งรูป QR หรือรหัสให้ผู้อื่น • รหัสแสดงเฉพาะในเบราว์เซอร์นี้</small>
    </div>}
    <div className="lk-shop-device-head">
     <strong>สมาชิกห้องแจ้งเตือน ({devices.length} อุปกรณ์)</strong>
     <small>สูงสุด 10 อุปกรณ์ต่อห้อง</small>
    </div>
    {devices.length===0?<p className="lk-shop-empty">ยังไม่มีอุปกรณ์ที่เชื่อมต่อ</p>:
    <div className="lk-shop-device-groups">
     {roomOptions.map(([room,label])=>{
      const members=devices.filter(d=>d.role===room);
      return <section className="lk-shop-device-room" key={room} data-room={room}>
       <strong>{label} ({members.length})</strong>
       {members.length===0?<small>ยังไม่มีอุปกรณ์ในห้องนี้</small>:members.map(d=>
        <div className="lk-shop-device" key={d.id}>
         <i className={"bi "+(d.platform==="ios"?"bi-apple":"bi-android2")} aria-hidden="true"/>
         <div><strong>{d.name}</strong>
          <small>{d.pushReady?"ลงทะเบียน Token สำหรับ Push แล้ว":"จับคู่แล้ว • ยังไม่ได้เปิด Push บนโทรศัพท์"}</small>
         </div>
         {pushServerConfigured&&d.pushReady&&<button type="button" className="btn btn-sm" disabled={busy} onClick={()=>void testPush(d)} aria-label={"ส่ง Push ทดสอบ "+d.name}><i className="bi bi-bell" aria-hidden="true"/> ส่งทดสอบ</button>}
         <button type="button" className="btn btn-sm" onClick={()=>void revoke(d)} disabled={busy}
          aria-label={"ยกเลิกการจับคู่ "+d.name}>
          <i className="bi bi-link-45deg" aria-hidden="true"/> ยกเลิกการจับคู่
         </button>
        </div>)}
      </section>;
     })}
    </div>}
   </>}
 </section>;
}
