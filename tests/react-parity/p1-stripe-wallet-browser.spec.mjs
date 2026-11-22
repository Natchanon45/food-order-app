import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("Sandbox wallet renders source component and resumes same checkout after uncertain reply",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-wallet-fixture-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"fake-client.js"),"export const functions={};");
  await writeFile(resolve(dir,"fake-functions.js"),`let pending=null,history=[],balance=0,requests=[];
   export const httpsCallable=(_,name)=>async data=>{
    if(name==="getOwnStripeWalletSandbox")return {data:{ok:true,mode:"test",available:true,balanceSatang:balance,pendingCheckout:pending,items:history}};
    if(name==="createStripeWalletSandboxCheckout"){
     requests.push(data.referenceId);window.__requests=requests;
     if(requests.length===1)throw Error("synthetic lost reply");
     pending={referenceId:data.referenceId,amountSatang:30000,status:"checkout_ready",createdAt:"2026-11-22T00:00:00Z",checkoutUrl:"https://checkout.stripe.com/c/pay/cs_test_FAKE12345678"};
     return {data:{ok:true,item:pending}};
    }
    if(name==="checkStripeWalletSandboxCheckout"){
     const item={...pending,status:"verified",checkoutUrl:""};pending=null;history=[item];balance=30000;
     return {data:{ok:true,item}};
    }
    throw Error("Unexpected call "+name);
   };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from "react";import {createRoot} from "react-dom/client";import {BankalertStripeWalletTopup} from "@/components/BankalertStripeWalletTopup";createRoot(document.getElementById("root")).render(<main style={{padding:12,maxWidth:720,margin:"auto"}}><BankalertStripeWalletTopup approved/></main>);`);
  server=await createServer({configFile:false,root,plugins:[react()],resolve:{alias:[{find:"@/firebase/client",replacement:resolve(dir,"fake-client.js")},{find:"firebase/functions",replacement:resolve(dir,"fake-functions.js")},{find:"@",replacement:resolve(root,"src")}]},server:{host:"127.0.0.1",port:0},publicDir:false});
  await server.listen();browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto("http://127.0.0.1:"+server.httpServer.address().port+"/"+basename(dir)+"/index.html");
    const create=page.getByRole("button",{name:"สร้าง QR ทดสอบ"});
    await create.click();
    await page.getByRole("alert").waitFor();
    await page.getByRole("button",{name:"ดำเนินรายการเดิมต่อ"}).click();
    const link=page.getByRole("link",{name:"เปิด Stripe Checkout"});await link.waitFor();
    assert.match(await link.getAttribute("href"),/^https:\/\/checkout\.stripe\.com\//);
    const requests=await page.evaluate(()=>window.__requests);assert.equal(requests.length,2);assert.equal(requests[0],requests[1]);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+1);
    await page.getByRole("button",{name:"ตรวจสอบสถานะ"}).click();
    await page.getByRole("button",{name:"เริ่มรายการใหม่"}).waitFor();
    assert.equal(await link.count(),0);
    assert.match(await page.locator(".bankalert-wallet-amount-summary").innerText(),/300\.00/);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
});
