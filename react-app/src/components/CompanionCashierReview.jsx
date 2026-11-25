import {useEffect,useRef,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import {sweetConfirm} from "./sweetDialog";
import "@/ui/companion-cashier-review.css";
const labels={candidate:"พบยอดที่อาจตรง",ambiguous:"พบหลายรายการที่อาจตรง",no_match:"ไม่พบรายการที่ตรง",unavailable:"ยังยืนยันข้อมูลไม่ได้",receiver_unconfirmed:"บัญชีรับเงินยังไม่ยืนยัน",bounded_unavailable:"ข้อมูลมากเกินขอบเขตตรวจสอบ",window_expired:"หมดช่วงเวลาจับคู่",order_unavailable:"รายการยังไม่พร้อมตรวจสอบ",already_claimed:"รายการแจ้งเงินเข้าถูกใช้แล้ว",time_precision_review:"เวลาธุรกรรมต้องตรวจสอบเพิ่มเติม",recorded_unverified:"บันทึกการตรวจเบื้องต้นแล้ว"};
export function CompanionCashierReview({orderId,notify,notificationFirst=false}){
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[failure,setFailure]=useState(false),[open,setOpen]=useState(false);
 const lock=useRef(false),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 const run=async task=>{
  if(lock.current)return;lock.current=true;setBusy(true);setFailure(false);
  const id=++generation.current;
  try{await task(id);}catch{if(id===generation.current){setData(null);setFailure(true);notify?.("ยังยืนยันข้อมูล BankAlert ไม่ได้","error");}}
  finally{if(id===generation.current){lock.current=false;setBusy(false);}}
 };
 const read=async id=>{
  if(notificationFirst){
   const {data:r}=await httpsCallable(functions,"getDeliveryNotificationMatch")({orderId});
   if(r?.orderId!==orderId||r.paymentVerified!==false||r.bankConfirmed!==false||r.canReleaseKitchen!==false||
    r.canDispatchRider!==false||r.canSettleInvoice!==false)throw Error("REVIEW_UNCONFIRMED");
   if(id===generation.current)setData({enabled:true,item:r,canRecord:r.status==="candidate"&&/^[a-f0-9]{64}$/.test(r.notificationId||""),
    review:r.status==="recorded_unverified",demoEvidenceId:r.demoEvidenceId,demoEvidenceRecorded:r.demoEvidenceRecorded===true});
   return;
  }
  const {data:r}=await httpsCallable(functions,"getPaymentCompanionCashierReview")({orderId});
  if(typeof r?.enabled!=="boolean"||r.paymentVerified!==false||r.bankConfirmed!==false||r.canReleaseKitchen!==false)throw Error("REVIEW_UNCONFIRMED");
  if(r.item&&r.item.orderId!==orderId)throw Error("ORDER_MISMATCH");
  if(id===generation.current)setData(r);
 };
 const inspect=()=>{setOpen(true);void run(read);};
 const record=async()=>{
  if(!data?.canRecord||busy||!data.item?.notificationId)return;
  if(!await sweetConfirm(notificationFirst?"บันทึกผลจับคู่รายการแจ้งเงินเข้าเบื้องต้นหรือไม่? การบันทึกนี้ไม่ใช่การยืนยันรับเงินจริงและไม่ส่งเข้าครัว":"บันทึกว่าตรวจสอบข้อมูลแจ้งเงินเข้าและสลิปเบื้องต้นแล้วหรือไม่? การบันทึกนี้ไม่ได้ยืนยันรับเงิน ไม่เปลี่ยนสถานะชำระ และไม่ส่งเข้าครัว",{title:"บันทึกการตรวจ BankAlert",confirmText:"บันทึกการตรวจ",cancelText:"กลับ",type:"warning"}))return;
  await run(async id=>{
   const {data:r}=await httpsCallable(functions,notificationFirst?"recordDeliveryNotificationObservation":"recordPaymentCompanionCashierReview")({orderId,notificationId:data.item.notificationId,acknowledged:true});
   if(r?.recorded!==true||r.paymentVerified!==false||r.canReleaseKitchen!==false)throw Error("REVIEW_UNCONFIRMED");
   if(id===generation.current)notify?.("บันทึกการตรวจเบื้องต้นแล้ว");
   await read(id);
  });
 };
 const recordEvidence=async()=>{
  if(!notificationFirst||busy||data?.demoEvidenceRecorded||!/^[a-f0-9]{64}$/.test(data?.demoEvidenceId||""))return;
  await run(async id=>{
   const {data:r}=await httpsCallable(functions,"recordDeliveryDemoBankEvidencePreflight")({orderId,evidenceId:data.demoEvidenceId});
   if(r?.recorded!==true||r.status!=="demo_evidence_preflight_passed"||r.paymentVerified!==false||
    r.settlementAllowed!==false||r.bankConfirmed!==false||r.canReleaseKitchen!==false)throw Error("REVIEW_UNCONFIRMED");
   if(id===generation.current)notify?.("ตรวจหลักฐานจำลองเรียบร้อย ยังไม่ยืนยันรับเงินจริง");
   await read(id);
  });
 };
 return <section className="companion-cashier-review" data-companion-cashier-review>
  <button type="button" className="btn btn-sm" onClick={inspect} disabled={busy}><i className="bi bi-intersect" aria-hidden="true"/> {busy?"กำลังตรวจสอบ…":open?"ตรวจสอบ BankAlert อีกครั้ง":"ตรวจสอบ BankAlert"}</button>
  {open&&<div className="companion-cashier-review-body" role="status">
   {failure?"ไม่สามารถอ่านข้อมูลได้ กรุณาตรวจสอบอีกครั้ง":busy&&!data?"กำลังตรวจสอบข้อมูล…":data?.enabled===false?"ร้านนี้ยังไม่เปิด BankAlert":<>
    <strong>{data?.review?"บันทึกการตรวจเบื้องต้นแล้ว":labels[data?.item?.status]||"ยังไม่มีข้อมูลที่ยืนยันได้"}</strong>
    {Number.isSafeInteger(data?.item?.amountSatang)&&<small>ยอด {(data.item.amountSatang/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2})} บาท</small>}
    {data?.matchStatus==="receiver_unconfirmed"&&<small>เจ้าของร้านต้องยืนยันบัญชีรับเงินก่อน</small>}
    {data?.canRecord&&<button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={record}>บันทึกการตรวจเบื้องต้น</button>}
    {notificationFirst&&data?.demoEvidenceRecorded&&<small>ตรวจหลักฐานจำลองแล้ว · ยังไม่ยืนยันรับเงินจริง</small>}
    {notificationFirst&&data?.review&&!data?.demoEvidenceRecorded&&data?.demoEvidenceId&&<button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={recordEvidence}>ตรวจหลักฐานธนาคารจำลอง</button>}
    {notificationFirst&&data?.review&&!data?.demoEvidenceRecorded&&!data?.demoEvidenceId&&<small>รอหลักฐานธนาคารจำลองจากระบบ</small>}
    <small>ยังไม่ใช่การยืนยันชำระเงิน และไม่เปลี่ยนสิทธิ์การอนุมัติ Superadmin</small>
   </>}
  </div>}
 </section>;
}
