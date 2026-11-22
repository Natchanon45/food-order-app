import {useEffect,useRef,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import {sweetConfirm} from "./sweetDialog";
import "@/ui/companion-cashier-review.css";
const labels={candidate:"พบยอดที่อาจตรง",ambiguous:"พบหลายรายการที่อาจตรง",no_match:"ไม่พบรายการที่ตรง",unavailable:"ยังยืนยันข้อมูลไม่ได้"};
export function CompanionCashierReview({orderId,notify}){
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
  const {data:r}=await httpsCallable(functions,"getPaymentCompanionCashierReview")({orderId});
  if(typeof r?.enabled!=="boolean"||r.paymentVerified!==false||r.bankConfirmed!==false||r.canReleaseKitchen!==false)throw Error("REVIEW_UNCONFIRMED");
  if(r.item&&r.item.orderId!==orderId)throw Error("ORDER_MISMATCH");
  if(id===generation.current)setData(r);
 };
 const inspect=()=>{setOpen(true);void run(read);};
 const record=async()=>{
  if(!data?.canRecord||busy||!data.item?.notificationId)return;
  if(!await sweetConfirm("บันทึกว่าตรวจสอบข้อมูลแจ้งเงินเข้าและสลิปเบื้องต้นแล้วหรือไม่? การบันทึกนี้ไม่ได้ยืนยันรับเงิน ไม่เปลี่ยนสถานะชำระ และไม่ส่งเข้าครัว",{title:"บันทึกการตรวจ BankAlert",confirmText:"บันทึกการตรวจ",cancelText:"กลับ",type:"warning"}))return;
  await run(async id=>{
   const {data:r}=await httpsCallable(functions,"recordPaymentCompanionCashierReview")({orderId,notificationId:data.item.notificationId,acknowledged:true});
   if(r?.recorded!==true||r.paymentVerified!==false||r.canReleaseKitchen!==false)throw Error("REVIEW_UNCONFIRMED");
   if(id===generation.current)notify?.("บันทึกการตรวจเบื้องต้นแล้ว");
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
    <small>ยังไม่ใช่การยืนยันชำระเงิน และไม่เปลี่ยนสิทธิ์การอนุมัติ Superadmin</small>
   </>}
  </div>}
 </section>;
}
