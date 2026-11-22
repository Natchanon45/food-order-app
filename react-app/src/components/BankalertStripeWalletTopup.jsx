import {useEffect,useRef,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import {BankalertStripeHistory,stripeWalletDate,stripeWalletStatus} from "./BankalertStripeHistory";
import {sweetConfirm} from "./sweetDialog";
import "@/ui/bankalert-stripe-wallet.css";

const money=satang=>Number.isSafeInteger(satang)?(satang/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";
const safeURL=value=>{try{const u=new URL(value);return u.protocol==="https:"&&u.hostname==="checkout.stripe.com"&&!u.username&&!u.password&&!u.port&&/^\/(c|g)\/pay\//.test(u.pathname)?u.href:"";}catch{return "";}};
const validRef=value=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value||"");
const calls={getOwnStripeWalletSandbox:()=>httpsCallable(functions,"getOwnStripeWalletSandbox"),createStripeWalletSandboxCheckout:()=>httpsCallable(functions,"createStripeWalletSandboxCheckout"),checkStripeWalletSandboxCheckout:()=>httpsCallable(functions,"checkStripeWalletSandboxCheckout"),expireStripeWalletSandboxCheckout:()=>httpsCallable(functions,"expireStripeWalletSandboxCheckout")};
const invoke=async(name,payload={})=>{const {data}=await calls[name]()(payload);if(data?.ok!==true)throw Error("SANDBOX_RESPONSE_UNCONFIRMED");return data;};

export function BankalertStripeWalletTopup({approved=false}){
 const [state,setState]=useState(null),[amount,setAmount]=useState("300"),[item,setItem]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const lock=useRef(false),generation=useRef(0),unconfirmed=useRef(null);
 const load=async(id)=>{
  const data=await invoke("getOwnStripeWalletSandbox",{});
  if(data.mode!=="test"||!Array.isArray(data.items)||typeof data.available!=="boolean"||(data.balanceSatang!==null&&!Number.isSafeInteger(data.balanceSatang)))throw Error("SANDBOX_STATE_INVALID");
  if(generation.current!==id)return;
  setState(data);
  if(data.pendingCheckout){
   setItem(data.pendingCheckout);setAmount(String(data.pendingCheckout.amountSatang/100));
   unconfirmed.current=null;
  }
  return data;
 };
 const run=async(action)=>{
  if(lock.current)return;
  lock.current=true;setBusy(true);setError("");
  const id=++generation.current;
  try{await action(id);}catch{if(generation.current===id)setError("ยังไม่สามารถยืนยันสถานะกับระบบได้ กรุณาตรวจสอบรายการเดิมก่อนทำรายการใหม่");}
  finally{if(generation.current===id){lock.current=false;setBusy(false);}}
 };
 useEffect(()=>{void run(async id=>{
  const data=await load(id);
  const params=new URLSearchParams(window.location.search);
  const reference=params.get("lalamove_stripe_return")||params.get("lalamove_stripe_cancel");
  // Return query is only an identifier; display the persisted server record.
  if(data&&!data.pendingCheckout&&validRef(reference)){
   const recorded=data.items.find(row=>row.referenceId===reference);
   if(recorded&&generation.current===id)setItem(recorded);
  }
 });return()=>{generation.current++;lock.current=false;};},[]);
 const refresh=()=>run(async id=>{
  const data=await load(id);
  const ref=data?.pendingCheckout?.referenceId||item?.referenceId||unconfirmed.current?.referenceId;
  if(!validRef(ref))return;
  const result=await invoke("checkStripeWalletSandboxCheckout",{referenceId:ref});
  if(generation.current!==id)return;
  setItem(result.item);unconfirmed.current=null;
  await load(id);
 });
 const ready=approved&&state?.available===true;
 const terminal=["verified","expired","canceled","failed"].includes(item?.status);
 const checkout=()=>run(async id=>{
  if(!ready||terminal)return;
  const pending=item?.status==="created"?{referenceId:item.referenceId,amount:String(item.amountSatang/100)}:unconfirmed.current;
  if(item&&!pending)return;
  if(!pending&&(!/^\d{1,6}(\.\d{1,2})?$/.test(amount)||Number(amount)<10||Number(amount)>999999.99)){setError("กรุณาระบุจำนวนเงินตั้งแต่ 10.00 ถึง 999,999.99 บาท");return;}
  const request=pending||{referenceId:crypto.randomUUID(),amount};
  unconfirmed.current=request;
  const result=await invoke("createStripeWalletSandboxCheckout",request);
  if(generation.current!==id)return;
  if(!result.item||result.item.referenceId!==request.referenceId)throw Error("SANDBOX_REFERENCE_MISMATCH");
  setItem(result.item);unconfirmed.current=null;
  // Do not auto-open a provider URL after an asynchronous call: user uses
  // the explicit, validated resume link below, avoiding popup blockers.
  await load(id);
 });
 const expire=async()=>{
  if(busy||item?.status!=="checkout_ready")return;
  const ref=item.referenceId;
  if(!await sweetConfirm("ปิด QR ทดสอบรายการนี้ที่ Stripe หรือไม่? ระบบจะตรวจสอบผลก่อนให้เริ่มรายการใหม่",{title:"ยืนยันปิด Checkout",confirmText:"ปิด QR",cancelText:"กลับ",danger:true,type:"warning"}))return;
  await run(async id=>{
   const result=await invoke("expireStripeWalletSandboxCheckout",{referenceId:ref});
   if(generation.current!==id)return;
   if(!["expired","verified"].includes(result.item?.status))throw Error("SANDBOX_EXPIRY_UNCONFIRMED");
   setItem(result.item);await load(id);
  });
 };
 const resume=ready&&item?.status==="checkout_ready"?safeURL(item.checkoutUrl):"";
 const locked=busy||!ready||!!item||!!unconfirmed.current;
 return <section className="admin-lalamove-wallet-topup bankalert-wallet-topup" data-bankalert-stripe-wallet-topup role="region" aria-label="ทดสอบเติมเครดิต Lalamove ผ่าน Stripe PromptPay">
  <div className="bankalert-wallet-heading"><div className="bankalert-wallet-heading-left"><span className="bankalert-wallet-heading-icon"><i className="bi bi-wallet2" aria-hidden="true"/></span><div><strong>เติมเครดิต Lalamove (ทดสอบ)</strong><small>Stripe PromptPay · แยกจากเครดิตที่ใช้จัดส่งจริง</small></div></div><span className="bankalert-wallet-test-badge"><i className="bi bi-shield-check" aria-hidden="true"/> Stripe Sandbox</span></div>
  <div className={"bankalert-wallet-state "+(ready?"is-ready":"is-pending")}><i className={"bi "+(ready?"bi-check-circle-fill":"bi-exclamation-circle")} aria-hidden="true"/><div><strong>{ready?"พร้อมทดสอบ PromptPay":!state?"กำลังตรวจสอบระบบ Sandbox":"Stripe Sandbox ยังไม่พร้อมใช้งาน"}</strong><small>ใช้เฉพาะร้านทดสอบที่ได้รับอนุญาตและ Webhook ที่ยืนยันแล้ว เครดิตทดสอบไม่สามารถนำไปจัดส่งจริง</small></div></div>
  <div className="bankalert-wallet-amount-summary"><span>เครดิต Sandbox (แยกจากยอดจริง)</span><strong>{money(state?.balanceSatang)} บาท</strong></div>
  <div className="bankalert-wallet-form"><div className="bankalert-wallet-form-title"><div><strong>จำนวนเงินที่ต้องการทดสอบ</strong><small>เลือกจำนวนเงิน หรือระบุจำนวนเงินเอง</small></div><span className="bankalert-wallet-currency">THB</span></div>
   <label className="bankalert-wallet-amount"><span className="bankalert-wallet-amount-input-wrap"><span className="bankalert-wallet-baht-sign">฿</span><input className="input admin-lalamove-wallet-amount-input" aria-label="จำนวนเงินเติมเครดิตทดสอบ (บาท)" type="text" inputMode="decimal" value={amount} disabled={locked} onChange={e=>setAmount(e.target.value)}/><span className="bankalert-wallet-amount-unit">บาท</span></span></label>
   <div className="bankalert-wallet-quick-amounts" aria-label="เลือกจำนวนเงิน">{[100,200,300,500,1000].map(n=><button key={n} className={"bankalert-wallet-quick-amount "+(Number(amount)===n?"is-selected":"")} type="button" disabled={locked} aria-pressed={Number(amount)===n} onClick={()=>setAmount(String(n))}>฿{n.toLocaleString("th-TH")}</button>)}</div>
   {item&&<div className={"bankalert-wallet-payment is-"+(stripeWalletStatus[item.status]?.tone||"waiting")} role="status"><div className="bankalert-wallet-payment-heading"><span>รายการทดสอบปัจจุบัน</span><span className={"bankalert-wallet-status-pill is-"+(stripeWalletStatus[item.status]?.tone||"waiting")}>{stripeWalletStatus[item.status]?.label||"รอตรวจสอบ"}</span></div><div className="bankalert-wallet-payment-reference"><small>เลขอ้างอิง</small><code>{item.referenceId}</code><span>{stripeWalletDate(item.createdAt)}</span></div><small>การกลับจาก Stripe ไม่ถือว่าชำระสำเร็จ จนกว่าระบบยืนยันจาก Stripe</small></div>}
   {error&&<div className="bankalert-wallet-error" role="alert">{error}</div>}
   <div className="bankalert-wallet-actions">
    {!resume&&!terminal&&(!item||item.status==="created")&&<button type="button" className="btn btn-primary bankalert-wallet-primary" disabled={busy||!ready} onClick={checkout}><i className="bi bi-qr-code" aria-hidden="true"/> {item||unconfirmed.current?"ดำเนินรายการเดิมต่อ":"สร้าง QR ทดสอบ"}</button>}
    {resume&&<a className="btn btn-primary bankalert-wallet-primary" href={resume} target="_blank" rel="noopener noreferrer"><i className="bi bi-box-arrow-up-right" aria-hidden="true"/> เปิด Stripe Checkout</a>}
    {item?.status==="checkout_ready"&&<button type="button" className="btn bankalert-wallet-cancel" disabled={busy} onClick={expire}><i className="bi bi-x-circle" aria-hidden="true"/> ปิด QR / ทดสอบหมดอายุ</button>}
    <button type="button" className="btn bankalert-wallet-secondary" disabled={busy} onClick={refresh}><i className="bi bi-arrow-clockwise" aria-hidden="true"/> ตรวจสอบสถานะ</button>
    {terminal&&<button type="button" className="btn bankalert-wallet-secondary" disabled={busy} onClick={()=>run(async id=>{const data=await load(id);if(!data?.pendingCheckout){setItem(null);unconfirmed.current=null;}})}><i className="bi bi-plus-circle" aria-hidden="true"/> เริ่มรายการใหม่</button>}
   </div>
  </div>
  {state&&state.balanceSatang!==null?<BankalertStripeHistory items={state.items}/>:<p role="status">ยังไม่สามารถยืนยันประวัติเครดิตทดสอบ</p>}
 </section>;
}
