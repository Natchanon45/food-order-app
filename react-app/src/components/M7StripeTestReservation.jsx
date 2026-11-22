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
     <p>เฉพาะร้าน UAT ที่เซิร์ฟเวอร์อนุญาต · เป็นเพียงการจองยอด ไม่ใช่ Checkout, Settlement หรือสถานะ Paid</p>
    </div><button type="button" className="btn btn-sm" onClick={()=>setRevision(v=>v+1)} disabled={!!busy}><i className="bi bi-arrow-clockwise" aria-hidden="true"/> รีเฟรช</button></header>
   <div className="m7-stripe-test-quote-warning"><i className="bi bi-exclamation-circle" aria-hidden="true"/> ไม่สามารถชำระเงินจริงในส่วนนี้ได้ และไม่ส่งครัว/ไม่ปลดระงับร้านค้า</div>
   {items.length?<div className="m7-stripe-test-quote-list">{items.map(item=>{
    const prior=quotes[item.invoiceId];
    return <article key={item.invoiceId} className="m7-stripe-test-quote-item">
     <div><strong>{item.kind==="monthly"?"ค่าบริการรายเดือน":"ส่วนแบ่ง Delivery รายวัน"} · {money(item.amountSatang)}</strong>
       <small>Invoice: <code>{item.invoiceId}</code></small>
       {prior&&<small role="status">จองยอดแล้ว · ครั้งที่ {prior.attemptNo} · ยังไม่สร้าง Stripe Checkout</small>}
     </div>
     <button type="button" className="btn btn-sm" disabled={!!busy} onClick={()=>reserve(item)}>
       <i className="bi bi-lock" aria-hidden="true"/> {busy===item.invoiceId?"กำลังตรวจสอบ…":prior?"ตรวจสอบรายการจองเดิม":"จองยอดทดสอบ"}
     </button>
    </article>;
   })}</div>:<p className="m7-stripe-test-quote-empty">ไม่มี Invoice ที่รองรับการจองยอด M7 แบบทดสอบในขณะนี้</p>}
  </section>
 </details>;
}
