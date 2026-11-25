import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("P2.1 Chrome Source Owner observer independently collapsed, read-only and responsive at 4 widths",{
 timeout:110000,
},async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p21-owner-observer-fixture-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),
   '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="admin-vr-page"><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"client.js"),'export const functions={};');
  await writeFile(resolve(dir,"calls.js"),
   'const flags={paymentVerified:false,bankConfirmed:false,canSettleInvoice:false,canReleaseKitchen:false};'+
   'const row={deviceId:"device1",deviceLabel:"Owner Android",amountSatang:19900,source:"line_scb_connect",receiverSuffix:"X-1234",bankTimeUTC:"2026-11-25T05:00:00Z",receivedUTC:"2026-11-25T05:00:02Z",...flags};'+
   'export let calls=0;export const httpsCallable=(_,name)=>async()=>{if(name!=="getPaymentCompanionDashboard")throw Error("UNAUTHORIZED_WRITE");calls++;return {data:{...flags,enabled:true,devices:[{id:"device1",label:"Owner Android",enabled:true}],items:[{...row,id:"notice1"},{...row,id:"notice2"},{...row,id:"notice3",amountSatang:25000}],matches:[{orderId:"bill-A",amountSatang:19900,status:"candidate",orderTimeUTC:"2026-11-25T05:02:00Z",hasSlip:false}],matchStatus:"advisory"}};};');
  await writeFile(resolve(dir,"fixture.jsx"),
   'import React from "react";import {createRoot} from "react-dom/client";'+
   'import {AdminCollapsibleCard} from "@/components/AdminCollapsibleCard";'+
   'import {PaymentCompanionObserverCard} from "@/components/PaymentCompanionObserverCard";'+
   'import {calls} from "./calls.js";window.observerTest={get calls(){return calls;}};'+
   'createRoot(document.getElementById("root")).render(<main style={{maxWidth:1200,margin:"auto",padding:8}}><section data-admin-card-role="sales-report">รายงานยอดขาย</section><AdminCollapsibleCard cardKey="companion-observer" id="paymentCompanionObserverCard" icon="activity" accent="green" t={()=>"แสดง/ซ่อน"} heading={<h2>ภาพรวมการแจ้งเงินเข้า</h2>}><PaymentCompanionObserverCard isOwner/></AdminCollapsibleCard><PaymentCompanionObserverCard isOwner={false}/></main>);');
  server=await createServer({configFile:false,root,plugins:[react()],
   resolve:{alias:[{find:"@/firebase/client",replacement:resolve(dir,"client.js")},
    {find:"firebase/functions",replacement:resolve(dir,"calls.js")},
    {find:"@",replacement:resolve(root,"src")}]},
   server:{host:"127.0.0.1",port:0},publicDir:false});
  await server.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:950},reducedMotion:"reduce"});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto("http://127.0.0.1:"+server.httpServer.address().port+"/"+basename(dir)+"/index.html");
    const card=page.locator('[data-admin-card-key="companion-observer"]');
    await card.waitFor();
    assert.ok((await card.getAttribute("class")).includes("admin-card-collapsed"));
    assert.equal(await page.locator("[data-companion-observer-readonly]").count(),1);
    await card.locator(".admin-card-toggle").click();
    await card.getByText("กลุ่มที่อาจซ้ำ").waitFor();
    await card.getByText("1/3").waitFor();
    await card.getByText("2 กลุ่ม").waitFor();
    assert.equal(await card.locator(".payment-companion-notice").count(),3);
    assert.equal(await card.locator(".is-duplicate").count(),1);
    assert.equal(await card.getByRole("button",{name:"รีเฟรชประวัติแจ้งเงินเข้า"}).count(),1);
    const before=await page.evaluate(()=>window.observerTest.calls);
    await card.getByRole("button",{name:"รีเฟรชประวัติแจ้งเงินเข้า"}).click();
    await page.waitForFunction(value=>window.observerTest.calls>value,before);
    assert.equal(await card.locator('button[data-confirm-paid]').count(),0);
    assert.equal(await card.locator('input[type=password]').count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)<=2,
     "horizontal overflow at "+width);
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
});
