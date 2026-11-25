import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {StoreBrandingEditor} from "@/components/StoreBrandingEditor";
import {AdminDeliveryQr} from "@/components/AdminDeliveryQr";
const labels={
 "admin.store_branding.logo_title":"โลโก้ร้าน",
 "admin.store_branding.cover_title":"รูปปกร้าน",
 "admin.store_branding.focus_aria":"จัดตำแหน่งรูปปก",
 "admin.store_branding.focus_reset":"จัดกึ่งกลาง",
 "admin.store_branding.choose":"เลือกรูป",
 "admin.store_branding.remove":"นำรูปออก",
 "admin.delivery_qr.delivery_title":"QR เดลิเวอรี่",
 "admin.delivery_qr.takeaway_title":"QR รับอาหาร",
 "admin.delivery_qr.download_qr":"ดาวน์โหลด QR",
};
const t=key=>labels[key]||key.split(".").at(-1);
function Fixture(){
 const [values,setValues]=useState({shopHeroFocusX:50,shopHeroFocusY:50,shopLogoUrl:"",shopHeroImageUrl:""});
 const [files,setFiles]=useState({logo:null,cover:null});
 useEffect(()=>{
  const make=(name,w,h,done)=>{
   const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
   const context=canvas.getContext("2d");
   context.fillStyle="#ca4747";context.fillRect(0,0,w,h/2);
   context.fillStyle="#3972ca";context.fillRect(0,h/2,w,h/2);
   canvas.toBlob(blob=>done(new File([blob],name,{type:"image/png"})),"image/png");
  };
  make("cover.png",600,1200,cover=>make("logo.png",300,300,logo=>setFiles({cover,logo})));
 },[]);
 return <main>
  <StoreBrandingEditor values={values} files={files} busy={false} t={t}
   onChange={patch=>setValues(current=>({...current,...patch}))}
   onFile={(kind,file)=>setFiles(current=>({...current,[kind]:file}))}/>
  <output id="focusValues">{JSON.stringify({x:values.shopHeroFocusX,y:values.shopHeroFocusY})}</output>
  <AdminDeliveryQr tenant={{id:"demo-tenant",slug:"p22-demo-shop"}} shopName="ร้านทดสอบ" t={t}/>
 </main>;
}
createRoot(document.getElementById("root")).render(<Fixture/>);
