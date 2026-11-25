import {useEffect,useRef} from "react";
import {createPortal} from "react-dom";
import {PublicCartList} from "@/components/PublicStorefront";
import {useI18n} from "@/i18n/I18nProvider";
import "@/ui/delivery-checkout-review.css";

// Source checkout review adapted to PENGUIN, with no unsupported Stripe or COD
// payment rail. Visual review is NOT bank/payment authorization.
export function DeliveryCheckoutReviewDialog({
 open,onClose,onConfirm,busy=false,cart=[],subtotal=0,fee=0,total=0,
 paymentMethod="",paymentEnabled=false,routeReady=false,storeReady=false,
 uploadPending=false,money,
}){
 const headingRef=useRef(null),backRef=useRef(null);
 const {t}=useI18n();
 useEffect(()=>{
  if(!open)return;
  const previous=document.documentElement.style.overflow;
  document.documentElement.style.overflow="hidden";
  const returnFocus=document.activeElement;
  headingRef.current?.focus();
  const onKey=e=>{
   if(e.key==="Escape"&&!busy&&!uploadPending){e.preventDefault();onClose();}
   if(e.key!=="Tab")return;
   const dlg=document.getElementById("deliveryCheckoutReviewDialog");
   const options=[...dlg.querySelectorAll('button:not([disabled]),[href],input:not([disabled])')]
    .filter(el=>el.offsetParent!==null);
   if(!options.length)return;
   if(e.shiftKey&&document.activeElement===options[0]){
    e.preventDefault();options[options.length-1].focus();
   }else if(!e.shiftKey&&document.activeElement===options[options.length-1]){
    e.preventDefault();options[0].focus();
   }
  };
  document.addEventListener("keydown",onKey);
  return()=>{
   document.documentElement.style.overflow=previous;
   document.removeEventListener("keydown",onKey);
   returnFocus?.focus?.();
  };
 },[open,busy,uploadPending,onClose]);
 if(!open)return null;
 return createPortal(<div className="delivery-review-backdrop" data-delivery-review-backdrop
    onMouseDown={event=>{
     if(event.target===event.currentTarget&&!busy&&!uploadPending)onClose();
    }}>
    <section className="delivery-review-modal" role="dialog" aria-modal="true"
      aria-labelledby="deliveryCheckoutReviewTitle"
      aria-describedby="deliveryCheckoutReviewDescription"
      id="deliveryCheckoutReviewDialog">
      <header className="delivery-review-modal-header">
       <div>
        <h2 id="deliveryCheckoutReviewTitle" ref={headingRef} tabIndex={-1}>สรุปคำสั่งซื้อ</h2>
        <p id="deliveryCheckoutReviewDescription">ตรวจสอบรายการและวิธีชำระเงินก่อนยืนยัน</p>
       </div>
       <button type="button" className="delivery-review-close" aria-label="ปิดหน้าทบทวน"
         disabled={busy||uploadPending} onClick={onClose}>
         <i className="bi bi-x-lg" aria-hidden="true" />
       </button>
      </header>
      <div className="delivery-review-modal-body">
       <section className="card delivery-review-cart" aria-label="รายการอาหารในคำสั่งซื้อ">
        <div className="section-title">
         <h3><i className="bi bi-cart3 app-icon" aria-hidden="true"/> {t("delivery.checkout.menu.cart_title")}</h3>
         <span className="badge">{cart.reduce((sum,row)=>sum+Number(row.qty||0),0)}</span>
        </div>
        <div id="deliveryReviewItems">
         <PublicCartList items={cart} prefix="delivery.checkout.cart" readOnly
           emptyTextKey="delivery.checkout.menu.cart_empty"/>
        </div>
       </section>
       <section className="delivery-review-summary" aria-label="สรุปยอดชำระ">
        <div><span>ค่าอาหาร</span><strong>{money(subtotal)} บาท</strong></div>
        <div><span>ค่าจัดส่ง</span><strong>{money(fee)} บาท</strong></div>
        <div className="delivery-review-total">
         <span>ยอดรวมพร้อมค่าส่ง</span><strong>{money(total)} บาท</strong>
        </div>
       </section>
       <fieldset className="delivery-review-payment" id="reviewPaymentMethod">
        <legend>วิธีชำระเงิน *</legend>
        {paymentEnabled&&paymentMethod==="promptpay"?
         <label className="delivery-payment-option is-selected">
          <input type="radio" value="promptpay" checked readOnly name="reviewPaymentMethod"/>
          <i className="bi bi-qr-code" aria-hidden="true"/>
          <span>{t("delivery.checkout.payment.promptpay_option")}</span>
         </label>:<p role="alert">ยังไม่มีช่องทางชำระเงินที่อนุญาตให้ยืนยันคำสั่งซื้อ</p>}
        <small>การยืนยันคำสั่งซื้อไม่ใช่การยืนยันจากธนาคาร
         กรุณาตรวจสอบชื่อผู้รับและยอดเงินก่อนโอน</small>
       </fieldset>
      </div>
      <footer className="delivery-review-modal-footer">
       <button type="button" className="btn" id="editCheckoutOrder" ref={backRef}
         disabled={busy||uploadPending} onClick={onClose}>
        <i className="bi bi-pencil app-icon" aria-hidden="true"/> กลับไปแก้ไข
       </button>
       <button type="button" className="btn btn-primary" id="confirmCheckoutOrder"
         disabled={busy||uploadPending||!cart.length||!paymentEnabled||
           !routeReady||!storeReady} onClick={onConfirm}>
        <i className={"bi bi-"+(busy?"hourglass-split":"check-lg")+" app-icon"}
          aria-hidden="true"/>
        {busy?"กำลังบันทึก...":"ยืนยันคำสั่งซื้อ"}
       </button>
      </footer>
    </section>
   </div>,document.body);
}
