import {useEffect,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import {sweetConfirm} from "@/components/sweetDialog";
import "@/ui/m7-stripe-test-reservation.css";
const money=n=>Number.isSafeInteger(n)&&n>0?
 (n/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2})+" บาท":"—";
export function M7StripeTestReservation({tenantId="",notify=()=>{}}){
 const [phase,setPhase]=useState("loading"),[items,setItems]=useState([]),[busy,setBusy]=useState("");
 const [quotes,setQuotes]=useState({}),[revision,setRevision]=useState(0);
 const [gateway,setGateway]=useState({available:false,items:[]});
 useEffect(()=>{
  let active=true;
  setPhase("loading");setItems([]);setQuotes({});
  // Do not discover tenant IDs or show a Stripe CTA for an unrelated store.
  if(!tenantId)return()=>{active=false;};
  httpsCallable(functions,"getOwnM7StripeTestQuoteReadiness")({}).then(({data})=>{
   if(!active)return;
   if(data?.ok!==true||data.checkoutEnabled!==false||data.settlementEnabled!==false||
      typeof data.quoteEnabled!=="boolean"||!Array.isArray(data.invoices)||
      data.invoices.some(i=>typeof i.invoiceId!=="string"||!Number.isSafeInteger(i.amountSatang)||i.amountSatang<=0))
     throw Error("M7_STRIPE_TEST_QUOTE_READ_UNCONFIRMED");
   setPhase(data.quoteEnabled?"ready":"disabled");setItems(data.quoteEnabled?data.invoices:[]);
  }).catch(()=>{if(active){setPhase("disabled");setItems([]);}});
  return()=>{active=false;};
 },[tenantId,revision]);
 useEffect(()=>{
  let active=true;
  setGateway({available:false,items:[]});
  if(!tenantId)return()=>{active=false;};
  httpsCallable(functions,"getOwnM7StripeTestCheckoutStatus")({}).then(({data})=>{
   if(!active)return;
   if(data?.ok!==true||data.mode!=="test"||
      data.operationalSettlementEnabled!==false||typeof data.available!=="boolean"||
      !Array.isArray(data.items)||data.items.some(row=>
       typeof row.invoiceId!=="string"||!Number.isSafeInteger(row.amountSatang)||
       row.amountSatang<1000||row.invoicePaid!==false||
       row.operationalSettlementEnabled!==false))throw Error("M7_SHADOW_STATUS_UNCONFIRMED");
   setGateway(data.available===true&&data.checkoutEnabled===true&&data.shadowLedgerEnabled===true
     ?{available:true,items:data.items}:{available:false,items:[]});
  }).catch(()=>{if(active)setGateway({available:false,items:[]});});
  return()=>{active=false;};
 },[tenantId,revision]);
 const safeURL=raw=>{
  try{
   const u=new URL(raw);
   return u.protocol==="https:"&&u.hostname==="checkout.stripe.com"&&!u.port&&
     !u.username&&!u.password&&/^\/(c|g)\/pay\//.test(u.pathname)?u.href:"";
  }catch{return "";}
 };
 const startCheckout=async invoice=>{
  if(!gateway.available||busy||phase!=="ready")return;
  const proceed=await sweetConfirm(
   "เปิด Stripe TEST Checkout สำหรับ Invoice นี้หรือไม่? Stripe TEST ใช้ข้อมูลจำลอง ไม่ใช่เงินจริง แม้ Stripe TEST ยืนยันสำเร็จ ระบบจะบันทึกใน Shadow Ledger เท่านั้น และ Invoice จริงยังไม่เป็น Paid",
   {title:"Stripe M7 · ทดสอบ Checkout",confirmText:"เริ่ม Checkout TEST",cancelText:"กลับ",type:"warning"});
  if(!proceed)return;
  setBusy(invoice.invoiceId);
  try{
   const {data}=await httpsCallable(functions,"createOwnM7StripeTestCheckout")({invoiceId:invoice.invoiceId});
   const item=data?.item;
   if(data?.ok!==true||data.invoicePaid!==false||data.operationalSettlementEnabled!==false||
      item?.invoiceId!==invoice.invoiceId||item?.amountSatang!==invoice.amountSatang||
      item.currency!=="THB"||item.mode!=="test"||
      item.invoicePaid!==false||item.operationalSettlementEnabled!==false||
      !["checkout_ready","provider_requesting","verified_test"].includes(data.providerStatus)||
      typeof item.checkoutUrl!=="string")
    throw Error("M7_STRIPE_TEST_CHECKOUT_UNCONFIRMED");
   const url=safeURL(item.checkoutUrl);
   if(data.providerStatus==="checkout_ready"&&!url)throw Error("M7_STRIPE_TEST_CHECKOUT_URL_INVALID");
   setQuotes(previous=>({...previous,[invoice.invoiceId]:item}));
   notify(data.providerStatus==="checkout_ready"?
     "สร้างลิงก์ Stripe TEST แล้ว Invoice จริงยังไม่ใช่ Paid":
     "รายการทดสอบรอตรวจสอบกับ Stripe ห้ามสร้าง Checkout ใหม่หรือถือว่าชำระสำเร็จ");
  }catch{notify("ไม่สามารถยืนยัน Stripe TEST Checkout ได้ กรุณาตรวจสอบสถานะกับผู้ดูแลก่อนลองใหม่","error");}
  finally{setBusy("");}
 };
 const reserve=async invoice=>{
  if(busy||phase!=="ready"||!invoice?.invoiceId)return;
  const proceed=await sweetConfirm("ระบบจะจองยอดจาก Invoice ที่บันทึกใน Firebase เท่านั้น ยังไม่มี Stripe Checkout และจะไม่รับเงินหรือเปลี่ยนสถานะ Paid",
    {title:"จองยอด M7 สำหรับ UAT",confirmText:"จองยอดทดสอบ",cancelText:"กลับ",type:"warning"});
  if(!proceed)return;
  setBusy(invoice.invoiceId);
  try{
   const {data}=await httpsCallable(functions,"reserveOwnM7StripeTestInvoice")({invoiceId:invoice.invoiceId});
   const quote=data?.quote;
   if(data?.ok!==true||data?.readOnlyFinancials!==true||
      quote?.invoiceId!==invoice.invoiceId||quote.currency!=="THB"||
      quote.amountSatang!==invoice.amountSatang||
      quote.providerCheckoutCreated!==false||quote.checkoutEnabled!==false||
      quote.settlementEnabled!==false||quote.settled!==false||quote.status!=="reserved")
     throw Error("M7_STRIPE_TEST_QUOTE_UNCONFIRMED");
   setQuotes(previous=>({...previous,[invoice.invoiceId]:quote}));
   notify(data.reused?"พบรายการจองยอดทดสอบเดิม ไม่สร้างยอดใหม่":"สร้างรายการจองยอดทดสอบแล้ว ยังไม่ได้เรียกเก็บเงินจริง");
  }catch{
   notify("ไม่สามารถยืนยันการจองยอดทดสอบได้ กรุณารีเฟรชและตรวจสอบ Invoice","error");
  }finally{setBusy("");}
 };
 if(phase==="disabled"||phase==="loading")return null;
 return <details className="m7-stripe-test-reservation" data-m7-stripe-test-quote>
  <summary><i className="bi bi-shield-lock" aria-hidden="true"/> <span>Stripe M7 · จองยอดทดสอบ (ยังไม่รับเงิน)</span><i className="bi bi-chevron-down" aria-hidden="true"/></summary>
  <section className="card m7-stripe-test-quote-card">
   <header><div><h3>จองยอด M7 จาก Invoice จริงในระบบ</h3>
     <p>เฉพาะร้าน UAT ที่เซิร์ฟเวอร์อนุญาต · จองยอดจาก Invoice เดิม และอาจเปิด Stripe TEST Checkout เมื่อเซิร์ฟเวอร์เปิดสิทธิ์เฉพาะทาง ทั้งหมดไม่ใช่ยอด Paid ของระบบบัญชี</p>
    </div><button type="button" className="btn btn-sm" onClick={()=>setRevision(v=>v+1)} disabled={!!busy}><i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรช</button></header>
   <div className="m7-stripe-test-quote-warning"><i className="bi bi-exclamation-circle" aria-hidden="true"/>
    Stripe TEST เป็นเงินจำลองเท่านั้น แม้ Stripe ยืนยันแล้วก็ยังไม่เปลี่ยน Invoice เป็น Paid ไม่เพิ่ม Service Credit ไม่ส่งครัว และไม่ปลดระงับร้านค้า
   </div>
   {items.length?<div className="m7-stripe-test-quote-list">{items.map(item=>{
    const prior=quotes[item.invoiceId]||gateway.items.find(entry=>entry.invoiceId===item.invoiceId);
    const providerReady=gateway.available&&prior?.status==="reserved";
    const verified=prior?.status==="verified_test"||prior?.status==="provider_test_verified";
    const url=safeURL(prior?.checkoutUrl);
    return <article key={item.invoiceId} className="m7-stripe-test-quote-item">
     <div><strong>{item.kind==="monthly"?"ค่าบริการรายเดือน":"ส่วนแบ่ง Delivery รายวัน"} · {money(item.amountSatang)}</strong>
       <small>Invoice: <code>{item.invoiceId}</code></small>
       {prior&&<small role="status">{verified?"Stripe TEST ยืนยันใน Shadow Ledger แล้ว · Invoice จริงยังไม่เป็น Paid":
        prior.status==="provider_requesting"?"รอผล Stripe TEST · ห้ามสร้าง Checkout ใหม่":
        prior.status==="checkout_ready"?"เปิด Checkout TEST แล้ว · รอผล Webhook":
        "จองยอดแล้ว · ครั้งที่ "+prior.attemptNo+" · ยังไม่สร้าง Stripe Checkout"}</small>}
     </div>
     <div className="m7-stripe-test-quote-actions">
      {!prior&&<button type="button" className="btn btn-sm" disabled={!!busy} onClick={()=>reserve(item)}>
       <i className="bi bi-lock" aria-hidden="true"/> {busy===item.invoiceId?"กำลังตรวจสอบ…":"จองยอดทดสอบ"}
      </button>}
      {prior?.status==="reserved"&&!gateway.available&&
       <button type="button" className="btn btn-sm" disabled={!!busy} onClick={()=>reserve(item)}>
        <i className="bi bi-lock" aria-hidden="true"/> ตรวจสอบรายการจองเดิม
       </button>}
      {providerReady&&<button type="button" className="btn btn-sm" disabled={!!busy}
       onClick={()=>startCheckout(item)}><i className="bi bi-credit-card" aria-hidden="true"/> เริ่ม Stripe TEST Checkout</button>}
      {prior?.status==="checkout_ready"&&url&&<a className="btn btn-sm" href={url}
       rel="noreferrer noopener" target="_blank"><i className="bi bi-box-arrow-up-right" aria-hidden="true"/> เปิดหน้า Stripe TEST</a>}
     </div>
    </article>;
   })}</div>:<p className="m7-stripe-test-quote-empty">ไม่มี Invoice ที่รองรับการจองยอด M7 แบบทดสอบในขณะนี้</p>}
  </section>
 </details>;
}
