import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("merchant safely inspects UAT TEST expiry/failure and Superadmin views terminal audit on 4 viewport widths",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-m7-lifecycle-fixture-"));
 let vite,browser;
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"client.js"),"export const functions={};");
  await writeFile(resolve(dir,"sweet.js"),"export const sweetConfirm=async()=>true;");
  await writeFile(resolve(dir,"functions.js"),`window.__calls=[];window.__notices=[];
   window.__testStatus=sessionStorage.getItem("testStatus")||"checkout_ready";
   const invoiceId="2026-11-22:monthly:fixed",attemptId="abcdef12-1234-1234-1234-123456789abc";
   const base={invoiceId,amountSatang:39900,currency:"THB",kind:"monthly",attemptId,
     attemptNo:1,invoicePaid:false,operationalSettlementEnabled:false};
   export const httpsCallable=(_,name)=>async data=>{
    window.__calls.push({name,data});
    if(name==="getOwnM7StripeTestQuoteReadiness")return {data:{ok:true,quoteEnabled:true,
      checkoutEnabled:false,settlementEnabled:false,invoices:[{invoiceId,amountSatang:39900,currency:"THB",kind:"monthly"}]}};
    if(name==="getOwnM7StripeTestCheckoutStatus")return {data:{ok:true,available:true,
      checkoutEnabled:true,shadowLedgerEnabled:true,mode:"test",
      operationalSettlementEnabled:false,items:[{...base,status:window.__testStatus,
       checkoutUrl:window.__testStatus==="checkout_ready"?
        "https://checkout.stripe.com/c/pay/cs_test_1234567890abcdef":""}]}};
    if(name==="inspectOwnM7StripeTestCheckout"){
      if(Object.keys(data).length!==1||data.invoiceId!==invoiceId)throw Error("FORGED_INSPECTION_ARGUMENTS");
      return {data:{ok:true,invoiceId,attemptId,amountSatang:39900,currency:"THB",
        status:window.__testStatus==="expired_test"?"provider_expired_unpaid":
          window.__testStatus==="payment_failed_test"?"provider_failed_unpaid":
          window.__testStatus.startsWith("provider_test_")?"provider_risk_review":
          "awaiting_signed_webhook",
        providerProofObserved:false,operationalInvoicePaid:false,
        serviceCreditChanged:false,canRetry:false,providerTestModeOnly:true}};
    }
    if(name==="getPlatformM7StripeTestShadowHistory")return {data:{ok:true,
      available:true,mode:"test_shadow",currency:"THB",
      operationalSettlementEnabled:false,hasMore:false,items:[{
       ...base,status:window.__testStatus,providerVerified:false,
       providerTestAccountOnly:true,createdAt:"2026-11-22T07:00:00Z"}]}};
    if(name==="createOwnM7StripeTestCheckout")throw Error("MUST_NOT_CREATE_NEW_CHECKOUT");
    throw Error("UNEXPECTED_CALL_"+name);
   };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from "react";import{createRoot}from"react-dom/client";
   import{M7StripeTestReservation}from"@/components/M7StripeTestReservation";
   import{M7StripeTestShadowHistory}from"@/components/M7StripeTestShadowHistory";
   const admin=new URLSearchParams(location.search).get("scope")==="platform";
   createRoot(document.getElementById("root")).render(<main style={{padding:12,maxWidth:960,margin:"auto"}}>
    {admin?<M7StripeTestShadowHistory tenantId="uat-test-tenant"/>:
     <M7StripeTestReservation tenantId="uat-test-tenant"
      notify={(message,tone)=>window.__notices.push({message,tone})}/>}
   </main>);`);
  vite=await createServer({configFile:false,root,cacheDir:resolve(dir,".vite-cache"),
   plugins:[react()],resolve:{alias:[
   {find:"@/firebase/client",replacement:resolve(dir,"client.js")},
   {find:"@/components/sweetDialog",replacement:resolve(dir,"sweet.js")},
   {find:"firebase/functions",replacement:resolve(dir,"functions.js")},
   {find:"@",replacement:resolve(root,"src")},
  ]},server:{host:"127.0.0.1",port:0},publicDir:false});
  await vite.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:860}});
   const url="http://127.0.0.1:"+vite.httpServer.address().port+"/"+basename(dir)+"/index.html";
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto(url);
    const merchant=page.locator("[data-m7-stripe-test-quote]");
    await merchant.locator("summary").click();
    await page.getByRole("button",{name:"ตรวจ Stripe TEST"}).waitFor();
    await page.getByRole("button",{name:"ตรวจ Stripe TEST"}).click();
    await merchant.getByText("รอ Webhook และ Shadow Audit",{exact:false}).waitFor();
    assert.equal((await page.evaluate(()=>window.__calls.filter(x=>x.name==="inspectOwnM7StripeTestCheckout"))).length,1);
    await page.evaluate(()=>{sessionStorage.setItem("testStatus","expired_test")});
    await page.reload();
    await merchant.locator("summary").click();
    await merchant.getByText("Stripe TEST หมดอายุแล้ว",{exact:false}).waitFor();
    assert.equal(await page.getByRole("button",{name:"เริ่ม Stripe TEST Checkout"}).count(),0);
    await page.getByRole("button",{name:"ตรวจ Stripe TEST"}).click();
    await merchant.getByText("Stripe TEST ยืนยันว่าหมดอายุ",{exact:false}).waitFor();
    await page.goto(url+"?scope=platform");
    const admin=page.locator("[data-m7-stripe-shadow-history]");
    await admin.locator("summary").click();
    await admin.getByText("Stripe TEST หมดอายุ (ตรวจด้วย Webhook แล้ว)",{exact:false}).waitFor();
    assert.match(await admin.innerText(),/ไม่ได้บันทึก Paid จากส่วนนี้/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+2,"overflow "+width);
    await page.goto(url+"?scope=merchant");
    await page.evaluate(()=>{sessionStorage.setItem("testStatus","payment_failed_test")});
    await page.reload();
    await merchant.locator("summary").click();
    await merchant.getByText("Stripe TEST แจ้งชำระไม่สำเร็จ",{exact:false}).waitFor();
    assert.equal(await page.getByRole("button",{name:"เริ่ม Stripe TEST Checkout"}).count(),0);
    await page.getByRole("button",{name:"ตรวจ Stripe TEST"}).click();
    await merchant.getByText("Stripe TEST ยืนยันว่าไม่สำเร็จ",{exact:false}).waitFor();
    await page.evaluate(()=>{sessionStorage.setItem("testStatus","provider_test_refund_review")});
    await page.reload();
    await merchant.locator("summary").click();
    await merchant.getByText("Stripe TEST มีการคืนเงินหรือข้อพิพาท",{exact:false}).waitFor();
    assert.equal(await page.getByRole("button",{name:"เริ่ม Stripe TEST Checkout"}).count(),0);
    await page.getByRole("button",{name:"ตรวจ Stripe TEST"}).click();
    await merchant.getByText("Refund/Dispute ที่ตรวจสอบแล้ว",{exact:false}).waitFor();
    await page.goto(url+"?scope=platform");
    await admin.locator("summary").click();
    await admin.getByText("พบ Refund ของ Stripe TEST",{exact:false}).waitFor();
    assert.match(await admin.innerText(),/ไม่ได้บันทึก Paid จากส่วนนี้/);
    const calls=await page.evaluate(()=>window.__calls);
    assert.equal(calls.some(x=>x.name==="createOwnM7StripeTestCheckout"),false);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await vite?.close();await rm(dir,{recursive:true,force:true});}
});
test("lifecycle read-only contracts are server-bound and no refund or invoice-Paid callable is mounted",async()=>{
 const comp=await readFile("react-app/src/components/M7StripeTestReservation.jsx","utf8");
 const plat=await readFile("react-app/src/components/M7StripeTestShadowHistory.jsx","utf8");
 const fn=await readFile("functions/index.js","utf8");
 const rules=await readFile("firestore.rules","utf8");
 assert.match(comp,/inspectOwnM7StripeTestCheckout/);
 assert.match(comp,/data\.operationalInvoicePaid!==false/);
 assert.match(comp,/data\.canRetry!==false/);
 assert.match(plat,/expired_test/);
 assert.match(plat,/payment_failed_test/);
 assert.match(fn,/exports\.inspectOwnM7StripeTestCheckout/);
 assert.match(rules,/match \/m7StripeTestLifecycleAudits\/\{eventId\} \{\s*allow read, write: if false/);
 assert.doesNotMatch(fn,/exports\.markM7InvoicePaid/);
});
