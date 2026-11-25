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
    "ออเดอร์ใหม่ การรับชำระเงิน และรายการที่รอแคชเชียร์ตรวจสอบ"],
  ["kitchen_delivery","ห้องครัว",
    "รายการอาหารใหม่และคำสั่งซื้อที่พร้อมส่งให้ครัวดำเนินการ"],
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
 const platform=scope==="platform";
 const options=roomOptions.map(([key])=>key);
 const roles=Object.fromEntries(roomOptions.map(([key,label])=>[key,label]));
 const roomDescriptions=Object.fromEntries(roomOptions.map(([key,,description])=>[key,description]));
 const colors={bg:"#f3f9f5",border:"#d5e7da",text:"#153e2b"};
  return <section className={`lk-shop-pairing-panel lk-shop-panel${embedded?" is-embedded":" card"}`} id={platform?"platformLKShopPairing":"adminLKShopPairing"} data-lk-shop-scope={scope}
    style={embedded?{padding:0,margin:0,border:0,background:"transparent",boxShadow:"none"}:
      {padding:16,margin:"12px 0",border:"1px solid #d5e7da",borderRadius:16,background:"#ffffff"}}>
    {!embedded?<div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
      <span style={{background:"#e2f2e9",color:"#117c46",borderRadius:12,padding:12}}>
        <i className="bi bi-bell-fill" aria-hidden="true"/></span>
      <div style={{minWidth:0,flex:1}}>
        <h3 style={{fontSize:17,margin:0,fontWeight:800}}>PG Notify • ห้องแจ้งเตือน</h3>
        <p style={{margin:"5px 0 0",fontSize:12,color:"#587264",lineHeight:1.5}}>
          {platform?"รับแจ้งเตือนการเงินและรายการสำคัญของระบบ":"เลือกห้องก่อนสร้าง QR เพื่อให้แต่ละทีมได้รับเฉพาะข้อความที่เกี่ยวข้อง"}
        </p>
      </div>
    </div>:null}
    <div role="note" style={{padding:10,background:"#f6f8f7",color:"#53685b",fontSize:12,borderRadius:10,lineHeight:1.6,marginBottom:12}}>
      ระบบแจ้งเตือนผ่าน PG Notify จะเปิดใช้คู่ขนานกับ Telegram ระหว่างทดสอบ ไม่ยกเลิกช่องทางเดิมจนยืนยันว่า Push ส่งถึงอุปกรณ์ครบทุกบทบาท
    </div>
    {apk&&<a className="btn btn-sm" href={apk.path} download={apk.path.split("/").pop()} style={{marginBottom:12}}><i className="bi bi-download" aria-hidden="true"/> ดาวน์โหลด PG Notify (.apk)</a>}
    <div role="status" style={{fontSize:12,color:"#53685b",marginBottom:12}}>{pushServerConfigured?"เซิร์ฟเวอร์ Push เปิดใช้งานแล้ว · ทดสอบที่อุปกรณ์หลังจับคู่":"เซิร์ฟเวอร์ Push ยังไม่พร้อมหรือยังตรวจสอบไม่ได้"}</div>
    {error&&<p role="alert" className="lk-shop-error">{error}</p>}
    {loading?<p role="status">กำลังอ่านสถานะ PG Notify จากเซิร์ฟเวอร์…</p>:disabled?<div role="status" style={{padding:12,color:"#935b10",background:"#fff5e5",borderRadius:10}}>
      ระบบจับคู่ PG Notify ของ Firebase ยังไม่ได้เปิดทดสอบ</div>:<>
      {platform?(
        <div className="lk-shop-platform-room" role="group" aria-label={roles.superadmin_slip_manual}>
          <span className="lk-shop-platform-room-icon" aria-hidden="true">
            <i className="bi bi-shield-check" />
          </span>
          <div className="lk-shop-platform-room-copy">
            <strong>{roles.superadmin_slip_manual}</strong>
            <small>{roomDescriptions.superadmin_slip_manual}</small>
          </div>
          <span className="lk-shop-platform-room-status">
            <i className="bi bi-check-circle" aria-hidden="true" /> ห้องประจำระบบ
          </span>
        </div>
      ):(
        <fieldset style={{border:0,padding:0,margin:"0 0 14px",minWidth:0}}>
          <legend style={{fontWeight:800,fontSize:13,color:colors.text,marginBottom:9}}>
            เลือกห้องสำหรับ QR นี้ *
          </legend>
          <div className="lk-shop-room-picker" style={{display:"grid",
            gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,210px),1fr))",gap:9}}>
            {options.map(role=><label key={role} className="lk-shop-room-option"
              style={{display:"flex",alignItems:"flex-start",gap:10,padding:"13px 12px",borderRadius:12,cursor:busy?"wait":"pointer",
                border:"1px solid "+(purpose===role?"#159554":"#d8e8de"),
                background:purpose===role?"#eaf7ee":"#fff",minWidth:0}}>
              <input type="radio" name="tenantLKShopRoom" value={role}
                checked={purpose===role} disabled={busy}
                onChange={()=>{setPurpose(role);setQr(null);}}
                // Explicit dimensions isolate this radio from the site's global input{width:100%;min-height:46px}.
                style={{appearance:"auto",accentColor:"#16834a",width:20,minWidth:20,maxWidth:20,
                  height:20,minHeight:20,maxHeight:20,padding:0,margin:"2px 0 0",flex:"0 0 20px"}}/>
              <span style={{minWidth:0,flex:"1 1 auto",display:"grid",gap:4}}>
                <strong style={{fontSize:13,color:colors.text}}>{roles[role]}</strong>
                <small style={{fontSize:11,color:"#607566",lineHeight:1.5}}>{roomDescriptions[role]}</small>
              </span>
            </label>)}
          </div>
        </fieldset>
      )}
      <div className={platform?"lk-shop-pairing-actions lk-shop-pairing-actions--platform":"lk-shop-pairing-actions"}
        style={platform?undefined:{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:9,flexWrap:"wrap",marginBottom:14}}>
        {platform?(
          <>
            <button type="button" className="btn lk-shop-pairing-refresh" onClick={()=>void reload()} disabled={busy}>
              <i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรช
            </button>
            <button type="button" className="btn btn-primary lk-shop-pairing-create" onClick={issue} disabled={busy||!purpose}>
              <i className="bi bi-qr-code" aria-hidden="true"/> {busy?"กำลังสร้าง…":"สร้าง QR"}
            </button>
          </>
        ):(
          <>
            <button type="button" className="btn lk-shop-pairing-refresh" onClick={()=>void reload()} disabled={busy}>
              <i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรช
            </button>
            <button type="button" className="btn btn-primary lk-shop-pairing-create" onClick={issue} disabled={busy||!purpose}>
              <i className="bi bi-qr-code" aria-hidden="true"/> {busy?"กำลังสร้าง…":"สร้าง QR สำหรับห้องที่เลือก"}
            </button>
          </>
        )}
      </div>
      {qr?<div className="lk-shop-qr" role="status" style={{border:"1px solid #d5e7da",background:colors.bg,borderRadius:14,padding:16,
        display:"flex",flexDirection:"column",alignItems:"center",gap:8,marginBottom:14}}>
        <strong style={{color:colors.text}}>สแกนด้วย PG Notify • {roles[purpose]}</strong>
        <img src={qr.image} width={216} height={216} alt={"QR จับคู่ PG Notify สำหรับสิทธิ์ "+roles[purpose]} style={{maxWidth:"100%",height:"auto"}}/>
        <span style={{color:remaining<=20?"#b34c26":"#256747",fontWeight:700,fontSize:13}}>
          ใช้ได้ครั้งเดียว • เหลือ {String(Math.floor(remaining/60)).padStart(2,"0")}:{String(remaining%60).padStart(2,"0")} นาที
        </span>
        <button type="button" className="btn lk-shop-pair-code-action"
          data-lk-shop-copy-code={platform?"platform":"tenant"}
          onClick={copyCode} disabled={remaining<=0}>
          <i className="bi bi-clipboard" aria-hidden="true"/>
          <span>คัดลอกรหัสจับคู่ (64 ตัวอักษร)</span>
        </button>
        <small style={{textAlign:"center",maxWidth:340,color:"#6b7f72"}}>
          หากใช้ Emulator ไม่มีกล้อง ให้คัดลอกรหัสแล้ววางใน PG Notify ภายใน 5 นาที
          ห้ามส่งรหัสหรือรูป QR ให้บุคคลอื่น
        </small>
        <button type="button" className="btn" onClick={()=>{setQr(null);void reload();}}>
          <i className="bi bi-x-circle" aria-hidden="true"/> ปิด QR
        </button>
      </div>:null}
      <div style={{fontSize:13,fontWeight:800,color:colors.text,marginBottom:8}}>
        สมาชิกห้องแจ้งเตือน ({devices.length} อุปกรณ์)
      </div>
      {devices.length===0?<div style={{color:"#647b6c",fontSize:13}}>ยังไม่มีอุปกรณ์ที่เชื่อมต่อ</div>:
      <div style={{display:"grid",gap:12}}>
        {options.map(room=>{
          const members=devices.filter(device=>device.role===room);
          return <div key={room} style={{padding:10,borderRadius:12,border:"1px solid #e2eee6",background:"#fbfdfb"}}>
            <strong style={{display:"block",fontSize:13,color:colors.text,marginBottom:7}}>
              {roles[room]} ({members.length})
            </strong>
            <div style={{display:"grid",gap:8}}>
            {members.length===0?<span style={{fontSize:12,color:"#718478"}}>ยังไม่มีอุปกรณ์ในห้องนี้</span>:null}
            {members.map(device=><div className="lk-shop-device" key={device.id}
          style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",border:"1px solid #e0eee5",
            borderRadius:12,padding:10}}>
          <i className={"bi "+(device.platform==="ios"?"bi-apple":"bi-android2")}
            aria-hidden="true" style={{color:"#14804a"}}/>
          <div style={{minWidth:0,flex:"1 1 155px"}}>
            <strong style={{display:"block",color:colors.text}}>{device.name}</strong>
            <small style={{color:"#6b7d70"}}>{device.pushReady?"ลงทะเบียน Token สำหรับ Push แล้ว":"เชื่อมต่อแล้ว • รอเปิดแจ้งเตือนบนโทรศัพท์"}</small>
          </div>
          {pushServerConfigured&&device.pushReady&&<button type="button" className="btn btn-sm" disabled={busy} onClick={()=>void testPush(device)} aria-label={"ส่ง Push ทดสอบ "+device.name}><i className="bi bi-bell" aria-hidden="true"/> ส่งทดสอบ</button>}
          <button type="button" className="btn btn-sm" onClick={()=>revoke(device)} disabled={busy} aria-label={"ยกเลิกการจับคู่ "+device.name}
            style={{color:"#ae2d2d",border:"1px solid #edc7c7"}}>
            <i className="bi bi-link-45deg" aria-hidden="true"/> ยกเลิกการจับคู่
          </button>
        </div>)}
            </div>
          </div>;
        })}
      </div>}
    </>}
  </section>;
}
