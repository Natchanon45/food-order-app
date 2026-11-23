import { useState } from "react";
import { Navigate } from "react-router-dom";
import { getIdToken, reload, sendEmailVerification, signOut } from "firebase/auth";
import { useAuth } from "@/auth/AuthProvider";
import { auth } from "@/firebase/client";
import { accountEmailHome, managedEmailVerificationPending } from "@/auth/accountEmailPolicy.mjs";
import "@/ui/account-email-verification.css";

const WAITING_MESSAGE="ระบบยังไม่พบสถานะยืนยันอีเมลจาก Firebase กรุณาเปิดลิงก์ในอีเมลแล้วตรวจอีกครั้ง";
function deliveryError(error) {
 const code=String(error?.code||"");
 if(code.includes("too-many-requests"))return "มีการส่งคำขอมากเกินไป กรุณาลองใหม่ภายหลัง";
 if(code.includes("invalid-continue-uri")||code.includes("unauthorized-continue-uri"))
   return "โดเมนสำหรับลิงก์ยืนยันยังไม่ได้รับอนุญาตใน Firebase โปรดแจ้งผู้ดูแลระบบ";
 if(code.includes("network-request-failed"))return "เชื่อมต่อ Firebase ไม่สำเร็จ กรุณาตรวจสอบเครือข่าย";
 return "ไม่สามารถขอลิงก์ยืนยันได้ กรุณาตรวจสอบการตั้งค่า Firebase หรือแจ้งผู้ดูแลระบบ";
}

export function AccountEmailVerificationPage() {
 const {status,user,profile}=useAuth();
 const [busy,setBusy]=useState("");
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const canVerify=Boolean(user&&profile&&managedEmailVerificationPending(profile,user));

 const send=async()=>{
  if(!canVerify||busy)return;
  setBusy("send");setError("");setNotice("");
  try{
   const signed=auth.currentUser;
   if(!signed||signed.uid!==user.uid)throw Error("EMAIL_VERIFY_SESSION_MISMATCH");
   await reload(signed);
   if(signed.emailVerified===true){
    await getIdToken(signed,true);
    location.replace(accountEmailHome(profile));
    return;
   }
   const url=new URL("/verify-account",location.origin).toString();
   // Only the signed-in user's Firebase SDK sends this email upon a real click.
   // No operator email or privileged OOB link is returned to the browser.
   await sendEmailVerification(signed,{url,handleCodeInApp:false});
   setNotice("ส่งคำขอผ่าน Firebase Authentication แล้ว กรุณาตรวจกล่องจดหมายและโฟลเดอร์สแปม");
  }catch(reason){setError(deliveryError(reason));}
  finally{setBusy("");}
 };
 const check=async()=>{
  if(!canVerify||busy)return;
  setBusy("check");setError("");setNotice("");
  try{
   const signed=auth.currentUser;
   if(!signed||signed.uid!==user.uid)throw Error("EMAIL_VERIFY_SESSION_MISMATCH");
   await reload(signed);
   await getIdToken(signed,true);
   if(signed.emailVerified!==true){setNotice(WAITING_MESSAGE);return;}
   location.replace(accountEmailHome(profile));
  }catch{setError("ไม่สามารถตรวจสอบสถานะจาก Firebase ได้ กรุณาตรวจสอบเครือข่ายแล้วลองใหม่");}
  finally{setBusy("");}
 };
 const logout=async()=>{
  if(busy)return;
  setBusy("logout");
  try{await signOut(auth);location.replace("/login");}
  catch{setError("ไม่สามารถออกจากระบบได้ กรุณาลองอีกครั้ง");setBusy("");}
 };
 if(status==="loading")return <main className="verify-email-shell"><span>กำลังตรวจสอบบัญชี...</span></main>;
 if(status==="error")return <main role="alert" className="verify-email-shell"><span>ไม่สามารถตรวจสอบบัญชีได้ กรุณาลองเข้าสู่ระบบใหม่</span></main>;
 if(!user||!profile)return <Navigate to="/login" replace/>;
 if(!canVerify)return <Navigate to={accountEmailHome(profile)} replace/>;
 return <main className="verify-email-shell" data-managed-email-verification>
   <section className="verify-email-card">
     <span className="verify-email-symbol" aria-hidden="true"><i className="bi bi-envelope-check"/></span>
     <div className="verify-email-eyebrow"><i className="bi bi-shield-lock" aria-hidden="true"/> ยืนยันตัวตนก่อนใช้งาน PENGUIN</div>
     <h1>ยืนยันอีเมลสำหรับบัญชีของคุณ</h1>
     <p>บัญชี Owner หรือพนักงานที่สร้างโดยผู้ดูแลต้องยืนยันอีเมลกับ Firebase Authentication ก่อนเข้าถึงข้อมูลร้านค้า</p>
     <div className="verify-email-address">
       <span><i className="bi bi-envelope" aria-hidden="true"/> อีเมลบัญชี</span>
       <strong>{user.email||profile.email||"ไม่พบอีเมลบัญชี"}</strong>
     </div>
     <p className="verify-email-help">กดส่งลิงก์ยืนยัน จากนั้นเปิดลิงก์ในกล่องจดหมายของอีเมลนี้ แล้วกลับมากดตรวจสอบสถานะอีกครั้ง ระบบจะไม่เปลี่ยนข้อมูลสมาชิกหรือข้อมูลทางการเงิน</p>
     {notice?<div className="verify-email-notice" role="status">{notice}</div>:null}
     {error?<div className="verify-email-error" role="alert">{error}</div>:null}
     <div className="verify-email-actions">
       <button type="button" className="btn btn-primary" onClick={send}
         disabled={Boolean(busy)} data-send-account-verification>
         <i className="bi bi-send" aria-hidden="true"/>
         <span>{busy==="send"?"กำลังส่งคำขอ":"ส่งลิงก์ยืนยันอีเมล"}</span>
       </button>
       <button type="button" className="btn verify-email-check" onClick={check}
         disabled={Boolean(busy)} data-check-account-verification>
         <i className="bi bi-arrow-clockwise" aria-hidden="true"/>
         <span>{busy==="check"?"กำลังตรวจสอบ":"ตรวจสอบสถานะอีกครั้ง"}</span>
       </button>
     </div>
     <button type="button" className="verify-email-logout" onClick={logout}
       disabled={Boolean(busy)} data-account-verify-logout>
       <i className="bi bi-box-arrow-right" aria-hidden="true"/> ออกจากระบบ
     </button>
   </section>
 </main>;
}
