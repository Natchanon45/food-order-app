import {useEffect,useMemo,useRef,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import {generatePromptPayPayload} from "@/utils/promptPay";
import {qrDataUrl} from "@/utils/localQr";
import {uploadPublicPaymentSlip} from "@/data/publicStorefrontData";
import "@/ui/companion-qr.css";
const qrStatus=httpsCallable(functions,"getPublicCompanionQrState");
const submitLateSlip=httpsCallable(functions,"submitPublicCompanionLateSlip",{timeout:70000});
const capKey=(tenantId,orderId)=>"penguin:companion-qr-cap:"+tenantId+":"+orderId;
const validCap=token=>/^[a-f0-9]{64}$/.test(token||"");
export function CompanionConfirmedQr({tenant,order,orderId,onToast=()=>{}}){
 const [server,setServer]=useState(null),[issue,setIssue]=useState(false),[now,setNow]=useState(Date.now());
 const [file,setFile]=useState(null),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState("");
 const stagedPath=useRef(""),lock=useRef(false);
 const [capability,setCapability]=useState("");
 const tenantId=tenant?.id||"";
 useEffect(()=>{
  let alive=true,timer;
  setServer(null);setIssue(false);
  if(!tenantId||!orderId||order?.paymentQrMode!=="confirmed_order_5m")return()=>{alive=false};
  try{const cap=sessionStorage.getItem(capKey(tenantId,orderId))||"";setCapability(validCap(cap)?cap:"");}catch{setCapability("");}
  const refresh=async()=>{
   try{
    const response=await qrStatus({tenantId,orderId});
    const row=response?.data;
    if(!alive)return;
    if(!["confirmed_order_5m","invalid","resolved","none"].includes(row?.mode)||
      typeof row?.active!=="boolean"||typeof row?.canUploadSlip!=="boolean")throw Error("QR_STATE_UNCONFIRMED");
    setServer({...row,_clientReceivedAt:Date.now()});setIssue(false);
   }catch{if(alive){setServer(null);setIssue(true);}}
   finally{if(alive)timer=window.setTimeout(refresh,document.visibilityState==="visible"?3000:6000);}
  };
  void refresh();
  return()=>{alive=false;window.clearTimeout(timer);};
 },[tenantId,orderId,order?.paymentQrMode,order?.paymentStatus,order?.paymentSlipPath,order?.status]);
 useEffect(()=>{
  if(!server?.active)return;
  const timer=window.setInterval(()=>setNow(Date.now()),1000);
  setNow(Date.now());
  return()=>window.clearInterval(timer);
 },[server?.active,server?.expiresAtUTC]);
 const expiration=new Date(server?.expiresAtUTC||"").getTime();
 const serverOffset=Number.isFinite(server?.serverNowMs)?server.serverNowMs-(server._clientReceivedAt||now):0;
 // The expiry is stored server-side. The client never writes it back.
 const seconds=server?.active&&Number.isFinite(expiration)?Math.max(0,Math.ceil((expiration-(now+serverOffset))/1000)):0;
 const displayQr=order?.paymentStatus==="pending_verification"&&order?.status==="pending"&&server?.active===true&&seconds>0&&!order?.paymentSlipPath;
 const qrImage=useMemo(()=>{
  if(!displayQr||!server?.recipientId||!Number.isFinite(order?.totalAmount)||order.totalAmount<=0)return "";
  try{return qrDataUrl(generatePromptPayPayload(server.recipientId,order.totalAmount),{size:320,margin:4});}catch{return "";}
 },[displayQr,server?.recipientId,order?.totalAmount]);
 const availableFallback=order?.paymentStatus==="pending_verification"&&server?.canUploadSlip===true&&!order?.paymentSlipPath;
 const submit=async()=>{
  if(lock.current||!file||!availableFallback||!validCap(capability))return;
  lock.current=true;setBusy(true);setFeedback("");
  try{
   if(!/\.(?:jpe?g|png|webp)$/i.test(file.name||"")||!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size<=0||file.size>8*1024*1024)throw Error("COMPANION_SLIP_INVALID");
   if(!stagedPath.current){
    const uploaded=await uploadPublicPaymentSlip(tenant,file,orderId);
    if(!uploaded.path)throw Error("COMPANION_SLIP_UPLOAD_UNCONFIRMED");
    stagedPath.current=uploaded.path;
   }
   const result=await submitLateSlip({tenantId,orderId,capability,slipPath:stagedPath.current});
   if(result?.data?.ok!==true||result?.data?.paymentVerified!==false||result?.data?.kitchenReleased!==false||result?.data?.status!=="pending_manual_review")throw Error("COMPANION_SLIP_REVIEW_UNCONFIRMED");
   setFeedback("รับสลิปต้นฉบับเพื่อรอตรวจสอบแล้ว ยังไม่ถือว่าชำระเงินสำเร็จ");
   onToast("ส่งสลิปเพื่อตรวจสอบเรียบร้อยแล้ว");
   setServer(null);setFile(null);
   try{sessionStorage.removeItem(capKey(tenantId,orderId));}catch{}
   setCapability("");
  }catch{
   setFeedback("ยังไม่สามารถยืนยันการรับสลิปได้ กรุณาตรวจสอบรายการอีกครั้ง ก่อนส่งซ้ำ");
   onToast("ยังไม่ยืนยันการรับสลิป กรุณาลองใหม่","error");
  }finally{lock.current=false;setBusy(false);}
 };
 if(!tenantId||order?.paymentQrMode!=="confirmed_order_5m")return null;
 return <section className="companion-qr-card" role="region" aria-label="ชำระเงินด้วย QR PromptPay หลังยืนยันออเดอร์" data-companion-confirmed-qr>
  <h3><i className="bi bi-qr-code" aria-hidden="true"/> QR PromptPay · คำสั่งซื้อที่ยืนยันแล้ว</h3>
  <strong>เลขที่รายการ {String(order?.billNo||orderId).slice(0,40)}</strong>
  {!server&&<small role={issue?"alert":"status"}>{issue?"ยังไม่สามารถตรวจสอบสถานะ QR จากเซิร์ฟเวอร์ได้ กรุณาลองรีเฟรชอีกครั้ง":"กำลังตรวจสอบ QR จากเซิร์ฟเวอร์…"}</small>}
  {displayQr&&qrImage&&<><div className="companion-qr-countdown" role="timer">{String(Math.floor(seconds/60)).padStart(2,"0")}:{String(seconds%60).padStart(2,"0")}</div>
    <img src={qrImage} width="260" height="260" alt="QR PromptPay สำหรับรายการที่ยืนยันแล้ว"/>
    <strong>{Number(order.totalAmount).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2})} บาท</strong>
    <small>ผู้รับเงิน: {server.recipientName||"ร้านค้า"} · QR หมดอายุภายใน 5 นาทีจากเวลาที่บันทึกออเดอร์</small>
    <small>โปรดตรวจสอบชื่อผู้รับก่อนชำระ ระบบยังไม่ยืนยันเงินเข้า และยังไม่ส่งครัว</small>
  </>}
  {server?.reason==="pilot_disabled"&&<small className="companion-qr-error" role="alert">ระบบ QR ทดสอบปิดใช้งานชั่วคราว กรุณาติดต่อร้านค้าเพื่อให้เจ้าหน้าที่ตรวจสอบ</small>}
  {server?.reason==="kitchen_admitted"&&<small role="status">ร้านรับออเดอร์เข้าครัวเบื้องต้นแล้ว แต่ยังไม่ยืนยันว่าชำระเงินสำเร็จ และยังไม่เรียกผู้จัดส่ง</small>}
  {server?.mode==="resolved"&&<small role="status">สถานะการชำระเงินของรายการนี้เปลี่ยนแล้ว กรุณาตรวจสอบข้อมูลด้านล่าง</small>}
  {!displayQr&&server?.mode==="confirmed_order_5m"&&!availableFallback&&<small role="status">อยู่ระหว่างตรวจหลักฐานการชำระเงิน กรุณาตรวจสอบกับร้านค้า</small>}
  {availableFallback&&<div className="companion-qr-fallback">
    <strong>ไม่พบผลยืนยันการชำระ หรือ QR ใช้งานไม่ได้แล้ว</strong>
    <small>กรุณาแนบสลิปต้นฉบับเพื่อให้ร้านตรวจสอบ โดยไม่สร้างออเดอร์หรือ QR ใหม่</small>
    {capability?<><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="แนบสลิปต้นฉบับ" disabled={busy} onChange={event=>{setFile(event.target.files?.[0]||null);stagedPath.current="";setFeedback("");}}/>
      <button type="button" className="btn btn-primary" disabled={!file||busy} onClick={submit}>{busy?"กำลังส่งข้อมูลเพื่อตรวจสอบ…":"ส่งสลิปต้นฉบับเพื่อตรวจสอบ"}</button></>:<small className="companion-qr-error">ไม่พบสิทธิ์แนบสลิปของรายการนี้ในเบราว์เซอร์ กรุณาติดต่อร้านค้าพร้อมเลขรายการ</small>}
  </div>}
  {feedback&&<small role="status">{feedback}</small>}
  {server?.mode==="invalid"&&<small className="companion-qr-error">ข้อมูล QR ไม่ครบถ้วน กรุณาติดต่อร้านค้า</small>}
 </section>;
}
