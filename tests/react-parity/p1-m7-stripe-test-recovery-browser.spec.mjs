import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("Superadmin reviews and deliberately binds one already-existing Stripe TEST Session on 4 widths; unsafe evidence never offers bind",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-m7-recovery-fixture-"));
 let vite,browser;
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"client.js"),"export const functions={};");
  await writeFile(resolve(dir,"sweet.js"),"window.__confirmCount=0;export const sweetConfirm=async()=>{window.__confirmCount++;return true;};");
  await writeFile(resolve(dir,"functions.js"),`
   window.__calls=[];window.__reviewKind=sessionStorage.getItem("reviewKind")||"single_open";
   const tenantId="tenant-private-uat-123",invoiceId="2026-11-22:monthly:fixed",
    attemptId="abcdef12-1234-1234-1234-123456789abc",
    sessionId="cs_test_1234567890abcDEF";
   const currentStatus=()=>sessionStorage.getItem("recoveryStatus")||"provider_requesting";
   export const httpsCallable=(_,name)=>async data=>{
    window.__calls.push({name,data});
    if(name==="getPlatformM7StripeTestShadowHistory"){
     if(Object.keys(data).length!==1||data.tenantId!==tenantId)throw Error("CROSS_TENANT");
     return {data:{ok:true,mode:"test_shadow",available:true,currency:"THB",
      operationalSettlementEnabled:false,hasMore:false,
      items:[{tenantId,invoiceId,attemptId,amountSatang:39900,currency:"THB",kind:"monthly",
       attemptNo:1,status:currentStatus(),providerVerified:false,
       providerTestAccountOnly:true,operationalSettlementEnabled:false}]}};
    }
    if(name==="reviewPlatformM7StripeTestRecovery"){
     if(Object.keys(data).join(",")!=="tenantId,invoiceId,attemptId"||
      data.tenantId!==tenantId||data.invoiceId!==invoiceId||data.attemptId!==attemptId)
      throw Error("UNTRUSTED_READ_INPUT");
     return {data:{ok:true,mode:"test",readOnly:true,tenantId,invoiceId,attemptId,
      amountSatang:39900,currency:"THB",status:window.__reviewKind,
      sessionId:window.__reviewKind==="single_open"?sessionId:"",
      matchedSingleOpen:window.__reviewKind==="single_open",
      canCreateNewCheckout:false,canSettleInvoice:false,
      checkoutCreatedByThisReview:false,scannedPages:2}};
    }
    if(name==="bindPlatformM7StripeTestRecovery"){
     if(Object.keys(data).join(",")!=="tenantId,invoiceId,attemptId,sessionId"||
      data.tenantId!==tenantId||data.invoiceId!==invoiceId||data.attemptId!==attemptId||
      data.sessionId!==sessionId||window.__reviewKind!=="single_open")
      throw Error("FORGED_RECOVERY_BIND");
     sessionStorage.setItem("recoveryStatus","checkout_ready");
     return {data:{ok:true,mode:"test",status:"checkout_ready",invoiceId,attemptId,
      existingSessionReattached:true,createdStripeSession:false,
      canCreateNewCheckout:false,operationalInvoicePaid:false,
      serviceCreditChanged:false}};
    }
    throw Error("UNEXPECTED_CALL_"+name);
   };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from"react";
   import{createRoot}from"react-dom/client";
   import{M7StripeTestShadowHistory}from"@/components/M7StripeTestShadowHistory";
   createRoot(document.getElementById("root")).render(<main style={{padding:12,maxWidth:960,margin:"auto"}}>
    <M7StripeTestShadowHistory tenantId="tenant-private-uat-123"/>
   </main>);`);
  vite=await createServer({configFile:false,root,cacheDir:resolve(dir,".vite-cache"),plugins:[react()],resolve:{alias:[
   {find:"@/firebase/client",replacement:resolve(dir,"client.js")},
   {find:"@/components/sweetDialog",replacement:resolve(dir,"sweet.js")},
   {find:"firebase/functions",replacement:resolve(dir,"functions.js")},
   {find:"@",replacement:resolve(root,"src")},
  ]},server:{host:"127.0.0.1",port:0},publicDir:false});
  await vite.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:930}});
   const url="http://127.0.0.1:"+vite.httpServer.address().port+"/"+basename(dir)+"/index.html";
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto(url);
    const table=page.locator("[data-m7-stripe-shadow-history]");
    await table.locator("summary").click();
    const examine=page.getByRole("button",{name:"ตรวจ Session เดิม"});
    await examine.waitFor();
    let calls=await page.evaluate(()=>window.__calls);
    assert.equal(calls.filter(c=>c.name==="bindPlatformM7StripeTestRecovery").length,0);
    assert.equal(calls.filter(c=>c.name==="reviewPlatformM7StripeTestRecovery").length,0);
    await examine.click();
    await table.getByText("พบ Stripe TEST Session เดิม 1 รายการ",{exact:false}).first().waitFor();
    await page.getByRole("button",{name:"ผูก Session เดิม (TEST)"}).click();
    await table.getByText("ผูก Session เดิมของ Stripe TEST สำเร็จแล้ว",{exact:false}).waitFor();
    await table.getByText("เปิด Checkout TEST · รอหลักฐาน",{exact:false}).waitFor();
    assert.match(await table.innerText(),/ไม่ได้บันทึก Paid จากส่วนนี้/);
    calls=await page.evaluate(()=>window.__calls);
    assert.equal(calls.filter(c=>c.name==="reviewPlatformM7StripeTestRecovery").length,1);
    assert.equal(calls.filter(c=>c.name==="bindPlatformM7StripeTestRecovery").length,1);
    assert.equal(calls.some(c=>c.name==="createOwnM7StripeTestCheckout"),false);
    assert.equal(await page.evaluate(()=>window.__confirmCount),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+2,"overflow "+width);
    for(const condition of ["ambiguous","already_paid_wait_webhook","not_found_uncertain","scan_incomplete"]){
     await page.evaluate(variant=>{
      sessionStorage.removeItem("recoveryStatus");
      sessionStorage.setItem("reviewKind",variant);
     },condition);
     await page.reload();
     await table.locator("summary").click();
     await examine.waitFor();await examine.click();
     await page.waitForFunction(variant=>{
      const label={
       ambiguous:"พบ Session ที่ผูก Attempt เดียวกันมากกว่าหนึ่งรายการ",
       already_paid_wait_webhook:"ต้องรอ Signed Webhook",
       not_found_uncertain:"ค้นไม่พบในช่วงที่ตรวจ",
       scan_incomplete:"ยังตรวจ Stripe ได้ไม่ครบทุกหน้า",
      }[variant];
      return document.body.innerText.includes(label);
     },condition);
     assert.equal(await page.getByRole("button",{name:"ผูก Session เดิม (TEST)"}).count(),0);
    }
   }finally{await page.close();}
  }
 }finally{await browser?.close();await vite?.close();await rm(dir,{recursive:true,force:true});}
});
test("Superadmin recovery UI is server-bound and Firestore private audit cannot be edited in browser",async()=>{
 const component=await readFile("react-app/src/components/M7StripeTestShadowHistory.jsx","utf8");
 const server=await readFile("functions/index.js","utf8");
 const rules=await readFile("firestore.rules","utf8");
 assert.match(component,/reviewPlatformM7StripeTestRecovery/);
 assert.match(component,/bindPlatformM7StripeTestRecovery/);
 assert.match(component,/sweetConfirm/);
 assert.match(component,/existingSessionReattached!==true/);
 assert.match(component,/canCreateNewCheckout!==false/);
 assert.match(server,/exports\.reviewPlatformM7StripeTestRecovery/);
 assert.match(server,/exports\.bindPlatformM7StripeTestRecovery/);
 assert.match(rules,/match \/m7StripeTestRecoveryAudits\/\{attemptId\} \{\s*allow read, write: if false/);
});
