import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("owner companion dashboard: responsive source card, masked token and advisory evidence",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-companion-fixture-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="admin-vr-page"><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"client.js"),"export const functions={};");
  await writeFile(resolve(dir,"dialog.js"),"export const sweetConfirm=async()=>true;");
  await writeFile(resolve(dir,"calls.js"),`let devices=[];const flags={paymentVerified:false,bankConfirmed:false,canReleaseKitchen:false};export const httpsCallable=(_,name)=>async data=>{
    if(name==="getPaymentCompanionDashboard")return {data:{...flags,enabled:true,devices,items:[{id:"n1",deviceId:"d",deviceLabel:"Android",amountSatang:30000,receiverSuffix:"X-1234",bankTimeUTC:"2026-11-22T00:00:00Z",receivedUTC:"2026-11-22T00:01:00Z"}],matches:[{orderId:"order-demo-123456789",amountSatang:30000,status:"candidate",orderTimeUTC:"2026-11-22T00:02:00Z",hasSlip:true}],matchStatus:"advisory",receiver:{bankName:"SCB",accountLast4:"1234",promptPayLast4:"5678",storePaymentReady:true}}};
    if(name==="pairPaymentCompanionDevice"){devices=[{id:"one",label:data.label,enabled:true}];return {data:{showOnce:true,pairingToken:"a".repeat(64)}}}
    if(name==="changePaymentCompanionDevice"){devices=[{...devices[0],enabled:false}];return {data:{revoked:true}}}
    throw Error("unexpected call");
  };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from "react";import {createRoot} from "react-dom/client";import {PaymentCompanionPairingCard} from "@/components/PaymentCompanionPairingCard";const Group=({children})=><section>{children}</section>;createRoot(document.getElementById("root")).render(<main style={{padding:12,maxWidth:1000,margin:"auto"}}><PaymentCompanionPairingCard isOwner SettingsGroup={Group}/></main>);`);
  const dialog=resolve(root,"src/components/sweetDialog.js");
  server=await createServer({configFile:false,root,plugins:[{name:"fixture-dialog",enforce:"pre",resolveId(source,importer){if(source==="./sweetDialog"&&importer?.includes("PaymentCompanionPairingCard"))return resolve(dir,"dialog.js");}},react()],resolve:{alias:[{find:"@/firebase/client",replacement:resolve(dir,"client.js")},{find:"firebase/functions",replacement:resolve(dir,"calls.js")},{find:"@",replacement:resolve(root,"src")}]},server:{host:"127.0.0.1",port:0},publicDir:false});
  await server.listen();browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto("http://127.0.0.1:"+server.httpServer.address().port+"/"+basename(dir)+"/index.html");
    await page.getByRole("button",{name:"สร้างรหัสจับคู่"}).click();
    const token=page.getByLabel("รหัสจับคู่",{exact:true});await token.waitFor();
    assert.equal(await token.getAttribute("type"),"password");
    await page.getByRole("button",{name:"แสดง",exact:true}).click();
    assert.equal(await token.getAttribute("type"),"text");
    await page.getByRole("button",{name:"ปิด",exact:true}).click();
    assert.equal(await token.count(),0);
    assert.ok(await page.getByText("พบยอดและเวลาที่อาจตรง").isVisible());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+1);
    await page.getByRole("button",{name:"ยกเลิกสิทธิ์"}).click();
    await page.getByRole("button",{name:"ลบคีย์"}).waitFor();
   }finally{await page.close();}
  }
 }finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
});
