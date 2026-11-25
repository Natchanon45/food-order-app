import {useEffect,useState} from "react";
import "@/ui/lk-shop-public-downloads.css";

export function usePGNotifyDownload(){
 const [apk,setApk]=useState(null);
 useEffect(()=>{
  let active=true;
  fetch("/downloads/pg-notify.json",{cache:"no-store"}).then(async r=>{
   if(!r.ok)throw Error("APK_MANIFEST_UNAVAILABLE");
   const m=await r.json();
   if(active&&m?.mode==="notification_uat"&&/^\/downloads\/PG_Notify_V\d+\.\d+\.\d+_\d{4}\.apk$/.test(m.path)&&/^[a-f0-9]{64}$/.test(m.sha256))setApk(m);
  }).catch(()=>{});
  return()=>{active=false;};
 },[]);
 return apk;
}
export function PublicAppDownloads(){
 const apk=usePGNotifyDownload();
 return <section className="card lk-public-downloads" id="publicAppDownloads" aria-labelledby="publicAppDownloadsTitle">
  <header className="lk-public-downloads-title">
   <span className="lk-public-downloads-icon" aria-hidden="true"><i className="bi bi-phone"/></span>
   <div><small>PENGUIN MOBILE</small><h2 id="publicAppDownloadsTitle">แอป PG Notify • ห้องแจ้งเตือน</h2>
    <p>ติดตามการแจ้งเตือนของร้าน แคชเชียร์ และครัวได้จากโทรศัพท์</p></div>
  </header>
  <div className="lk-public-downloads-product">
   <span className="lk-public-downloads-icon" aria-hidden="true"><i className="bi bi-bell-fill"/></span>
   <div><strong>PG Notify สำหรับ Firebase</strong>
    <p>{apk?"Version "+apk.version+" · Build "+String(apk.buildCode).padStart(4,"0")+" · รุ่นทดสอบ Android (ยังไม่รับรอง Push)":"ยังไม่มี APK รุ่นทดสอบที่เผยแพร่"}</p></div>
   {apk?<a className="btn btn-primary btn-sm" href={apk.path} download={apk.path.split("/").pop()}><i className="bi bi-download" aria-hidden="true"/> ดาวน์โหลด PG Notify (UAT)</a>:
    <button type="button" disabled aria-disabled="true"><i className="bi bi-hourglass-split" aria-hidden="true"/> APK ยังไม่พร้อมดาวน์โหลด</button>}
  </div>
  <div className="lk-public-downloads-future" aria-label="Store ยังไม่เปิดให้ดาวน์โหลด">
   <span><i className="bi bi-google-play" aria-hidden="true"/> Google Play · เร็ว ๆ นี้</span>
   <span><i className="bi bi-apple" aria-hidden="true"/> App Store · เร็ว ๆ นี้</span>
  </div>
  <p className="lk-public-downloads-note"><i className="bi bi-info-circle" aria-hidden="true"/> Telegram ยังเป็นช่องทางหลักจนกว่าการจับคู่และ Push ของ PG Notify จะผ่านการทดสอบครบทุกห้อง</p>
 </section>;
}
