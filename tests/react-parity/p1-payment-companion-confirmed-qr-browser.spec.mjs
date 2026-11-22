import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("source-like post-confirm QR on customer success: server clock, no double QR, expiry and capability-bound original slip",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-confirmed-qr-fixture-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"client.js"),"export const functions={};");
  await writeFile(resolve(dir,"storefront.js"),`export const uploadPublicPaymentSlip=async(tenant,file,id)=>({path:"tenants/"+tenant.id+"/payment-slips/"+id+"/original.png"});`);
  await writeFile(resolve(dir,"functions.js"),`
   export const httpsCallable=(_,name)=>async data=>{
    if(name==="getPublicCompanionQrState"){
      const phase=window.__phase||"active",expiry=Number(sessionStorage.getItem("persisted_expiry"));
      return {data:{mode:"confirmed_order_5m",active:phase==="active",canUploadSlip:phase==="expired",serverNowMs:Date.now(),expiresAtUTC:new Date(expiry).toISOString(),
        recipientId:phase==="active"?"0991112223":"",recipientName:"Synthetic test payee",reason:phase==="expired"?"expired":"awaiting"}};
    }
    if(name==="submitPublicCompanionLateSlip"){
      if(data.capability!=="a".repeat(64))throw Error("CAPABILITY_MISMATCH");
      if(data.slipPath!=="tenants/qr-tenant-12345/payment-slips/order-reference-12345/original.png")throw Error("PATH_MISMATCH");
      window.__phase="submitted";return {data:{ok:true,status:"pending_manual_review",paymentVerified:false,kitchenReleased:false}};
    }
    throw Error("NO_SUCH_CALLABLE");
   };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from "react";import{createRoot}from"react-dom/client";import{CompanionConfirmedQr}from"@/components/CompanionConfirmedQr";
  if(!sessionStorage.getItem("persisted_expiry"))sessionStorage.setItem("persisted_expiry",String(Date.now()+290000));
  sessionStorage.setItem("penguin:companion-qr-cap:qr-tenant-12345:order-reference-12345","a".repeat(64));
  const order={paymentQrMode:"confirmed_order_5m",paymentStatus:"pending_verification",status:"pending",totalAmount:150,paymentSlipPath:"",billNo:"B0001"};
  createRoot(document.getElementById("root")).render(<main style={{padding:12,maxWidth:680,margin:"auto"}}><CompanionConfirmedQr tenant={{id:"qr-tenant-12345"}} order={order} orderId="order-reference-12345"/></main>);`);
  server=await createServer({configFile:false,root,plugins:[react()],resolve:{alias:[
   {find:"@/firebase/client",replacement:resolve(dir,"client.js")},
   {find:"firebase/functions",replacement:resolve(dir,"functions.js")},
   {find:"@/data/publicStorefrontData",replacement:resolve(dir,"storefront.js")},
   {find:"@",replacement:resolve(root,"src")}
  ]},server:{host:"127.0.0.1",port:0},publicDir:false});
  await server.listen();browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    const url="http://127.0.0.1:"+server.httpServer.address().port+"/"+basename(dir)+"/index.html";
    await page.goto(url);
    const image=page.getByRole("img",{name:"QR PromptPay สำหรับรายการที่ยืนยันแล้ว"});
    await image.waitFor();
    const remaining=await page.getByRole("timer").innerText();
    assert.match(remaining,/^0[0-4]:[0-5]\d$/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+1);
    const expiry=await page.evaluate(()=>sessionStorage.getItem("persisted_expiry"));
    await page.reload();await image.waitFor();
    assert.equal(await page.evaluate(()=>sessionStorage.getItem("persisted_expiry")),expiry);
    await page.evaluate(()=>{window.__phase="expired";});
    await page.getByRole("button",{name:"ส่งสลิปต้นฉบับเพื่อตรวจสอบ"}).waitFor({timeout:10000});
    assert.equal(await image.count(),0);
    await page.getByLabel("แนบสลิปต้นฉบับ").setInputFiles({name:"original.png",mimeType:"image/png",buffer:Buffer.from("original untrusted image", "utf8")});
    await page.getByRole("button",{name:"ส่งสลิปต้นฉบับเพื่อตรวจสอบ"}).click();
    await page.getByText("รับสลิปต้นฉบับเพื่อรอตรวจสอบแล้ว ยังไม่ถือว่าชำระเงินสำเร็จ").waitFor();
    assert.equal(await page.evaluate(()=>sessionStorage.getItem("penguin:companion-qr-cap:qr-tenant-12345:order-reference-12345")),null);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
});
test("checkout mode is source-scoped to Lalamove and default pay-first remains in JSX",async()=>{
 const page=await readFile("react-app/src/pages/DeliveryPage.jsx","utf8");
 const server=await readFile("functions/public-delivery-submit.js","utf8");
 assert.match(page,/const confirmedQrFlow=companionQrEnabled&&usesLalamove&&paymentMethod==="promptpay"&&/);
 assert.match(page,/!paymentLocked&&/);
 assert.match(page,/!freeShippingApplied&&freeGiftIds.size===0/);
 assert.match(page,/publicCompanionQrAvailability\(\{tenantId:tenant.id\}\)/);
 assert.match(page,/paymentQrMode:"confirmed_order_5m"/);
 assert.match(page,/await verifyDeliveryPaymentSlip\(/);
 assert.match(server,/const wantsQr=order.paymentQrMode==="confirmed_order_5m"/);
 assert.match(server,/qr\.verifyQuotation\(/);
 assert.match(server,/qr\.verifyCatalog\(/);
 assert.match(server,/paymentStatus: order.paymentMethod === "promptpay" \? "pending_verification" : "unpaid"/);
});
