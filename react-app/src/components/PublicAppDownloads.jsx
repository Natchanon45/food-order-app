import {useEffect,useState} from "react";

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
export function PublicAppDownloads() {
  const apk=usePGNotifyDownload();
  return (
    <section className="card lk-app-downloads" id="publicAppDownloads" aria-labelledby="lkAppDownloadsTitle">
      <div className="lk-app-downloads-heading">
        <span className="lk-app-downloads-heading-icon" aria-hidden="true"><i className="bi bi-phone"/></span>
        <div className="lk-app-downloads-heading-copy">
          <span className="lk-app-downloads-kicker">PENGUIN MOBILE</span>
          <h2 id="lkAppDownloadsTitle">ดาวน์โหลดแอป PENGUIN</h2>
          <p>ติดตามการแจ้งเตือนของร้านได้สะดวกยิ่งขึ้นบนมือถือ</p>
        </div>
      </div>

      <div className="lk-app-downloads-product">
        <div className="lk-app-downloads-product-main">
          <span className="lk-app-downloads-product-icon" aria-hidden="true"><i className="bi bi-bell-fill"/></span>
          <div className="lk-app-downloads-product-copy">
            <span className="lk-app-downloads-product-name">PG Notify <span className="lk-app-downloads-status">Android · รุ่นทดสอบ</span></span>
            <p>แอปรับแจ้งเตือนสำหรับผู้ดูแลระบบ , เจ้าของร้านค้า, แคชเชียร์ และครัว ไม่ต้องล็อกอิน เพียงสแกน QR เพื่อจับคู่กับร้าน</p>
          </div>
        </div>
        {apk ? <a className="lk-app-downloads-apk-button" href={apk.path} download={apk.path.split("/").pop()} type="application/vnd.android.package-archive">
          <i className="bi bi-download" aria-hidden="true"/>
          <span>ดาวน์โหลด PG Notify (.apk)</span>
        </a> : <button className="lk-app-downloads-apk-button" type="button" disabled aria-disabled="true">
          <i className="bi bi-hourglass-split" aria-hidden="true"/>
          <span>APK ยังไม่พร้อมดาวน์โหลด</span>
        </button>}
      </div>

      <div className="lk-app-downloads-store-row" aria-label="ช่องทางดาวน์โหลดจาก Store ในอนาคต">
        <span className="lk-app-downloads-store-caption">ช่องทางดาวน์โหลดอย่างเป็นทางการ</span>
        <div className="lk-app-downloads-store-buttons">
          <span className="lk-app-downloads-store-button" aria-label="Google Play เร็ว ๆ นี้">
            <i className="bi bi-google-play" aria-hidden="true"/>
            <span><small>เร็ว ๆ นี้บน</small><strong>Google Play</strong></span>
          </span>
          <span className="lk-app-downloads-store-button" aria-label="App Store เร็ว ๆ นี้">
            <i className="bi bi-apple" aria-hidden="true"/>
            <span><small>เร็ว ๆ นี้บน</small><strong>App Store</strong></span>
          </span>
        </div>
      </div>
      <p className="lk-app-downloads-note"><i className="bi bi-info-circle" aria-hidden="true"/> ไฟล์ APK นี้สำหรับทดสอบบน Android เท่านั้น การรับ Push Notification ต้องตั้งค่าบริการแจ้งเตือนและจับคู่อุปกรณ์ก่อน (Firebase ยังไม่เปิดรับ Push)</p>
    </section>
  );
}
