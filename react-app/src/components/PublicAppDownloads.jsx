import "@/ui/lk-shop-public-downloads.css";

// Never link an unbuilt LUKKAJA APK to PENGUIN: Source Flutter LK Shop
// deliberately pins www.lukkaja.com and cannot enroll on the Firebase host.
export function PublicAppDownloads(){
 return <section className="card lk-public-downloads" id="publicAppDownloads"
  aria-labelledby="publicAppDownloadsTitle">
  <header className="lk-public-downloads-title">
   <span className="lk-public-downloads-icon" aria-hidden="true"><i className="bi bi-phone"/></span>
   <div><small>PENGUIN MOBILE</small>
    <h2 id="publicAppDownloadsTitle">แอป LK Shop • ห้องแจ้งเตือน</h2>
    <p>ติดตามการแจ้งเตือนของร้าน แคชเชียร์ และครัวได้จากโทรศัพท์</p>
   </div>
  </header>
  <div className="lk-public-downloads-product">
   <span className="lk-public-downloads-icon" aria-hidden="true"><i className="bi bi-bell-fill"/></span>
   <div><strong>LK Shop สำหรับ Firebase</strong>
    <p>กำลังพอร์ตแอปเพื่อให้จับคู่กับ PENGUIN โดยไม่ใช้ Server หรือ QR ของ LUKKAJA</p>
   </div>
   <button type="button" disabled aria-disabled="true" title="ยังไม่มี APK ที่ผ่าน UAT สำหรับ Firebase">
    <i className="bi bi-hourglass-split" aria-hidden="true"/> APK ยังไม่พร้อมดาวน์โหลด
   </button>
  </div>
  <div className="lk-public-downloads-future" aria-label="Store ยังไม่เปิดให้ดาวน์โหลด">
   <span><i className="bi bi-google-play" aria-hidden="true"/> Google Play · เร็ว ๆ นี้</span>
   <span><i className="bi bi-apple" aria-hidden="true"/> App Store · เร็ว ๆ นี้</span>
  </div>
  <p className="lk-public-downloads-note">
   <i className="bi bi-info-circle" aria-hidden="true"/> Telegram ยังใช้งานเป็นช่องทางหลัก
   จนกว่า APK สำหรับ Firebase และการรับ Push จะผ่านการทดสอบครบทุกห้อง
  </p>
 </section>;
}
