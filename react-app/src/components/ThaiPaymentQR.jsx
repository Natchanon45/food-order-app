import {useEffect,useState} from "react";
import {qrSvg} from "@/utils/localQr";
import "@/ui/thai-payment-qr.css";

// Source assets already exist byte-identically in the PENGUIN public tree.
const branding="/assets/images/payment-branding/";
const kanitFont="/assets/fonts/Kanit-SemiBold.ttf";
const W=440,H=466,SCALE=3;
let artworkPromise;
function image(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("QR_ARTWORK_LOAD_FAILED"));img.src=src;
  });
}
function artwork(){
  if(!artworkPromise){
    const font=new FontFace("LKThaiQRCard", "url("+kanitFont+")");
    artworkPromise=Promise.all([
      image(branding+"thai-qr-payment.svg"),image(branding+"promptpay.svg"),
      image(branding+"thai-qr-payment-mark.png"),
      font.load().then(f=>document.fonts.add(f)),
    ]).catch(error=>{artworkPromise=undefined;throw error;});
  }
  return artworkPromise;
}
function rounded(ctx,x,y,w,h,r,fill,stroke){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
}
function centeredText(ctx,value,y,size,maxWidth){
  ctx.fillStyle="#103e29";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.font=size+"px LKThaiQRCard";
  while(ctx.measureText(value).width>maxWidth&&size>9)ctx.font=(--size)+"px LKThaiQRCard";
  ctx.fillText(value,W/2,y,maxWidth);
}
// Source composition, PENGUIN Firebase QR core: high-DPI locally assembled
// PNG from the exact unchanged bank payload; no provider calls or status writes.
async function buildCard(svg,title,amount,recipient){
  const [header,promptpay,mark]=await artwork();
  const qr=await image("data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg));
  const canvas=document.createElement("canvas");canvas.width=W*SCALE;canvas.height=H*SCALE;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("QR_CANVAS_UNAVAILABLE");
  ctx.scale(SCALE,SCALE);
  rounded(ctx,.5,.5,W-1,H-1,16,"#f5faf7","#cfe6d6");
  centeredText(ctx,title,17,14,416);
  centeredText(ctx,amount,40,26,416);
  const fx=66,fy=60,fw=308,fh=382;
  ctx.save();ctx.shadowColor="#17364b24";ctx.shadowBlur=16;ctx.shadowOffsetY=6;
  rounded(ctx,fx,fy,fw,fh,10,"#ffffff");ctx.restore();
  ctx.save();ctx.beginPath();ctx.roundRect(fx,fy,fw,fh,10);ctx.clip();
  ctx.fillStyle="#00427a";ctx.fillRect(fx,fy,fw,52);
  // Same original POS assets; the header is deliberately larger and retains
  // its intrinsic aspect ratio, rather than being squeezed by page CSS.
  const hw=176,hh=hw*header.naturalHeight/header.naturalWidth;
  // The source mark includes a blue surround: confine it to the blue band.
  ctx.save();ctx.beginPath();ctx.rect(fx,fy,fw,52);ctx.clip();
  ctx.drawImage(header,(W-hw)/2,fy+(52-hh)/2,hw,hh);ctx.restore();
  const pw=112,ph=pw*promptpay.naturalHeight/promptpay.naturalWidth;
  const px=(W-pw)/2,py=fy+56;
  ctx.drawImage(promptpay,px,py,pw,ph);
  ctx.strokeStyle="#315c83";ctx.lineWidth=1.25;ctx.strokeRect(px,py,pw,ph);
  ctx.restore();
  ctx.beginPath();ctx.roundRect(fx,fy,fw,fh,10);ctx.strokeStyle="#91a8bc";ctx.lineWidth=1.25;ctx.stroke();
  // Use whole physical-pixel QR modules. Keep the four-module quiet zone
  // and do not excavate a rectangular white hole around the central mark.
  const dimension=Number(svg.match(/viewBox="0 0 (\d+) \d+"/)?.[1]);
  if(!Number.isInteger(dimension)||dimension<29)throw new Error("QR_DIMENSION_INVALID");
  const pixels=Math.floor(274*SCALE/dimension)*dimension;
  const qx=Math.round((W*SCALE-pixels)/2),qy=160*SCALE+Math.round((274*SCALE-pixels)/2);
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=false;
  ctx.drawImage(qr,qx,qy,pixels,pixels);
  // Preserve the native transparency and white border of the POS mark,
  // leaving QR modules visible outside its actual silhouette.
  const mw=54*SCALE,mh=Math.round(mw*mark.naturalHeight/mark.naturalWidth);
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(mark,Math.round(qx+(pixels-mw)/2),Math.round(qy+(pixels-mh)/2),mw,mh);
  ctx.restore();
  centeredText(ctx,recipient,454,14,416);
  return canvas.toDataURL("image/png");
}

// A bank observation is not a payment confirmation. Do not render the actual
// QR under a translucent overlay: even a blurred QR can sometimes be decoded.
export function ThaiPaymentProgress({settled=false,amount}){
  const [waiting,setWaiting]=useState(true);
  useEffect(()=>{if(settled)return;const timer=setTimeout(()=>setWaiting(false),30000);return()=>clearTimeout(timer);},[settled]);
  return <section className="lk-thai-payment-qr lk-thai-payment-guard" data-thai-payment-progress role="status" aria-live="polite">
    <div className="lk-thai-payment-guard-backdrop" aria-hidden="true"><span/><div/><small/></div>
    <div className="lk-thai-payment-guard-content">
      {waiting||settled?<span className="lk-thai-payment-spinner" aria-hidden="true"/>:<i className="bi bi-hourglass-split" aria-hidden="true"/>}
      <strong>{settled?"กำลังอัปเดตผลการชำระเงิน":waiting?"กำลังตรวจสอบการชำระเงิน":"อยู่ระหว่างการตรวจสอบข้อมูล"}</strong>
      {amount&&<span>{amount}</span>}
      <small>{waiting||settled?"กรุณารอสักครู่ ไม่ต้องชำระเงินซ้ำ":"หากยังไม่ได้รับผล สามารถแนบหลักฐานเพื่อตรวจสอบได้ กรุณาอย่าชำระซ้ำ"}</small>
    </div>
  </section>;
}
// Remember an observation for this exact payment reference in the current
// browser session, including a reload or an inconclusive polling response.
export function rememberThaiPaymentObservation(scope,reference,observed){
  if(!reference)return false;
  const key="penguin:thai-qr-observed:v1:"+scope+":"+reference;
  try{if(observed===true)sessionStorage.setItem(key,"1");return sessionStorage.getItem(key)==="1";}
  catch{return observed===true;}
}
export function ThaiPaymentQR(props){
  return props.processing?<ThaiPaymentProgress amount={props.amount}/>:<ThaiPaymentArtwork {...props}/>;
}
function ThaiPaymentArtwork({payload,amount,recipient,imageId,amountId,recipientId,
  title="ชำระผ่าน PromptPay / โอนเงิน",alt="QR พร้อมเพย์สำหรับชำระเงิน"}){
  const name=recipient||"กรุณาตรวจสอบชื่อผู้รับในแอปธนาคาร";
  const key=JSON.stringify([payload,title,amount,name]);
  const [result,setResult]=useState(null);
  useEffect(()=>{
    if(!payload)return;
    let active=true;
    // Keep existing Firebase/guest QR core. No new dependency, provider
    // payload construction or external QR service.
    const svg=qrSvg(payload,{size:900,margin:4});
    buildCard(svg,title,amount,name).then(src=>{if(active)setResult({key,src});})
      .catch(()=>{if(active)setResult({key,error:true});});
    return ()=>{active=false;};
  },[key,payload,title,amount,name]);
  if(!payload)return null;
  const current=result?.key===key?result:null;
  return <section className="lk-thai-payment-qr" data-thai-payment-qr aria-label={title}>
    <span className="lk-thai-payment-accessible" id={amountId}>{amount}</span>
    <span className="lk-thai-payment-accessible" id={recipientId}>{name}</span>
    {current?.src?<img id={imageId} className="lk-thai-payment-card-image" data-thai-payment-card-image
      src={current.src} width={W*SCALE} height={H*SCALE}
      alt={alt+" · "+title+" · "+amount+" · "+name}/>:<p role="status">{current?.error?"ไม่สามารถสร้างภาพ QR ได้ กรุณาลองเปิดรายการใหม่":"กำลังสร้างภาพ QR สำหรับชำระเงิน…"}</p>}
  </section>;
}
