import "@/ui/stripe-connect-delivery-source.css";

// Source presentation with an explicit unavailable state. No account or payment capability is inferred.
export function StripeConnectDeliveryAvailability(){
 return <section className="stripe-connect-delivery" aria-label="เชื่อมต่อ Stripe เพื่อรับชำระเงิน Delivery">
  <header className="stripe-connect-delivery-head">
   <span className="stripe-connect-delivery-head-icon"><i className="bi bi-credit-card-2-front" aria-hidden="true"/></span>
   <div className="stripe-connect-delivery-head-copy"><strong>รับชำระ Delivery ผ่าน Stripe Connect</strong><small>รับเงินเข้าบัญชี Stripe ของร้านโดยตรง ไม่ผ่านบัญชี Platform</small></div>
   <span className="stripe-connect-delivery-badge">ยังไม่เปิดใช้งาน</span>
  </header>
  <div className="stripe-connect-delivery-status" role="status">
   <div className="stripe-connect-delivery-status-line">
    <span className="stripe-connect-delivery-status-dot" aria-hidden="true"/>
    <div><strong>ยังไม่เปิดใช้งาน Stripe Connect สำหรับ Delivery</strong>
     <p>Firebase ยังไม่รองรับการเชื่อมบัญชีร้านและตรวจสอบสถานะ Stripe Connect จึงยังไม่สามารถเปิดรับชำระเงินผ่านช่องทางนี้ได้</p></div>
   </div>
  </div>
  <div className="stripe-connect-delivery-steps">
   <div><i className="bi bi-shield-check" aria-hidden="true"/><span><strong>1. ยืนยันประเภทกิจการ</strong><small>ตรวจสอบคุณสมบัติร้านอาหารกับ Stripe Thailand</small></span></div>
   <div><i className="bi bi-person-vcard" aria-hidden="true"/><span><strong>2. เชื่อมต่อบัญชีร้าน</strong><small>ใช้ Stripe-hosted onboarding ไม่เก็บ Secret Key ของร้าน</small></span></div>
   <div><i className="bi bi-bank" aria-hidden="true"/><span><strong>3. Stripe จ่ายเงินให้ร้าน</strong><small>รอบจ่ายเงินจริงขึ้นกับ Stripe และธนาคารของร้าน</small></span></div>
  </div>
  <div className="stripe-connect-delivery-foot">
   <div className="stripe-connect-delivery-foot-note"><i className="bi bi-info-circle" aria-hidden="true"/> ยังไม่เปิดรับเงินจากลูกค้าผ่าน Stripe Connect การชำระค่าบริการ Platform ใช้ระบบเดิม</div>
   <div className="stripe-connect-delivery-actions">
    <button type="button" className="stripe-connect-delivery-refresh" disabled><i className="bi bi-arrow-clockwise" aria-hidden="true"/> ตรวจสถานะอีกครั้ง</button>
    <button type="button" className="stripe-connect-delivery-start" disabled><i className="bi bi-lock" aria-hidden="true"/> เชื่อมต่อ Stripe</button>
   </div>
  </div>
 </section>;
}
