import "@/ui/platform-collection.css";
import {useCallback,useEffect,useState} from "react";
import {qrDataUrl} from "@/utils/localQr";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
const call=(name,data={})=>httpsCallable(functions,name)(data).then(r=>r.data);
const valid=(r,scope)=>r?.ok===true&&r.scope===scope&&r.mode==="pairing_only"&&r.notificationEnabled===false&&r.paymentRoutingEnabled===false&&r.paymentVerified===false;
import {sweetConfirm} from "./sweetDialog";

export function PlatformCompanionPairing({onDevicesChange,scope="platform"}){
 const merchant=scope==="tenant",scopeLabel=merchant?"ร้านค้า":"ส่วนกลาง";
 const scopedCall=(name,data={})=>call(name,{...data,scope});
 const [devices,setDevices]=useState([]);

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

 const copy=async()=>{
  if(!token)return;
  try{
   await navigator.clipboard.writeText(token);
   setCopyStatus("คัดลอกรหัสแล้ว กรุณานำไปกรอกใน PG Connect เท่านั้น");
  }catch{setCopyStatus("คัดลอกไม่ได้ กรุณาอนุญาต Clipboard หรือแสดงรหัสและคัดลอกด้วยตนเอง");}
 };
 const visibleDevices=devices.filter(d=>d.enabled||d.keyDeleted!==true);
 return <section id={merchant?"merchantConnectPairingSection":"platformCompanionPairingSection"} className="platform-companion" aria-label={"การจับคู่ PG Connect "+scopeLabel} data-platform-companion>
  <div className="platform-companion-heading">
   <div><strong><i className="bi bi-phone" aria-hidden="true"/> PG Connect สำหรับบัญชี{merchant?"ร้านค้า":" Platform"}</strong>
    <small>ทดสอบดาวน์โหลดแอปและจับคู่ด้วยคีย์หรือ QR ตามขอบเขตบัญชี · รุ่นนี้ยังไม่รับแจ้งเงินเข้า</small></div>
   <span>{devices.filter(d=>d.enabled).length}/3 เครื่อง</span>
  </div>
  {revokeStatus?<p role="status"><i className="bi bi-check-circle" aria-hidden="true"/> {revokeStatus}</p>:null}
  {error?<p role="alert" className="platform-collection-warning">{error}</p>:null}
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
