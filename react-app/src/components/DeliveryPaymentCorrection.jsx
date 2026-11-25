import {useEffect,useRef,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";
import {uploadPublicPaymentSlip} from "@/data/publicStorefrontData";
import {
  isSupportedRetrySlip,slipUploadPercent,slipUploadAnimatedPercent,
  slipUploadDisplayHoldMs,
} from "@/utils/slipUploadProgress.mjs";
import "@/ui/delivery-customer-correction.css";
const readState=httpsCallable(functions,"getPublicDeliveryCorrectionState",{timeout:30000});
const sendProof=httpsCallable(functions,"submitPublicDeliveryCorrectionSlip",{timeout:60000});
const secretKey=(tenantId,orderId)=>"penguin:delivery:correction:v1:"+tenantId+":"+orderId;
const validSecret=value=>/^[a-f0-9]{64}$/.test(value||"");

export function DeliveryPaymentCorrection({tenant,order,orderId,onToast=()=>{}}){
  const tenantId=String(tenant?.id||"");
  const [status,setStatus]=useState(null);
  const [checking,setChecking]=useState(true);
  const [file,setFile]=useState(null);
  const [progress,setProgress]=useState(0);
  const [phase,setPhase]=useState("idle");
  const [sending,setSending]=useState(false);
  const [feedback,setFeedback]=useState("");
  const staged=useRef(null),secret=useRef(""),alive=useRef(true),lock=useRef(false);

  useEffect(()=>{
    alive.current=true;
    return()=>{alive.current=false;};
  },[]);
  useEffect(()=>{
    let active=true;
    setStatus(null);setChecking(true);setFeedback("");
    staged.current=null;setFile(null);setProgress(0);setPhase("idle");
    if(!tenantId||!orderId||order?.paymentMethod!=="promptpay"||
       order?.paymentQrMode==="confirmed_order_5m"||
       order?.paymentStatus!=="pending_verification"){
      setChecking(false);return()=>{active=false;};
    }
    let token="";
    try{token=sessionStorage.getItem(secretKey(tenantId,orderId))||"";}catch{}
    secret.current=validSecret(token)?token:"";
    if(!secret.current){setChecking(false);return()=>{active=false;};}
    readState({tenantId,orderId,capability:secret.current}).then(({data})=>{
      if(!active)return;
      // Fail closed on missing, fabricated or partially read service replies.
      if(data?.ownershipVerified!==true||typeof data?.canUploadNewSlip!=="boolean"
        ||data?.paymentVerified!==false||data?.canRequestCODReview!==false)
        throw Error("DELIVERY_CORRECTION_STATE_INVALID");
      setStatus(data);
    }).catch(()=>{
      if(active){setStatus(null);setFeedback("ยังไม่สามารถตรวจสิทธิ์ส่งหลักฐานของรายการเดิมได้ กรุณาติดต่อร้านค้า");}
    }).finally(()=>{if(active)setChecking(false);});
    return()=>{active=false;};
  },[tenantId,orderId,order?.paymentStatus,order?.paymentMethod,
     order?.paymentQrMode,order?.paymentSlipPath,order?.slipCheckStatus]);

  const chooseFile=async selected=>{
    if(!selected||!status?.canUploadNewSlip||!secret.current||
      lock.current||sending||phase==="uploading")return;
    if(!isSupportedRetrySlip(selected)||
      !["image/jpeg","image/png","image/webp"].includes(String(selected.type||""))){
      setFeedback(selected.size>8*1024*1024
        ?"ไฟล์สลิปมีขนาดเกิน 8 MB":"รองรับเฉพาะไฟล์สลิปต้นฉบับ JPG, PNG หรือ WebP");
      return;
    }
    lock.current=true;
    staged.current=null;setFile(selected);setFeedback("");
    setPhase("uploading");setProgress(0);
    const started=Date.now();let observed=0;
    const timer=window.setInterval(()=>{
      if(alive.current)setProgress(slipUploadAnimatedPercent(observed,Date.now()-started));
    },80);
    try{
      const upload=await uploadPublicPaymentSlip(tenant,selected,orderId,{
        onUploadProgress:event=>{
          const next=slipUploadPercent(event);
          if(next!==null)observed=Math.max(observed,next);
        },
      });
      if(!upload?.path)throw Error("DELIVERY_SLIP_STORAGE_UNCONFIRMED");
      staged.current={file:selected,path:upload.path};
      await new Promise(resolve=>window.setTimeout(resolve,slipUploadDisplayHoldMs(started)));
      if(alive.current){setProgress(100);setPhase("finished");}
    }catch(error){
      console.warn("DELIVERY_CORRECTION_STORAGE_FAILED",error?.code||"unknown");
      staged.current=null;
      if(alive.current){
        setPhase("error");
        setFeedback("ยังส่งไฟล์ไม่สำเร็จ กรุณาเลือกสลิปต้นฉบับใหม่");
      }
    }finally{window.clearInterval(timer);lock.current=false;}
  };
  const clear=()=>{
    if(lock.current||sending||phase==="uploading")return;
    staged.current=null;setFile(null);setPhase("idle");setProgress(0);setFeedback("");
  };
  const submit=async()=>{
    if(lock.current||sending||phase!=="finished"||!status?.canUploadNewSlip||
       !validSecret(secret.current)||staged.current?.file!==file||
       !staged.current?.path)return;
    lock.current=true;setSending(true);setFeedback("");
    try{
      const {data}=await sendProof({
        tenantId,orderId,capability:secret.current,
        slipPath:staged.current.path,
      });
      if(data?.ok!==true||data?.status!=="pending_manual_review"||
         data?.paymentVerified!==false||data?.kitchenReleased!==false)
         throw Error("DELIVERY_CORRECTION_RECEIPT_UNCONFIRMED");
      setStatus({...status,canUploadNewSlip:false,hasOriginalSlip:true,
        status:"pending_manual_review"});
      staged.current=null;setFile(null);setPhase("idle");setProgress(0);
      setFeedback("รับสลิปต้นฉบับเพื่อรอเจ้าหน้าที่ตรวจสอบแล้ว ยังไม่ถือว่าชำระเงินสำเร็จ");
      onToast("รับสลิปเพื่อตรวจสอบเรียบร้อยแล้ว");
    }catch(error){
      console.warn("DELIVERY_CORRECTION_UNCONFIRMED",error?.code||"unknown");
      setFeedback("ยังไม่ยืนยันการรับสลิป กรุณาตรวจสอบสถานะบิลเดิมก่อนส่งซ้ำ");
      onToast("ยังไม่สามารถยืนยันการรับสลิปได้ กรุณาตรวจสอบรายการเดิม","error");
    }finally{lock.current=false;setSending(false);}
  };
  if(!tenantId||!orderId||order?.paymentMethod!=="promptpay"||
    order?.paymentQrMode==="confirmed_order_5m"||
    order?.paymentStatus!=="pending_verification")return null;
  return <section className="delivery-customer-correction" role="region"
    aria-label="ตรวจสอบและส่งสลิปต้นฉบับของบิลเดิม" id="customerDeliveryCorrection"
    data-customer-correction={status?.canUploadNewSlip?"available":"held"}>
    {checking?<p role="status">กำลังตรวจสิทธิ์รายการเดิม…</p>:
      !secret.current?<p role="status">หากต้องส่งสลิปใหม่ กรุณาเปิดจากเบราว์เซอร์ที่สั่งอาหาร
        หรือแจ้งเลขบิลให้ร้านค้าตรวจสอบ ไม่ต้องสร้างออเดอร์หรือโอนเงินใหม่</p>:
      status?.canUploadNewSlip?<div className="delivery-correction-upload">
        <h4>แนบสลิปต้นฉบับของรายการเดิม</h4>
        <p>ไฟล์ที่เลือกจะเริ่มอัปโหลดทันที และเจ้าหน้าที่จะตรวจสอบหลักฐานก่อนยืนยันการชำระเงิน</p>
        <label htmlFor="customerCorrectionSlip">เลือกสลิป JPG, PNG หรือ WebP (ไม่เกิน 8 MB)</label>
        <input type="file" id="customerCorrectionSlip" accept="image/jpeg,image/png,image/webp"
          disabled={sending||phase==="uploading"||Boolean(file)}
          onChange={event=>{
            void chooseFile(event.target.files?.[0]||null);event.target.value="";
          }}/>
        {file&&<div className="customer-retry-upload-progress" id="customerRetrySlipProgress">
          <div className="customer-retry-upload-progress-header">
            <strong>{file.name.slice(0,100)}</strong><span>{progress}%</span>
          </div>
          <div className="customer-retry-upload-track" role="progressbar"
            aria-label="ความคืบหน้าอัปโหลดสลิปแก้ไข"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div className="customer-retry-upload-fill progress-bar-striped"
              style={{width:progress+"%"}} />
          </div>
          <small>{phase==="finished"
            ?"อัปโหลดครบ 100% ไม่ได้หมายความว่าชำระเงินสำเร็จ"
            :phase==="error"?"ยังไม่สามารถยืนยันการจัดเก็บไฟล์ได้"
              :"กำลังส่งไฟล์จริง กรุณารอจนแสดง 100%"}</small>
          {phase==="finished"&&<button type="button" className="btn btn-sm"
            onClick={clear} disabled={sending} aria-label="ลบสลิปที่แนบ">ลบรูป</button>}
          {phase==="error"&&<button type="button" className="btn btn-sm"
            onClick={clear} disabled={sending}>เลือกใหม่</button>}
        </div>}
        {phase==="finished"&&<button className="btn btn-primary" type="button"
          onClick={()=>void submit()} disabled={sending}>
          {sending?"กำลังส่งตรวจสอบ…":"ส่งสลิปต้นฉบับให้ร้านตรวจสอบ"}</button>}
      </div>:status?<p role="status">บิลนี้อยู่ระหว่างตรวจสอบหลักฐานเดิม
        หรือเจ้าหน้าที่ดำเนินการแล้ว ไม่อนุญาตส่งหลักฐานซ้ำในขณะนี้</p>:
      <p role="status">ยังไม่สามารถยืนยันสิทธิ์ของรายการนี้ได้ กรุณาติดต่อร้านค้า</p>}
    {feedback&&<p className="delivery-correction-feedback" role="status">{feedback}</p>}
    <small>การส่งสลิปไม่ใช่การยืนยันจากธนาคาร กรุณาอย่าโอนเงินซ้ำ</small>
  </section>;
}
